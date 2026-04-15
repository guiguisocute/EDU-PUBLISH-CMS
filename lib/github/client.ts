import type {
  GitHubBranchSummary,
  GitHubRepoPermissions,
  GitHubRepositorySummary,
  RepoRef,
} from '../../types/github';
import type { WorkerEnv } from '../../worker/app';

const decoder = new TextDecoder();
const PAGE_SIZE = 100;

export interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

interface GitHubRequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

export interface GitHubTreeSnapshot {
  entries: GitHubTreeEntry[];
  truncated: boolean;
}

type FetchLike = typeof fetch;

function getApiBaseUrl(env: WorkerEnv): string {
  return String(env.GITHUB_API_BASE_URL || 'https://api.github.com').replace(/\/+$/, '');
}

function createAuthHeaders(accessToken: string, headers: HeadersInit = {}): Headers {
  const merged = new Headers(headers);
  merged.set('accept', merged.get('accept') || 'application/vnd.github+json');
  merged.set('authorization', `Bearer ${accessToken}`);
  merged.set('user-agent', 'edu-publish-cms');
  return merged;
}

async function fetchGitHubJson<T>(
  accessToken: string,
  env: WorkerEnv,
  path: string,
  options: GitHubRequestOptions = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const response = await fetchImpl(`${getApiBaseUrl(env)}${path}`, {
    method: options.method || 'GET',
    headers: createAuthHeaders(accessToken, options.headers),
    body: options.body,
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

function mapPermissions(value: unknown): GitHubRepoPermissions {
  const permissions = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  return {
    admin: Boolean(permissions.admin),
    maintain: Boolean(permissions.maintain),
    push: Boolean(permissions.push),
    triage: Boolean(permissions.triage),
    pull: Boolean(permissions.pull),
  };
}

export async function listRepositories(
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubRepositorySummary[]> {
  const repos: GitHubRepositorySummary[] = [];

  for (let page = 1; ; page += 1) {
    const payload = await fetchGitHubJson<Array<Record<string, unknown>>>(
      accessToken,
      env,
      `/user/repos?per_page=${PAGE_SIZE}&page=${page}`,
      {},
      fetchImpl,
    );

    repos.push(
      ...payload.map((repo) => ({
        owner: String((repo.owner as Record<string, unknown> | undefined)?.login || '').trim(),
        name: String(repo.name || '').trim(),
        fullName: String(repo.full_name || '').trim(),
        defaultBranch: String(repo.default_branch || '').trim(),
        private: Boolean(repo.private),
        permissions: mapPermissions(repo.permissions),
        updatedAt: String(repo.updated_at || '').trim(),
      })),
    );

    if (payload.length < PAGE_SIZE) {
      break;
    }
  }

  repos.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return repos;
}

export async function listBranches(
  repo: RepoRef,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubBranchSummary[]> {
  const branches: GitHubBranchSummary[] = [];

  for (let page = 1; ; page += 1) {
    const payload = await fetchGitHubJson<Array<Record<string, unknown>>>(
      accessToken,
      env,
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/branches?per_page=${PAGE_SIZE}&page=${page}`,
      {},
      fetchImpl,
    );

    branches.push(
      ...payload.map((branch) => ({
        name: String(branch.name || '').trim(),
        headSha: String((branch.commit as Record<string, unknown> | undefined)?.sha || '').trim(),
      })),
    );

    if (payload.length < PAGE_SIZE) {
      break;
    }
  }

  return branches;
}

export async function getBranchHead(
  repo: RepoRef,
  branch: string,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<{ headSha: string; treeSha: string }> {
  const refPayload = await fetchGitHubJson<Record<string, unknown>>(
    accessToken,
    env,
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/ref/heads/${encodeURIComponent(branch)}`,
    {},
    fetchImpl,
  );
  const headSha = String((refPayload.object as Record<string, unknown> | undefined)?.sha || '').trim();

  if (!headSha) {
    throw new Error(`GitHub branch ref was missing a commit sha for ${branch}`);
  }

  const commitPayload = await fetchGitHubJson<Record<string, unknown>>(
    accessToken,
    env,
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/commits/${headSha}`,
    {},
    fetchImpl,
  );
  const treeSha = String((commitPayload.tree as Record<string, unknown> | undefined)?.sha || '').trim();

  if (!treeSha) {
    throw new Error(`GitHub commit payload was missing a tree sha for ${branch}`);
  }

  return { headSha, treeSha };
}

export async function getTreeEntries(
  repo: RepoRef,
  treeSha: string,
  accessToken: string,
  env: WorkerEnv,
  options: {
    recursive?: boolean;
  } = {},
  fetchImpl: FetchLike = fetch,
): Promise<GitHubTreeSnapshot> {
  const recursive = options.recursive ?? false;
  const payload = await fetchGitHubJson<Record<string, unknown>>(
    accessToken,
    env,
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/trees/${treeSha}${recursive ? '?recursive=1' : ''}`,
    {},
    fetchImpl,
  );
  const tree = Array.isArray(payload.tree) ? payload.tree : [];

  const entries = tree.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const path = String(record.path || '').trim();
    const type = String(record.type || '').trim();
    const sha = String(record.sha || '').trim();

    if (!path || !sha || (type !== 'blob' && type !== 'tree')) {
      return [];
    }

    return [{
      path,
      type,
      sha,
      size: Number.isFinite(Number(record.size)) ? Number(record.size) : undefined,
    } satisfies GitHubTreeEntry];
  });

  return {
    entries,
    truncated: Boolean(payload.truncated),
  };
}

export async function getRecursiveTree(
  repo: RepoRef,
  treeSha: string,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubTreeEntry[]> {
  const snapshot = await getTreeEntries(
    repo,
    treeSha,
    accessToken,
    env,
    { recursive: true },
    fetchImpl,
  );

  return snapshot.entries;
}

function decodeBase64Utf8(content: string): string {
  const normalized = content.replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return decoder.decode(bytes);
}

export async function getBlobText(
  repo: RepoRef,
  sha: string,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const payload = await fetchGitHubJson<Record<string, unknown>>(
    accessToken,
    env,
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/blobs/${sha}`,
    {},
    fetchImpl,
  );
  const encoding = String(payload.encoding || '').trim();
  const content = String(payload.content || '');

  if (encoding !== 'base64') {
    throw new Error(`Unsupported blob encoding: ${encoding || 'unknown'}`);
  }

  return decodeBase64Utf8(content);
}

export async function getBlobBase64(
  repo: RepoRef,
  sha: string,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const payload = await fetchGitHubJson<Record<string, unknown>>(
    accessToken,
    env,
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/blobs/${sha}`,
    {},
    fetchImpl,
  );
  const encoding = String(payload.encoding || '').trim();
  const content = String(payload.content || '');

  if (encoding !== 'base64') {
    throw new Error(`Unsupported blob encoding: ${encoding || 'unknown'}`);
  }

  return content.replace(/\s+/g, '');
}

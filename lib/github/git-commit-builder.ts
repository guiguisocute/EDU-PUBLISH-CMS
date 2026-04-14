import type { RepoRef } from '../../types/github';
import type { WorkerEnv } from '../../worker/app';
import type { ValidatedPublishChange } from './publish-validator';

type FetchLike = typeof fetch;

interface GitHubRequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

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
  repo: RepoRef,
  accessToken: string,
  env: WorkerEnv,
  path: string,
  options: GitHubRequestOptions = {},
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const response = await fetchImpl(
    `${getApiBaseUrl(env)}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}${path}`,
    {
      method: options.method || 'GET',
      headers: createAuthHeaders(accessToken, options.headers),
      body: options.body,
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub write request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function readBranchRef(
  repo: RepoRef,
  branch: string,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<{ headSha: string } | null> {
  const response = await fetchImpl(
    `${getApiBaseUrl(env)}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/ref/heads/${encodeURIComponent(branch)}`,
    {
      headers: createAuthHeaders(accessToken),
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub ref lookup failed (${response.status}) for ${branch}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const headSha = String((payload.object as Record<string, unknown> | undefined)?.sha || '').trim();

  if (!headSha) {
    throw new Error(`GitHub ref lookup returned no head sha for ${branch}`);
  }

  return { headSha };
}

async function createBlob(
  repo: RepoRef,
  change: ValidatedPublishChange,
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike,
): Promise<string> {
  const payload = await fetchGitHubJson<Record<string, unknown>>(
    repo,
    accessToken,
    env,
    '/git/blobs',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: change.content,
        encoding: change.encoding,
      }),
    },
    fetchImpl,
  );

  return String(payload.sha || '').trim();
}

export interface AtomicPublishInput {
  repo: RepoRef;
  accessToken: string;
  env: WorkerEnv;
  fetchImpl?: FetchLike;
  parentSha: string;
  baseTreeSha: string;
  commitMessage: string;
  targetBranch: string;
  createBranch: boolean;
  changes: ValidatedPublishChange[];
}

export async function publishAtomicCommit({
  repo,
  accessToken,
  env,
  fetchImpl = fetch,
  parentSha,
  baseTreeSha,
  commitMessage,
  targetBranch,
  createBranch,
  changes,
}: AtomicPublishInput): Promise<{ commitSha: string }> {
  const treeEntries = await Promise.all(
    changes.map(async (change) => {
      if (change.operation === 'delete') {
        return {
          path: change.path,
          mode: '100644',
          type: 'blob',
          sha: null,
        };
      }

      const blobSha = await createBlob(repo, change, accessToken, env, fetchImpl);

      return {
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: blobSha,
      };
    }),
  );
  const treePayload = await fetchGitHubJson<Record<string, unknown>>(
    repo,
    accessToken,
    env,
    '/git/trees',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    },
    fetchImpl,
  );
  const treeSha = String(treePayload.sha || '').trim();

  if (!treeSha) {
    throw new Error('GitHub tree creation returned no sha.');
  }

  const commitPayload = await fetchGitHubJson<Record<string, unknown>>(
    repo,
    accessToken,
    env,
    '/git/commits',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: treeSha,
        parents: [parentSha],
      }),
    },
    fetchImpl,
  );
  const commitSha = String(commitPayload.sha || '').trim();

  if (!commitSha) {
    throw new Error('GitHub commit creation returned no sha.');
  }

  if (createBranch) {
    await fetchGitHubJson(
      repo,
      accessToken,
      env,
      '/git/refs',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: commitSha,
        }),
      },
      fetchImpl,
    );
  } else {
    await fetchGitHubJson(
      repo,
      accessToken,
      env,
      `/git/refs/heads/${encodeURIComponent(targetBranch)}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sha: commitSha,
          force: false,
        }),
      },
      fetchImpl,
    );
  }

  return { commitSha };
}

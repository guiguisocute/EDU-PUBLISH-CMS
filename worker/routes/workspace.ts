import { parseCardDocument } from '../../lib/content/card-document';
import {
  getBlobBase64,
  getBlobText,
  getMultipleBlobText,
  getBranchHead,
  getTreeEntries,
} from '../../lib/github/client';
import {
  checkRepositoryCompatibility,
  isAttachmentPath,
  selectWorkspaceEntries,
} from '../../lib/github/compatibility';
import { mergeWorkspaceStaticTreeEntries } from '../../lib/github/workspace-tree';
import { getWorkspaceAssetMimeType } from '../../lib/content/workspace-assets';
import type {
  WorkspaceAssetLoadRequest,
  WorkspaceLoadRequest,
} from '../../types/github';
import type { WorkerRoute } from '../app';
import { readSessionCookie } from '../session/cookies';

function unauthorizedResponse(): Response {
  return Response.json({ error: 'Not authenticated.' }, { status: 401 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function notFound(message: string): Response {
  return Response.json({ error: message }, { status: 404 });
}

function buildDownloadFileName(path: string, fallback = 'download'): string {
  const fileName = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || fallback;
  return fileName.replace(/["\r\n]/g, '_');
}

function buildContentDisposition(fileName: string, disposition: 'inline' | 'attachment'): string {
  const fallbackName = buildDownloadFileName(fileName);
  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(fallbackName)}`;
}

function normalizeCandidatePath(path: string): string {
  const segments = String(path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/');
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments.join('/');
}

function buildDerivedCandidatePaths(path: string): string[] {
  const normalized = normalizeCandidatePath(path);

  if (!normalized) {
    return [];
  }

  const derivedPaths: string[] = [];

  if (normalized.startsWith('attachments/')) {
    derivedPaths.push(`content/${normalized}`);
  }

  if (normalized.startsWith('img/')) {
    const suffix = normalized.slice('img/'.length);

    derivedPaths.push(`public/${normalized}`);
    derivedPaths.push(`content/${normalized}`);

    if (suffix) {
      derivedPaths.push(`content/attachments/${suffix}`);
    }

    derivedPaths.push(`content/attachments/${normalized}`);
  }

  return derivedPaths;
}

function expandWorkspaceBlobCandidates(candidates: string[]): string[] {
  const expanded = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeCandidatePath(candidate);

    if (!normalized) {
      continue;
    }

    expanded.add(normalized);

    for (const derived of buildDerivedCandidatePaths(normalized)) {
      expanded.add(derived);
    }
  }

  return Array.from(expanded);
}

async function resolveBlobFromCandidatePaths(
  repo: { owner: string; name: string },
  rootTreeSha: string,
  accessToken: string,
  env: Parameters<WorkerRoute['handler']>[0]['env'],
  candidates: string[],
): Promise<{ path: string; sha: string } | null> {
  const normalizedCandidates = expandWorkspaceBlobCandidates(candidates);

  if (normalizedCandidates.length === 0) {
    return null;
  }

  const treeCache = new Map<string, ReturnType<typeof getTreeEntries>>();
  const readTree = (treeSha: string) => {
    if (!treeCache.has(treeSha)) {
      treeCache.set(treeSha, getTreeEntries(repo, treeSha, accessToken, env));
    }

    return treeCache.get(treeSha)!;
  };

  for (const candidatePath of normalizedCandidates) {
    const parts = candidatePath.split('/').filter(Boolean);

    if (parts.length === 0) {
      continue;
    }

    let currentTreeSha = rootTreeSha;
    let failed = false;

    for (let index = 0; index < parts.length; index += 1) {
      const segment = parts[index];
      const snapshot = await readTree(currentTreeSha);
      const isLast = index === parts.length - 1;

      if (isLast) {
        const blobEntry = snapshot.entries.find(
          (entry) => entry.type === 'blob' && entry.path === segment,
        );

        if (blobEntry) {
          return {
            path: candidatePath,
            sha: blobEntry.sha,
          };
        }

        failed = true;
        break;
      }

      const nextTreeEntry = snapshot.entries.find(
        (entry) => entry.type === 'tree' && entry.path === segment,
      );

      if (!nextTreeEntry) {
        failed = true;
        break;
      }

      currentTreeSha = nextTreeEntry.sha;
    }

    if (!failed) {
      continue;
    }
  }

  return null;
}

export const workspaceRoutes: WorkerRoute[] = [
  {
    method: 'POST',
    path: '/api/workspace/load',
    handler: async ({ request, env }) => {
      const session = await readSessionCookie(request, env);

      if (!session) {
        return unauthorizedResponse();
      }

      let payload: WorkspaceLoadRequest;

      try {
        payload = (await request.json()) as WorkspaceLoadRequest;
      } catch {
        return badRequest('Invalid JSON request body.');
      }

      const owner = String(payload.repo?.owner || '').trim();
      const name = String(payload.repo?.name || '').trim();
      const branch = String(payload.branch || '').trim();

      if (!owner || !name || !branch) {
        return badRequest('repo.owner, repo.name, and branch are required.');
      }

      const repo = { owner, name };
      const { headSha, treeSha } = await getBranchHead(
        repo,
        branch,
        session.accessToken,
        env,
      );
      const treeSnapshot = await getTreeEntries(repo, treeSha, session.accessToken, env, { recursive: true });
      const treeEntries = await mergeWorkspaceStaticTreeEntries(
        repo,
        treeSha,
        session.accessToken,
        env,
        treeSnapshot.entries,
      );
      const compatibility = checkRepositoryCompatibility(treeEntries);

      if (!compatibility.compatible) {
        return Response.json(compatibility, { status: 409 });
      }

      const {
        cardEntries,
        attachmentEntries,
        siteConfigEntry,
        widgetsConfigEntry,
        subscriptionsConfigEntry,
      } = selectWorkspaceEntries(treeEntries);

      if (!siteConfigEntry || !widgetsConfigEntry || !subscriptionsConfigEntry) {
        return Response.json(
          {
            compatible: false,
            issues: [
              !siteConfigEntry
                ? { path: 'config/site.yaml', message: 'Missing required file' }
                : null,
              !widgetsConfigEntry
                ? { path: 'config/widgets.yaml', message: 'Missing required file' }
                : null,
              !subscriptionsConfigEntry
                ? { path: 'config/subscriptions.yaml', message: 'Missing required file' }
                : null,
            ].filter(Boolean),
          },
          { status: 409 },
        );
      }

      const [siteYaml, widgetsYaml, subscriptionsYaml] = await Promise.all([
        getBlobText(repo, siteConfigEntry.sha, session.accessToken, env),
        getBlobText(repo, widgetsConfigEntry.sha, session.accessToken, env),
        getBlobText(repo, subscriptionsConfigEntry.sha, session.accessToken, env),
      ]);

      const cards = [];
      const batchSize = 40;
      for (let i = 0; i < cardEntries.length; i += batchSize) {
        const batch = cardEntries.slice(i, i + batchSize);
        const map = await getMultipleBlobText(repo, batch.map(e => e.sha), session.accessToken, env);
        
        for (const entry of batch) {
          const raw = map.get(entry.sha) ?? '';
          cards.push(parseCardDocument(raw, {
            path: entry.path,
            sha: entry.sha,
            dirty: false,
          }));
        }
      }

      return Response.json({
        repo,
        branch,
        baseHeadSha: headSha,
        cards,
        readonlyConfig: {
          siteYaml,
          widgetsYaml,
          subscriptionsYaml,
        },
        attachments: attachmentEntries.map((entry) => ({
          path: entry.path,
          sha: entry.sha,
          size: entry.size ?? 0,
        })),
      });
    },
  },
  {
    method: 'GET',
    path: '/api/workspace/blob',
    handler: async ({ request, env }) => {
      const session = await readSessionCookie(request, env);
      if (!session) return unauthorizedResponse();

      const url = new URL(request.url);
      const owner = url.searchParams.get('owner');
      const name = url.searchParams.get('name');
      const sha = url.searchParams.get('sha');
      const branch = String(url.searchParams.get('branch') || '').trim();
      const requestedCandidates = url.searchParams.getAll('candidate')
        .map((candidate) => String(candidate || '').trim())
        .filter(Boolean);
      const candidates = expandWorkspaceBlobCandidates(requestedCandidates);
      const path = String(url.searchParams.get('path') || '').trim();
      const download = url.searchParams.get('download') === '1';

      if (!owner || !name || (!sha && (!branch || candidates.length === 0))) {
        return badRequest('owner, name, and sha or branch plus candidate paths are required params');
      }

      const repo = { owner, name };
      
      try {
        let resolvedSha = sha;
        let resolvedPath = path;
        let resolvedFromBranchCandidates = false;

        if (!resolvedSha) {
          const { treeSha } = await getBranchHead(repo, branch, session.accessToken, env);
          const treeSnapshot = await getTreeEntries(repo, treeSha, session.accessToken, env, { recursive: true });
          const treeEntries = await mergeWorkspaceStaticTreeEntries(
            repo,
            treeSha,
            session.accessToken,
            env,
            treeSnapshot.entries,
          );
          let matchedEntry = treeEntries.find(
            (entry) => entry.type === 'blob' && candidates.includes(entry.path),
          );

          if (!matchedEntry) {
            const resolvedCandidateEntry = await resolveBlobFromCandidatePaths(
              repo,
              treeSha,
              session.accessToken,
              env,
              candidates,
            );

            if (resolvedCandidateEntry) {
              matchedEntry = {
                path: resolvedCandidateEntry.path,
                sha: resolvedCandidateEntry.sha,
                type: 'blob',
              };
            }
          }

          if (!matchedEntry) {
            return notFound(`Failed to resolve workspace blob path from candidates: ${candidates.join(', ')}`);
          }

          resolvedSha = matchedEntry.sha;
          resolvedPath = matchedEntry.path;
          resolvedFromBranchCandidates = true;
        }

        const base64Str = await getBlobBase64(repo, resolvedSha, session.accessToken, env);
        const binary = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
        return new Response(binary, {
          headers: {
            'Cache-Control': resolvedFromBranchCandidates
              ? 'private, no-store'
              : 'public, max-age=31536000, immutable',
            'Content-Type': getWorkspaceAssetMimeType(resolvedPath || resolvedSha),
            'Content-Disposition': buildContentDisposition(resolvedPath || 'download', download ? 'attachment' : 'inline'),
          }
        });
      } catch (err) {
        return badRequest('Failed to fetch blob: ' + (err instanceof Error ? err.message : String(err)));
      }
    },
  },
  {
    method: 'POST',
    path: '/api/workspace/assets',
    handler: async ({ request, env }) => {
      const session = await readSessionCookie(request, env);
      if (!session) return unauthorizedResponse();

      let payload: WorkspaceAssetLoadRequest;

      try {
        payload = (await request.json()) as WorkspaceAssetLoadRequest;
      } catch {
        return badRequest('Invalid JSON request body.');
      }

      const owner = String(payload.repo?.owner || '').trim();
      const name = String(payload.repo?.name || '').trim();
      const assets = Array.isArray(payload.assets) ? payload.assets : [];

      if (!owner || !name) {
        return badRequest('repo.owner and repo.name are required.');
      }

      if (assets.length === 0) {
        return badRequest('At least one asset is required.');
      }

      if (assets.length > 25) {
        return badRequest('Asset batch is too large.');
      }

      const repo = { owner, name };
      const normalizedAssets = assets.map((asset) => ({
        path: String(asset.path || '').trim(),
        sha: String(asset.sha || '').trim(),
        size: Number.isFinite(Number(asset.size)) ? Number(asset.size) : 0,
      }));

      if (normalizedAssets.some((asset) => !asset.path || !asset.sha)) {
        return badRequest('Each asset must include a path and sha.');
      }

      if (normalizedAssets.some((asset) => !isAttachmentPath(asset.path))) {
        return badRequest('Asset batches only support attachment and image paths.');
      }

      const contentAssets = await Promise.all(
        normalizedAssets.map(async (asset) => ({
          ...asset,
          encoding: 'base64' as const,
          content: await getBlobBase64(repo, asset.sha, session.accessToken, env),
        })),
      );

      return Response.json({
        assets: contentAssets,
      });
    },
  },
];

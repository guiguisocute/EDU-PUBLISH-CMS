import type { RepoRef } from '../../types/github';
import type { WorkerEnv } from '../../worker/app';
import type { GitHubTreeEntry } from './client';
import { getTreeEntries } from './client';
import { isWorkspaceStaticAssetPath } from './compatibility';

const STATIC_TREE_PATHS = [
  ['img'],
  ['public', 'img'],
] as const;

function prefixTreeEntries(prefix: string, entries: GitHubTreeEntry[]): GitHubTreeEntry[] {
  return entries.map((entry) => ({
    ...entry,
    path: prefix ? `${prefix}/${entry.path}` : entry.path,
  }));
}

function dedupeTreeEntries(entries: GitHubTreeEntry[]): GitHubTreeEntry[] {
  const byKey = new Map<string, GitHubTreeEntry>();

  for (const entry of entries) {
    byKey.set(`${entry.type}:${entry.path}`, entry);
  }

  return Array.from(byKey.values());
}

export async function mergeWorkspaceStaticTreeEntries(
  repo: RepoRef,
  rootTreeSha: string,
  accessToken: string,
  env: WorkerEnv,
  baseEntries: GitHubTreeEntry[],
): Promise<GitHubTreeEntry[]> {
  const treeCache = new Map<string, ReturnType<typeof getTreeEntries>>();
  const readTree = (treeSha: string, recursive = false) => {
    const cacheKey = `${treeSha}:${recursive ? 'recursive' : 'shallow'}`;

    if (!treeCache.has(cacheKey)) {
      treeCache.set(
        cacheKey,
        getTreeEntries(repo, treeSha, accessToken, env, { recursive }),
      );
    }

    return treeCache.get(cacheKey)!;
  };

  const rootTree = await readTree(rootTreeSha);
  const rootStaticEntries = rootTree.entries.filter(
    (entry) => entry.type === 'blob' && isWorkspaceStaticAssetPath(entry.path),
  );

  const nestedStaticTrees = await Promise.all(
    STATIC_TREE_PATHS.map(async (segments) => {
      let currentTreeSha = rootTreeSha;
      let prefix = '';

      for (const segment of segments) {
        const treeSnapshot = await readTree(currentTreeSha);
        const nextTree = treeSnapshot.entries.find(
          (entry) => entry.type === 'tree' && entry.path === segment,
        );

        if (!nextTree) {
          return [];
        }

        currentTreeSha = nextTree.sha;
        prefix = prefix ? `${prefix}/${segment}` : segment;
      }

      const nestedTree = await readTree(currentTreeSha, true);
      return prefixTreeEntries(prefix, nestedTree.entries);
    }),
  );

  return dedupeTreeEntries([
    ...baseEntries,
    ...rootStaticEntries,
    ...nestedStaticTrees.flat(),
  ]);
}

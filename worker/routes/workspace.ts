import { parseCardDocument } from '../../lib/content/card-document';
import {
  getBlobText,
  getBranchHead,
  getRecursiveTree,
} from '../../lib/github/client';
import {
  checkRepositoryCompatibility,
  selectWorkspaceEntries,
} from '../../lib/github/compatibility';
import type { WorkspaceLoadRequest } from '../../types/github';
import type { WorkerRoute } from '../app';
import { readSessionCookie } from '../session/cookies';

function unauthorizedResponse(): Response {
  return Response.json({ error: 'Not authenticated.' }, { status: 401 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
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
      const treeEntries = await getRecursiveTree(repo, treeSha, session.accessToken, env);
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
      const batchSize = 10;
      for (let i = 0; i < cardEntries.length; i += batchSize) {
        const batch = cardEntries.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (entry) => {
            const raw = await getBlobText(repo, entry.sha, session.accessToken, env);
            return parseCardDocument(raw, {
              path: entry.path,
              sha: entry.sha,
              dirty: false,
            });
          })
        );
        cards.push(...batchResults);
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
];

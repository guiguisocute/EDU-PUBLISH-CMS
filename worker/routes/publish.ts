import { parseCardDocument } from '../../lib/content/card-document';
import { compileWorkspace } from '../../lib/content/preview-compiler';
import {
  getBlobText,
  getBranchHead,
  getRecursiveTree,
} from '../../lib/github/client';
import {
  checkRepositoryCompatibility,
  selectWorkspaceEntries,
} from '../../lib/github/compatibility';
import {
  publishAtomicCommit,
  readBranchRef,
} from '../../lib/github/git-commit-builder';
import {
  validatePublishRequest,
} from '../../lib/github/publish-validator';
import type { DraftWorkspace, PublishRequest } from '../../types/github';
import type { WorkerRoute } from '../app';
import { readSessionCookie } from '../session/cookies';

function unauthorizedResponse(): Response {
  return Response.json({ error: 'Not authenticated.' }, { status: 401 });
}

function badRequest(message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error: message, ...extra }, { status: 400 });
}

async function loadWorkspaceSnapshot(
  repo: PublishRequest['repo'],
  branch: string,
  accessToken: string,
  env: Parameters<WorkerRoute['handler']>[0]['env'],
): Promise<{ workspace: DraftWorkspace; headSha: string; treeSha: string }> {
  const { headSha, treeSha } = await getBranchHead(repo, branch, accessToken, env);
  const treeEntries = await getRecursiveTree(repo, treeSha, accessToken, env);
  const compatibility = checkRepositoryCompatibility(treeEntries);

  if (!compatibility.compatible) {
    throw new Error('Repository is incompatible for publish validation.');
  }

  const {
    cardEntries,
    attachmentEntries,
    siteConfigEntry,
    widgetsConfigEntry,
    subscriptionsConfigEntry,
  } = selectWorkspaceEntries(treeEntries);

  if (!siteConfigEntry || !widgetsConfigEntry || !subscriptionsConfigEntry) {
    throw new Error('Repository config is incomplete for publish validation.');
  }

  const [siteYaml, widgetsYaml, subscriptionsYaml, cards] = await Promise.all([
    getBlobText(repo, siteConfigEntry.sha, accessToken, env),
    getBlobText(repo, widgetsConfigEntry.sha, accessToken, env),
    getBlobText(repo, subscriptionsConfigEntry.sha, accessToken, env),
    Promise.all(
      cardEntries.map(async (entry) => {
        const raw = await getBlobText(repo, entry.sha, accessToken, env);
        return parseCardDocument(raw, {
          path: entry.path,
          sha: entry.sha,
          dirty: false,
        });
      }),
    ),
  ]);

  return {
    workspace: {
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
    },
    headSha,
    treeSha,
  };
}

function applyPublishChanges(workspace: DraftWorkspace, changes: ReturnType<typeof validatePublishRequest>['changes']): DraftWorkspace {
  const cardMap = new Map(workspace.cards.map((card) => [card.path, card]));

  for (const change of changes) {
    if (!change.path.startsWith('content/card/')) {
      continue;
    }

    if (change.operation === 'delete') {
      cardMap.delete(change.path);
      continue;
    }

    cardMap.set(
      change.path,
      parseCardDocument(String(change.content), {
        path: change.path,
        sha: '',
        dirty: false,
      }),
    );
  }

  return {
    ...workspace,
    cards: Array.from(cardMap.values()).sort((left, right) => left.path.localeCompare(right.path, 'zh-CN')),
  };
}

export const publishRoutes: WorkerRoute[] = [
  {
    method: 'POST',
    path: '/api/publish',
    handler: async ({ request, env }) => {
      const session = await readSessionCookie(request, env);

      if (!session) {
        return unauthorizedResponse();
      }

      let rawPayload: PublishRequest;

      try {
        rawPayload = (await request.json()) as PublishRequest;
      } catch {
        return badRequest('Invalid JSON request body.');
      }

      let payload: ReturnType<typeof validatePublishRequest>;

      try {
        payload = validatePublishRequest(rawPayload);
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'Invalid publish request.');
      }

      const targetRef = await readBranchRef(
        payload.repo,
        payload.targetBranch,
        session.accessToken,
        env,
      );

      if (targetRef && targetRef.headSha !== payload.baseHeadSha) {
        return Response.json(
          {
            error: 'Branch head moved. Reload the workspace before publishing.',
            remoteHeadSha: targetRef.headSha,
            targetBranch: payload.targetBranch,
          },
          { status: 409 },
        );
      }

      const publishBaseBranch = targetRef ? payload.targetBranch : payload.baseBranch;
      const snapshot = await loadWorkspaceSnapshot(
        payload.repo,
        publishBaseBranch,
        session.accessToken,
        env,
      );

      if (!targetRef && snapshot.headSha !== payload.baseHeadSha) {
        return Response.json(
          {
            error: 'Branch head moved. Reload the workspace before publishing.',
            remoteHeadSha: snapshot.headSha,
            targetBranch: payload.baseBranch,
          },
          { status: 409 },
        );
      }

      const nextWorkspace = applyPublishChanges(snapshot.workspace, payload.changes);
      const compileResult = compileWorkspace(nextWorkspace, {
        generatedAt: nextWorkspace.baseHeadSha,
      });

      if (compileResult.issues.some((issue) => issue.severity === 'error')) {
        return badRequest('Publish validation failed.', {
          issues: compileResult.issues,
        });
      }

      const { commitSha } = await publishAtomicCommit({
        repo: payload.repo,
        accessToken: session.accessToken,
        env,
        parentSha: snapshot.headSha,
        baseTreeSha: snapshot.treeSha,
        commitMessage: payload.commitMessage,
        targetBranch: payload.targetBranch,
        createBranch: !targetRef,
        changes: payload.changes,
      });

      return Response.json({
        commitSha,
        targetBranch: payload.targetBranch,
        commitUrl: `https://github.com/${payload.repo.owner}/${payload.repo.name}/commit/${commitSha}`,
        compareUrl: targetRef
          ? `https://github.com/${payload.repo.owner}/${payload.repo.name}/compare/${snapshot.headSha}...${commitSha}`
          : undefined,
        publishedAt: new Date().toISOString(),
      });
    },
  },
];

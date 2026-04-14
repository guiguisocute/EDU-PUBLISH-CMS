import {
  listBranches,
  listRepositories,
} from '../../lib/github/client';
import type { WorkerRoute } from '../app';
import { readSessionCookie } from '../session/cookies';

function unauthorizedResponse(): Response {
  return Response.json({ error: 'Not authenticated.' }, { status: 401 });
}

export const reposRoutes: WorkerRoute[] = [
  {
    method: 'GET',
    path: '/api/repos',
    handler: async ({ request, env }) => {
      const session = await readSessionCookie(request, env);

      if (!session) {
        return unauthorizedResponse();
      }

      const repos = await listRepositories(session.accessToken, env);
      return Response.json({ repos });
    },
  },
  {
    method: 'GET',
    path: '/api/repos/:owner/:repo/branches',
    handler: async ({ request, env, params }) => {
      const session = await readSessionCookie(request, env);

      if (!session) {
        return unauthorizedResponse();
      }

      const branches = await listBranches(
        {
          owner: params.owner,
          name: params.repo,
        },
        session.accessToken,
        env,
      );

      return Response.json({ branches });
    },
  },
];

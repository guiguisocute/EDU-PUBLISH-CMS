import type { WorkerRoute } from '../app';
import { readSessionCookie } from '../session/cookies';

export const sessionRoutes: WorkerRoute[] = [
  {
    method: 'GET',
    path: '/api/session',
    handler: async ({ request, env }) => {
      const session = await readSessionCookie(request, env);

      if (!session) {
        return Response.json({
          authenticated: false,
          viewer: null,
        });
      }

      return Response.json({
        authenticated: true,
        viewer: session.viewer,
      });
    },
  },
];

import { publishRoutes } from './routes/publish';
import { authRoutes } from './routes/auth';
import { reposRoutes } from './routes/repos';
import { sessionRoutes } from './routes/session';
import { workspaceRoutes } from './routes/workspace';
import {
  buildRequestLogContext,
  logRequestEnd,
  logRequestStart,
} from './lib/request-log';

export interface WorkerEnv {
  APP_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  GITHUB_OAUTH_BASE_URL?: string;
  GITHUB_API_BASE_URL?: string;
  SESSION_SECRET?: string;
}

export interface WorkerExecutionContext {
  waitUntil?(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

export interface WorkerRouteContext {
  request: Request;
  env: WorkerEnv;
  ctx: WorkerExecutionContext;
  url: URL;
  params: Record<string, string>;
}

export type WorkerRouteHandler = (
  context: WorkerRouteContext,
) => Response | Promise<Response>;

export interface WorkerRoute {
  method: string;
  path: string;
  handler: WorkerRouteHandler;
}

export interface WorkerApp {
  fetch(
    request: Request,
    env?: WorkerEnv,
    ctx?: WorkerExecutionContext,
  ): Promise<Response>;
}

const baseRoutes: WorkerRoute[] = [
  {
    method: 'GET',
    path: '/api/health',
    handler: () => Response.json({ ok: true, service: 'edu-publish-cms-worker' }),
  },
  {
    method: 'GET',
    path: '/',
    handler: () =>
      new Response('EDU-PUBLISH-CMS worker is running.', {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
      }),
  },
];

function matchPath(routePath: string, pathname: string): Record<string, string> | null {
  const routeSegments = routePath.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];

    if (!routeSegment || !pathSegment) {
      return null;
    }

    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

export function createWorkerApp(routes: WorkerRoute[] = []): WorkerApp {
  const routeTable = [
    ...baseRoutes,
    ...authRoutes,
    ...sessionRoutes,
    ...reposRoutes,
    ...workspaceRoutes,
    ...publishRoutes,
    ...routes,
  ];

  return {
    async fetch(
      request: Request,
      env: WorkerEnv = {},
      ctx: WorkerExecutionContext = {},
    ): Promise<Response> {
      const url = new URL(request.url);
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const logContext = await buildRequestLogContext(request);

      logRequestStart(logContext);

      try {
        for (const route of routeTable) {
          if (route.method !== request.method.toUpperCase()) {
            continue;
          }

          const params = matchPath(route.path, url.pathname);

          if (!params) {
            continue;
          }

          const response = await route.handler({ request, env, ctx, url, params });

          response.headers.set('x-request-id', logContext.requestId);
          logRequestEnd(
            logContext,
            response,
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
          );

          return response;
        }

        const response = url.pathname.startsWith('/api/')
          ? Response.json({ error: 'Not implemented yet.' }, { status: 404 })
          : new Response('Not Found', { status: 404 });

        response.headers.set('x-request-id', logContext.requestId);
        logRequestEnd(
          logContext,
          response,
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
        );

        return response;
      } catch (error) {
        const response = Response.json({ error: 'Internal server error.' }, { status: 500 });
        response.headers.set('x-request-id', logContext.requestId);
        logRequestEnd(
          logContext,
          response,
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
          error instanceof Error ? error.message : 'Unknown error',
        );
        return response;
      }
    },
  };
}

export const app = createWorkerApp();

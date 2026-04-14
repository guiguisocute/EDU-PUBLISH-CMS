import {
  createGitHubAuthorizationRequest,
  exchangeCodeForAccessToken,
  fetchGitHubViewer,
} from '../auth/oauth';
import type { WorkerRoute } from '../app';
import {
  clearOAuthCookie,
  clearSessionCookie,
  createOAuthCookie,
  createSessionCookie,
  readOAuthCookie,
} from '../session/cookies';

function jsonError(message: string, status: number, setCookies: string[] = []): Response {
  const response = Response.json({ error: message }, { status });

  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie);
  }

  return response;
}

function redirectWithCookies(location: string, cookies: string[]): Response {
  const response = new Response(null, {
    status: 302,
    headers: {
      location,
    },
  });

  for (const cookie of cookies) {
    response.headers.append('set-cookie', cookie);
  }

  return response;
}

export const authRoutes: WorkerRoute[] = [
  {
    method: 'GET',
    path: '/api/auth/github/start',
    handler: async ({ env }) => {
      const { authorizationUrl, state, codeVerifier } = await createGitHubAuthorizationRequest(env);
      const oauthCookie = await createOAuthCookie({ state, codeVerifier }, env);

      return redirectWithCookies(authorizationUrl, [oauthCookie]);
    },
  },
  {
    method: 'GET',
    path: '/api/auth/github/callback',
    handler: async ({ request, env, url }) => {
      const code = String(url.searchParams.get('code') ?? '').trim();
      const state = String(url.searchParams.get('state') ?? '').trim();

      if (!code) {
        return jsonError('Missing OAuth code.', 400, [clearOAuthCookie()]);
      }

      const oauthCookie = await readOAuthCookie(request, env);

      if (!oauthCookie || !state || oauthCookie.state !== state) {
        return jsonError('Invalid OAuth state.', 400, [clearOAuthCookie()]);
      }

      try {
        const accessToken = await exchangeCodeForAccessToken(code, oauthCookie.codeVerifier, env);
        const viewer = await fetchGitHubViewer(accessToken, env);
        const sessionCookie = await createSessionCookie({ accessToken, viewer }, env);

        return redirectWithCookies(String(env.APP_URL || '/'), [
          sessionCookie,
          clearOAuthCookie(),
        ]);
      } catch {
        return jsonError('GitHub authentication failed.', 502, [clearOAuthCookie()]);
      }
    },
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    handler: () => {
      const response = new Response(null, { status: 204 });
      response.headers.append('set-cookie', clearSessionCookie());
      response.headers.append('set-cookie', clearOAuthCookie());
      return response;
    },
  },
];

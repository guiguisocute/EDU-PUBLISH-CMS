import { describe, expect, it, vi } from 'vitest';
import { createWorkerApp, type WorkerApp, type WorkerEnv } from '../../../worker/app';

function createEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    APP_URL: 'https://cms.local/app',
    GITHUB_CLIENT_ID: 'client-id',
    GITHUB_CLIENT_SECRET: 'client-secret',
    GITHUB_REDIRECT_URI: 'https://cms.local/api/auth/github/callback',
    GITHUB_OAUTH_BASE_URL: 'https://github.local/login/oauth',
    GITHUB_API_BASE_URL: 'https://api.github.local',
    SESSION_SECRET: 'test-session-secret',
    ...overrides,
  };
}

function createCookieJar(): Record<string, string> {
  return {};
}

function createExecutionContext() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

function getSetCookies(response: Response): string[] {
  const getSetCookie = (response.headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;

  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(response.headers);
  }

  const setCookie = response.headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

function applySetCookies(jar: Record<string, string>, response: Response): void {
  for (const setCookie of getSetCookies(response)) {
    const [pair, ...attributes] = setCookie.split(';');
    const separatorIndex = pair.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    const shouldDelete = attributes.some((attribute) => /max-age=0/i.test(attribute));

    if (shouldDelete || value === '') {
      delete jar[name];
      continue;
    }

    jar[name] = value;
  }
}

function serializeCookieJar(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function sendRequest(
  app: WorkerApp,
  jar: Record<string, string>,
  path: string,
  init: RequestInit = {},
  envOverrides: Partial<WorkerEnv> = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (Object.keys(jar).length > 0) {
    headers.set('cookie', serializeCookieJar(jar));
  }

  const request = new Request(`https://cms.local${path}`, {
    ...init,
    headers,
  });
  const response = await app.fetch(request, createEnv(envOverrides), createExecutionContext());

  applySetCookies(jar, response);

  return response;
}

describe('auth and session Worker routes', () => {
  it('starts GitHub OAuth with PKCE and sets a temporary auth cookie', async () => {
    const app = createWorkerApp();
    const jar = createCookieJar();

    const response = await sendRequest(app, jar, '/api/auth/github/start');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('https://github.local/login/oauth/authorize?');
    const redirectUrl = new URL(response.headers.get('location') || 'https://invalid.local');
    expect(redirectUrl.searchParams.get('client_id')).toBe('client-id');
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe('https://cms.local/api/auth/github/callback');
    expect(redirectUrl.searchParams.get('response_type')).toBe('code');
    expect(redirectUrl.searchParams.get('state')).toBeTruthy();
    expect(redirectUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(redirectUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(Object.keys(jar)).not.toHaveLength(0);
  });

  it('rejects callback requests when the oauth state does not match the stored cookie', async () => {
    const app = createWorkerApp();
    const jar = createCookieJar();
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const startResponse = await sendRequest(app, jar, '/api/auth/github/start');
    const startUrl = new URL(startResponse.headers.get('location') || 'https://invalid.local');
    const validState = startUrl.searchParams.get('state');

    expect(validState).toBeTruthy();

    const response = await sendRequest(
      app,
      jar,
      `/api/auth/github/callback?code=test-code&state=${validState}tampered`,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid OAuth state.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a session on callback, exposes the session api, and clears it on logout', async () => {
    const app = createWorkerApp();
    const jar = createCookieJar();
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://github.local/login/oauth/access_token') {
        return Response.json({
          access_token: 'access-token',
          token_type: 'bearer',
          scope: 'repo read:user',
        });
      }

      if (url === 'https://api.github.local/user') {
        return Response.json({
          login: 'octocat',
          name: 'The Octocat',
          avatar_url: 'https://avatars.example/octocat.png',
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const startResponse = await sendRequest(app, jar, '/api/auth/github/start');
    const startUrl = new URL(startResponse.headers.get('location') || 'https://invalid.local');
    const state = startUrl.searchParams.get('state');

    expect(state).toBeTruthy();

    const callbackResponse = await sendRequest(
      app,
      jar,
      `/api/auth/github/callback?code=test-code&state=${state}`,
    );

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.get('location')).toBe('https://cms.local/app');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const sessionResponse = await sendRequest(app, jar, '/api/session');

    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual({
      authenticated: true,
      viewer: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.example/octocat.png',
      },
    });

    const logoutResponse = await sendRequest(app, jar, '/api/auth/logout', {
      method: 'POST',
    });

    expect(logoutResponse.status).toBe(204);
    expect(jar).toEqual({});

    const anonymousSessionResponse = await sendRequest(app, jar, '/api/session');

    await expect(anonymousSessionResponse.json()).resolves.toEqual({
      authenticated: false,
      viewer: null,
    });
  });
});

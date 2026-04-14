import { describe, expect, it, vi } from 'vitest';
import { createWorkerApp, type WorkerApp, type WorkerEnv } from '../../../worker/app';
import { createSessionCookie } from '../../../worker/session/cookies';

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

function applyCookieString(jar: Record<string, string>, setCookie: string): void {
  const [pair, ...attributes] = setCookie.split(';');
  const separatorIndex = pair.indexOf('=');

  if (separatorIndex === -1) {
    return;
  }

  const name = pair.slice(0, separatorIndex).trim();
  const value = pair.slice(separatorIndex + 1).trim();
  const shouldDelete = attributes.some((attribute) => /max-age=0/i.test(attribute));

  if (shouldDelete || value === '') {
    delete jar[name];
    return;
  }

  jar[name] = value;
}

function applySetCookies(jar: Record<string, string>, response: Response): void {
  for (const setCookie of getSetCookies(response)) {
    applyCookieString(jar, setCookie);
  }
}

function serializeCookieJar(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function createAuthenticatedJar(env: WorkerEnv): Promise<Record<string, string>> {
  const jar: Record<string, string> = {};
  const sessionCookie = await createSessionCookie(
    {
      accessToken: 'gho_test_access_token',
      viewer: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.example/octocat.png',
      },
    },
    env,
  );

  applyCookieString(jar, sessionCookie);

  return jar;
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

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const request = new Request(`https://cms.local${path}`, {
    ...init,
    headers,
  });
  const response = await app.fetch(request, createEnv(envOverrides), createExecutionContext());

  applySetCookies(jar, response);

  return response;
}

function toBase64Content(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function createPublishRequest(overrides: Record<string, unknown> = {}) {
  return {
    repo: {
      owner: 'octocat',
      name: 'edu-publish-main',
    },
    baseBranch: 'main',
    targetBranch: 'main',
    baseHeadSha: 'head-sha-main',
    commitMessage: 'Publish updated notices',
    changes: [
      {
        path: 'content/card/demo/notice-1.md',
        operation: 'upsert',
        encoding: 'utf-8',
        content: `---
id: notice-1
school_slug: demo
title: Updated notice title
published: 2026-04-14T09:00:00+08:00
category: 通知公告
source:
  channel: Demo Source
---
Updated body.
`,
      },
    ],
    ...overrides,
  };
}

function createPublishReadHandlers(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockImplementation(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method || 'GET').toUpperCase();

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
      return Response.json({ object: { sha: 'head-sha-main' } });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/head-sha-main') {
      return Response.json({ tree: { sha: 'tree-sha-main' } });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
      return Response.json({
        tree: [
          { path: 'content/card/demo/notice-1.md', type: 'blob', sha: 'blob-card', size: 128 },
          { path: 'config/site.yaml', type: 'blob', sha: 'blob-site', size: 64 },
          { path: 'config/widgets.yaml', type: 'blob', sha: 'blob-widgets', size: 64 },
          { path: 'config/subscriptions.yaml', type: 'blob', sha: 'blob-subscriptions', size: 64 },
        ],
      });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-card') {
      return Response.json({
        encoding: 'base64',
        content: toBase64Content(`---
id: notice-1
school_slug: demo
title: Original title
published: 2026-04-14T09:00:00+08:00
category: 通知公告
source:
  channel: Demo Source
---
Original body.
`),
      });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-site') {
      return Response.json({ encoding: 'base64', content: toBase64Content('site_name: Demo Site\n') });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-widgets') {
      return Response.json({ encoding: 'base64', content: toBase64Content('modules:\n  dashboard: true\n') });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-subscriptions') {
      return Response.json({ encoding: 'base64', content: toBase64Content('schools:\n  - slug: demo\n    name: Demo School\n    subscriptions:\n      - title: Demo Source\n') });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs' && method === 'POST') {
      return Response.json({ sha: 'new-blob-sha' });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees' && method === 'POST') {
      return Response.json({ sha: 'new-tree-sha' });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits' && method === 'POST') {
      return Response.json({ sha: 'new-commit-sha' });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/refs/heads/main' && method === 'PATCH') {
      return Response.json({ object: { sha: 'new-commit-sha' } });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/release-preview') {
      return Response.json({ message: 'Not Found' }, { status: 404 });
    }

    if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/refs' && method === 'POST') {
      return Response.json({ object: { sha: 'new-commit-sha' } });
    }

    return Response.json({ error: `unexpected request: ${method} ${url}` }, { status: 500 });
  });
}

describe('publish Worker route', () => {
  it('rejects unsupported publish paths before any GitHub write occurs', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/publish', {
      method: 'POST',
      body: JSON.stringify(createPublishRequest({
        changes: [
          {
            path: 'src/App.tsx',
            operation: 'upsert',
            encoding: 'utf-8',
            content: 'bad',
          },
        ],
      })),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unsupported publish path: src/App.tsx',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects publish when the remote target branch head moved since workspace load', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({ object: { sha: 'remote-head-sha' } });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/publish', {
      method: 'POST',
      body: JSON.stringify(createPublishRequest()),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Branch head moved. Reload the workspace before publishing.',
      remoteHeadSha: 'remote-head-sha',
      targetBranch: 'main',
    });
  });

  it('publishes atomically to an existing branch using Git database APIs', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn();

    createPublishReadHandlers(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/publish', {
      method: 'POST',
      body: JSON.stringify(createPublishRequest()),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      commitSha: 'new-commit-sha',
      targetBranch: 'main',
      compareUrl: 'https://github.com/octocat/edu-publish-main/compare/head-sha-main...new-commit-sha',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.local/repos/octocat/edu-publish-main/git/blobs',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.local/repos/octocat/edu-publish-main/git/trees',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.local/repos/octocat/edu-publish-main/git/commits',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.local/repos/octocat/edu-publish-main/git/refs/heads/main',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('creates a new branch when the target branch does not already exist', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn();

    createPublishReadHandlers(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/publish', {
      method: 'POST',
      body: JSON.stringify(createPublishRequest({
        targetBranch: 'release-preview',
      })),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      commitSha: 'new-commit-sha',
      targetBranch: 'release-preview',
      commitUrl: 'https://github.com/octocat/edu-publish-main/commit/new-commit-sha',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.local/repos/octocat/edu-publish-main/git/refs',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

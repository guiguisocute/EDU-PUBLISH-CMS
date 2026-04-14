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

describe('repository and workspace Worker routes', () => {
  it('lists repositories and branches through reduced Worker payloads', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.startsWith('https://api.github.local/user/repos')) {
        return Response.json([
          {
            owner: { login: 'octocat' },
            name: 'edu-publish-older',
            full_name: 'octocat/edu-publish-older',
            default_branch: 'main',
            private: false,
            permissions: { admin: false, maintain: false, push: true, triage: false, pull: true },
            updated_at: '2026-04-13T00:00:00Z',
          },
          {
            owner: { login: 'octocat' },
            name: 'edu-publish-main',
            full_name: 'octocat/edu-publish-main',
            default_branch: 'main',
            private: true,
            permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
            updated_at: '2026-04-14T12:00:00Z',
          },
        ]);
      }

      if (url.startsWith('https://api.github.local/repos/octocat/edu-publish-main/branches')) {
        return Response.json([
          {
            name: 'main',
            commit: { sha: 'head-sha-main' },
          },
          {
            name: 'cms/draft-notices',
            commit: { sha: 'head-sha-draft' },
          },
        ]);
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const reposResponse = await sendRequest(app, jar, '/api/repos');

    expect(reposResponse.status).toBe(200);
    await expect(reposResponse.json()).resolves.toEqual({
      repos: [
        {
          owner: 'octocat',
          name: 'edu-publish-main',
          fullName: 'octocat/edu-publish-main',
          defaultBranch: 'main',
          private: true,
          permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
          updatedAt: '2026-04-14T12:00:00Z',
        },
        {
          owner: 'octocat',
          name: 'edu-publish-older',
          fullName: 'octocat/edu-publish-older',
          defaultBranch: 'main',
          private: false,
          permissions: { admin: false, maintain: false, push: true, triage: false, pull: true },
          updatedAt: '2026-04-13T00:00:00Z',
        },
      ],
    });

    const branchesResponse = await sendRequest(app, jar, '/api/repos/octocat/edu-publish-main/branches');

    expect(branchesResponse.status).toBe(200);
    await expect(branchesResponse.json()).resolves.toEqual({
      branches: [
        { name: 'main', headSha: 'head-sha-main' },
        { name: 'cms/draft-notices', headSha: 'head-sha-draft' },
      ],
    });
  });

  it('loads a compatible repository workspace and preserves base head sha plus parsed card data', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({
          object: {
            sha: 'commit-sha-main',
          },
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/commit-sha-main') {
        return Response.json({
          tree: {
            sha: 'tree-sha-main',
          },
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          tree: [
            { path: 'content/card/demo', type: 'tree', sha: 'tree-card-demo' },
            { path: 'content/card/demo/notice.md', type: 'blob', sha: 'blob-card', size: 128 },
            { path: 'content/attachments/demo.pdf', type: 'blob', sha: 'blob-attachment', size: 1024 },
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
title: Demo notice
published: 2026-04-14T09:00:00+08:00
category: 通知公告
---
正文内容。
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

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/workspace/load', {
      method: 'POST',
      body: JSON.stringify({
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
        branch: 'main',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      repo: {
        owner: 'octocat',
        name: 'edu-publish-main',
      },
      branch: 'main',
      baseHeadSha: 'commit-sha-main',
      readonlyConfig: {
        siteYaml: 'site_name: Demo Site\n',
        widgetsYaml: 'modules:\n  dashboard: true\n',
      },
      attachments: [
        {
          path: 'content/attachments/demo.pdf',
          sha: 'blob-attachment',
          size: 1024,
        },
      ],
      cards: [
        {
          id: 'notice-1',
          path: 'content/card/demo/notice.md',
          sha: 'blob-card',
          dirty: false,
          data: {
            id: 'notice-1',
            title: 'Demo notice',
          },
        },
      ],
    });
  });

  it('rejects incompatible repositories before returning a draft workspace', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/incompatible-repo/git/ref/heads/main') {
        return Response.json({ object: { sha: 'commit-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/incompatible-repo/git/commits/commit-sha-main') {
        return Response.json({ tree: { sha: 'tree-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/incompatible-repo/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          tree: [
            { path: 'content/card/demo/notice.md', type: 'blob', sha: 'blob-card', size: 128 },
            { path: 'config/site.yaml', type: 'blob', sha: 'blob-site', size: 64 },
            { path: 'config/subscriptions.yaml', type: 'blob', sha: 'blob-subscriptions', size: 64 },
          ],
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/workspace/load', {
      method: 'POST',
      body: JSON.stringify({
        repo: {
          owner: 'octocat',
          name: 'incompatible-repo',
        },
        branch: 'main',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      compatible: false,
      issues: [
        {
          path: 'config/widgets.yaml',
          message: 'Missing required file',
        },
      ],
    });
  });
});

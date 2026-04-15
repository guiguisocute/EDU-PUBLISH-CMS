import { describe, expect, it, vi } from 'vitest';
import { createWorkerApp, type WorkerApp, type WorkerEnv } from '../../../worker/app';
import { createSessionCookie } from '../../../worker/session/cookies';

const ONE_BY_ONE_JPG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8PDw8PDw8PDw8PDw8PDw8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDQ0NDg0NDisZFRkrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrK//AABEIAAEAAgMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6AAAAP/EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQIBAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8Af//Z';

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
            { path: 'content/card/demo/poster.png', type: 'blob', sha: 'blob-poster', size: 2048 },
            { path: 'content/attachments/demo.pdf', type: 'blob', sha: 'blob-attachment', size: 1024 },
            { path: 'config/site.yaml', type: 'blob', sha: 'blob-site', size: 64 },
            { path: 'config/widgets.yaml', type: 'blob', sha: 'blob-widgets', size: 64 },
            { path: 'config/subscriptions.yaml', type: 'blob', sha: 'blob-subscriptions', size: 64 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
            { path: 'config', type: 'tree', sha: 'tree-config' },
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

  it('backfills root and public static images when the recursive GitHub tree is truncated', async () => {
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
          truncated: true,
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
            { path: 'content/card', type: 'tree', sha: 'tree-content-card' },
            { path: 'content/card/demo', type: 'tree', sha: 'tree-card-demo' },
            { path: 'content/card/demo/notice.md', type: 'blob', sha: 'blob-card', size: 128 },
            { path: 'config', type: 'tree', sha: 'tree-config' },
            { path: 'config/site.yaml', type: 'blob', sha: 'blob-site', size: 64 },
            { path: 'config/widgets.yaml', type: 'blob', sha: 'blob-widgets', size: 64 },
            { path: 'config/subscriptions.yaml', type: 'blob', sha: 'blob-subscriptions', size: 64 },
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
            { path: 'config', type: 'tree', sha: 'tree-config' },
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
            { path: 'favicon.ico', type: 'blob', sha: 'blob-favicon', size: 32 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-img?recursive=1') {
        return Response.json({
          tree: [
            { path: 'ai', type: 'tree', sha: 'tree-img-ai' },
            { path: 'ai/photo.jpg', type: 'blob', sha: 'blob-root-image', size: 256 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-public') {
        return Response.json({
          tree: [
            { path: 'img', type: 'tree', sha: 'tree-public-img' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-public-img?recursive=1') {
        return Response.json({
          tree: [
            { path: 'logo.svg', type: 'blob', sha: 'blob-public-logo', size: 128 },
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
      attachments: [
        {
          path: 'favicon.ico',
          sha: 'blob-favicon',
          size: 32,
        },
        {
          path: 'img/ai/photo.jpg',
          sha: 'blob-root-image',
          size: 256,
        },
        {
          path: 'public/img/logo.svg',
          sha: 'blob-public-logo',
          size: 128,
        },
      ],
    });
  });

  it('backfills missing root and public static images even when the recursive tree is not marked truncated', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({ object: { sha: 'commit-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/commit-sha-main') {
        return Response.json({ tree: { sha: 'tree-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          truncated: false,
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
            { path: 'content/card', type: 'tree', sha: 'tree-content-card' },
            { path: 'content/card/demo', type: 'tree', sha: 'tree-card-demo' },
            { path: 'content/card/demo/notice.md', type: 'blob', sha: 'blob-card', size: 128 },
            { path: 'config', type: 'tree', sha: 'tree-config' },
            { path: 'config/site.yaml', type: 'blob', sha: 'blob-site', size: 64 },
            { path: 'config/widgets.yaml', type: 'blob', sha: 'blob-widgets', size: 64 },
            { path: 'config/subscriptions.yaml', type: 'blob', sha: 'blob-subscriptions', size: 64 },
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
            { path: 'config', type: 'tree', sha: 'tree-config' },
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-img?recursive=1') {
        return Response.json({
          tree: [
            { path: 'ai', type: 'tree', sha: 'tree-img-ai' },
            { path: 'ai/photo_20260402_002.jpg', type: 'blob', sha: 'blob-root-image', size: 256 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-public') {
        return Response.json({
          tree: [
            { path: 'img', type: 'tree', sha: 'tree-public-img' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-public-img?recursive=1') {
        return Response.json({
          tree: [
            { path: 'logo.svg', type: 'blob', sha: 'blob-public-logo', size: 128 },
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
      attachments: [
        {
          path: 'img/ai/photo_20260402_002.jpg',
          sha: 'blob-root-image',
          size: 256,
        },
        {
          path: 'public/img/logo.svg',
          sha: 'blob-public-logo',
          size: 128,
        },
      ],
    });
  });

  it('loads attachment and image blobs in asset batches for local workspace hydration', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-attachment') {
        return Response.json({
          encoding: 'base64',
          content: toBase64Content('attachment binary'),
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-icon') {
        return Response.json({
          encoding: 'base64',
          content: toBase64Content('<svg viewBox="0 0 1 1"></svg>'),
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(app, jar, '/api/workspace/assets', {
      method: 'POST',
      body: JSON.stringify({
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
        assets: [
          {
            path: 'content/attachments/demo.pdf',
            sha: 'blob-attachment',
            size: 1024,
          },
          {
            path: 'public/img/unit-icon-student-affairs.svg',
            sha: 'blob-icon',
            size: 128,
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      assets: [
        {
          path: 'content/attachments/demo.pdf',
          sha: 'blob-attachment',
          size: 1024,
          encoding: 'base64',
          content: toBase64Content('attachment binary'),
        },
        {
          path: 'public/img/unit-icon-student-affairs.svg',
          sha: 'blob-icon',
          size: 128,
          encoding: 'base64',
          content: toBase64Content('<svg viewBox="0 0 1 1"></svg>'),
        },
      ],
    });
  });

  it('serves workspace blobs with a mime type inferred from path', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-image') {
        return Response.json({
          encoding: 'base64',
          content: toBase64Content('<svg viewBox="0 0 1 1"></svg>'),
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(
      app,
      jar,
      '/api/workspace/blob?owner=octocat&name=edu-publish-main&sha=blob-image&path=content/card/demo/poster.svg',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="poster.svg"; filename*=UTF-8\'\'poster.svg');
  });

  it('resolves workspace blobs by branch candidate paths when asset metadata is missing', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({ object: { sha: 'commit-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/commit-sha-main') {
        return Response.json({ tree: { sha: 'tree-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          truncated: true,
          tree: [
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-img?recursive=1') {
        return Response.json({
          tree: [
            { path: 'ai', type: 'tree', sha: 'tree-img-ai' },
            { path: 'ai/photo.jpg', type: 'blob', sha: 'blob-photo', size: 256 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-public') {
        return Response.json({ tree: [] });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-photo') {
        return Response.json({
          encoding: 'base64',
          content: ONE_BY_ONE_JPG_BASE64,
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(
      app,
      jar,
      '/api/workspace/blob?owner=octocat&name=edu-publish-main&branch=main&candidate=img%2Fai%2Fphoto.jpg&candidate=public%2Fimg%2Fai%2Fphoto.jpg&download=1',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="photo.jpg"; filename*=UTF-8\'\'photo.jpg');
  });

  it('resolves workspace blob candidates for root images even when the recursive tree omits descendants without truncation', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({ object: { sha: 'commit-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/commit-sha-main') {
        return Response.json({ tree: { sha: 'tree-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          truncated: false,
          tree: [
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'img', type: 'tree', sha: 'tree-img' },
            { path: 'public', type: 'tree', sha: 'tree-public' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-img?recursive=1') {
        return Response.json({
          tree: [
            { path: 'ai', type: 'tree', sha: 'tree-img-ai' },
            { path: 'ai/photo_20260402_002.jpg', type: 'blob', sha: 'blob-photo', size: 256 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-public') {
        return Response.json({ tree: [] });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-photo') {
        return Response.json({
          encoding: 'base64',
          content: ONE_BY_ONE_JPG_BASE64,
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(
      app,
      jar,
      '/api/workspace/blob?owner=octocat&name=edu-publish-main&branch=main&candidate=img%2Fai%2Fphoto_20260402_002.jpg&candidate=public%2Fimg%2Fai%2Fphoto_20260402_002.jpg&download=1',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="photo_20260402_002.jpg"; filename*=UTF-8\'\'photo_20260402_002.jpg');
  });

  it('resolves workspace blob candidates for img urls mirrored into attachment subpaths', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({ object: { sha: 'commit-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/commit-sha-main') {
        return Response.json({ tree: { sha: 'tree-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          truncated: false,
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-content') {
        return Response.json({
          tree: [
            { path: 'attachments', type: 'tree', sha: 'tree-attachments' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-attachments') {
        return Response.json({
          tree: [
            { path: 'ai', type: 'tree', sha: 'tree-attachments-ai' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-attachments-ai') {
        return Response.json({
          tree: [
            { path: 'photo_20260407_001.jpg', type: 'blob', sha: 'blob-photo', size: 256 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-photo') {
        return Response.json({
          encoding: 'base64',
          content: ONE_BY_ONE_JPG_BASE64,
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(
      app,
      jar,
      '/api/workspace/blob?owner=octocat&name=edu-publish-main&branch=main&candidate=img%2Fai%2Fphoto_20260407_001.jpg&candidate=public%2Fimg%2Fai%2Fphoto_20260407_001.jpg&candidate=content%2Fattachments%2Fai%2Fphoto_20260407_001.jpg&candidate=content%2Fattachments%2Fimg%2Fai%2Fphoto_20260407_001.jpg&candidate=content%2Fattachments%2Fphoto_20260407_001.jpg&download=1',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="photo_20260407_001.jpg"; filename*=UTF-8\'\'photo_20260407_001.jpg');
  });

  it('expands legacy blob candidates on the Worker when mirrored attachment subpaths were not sent by the client', async () => {
    const app = createWorkerApp();
    const env = createEnv();
    const jar = await createAuthenticatedJar(env);
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/ref/heads/main') {
        return Response.json({ object: { sha: 'commit-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/commits/commit-sha-main') {
        return Response.json({ tree: { sha: 'tree-sha-main' } });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main?recursive=1') {
        return Response.json({
          truncated: false,
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-content') {
        return Response.json({
          tree: [
            { path: 'attachments', type: 'tree', sha: 'tree-attachments' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-attachments') {
        return Response.json({
          tree: [
            { path: 'ai', type: 'tree', sha: 'tree-attachments-ai' },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/trees/tree-attachments-ai') {
        return Response.json({
          tree: [
            { path: 'photo_20260407_001.jpg', type: 'blob', sha: 'blob-photo', size: 256 },
          ],
        });
      }

      if (url === 'https://api.github.local/repos/octocat/edu-publish-main/git/blobs/blob-photo') {
        return Response.json({
          encoding: 'base64',
          content: ONE_BY_ONE_JPG_BASE64,
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await sendRequest(
      app,
      jar,
      '/api/workspace/blob?owner=octocat&name=edu-publish-main&branch=main&candidate=img%2Fai%2Fphoto_20260407_001.jpg&candidate=public%2Fimg%2Fai%2Fphoto_20260407_001.jpg&candidate=content%2Fattachments%2Fphoto_20260407_001.jpg&download=1',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="photo_20260407_001.jpg"; filename*=UTF-8\'\'photo_20260407_001.jpg');
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

      if (url === 'https://api.github.local/repos/octocat/incompatible-repo/git/trees/tree-sha-main') {
        return Response.json({
          tree: [
            { path: 'content', type: 'tree', sha: 'tree-content' },
            { path: 'config', type: 'tree', sha: 'tree-config' },
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

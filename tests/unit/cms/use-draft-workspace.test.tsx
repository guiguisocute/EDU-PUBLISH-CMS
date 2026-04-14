import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseCardDocument } from '../../../lib/content/card-document';
import { useDraftWorkspace } from '../../../hooks/use-draft-workspace';

function createWorkspaceResponse(branch = 'main') {
  return {
    repo: {
      owner: 'octocat',
      name: 'edu-publish-main',
    },
    branch,
    baseHeadSha: `head-sha-${branch.replace(/[^a-z0-9]+/gi, '-')}`,
    readonlyConfig: {
      siteYaml: 'site_name: Demo Site\n',
      widgetsYaml: 'modules:\n  dashboard: true\n',
      subscriptionsYaml: `schools:\n  - slug: demo\n    name: Demo School\n    subscriptions:\n      - title: Demo Source\n`,
    },
    attachments: [
      {
        path: 'content/attachments/demo.pdf',
        sha: 'blob-attachment',
        size: 1024,
      },
    ],
    cards: [
      parseCardDocument(
        `---
id: notice-1
school_slug: demo
title: First notice
published: 2026-04-14T09:00:00+08:00
category: 通知公告
source:
  channel: Demo Source
---
第一条正文。
`,
        {
          path: 'content/card/demo/notice-1.md',
          sha: 'sha-1',
          dirty: false,
        },
      ),
      parseCardDocument(
        `---
id: notice-2
school_slug: demo
title: Second notice
published: 2026-04-14T10:00:00+08:00
category: 通知公告
source:
  channel: Demo Source
---
第二条正文。
`,
        {
          path: 'content/card/demo/notice-2.md',
          sha: 'sha-2',
          dirty: false,
        },
      ),
    ],
  };
}

describe('useDraftWorkspace', () => {
  it('loads repos and workspace, selects cards, and tracks dirty state for card edits', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/repos') {
        return Response.json({
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
          ],
        });
      }

      if (url === '/api/repos/octocat/edu-publish-main/branches') {
        return Response.json({
          branches: [
            { name: 'main', headSha: 'head-sha-main' },
            { name: 'cms-draft', headSha: 'head-sha-cms-draft' },
          ],
        });
      }

      if (url === '/api/workspace/load') {
        const body = JSON.parse(String(init?.body || '{}')) as { branch: string };
        return Response.json(createWorkspaceResponse(body.branch));
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDraftWorkspace());

    await act(async () => {
      await result.current.loadRepos();
    });

    expect(result.current.repos.map((repo) => repo.fullName)).toEqual([
      'octocat/edu-publish-main',
    ]);

    await act(async () => {
      await result.current.selectRepo('octocat/edu-publish-main');
    });

    expect(result.current.selectedRepo?.fullName).toBe('octocat/edu-publish-main');
    expect(result.current.branches.map((branch) => branch.name)).toEqual([
      'main',
      'cms-draft',
    ]);
    expect(result.current.selectedBranch).toBe('main');

    await act(async () => {
      await result.current.loadWorkspace();
    });

    expect(result.current.workspace?.baseHeadSha).toBe('head-sha-main');
    expect(result.current.selectedCard?.id).toBe('notice-1');
    expect(result.current.selectedCard?.data.title).toBe('First notice');
    expect(result.current.dirtyCount).toBe(0);

    act(() => {
      result.current.updateField('title', 'Updated title');
    });

    expect(result.current.selectedCard?.dirty).toBe(true);
    expect(result.current.selectedCard?.data.title).toBe('Updated title');
    expect(result.current.workspace?.cards[0]?.raw).toContain('Updated title');
    expect(result.current.dirtyCount).toBe(1);

    act(() => {
      result.current.selectCard('notice-2');
    });

    expect(result.current.selectedCard?.id).toBe('notice-2');

    act(() => {
      result.current.updateBody('替换后的正文。\n');
    });

    expect(result.current.selectedCard?.bodyMarkdown).toBe('替换后的正文。\n');
    expect(result.current.selectedCard?.dirty).toBe(true);
    expect(result.current.dirtyCount).toBe(2);
  });

  it('clears the loaded workspace when the branch selection changes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/repos') {
        return Response.json({
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
          ],
        });
      }

      if (url === '/api/repos/octocat/edu-publish-main/branches') {
        return Response.json({
          branches: [
            { name: 'main', headSha: 'head-sha-main' },
            { name: 'cms-draft', headSha: 'head-sha-cms-draft' },
          ],
        });
      }

      if (url === '/api/workspace/load') {
        const body = JSON.parse(String(init?.body || '{}')) as { branch: string };
        return Response.json(createWorkspaceResponse(body.branch));
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDraftWorkspace());

    await act(async () => {
      await result.current.loadRepos();
      await result.current.selectRepo('octocat/edu-publish-main');
      await result.current.loadWorkspace();
    });

    expect(result.current.workspace?.branch).toBe('main');
    expect(result.current.selectedCardId).toBe('notice-1');

    act(() => {
      result.current.selectBranch('cms-draft');
    });

    expect(result.current.selectedBranch).toBe('cms-draft');
    expect(result.current.workspace).toBeNull();
    expect(result.current.selectedCardId).toBeNull();
    expect(result.current.dirtyCount).toBe(0);
  });

  it('supports undo, redo, and discard-all for local draft edits', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/repos') {
        return Response.json({
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
          ],
        });
      }

      if (url === '/api/repos/octocat/edu-publish-main/branches') {
        return Response.json({
          branches: [{ name: 'main', headSha: 'head-sha-main' }],
        });
      }

      if (url === '/api/workspace/load') {
        const body = JSON.parse(String(init?.body || '{}')) as { branch: string };
        return Response.json(createWorkspaceResponse(body.branch));
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDraftWorkspace());

    await act(async () => {
      await result.current.loadRepos();
      await result.current.selectRepo('octocat/edu-publish-main');
      await result.current.loadWorkspace();
    });

    act(() => {
      result.current.updateField('title', 'First undo target');
    });

    act(() => {
      result.current.updateBody('Updated body for history.\n');
    });

    expect(result.current.selectedCard?.data.title).toBe('First undo target');
    expect(result.current.selectedCard?.bodyMarkdown).toBe('Updated body for history.\n');
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.selectedCard?.bodyMarkdown).toBe('第一条正文。\n');
    expect(result.current.selectedCard?.data.title).toBe('First undo target');
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.selectedCard?.data.title).toBe('First notice');

    act(() => {
      result.current.redo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.selectedCard?.data.title).toBe('First undo target');
    expect(result.current.selectedCard?.bodyMarkdown).toBe('Updated body for history.\n');

    act(() => {
      result.current.discardAllChanges();
    });

    expect(result.current.selectedCard?.data.title).toBe('First notice');
    expect(result.current.selectedCard?.bodyMarkdown).toBe('第一条正文。\n');
    expect(result.current.dirtyCount).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('adds uploaded attachment files into the draft workspace and selected card', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/repos') {
        return Response.json({
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
          ],
        });
      }

      if (url === '/api/repos/octocat/edu-publish-main/branches') {
        return Response.json({
          branches: [{ name: 'main', headSha: 'head-sha-main' }],
        });
      }

      if (url === '/api/workspace/load') {
        const body = JSON.parse(String(init?.body || '{}')) as { branch: string };
        return Response.json(createWorkspaceResponse(body.branch));
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDraftWorkspace());

    await act(async () => {
      await result.current.loadRepos();
      await result.current.selectRepo('octocat/edu-publish-main');
      await result.current.loadWorkspace();
    });

    const file = new File(['hello attachment'], 'apply.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await act(async () => {
      await result.current.uploadAttachmentFiles([file]);
    });

    expect(result.current.selectedCard?.data.attachments).toEqual([
      {
        name: 'apply.docx',
        url: './attachments/apply.docx',
        type: 'docx',
      },
    ]);
    expect(result.current.workspace?.attachments.find((entry) => entry.path === 'content/attachments/apply.docx')).toMatchObject({
      path: 'content/attachments/apply.docx',
      dirty: true,
      deleted: false,
      encoding: 'base64',
    });
  });
});

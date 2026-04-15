import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CmsWorkspaceShell } from '../../../components/cms/CmsWorkspaceShell';

const mockedUseDraftWorkspace = vi.fn();

vi.mock('../../../hooks/use-draft-workspace', () => ({
  useDraftWorkspace: () => mockedUseDraftWorkspace(),
}));

vi.mock('../../../components/cms/CardEditorPanel', () => ({
  CardEditorPanel: () => <div>CardEditorPanel</div>,
}));

vi.mock('../../../components/cms/RepoSelector', () => ({
  RepoSelector: () => <div>RepoSelector</div>,
}));

vi.mock('../../../components/cms/DevDiagnostics', () => ({
  DevDiagnostics: () => null,
}));

vi.mock('../../../components/cms/PublishDialog', () => ({
  PublishDialog: () => null,
}));

vi.mock('../../../components/cms/LiveInlinePreview', () => ({
  LiveInlinePreview: ({ article }: { article: { title?: string } | null }) => (
    <div>{article ? `LiveInlinePreview:${article.title}` : 'LiveInlinePreview:empty'}</div>
  ),
}));

function createWorkspaceController(overrides: Record<string, unknown> = {}) {
  return {
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
    branches: [{ name: 'main', headSha: 'head-sha-main' }],
    selectedRepo: {
      owner: 'octocat',
      name: 'edu-publish-main',
      fullName: 'octocat/edu-publish-main',
      defaultBranch: 'main',
      private: true,
      permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
      updatedAt: '2026-04-14T12:00:00Z',
    },
    selectedBranch: 'main',
    workspace: {
      repo: { owner: 'octocat', name: 'edu-publish-main' },
      branch: 'main',
      baseHeadSha: 'head-sha-main',
      cards: [
        {
          id: 'notice-1',
          path: 'content/card/demo/notice-1.md',
          data: { title: 'First notice', school_slug: 'demo', source: { channel: 'Demo Source' } },
          bodyMarkdown: '正文',
          dirty: false,
        },
      ],
      attachments: [],
    },
    selectedCardId: 'notice-1',
    selectedCard: {
      id: 'notice-1',
      path: 'content/card/demo/notice-1.md',
      data: { title: 'First notice', school_slug: 'demo', source: { channel: 'Demo Source' } },
      bodyMarkdown: '正文',
      dirty: false,
    },
    dirtyCount: 0,
    compileResult: {
      preview: {
        schoolNameBySlug: { demo: 'Demo School' },
        content: {
          notices: [
            {
              guid: 'notice-1',
              title: 'First notice',
            },
          ],
        },
      },
      issues: [],
    },
    validationIssues: [],
    diagnostics: {
      selectedCardId: 'notice-1',
      dirtyCount: 0,
      baseHeadSha: 'head-sha-main',
      compileDurationMs: 1,
      validationIssueCount: 0,
    },
    workspaceLoadProgress: null,
    isLoadingRepos: false,
    isLoadingBranches: false,
    isLoadingWorkspace: false,
    error: null,
    changedFiles: [],
    targetBranch: 'main',
    commitMessage: '',
    isPublishing: false,
    publishError: null,
    publishResult: null,
    canUndo: false,
    canRedo: false,
    loadRepos: vi.fn(),
    selectRepo: vi.fn(),
    selectBranch: vi.fn(),
    loadWorkspace: vi.fn(),
    continueWorkspaceAssetSync: vi.fn(),
    skipWorkspaceAssetSync: vi.fn(),
    selectCard: vi.fn(),
    updateField: vi.fn(),
    updateBody: vi.fn(),
    uploadAttachmentFiles: vi.fn(),
    discardDraft: vi.fn(),
    addCard: vi.fn(),
    deleteCard: vi.fn(),
    discardAllChanges: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    setTargetBranch: vi.fn(),
    setCommitMessage: vi.fn(),
    publishChanges: vi.fn(),
    ...overrides,
  };
}

describe('CmsWorkspaceShell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockedUseDraftWorkspace.mockReset();
  });

  it('waits for the asset sync decision before rendering the inline preview', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      authenticated: true,
      viewer: { login: 'octocat', name: 'The Octocat' },
    })));
    mockedUseDraftWorkspace.mockReturnValue(createWorkspaceController({
      workspace: null,
      selectedCardId: null,
      selectedCard: null,
      compileResult: {
        preview: null,
        issues: [],
      },
      workspaceLoadProgress: {
        phase: 'confirm',
        message: '卡片元数据已同步，是否继续同步图片与附件资源？',
        loadedAssets: 0,
        totalAssets: 3,
        loadedBytes: 0,
        totalBytes: 3072,
        percent: 14,
      },
    }));

    render(<CmsWorkspaceShell />);

    expect(await screen.findByText('等待你决定是否同步图片与附件后，再渲染即时预览。')).toBeInTheDocument();
    expect(screen.getAllByText('卡片元数据已读取，请先选择是否继续同步图片与附件。').length).toBeGreaterThan(0);
    expect(screen.queryByText('LiveInlinePreview:First notice')).not.toBeInTheDocument();
    expect(screen.queryByText('CardEditorPanel')).not.toBeInTheDocument();
  });

  it('renders the inline preview after the workspace load decision is resolved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      authenticated: true,
      viewer: { login: 'octocat', name: 'The Octocat' },
    })));
    mockedUseDraftWorkspace.mockReturnValue(createWorkspaceController());

    render(<CmsWorkspaceShell />);

    expect(await screen.findByText('LiveInlinePreview:First notice')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepoSelector } from '../../../components/cms/RepoSelector';

describe('RepoSelector', () => {
  it('renders repo and branch options and forwards selection callbacks', () => {
    const onRepoChange = vi.fn();
    const onBranchChange = vi.fn();
    const onLoadWorkspace = vi.fn();
    const onContinueAssetSync = vi.fn();
    const onSkipAssetSync = vi.fn();

    render(
      <RepoSelector
        repos={[
          {
            owner: 'octocat',
            name: 'edu-publish-main',
            fullName: 'octocat/edu-publish-main',
            defaultBranch: 'main',
            private: true,
            permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
            updatedAt: '2026-04-14T12:00:00Z',
          },
        ]}
        branches={[
          { name: 'main', headSha: 'head-sha-main' },
          { name: 'cms-draft', headSha: 'head-sha-cms-draft' },
        ]}
        selectedRepoFullName="octocat/edu-publish-main"
        selectedBranch="main"
        isLoadingRepos={false}
        isLoadingBranches={false}
        isLoadingWorkspace={false}
        workspaceLoadProgress={null}
        onContinueAssetSync={onContinueAssetSync}
        onSkipAssetSync={onSkipAssetSync}
        onRepoChange={onRepoChange}
        onBranchChange={onBranchChange}
        onLoadWorkspace={onLoadWorkspace}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Repository Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'octocat/edu-publish-main' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'cms-draft' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Repository'), {
      target: { value: 'octocat/edu-publish-main' },
    });
    fireEvent.change(screen.getByLabelText('Branch'), {
      target: { value: 'cms-draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load Workspace' }));

    expect(onRepoChange).toHaveBeenCalledWith('octocat/edu-publish-main');
    expect(onBranchChange).toHaveBeenCalledWith('cms-draft');
    expect(onLoadWorkspace).toHaveBeenCalledTimes(1);
  });

  it('disables branch selection and workspace loading until a repository is selected', () => {
    render(
      <RepoSelector
        repos={[]}
        branches={[]}
        selectedRepoFullName=""
        selectedBranch=""
        isLoadingRepos={false}
        isLoadingBranches={false}
        isLoadingWorkspace={false}
        workspaceLoadProgress={null}
        onContinueAssetSync={() => undefined}
        onSkipAssetSync={() => undefined}
        onRepoChange={() => undefined}
        onBranchChange={() => undefined}
        onLoadWorkspace={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Branch')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load Workspace' })).toBeDisabled();
  });

  it('shows inline asset sync actions inside the progress panel', () => {
    const onContinueAssetSync = vi.fn();
    const onSkipAssetSync = vi.fn();

    render(
      <RepoSelector
        repos={[]}
        branches={[]}
        selectedRepoFullName="octocat/edu-publish-main"
        selectedBranch="main"
        isLoadingRepos={false}
        isLoadingBranches={false}
        isLoadingWorkspace={false}
        workspaceLoadProgress={{
          phase: 'confirm',
          message: '卡片元数据已同步，是否继续同步图片与附件资源？',
          loadedAssets: 0,
          totalAssets: 3,
          loadedBytes: 0,
          totalBytes: 3072,
          percent: 14,
        }}
        onContinueAssetSync={onContinueAssetSync}
        onSkipAssetSync={onSkipAssetSync}
        onRepoChange={() => undefined}
        onBranchChange={() => undefined}
        onLoadWorkspace={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '继续同步资源' }));
    fireEvent.click(screen.getByRole('button', { name: '跳过，按旧逻辑继续' }));

    expect(onContinueAssetSync).toHaveBeenCalledTimes(1);
    expect(onSkipAssetSync).toHaveBeenCalledTimes(1);
  });
});

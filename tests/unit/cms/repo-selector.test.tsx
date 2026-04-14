import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepoSelector } from '../../../components/cms/RepoSelector';

describe('RepoSelector', () => {
  it('renders repo and branch options and forwards selection callbacks', () => {
    const onRepoChange = vi.fn();
    const onBranchChange = vi.fn();
    const onLoadWorkspace = vi.fn();

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
        onRepoChange={() => undefined}
        onBranchChange={() => undefined}
        onLoadWorkspace={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Branch')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load Workspace' })).toBeDisabled();
  });
});

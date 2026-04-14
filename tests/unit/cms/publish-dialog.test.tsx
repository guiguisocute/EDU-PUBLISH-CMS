import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishDialog } from '../../../components/cms/PublishDialog';
import type { ValidationIssue } from '../../../types/content';

describe('PublishDialog', () => {
  it('renders changed files, branch state, and blocks publish when validation issues exist', () => {
    const onTargetBranchChange = vi.fn();
    const onCommitMessageChange = vi.fn();
    const onPublish = vi.fn();

    render(
      <PublishDialog
        isOpen={true}
        changedFiles={['content/card/demo/notice-1.md', 'content/card/demo/notice-2.md']}
        baseBranch="main"
        targetBranch="main"
        baseHeadSha="head-sha-main"
        commitMessage="Publish updated notices"
        issues={[
          {
            severity: 'error',
            filePath: 'content/card/demo/notice-1.md',
            fieldPath: 'title',
            message: 'Title is required.',
          } satisfies ValidationIssue,
        ]}
        isPublishing={false}
        publishResult={null}
        publishError={null}
        onTargetBranchChange={onTargetBranchChange}
        onCommitMessageChange={onCommitMessageChange}
        onPublish={onPublish}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Review Publish' })).toBeInTheDocument();
    expect(screen.getByText('content/card/demo/notice-1.md')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Base Head SHA: head-sha-main')).toBeInTheDocument();
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Changes' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Target Branch'), {
      target: { value: 'release-preview' },
    });
    fireEvent.change(screen.getByLabelText('Commit Message'), {
      target: { value: 'Ship release preview' },
    });

    expect(onTargetBranchChange).toHaveBeenCalledWith('release-preview');
    expect(onCommitMessageChange).toHaveBeenCalledWith('Ship release preview');
  });

  it('allows publish when there are changed files and no blocking issues', () => {
    const onPublish = vi.fn();

    render(
      <PublishDialog
        isOpen={true}
        changedFiles={['content/card/demo/notice-1.md']}
        baseBranch="main"
        targetBranch="release-preview"
        baseHeadSha="head-sha-main"
        commitMessage="Publish updated notices"
        issues={[]}
        isPublishing={false}
        publishResult={null}
        publishError={null}
        onTargetBranchChange={() => undefined}
        onCommitMessageChange={() => undefined}
        onPublish={onPublish}
        onClose={() => undefined}
      />,
    );

    const publishButton = screen.getByRole('button', { name: 'Publish Changes' });

    expect(publishButton).toBeEnabled();

    fireEvent.click(publishButton);

    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('shows publish success metadata and conflict feedback', () => {
    render(
      <>
        <PublishDialog
          isOpen={true}
          changedFiles={['content/card/demo/notice-1.md']}
          baseBranch="main"
          targetBranch="release-preview"
          baseHeadSha="head-sha-main"
          commitMessage="Publish updated notices"
          issues={[]}
          isPublishing={false}
          publishResult={{
            commitSha: 'new-commit-sha',
            targetBranch: 'release-preview',
            compareUrl: 'https://github.com/octocat/edu-publish-main/compare/head-sha-main...new-commit-sha',
            publishedAt: '2026-04-14T10:00:00.000Z',
          }}
          publishError={null}
          onTargetBranchChange={() => undefined}
          onCommitMessageChange={() => undefined}
          onPublish={() => undefined}
          onClose={() => undefined}
        />
        <PublishDialog
          isOpen={true}
          changedFiles={['content/card/demo/notice-1.md']}
          baseBranch="main"
          targetBranch="main"
          baseHeadSha="head-sha-main"
          commitMessage="Publish updated notices"
          issues={[]}
          isPublishing={false}
          publishResult={null}
          publishError="Branch head moved. Reload the workspace before publishing."
          onTargetBranchChange={() => undefined}
          onCommitMessageChange={() => undefined}
          onPublish={() => undefined}
          onClose={() => undefined}
        />
      </>,
    );

    expect(screen.getByText('new-commit-sha')).toBeInTheDocument();
    expect(screen.getByText('release-preview')).toBeInTheDocument();
    expect(screen.getByText('Branch head moved. Reload the workspace before publishing.')).toBeInTheDocument();
  });
});

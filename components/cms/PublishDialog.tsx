import type { ValidationIssue } from '../../types/content';
import type { PublishResult } from '../../types/github';

export interface PublishDialogProps {
  isOpen: boolean;
  changedFiles: string[];
  baseBranch: string;
  targetBranch: string;
  baseHeadSha: string;
  commitMessage: string;
  issues: ValidationIssue[];
  isPublishing: boolean;
  publishResult: PublishResult | null;
  publishError: string | null;
  onTargetBranchChange: (branch: string) => void;
  onCommitMessageChange: (message: string) => void;
  onPublish: () => void;
  onClose: () => void;
}

export function PublishDialog({
  isOpen,
  changedFiles,
  baseBranch,
  targetBranch,
  baseHeadSha,
  commitMessage,
  issues,
  isPublishing,
  publishResult,
  publishError,
  onTargetBranchChange,
  onCommitMessageChange,
  onPublish,
  onClose,
}: PublishDialogProps) {
  if (!isOpen) {
    return null;
  }

  const hasBlockingIssues = issues.some((issue) => issue.severity === 'error');
  const canPublish = changedFiles.length > 0 && !hasBlockingIssues && !isPublishing;

  return (
    <section className="cms-publish-dialog" role="dialog" aria-modal="true" aria-label="Review publish dialog">
      <header>
        <h2>Review Publish</h2>
        <button type="button" aria-label="Close publish dialog" onClick={onClose}>
          Close
        </button>
      </header>

      <div>
        <p>Base Branch: {baseBranch}</p>
        <p>Base Head SHA: {baseHeadSha}</p>
      </div>

      <label>
        <span>Target Branch</span>
        <input
          aria-label="Target Branch"
          type="text"
          value={targetBranch}
          onChange={(event) => onTargetBranchChange(event.target.value)}
        />
      </label>

      <label>
        <span>Commit Message</span>
        <textarea
          aria-label="Commit Message"
          value={commitMessage}
          onChange={(event) => onCommitMessageChange(event.target.value)}
        />
      </label>

      <section>
        <h3>Changed Files</h3>
        {changedFiles.length === 0 ? (
          <p>No local file changes to publish.</p>
        ) : (
          <ul>
            {changedFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        )}
      </section>

      {issues.length > 0 ? (
        <section>
          <h3>Blocking Issues</h3>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.filePath}:${issue.fieldPath || issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {publishError ? <p>{publishError}</p> : null}

      {publishResult ? (
        <section>
          <h3>Publish Complete</h3>
          <p>{publishResult.commitSha}</p>
          <p>{publishResult.targetBranch}</p>
        </section>
      ) : null}

      <footer>
        <button type="button" disabled={!canPublish} onClick={onPublish}>
          {isPublishing ? 'Publishing…' : 'Publish Changes'}
        </button>
      </footer>
    </section>
  );
}

import type { ValidationIssue } from '../../types/content';
import type { PublishResult } from '../../types/github';
import type { FileChangeInfo } from '../../hooks/use-draft-workspace';

export interface PublishDialogProps {
  isOpen: boolean;
  changedFiles: FileChangeInfo[];
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
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose} />
      <section className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Review publish dialog">
        <div className="bg-background rounded-xl shadow-2xl border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <header className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <h2 className="text-xl font-bold">检查发布内容</h2>
            <button 
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
              type="button" 
              aria-label="Close publish dialog" 
              onClick={onClose}
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex gap-4 text-xs font-mono bg-muted/40 p-3 rounded-lg border">
              <p><span className="text-muted-foreground mr-2 font-sans font-semibold">基础分支</span> {baseBranch}</p>
              <p><span className="text-muted-foreground mr-2 font-sans font-semibold">基头 SHA</span> {baseHeadSha.slice(0, 7)}</p>
            </div>

            <div className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">目标分支 (Target Branch)</span>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Target Branch"
                  type="text"
                  value={targetBranch}
                  onChange={(event) => onTargetBranchChange(event.target.value)}
                />
                <span className="text-xs text-muted-foreground">您的工作将被推送到此分支。</span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">提交信息 (Commit Message)</span>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  aria-label="Commit Message"
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                />
              </label>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-bold border-b pb-1">已更改文件 ({changedFiles.length})</h3>
              {changedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">没有可发布的本地文件更改。</p>
              ) : (
                <ul className="text-xs font-mono bg-muted/20 border rounded-md p-3 max-h-[150px] overflow-y-auto flex flex-col gap-1.5">
                  {changedFiles.map((change) => (
                    <li key={change.path} className="truncate text-muted-foreground flex items-center gap-2">
                      {change.type === 'added' ? (
                        <span className="text-[10px] w-12 text-center bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 py-0.5 rounded uppercase font-bold shrink-0">新增</span>
                      ) : change.type === 'deleted' ? (
                        <span className="text-[10px] w-12 text-center bg-destructive/10 text-destructive border border-destructive/20 py-0.5 rounded uppercase font-bold shrink-0">删除</span>
                      ) : (
                        <span className="text-[10px] w-12 text-center bg-amber-500/10 text-amber-600 border border-amber-500/20 py-0.5 rounded uppercase font-bold shrink-0">修改</span>
                      )}
                      <span className={change.type === 'deleted' ? 'line-through opacity-70' : ''}>{change.path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {issues.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-destructive border-b border-destructive/20 pb-1">阻碍发布的验证问题 ({issues.length})</h3>
                <ul className="text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 divide-y divide-destructive/10">
                  {issues.map((issue) => (
                    <li className="py-1.5 first:pt-0 last:pb-0" key={`${issue.filePath}:${issue.fieldPath || issue.message}`}>
                      <strong className="block text-xs uppercase opacity-80 mb-0.5">{issue.filePath}</strong>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {publishError ? (
              <p className="text-sm bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-md font-semibold">{publishError}</p>
            ) : null}

            {publishResult ? (
              <section className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-4 rounded-lg space-y-2">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="text-lg">✓</span> 发布完成
                </h3>
                <p className="text-sm">提交 SHA: <code className="font-mono bg-white/50 px-1 rounded">{publishResult.commitSha}</code></p>
                <p className="text-sm">目标分支: <code className="font-mono bg-white/50 px-1 rounded">{publishResult.targetBranch}</code></p>
              </section>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <button 
              className="h-9 px-4 rounded-md text-sm font-semibold hover:bg-muted/80 transition-colors" 
              type="button" 
              onClick={onClose}
            >
              取消
            </button>
            <button 
              className="h-9 px-6 rounded-md bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button" 
              disabled={!canPublish} 
              onClick={onPublish}
            >
              {isPublishing ? '正在发布…' : '发布更改'}
            </button>
          </footer>
        </div>
      </section>
    </>
  );
}

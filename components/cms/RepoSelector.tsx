import type {
  GitHubBranchSummary,
  GitHubRepositorySummary,
  WorkspaceLoadProgress,
} from '../../types/github';

export interface RepoSelectorProps {
  repos: GitHubRepositorySummary[];
  branches: GitHubBranchSummary[];
  selectedRepoFullName: string;
  selectedBranch: string;
  isLoadingRepos: boolean;
  isLoadingBranches: boolean;
  isLoadingWorkspace: boolean;
  workspaceLoadProgress: WorkspaceLoadProgress | null;
  onContinueAssetSync: () => void;
  onSkipAssetSync: () => void;
  onRepoChange: (fullName: string) => void;
  onBranchChange: (branchName: string) => void;
  onLoadWorkspace: () => void;
}

export function RepoSelector({
  repos,
  branches,
  selectedRepoFullName,
  selectedBranch,
  isLoadingRepos,
  isLoadingBranches,
  isLoadingWorkspace,
  workspaceLoadProgress,
  onContinueAssetSync,
  onSkipAssetSync,
  onRepoChange,
  onBranchChange,
  onLoadWorkspace,
}: RepoSelectorProps) {
  const hasSelectedRepo = selectedRepoFullName.trim().length > 0;
  const hasInlineDecision = workspaceLoadProgress?.phase === 'confirm';
  const canLoadWorkspace = hasSelectedRepo && selectedBranch.trim().length > 0 && !isLoadingWorkspace && !hasInlineDecision;
  const progressPercent = Math.max(4, Math.min(100, workspaceLoadProgress?.percent || 0));
  const progressSummary = workspaceLoadProgress?.phase === 'assets'
    ? `${workspaceLoadProgress.loadedAssets}/${workspaceLoadProgress.totalAssets} 个资源`
    : workspaceLoadProgress?.phase === 'confirm'
      ? `${workspaceLoadProgress.totalAssets} 个资源待处理`
    : '卡片与配置元数据';
  const progressDetail = workspaceLoadProgress?.phase === 'assets'
    ? `${(workspaceLoadProgress.loadedBytes / 1024).toFixed(1)}KB / ${(Math.max(workspaceLoadProgress.totalBytes, 0) / 1024).toFixed(1)}KB`
    : workspaceLoadProgress?.phase === 'confirm'
      ? `${(Math.max(workspaceLoadProgress.totalBytes, 0) / 1024).toFixed(1)}KB 可选同步`
    : '正在建立资源清单';
  const loadButtonLabel = workspaceLoadProgress?.phase === 'confirm'
    ? '等待选择'
    : isLoadingWorkspace && workspaceLoadProgress?.phase === 'assets'
    ? `同步资源 ${workspaceLoadProgress.loadedAssets}/${workspaceLoadProgress.totalAssets}`
    : isLoadingWorkspace
      ? '加载中...'
      : '加载内容';

  return (
    <section className="w-full bg-background rounded-lg border shadow-sm px-3 py-2" aria-label="Repository workspace selector">
      <h2 className="sr-only">Repository Workspace</h2>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block whitespace-nowrap">
          <p className="text-[10px] font-bold text-primary tracking-wider uppercase mb-0.5">工作区绑定</p>
          <span className="text-xs text-muted-foreground mr-2 font-medium">选择数据来源</span>
        </div>

        <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap">
          <label className="flex flex-1 items-center gap-2 text-sm bg-muted/30 px-2 py-1 rounded">
            <span className="font-semibold text-muted-foreground shrink-0 text-xs uppercase tracking-wider">仓库</span>
            <select
              className="flex h-7 w-full min-w-[120px] rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              aria-label="Repository"
              value={selectedRepoFullName}
              disabled={isLoadingRepos}
              onChange={(event) => onRepoChange(event.target.value)}
            >
              <option value="">请选择一个仓库</option>
              {repos.map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm bg-muted/30 px-2 py-1 rounded">
            <span className="font-semibold text-muted-foreground shrink-0 text-xs uppercase tracking-wider">分支</span>
            <select
              className="flex h-7 w-[100px] rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              aria-label="Branch"
              value={selectedBranch}
              disabled={!hasSelectedRepo || isLoadingBranches}
              onChange={(event) => onBranchChange(event.target.value)}
            >
              <option value="">请选择一个分支</option>
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className="h-7 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-bold shadow-sm hover:bg-secondary/80 disabled:opacity-50 shrink-0"
            type="button"
            aria-label="Load Workspace"
            disabled={!canLoadWorkspace}
            onClick={onLoadWorkspace}
          >
            {loadButtonLabel}
          </button>
        </div>
      </div>

      {workspaceLoadProgress ? (
        <div className="mt-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
            <span className="text-foreground">{workspaceLoadProgress.message}</span>
            <span className="tabular-nums text-primary">{workspaceLoadProgress.percent}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10"
            role="progressbar"
            aria-label="Workspace load progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={workspaceLoadProgress.percent}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-sky-400 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span className="shrink-0">{progressSummary} · {progressDetail}</span>
            {workspaceLoadProgress.currentPath ? (
              <span className="truncate text-right">{workspaceLoadProgress.currentPath}</span>
            ) : null}
          </div>
          {workspaceLoadProgress.phase === 'confirm' ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm hover:brightness-105"
                onClick={onContinueAssetSync}
              >
                继续同步资源
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-3 text-xs font-semibold text-muted-foreground shadow-sm hover:bg-muted"
                onClick={onSkipAssetSync}
              >
                跳过，按旧逻辑继续
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

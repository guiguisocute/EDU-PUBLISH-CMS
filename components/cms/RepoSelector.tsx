import type {
  GitHubBranchSummary,
  GitHubRepositorySummary,
} from '../../types/github';

export interface RepoSelectorProps {
  repos: GitHubRepositorySummary[];
  branches: GitHubBranchSummary[];
  selectedRepoFullName: string;
  selectedBranch: string;
  isLoadingRepos: boolean;
  isLoadingBranches: boolean;
  isLoadingWorkspace: boolean;
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
  onRepoChange,
  onBranchChange,
  onLoadWorkspace,
}: RepoSelectorProps) {
  const hasSelectedRepo = selectedRepoFullName.trim().length > 0;
  const canLoadWorkspace = hasSelectedRepo && selectedBranch.trim().length > 0 && !isLoadingWorkspace;

  return (
    <section className="flex items-center gap-3 w-full bg-background rounded-lg border shadow-sm px-3 py-1.5" aria-label="Repository workspace selector">
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
          disabled={!canLoadWorkspace} 
          onClick={onLoadWorkspace}
        >
          {isLoadingWorkspace ? '加载中...' : '加载内容'}
        </button>
      </div>
    </section>
  );
}

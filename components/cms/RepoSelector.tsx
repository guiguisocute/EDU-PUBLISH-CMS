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
    <section className="cms-repo-selector" aria-label="Repository workspace selector">
      <header className="cms-repo-selector__header">
        <p className="cms-repo-selector__eyebrow">Workspace Binding</p>
        <h2>Repository Workspace</h2>
        <p className="cms-repo-selector__summary">
          Choose a GitHub repository and branch, then hydrate the local draft workspace.
        </p>
      </header>

      <div className="cms-repo-selector__controls">
        <label className="cms-repo-selector__field">
          <span>Repository</span>
          <select
            aria-label="Repository"
            value={selectedRepoFullName}
            disabled={isLoadingRepos}
            onChange={(event) => onRepoChange(event.target.value)}
          >
            <option value="">Select a repository</option>
            {repos.map((repo) => (
              <option key={repo.fullName} value={repo.fullName}>
                {repo.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="cms-repo-selector__field">
          <span>Branch</span>
          <select
            aria-label="Branch"
            value={selectedBranch}
            disabled={!hasSelectedRepo || isLoadingBranches}
            onChange={(event) => onBranchChange(event.target.value)}
          >
            <option value="">Select a branch</option>
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" disabled={!canLoadWorkspace} onClick={onLoadWorkspace}>
          {isLoadingWorkspace ? 'Loading Workspace…' : 'Load Workspace'}
        </button>
      </div>
    </section>
  );
}

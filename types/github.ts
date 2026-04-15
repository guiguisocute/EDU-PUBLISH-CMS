import type { CardDocument } from './content';

export interface RepoRef {
  owner: string;
  name: string;
}

export interface GitHubViewer {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface SessionResponse {
  authenticated: boolean;
  viewer: GitHubViewer | null;
}

export interface GitHubRepoPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

export interface GitHubRepositorySummary {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  permissions: GitHubRepoPermissions;
  updatedAt: string;
}

export interface GitHubBranchSummary {
  name: string;
  headSha: string;
}

export interface WorkspaceLoadRequest {
  repo: RepoRef;
  branch: string;
}

export interface WorkspaceReadonlyConfig {
  siteYaml: string;
  widgetsYaml: string;
  subscriptionsYaml: string;
}

export interface WorkspaceAttachmentFile {
  path: string;
  sha: string;
  size: number;
  encoding?: 'base64';
  content?: string;
  previewUrl?: string;
  dirty?: boolean;
  deleted?: boolean;
}

export interface WorkspaceAssetRequestEntry {
  path: string;
  sha: string;
  size: number;
}

export interface WorkspaceAssetLoadRequest {
  repo: RepoRef;
  assets: WorkspaceAssetRequestEntry[];
}

export interface WorkspaceAssetLoadResponse {
  assets: Array<WorkspaceAssetRequestEntry & {
    encoding: 'base64';
    content: string;
  }>;
}

export interface WorkspaceLoadProgress {
  phase: 'metadata' | 'confirm' | 'assets';
  message: string;
  loadedAssets: number;
  totalAssets: number;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  currentPath?: string;
}

export interface DraftWorkspace {
  repo: RepoRef;
  branch: string;
  baseHeadSha: string;
  cards: CardDocument[];
  readonlyConfig: WorkspaceReadonlyConfig;
  attachments: WorkspaceAttachmentFile[];
}

export interface PublishChange {
  path: string;
  operation: 'upsert' | 'delete';
  encoding: 'utf-8' | 'base64';
  content?: string;
}

export interface PublishRequest {
  repo: RepoRef;
  baseBranch: string;
  targetBranch: string;
  baseHeadSha: string;
  commitMessage: string;
  changes: PublishChange[];
}

export interface PublishResult {
  commitSha: string;
  targetBranch: string;
  commitUrl?: string;
  compareUrl?: string;
  publishedAt: string;
}

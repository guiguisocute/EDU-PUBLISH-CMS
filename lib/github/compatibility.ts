import type { GitHubTreeEntry } from './client';

export interface RepoCompatibilityIssue {
  path: string;
  message: string;
}

export interface RepoCompatibilityResult {
  compatible: boolean;
  issues: RepoCompatibilityIssue[];
}

const REQUIRED_FILES = [
  'config/site.yaml',
  'config/widgets.yaml',
  'config/subscriptions.yaml',
] as const;

export function isCardMarkdownPath(path: string): boolean {
  return path.startsWith('content/card/') && path.endsWith('.md');
}

export function isAttachmentPath(path: string): boolean {
  return path.startsWith('content/attachments/');
}

export function checkRepositoryCompatibility(
  entries: GitHubTreeEntry[],
): RepoCompatibilityResult {
  const paths = new Set(entries.map((entry) => entry.path));
  const issues: RepoCompatibilityIssue[] = [];
  const hasCardContent = entries.some(
    (entry) => entry.path === 'content/card' || entry.path.startsWith('content/card/'),
  );

  if (!hasCardContent) {
    issues.push({
      path: 'content/card/',
      message: 'Missing required directory',
    });
  }

  for (const requiredFile of REQUIRED_FILES) {
    if (!paths.has(requiredFile)) {
      issues.push({
        path: requiredFile,
        message: 'Missing required file',
      });
    }
  }

  return {
    compatible: issues.length === 0,
    issues,
  };
}

export function selectWorkspaceEntries(entries: GitHubTreeEntry[]): {
  cardEntries: GitHubTreeEntry[];
  attachmentEntries: GitHubTreeEntry[];
  siteConfigEntry: GitHubTreeEntry | null;
  widgetsConfigEntry: GitHubTreeEntry | null;
  subscriptionsConfigEntry: GitHubTreeEntry | null;
} {
  const cardEntries = entries
    .filter((entry) => entry.type === 'blob' && isCardMarkdownPath(entry.path))
    .sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
  const attachmentEntries = entries
    .filter((entry) => entry.type === 'blob' && isAttachmentPath(entry.path))
    .sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));

  return {
    cardEntries,
    attachmentEntries,
    siteConfigEntry: entries.find((entry) => entry.path === 'config/site.yaml') || null,
    widgetsConfigEntry: entries.find((entry) => entry.path === 'config/widgets.yaml') || null,
    subscriptionsConfigEntry:
      entries.find((entry) => entry.path === 'config/subscriptions.yaml') || null,
  };
}

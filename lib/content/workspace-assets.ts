import type { RepoRef, WorkspaceAttachmentFile } from '../../types/github';

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function isWorkspaceBlobUrl(url: string): boolean {
  return String(url || '').trim().startsWith('/api/workspace/blob?');
}

function inferMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'txt':
      return 'text/plain';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

export function getWorkspaceAssetMimeType(path: string): string {
  return inferMimeType(path);
}

export function isImageMimeType(mimeType: string): boolean {
  return String(mimeType || '').toLowerCase().startsWith('image/');
}

function extensionFromMimeType(mimeType: string): string {
  switch (String(mimeType || '').toLowerCase()) {
    case 'image/svg+xml':
      return 'svg';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return '';
  }
}

export function buildDownloadFileName(label: string, url: string): string {
  const trimmedLabel = String(label || '').trim();

  if (/\.[a-z0-9]{2,8}$/i.test(trimmedLabel)) {
    return trimmedLabel;
  }

  const pathMatch = String(url || '').match(/([\w-]+)\.([a-z0-9]{2,8})(?:$|[?#])/i);
  if (pathMatch) {
    return trimmedLabel ? `${trimmedLabel}.${pathMatch[2].toLowerCase()}` : `${pathMatch[1]}.${pathMatch[2].toLowerCase()}`;
  }

  const dataMatch = String(url || '').match(/^data:([^;,]+)/i);
  if (dataMatch) {
    const extension = extensionFromMimeType(dataMatch[1]);
    if (extension) {
      return trimmedLabel ? `${trimmedLabel}.${extension}` : `download.${extension}`;
    }
  }

  return trimmedLabel || 'download';
}

export function toDataUrl(path: string, content: string): string {
  return `data:${inferMimeType(path)};base64,${String(content || '').replace(/\s+/g, '')}`;
}

export function toWorkspaceRelativeUrl(path: string): string {
  const normalized = normalizeRepoPath(String(path || '').replace(/^\/+/, ''));

  if (normalized.startsWith('content/attachments/')) {
    return `./attachments/${normalized.slice('content/attachments/'.length)}`;
  }

  if (normalized.startsWith('content/img/')) {
    return `/img/${normalized.slice('content/img/'.length)}`;
  }

  if (normalized.startsWith('public/img/')) {
    return `/img/${normalized.slice('public/img/'.length)}`;
  }

  if (normalized.startsWith('img/')) {
    return `/${normalized}`;
  }

  return normalized;
}

function normalizeRepoPath(path: string): string {
  const segments = String(path || '')
    .replace(/\\/g, '/')
    .split('/');
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments.join('/');
}

function sanitizeWorkspaceAssetPath(url: string): string {
  const trimmed = String(url || '').trim();
  const withoutHash = trimmed.split('#', 1)[0] || '';
  const withoutQuery = withoutHash.split('?', 1)[0] || '';

  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

function buildDerivedWorkspaceAssetCandidatePaths(path: string): string[] {
  const normalized = normalizeRepoPath(path);

  if (!normalized) {
    return [];
  }

  const derivedPaths: string[] = [];

  if (normalized.startsWith('attachments/')) {
    derivedPaths.push(`content/${normalized}`);
  }

  if (normalized.startsWith('img/')) {
    const suffix = normalized.slice('img/'.length);

    derivedPaths.push(`public/${normalized}`);
    derivedPaths.push(`content/${normalized}`);

    if (suffix) {
      derivedPaths.push(`content/attachments/${suffix}`);
    }

    derivedPaths.push(`content/attachments/${normalized}`);
  }

  return derivedPaths;
}

export function buildWorkspaceAssetCandidatePaths(url: string, basePath: string): string[] {
  const rawUrl = String(url || '').trim();

  if (!rawUrl || rawUrl === '/default-placeholder.svg' || isExternalUrl(rawUrl) || isWorkspaceBlobUrl(rawUrl) || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
    return [];
  }

  const sanitizedUrl = sanitizeWorkspaceAssetPath(rawUrl);

  if (!sanitizedUrl) {
    return [];
  }

  let targetPath = sanitizedUrl;
  let fallbackPath = sanitizedUrl;

  if (sanitizedUrl.startsWith('/')) {
    targetPath = normalizeRepoPath(sanitizedUrl.slice(1));
    fallbackPath = targetPath;
  } else {
    const relativePath = sanitizedUrl.startsWith('./') ? sanitizedUrl.slice(2) : sanitizedUrl;
    fallbackPath = normalizeRepoPath(relativePath);
    const folderParts = normalizeRepoPath(basePath).split('/');
    folderParts.pop();
    const folder = folderParts.join('/');
    targetPath = normalizeRepoPath(folder ? `${folder}/${relativePath}` : relativePath);
  }

  const basename = targetPath.split('/').pop() || '';

  return Array.from(new Set([
    targetPath,
    fallbackPath,
    ...buildDerivedWorkspaceAssetCandidatePaths(targetPath),
    ...buildDerivedWorkspaceAssetCandidatePaths(fallbackPath),
    basename ? `content/attachments/${basename}` : '',
  ].filter(Boolean)));
}

export function resolveWorkspaceAttachmentByUrl(
  url: string,
  basePath: string,
  attachments: WorkspaceAttachmentFile[],
): WorkspaceAttachmentFile | null {
  const candidatePaths = buildWorkspaceAssetCandidatePaths(url, basePath);

  if (candidatePaths.length === 0) {
    return null;
  }

  return attachments.find((attachment) => candidatePaths.includes(attachment.path)) || null;
}

export function buildWorkspaceBlobUrl(
  repo: RepoRef,
  sha: string,
  path?: string,
  options: {
    download?: boolean;
  } = {},
): string {
  const params = new URLSearchParams({
    owner: repo.owner,
    name: repo.name,
    sha,
  });

  if (path) {
    params.set('path', path);
  }

  if (options.download) {
    params.set('download', '1');
  }

  return `/api/workspace/blob?${params.toString()}`;
}

export function buildWorkspaceCandidateBlobUrl(
  repo: RepoRef,
  branch: string,
  candidatePaths: string[],
  options: {
    download?: boolean;
  } = {},
): string {
  const params = new URLSearchParams({
    owner: repo.owner,
    name: repo.name,
    branch,
  });

  for (const candidatePath of candidatePaths) {
    params.append('candidate', candidatePath);
  }

  if (options.download) {
    params.set('download', '1');
  }

  return `/api/workspace/blob?${params.toString()}`;
}

export function resolveWorkspaceAssetDownloadUrl(
  url: string,
  basePath: string,
  options: {
    attachments: WorkspaceAttachmentFile[];
    repo?: RepoRef;
    branch?: string;
  },
): string {
  const rawUrl = String(url || '').trim();

  if (!rawUrl || rawUrl === '/default-placeholder.svg' || isExternalUrl(rawUrl) || isWorkspaceBlobUrl(rawUrl) || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
    return rawUrl;
  }

  const candidatePaths = buildWorkspaceAssetCandidatePaths(rawUrl, basePath);
  const found = candidatePaths.length > 0
    ? options.attachments.find((attachment) => candidatePaths.includes(attachment.path)) || null
    : null;

  if (!found) {
    if (options.repo && options.branch && candidatePaths.length > 0) {
      return buildWorkspaceCandidateBlobUrl(options.repo, options.branch, candidatePaths, { download: true });
    }

    return rawUrl;
  }

  if (options.repo && found.sha) {
    return buildWorkspaceBlobUrl(options.repo, found.sha, found.path, { download: true });
  }

  if (found.content && found.encoding === 'base64') {
    return toDataUrl(found.path, found.content);
  }

  if (found.previewUrl) {
    return found.previewUrl;
  }

  return rawUrl;
}

export function resolveWorkspaceAssetUrl(
  url: string,
  basePath: string,
  options: {
    attachments: WorkspaceAttachmentFile[];
    repo?: RepoRef;
    branch?: string;
  },
): string {
  const rawUrl = String(url || '').trim();

  if (!rawUrl || rawUrl === '/default-placeholder.svg' || isExternalUrl(rawUrl) || isWorkspaceBlobUrl(rawUrl) || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
    return rawUrl;
  }

  const candidatePaths = buildWorkspaceAssetCandidatePaths(rawUrl, basePath);
  const found = candidatePaths.length > 0
    ? options.attachments.find((attachment) => candidatePaths.includes(attachment.path)) || null
    : null;

  if (!found) {
    if (options.repo && options.branch && candidatePaths.length > 0) {
      return buildWorkspaceCandidateBlobUrl(options.repo, options.branch, candidatePaths);
    }

    return rawUrl;
  }

  if (found.previewUrl) {
    return found.previewUrl;
  }

  if (found.content && found.encoding === 'base64') {
    return toDataUrl(found.path, found.content);
  }

  if (options.repo && found.sha) {
    return buildWorkspaceBlobUrl(options.repo, found.sha, found.path);
  }

  return rawUrl;
}

import type {
  NoticeAttachment,
  NoticeAttachmentInput,
} from '../../types/content';

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function withFilePath(message: string, filePath?: string): string {
  return filePath ? `${message} (${filePath})` : message;
}

function stripUrlSuffix(url: string): string {
  return String(url).split('#')[0]?.split('?')[0] ?? '';
}

function basenameFromUrl(url: string): string {
  const clean = stripUrlSuffix(url).replace(/\\/g, '/');
  const parts = clean.split('/').filter(Boolean);
  return safeDecodeUriComponent(parts.at(-1) ?? clean);
}

function extensionFromUrl(url: string): string {
  const baseName = basenameFromUrl(url);
  const dotIndex = baseName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return '';
  }

  return baseName.slice(dotIndex + 1).toLowerCase();
}

function inferNormalizedAttachmentType(url: string): string {
  return extensionFromUrl(url) || 'file';
}

export function inferAttachmentTypeFromUrl(url: string): string {
  const extension = extensionFromUrl(url);

  if (!extension) {
    return 'link';
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'xlsx';
  }

  if (['doc', 'docx'].includes(extension)) {
    return 'docx';
  }

  if (extension === 'pdf') {
    return 'pdf';
  }

  if (['ppt', 'pptx'].includes(extension)) {
    return 'pptx';
  }

  return extension;
}

export function normalizeAttachmentUrl(
  value: unknown,
  filePath?: string,
): string {
  const clean = String(value ?? '').trim().replace(/\\/g, '/');

  if (!clean) {
    return '';
  }

  if (clean === '#') {
    return clean;
  }

  const decoded = safeDecodeUriComponent(clean);

  if (clean.includes('..') || decoded.includes('..')) {
    throw new Error(withFilePath(`Suspicious path: ${clean}`, filePath));
  }

  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }

  const normalizedUrl = clean.startsWith('/attachments/')
    ? clean
    : clean.startsWith('./attachments/')
      ? `/attachments/${clean.slice('./attachments/'.length)}`
      : clean.startsWith('attachments/')
        ? `/attachments/${clean.slice('attachments/'.length)}`
        : clean.startsWith('/')
          ? clean
          : `/attachments/${clean.replace(/^\.?\/+/, '')}`;

  const normalizedSegments = normalizedUrl
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => safeDecodeUriComponent(segment));

  if (normalizedSegments.some((segment) => segment === '..')) {
    throw new Error(withFilePath(`Path traversal detected: ${clean}`, filePath));
  }

  return normalizedUrl;
}

export function normalizeAttachments(
  attachments: NoticeAttachmentInput[] | undefined,
  filePath?: string,
): NoticeAttachment[] {
  if (!attachments) {
    return [];
  }

  if (!Array.isArray(attachments)) {
    throw new Error(withFilePath('attachments must be an array', filePath));
  }

  return attachments.map((item, index) => {
    if (typeof item === 'string') {
      const url = normalizeAttachmentUrl(item, filePath);

      if (!url) {
        throw new Error(withFilePath(`Attachment at index ${index} is empty`, filePath));
      }

      return {
        name: basenameFromUrl(url),
        url,
        type: inferNormalizedAttachmentType(url),
      };
    }

    if (!item || typeof item !== 'object') {
      throw new Error(
        withFilePath(`Attachment at index ${index} must be string or object`, filePath),
      );
    }

    const name = String(item.name ?? '').trim();
    const rawUrl = String(item.url ?? '').trim();

    if (!name || !rawUrl) {
      throw new Error(
        withFilePath(`Attachment at index ${index} missing name or url`, filePath),
      );
    }

    const url = normalizeAttachmentUrl(rawUrl, filePath);

    return {
      name,
      url,
      type: String(item.type ?? '').trim() || inferNormalizedAttachmentType(url),
    };
  });
}

export function extractInlineAttachments(
  markdown: string,
  filePath?: string,
): NoticeAttachment[] {
  const result: NoticeAttachment[] = [];
  const text = String(markdown ?? '');
  const imagePattern = /!\[([^\]]{0,500})\]\(([^)\s]{0,2000})\)/g;
  const linkPattern = /(?<!!)\[([^\]]{1,500})\]\(([^)\s]{1,2000})\)/g;

  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(text))) {
    const alt = String(match[1] ?? '').trim();
    const rawUrl = String(match[2] ?? '').trim();

    if (!rawUrl) {
      continue;
    }

    const url = normalizeAttachmentUrl(rawUrl, filePath);

    result.push({
      name: alt || basenameFromUrl(url) || 'image',
      url,
      type: 'image',
    });
  }

  while ((match = linkPattern.exec(text))) {
    const name = String(match[1] ?? '').trim();
    const rawUrl = String(match[2] ?? '').trim();

    if (!rawUrl) {
      continue;
    }

    const url = normalizeAttachmentUrl(rawUrl, filePath);

    result.push({
      name: name || basenameFromUrl(url) || url,
      url,
      type: inferAttachmentTypeFromUrl(url),
    });
  }

  const lineAttachments = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[分享]') || line.startsWith('[QQ小程序]'))
    .map((line) => ({
      name: line,
      url: '#',
      type: 'link',
    } satisfies NoticeAttachment));

  return mergeAttachments(result, lineAttachments);
}

export function mergeAttachments(
  base: NoticeAttachment[],
  extra: NoticeAttachment[],
): NoticeAttachment[] {
  const merged: NoticeAttachment[] = [];
  const seen = new Set<string>();

  for (const item of [...base, ...extra]) {
    const key = `${item.name}::${item.url}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(item);
  }

  return merged;
}

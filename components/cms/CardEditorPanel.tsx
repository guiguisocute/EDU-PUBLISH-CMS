import { useEffect, useMemo, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { buildDownloadFileName, isExternalUrl, resolveWorkspaceAssetUrl, toWorkspaceRelativeUrl } from '../../lib/content/workspace-assets';
import type {
  CardDocument,
  NoticeAttachment,
  NoticeAttachmentInput,
  ValidationIssue,
} from '../../types/content';
import type { RepoRef, WorkspaceAttachmentFile } from '../../types/github';

interface AttachmentRow {
  name: string;
  url: string;
  type: string;
}

export interface CardEditorPanelProps {
  card: CardDocument | null;
  issues: ValidationIssue[];
  onFieldChange: (fieldPath: string, value: unknown) => void;
  onBodyChange: (markdown: string) => void;
  onUploadAttachmentFiles?: (files: FileList | File[]) => Promise<void>;
  onDeleteCard?: (id: string) => void;
  workspaceRepo?: RepoRef | null;
  workspaceBranch?: string | null;
  workspaceAttachments?: WorkspaceAttachmentFile[];
  isDarkMode?: boolean;
}

function normalizeAttachmentRows(
  attachments: NoticeAttachmentInput[] | undefined,
): AttachmentRow[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((attachment) => {
    if (typeof attachment === 'string') {
      return {
        name: '',
        url: attachment,
        type: '',
      };
    }

    return {
      name: String(attachment.name ?? ''),
      url: String(attachment.url ?? ''),
      type: String(attachment.type ?? ''),
    };
  });
}

function getFileNameFromUrl(url: string): string {
  const normalized = String(url || '').split('?')[0].replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).at(-1) || '';
}

function getAttachmentTypeFromUrl(url: string): string {
  const fileName = getFileNameFromUrl(url);
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (!extension) {
    return 'file';
  }

  if (['doc', 'docx'].includes(extension)) {
    return 'docx';
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'xlsx';
  }

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }

  return extension;
}

function isDownloadableAssetHref(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/api/workspace/blob?');
}

function toTagsString(tags: unknown): string {
  return Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim()).filter(Boolean).join(', ')
    : '';
}

function isValidDate(value: string): boolean {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function buildInlineErrors(card: CardDocument | null, attachmentRows: AttachmentRow[]): ValidationIssue[] {
  if (!card) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  if (!String(card.data.id ?? '').trim()) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'id',
      message: '【ID】 不能为空。',
    });
  }

  if (!String(card.data.title ?? '').trim()) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'title',
      message: '【标题】 不能为空。',
    });
  }

  if (!String(card.data.school_slug ?? '').trim()) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'school_slug',
      message: '【学院别名 (Slug)】 不能为空。',
    });
  }

  const published = String(card.data.published ?? '').trim();

  if (!isValidDate(published)) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'published',
      message: '【发布时间】 必须是一个有效的日期。',
    });
  }

  const startAt = String(card.data.start_at ?? '').trim();
  const endAt = String(card.data.end_at ?? '').trim();

  if (startAt && !isValidDate(startAt)) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'start_at',
      message: '【开始时间】 必须是一个有效的日期。',
    });
  }

  if (endAt && !isValidDate(endAt)) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'end_at',
      message: 'End time must be a valid date.',
    });
  }

  attachmentRows.forEach((attachment, index) => {
    if (!attachment.name.trim() || !attachment.url.trim()) {
      issues.push({
        severity: 'error',
        filePath: card.path,
        fieldPath: `attachments.${index}`,
        message: `Attachment ${index + 1} must include both a name and a URL.`,
      });
    }
  });

  return issues;
}

function combineIssues(
  card: CardDocument | null,
  externalIssues: ValidationIssue[],
  inlineIssues: ValidationIssue[],
): ValidationIssue[] {
  if (!card) {
    return [];
  }

  const merged = [...inlineIssues, ...externalIssues.filter((issue) => issue.filePath === card.path)];
  const seen = new Set<string>();

  return merged.filter((issue) => {
    const key = `${issue.filePath}:${issue.fieldPath || ''}:${issue.message}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function fieldMessages(issues: ValidationIssue[], fieldPath: string): string[] {
  return issues
    .filter((issue) => issue.fieldPath === fieldPath)
    .map((issue) => issue.message);
}

function attachmentMessages(issues: ValidationIssue[]): string[] {
  return issues
    .filter((issue) => issue.fieldPath?.startsWith('attachments.'))
    .map((issue) => issue.message);
}

function updateAttachmentRows(
  rows: AttachmentRow[],
  index: number,
  key: keyof AttachmentRow,
  value: string,
): AttachmentRow[] {
  return rows.map((row, rowIndex) =>
    rowIndex === index
      ? {
        ...row,
        [key]: value,
      }
      : row,
  );
}

function toAttachmentInputs(rows: AttachmentRow[]): NoticeAttachment[] {
  return rows.map((row) => ({
    name: row.name,
    url: row.url,
    type: row.type,
  }));
}

function renderMessages(messages: string[]) {
  return messages.map((message) => (
    <p key={message} className="text-[11px] font-semibold text-destructive mt-1">
      {message}
    </p>
  ));
}

export function CardEditorPanel({
  card,
  issues,
  onFieldChange,
  onBodyChange,
  onUploadAttachmentFiles,
  onDeleteCard,
  workspaceRepo,
  workspaceBranch,
  workspaceAttachments,
  isDarkMode = false,
}: CardEditorPanelProps) {
  const [attachmentRows, setAttachmentRows] = useState<AttachmentRow[]>(() =>
    normalizeAttachmentRows(card?.data.attachments),
  );

  useEffect(() => {
    setAttachmentRows(normalizeAttachmentRows(card?.data.attachments));
  }, [card]);

  const mergedIssues = useMemo(() => {
    const inlineIssues = buildInlineErrors(card, attachmentRows);
    return combineIssues(card, issues, inlineIssues);
  }, [attachmentRows, card, issues]);
  const availableAttachmentOptions = useMemo(() => {
    return (workspaceAttachments || [])
      .filter((attachment) => !attachment.deleted && attachment.path.startsWith('content/attachments/'))
      .map((attachment) => {
        const relativeUrl = toWorkspaceRelativeUrl(attachment.path);
        return {
          path: attachment.path,
          relativeUrl,
          fileName: getFileNameFromUrl(relativeUrl),
          type: getAttachmentTypeFromUrl(relativeUrl),
        };
      })
      .sort((left, right) => left.relativeUrl.localeCompare(right.relativeUrl, 'zh-CN'));
  }, [workspaceAttachments]);
  const attachmentUrlListId = `${card?.id || 'draft'}-attachment-urls`;
  const resolveEditorAsset = useMemo(
    () => (url: string) => resolveWorkspaceAssetUrl(url, card?.path || '', {
      attachments: workspaceAttachments || [],
      repo: workspaceRepo || undefined,
      branch: workspaceBranch || undefined,
    }),
    [card?.path, workspaceAttachments, workspaceBranch, workspaceRepo],
  );
  const previewOptions = useMemo(() => ({
    urlTransform: (url: string) => resolveEditorAsset(String(url || '')),
    components: {
      a: ({ href, children, node, ...props }: any) => {
        const resolvedHref = String(href || '');
        const external = isExternalUrl(resolvedHref);
        const childText = Array.isArray(children)
          ? children.map((child) => typeof child === 'string' ? child : '').join('').trim()
          : typeof children === 'string'
            ? children.trim()
            : '';
        const downloadName = getFileNameFromUrl(resolvedHref);
        const safeDownloadName = buildDownloadFileName(
          downloadName && !downloadName.includes('blob?') ? downloadName : childText,
          resolvedHref,
        );

        return (
          <a
            {...props}
            href={resolvedHref || undefined}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer noopener' : undefined}
            download={isDownloadableAssetHref(resolvedHref) ? safeDownloadName : undefined}
          >
            {children}
          </a>
        );
      },
      img: ({ src, alt, node, ...props }: any) => (
        <img
          {...props}
          src={String(src || '')}
          alt={String(alt || '')}
          className="max-w-full rounded-md border border-border/40 shadow-sm"
        />
      ),
    },
  }), [resolveEditorAsset]);

  if (!card) {
    return (
      <section className="flex flex-col items-center justify-center p-8 text-center bg-muted/5 h-full min-h-[400px]">
        <h2 className="text-xl font-bold mb-2">Card Editor</h2>
        <p className="text-muted-foreground text-sm">Select a card to start editing.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 p-6 lg:p-10 w-full animate-in fade-in duration-300" aria-label="Card editor panel">
      <header className="border-b border-muted-foreground/10 pb-6 mb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground font-mono bg-muted/40 px-2 py-0.5 rounded border">{card.path}</p>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-foreground">{String(card.data.title ?? '').trim() || card.id || '无标题记录'}</h2>
          </div>
          {onDeleteCard && (
            <button
              onClick={() => {
                if (window.confirm(`确定要删除卡片 "${String(card.data.title ?? '').trim() || card.id}" 吗？此操作将只能在撤销历史中恢复。`)) {
                  onDeleteCard(card.id);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-sm"
              title="删除此卡片"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              <span>删除卡片</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 bg-card border rounded-xl p-6 shadow-sm">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold text-muted-foreground/80 uppercase tracking-widest">ID (标识) *</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="ID"
            type="text"
            value={String(card.data.id ?? '')}
            onChange={(event) => onFieldChange('id', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'id'))}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">学院别名 (School Slug)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="School Slug"
            type="text"
            value={String(card.data.school_slug ?? '')}
            onChange={(event) => onFieldChange('school_slug', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'school_slug'))}
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-bold text-muted-foreground">标题 (Title)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Title"
            type="text"
            value={String(card.data.title ?? '')}
            onChange={(event) => onFieldChange('title', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'title'))}
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-bold text-muted-foreground">描述 (Description)</span>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Description"
            value={String(card.data.description ?? '')}
            onChange={(event) => onFieldChange('description', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center group">
            <span className="text-xs font-bold text-muted-foreground">发布时间 (Published)</span>
            <button
              type="button"
              className="flex items-center justify-center p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors border bg-muted/30 shadow-sm"
              title="填入当前时间"
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                const offset = -now.getTimezoneOffset();
                const sign = offset >= 0 ? '+' : '-';
                const absOffset = Math.abs(offset);
                const localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;
                onFieldChange('published', localTime);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M12 7v5l4 2"/>
              </svg>
            </button>
          </div>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Published"
            type="text"
            value={String(card.data.published ?? '')}
            onChange={(event) => onFieldChange('published', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'published'))}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">分类 (Category)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Category"
            type="text"
            value={String(card.data.category ?? '')}
            onChange={(event) => onFieldChange('category', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-bold text-muted-foreground">标签 (Tags)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Tags"
            type="text"
            value={toTagsString(card.data.tags)}
            onChange={(event) =>
              onFieldChange(
                'tags',
                event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>

        <label className="flex items-center gap-2 md:col-span-2 mt-2">
          <input
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            aria-label="Pinned"
            type="checkbox"
            checked={Boolean(card.data.pinned ?? card.data.pined)}
            onChange={(event) => onFieldChange('pinned', event.target.checked)}
          />
          <span className="text-sm font-semibold select-none">置顶 (Pinned)</span>
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2 mt-4">
          <span className="text-xs font-bold text-muted-foreground">封面图片链接 (Cover Image URL)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Cover"
            type="text"
            value={String(card.data.cover ?? '')}
            onChange={(event) => onFieldChange('cover', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">徽章 (Badge)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Badge"
            type="text"
            value={String(card.data.badge ?? '')}
            onChange={(event) => onFieldChange('badge', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">专属外链 (Extra URL)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Extra URL"
            type="text"
            value={String(card.data.extra_url ?? '')}
            onChange={(event) => onFieldChange('extra_url', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">开始时间 (Start At)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Start At"
            type="text"
            value={String(card.data.start_at ?? '')}
            onChange={(event) => onFieldChange('start_at', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'start_at'))}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">结束时间 (End At)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="End At"
            type="text"
            value={String(card.data.end_at ?? '')}
            onChange={(event) => onFieldChange('end_at', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'end_at'))}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">来源渠道 (Source Channel)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Source Channel"
            type="text"
            value={String(card.data.source?.channel ?? '')}
            onChange={(event) => onFieldChange('source.channel', event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">来源作者 (Source Sender)</span>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Source Sender"
            type="text"
            value={String(card.data.source?.sender ?? '')}
            onChange={(event) => onFieldChange('source.sender', event.target.value)}
          />
        </label>
      </div>

      <section className="mt-8 border rounded-xl overflow-hidden bg-muted/10">
        <div className="bg-muted/40 border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-sm">相关附件 (Attachments)</h3>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Add Attachment"
              className="h-8 px-3 rounded-md border bg-background text-xs font-semibold shadow-sm hover:bg-muted transition-colors"
              onClick={() => {
                const nextRows = [...attachmentRows, { name: '', url: '', type: '' }];
                setAttachmentRows(nextRows);
                onFieldChange('attachments', toAttachmentInputs(nextRows));
              }}
            >
              添加链接
            </button>
            <label className="cursor-pointer h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold shadow flex items-center hover:opacity-90 transition-opacity">
              <span className="sr-only">上传附件</span>
              <span>上传本地文件</span>
              <input
                aria-label="Upload Attachments"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const nextFiles = event.currentTarget.files;

                  if (!nextFiles || nextFiles.length === 0) {
                    return;
                  }

                  const uploadedRows = Array.from(nextFiles).map((file) => ({
                    name: file.name,
                    url: `./attachments/${file.name}`,
                    type: '',
                  }));
                  const nextRows = [...attachmentRows, ...uploadedRows];

                  setAttachmentRows(nextRows);
                  void onUploadAttachmentFiles?.(nextFiles);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {attachmentRows.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground font-semibold">暂无附件</p>
          ) : (
            attachmentRows.map((attachment, index) => (
              <div key={`${card.id}-attachment-${index}`} className="flex flex-col gap-3 p-4 bg-background border rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-black uppercase text-primary">附件 {index + 1}</span>
                  <button
                    type="button"
                    aria-label={`Remove Attachment ${index + 1}`}
                    className="text-xs text-destructive hover:underline font-semibold"
                    onClick={() => {
                      const nextRows = attachmentRows.filter((_, rowIndex) => rowIndex !== index);
                      setAttachmentRows(nextRows);
                      onFieldChange('attachments', toAttachmentInputs(nextRows));
                    }}
                  >
                    删除
                  </button>
                </div>
                
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">名称 (Name)</span>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={`Attachment Name ${index + 1}`}
                    type="text"
                    value={attachment.name}
                    onChange={(event) => {
                      const nextRows = updateAttachmentRows(
                        attachmentRows,
                        index,
                        'name',
                        event.target.value,
                      );
                      setAttachmentRows(nextRows);
                      onFieldChange('attachments', toAttachmentInputs(nextRows));
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">URL 地址</span>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={`Attachment URL ${index + 1}`}
                    type="text"
                    list={availableAttachmentOptions.length > 0 ? attachmentUrlListId : undefined}
                    value={attachment.url}
                    onChange={(event) => {
                      const nextRows = updateAttachmentRows(
                        attachmentRows,
                        index,
                        'url',
                        event.target.value,
                      );
                      setAttachmentRows(nextRows);
                      onFieldChange('attachments', toAttachmentInputs(nextRows));
                    }}
                  />
                </label>

                {availableAttachmentOptions.length > 0 ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground">从已同步附件中选择</span>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={`Attachment Asset ${index + 1}`}
                      value={availableAttachmentOptions.some((option) => option.relativeUrl === attachment.url) ? attachment.url : ''}
                      onChange={(event) => {
                        const selectedOption = availableAttachmentOptions.find((option) => option.relativeUrl === event.target.value);

                        if (!selectedOption) {
                          return;
                        }

                        const nextRows = attachmentRows.map((row, rowIndex) => rowIndex === index
                          ? {
                            ...row,
                            name: row.name.trim() || selectedOption.fileName,
                            url: selectedOption.relativeUrl,
                            type: row.type.trim() || selectedOption.type,
                          }
                          : row);

                        setAttachmentRows(nextRows);
                        onFieldChange('attachments', toAttachmentInputs(nextRows));
                      }}
                    >
                      <option value="">选择一个已同步文件</option>
                      {availableAttachmentOptions.map((option) => (
                        <option key={option.path} value={option.relativeUrl}>
                          {option.relativeUrl}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ))
          )}

          {availableAttachmentOptions.length > 0 ? (
            <datalist id={attachmentUrlListId}>
              {availableAttachmentOptions.map((option) => (
                <option key={option.path} value={option.relativeUrl} />
              ))}
            </datalist>
          ) : null}

          {renderMessages(attachmentMessages(mergedIssues))}
        </div>
      </section>

      <label className="flex flex-col gap-2 mt-4 md:col-span-2">
        <span className="text-xs font-bold text-muted-foreground flex justify-between items-center">
          <span>Markdown 正文内容 (Body)</span>
          <span className="px-2 py-0.5 rounded bg-muted text-[10px]">MD Editor</span>
        </span>
        <div data-color-mode={isDarkMode ? 'dark' : 'light'} className="w-full rounded-md border shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-shadow [&_.w-md-editor]:!border-0 [&_.w-md-editor]:!shadow-none [&_.w-md-editor-toolbar]:!bg-muted/40 [&_.w-md-editor-toolbar]:!border-b [&_.w-md-editor-toolbar]:!border-input">
          <MDEditor
            value={card.bodyMarkdown}
            onChange={(value) => onBodyChange(value ?? '')}
            height={400}
            minHeight={300}
            previewOptions={previewOptions}
            textareaProps={{
              placeholder: '在这里输入 Markdown 内容...',
              'aria-label': 'Markdown Body',
            }}
          />
        </div>
      </label>
    </section>
  );
}

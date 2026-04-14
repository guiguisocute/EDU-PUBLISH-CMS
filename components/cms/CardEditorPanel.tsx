import { useEffect, useMemo, useState } from 'react';
import type {
  CardDocument,
  NoticeAttachment,
  NoticeAttachmentInput,
  ValidationIssue,
} from '../../types/content';

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
      message: 'ID is required.',
    });
  }

  if (!String(card.data.title ?? '').trim()) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'title',
      message: 'Title is required.',
    });
  }

  if (!String(card.data.school_slug ?? '').trim()) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'school_slug',
      message: 'School slug is required.',
    });
  }

  const published = String(card.data.published ?? '').trim();

  if (!isValidDate(published)) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'published',
      message: 'Published must be a valid date.',
    });
  }

  const startAt = String(card.data.start_at ?? '').trim();
  const endAt = String(card.data.end_at ?? '').trim();

  if (startAt && !isValidDate(startAt)) {
    issues.push({
      severity: 'error',
      filePath: card.path,
      fieldPath: 'start_at',
      message: 'Start time must be a valid date.',
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
    <p key={message} className="cms-card-editor__message">
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

  if (!card) {
    return (
      <section className="cms-card-editor cms-card-editor--empty">
        <h2>Card Editor</h2>
        <p>Select a card to start editing.</p>
      </section>
    );
  }

  return (
    <section className="cms-card-editor" aria-label="Card editor panel">
      <header className="cms-card-editor__header">
        <p className="cms-card-editor__eyebrow">Single-layer Card Editor</p>
        <h2>{String(card.data.title ?? '').trim() || card.id || 'Untitled card'}</h2>
        <p className="cms-card-editor__meta">{card.path}</p>
      </header>

      <div className="cms-card-editor__grid">
        <label>
          <span>ID</span>
          <input
            aria-label="ID"
            type="text"
            value={String(card.data.id ?? '')}
            onChange={(event) => onFieldChange('id', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'id'))}
        </label>

        <label>
          <span>School Slug</span>
          <input
            aria-label="School Slug"
            type="text"
            value={String(card.data.school_slug ?? '')}
            onChange={(event) => onFieldChange('school_slug', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'school_slug'))}
        </label>

        <label className="cms-card-editor__field cms-card-editor__field--full">
          <span>Title</span>
          <input
            aria-label="Title"
            type="text"
            value={String(card.data.title ?? '')}
            onChange={(event) => onFieldChange('title', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'title'))}
        </label>

        <label className="cms-card-editor__field cms-card-editor__field--full">
          <span>Description</span>
          <textarea
            aria-label="Description"
            value={String(card.data.description ?? '')}
            onChange={(event) => onFieldChange('description', event.target.value)}
          />
        </label>

        <label>
          <span>Published</span>
          <input
            aria-label="Published"
            type="text"
            value={String(card.data.published ?? '')}
            onChange={(event) => onFieldChange('published', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'published'))}
        </label>

        <label>
          <span>Category</span>
          <input
            aria-label="Category"
            type="text"
            value={String(card.data.category ?? '')}
            onChange={(event) => onFieldChange('category', event.target.value)}
          />
        </label>

        <label className="cms-card-editor__field cms-card-editor__field--full">
          <span>Tags</span>
          <input
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

        <label className="cms-card-editor__checkbox">
          <input
            aria-label="Pinned"
            type="checkbox"
            checked={Boolean(card.data.pinned ?? card.data.pined)}
            onChange={(event) => onFieldChange('pinned', event.target.checked)}
          />
          <span>Pinned</span>
        </label>

        <label>
          <span>Cover</span>
          <input
            aria-label="Cover"
            type="text"
            value={String(card.data.cover ?? '')}
            onChange={(event) => onFieldChange('cover', event.target.value)}
          />
        </label>

        <label>
          <span>Badge</span>
          <input
            aria-label="Badge"
            type="text"
            value={String(card.data.badge ?? '')}
            onChange={(event) => onFieldChange('badge', event.target.value)}
          />
        </label>

        <label>
          <span>Extra URL</span>
          <input
            aria-label="Extra URL"
            type="text"
            value={String(card.data.extra_url ?? '')}
            onChange={(event) => onFieldChange('extra_url', event.target.value)}
          />
        </label>

        <label>
          <span>Start At</span>
          <input
            aria-label="Start At"
            type="text"
            value={String(card.data.start_at ?? '')}
            onChange={(event) => onFieldChange('start_at', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'start_at'))}
        </label>

        <label>
          <span>End At</span>
          <input
            aria-label="End At"
            type="text"
            value={String(card.data.end_at ?? '')}
            onChange={(event) => onFieldChange('end_at', event.target.value)}
          />
          {renderMessages(fieldMessages(mergedIssues, 'end_at'))}
        </label>

        <label>
          <span>Source Channel</span>
          <input
            aria-label="Source Channel"
            type="text"
            value={String(card.data.source?.channel ?? '')}
            onChange={(event) => onFieldChange('source.channel', event.target.value)}
          />
        </label>

        <label>
          <span>Source Sender</span>
          <input
            aria-label="Source Sender"
            type="text"
            value={String(card.data.source?.sender ?? '')}
            onChange={(event) => onFieldChange('source.sender', event.target.value)}
          />
        </label>
      </div>

      <section className="cms-card-editor__attachments">
        <div className="cms-card-editor__section-header">
          <h3>Attachments</h3>
          <button
            type="button"
            onClick={() => {
              const nextRows = [...attachmentRows, { name: '', url: '', type: '' }];
              setAttachmentRows(nextRows);
              onFieldChange('attachments', toAttachmentInputs(nextRows));
            }}
          >
            Add Attachment
          </button>
          <label>
            <span className="sr-only">Upload Attachments</span>
            <input
              aria-label="Upload Attachments"
              type="file"
              multiple
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

        {attachmentRows.length === 0 ? (
          <p className="cms-card-editor__empty-copy">No attachments yet.</p>
        ) : (
          attachmentRows.map((attachment, index) => (
            <div key={`${card.id}-attachment-${index}`} className="cms-card-editor__attachment-row">
              <label>
                <span>Attachment Name {index + 1}</span>
                <input
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

              <label>
                <span>Attachment URL {index + 1}</span>
                <input
                  aria-label={`Attachment URL ${index + 1}`}
                  type="text"
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

              <button
                type="button"
                onClick={() => {
                  const nextRows = attachmentRows.filter((_, rowIndex) => rowIndex !== index);
                  setAttachmentRows(nextRows);
                  onFieldChange('attachments', toAttachmentInputs(nextRows));
                }}
              >
                Remove Attachment {index + 1}
              </button>
            </div>
          ))
        )}

        {renderMessages(attachmentMessages(mergedIssues))}
      </section>

      <label className="cms-card-editor__field cms-card-editor__field--full">
        <span>Markdown Body</span>
        <textarea
          aria-label="Markdown Body"
          value={card.bodyMarkdown}
          onChange={(event) => onBodyChange(event.target.value)}
        />
      </label>
    </section>
  );
}

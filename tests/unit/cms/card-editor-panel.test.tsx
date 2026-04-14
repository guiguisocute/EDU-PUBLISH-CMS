import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseCardDocument } from '../../../lib/content/card-document';
import { CardEditorPanel } from '../../../components/cms/CardEditorPanel';

function createCard(overrides?: { raw?: string }) {
  return parseCardDocument(
    overrides?.raw ?? `---
id: notice-1
school_slug: demo
title: First notice
description: Existing summary
published: 2026-04-14T09:00:00+08:00
category: 通知公告
tags:
  - alpha
pinned: false
source:
  channel: Demo Source
  sender: Teacher A
attachments:
  - name: Existing attachment
    url: ./attachments/existing.pdf
---
原始正文。
`,
    {
      path: 'content/card/demo/notice-1.md',
      sha: 'sha-1',
      dirty: false,
    },
  );
}

describe('CardEditorPanel', () => {
  it('forwards field, nested source, attachment, and body edits', () => {
    const onFieldChange = vi.fn();
    const onBodyChange = vi.fn();

    render(
      <CardEditorPanel
        card={createCard()}
        issues={[]}
        onFieldChange={onFieldChange}
        onBodyChange={onBodyChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Updated title' },
    });
    fireEvent.change(screen.getByLabelText('Source Channel'), {
      target: { value: 'Updated Channel' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Attachment' }));
    fireEvent.change(screen.getByLabelText('Attachment Name 2'), {
      target: { value: '报名表' },
    });
    fireEvent.change(screen.getByLabelText('Attachment URL 2'), {
      target: { value: './attachments/forms/apply.docx' },
    });
    fireEvent.change(screen.getByLabelText('Markdown Body'), {
      target: { value: '替换后的正文。\n' },
    });

    expect(onFieldChange).toHaveBeenCalledWith('title', 'Updated title');
    expect(onFieldChange).toHaveBeenCalledWith('source.channel', 'Updated Channel');
    expect(onFieldChange).toHaveBeenLastCalledWith('attachments', [
      {
        name: 'Existing attachment',
        url: './attachments/existing.pdf',
        type: '',
      },
      {
        name: '报名表',
        url: './attachments/forms/apply.docx',
        type: '',
      },
    ]);
    expect(onBodyChange).toHaveBeenCalledWith('替换后的正文。\n');
  });

  it('shows inline validation for required fields and invalid attachments', () => {
    const invalidCard = createCard({
      raw: `---
id: notice-1
school_slug: demo
title: ''
published: invalid-date
attachments:
  - name: Broken attachment
    url: ''
---
正文。
`,
    });

    render(
      <CardEditorPanel
        card={invalidCard}
        issues={[
          {
            severity: 'error',
            filePath: invalidCard.path,
            fieldPath: 'title',
            message: 'Title must not be empty.',
          },
        ]}
        onFieldChange={() => undefined}
        onBodyChange={() => undefined}
      />,
    );

    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Published must be a valid date.')).toBeInTheDocument();
    expect(screen.getByText('Attachment 1 must include both a name and a URL.')).toBeInTheDocument();
    expect(screen.getByText('Title must not be empty.')).toBeInTheDocument();
  });

  it('renders an empty state when no card is selected', () => {
    render(
      <CardEditorPanel
        card={null}
        issues={[]}
        onFieldChange={() => undefined}
        onBodyChange={() => undefined}
      />,
    );

    expect(screen.getByText('Select a card to start editing.')).toBeInTheDocument();
  });

  it('removes empty attachment validation after deleting the empty row', () => {
    const onFieldChange = vi.fn();

    render(
      <CardEditorPanel
        card={createCard()}
        issues={[]}
        onFieldChange={onFieldChange}
        onBodyChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Attachment' }));

    expect(screen.getByText('Attachment 2 must include both a name and a URL.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Attachment 2' }));

    expect(screen.queryByText('Attachment 2 must include both a name and a URL.')).not.toBeInTheDocument();
    expect(onFieldChange).toHaveBeenLastCalledWith('attachments', [
      {
        name: 'Existing attachment',
        url: './attachments/existing.pdf',
        type: '',
      },
    ]);
  });

  it('uses browser file picking to add attachment rows with generated relative urls', () => {
    const onFieldChange = vi.fn();

    render(
      <CardEditorPanel
        card={createCard()}
        issues={[]}
        onFieldChange={onFieldChange}
        onBodyChange={() => undefined}
        onUploadAttachmentFiles={() => Promise.resolve()}
      />,
    );

    const fileInput = screen.getByLabelText('Upload Attachments');
    const file = new File(['attachment'], 'guide.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    });

    const attachmentsSection = screen.getByRole('heading', { name: 'Attachments' }).closest('section');

    expect(attachmentsSection).not.toBeNull();
    expect(within(attachmentsSection as HTMLElement).getByDisplayValue('guide.pdf')).toBeInTheDocument();
    expect(within(attachmentsSection as HTMLElement).getByDisplayValue('./attachments/guide.pdf')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseCardDocument } from '../../../lib/content/card-document';
import { compileWorkspace } from '../../../lib/content/preview-compiler';
import { PreviewPane } from '../../../components/preview/PreviewPane';
import type { DraftWorkspace } from '../../../types/github';
import type { ValidationIssue } from '../../../types/content';

function createWorkspace(cards: DraftWorkspace['cards']): DraftWorkspace {
  return {
    repo: {
      owner: 'octocat',
      name: 'edu-publish-main',
    },
    branch: 'main',
    baseHeadSha: 'head-sha-main',
    cards,
    readonlyConfig: {
      siteYaml: `site_name: Demo Preview
favicon: /img/logo.svg
default_cover: /img/default-cover.svg
palette:
  preset: blue
`,
      widgetsYaml: `modules:
  dashboard: true
`,
      subscriptionsYaml: `schools:
  - slug: demo
    name: Demo School
    short_name: DEMO
    subscriptions:
      - title: Demo Source
        order: 1
`,
    },
    attachments: [],
  };
}

function createPreviewFixture() {
  const pinnedCard = parseCardDocument(
    `---
id: notice-pinned
school_slug: demo
title: Older pinned notice
description: Summary for the pinned notice
published: 2026-04-14T09:00:00+08:00
category: 通知公告
tags:
  - alpha
pinned: true
source:
  channel: Demo Source
  sender: Teacher A
attachments:
  - name: Existing PDF
    url: ./attachments/existing.pdf
---
Notice body paragraph.

[报名表](./attachments/forms/apply.docx)
`,
    {
      path: 'content/card/demo/notice-pinned.md',
      sha: 'sha-pinned',
      dirty: false,
    },
  );
  const latestCard = parseCardDocument(
    `---
id: notice-latest
school_slug: demo
title: Newer regular notice
description: Summary for the latest notice
published: 2026-04-15T09:00:00+08:00
category: 通知公告
source:
  channel: Demo Source
  sender: Teacher B
---
Second body paragraph.
`,
    {
      path: 'content/card/demo/notice-latest.md',
      sha: 'sha-latest',
      dirty: false,
    },
  );

  return compileWorkspace(createWorkspace([pinnedCard, latestCard]), {
    generatedAt: '2026-04-15T00:00:00.000Z',
  });
}

describe('PreviewPane', () => {
  it('renders grouped feeds and attachment-first detail content', () => {
    const result = createPreviewFixture();

    render(<PreviewPane preview={result.preview} issues={result.issues} />);

    expect(screen.getByRole('heading', { name: 'Live Preview' })).toBeInTheDocument();
    expect(screen.getByText('Demo School')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demo School汇总' })).toBeInTheDocument();

    const articleButtons = screen.getAllByRole('button', { name: /Open notice:/ });

    expect(articleButtons).toHaveLength(2);
    expect(articleButtons[0]).toHaveTextContent('Older pinned notice');
    expect(articleButtons[1]).toHaveTextContent('Newer regular notice');

    fireEvent.click(articleButtons[0]);

    const dialog = screen.getByRole('dialog', { name: 'Older pinned notice' });
    const dialogText = dialog.textContent || '';
    const attachmentSection = within(dialog).getByRole('heading', { name: 'Attachments' }).closest('section');

    expect(within(dialog).getByText('Attachments')).toBeInTheDocument();
    expect(within(dialog).getByText('Existing PDF')).toBeInTheDocument();
    expect(attachmentSection).not.toBeNull();
    expect(within(attachmentSection as HTMLElement).getByText('报名表')).toBeInTheDocument();
    expect(dialogText.indexOf('Existing PDF')).toBeLessThan(dialogText.indexOf('Notice body paragraph.'));
  });

  it('supports previous or next navigation and ESC close without changing the URL', () => {
    const result = createPreviewFixture();
    const initialPathname = window.location.pathname;
    const initialHash = window.location.hash;

    render(<PreviewPane preview={result.preview} issues={result.issues} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open notice: Older pinned notice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next notice' }));

    expect(screen.getByRole('dialog', { name: 'Newer regular notice' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Newer regular notice' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(initialPathname);
    expect(window.location.hash).toBe(initialHash);
  });

  it('shows compile issues when preview data is unavailable', () => {
    const issues: ValidationIssue[] = [
      {
        severity: 'error',
        filePath: 'content/card/demo/broken.md',
        fieldPath: 'title',
        message: 'Title is required.',
      },
    ];

    render(<PreviewPane preview={null} issues={issues} />);

    expect(screen.getByRole('heading', { name: 'Preview unavailable' })).toBeInTheDocument();
    expect(screen.getByText('content/card/demo/broken.md')).toBeInTheDocument();
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
  });
});

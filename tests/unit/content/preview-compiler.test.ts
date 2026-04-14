import { describe, expect, it } from 'vitest';
import { parseCardDocument } from '../../../lib/content/card-document';
import { compileWorkspace } from '../../../lib/content/preview-compiler';
import type { DraftWorkspace } from '../../../types/github';

function createWorkspace(cards: DraftWorkspace['cards']): DraftWorkspace {
  return {
    repo: {
      owner: 'demo',
      name: 'edu-publish',
    },
    branch: 'main',
    baseHeadSha: 'sha-main',
    cards,
    readonlyConfig: {
      siteYaml: `site_name: Demo Preview
favicon: /img/logo.svg
default_cover: /img/default-cover.svg
palette:
  preset: blue
`,
      widgetsYaml: `modules:
  view_counts: true
widgets:
  palette_switcher:
    enabled: true
`,
      subscriptionsYaml: `categories:
  - 通知公告
schools:
  - slug: eng
    name: Engineering School
    short_name: ENG
    icon: /img/eng.svg
    subscriptions:
      - title: Campus Notices
        order: 1
`,
    },
    attachments: [],
  };
}

describe('preview compiler', () => {
  it('compiles cards into preview config, feed entries, and attachment-first article data', () => {
    const pinnedCard = parseCardDocument(
      `---
id: notice-pinned
school_slug: eng
title: Older pinned notice
description: Short summary
published: 2026-04-14T09:00:00+08:00
category: 通知公告
tags:
  - alpha
pinned: true
source:
  channel: Campus Notices
  sender: Teacher A
attachments:
  - name: PDF Guide
    url: ./attachments/guide.pdf
---
正文第一段。

[报名表](./attachments/forms/apply.docx)
`,
      {
        path: 'content/card/eng/notice-pinned.md',
      },
    );
    const latestCard = parseCardDocument(
      `---
id: notice-latest
school_slug: eng
title: Newer regular notice
published: 2026-04-15T09:00:00+08:00
category: 通知公告
source:
  channel: Campus Notices
  sender: Teacher B
---
第二条正文。
`,
      {
        path: 'content/card/eng/notice-latest.md',
      },
    );

    const result = compileWorkspace(createWorkspace([pinnedCard, latestCard]), {
      generatedAt: '2026-04-15T00:00:00.000Z',
    });

    expect(result.issues).toEqual([]);
    expect(result.preview).not.toBeNull();
    expect(result.preview?.siteConfig.site_name).toBe('Demo Preview');
    expect(result.preview?.widgetsConfig.modules.view_counts).toBe(true);
    expect(result.preview?.feedEntries.map((entry) => entry.meta.id)).toEqual([
      'all-schools',
      'school-eng-all',
      'eng-campus-notices',
      'eng-未知来源',
    ]);

    const summaryFeed = result.preview?.feedEntries.find(
      (entry) => entry.meta.id === 'school-eng-all',
    );
    const pinnedArticle = result.preview?.content.notices.find(
      (article) => article.guid === 'notice-pinned',
    );

    expect(summaryFeed?.feed.items.map((article) => article.guid)).toEqual([
      'notice-pinned',
      'notice-latest',
    ]);
    expect(pinnedArticle).toMatchObject({
      schoolSlug: 'eng',
      schoolShortName: 'ENG',
      subscriptionId: 'eng-campus-notices',
      thumbnail: '/img/eng.svg',
      isPlaceholderCover: true,
      showCover: true,
      feedTitle: 'Engineering School',
    });
    expect(pinnedArticle?.attachments).toEqual([
      {
        name: 'PDF Guide',
        url: '/attachments/guide.pdf',
        type: 'pdf',
      },
      {
        name: '报名表',
        url: '/attachments/forms/apply.docx',
        type: 'docx',
      },
    ]);
  });

  it('reports card-level validation issues without dropping the last valid preview data', () => {
    const validCard = parseCardDocument(
      `---
id: notice-valid
school_slug: eng
title: Valid notice
published: 2026-04-14T09:00:00+08:00
category: 通知公告
source:
  channel: Campus Notices
---
正常正文。
`,
      {
        path: 'content/card/eng/notice-valid.md',
      },
    );
    const invalidCard = parseCardDocument(
      `---
id: notice-invalid
school_slug: missing-school
title: Invalid notice
published: 2026-04-14T09:00:00+08:00
category: 通知公告
---
错误正文。
`,
      {
        path: 'content/card/missing/notice-invalid.md',
      },
    );

    const result = compileWorkspace(createWorkspace([validCard, invalidCard]), {
      generatedAt: '2026-04-15T00:00:00.000Z',
    });

    expect(result.preview).not.toBeNull();
    expect(result.preview?.content.notices.map((article) => article.guid)).toEqual([
      'notice-valid',
    ]);
    expect(result.issues).toEqual([
      {
        severity: 'error',
        filePath: 'content/card/missing/notice-invalid.md',
        message: expect.stringContaining('Unknown school_slug'),
      },
    ]);
  });
});

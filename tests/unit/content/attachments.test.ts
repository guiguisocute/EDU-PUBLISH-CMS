import { describe, expect, it } from 'vitest';
import {
  extractInlineAttachments,
  mergeAttachments,
  normalizeAttachments,
} from '../../../lib/content/attachments';

describe('attachment normalization', () => {
  it('normalizes string and object attachments to preview-safe output', () => {
    const normalized = normalizeAttachments(
      [
        './attachments/forms/apply.pdf',
        {
          name: 'Guide',
          url: 'https://example.com/guide.docx?download=1',
        },
      ],
      'content/card/demo.md',
    );

    expect(normalized).toEqual([
      {
        name: 'apply.pdf',
        url: '/attachments/forms/apply.pdf',
        type: 'pdf',
      },
      {
        name: 'Guide',
        url: 'https://example.com/guide.docx?download=1',
        type: 'docx',
      },
    ]);
  });

  it('rejects suspicious attachment paths', () => {
    expect(() =>
      normalizeAttachments(['./attachments/%2e%2e/secrets.txt'], 'content/card/demo.md'),
    ).toThrow(/Path traversal detected|Suspicious path/);
  });
});

describe('inline attachment extraction', () => {
  it('extracts markdown links and images, then deduplicates merged attachments', () => {
    const frontmatterAttachments = normalizeAttachments(
      [{ name: '报名表', url: './attachments/forms/apply.docx' }],
      'content/card/demo.md',
    );
    const inlineAttachments = extractInlineAttachments(
      `
![海报](./attachments/images/poster.png)

[报名表](./attachments/forms/apply.docx)
[外部说明](https://example.com/guide.pdf)
[分享] 群公告链接
`,
      'content/card/demo.md',
    );

    const merged = mergeAttachments(frontmatterAttachments, inlineAttachments);

    expect(merged).toEqual([
      {
        name: '报名表',
        url: '/attachments/forms/apply.docx',
        type: 'docx',
      },
      {
        name: '海报',
        url: '/attachments/images/poster.png',
        type: 'image',
      },
      {
        name: '外部说明',
        url: 'https://example.com/guide.pdf',
        type: 'pdf',
      },
      {
        name: '[分享] 群公告链接',
        url: '#',
        type: 'link',
      },
    ]);
  });

  it('preserves repo-relative inline asset paths outside the attachments folder', () => {
    const inlineAttachments = extractInlineAttachments(
      `
![正文配图](./poster.png)
[共享横幅](../shared/banner.png)
`,
      'content/card/demo/notice.md',
    );

    expect(inlineAttachments).toEqual([
      {
        name: '正文配图',
        url: './poster.png',
        type: 'image',
      },
      {
        name: '共享横幅',
        url: '../shared/banner.png',
        type: 'image',
      },
    ]);
  });
});

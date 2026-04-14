import { describe, expect, it } from 'vitest';
import { parseCardDocument } from '../../../lib/content/card-document';
import { serializeCardDocument } from '../../../lib/content/card-serializer';

const baseDocument = `---
id: demo-1
school_slug: demo-school
custom_flag: keep-me
title: Original title
published: 2026-04-14T09:00:00+08:00
tags:
  - alpha
source:
  channel: Demo Channel
  sender: Demo Sender
attachments:
  - ./attachments/demo.pdf
  - name: External Guide
    url: https://example.com/guide.pdf
---
正文第一段。

- item one
`;

describe('card document parsing and serialization', () => {
  it('preserves unknown fields and frontmatter order when parsing', () => {
    const document = parseCardDocument(baseDocument, {
      path: 'content/card/demo.md',
      sha: 'sha-demo',
    });

    expect(document.id).toBe('demo-1');
    expect(document.data.custom_flag).toBe('keep-me');
    expect(document.keyOrder).toEqual([
      'id',
      'school_slug',
      'custom_flag',
      'title',
      'published',
      'tags',
      'source',
      'attachments',
    ]);
    expect(document.bodyMarkdown).toBe('正文第一段。\n\n- item one\n');
  });

  it('keeps existing frontmatter order stable and appends new keys at the end', () => {
    const document = parseCardDocument(baseDocument);

    const serialized = serializeCardDocument({
      ...document,
      data: {
        ...document.data,
        title: 'Updated title',
        another_field: 'new-field',
      },
    });

    const reparsed = parseCardDocument(serialized);

    expect(reparsed.data.title).toBe('Updated title');
    expect(reparsed.data.custom_flag).toBe('keep-me');
    expect(reparsed.keyOrder).toEqual([
      'id',
      'school_slug',
      'custom_flag',
      'title',
      'published',
      'tags',
      'source',
      'attachments',
      'another_field',
    ]);
  });

  it('round-trips markdown body content without changing it', () => {
    const raw = [
      '---',
      'id: demo-2',
      'school_slug: demo-school',
      'title: Body fidelity',
      'published: 2026-04-14T10:00:00+08:00',
      '---',
      '  第一段缩进。',
      '',
      '[附件](./attachments/file.docx)',
      '',
      '```ts',
      'const value = 1',
      '```',
      '',
    ].join('\n');

    const parsed = parseCardDocument(raw);
    const serialized = serializeCardDocument(parsed);
    const reparsed = parseCardDocument(serialized);

    expect(reparsed.bodyMarkdown).toBe(parsed.bodyMarkdown);
  });
});

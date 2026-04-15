import { describe, expect, it } from 'vitest';
import { isAttachmentPath, selectWorkspaceEntries } from '../../../lib/github/compatibility';

describe('workspace attachment selection', () => {
  it('limits hydrated workspace assets to attachments and static images', () => {
    expect(isAttachmentPath('content/attachments/demo.pdf')).toBe(true);
    expect(isAttachmentPath('img/ai/photo.jpg')).toBe(true);
    expect(isAttachmentPath('public/img/logo.svg')).toBe(true);
    expect(isAttachmentPath('favicon.ico')).toBe(true);

    expect(isAttachmentPath('content/generated/search-index.json')).toBe(false);
    expect(isAttachmentPath('content/card/demo/poster.png')).toBe(false);
    expect(isAttachmentPath('content/card/demo/notice.md')).toBe(false);
  });

  it('filters workspace entries down to cards plus hydratable asset paths', () => {
    const selection = selectWorkspaceEntries([
      { path: 'content/card/demo/notice.md', type: 'blob', sha: 'blob-card' },
      { path: 'content/attachments/demo.pdf', type: 'blob', sha: 'blob-pdf' },
      { path: 'img/ai/photo.jpg', type: 'blob', sha: 'blob-photo' },
      { path: 'public/img/logo.svg', type: 'blob', sha: 'blob-logo' },
      { path: 'favicon.ico', type: 'blob', sha: 'blob-favicon' },
      { path: 'content/generated/search-index.json', type: 'blob', sha: 'blob-index' },
      { path: 'content/card/demo/poster.png', type: 'blob', sha: 'blob-poster' },
      { path: 'config/site.yaml', type: 'blob', sha: 'blob-site' },
      { path: 'config/widgets.yaml', type: 'blob', sha: 'blob-widgets' },
      { path: 'config/subscriptions.yaml', type: 'blob', sha: 'blob-subscriptions' },
    ]);

    expect(selection.cardEntries.map((entry) => entry.path)).toEqual(['content/card/demo/notice.md']);
    expect(selection.attachmentEntries.map((entry) => entry.path)).toEqual([
      'content/attachments/demo.pdf',
      'favicon.ico',
      'img/ai/photo.jpg',
      'public/img/logo.svg',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceAssetCandidatePaths,
  resolveWorkspaceAssetDownloadUrl,
  resolveWorkspaceAssetUrl,
} from '../../../lib/content/workspace-assets';

describe('workspace asset url resolution', () => {
  it('matches root img urls against workspace img and public img blobs', () => {
    expect(
      buildWorkspaceAssetCandidatePaths('/img/ai/photo.jpg', 'content/card/demo/notice.md'),
    ).toEqual([
      'img/ai/photo.jpg',
      'public/img/ai/photo.jpg',
      'content/attachments/ai/photo.jpg',
      'content/attachments/img/ai/photo.jpg',
      'content/attachments/photo.jpg',
    ]);

    expect(
      resolveWorkspaceAssetUrl('/img/ai/photo.jpg', 'content/card/demo/notice.md', {
        attachments: [
          {
            path: 'public/img/ai/photo.jpg',
            sha: 'blob-photo',
            size: 256,
          },
        ],
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
      }),
    ).toBe('/api/workspace/blob?owner=octocat&name=edu-publish-main&sha=blob-photo&path=public%2Fimg%2Fai%2Fphoto.jpg');
  });

  it('ignores query strings and hash fragments when resolving blob-backed assets', () => {
    expect(
      resolveWorkspaceAssetUrl('/img/ai/%E5%AE%A3%E4%BC%A0%E5%9B%BE.jpg?download=1#preview', 'content/card/demo/notice.md', {
        attachments: [
          {
            path: 'img/ai/宣传图.jpg',
            sha: 'blob-poster',
            size: 512,
          },
        ],
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
      }),
    ).toBe('/api/workspace/blob?owner=octocat&name=edu-publish-main&sha=blob-poster&path=img%2Fai%2F%E5%AE%A3%E4%BC%A0%E5%9B%BE.jpg');
  });

  it('falls back to branch path resolution when attachment metadata is missing', () => {
    expect(
      resolveWorkspaceAssetUrl('/img/ai/photo.jpg', 'content/card/demo/notice.md', {
        attachments: [],
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
        branch: 'main',
      }),
    ).toBe('/api/workspace/blob?owner=octocat&name=edu-publish-main&branch=main&candidate=img%2Fai%2Fphoto.jpg&candidate=public%2Fimg%2Fai%2Fphoto.jpg&candidate=content%2Fattachments%2Fai%2Fphoto.jpg&candidate=content%2Fattachments%2Fimg%2Fai%2Fphoto.jpg&candidate=content%2Fattachments%2Fphoto.jpg');
  });

  it('builds explicit download urls for workspace-backed assets', () => {
    expect(
      resolveWorkspaceAssetDownloadUrl('/attachments/guide.pdf', 'content/card/demo/notice.md', {
        attachments: [
          {
            path: 'content/attachments/guide.pdf',
            sha: 'blob-guide',
            size: 1024,
            previewUrl: 'blob:guide-preview',
          },
        ],
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
        branch: 'main',
      }),
    ).toBe('/api/workspace/blob?owner=octocat&name=edu-publish-main&sha=blob-guide&path=content%2Fattachments%2Fguide.pdf&download=1');

    expect(
      resolveWorkspaceAssetDownloadUrl('/img/ai/photo.jpg', 'content/card/demo/notice.md', {
        attachments: [],
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
        branch: 'main',
      }),
    ).toBe('/api/workspace/blob?owner=octocat&name=edu-publish-main&branch=main&candidate=img%2Fai%2Fphoto.jpg&candidate=public%2Fimg%2Fai%2Fphoto.jpg&candidate=content%2Fattachments%2Fai%2Fphoto.jpg&candidate=content%2Fattachments%2Fimg%2Fai%2Fphoto.jpg&candidate=content%2Fattachments%2Fphoto.jpg&download=1');
  });

  it('matches img urls against mirrored attachment subpaths', () => {
    expect(
      resolveWorkspaceAssetUrl('/img/ai/photo.jpg', 'content/card/demo/notice.md', {
        attachments: [
          {
            path: 'content/attachments/ai/photo.jpg',
            sha: 'blob-photo',
            size: 256,
          },
        ],
        repo: {
          owner: 'octocat',
          name: 'edu-publish-main',
        },
      }),
    ).toBe('/api/workspace/blob?owner=octocat&name=edu-publish-main&sha=blob-photo&path=content%2Fattachments%2Fai%2Fphoto.jpg');
  });
});

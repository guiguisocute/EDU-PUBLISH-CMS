import type {
  Article,
  CmsPreviewFeedEntry,
  CmsPreviewModel,
} from '../../types/content';

export interface PreviewFeedItem {
  id: string;
  title: string;
  description: string;
  image: string;
  meta: CmsPreviewFeedEntry['meta'];
  articles: Article[];
}

export interface PreviewFeedGroup {
  id: string;
  title: string;
  feeds: PreviewFeedItem[];
}

export interface AdaptedPreviewModel {
  groups: PreviewFeedGroup[];
  feedMap: Map<string, PreviewFeedItem>;
  initialFeedId: string | null;
}

function toFeedTitle(entry: CmsPreviewFeedEntry): string {
  return String(
    entry.meta.customTitle
    || entry.feed.title
    || entry.meta.sourceChannel
    || entry.meta.id,
  ).trim();
}

export function adaptPreviewModel(preview: CmsPreviewModel): AdaptedPreviewModel {
  const visibleEntries = preview.feedEntries.filter((entry) => !entry.meta.hiddenInSidebar);
  const feedItems = visibleEntries.map((entry) => ({
    id: entry.meta.id,
    title: toFeedTitle(entry),
    description: entry.feed.description,
    image: entry.feed.image,
    meta: entry.meta,
    articles: entry.feed.items,
  } satisfies PreviewFeedItem));
  const groupsByTitle = new Map<string, PreviewFeedGroup>();

  for (const item of feedItems) {
    const groupTitle = String(item.meta.category || 'Other').trim() || 'Other';

    if (!groupsByTitle.has(groupTitle)) {
      groupsByTitle.set(groupTitle, {
        id: groupTitle,
        title: groupTitle,
        feeds: [],
      });
    }

    groupsByTitle.get(groupTitle)?.feeds.push(item);
  }

  const groups = Array.from(groupsByTitle.values());
  const feedMap = new Map(feedItems.map((item) => [item.id, item]));

  return {
    groups,
    feedMap,
    initialFeedId: feedItems[0]?.id || null,
  };
}

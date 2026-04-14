import YAML from 'yaml';
import { extractInlineAttachments, mergeAttachments, normalizeAttachments } from './attachments';
import { normalizeSiteConfig } from './site-config';
import { normalizeSubscriptionsConfig, resolveCardSubscription } from './subscriptions-config';
import { normalizeWidgetsConfig } from './widgets-config';
import type {
  Article,
  CmsPreviewFeedEntry,
  CmsPreviewModel,
  CompiledContent,
  Feed,
  FeedMeta,
  PreviewCompileResult,
  SearchItem,
  SiteConfig,
  ValidationIssue,
} from '../../types/content';
import type { DraftWorkspace } from '../../types/github';

const UNKNOWN_SOURCE = '未知来源';
const UNKNOWN_SCHOOL = 'unknown';

export interface CompileWorkspaceOptions {
  generatedAt?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(input: string): string {
  return escapeHtml(input)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdownToHtml(markdown: string): string {
  const normalized = String(markdown ?? '').trim();

  if (!normalized) {
    return '';
  }

  const codeFencePattern = /```([\s\S]*?)```/g;
  const withCodeBlocks = normalized.replace(codeFencePattern, (_, codeBlock: string) => {
    return `<pre><code>${escapeHtml(String(codeBlock).trim())}</code></pre>`;
  });
  const sections = withCodeBlocks.split(/\n\s*\n/).map((section) => section.trim()).filter(Boolean);

  return sections
    .map((section) => {
      if (/^<pre><code>[\s\S]*<\/code><\/pre>$/.test(section)) {
        return section;
      }

      if (/^-\s+/m.test(section)) {
        const items = section
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.replace(/^-\s+/, ''))
          .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
          .join('');

        return `<ul>${items}</ul>`;
      }

      const headingMatch = section.match(/^(#{1,3})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        return `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`;
      }

      return `<p>${section.split(/\r?\n/).map((line) => renderInlineMarkdown(line)).join('<br/>')}</p>`;
    })
    .join('\n');
}

function markdownToPlainText(markdown: string): string {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/^#+\s+/gm, '')
    .replace(/[>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }

    if (
      normalized === 'false'
      || normalized === '0'
      || normalized === 'no'
      || normalized === ''
    ) {
      return false;
    }
  }

  return fallback;
}

function toIso(value: unknown, fieldName: string): string {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`Missing ${fieldName}`);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${text}`);
  }

  return date.toISOString();
}

function parseYamlFile(raw: string, filePath: string): unknown {
  try {
    return YAML.parse(raw) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parse error';
    throw new Error(`${filePath}: ${message}`);
  }
}

function createIssue(filePath: string, message: string): ValidationIssue {
  return {
    severity: 'error',
    filePath,
    message,
  };
}

function sortArticles(
  articles: Article[],
  isAllSchoolsView: boolean,
): Article[] {
  return articles.slice().sort((left, right) => {
    const leftPinned = isAllSchoolsView
      ? Boolean(left.pinned && left.schoolSlug === UNKNOWN_SCHOOL)
      : Boolean(left.pinned);
    const rightPinned = isAllSchoolsView
      ? Boolean(right.pinned && right.schoolSlug === UNKNOWN_SCHOOL)
      : Boolean(right.pinned);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    const publishedDiff = new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime();

    if (publishedDiff !== 0) {
      return publishedDiff;
    }

    return (right.guid || '').localeCompare(left.guid || '', 'zh-CN');
  });
}

function buildFeedEntries(
  content: CompiledContent,
  siteConfig: SiteConfig,
): CmsPreviewFeedEntry[] {
  const entries = new Map<string, CmsPreviewFeedEntry>();
  const subscriptionMap = new Map(content.subscriptions.map((item) => [item.id, item]));

  entries.set('all-schools', {
    meta: {
      id: 'all-schools',
      category: '全校',
      feedType: 'global',
      customTitle: '全校汇总',
      sourceChannel: '全校汇总',
      hiddenInSidebar: true,
      routeSlug: 'all-schools',
    },
    feed: {
      url: '/',
      title: '全校汇总',
      description: '全校全部通知流',
      image: siteConfig.favicon,
      category: '全校',
      items: [],
    },
  });

  for (const school of content.schools) {
    const overviewId = `school-${school.slug}-all`;
    const summaryTitle = `${school.name}汇总`;

    entries.set(overviewId, {
      meta: {
        id: overviewId,
        category: school.name,
        feedType: 'summary',
        customTitle: summaryTitle,
        schoolSlug: school.slug,
        sourceChannel: summaryTitle,
        routeSlug: school.slug,
      },
      feed: {
        url: `/school/${overviewId}`,
        title: summaryTitle,
        description: `${school.name}全部通知流`,
        image: school.icon || '',
        category: school.name,
        items: [],
      },
    });
  }

  for (const subscription of content.subscriptions.filter((item) => item.enabled)) {
    entries.set(subscription.id, {
      meta: {
        id: subscription.id,
        category: subscription.schoolName,
        feedType: 'source',
        customTitle: subscription.title,
        schoolSlug: subscription.schoolSlug,
        sourceChannel: subscription.title,
        routeSlug: subscription.id,
      },
      feed: {
        url: `/school/${subscription.id}`,
        title: subscription.title,
        description: `${subscription.schoolName} / ${subscription.title}`,
        image: subscription.icon || '',
        category: subscription.schoolName,
        items: [],
      },
    });
  }

  for (const article of content.notices) {
    const subscription = subscriptionMap.get(article.subscriptionId || '');

    if (!subscription || !subscription.enabled) {
      continue;
    }

    const overviewId = `school-${article.schoolSlug}-all`;

    entries.get('all-schools')?.feed.items.push(article);
    entries.get(overviewId)?.feed.items.push(article);
    entries.get(article.subscriptionId || '')?.feed.items.push(article);
  }

  return Array.from(entries.values()).map((entry) => {
    const isAllSchoolsView = entry.meta.id === 'all-schools';
    const sortedItems = sortArticles(entry.feed.items, isAllSchoolsView);

    return {
      meta: {
        ...entry.meta,
        hiddenInSidebar:
          entry.meta.sourceChannel === UNKNOWN_SOURCE && sortedItems.length === 0
            ? true
            : entry.meta.hiddenInSidebar,
      },
      feed: {
        ...entry.feed,
        items: sortedItems,
      },
    };
  });
}

function buildSearchIndex(notices: Article[]): SearchItem[] {
  return notices.map((notice) => ({
    id: notice.guid,
    schoolSlug: notice.schoolSlug || '',
    subscriptionId: notice.subscriptionId,
    title: notice.title,
    description: notice.description,
    contentPlainText: markdownToPlainText(`${notice.title}\n${notice.content}`),
    attachmentText: (notice.attachments || [])
      .map((item) => `${String(item.name || '')} ${String(item.type || '')}`.trim())
      .filter(Boolean)
      .join(' '),
  }));
}

function buildCompiledContent(
  workspace: DraftWorkspace,
  generatedAt: string,
  siteConfig: SiteConfig,
  issues: ValidationIssue[],
): CompiledContent {
  const subscriptionsConfig = normalizeSubscriptionsConfig(
    parseYamlFile(workspace.readonlyConfig.subscriptionsYaml, 'config/subscriptions.yaml'),
    siteConfig,
  );
  const schoolOrderMap = new Map(subscriptionsConfig.schools.map((school, index) => [school.slug, index]));
  const subscriptionOrderMap = new Map(
    subscriptionsConfig.subscriptions.map((subscription, index) => [subscription.id, index]),
  );
  const notices: Article[] = [];

  for (const card of workspace.cards) {
    try {
      const resolution = resolveCardSubscription(card, subscriptionsConfig);
      const published = toIso(card.data.published, 'published');
      const startAt = String(card.data.start_at ?? '').trim()
        ? toIso(card.data.start_at, 'start_at')
        : '';
      const endAt = String(card.data.end_at ?? '').trim()
        ? toIso(card.data.end_at, 'end_at')
        : '';
      const frontmatterAttachments = normalizeAttachments(card.data.attachments, card.path);
      const inlineAttachments = extractInlineAttachments(card.bodyMarkdown, card.path);
      const attachments = mergeAttachments(frontmatterAttachments, inlineAttachments);
      const school = resolution.school;
      const schoolName = String(school?.name || resolution.schoolSlug);
      const cover = String(card.data.cover ?? '').trim();
      const sender = String(card.data.source?.sender ?? '').trim();

      notices.push({
        guid: String(card.data.id || '').trim(),
        schoolSlug: resolution.schoolSlug,
        schoolShortName: String(school?.shortName || schoolName),
        subscriptionId: resolution.subscriptionId,
        title: String(card.data.title ?? '').trim(),
        description: String(card.data.description ?? '').trim()
          || markdownToPlainText(card.bodyMarkdown).slice(0, 180),
        aiCategory: String(card.data.category ?? '未分类').trim() || '未分类',
        tags: Array.isArray(card.data.tags)
          ? card.data.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [],
        pinned: toBoolean(card.data.pinned ?? card.data.pined, false),
        thumbnail: cover || school?.icon || siteConfig.default_cover,
        isPlaceholderCover: !cover,
        showCover: toBoolean(card.data.show_cover, true),
        badge: String(card.data.badge ?? '').trim(),
        link: String(card.data.extra_url ?? '').trim(),
        startAt: startAt || (endAt ? published : ''),
        endAt,
        source: {
          channel: String(card.data.source?.channel ?? '').trim() || UNKNOWN_SOURCE,
          sender,
        },
        attachments,
        pubDate: published,
        author: sender || schoolName,
        feedTitle: schoolName,
        content: renderMarkdownToHtml(card.bodyMarkdown),
        enclosure: { link: '', type: '' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown card compile error';
      issues.push(createIssue(card.path, message));
    }
  }

  notices.sort((left, right) => {
    const schoolDiff = (schoolOrderMap.get(left.schoolSlug || '') ?? 9999)
      - (schoolOrderMap.get(right.schoolSlug || '') ?? 9999);

    if (schoolDiff !== 0) {
      return schoolDiff;
    }

    const subscriptionDiff = (subscriptionOrderMap.get(left.subscriptionId || '') ?? 9999)
      - (subscriptionOrderMap.get(right.subscriptionId || '') ?? 9999);

    if (subscriptionDiff !== 0) {
      return subscriptionDiff;
    }

    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    const publishedDiff = new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime();

    if (publishedDiff !== 0) {
      return publishedDiff;
    }

    return left.guid.localeCompare(right.guid, 'zh-CN');
  });

  return {
    generatedAt,
    totalNotices: notices.length,
    schools: subscriptionsConfig.schools.map((school) => ({
      slug: school.slug,
      name: school.name,
      shortName: school.shortName,
      icon: school.icon || '',
    })),
    subscriptions: subscriptionsConfig.subscriptions.map((subscription) => ({
      id: subscription.id,
      schoolSlug: subscription.schoolSlug,
      schoolName: subscription.schoolName,
      schoolIcon: subscription.schoolIcon,
      title: subscription.title,
      number: subscription.number,
      url: subscription.url,
      icon: subscription.icon,
      enabled: subscription.enabled,
      order: subscription.order,
    })),
    notices,
    conclusionBySchool: Object.fromEntries(
      subscriptionsConfig.schools.map((school) => [
        school.slug,
        {
          defaultMarkdown: '',
          defaultHtml: '<p>暂无总结。</p>\n',
          byDate: {},
        },
      ]),
    ),
  };
}

export function compileWorkspace(
  workspace: DraftWorkspace,
  options: CompileWorkspaceOptions = {},
): PreviewCompileResult {
  const issues: ValidationIssue[] = [];
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  let siteConfig: SiteConfig;

  try {
    siteConfig = normalizeSiteConfig(
      parseYamlFile(workspace.readonlyConfig.siteYaml, 'config/site.yaml'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown site config error';
    return {
      preview: null,
      issues: [createIssue('config/site.yaml', message)],
    };
  }

  let widgetsConfig;

  try {
    widgetsConfig = normalizeWidgetsConfig(
      parseYamlFile(workspace.readonlyConfig.widgetsYaml, 'config/widgets.yaml'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown widgets config error';
    return {
      preview: null,
      issues: [createIssue('config/widgets.yaml', message)],
    };
  }

  let content: CompiledContent;

  try {
    content = buildCompiledContent(workspace, generatedAt, siteConfig, issues);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown subscriptions config error';
    return {
      preview: null,
      issues: [createIssue('config/subscriptions.yaml', message)],
    };
  }

  const feedEntries = buildFeedEntries(content, siteConfig);
  const schoolShortNameMap = Object.fromEntries(
    content.schools.map((school) => [school.slug, school.shortName || school.name]),
  );
  const schoolNameBySlug = Object.fromEntries(
    content.schools.map((school) => [school.slug, school.name]),
  );
  const searchIndex = buildSearchIndex(content.notices);
  const preview: CmsPreviewModel = {
    siteConfig,
    widgetsConfig,
    content,
    feedEntries,
    schoolShortNameMap,
    schoolNameBySlug,
    searchIndex,
  };

  return {
    preview,
    issues,
  };
}

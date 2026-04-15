export interface Enclosure {
  link: string;
  type: string;
}

export interface NoticeAttachment {
  name: string;
  url: string;
  downloadUrl?: string;
  type?: string;
}

export type NoticeAttachmentInput = string | NoticeAttachment;

export interface NoticeSource {
  channel?: string;
  sender?: string;
}

export interface CardFrontmatter {
  id: string;
  school_slug: string;
  title: string;
  description?: string;
  published: string;
  category?: string;
  tags?: string[];
  pinned?: boolean;
  pined?: boolean;
  cover?: string;
  show_cover?: boolean;
  badge?: string;
  extra_url?: string;
  start_at?: string;
  end_at?: string;
  subscription_id?: string;
  source?: NoticeSource;
  attachments?: NoticeAttachmentInput[];
  [key: string]: unknown;
}

export interface CardDocument {
  id: string;
  path: string;
  sha: string;
  raw: string;
  frontmatterText: string;
  bodyMarkdown: string;
  keyOrder: string[];
  data: CardFrontmatter;
  dirty: boolean;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  filePath: string;
  fieldPath?: string;
  message: string;
}

export interface Article {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  schoolSlug?: string;
  schoolShortName?: string;
  thumbnail: string;
  description: string;
  content: string;
  enclosure: Enclosure;
  feedTitle?: string;
  aiCategory?: string;
  tags?: string[];
  attachments?: NoticeAttachment[];
  source?: NoticeSource;
  badge?: string;
  startAt?: string;
  endAt?: string;
  pinned?: boolean;
  isPlaceholderCover?: boolean;
  showCover?: boolean;
  subscriptionId?: string;
}

export interface Feed {
  url: string;
  title: string;
  description: string;
  image: string;
  items: Article[];
  category?: string;
}

export interface FeedMeta {
  id: string;
  category: string;
  feedType: 'global' | 'summary' | 'source';
  customTitle?: string;
  schoolSlug?: string;
  sourceChannel?: string;
  hiddenInSidebar?: boolean;
  routeSlug: string;
}

export interface ConclusionItem {
  defaultMarkdown: string;
  defaultHtml: string;
  byDate: Record<string, { markdown: string; html: string }>;
}

export interface CompiledSchool {
  slug: string;
  name: string;
  shortName?: string;
  icon?: string;
  order?: number;
}

export interface CompiledSubscription {
  id: string;
  schoolSlug: string;
  schoolName: string;
  schoolIcon?: string;
  title: string;
  number?: string;
  url: string;
  icon: string;
  enabled: boolean;
  order: number;
}

export interface CompiledContent {
  generatedAt: string;
  updatedCount?: number;
  previousNoticeCount?: number;
  totalNotices?: number;
  schools: CompiledSchool[];
  subscriptions: CompiledSubscription[];
  notices: Article[];
  conclusionBySchool: Record<string, ConclusionItem>;
}

export interface SearchItem {
  id: string;
  schoolSlug: string;
  subscriptionId?: string;
  title: string;
  description: string;
  contentPlainText: string;
  attachmentText?: string;
}

export type SitePalettePreset = 'red' | 'blue' | 'green' | 'amber' | 'custom';

export interface SitePaletteConfig {
  preset: SitePalettePreset;
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  primary_foreground?: string | null;
  secondary_foreground?: string | null;
  accent_foreground?: string | null;
  dark_primary?: string | null;
  dark_primary_foreground?: string | null;
  dark_secondary?: string | null;
  dark_secondary_foreground?: string | null;
  dark_accent?: string | null;
  dark_accent_foreground?: string | null;
  theme_color_hex?: string | null;
}

export interface SiteComputedConfig {
  theme_color_hex: string;
  primary_hsl: string;
  primary_dark_hsl: string;
  default_hue: number;
}

export interface SiteConfig {
  site_name: string;
  site_short_name: string;
  site_description: string;
  site_url: string;
  default_locale: string;
  organization_name: string;
  organization_type: 'university' | 'college' | 'institute';
  organization_unit_label: string;
  logo_light: string;
  logo_dark: string;
  favicon: string;
  default_cover: string;
  footer: {
    copyright: string;
    links: Array<{ label: string; url: string }>;
  };
  seo: {
    title_template: string;
    default_keywords: string[];
  };
  github_actions_enabled: boolean;
  palette: SitePaletteConfig;
  _computed: SiteComputedConfig;
}

export interface WidgetsConfig {
  modules: {
    dashboard: boolean;
    right_sidebar: boolean;
    search: boolean;
    view_counts: boolean;
    rss_entry: boolean;
    pwa_install: boolean;
    stats_chart: boolean;
    footer_branding: boolean;
    update_health: boolean;
  };
  widgets: {
    calendar: { enabled: boolean; title: string; default_expanded: boolean };
    search: { placeholder: string; show_hit_count: boolean };
    dashboard: { title: string; visible_cards: string[] };
    ai_summary: {
      enabled: boolean;
      title: string;
      empty_text: string;
      default_expanded: boolean;
    };
    time_filter: { default_timed_only: boolean; default_hide_expired: boolean };
    tag_stats: { max_display: number; default_expanded_count: number };
    view_counts: { enabled: boolean; label: string };
    rss_entry: { enabled: boolean; label: string };
    pwa_install: { enabled: boolean; label: string; prompt_text: string };
    palette_switcher?: { enabled: boolean };
  };
}

export interface NormalizedSubscriptionsConfig {
  categories: string[];
  schools: CompiledSchool[];
  subscriptions: CompiledSubscription[];
  schoolMap: Map<string, CompiledSchool>;
  subscriptionMap: Map<string, CompiledSubscription>;
}

export interface CardSubscriptionResolution {
  schoolSlug: string;
  school?: CompiledSchool;
  subscriptionId: string;
  subscription: CompiledSubscription;
  sourceChannel: string;
}

export interface CmsPreviewFeedEntry {
  meta: FeedMeta;
  feed: Feed;
}

export interface CmsPreviewModel {
  siteConfig: SiteConfig;
  widgetsConfig: WidgetsConfig;
  content: CompiledContent;
  feedEntries: CmsPreviewFeedEntry[];
  schoolShortNameMap: Record<string, string>;
  schoolNameBySlug: Record<string, string>;
  searchIndex: SearchItem[];
}

export interface PreviewCompileResult {
  preview: CmsPreviewModel | null;
  issues: ValidationIssue[];
}

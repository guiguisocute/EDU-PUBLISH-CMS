import type { WidgetsConfig } from '../../types/content';

const DEFAULT_WIDGETS_CONFIG: WidgetsConfig = {
  modules: {
    dashboard: true,
    right_sidebar: true,
    search: true,
    view_counts: false,
    rss_entry: true,
    pwa_install: true,
    stats_chart: true,
    footer_branding: true,
    update_health: false,
  },
  widgets: {
    calendar: {
      enabled: true,
      title: '日期筛选',
      default_expanded: true,
    },
    search: {
      placeholder: '搜索通知标题、内容…',
      show_hit_count: true,
    },
    dashboard: {
      title: '数据看板',
      visible_cards: [
        'total_notices',
        'today_notices',
        'active_events',
        'subscription_count',
      ],
    },
    ai_summary: {
      enabled: true,
      title: '今日摘要',
      empty_text: '暂无今日摘要',
      default_expanded: true,
    },
    time_filter: {
      default_timed_only: false,
      default_hide_expired: false,
    },
    tag_stats: {
      max_display: 20,
      default_expanded_count: 10,
    },
    view_counts: {
      enabled: false,
      label: '阅读量',
    },
    rss_entry: {
      enabled: true,
      label: 'RSS 订阅',
    },
    pwa_install: {
      enabled: true,
      label: '安装应用',
      prompt_text: '将本站添加到主屏幕',
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)]),
    ) as T;
  }

  return value;
}

function deepMerge<T>(defaults: T, overrides: unknown): T {
  if (!isRecord(defaults) || !isRecord(overrides)) {
    return cloneValue((overrides === undefined ? defaults : overrides) as T);
  }

  const result: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(defaults), ...Object.keys(overrides)]);

  for (const key of keys) {
    const defaultValue = (defaults as Record<string, unknown>)[key];
    const overrideValue = overrides[key];

    if (overrideValue === undefined) {
      result[key] = cloneValue(defaultValue);
      continue;
    }

    if (isRecord(defaultValue) && isRecord(overrideValue)) {
      result[key] = deepMerge(defaultValue, overrideValue);
      continue;
    }

    result[key] = cloneValue(overrideValue);
  }

  return result as T;
}

export function normalizeWidgetsConfig(input: unknown): WidgetsConfig {
  return deepMerge(DEFAULT_WIDGETS_CONFIG, isRecord(input) ? input : {});
}

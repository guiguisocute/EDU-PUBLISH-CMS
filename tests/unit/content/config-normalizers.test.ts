import { describe, expect, it } from 'vitest';
import { normalizeSiteConfig } from '../../../lib/content/site-config';
import { normalizeSubscriptionsConfig, resolveCardSubscription } from '../../../lib/content/subscriptions-config';
import { normalizeWidgetsConfig } from '../../../lib/content/widgets-config';

describe('site config normalization', () => {
  it('fills default site fields and blue preset computed values', () => {
    const config = normalizeSiteConfig({
      site_name: 'Campus Feed',
    });

    expect(config.site_name).toBe('Campus Feed');
    expect(config.site_short_name).toBe('Campus Feed');
    expect(config.favicon).toBe('/img/logo-light.svg');
    expect(config.default_cover).toBe('/img/default-cover.svg');
    expect(config.palette.preset).toBe('blue');
    expect(config._computed).toEqual({
      theme_color_hex: '#2563eb',
      primary_hsl: '221 83% 53%',
      primary_dark_hsl: '217 91% 60%',
      default_hue: 221,
    });
  });

  it('supports custom palettes with preview-safe fallbacks', () => {
    const config = normalizeSiteConfig({
      palette: {
        preset: 'custom',
        primary: '270 70% 55%',
      },
    });

    expect(config._computed.theme_color_hex).toBe('#2563eb');
    expect(config._computed.primary_hsl).toBe('270 70% 55%');
    expect(config._computed.primary_dark_hsl).toBe('270 70% 55%');
    expect(config._computed.default_hue).toBe(270);
  });
});

describe('widgets config normalization', () => {
  it('deep merges nested overrides and keeps module defaults', () => {
    const config = normalizeWidgetsConfig({
      modules: {
        view_counts: true,
      },
      widgets: {
        dashboard: {
          title: 'Overview',
          visible_cards: ['total_notices'],
        },
        palette_switcher: {
          enabled: true,
        },
      },
    });

    expect(config.modules.dashboard).toBe(true);
    expect(config.modules.view_counts).toBe(true);
    expect(config.widgets.dashboard).toEqual({
      title: 'Overview',
      visible_cards: ['total_notices'],
    });
    expect(config.widgets.search.placeholder).toBe('搜索通知标题、内容…');
    expect(config.widgets.palette_switcher).toEqual({
      enabled: true,
    });
  });
});

describe('subscriptions normalization', () => {
  const subscriptionsConfig = {
    categories: ['通知公告', '竞赛相关'],
    schools: [
      {
        slug: 'beta',
        name: 'Beta School',
        order: 2,
        subscriptions: [{ title: 'General Group', order: 1 }],
      },
      {
        slug: 'alpha',
        name: 'Alpha School',
        short_name: 'Alpha',
        order: 1,
        subscriptions: [
          {
            title: 'Main Channel',
            order: 1,
          },
          {
            title: '待接入 Source',
            order: 3,
          },
        ],
      },
    ],
  };

  it('sorts schools, adds unknown-source subscriptions, and falls back to the site favicon', () => {
    const normalized = normalizeSubscriptionsConfig(subscriptionsConfig, {
      favicon: '/img/fallback.svg',
    });

    expect(normalized.categories).toEqual(['通知公告', '竞赛相关']);
    expect(normalized.schools.map((school) => school.slug)).toEqual(['alpha', 'beta']);
    expect(normalized.schools[0]?.icon).toBe('/img/fallback.svg');
    expect(normalized.subscriptions.map((subscription) => subscription.id)).toEqual([
      'alpha-main-channel',
      'alpha-待接入-source',
      'alpha-未知来源',
      'beta-general-group',
      'beta-未知来源',
    ]);
    expect(normalized.subscriptions[1]?.icon).toBe('/img/subicon/waiting-dots.svg');
  });

  it('maps cards by source channel, then legacy subscription id, then unknown source', () => {
    const normalized = normalizeSubscriptionsConfig(subscriptionsConfig, {
      favicon: '/img/fallback.svg',
    });

    const byChannel = resolveCardSubscription(
      {
        path: 'content/card/alpha/demo.md',
        data: {
          id: 'demo-1',
          school_slug: 'alpha',
          title: 'Demo',
          published: '2026-04-14T09:00:00+08:00',
          source: {
            channel: 'Main Channel',
          },
        },
      },
      normalized,
    );

    const byLegacyId = resolveCardSubscription(
      {
        path: 'content/card/alpha/demo.md',
        data: {
          id: 'demo-2',
          school_slug: 'alpha',
          title: 'Demo',
          published: '2026-04-14T09:00:00+08:00',
          source: {
            channel: 'Missing Channel',
          },
          subscription_id: 'alpha-main-channel',
        },
      },
      normalized,
    );

    const fallback = resolveCardSubscription(
      {
        path: 'content/card/alpha/demo.md',
        data: {
          id: 'demo-3',
          school_slug: 'alpha',
          title: 'Demo',
          published: '2026-04-14T09:00:00+08:00',
        },
      },
      normalized,
    );

    expect(byChannel.subscriptionId).toBe('alpha-main-channel');
    expect(byLegacyId.subscriptionId).toBe('alpha-main-channel');
    expect(fallback.subscriptionId).toBe('alpha-未知来源');
    expect(fallback.sourceChannel).toBe('未知来源');
  });
});

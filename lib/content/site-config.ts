import type {
  SiteComputedConfig,
  SiteConfig,
  SitePaletteConfig,
  SitePalettePreset,
} from '../../types/content';

type ResolvedPalette = {
  primary: string;
  primary_foreground: string;
  secondary: string;
  secondary_foreground: string;
  accent: string;
  accent_foreground: string;
  dark_primary: string;
  dark_primary_foreground: string;
  dark_secondary: string;
  dark_secondary_foreground: string;
  dark_accent: string;
  dark_accent_foreground: string;
  theme_color_hex: string;
};

const PALETTE_PRESETS: Record<Exclude<SitePalettePreset, 'custom'>, ResolvedPalette> = {
  red: {
    primary: '0 74% 43%',
    primary_foreground: '0 0% 100%',
    secondary: '0 30% 96%',
    secondary_foreground: '0 62% 22%',
    accent: '0 30% 96%',
    accent_foreground: '0 62% 22%',
    dark_primary: '0 72% 48%',
    dark_primary_foreground: '0 0% 100%',
    dark_secondary: '0 10% 18%',
    dark_secondary_foreground: '0 0% 92%',
    dark_accent: '0 10% 18%',
    dark_accent_foreground: '0 0% 92%',
    theme_color_hex: '#b72020',
  },
  blue: {
    primary: '221 83% 53%',
    primary_foreground: '210 40% 98%',
    secondary: '210 40% 96%',
    secondary_foreground: '222 47% 11%',
    accent: '210 40% 96%',
    accent_foreground: '222 47% 11%',
    dark_primary: '217 91% 60%',
    dark_primary_foreground: '222 47% 11%',
    dark_secondary: '217 10% 18%',
    dark_secondary_foreground: '210 40% 92%',
    dark_accent: '217 10% 18%',
    dark_accent_foreground: '210 40% 92%',
    theme_color_hex: '#2563eb',
  },
  green: {
    primary: '142 71% 35%',
    primary_foreground: '0 0% 100%',
    secondary: '140 30% 96%',
    secondary_foreground: '142 50% 15%',
    accent: '140 30% 96%',
    accent_foreground: '142 50% 15%',
    dark_primary: '142 71% 45%',
    dark_primary_foreground: '0 0% 100%',
    dark_secondary: '142 10% 18%',
    dark_secondary_foreground: '140 30% 92%',
    dark_accent: '142 10% 18%',
    dark_accent_foreground: '140 30% 92%',
    theme_color_hex: '#16a34a',
  },
  amber: {
    primary: '38 92% 40%',
    primary_foreground: '0 0% 100%',
    secondary: '38 40% 96%',
    secondary_foreground: '38 60% 15%',
    accent: '38 40% 96%',
    accent_foreground: '38 60% 15%',
    dark_primary: '38 92% 50%',
    dark_primary_foreground: '38 80% 10%',
    dark_secondary: '38 10% 18%',
    dark_secondary_foreground: '38 30% 92%',
    dark_accent: '38 10% 18%',
    dark_accent_foreground: '38 30% 92%',
    theme_color_hex: '#d97706',
  },
};

const DEFAULT_SITE_CONFIG: Omit<SiteConfig, '_computed'> = {
  site_name: 'EDU Publish',
  site_short_name: 'EDU Publish',
  site_description: '高校通知聚合站',
  site_url: 'https://example.edu.cn',
  default_locale: 'zh-CN',
  organization_name: '示例大学',
  organization_type: 'university',
  organization_unit_label: '单位',
  logo_light: '/img/logo-light.svg',
  logo_dark: '/img/logo-dark.svg',
  favicon: '/img/logo-light.svg',
  default_cover: '/img/default-cover.svg',
  footer: {
    copyright: '',
    links: [],
  },
  seo: {
    title_template: '{page} - {site_name}',
    default_keywords: [],
  },
  github_actions_enabled: false,
  palette: {
    preset: 'blue',
    primary: null,
    secondary: null,
    accent: null,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
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

function normalizeFooterLinks(value: unknown): SiteConfig['footer']['links'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const label = toText(item.label);
    const url = toText(item.url);

    if (!label || !url) {
      return [];
    }

    return [{ label, url }];
  });
}

function normalizePreset(value: unknown): SitePalettePreset {
  const preset = toText(value, DEFAULT_SITE_CONFIG.palette.preset);

  if (preset === 'red' || preset === 'blue' || preset === 'green' || preset === 'amber' || preset === 'custom') {
    return preset;
  }

  throw new Error(
    `Unknown palette preset "${preset}". Use: red, blue, green, amber, custom.`,
  );
}

function resolvePalette(rawPalette: Record<string, unknown>): {
  palette: SitePaletteConfig;
  computed: SiteComputedConfig;
} {
  const preset = normalizePreset(rawPalette.preset);
  const palette: SitePaletteConfig = {
    preset,
    primary: toText(rawPalette.primary) || null,
    secondary: toText(rawPalette.secondary) || null,
    accent: toText(rawPalette.accent) || null,
    primary_foreground: toText(rawPalette.primary_foreground) || null,
    secondary_foreground: toText(rawPalette.secondary_foreground) || null,
    accent_foreground: toText(rawPalette.accent_foreground) || null,
    dark_primary: toText(rawPalette.dark_primary) || null,
    dark_primary_foreground: toText(rawPalette.dark_primary_foreground) || null,
    dark_secondary: toText(rawPalette.dark_secondary) || null,
    dark_secondary_foreground: toText(rawPalette.dark_secondary_foreground) || null,
    dark_accent: toText(rawPalette.dark_accent) || null,
    dark_accent_foreground: toText(rawPalette.dark_accent_foreground) || null,
    theme_color_hex: toText(rawPalette.theme_color_hex) || null,
  };

  const resolved = preset === 'custom'
    ? resolveCustomPalette(palette)
    : PALETTE_PRESETS[preset];

  return {
    palette,
    computed: {
      theme_color_hex: resolved.theme_color_hex,
      primary_hsl: resolved.primary,
      primary_dark_hsl: resolved.dark_primary,
      default_hue: Number.parseInt(String(resolved.primary).split(' ')[0] || '221', 10),
    },
  };
}

function resolveCustomPalette(palette: SitePaletteConfig): ResolvedPalette {
  if (!palette.primary) {
    throw new Error('palette.preset is "custom" but palette.primary is not set.');
  }

  return {
    primary: palette.primary,
    primary_foreground: palette.primary_foreground || '0 0% 100%',
    secondary: palette.secondary || palette.primary,
    secondary_foreground: palette.secondary_foreground || '0 0% 100%',
    accent: palette.accent || palette.primary,
    accent_foreground: palette.accent_foreground || '0 0% 100%',
    dark_primary: palette.dark_primary || palette.primary,
    dark_primary_foreground: palette.dark_primary_foreground || '0 0% 100%',
    dark_secondary: palette.dark_secondary || palette.secondary || palette.primary,
    dark_secondary_foreground: palette.dark_secondary_foreground || '0 0% 100%',
    dark_accent: palette.dark_accent || palette.accent || palette.primary,
    dark_accent_foreground: palette.dark_accent_foreground || '0 0% 100%',
    theme_color_hex: palette.theme_color_hex || '#2563eb',
  };
}

export function normalizeSiteConfig(input: unknown): SiteConfig {
  const config = isRecord(input) ? input : {};
  const footer = isRecord(config.footer) ? config.footer : {};
  const seo = isRecord(config.seo) ? config.seo : {};
  const rawPalette = isRecord(config.palette) ? config.palette : {};
  const { palette, computed } = resolvePalette(rawPalette);
  const siteName = toText(config.site_name, DEFAULT_SITE_CONFIG.site_name);

  return {
    ...DEFAULT_SITE_CONFIG,
    ...config,
    site_name: siteName,
    site_short_name: toText(config.site_short_name, siteName),
    site_description: toText(config.site_description, DEFAULT_SITE_CONFIG.site_description),
    site_url: toText(config.site_url, DEFAULT_SITE_CONFIG.site_url),
    default_locale: toText(config.default_locale, DEFAULT_SITE_CONFIG.default_locale),
    organization_name: toText(
      config.organization_name,
      DEFAULT_SITE_CONFIG.organization_name,
    ),
    organization_type:
      config.organization_type === 'college'
      || config.organization_type === 'institute'
      || config.organization_type === 'university'
        ? config.organization_type
        : DEFAULT_SITE_CONFIG.organization_type,
    organization_unit_label: toText(
      config.organization_unit_label,
      DEFAULT_SITE_CONFIG.organization_unit_label,
    ),
    logo_light: toText(config.logo_light, DEFAULT_SITE_CONFIG.logo_light),
    logo_dark: toText(config.logo_dark, DEFAULT_SITE_CONFIG.logo_dark),
    favicon: toText(config.favicon, DEFAULT_SITE_CONFIG.favicon),
    default_cover: toText(config.default_cover, DEFAULT_SITE_CONFIG.default_cover),
    footer: {
      copyright: toText(
        footer.copyright,
        DEFAULT_SITE_CONFIG.footer.copyright,
      ),
      links: normalizeFooterLinks(footer.links),
    },
    seo: {
      title_template: toText(
        seo.title_template,
        DEFAULT_SITE_CONFIG.seo.title_template,
      ),
      default_keywords: Array.isArray(seo.default_keywords)
        ? seo.default_keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
        : DEFAULT_SITE_CONFIG.seo.default_keywords,
    },
    github_actions_enabled: toBoolean(
      config.github_actions_enabled,
      DEFAULT_SITE_CONFIG.github_actions_enabled,
    ),
    palette,
    _computed: computed,
  };
}

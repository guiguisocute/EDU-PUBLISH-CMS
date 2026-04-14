import type {
  CardDocument,
  CardSubscriptionResolution,
  CompiledSchool,
  CompiledSubscription,
  NormalizedSubscriptionsConfig,
  SiteConfig,
} from '../../types/content';

const UNKNOWN_SOURCE = '未知来源';
const DEFAULT_GROUP_ICON = '/img/subicon/group-default.svg';
const DEFAULT_WAITING_ICON = '/img/subicon/waiting-dots.svg';

type SchoolWithOrder = CompiledSchool & {
  subscriptions: unknown[];
  order: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRequiredText(
  value: unknown,
  fieldName: string,
): string {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`Missing ${fieldName}`);
  }

  return text;
}

function toOptionalText(value: unknown): string {
  return String(value ?? '').trim();
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function slugifyChannel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeSubscriptionsConfig(
  input: unknown,
  siteConfig: Pick<SiteConfig, 'favicon'> = { favicon: '/img/logo-light.svg' },
): NormalizedSubscriptionsConfig {
  const config = isRecord(input) ? input : {};
  const rawSchools = Array.isArray(config.schools) ? config.schools : null;

  if (!rawSchools || rawSchools.length === 0) {
    throw new Error('config/schools must be a non-empty array');
  }

  const schools = rawSchools.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`school at index ${index} is invalid`);
    }

    const subscriptions = Array.isArray(item.subscriptions)
      ? item.subscriptions
      : null;

    if (!subscriptions || subscriptions.length === 0) {
      throw new Error(`schools[${index}].subscriptions must be a non-empty array`);
    }

    return {
      slug: toRequiredText(item.slug, `schools[${index}].slug`),
      name: toRequiredText(item.name, `schools[${index}].name`),
      shortName: toOptionalText(item.short_name) || undefined,
      icon: toOptionalText(item.icon) || siteConfig.favicon,
      order: toNumber(item.order, index),
      subscriptions,
    } satisfies SchoolWithOrder;
  });

  const schoolSlugSet = new Set<string>();

  for (const school of schools) {
    if (schoolSlugSet.has(school.slug)) {
      throw new Error(`Duplicate school slug in config: ${school.slug}`);
    }

    schoolSlugSet.add(school.slug);
  }

  const subscriptions: CompiledSubscription[] = [];

  for (const school of schools) {
    for (let index = 0; index < school.subscriptions.length; index += 1) {
      const item = school.subscriptions[index];

      if (!isRecord(item)) {
        throw new Error(`schools[${school.slug}].subscriptions[${index}] is invalid`);
      }

      const title = toRequiredText(
        item.title,
        `schools[${school.slug}].subscriptions[${index}].title`,
      );
      const number = toOptionalText(item.number);
      const url = toOptionalText(item.url);
      const suffix = slugifyChannel(url || title);

      if (!suffix) {
        throw new Error(
          `schools[${school.slug}].subscriptions[${index}] has empty slug key`,
        );
      }

      const icon = toOptionalText(item.icon);
      const isWaitingSource = title.includes('待接入');

      subscriptions.push({
        id: `${school.slug}-${suffix}`,
        schoolSlug: school.slug,
        schoolName: school.name,
        schoolIcon: school.icon,
        title,
        number,
        url,
        icon: icon || (isWaitingSource ? DEFAULT_WAITING_ICON : DEFAULT_GROUP_ICON),
        enabled: item.enabled !== false,
        order: toNumber(item.order, index),
      });
    }

    const unknownSourceId = `${school.slug}-${slugifyChannel(UNKNOWN_SOURCE)}`;

    if (!subscriptions.some((item) => item.id === unknownSourceId)) {
      subscriptions.push({
        id: unknownSourceId,
        schoolSlug: school.slug,
        schoolName: school.name,
        schoolIcon: school.icon,
        title: UNKNOWN_SOURCE,
        number: '',
        url: '',
        icon: DEFAULT_GROUP_ICON,
        enabled: true,
        order: 99990,
      });
    }
  }

  const subscriptionIdSet = new Set<string>();

  for (const subscription of subscriptions) {
    if (subscriptionIdSet.has(subscription.id)) {
      throw new Error(`Duplicate subscription id in config: ${subscription.id}`);
    }

    subscriptionIdSet.add(subscription.id);
  }

  schools.sort((left, right) => left.order - right.order || left.slug.localeCompare(right.slug));
  const schoolOrderMap = new Map(schools.map((item, index) => [item.slug, index]));

  subscriptions.sort((left, right) => {
    const schoolDiff =
      (schoolOrderMap.get(left.schoolSlug) ?? 9999)
      - (schoolOrderMap.get(right.schoolSlug) ?? 9999);

    if (schoolDiff !== 0) {
      return schoolDiff;
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.id.localeCompare(right.id, 'zh-CN');
  });

  const compiledSchools = schools.map(({ subscriptions: _subscriptions, ...school }) => school);
  const categories = Array.isArray(config.categories)
    ? config.categories.map((category) => String(category).trim()).filter(Boolean)
    : [];

  return {
    categories,
    schools: compiledSchools,
    subscriptions,
    schoolMap: new Map(compiledSchools.map((school) => [school.slug, school])),
    subscriptionMap: new Map(subscriptions.map((subscription) => [subscription.id, subscription])),
  };
}

export function resolveCardSubscription(
  document: Pick<CardDocument, 'path' | 'data'>,
  config: NormalizedSubscriptionsConfig,
): CardSubscriptionResolution {
  const schoolSlug = toRequiredText(document.data.school_slug, 'school_slug');
  const school = config.schoolMap.get(schoolSlug);

  if (!school) {
    throw new Error(`Unknown school_slug(${schoolSlug}) in ${document.path}`);
  }

  const sourceChannel = toOptionalText(document.data.source?.channel) || UNKNOWN_SOURCE;
  const legacySubscriptionId = toOptionalText(document.data.subscription_id);

  let subscriptionId = `${schoolSlug}-${slugifyChannel(sourceChannel)}`;
  let subscription = subscriptionId
    ? config.subscriptionMap.get(subscriptionId)
    : undefined;

  if (!subscription && legacySubscriptionId) {
    const fallback = config.subscriptionMap.get(legacySubscriptionId);

    if (fallback && fallback.schoolSlug === schoolSlug) {
      subscription = fallback;
      subscriptionId = legacySubscriptionId;
    }
  }

  if (!subscription) {
    subscriptionId = `${schoolSlug}-${slugifyChannel(UNKNOWN_SOURCE)}`;
    subscription = config.subscriptionMap.get(subscriptionId);
  }

  if (!subscription) {
    throw new Error(
      `Invalid source.channel(${sourceChannel}), cannot map to subscription in school_slug(${schoolSlug}) in ${document.path}`,
    );
  }

  if (!subscription.enabled) {
    throw new Error(`source.channel maps to disabled subscription_id: ${subscriptionId}`);
  }

  return {
    schoolSlug,
    school,
    subscriptionId,
    subscription,
    sourceChannel,
  };
}

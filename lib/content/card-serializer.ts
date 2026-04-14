import YAML from 'yaml';
import type { CardDocument, CardFrontmatter } from '../../types/content';

function sanitizeForYaml(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForYaml(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).flatMap(
      ([key, nestedValue]) => {
        const sanitized = sanitizeForYaml(nestedValue);

        return sanitized === undefined ? [] : [[key, sanitized] as const];
      },
    );

    return Object.fromEntries(entries);
  }

  return value;
}

function buildOrderedFrontmatter(
  data: CardFrontmatter,
  keyOrder: string[],
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of keyOrder) {
    if (!(key in data)) {
      continue;
    }

    ordered[key] = data[key];
    seen.add(key);
  }

  for (const [key, value] of Object.entries(data)) {
    if (seen.has(key)) {
      continue;
    }

    ordered[key] = value;
  }

  return ordered;
}

export function serializeCardDocument(
  document: Pick<CardDocument, 'data' | 'bodyMarkdown' | 'keyOrder'>,
): string {
  const sanitized = sanitizeForYaml(document.data) as CardFrontmatter;
  const orderedFrontmatter = buildOrderedFrontmatter(
    sanitized,
    document.keyOrder,
  );
  const frontmatterText = YAML.stringify(orderedFrontmatter).trimEnd();

  if (!frontmatterText) {
    return document.bodyMarkdown;
  }

  return `---\n${frontmatterText}\n---\n${document.bodyMarkdown}`;
}

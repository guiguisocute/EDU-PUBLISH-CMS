import YAML from 'yaml';
import type { CardDocument, CardFrontmatter } from '../../types/content';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/;

function parseFrontmatter(frontmatterText: string): {
  data: CardFrontmatter;
  keyOrder: string[];
} {
  if (!frontmatterText.trim()) {
    return {
      data: {} as CardFrontmatter,
      keyOrder: [],
    };
  }

  const parsed = YAML.parse(frontmatterText);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Card frontmatter must be a YAML object.');
  }

  return {
    data: parsed as CardFrontmatter,
    keyOrder: Object.keys(parsed as Record<string, unknown>),
  };
}

export function extractCardSections(raw: string): {
  frontmatterText: string;
  bodyMarkdown: string;
} {
  const match = raw.match(FRONTMATTER_RE);

  if (!match) {
    return {
      frontmatterText: '',
      bodyMarkdown: raw,
    };
  }

  return {
    frontmatterText: match[1],
    bodyMarkdown: match[2] ?? '',
  };
}

export function parseCardDocument(
  raw: string,
  options: Partial<Pick<CardDocument, 'path' | 'sha' | 'dirty'>> = {},
): CardDocument {
  const { frontmatterText, bodyMarkdown } = extractCardSections(raw);
  const { data, keyOrder } = parseFrontmatter(frontmatterText);
  const id = typeof data.id === 'string' ? data.id : String(data.id ?? '');

  return {
    id,
    path: options.path ?? '',
    sha: options.sha ?? '',
    raw,
    frontmatterText,
    bodyMarkdown,
    keyOrder,
    data,
    dirty: options.dirty ?? false,
  };
}

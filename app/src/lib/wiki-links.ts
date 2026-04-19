const WIKI_PATH_PATTERN =
  /\b(?:wiki\/)?(entities|concepts|summaries|synthesis)\/[A-Za-z0-9._/-]+\.md\b/g;

interface WikiPageRef {
  path: string;
  title: string;
}

export interface WikiPageMention {
  start: number;
  end: number;
  text: string;
  path: string;
}

export function rewriteWikiLinks(text: string, pages: WikiPageRef[]): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, rawLabel: string) => {
    const label = rawLabel.trim();
    const path = resolveWikiTarget(label, pages);
    return path ? `[${label}](wiki:${path})` : label;
  });
}

export function findWikiPageMentions(text: string): WikiPageMention[] {
  return Array.from(text.matchAll(WIKI_PATH_PATTERN), (match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
    path: stripWikiPrefix(match[0]),
  }));
}

function resolveWikiTarget(label: string, pages: WikiPageRef[]): string | null {
  const normalizedLabel = normalize(label);

  for (const page of pages) {
    const pageName = page.path.split("/").at(-1) ?? page.path;
    if (
      normalize(page.title) === normalizedLabel ||
      normalize(page.path) === normalizedLabel ||
      normalize(pageName) === normalizedLabel
    ) {
      return page.path;
    }
  }

  return null;
}

function normalize(value: string): string {
  return stripWikiPrefix(value).replace(/\.md$/i, "").trim().toLowerCase();
}

function stripWikiPrefix(value: string): string {
  return value.startsWith("wiki/") ? value.slice(5) : value;
}

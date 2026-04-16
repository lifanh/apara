import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type PageType = "entity" | "concept" | "summary" | "synthesis";

export interface WikiPage {
  title: string;
  type: PageType;
  sources: string[];
  created: string;
  updated: string;
  links: string[];
  body: string;
}

export function parseFrontmatter(content: string): WikiPage {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("No frontmatter found");
  }
  const meta = parseYaml(match[1]);
  return {
    title: meta.title ?? "",
    type: meta.type ?? "entity",
    sources: meta.sources ?? [],
    created: meta.created ?? "",
    updated: meta.updated ?? "",
    links: meta.links ?? [],
    body: match[2].trim(),
  };
}

export function serializePage(page: WikiPage): string {
  const frontmatter: Record<string, unknown> = {
    title: page.title,
    type: page.type,
    sources: page.sources,
    created: page.created,
    updated: page.updated,
    links: page.links,
  };
  const yaml = stringifyYaml(frontmatter, {
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  }).trim();
  return `---\n${yaml}\n---\n\n${page.body}\n`;
}

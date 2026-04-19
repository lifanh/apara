import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  parseFrontmatter,
  type PageType,
} from "../../extension/src/frontmatter.js";

const WIKI_PAGE_DIRS = ["entities", "concepts", "summaries", "synthesis"] as const;

export interface WikiPageSummary {
  path: string;
  title: string;
  type: PageType;
  sources: string[];
  links: string[];
  created: string;
  updated: string;
}

export interface WikiPageData extends WikiPageSummary {
  body: string;
}

export function listWikiPages(wikiPath: string): WikiPageSummary[] {
  const pages: WikiPageSummary[] = [];

  for (const dirName of WIKI_PAGE_DIRS) {
    const dirPath = join(wikiPath, dirName);
    if (!existsSync(dirPath)) {
      continue;
    }

    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith(".md")) {
        continue;
      }

      const path = `${dirName}/${fileName}`;
      const page = parseFrontmatter(readFileSync(join(dirPath, fileName), "utf-8"));
      pages.push({
        path,
        title: page.title,
        type: page.type,
        sources: page.sources,
        links: page.links,
        created: page.created,
        updated: page.updated,
      });
    }
  }

  return pages.sort((a, b) =>
    a.title.localeCompare(b.title) || a.path.localeCompare(b.path),
  );
}

export function getWikiPageData(wikiPath: string, pagePath: string): WikiPageData | null {
  const fullPath = join(wikiPath, pagePath);
  if (!existsSync(fullPath)) {
    return null;
  }

  const page = parseFrontmatter(readFileSync(fullPath, "utf-8"));
  return {
    path: pagePath,
    title: page.title,
    type: page.type,
    sources: page.sources,
    links: page.links,
    created: page.created,
    updated: page.updated,
    body: page.body,
  };
}

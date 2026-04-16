import { appendFileSync, readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { parseFrontmatter } from "./frontmatter.js";

export function appendToLog(wikiDir: string, action: string, detail: string): void {
  const date = new Date().toISOString().split("T")[0];
  const entry = `\n## [${date}] ${action} | ${detail}\n`;
  appendFileSync(join(wikiDir, "log.md"), entry);
}

export function appendToIndex(
  wikiDir: string,
  pagePath: string,
  title: string,
  type: string
): void {
  const entry = `\n- [${title}](${pagePath}) — _${type}_\n`;
  appendFileSync(join(wikiDir, "index.md"), entry);
}

export function isIngested(wikiDir: string, sourcePath: string): boolean {
  const summariesDir = join(wikiDir, "summaries");
  if (!existsSync(summariesDir)) return false;

  const files = readdirSync(summariesDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const content = readFileSync(join(summariesDir, file), "utf-8");
    try {
      const page = parseFrontmatter(content);
      if (page.sources.includes(sourcePath)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function getUningestedSources(rawDir: string, wikiDir: string): string[] {
  const uningested: string[] = [];

  function walk(dir: string, prefix: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath, relativePath);
      } else if (entry.endsWith(".md")) {
        if (!isIngested(wikiDir, relativePath)) {
          uningested.push(relativePath);
        }
      }
    }
  }

  walk(rawDir, "");
  return uningested;
}

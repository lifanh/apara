import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { parseFrontmatter } from "../../extension/src/frontmatter.js";
import { getUningestedSources } from "../../extension/src/ingest.js";

export interface DashboardData {
  pending: string[];
  activePages: { path: string; title: string; type: string; linkCount: number }[];
  recentActivity: string[];
  stats: { wikiPages: number; sources: number; pendingCount: number };
}

export function getDashboardData(wikiPath: string, rawPath: string): DashboardData {
  const pending = existsSync(rawPath) && existsSync(wikiPath)
    ? getUningestedSources(rawPath, wikiPath)
    : [];

  const activePages = getActivePages(wikiPath);

  const recentActivity = getRecentActivity(wikiPath);

  const sourceCount = existsSync(rawPath) ? countFiles(rawPath) : 0;

  return {
    pending,
    activePages,
    recentActivity,
    stats: {
      wikiPages: activePages.length,
      sources: sourceCount,
      pendingCount: pending.length,
    },
  };
}

function getActivePages(
  wikiPath: string,
): { path: string; title: string; type: string; linkCount: number }[] {
  const pages: { path: string; title: string; type: string; linkCount: number }[] = [];
  const subdirs = ["entities", "concepts", "summaries", "synthesis"];

  for (const subdir of subdirs) {
    const dir = join(wikiPath, subdir);
    if (!existsSync(dir)) continue;

    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const content = readFileSync(join(dir, file), "utf-8");
      try {
        const page = parseFrontmatter(content);
        pages.push({
          path: `${subdir}/${file}`,
          title: page.title,
          type: page.type,
          linkCount: page.links.length,
        });
      } catch {
        continue;
      }
    }
  }

  return pages.sort((a, b) => b.linkCount - a.linkCount);
}

function getRecentActivity(wikiPath: string, count = 10): string[] {
  const logPath = join(wikiPath, "log.md");
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, "utf-8");
  const entries = content.match(/^## \[.+$/gm) ?? [];
  return entries.slice(-count).reverse();
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

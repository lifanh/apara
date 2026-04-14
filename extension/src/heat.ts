import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { type Heat, parseFrontmatter, serializePage } from "./frontmatter.js";

export function calculateHeat(paraSources: string[]): Heat {
  if (paraSources.length === 0) return "cold";

  for (const source of paraSources) {
    if (!source.startsWith("archives/")) {
      return "hot";
    }
  }
  return "cold";
}

export function recalculateAllHeat(wikiDir: string): { path: string; oldHeat: Heat; newHeat: Heat }[] {
  const changes: { path: string; oldHeat: Heat; newHeat: Heat }[] = [];
  const subdirs = ["entities", "concepts", "summaries", "synthesis"];

  for (const subdir of subdirs) {
    const dir = join(wikiDir, subdir);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const page = parseFrontmatter(content);
      const newHeat = calculateHeat(page.para_sources);

      if (page.heat !== newHeat) {
        changes.push({ path: filePath, oldHeat: page.heat, newHeat });
        page.heat = newHeat;
        writeFileSync(filePath, serializePage(page));
      }
    }
  }

  return changes;
}

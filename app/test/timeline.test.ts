import { describe, expect, it } from "vitest";
import {
  filterTimelineEntries,
  parseTimelineEntries,
  resolveTimelineNavigation,
} from "../src/lib/timeline";

describe("timeline utilities", () => {
  it("parses timeline log headings and returns newest entries first", () => {
    const log = `# Log

## [2026-04-10] ingest | books/old.md
## [2026-04-12] lint | 1 structural issue
## [2026-04-12] query | What is TypeScript?
## [2026-04-11] ingest | articles/new.md
`;

    const entries = parseTimelineEntries(log);

    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => `${entry.date}|${entry.action}|${entry.detail}`)).toEqual([
      "2026-04-12|query|What is TypeScript?",
      "2026-04-12|lint|1 structural issue",
      "2026-04-11|ingest|articles/new.md",
      "2026-04-10|ingest|books/old.md",
    ]);
  });

  it("filters entries by action and case-insensitive detail search", () => {
    const entries = parseTimelineEntries(`## [2026-04-12] ingest | books/sample-book.md
## [2026-04-11] query | What is TypeScript?
## [2026-04-10] lint | 0 structural issues`);

    expect(filterTimelineEntries(entries, "ingest", "")).toHaveLength(1);
    expect(filterTimelineEntries(entries, "all", "typescript")).toHaveLength(1);
    expect(filterTimelineEntries(entries, "all", "STRUCTURAL")).toHaveLength(1);
    expect(filterTimelineEntries(entries, "query", "book")).toHaveLength(0);
  });

  it("resolves navigation target from wiki or source references", () => {
    expect(resolveTimelineNavigation("Updated wiki/entities/typescript.md links")).toEqual({
      type: "wiki",
      path: "entities/typescript.md",
    });
    expect(resolveTimelineNavigation("Ingested raw/books/sample-book.md")).toEqual({
      type: "source",
      path: "books/sample-book.md",
    });
    expect(resolveTimelineNavigation("Ingested articles/ai-safety.md")).toEqual({
      type: "source",
      path: "articles/ai-safety.md",
    });
    expect(resolveTimelineNavigation("Ingested books/sample-book.md")).toEqual({
      type: "source",
      path: "books/sample-book.md",
    });
    expect(resolveTimelineNavigation("Node.js runtime notes")).toBeNull();
    expect(resolveTimelineNavigation("Migrated to v2.0")).toBeNull();
    expect(resolveTimelineNavigation("Opened src/index.ts for review")).toBeNull();
    expect(resolveTimelineNavigation("0 structural issues, 2 uningested")).toBeNull();
  });
});

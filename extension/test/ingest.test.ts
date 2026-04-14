import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { appendToLog, appendToIndex, isIngested } from "../src/ingest.js";
import { initRepo } from "../src/repo.js";

describe("ingest helpers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "apara-ingest-"));
    initRepo(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("appendToLog", () => {
    it("appends a timestamped entry to log.md", () => {
      appendToLog(join(tempDir, "wiki"), "ingest", "Test Article");
      const log = readFileSync(join(tempDir, "wiki/log.md"), "utf-8");
      expect(log).toMatch(/## \[\d{4}-\d{2}-\d{2}\] ingest \| Test Article/);
    });
  });

  describe("appendToIndex", () => {
    it("appends a page entry to index.md", () => {
      appendToIndex(join(tempDir, "wiki"), "concepts/ownership.md", "Ownership and Borrowing", "concept");
      const index = readFileSync(join(tempDir, "wiki/index.md"), "utf-8");
      expect(index).toContain("concepts/ownership.md");
      expect(index).toContain("Ownership and Borrowing");
    });
  });

  describe("isIngested", () => {
    it("returns false for a source not in any summary", () => {
      expect(isIngested(join(tempDir, "wiki"), "projects/learn-rust/ch1.md")).toBe(false);
    });

    it("returns true for a source referenced in a summary", () => {
      mkdirSync(join(tempDir, "wiki/summaries"), { recursive: true });
      writeFileSync(
        join(tempDir, "wiki/summaries/ch1.md"),
        '---\ntitle: "Ch1 Summary"\ntype: summary\npara_sources:\n  - projects/learn-rust/ch1.md\nheat: hot\ncreated: 2026-04-10\nupdated: 2026-04-10\nlinks: []\n---\n\nSummary content.\n'
      );
      expect(isIngested(join(tempDir, "wiki"), "projects/learn-rust/ch1.md")).toBe(true);
    });
  });
});

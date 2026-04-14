import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { moveSource, getParaCategory } from "../src/lifecycle.js";
import { initRepo } from "../src/repo.js";

describe("lifecycle", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "apara-lifecycle-"));
    initRepo(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("getParaCategory", () => {
    it("extracts category from path", () => {
      expect(getParaCategory("projects/learn-rust/ch1.md")).toBe("projects");
      expect(getParaCategory("archives/old/doc.md")).toBe("archives");
    });
  });

  describe("moveSource", () => {
    it("moves a source directory between PARA categories", () => {
      const srcDir = join(tempDir, "raw/projects/learn-rust");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "ch1.md"), "content");

      moveSource(join(tempDir, "raw"), "projects/learn-rust", "archives");

      expect(existsSync(join(tempDir, "raw/archives/learn-rust/ch1.md"))).toBe(true);
      expect(existsSync(join(tempDir, "raw/projects/learn-rust"))).toBe(false);
    });
  });
});

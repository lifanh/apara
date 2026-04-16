import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig, initRepo, validateRepo } from "../src/repo.js";

describe("repo", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "apara-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("loadConfig", () => {
    it("returns defaults when no .apara.yaml exists", () => {
      const config = loadConfig(tempDir);
      expect(config.name).toBe("My Brain");
      expect(config.wiki_dir).toBe("wiki");
      expect(config.raw_dir).toBe("raw");
      expect(config.auto_commit).toBe(true);
    });

    it("merges .apara.yaml with defaults", () => {
      writeFileSync(join(tempDir, ".apara.yaml"), 'name: "Test Brain"\nremote: "origin"\n');
      const config = loadConfig(tempDir);
      expect(config.name).toBe("Test Brain");
      expect(config.remote).toBe("origin");
      expect(config.wiki_dir).toBe("wiki");
    });
  });

  describe("initRepo", () => {
    it("creates raw and wiki directory structure", () => {
      initRepo(tempDir);
      expect(existsSync(join(tempDir, "raw"))).toBe(true);
      expect(existsSync(join(tempDir, "wiki/entities"))).toBe(true);
      expect(existsSync(join(tempDir, "wiki/concepts"))).toBe(true);
      expect(existsSync(join(tempDir, "wiki/summaries"))).toBe(true);
      expect(existsSync(join(tempDir, "wiki/synthesis"))).toBe(true);
      expect(existsSync(join(tempDir, "wiki/index.md"))).toBe(true);
      expect(existsSync(join(tempDir, "wiki/log.md"))).toBe(true);
    });
  });

  describe("validateRepo", () => {
    it("reports errors for missing directories", () => {
      const errors = validateRepo(tempDir);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("passes for a valid repo", () => {
      initRepo(tempDir);
      const errors = validateRepo(tempDir);
      expect(errors).toEqual([]);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { loadConfig, initRepo, validateRepo } from "../src/repo.js";

describe("repo", () => {
  let tempDir: string;
  const templatePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "templates",
    "AGENTS.md",
  );

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

    it("creates AGENTS.md from template", () => {
      initRepo(tempDir);
      const expected = readFileSync(templatePath, "utf-8");
      const actual = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");
      expect(actual).toBe(expected);
    });

    it("does not overwrite existing AGENTS.md", () => {
      writeFileSync(join(tempDir, "AGENTS.md"), "# My Custom Conventions\n");
      initRepo(tempDir);
      const content = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");
      expect(content).toBe("# My Custom Conventions\n");
    });
  });

  describe("AGENTS template", () => {
    it("includes all required sections", () => {
      const template = readFileSync(templatePath, "utf-8");
      expect(template).toContain("# APARA Wiki Conventions");
      expect(template).toContain("## Directory Structure");
      expect(template).toContain("## Page Format");
      expect(template).toContain("## Naming Conventions");
      expect(template).toContain("## Cross-Referencing Rules");
      expect(template).toContain("## Ingest Workflow");
      expect(template).toContain("## Handling Contradictions");
    });

    it("documents WikiPage frontmatter fields", () => {
      const template = readFileSync(templatePath, "utf-8");
      expect(template).toContain("title");
      expect(template).toContain("type");
      expect(template).toContain("entity | concept | summary | synthesis");
      expect(template).toContain("sources");
      expect(template).toContain("created");
      expect(template).toContain("updated");
      expect(template).toContain("links");
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

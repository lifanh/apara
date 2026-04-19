import { existsSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { safePath } from "../server/path-utils.js";
import { getSourcePreview, listSources, writeUploadedSource } from "../server/sources.js";

describe("source data", () => {
  let tempDir = "";
  let rawDir = "";

  function setup() {
    tempDir = mkdtempSync(join(tmpdir(), "apara-sources-test-"));
    rawDir = join(tempDir, "raw");
    mkdirSync(join(rawDir, "articles"), { recursive: true });
    mkdirSync(join(rawDir, "books"), { recursive: true });
  }

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
      rawDir = "";
    }
  });

  it("lists files and directories from raw/", () => {
    setup();
    writeFileSync(join(rawDir, "articles", "ai.md"), "# AI");
    writeFileSync(join(rawDir, "books", "notes.txt"), "book notes");

    const entries = listSources(rawDir);
    expect(entries.map((entry) => entry.name)).toEqual([
      "articles",
      "articles/ai.md",
      "books",
      "books/notes.txt",
    ]);

    expect(
      entries.find((entry) => entry.name === "articles/ai.md"),
    ).toMatchObject({ isDirectory: false, size: 4 });
    expect(
      entries.find((entry) => entry.name === "books/notes.txt"),
    ).toMatchObject({ isDirectory: false, size: 10 });
    expect(entries.find((entry) => entry.name === "articles")?.isDirectory).toBe(true);
    expect(entries.find((entry) => entry.name === "books")?.isDirectory).toBe(true);
  });

  it("returns text preview for supported files and metadata for binary files", () => {
    setup();
    const markdownPath = join(rawDir, "articles", "ai.md");
    const binaryPath = join(rawDir, "books", "image.png");
    writeFileSync(markdownPath, "hello world");
    writeFileSync(binaryPath, new Uint8Array([137, 80, 78, 71]));

    expect(getSourcePreview(markdownPath, "articles/ai.md")).toBe("hello world");
    expect(getSourcePreview(binaryPath, "books/image.png")).toEqual({
      name: "books/image.png",
      size: 4,
      type: "binary",
    });
  });

  it("writes uploaded files in target directory with safe path handling", () => {
    setup();
    const relativePath = writeUploadedSource(
      rawDir,
      "articles",
      "../new-source.md",
      new TextEncoder().encode("# New source"),
    );

    expect(relativePath).toBe("articles/new-source.md");
    const fullPath = safePath(rawDir, relativePath);
    expect(fullPath).not.toBeNull();
    expect(existsSync(fullPath!)).toBe(true);
    expect(statSync(fullPath!).isFile()).toBe(true);
  });

  it("rejects upload path traversal", () => {
    setup();
    expect(() =>
      writeUploadedSource(rawDir, "../outside", "evil.md", new TextEncoder().encode("x")),
    ).toThrow("Forbidden");
  });
});

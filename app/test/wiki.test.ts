import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listWikiPages, getWikiPageData } from "../server/wiki.js";
import { findWikiPageMentions, rewriteWikiLinks } from "../src/lib/wiki-links.js";

describe("wiki data", () => {
  let tempDir: string;
  let wikiDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "apara-wiki-test-"));
    wikiDir = join(tempDir, "wiki");

    mkdirSync(join(wikiDir, "entities"), { recursive: true });
    mkdirSync(join(wikiDir, "concepts"), { recursive: true });

    writeFileSync(join(wikiDir, "index.md"), "# Index\n");
    writeFileSync(join(wikiDir, "log.md"), "# Log\n");

    writeFileSync(
      join(wikiDir, "entities", "rust.md"),
      [
        "---",
        'title: "Rust"',
        "type: entity",
        "sources:",
        "  - raw/rust-book/ch1.md",
        "created: 2026-04-12",
        "updated: 2026-04-18",
        "links:",
        "  - concepts/ownership.md",
        "---",
        "",
        "Rust is connected to [[Ownership]] and [[concepts/ownership.md]].",
        "",
      ].join("\n"),
    );

    writeFileSync(
      join(wikiDir, "concepts", "ownership.md"),
      [
        "---",
        'title: "Ownership"',
        "type: concept",
        "sources:",
        "  - raw/rust-book/ch4.md",
        "created: 2026-04-12",
        "updated: 2026-04-17",
        "links:",
        "  - entities/rust.md",
        "---",
        "",
        "Ownership explains how Rust manages memory.",
        "",
      ].join("\n"),
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("lists wiki pages with frontmatter metadata", () => {
    expect(listWikiPages(wikiDir)).toEqual([
      {
        created: "2026-04-12",
        links: ["entities/rust.md"],
        path: "concepts/ownership.md",
        sources: ["raw/rust-book/ch4.md"],
        title: "Ownership",
        type: "concept",
        updated: "2026-04-17",
      },
      {
        created: "2026-04-12",
        links: ["concepts/ownership.md"],
        path: "entities/rust.md",
        sources: ["raw/rust-book/ch1.md"],
        title: "Rust",
        type: "entity",
        updated: "2026-04-18",
      },
    ]);
  });

  it("returns page content and metadata for a single page", () => {
    expect(getWikiPageData(wikiDir, "entities/rust.md")).toEqual({
      body: "Rust is connected to [[Ownership]] and [[concepts/ownership.md]].",
      created: "2026-04-12",
      links: ["concepts/ownership.md"],
      path: "entities/rust.md",
      sources: ["raw/rust-book/ch1.md"],
      title: "Rust",
      type: "entity",
      updated: "2026-04-18",
    });
  });
});

describe("wiki links", () => {
  const pages = [
    { path: "entities/rust.md", title: "Rust" },
    { path: "concepts/ownership.md", title: "Ownership" },
  ];

  it("rewrites bracket wiki links into navigable markdown links", () => {
    expect(
      rewriteWikiLinks(
        "See [[Ownership]] and [[concepts/ownership.md]] and [[missing-page]].",
        pages,
      ),
    ).toBe(
      "See [Ownership](wiki:concepts/ownership.md) and [concepts/ownership.md](wiki:concepts/ownership.md) and missing-page.",
    );
  });

  it("finds wiki page mentions inside chat output", () => {
    expect(
      findWikiPageMentions(
        "Updated wiki/concepts/ownership.md and entities/rust.md in this run.",
      ),
    ).toEqual([
      { end: 34, path: "concepts/ownership.md", start: 8, text: "wiki/concepts/ownership.md" },
      { end: 55, path: "entities/rust.md", start: 39, text: "entities/rust.md" },
    ]);
  });
});

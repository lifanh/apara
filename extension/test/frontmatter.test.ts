import { describe, it, expect } from "vitest";
import { parseFrontmatter, serializePage, WikiPage } from "../src/frontmatter.js";

describe("frontmatter", () => {
  const samplePage = `---
title: "Ownership and Borrowing"
type: concept
para_sources:
  - projects/learn-rust/rust-book-ch1.md
heat: hot
created: 2026-04-10
updated: 2026-04-12
links:
  - entities/rust.md
---

Rust uses ownership and borrowing to manage memory.`;

  describe("parseFrontmatter", () => {
    it("parses YAML frontmatter and body", () => {
      const page = parseFrontmatter(samplePage);
      expect(page.title).toBe("Ownership and Borrowing");
      expect(page.type).toBe("concept");
      expect(page.para_sources).toEqual(["projects/learn-rust/rust-book-ch1.md"]);
      expect(page.heat).toBe("hot");
      expect(page.links).toEqual(["entities/rust.md"]);
      expect(page.body).toContain("Rust uses ownership");
    });
  });

  describe("serializePage", () => {
    it("serializes a WikiPage back to markdown with frontmatter", () => {
      const page: WikiPage = {
        title: "Test Page",
        type: "entity",
        para_sources: ["areas/health/sleep.md"],
        heat: "hot",
        created: "2026-04-10",
        updated: "2026-04-12",
        links: [],
        body: "Some content.",
      };
      const result = serializePage(page);
      expect(result).toContain("---");
      expect(result).toContain('title: "Test Page"');
      expect(result).toContain("Some content.");
    });
  });
});

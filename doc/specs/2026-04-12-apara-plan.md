# APARA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build APARA — an LLM Wiki second brain with a Pi Agent extension (engine) and a TS web app (UI) connected via RPC.

**Architecture:** Pi Agent runs as a subprocess (`pi --mode rpc`) spawned by the web app's server. A custom APARA extension registers three tools (ingest, query, lint) that operate on a git-backed knowledge repo. The web app provides a chat-centric UI with dashboard, wiki browser, source manager, and timeline views.

**Tech Stack:** TypeScript throughout. Pi Agent extension (`@sinclair/typebox` for schemas). Web framework TBD (Astro, Next.js, or SvelteKit). Git repo as data layer. Pi Agent RPC (JSON Lines over stdin/stdout).

## Progress

| Phase | Task | Status | Commit |
|-------|------|--------|--------|
| 1 | Task 1: Initialize Project & Git Repo Structure | ✅ Done | `0ac788b` |
| 1 | Task 2: Wiki Frontmatter Parser & Page Utilities | ✅ Done | `25a327f` |
| 1 | Task 3: Heat Calculation Module | 🗑️ Removed (PARA pivot) | `1b50e91` |
| 1 | Task 4: Git Operations Module | ✅ Done | `6756f7f` |
| 1 | Task 5: Pi Agent Extension Skeleton | ✅ Done | `4b4a8c9` |
| 1 | Task 6: Ingest Tool | ✅ Done | `4b4a8c9` |
| 1 | Task 7: Lifecycle Tool | 🗑️ Removed (PARA pivot) | `c1e5af3` |
| 1 | Task 8: Lint and Query Tools | ✅ Done | `89b1880` |
| 1 | Task 8.5: PARA Removal Refactor | ✅ Done | (no-op, already clean) |
| 2 | Task 9: Pi Agent RPC Client | ✅ Done | `f2c410c` |
| 3 | Task 10: Web App Scaffold | ✅ Done | `52f9d74`..`5a9dfcd` |
| 3 | Task 11: Chat Panel — Pi Agent Integration | ✅ Done | `63362a2`..latest |
| 3 | Task 12: Dashboard View | ✅ Done | latest |
| 3 | Task 13: Wiki Browser View | ✅ Done | `a447cbd` |
| 3 | Task 14: Source Manager View | ✅ Done | `6495e1f` |
| 3 | Task 15: Timeline View | ✅ Done | `3c59068` |
| 4 | Task 16: Chat ↔ Panel Wiring | ✅ Done | `7e0bcab` |
| 4 | Task 17: Git Sync UI | ✅ Done | `95b8255` |
| 4 | Task 18: AGENTS.md Schema File | ✅ Done | `bb44e2e` |
| 5 | Task 19: Chat Markdown Rendering | ✅ Done | `da73a8d` |
| 5 | Task 20: Persistent Named Conversations | ✅ Done | `569e7c1` |

**Current state:** All phases complete. Chat now renders markdown in assistant messages and supports persistent named conversations stored in `.apara/chats/`.

---

## Phase 1: Data Layer & Pi Agent Extension ✅

The foundation — get the knowledge engine working in Pi Agent's terminal before building any UI.

### Task 1: Initialize Project & Git Repo Structure

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `extension/apara.ts`
- Create: `extension/package.json`
- Create: `test/setup.ts`
- Create: `test/repo.test.ts`
- Create: `src/repo.ts`

- [ ] **Step 1: Initialize the monorepo project**

```bash
cd /Users/lifan/dev/ai/apara
npm init -y
```

Update `package.json`:

```json
{
  "name": "apara",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["extension", "app"]
}
```

- [ ] **Step 2: Set up the extension package**

```bash
mkdir -p extension
cd extension
npm init -y
```

Update `extension/package.json`:

```json
{
  "name": "@apara/extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "pi": {
    "extensions": ["./apara.ts"]
  },
  "dependencies": {
    "@sinclair/typebox": "^0.34.0"
  },
  "devDependencies": {
    "@mariozechner/pi-coding-agent": "latest",
    "typescript": "^5.5.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create the repo module with init/validate logic**

Create `extension/src/repo.ts` — handles reading and validating an APARA git repo:

```typescript
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

export interface AparaConfig {
  name: string;
  model?: string;
  wiki_dir: string;
  raw_dir: string;
  auto_commit: boolean;
  remote?: string;
}

const DEFAULT_CONFIG: AparaConfig = {
  name: "My Brain",
  wiki_dir: "wiki",
  raw_dir: "raw",
  auto_commit: true,
};

export function loadConfig(repoRoot: string): AparaConfig {
  const configPath = join(repoRoot, ".apara.yaml");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseYaml(raw);
  return { ...DEFAULT_CONFIG, ...parsed };
}

export function initRepo(repoRoot: string): void {
  const config = loadConfig(repoRoot);
  const rawDir = join(repoRoot, config.raw_dir);
  const wikiDir = join(repoRoot, config.wiki_dir);

  const dirs = [
    join(rawDir, "projects"),
    join(rawDir, "areas"),
    join(rawDir, "resources"),
    join(rawDir, "archives"),
    join(wikiDir, "entities"),
    join(wikiDir, "concepts"),
    join(wikiDir, "summaries"),
    join(wikiDir, "synthesis"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  const indexPath = join(wikiDir, "index.md");
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `# ${config.name} — Wiki Index\n\n_No pages yet._\n`);
  }

  const logPath = join(wikiDir, "log.md");
  if (!existsSync(logPath)) {
    writeFileSync(logPath, `# ${config.name} — Activity Log\n`);
  }
}

export function validateRepo(repoRoot: string): string[] {
  const config = loadConfig(repoRoot);
  const errors: string[] = [];
  const rawDir = join(repoRoot, config.raw_dir);
  const wikiDir = join(repoRoot, config.wiki_dir);

  if (!existsSync(rawDir)) errors.push(`Missing raw directory: ${rawDir}`);
  if (!existsSync(wikiDir)) errors.push(`Missing wiki directory: ${wikiDir}`);
  if (!existsSync(join(wikiDir, "index.md"))) errors.push("Missing wiki/index.md");
  if (!existsSync(join(wikiDir, "log.md"))) errors.push("Missing wiki/log.md");

  return errors;
}
```

- [ ] **Step 4: Write tests for repo module**

Create `extension/test/repo.test.ts`:

```typescript
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
    it("creates PARA and wiki directory structure", () => {
      initRepo(tempDir);
      expect(existsSync(join(tempDir, "raw/projects"))).toBe(true);
      expect(existsSync(join(tempDir, "raw/areas"))).toBe(true);
      expect(existsSync(join(tempDir, "raw/resources"))).toBe(true);
      expect(existsSync(join(tempDir, "raw/archives"))).toBe(true);
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
```

- [ ] **Step 5: Run tests**

```bash
cd extension
npx vitest run test/repo.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json extension/
git commit -m "feat: project init with repo module and tests"
```

---

### Task 2: Wiki Frontmatter Parser & Page Utilities

**Files:**
- Create: `extension/src/frontmatter.ts`
- Create: `extension/test/frontmatter.test.ts`

- [ ] **Step 1: Write tests for frontmatter parsing**

Create `extension/test/frontmatter.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extension
npx vitest run test/frontmatter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement frontmatter module**

Create `extension/src/frontmatter.ts`:

```typescript
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type PageType = "entity" | "concept" | "summary" | "synthesis";
export type Heat = "hot" | "cold";

export interface WikiPage {
  title: string;
  type: PageType;
  para_sources: string[];
  heat: Heat;
  created: string;
  updated: string;
  links: string[];
  body: string;
}

export function parseFrontmatter(content: string): WikiPage {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("No frontmatter found");
  }
  const meta = parseYaml(match[1]);
  return {
    title: meta.title ?? "",
    type: meta.type ?? "entity",
    para_sources: meta.para_sources ?? [],
    heat: meta.heat ?? "hot",
    created: meta.created ?? "",
    updated: meta.updated ?? "",
    links: meta.links ?? [],
    body: match[2].trim(),
  };
}

export function serializePage(page: WikiPage): string {
  const frontmatter: Record<string, unknown> = {
    title: page.title,
    type: page.type,
    para_sources: page.para_sources,
    heat: page.heat,
    created: page.created,
    updated: page.updated,
    links: page.links,
  };
  const yaml = stringifyYaml(frontmatter).trim();
  return `---\n${yaml}\n---\n\n${page.body}\n`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extension
npx vitest run test/frontmatter.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/frontmatter.ts extension/test/frontmatter.test.ts
git commit -m "feat: wiki page frontmatter parser and serializer"
```

---

### Task 3: Heat Calculation Module

**Files:**
- Create: `extension/src/heat.ts`
- Create: `extension/test/heat.test.ts`

- [ ] **Step 1: Write tests for heat calculation**

Create `extension/test/heat.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateHeat, recalculateAllHeat } from "../src/heat.js";

describe("heat", () => {
  describe("calculateHeat", () => {
    it("returns hot when any source is in projects/", () => {
      expect(calculateHeat(["projects/learn-rust/ch1.md"])).toBe("hot");
    });

    it("returns hot when any source is in areas/", () => {
      expect(calculateHeat(["areas/health/sleep.md"])).toBe("hot");
    });

    it("returns cold when all sources are in archives/", () => {
      expect(calculateHeat(["archives/old/doc.md"])).toBe("cold");
    });

    it("returns hot when mixed sources include active ones", () => {
      expect(calculateHeat(["archives/old/doc.md", "projects/new/doc.md"])).toBe("hot");
    });

    it("returns hot for resources/ (reference material is accessible)", () => {
      expect(calculateHeat(["resources/cooking/bread.md"])).toBe("hot");
    });

    it("returns cold for empty sources", () => {
      expect(calculateHeat([])).toBe("cold");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extension
npx vitest run test/heat.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement heat module**

Create `extension/src/heat.ts`:

```typescript
import { readdirSync, readFileSync } from "fs";
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
        const { writeFileSync } = require("fs");
        writeFileSync(filePath, serializePage(page));
      }
    }
  }

  return changes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extension
npx vitest run test/heat.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/heat.ts extension/test/heat.test.ts
git commit -m "feat: heat calculation for wiki pages"
```

---

### Task 4: Git Operations Module

**Files:**
- Create: `extension/src/git.ts`
- Create: `extension/test/git.test.ts`

- [ ] **Step 1: Write tests for git operations**

Create `extension/test/git.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { gitCommit, gitAdd, isGitRepo } from "../src/git.js";

describe("git", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "apara-git-test-"));
    execSync("git init", { cwd: tempDir });
    execSync('git config user.email "test@test.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects a git repo", () => {
    expect(isGitRepo(tempDir)).toBe(true);
  });

  it("detects a non-git directory", () => {
    const nonGit = mkdtempSync(join(tmpdir(), "apara-nogit-"));
    expect(isGitRepo(nonGit)).toBe(false);
    rmSync(nonGit, { recursive: true, force: true });
  });

  it("stages and commits files", () => {
    const file = join(tempDir, "test.md");
    writeFileSync(file, "hello");
    gitAdd(tempDir, ["test.md"]);
    gitCommit(tempDir, "test commit");
    const log = execSync("git log --oneline", { cwd: tempDir, encoding: "utf-8" });
    expect(log).toContain("test commit");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extension
npx vitest run test/git.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement git module**

Create `extension/src/git.ts`:

```typescript
import { execSync } from "child_process";

export function isGitRepo(dir: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd: dir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function gitAdd(repoRoot: string, files: string[]): void {
  for (const file of files) {
    execSync(`git add "${file}"`, { cwd: repoRoot, stdio: "pipe" });
  }
}

export function gitCommit(repoRoot: string, message: string): void {
  execSync(`git commit -m "${message}"`, { cwd: repoRoot, stdio: "pipe" });
}

export function gitStatus(repoRoot: string): string {
  return execSync("git status --porcelain", { cwd: repoRoot, encoding: "utf-8" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extension
npx vitest run test/git.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/git.ts extension/test/git.test.ts
git commit -m "feat: git operations module"
```

---

### Task 5: Pi Agent Extension — Skeleton with Init Command

**Files:**
- Create: `extension/apara.ts`

This registers the extension with Pi Agent and adds an `/apara-init` command.

- [ ] **Step 1: Create the extension entry point**

Create `extension/apara.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { initRepo, validateRepo, loadConfig } from "./src/repo.js";

export default function (pi: ExtensionAPI) {
  // Register /apara-init command
  pi.registerCommand("apara-init", {
    description: "Initialize an APARA knowledge base in the current directory",
    handler: async (_args, ctx) => {
      const cwd = process.cwd();
      initRepo(cwd);
      ctx.ui.notify("APARA knowledge base initialized!", "info");
    },
  });

  // Register /apara-status command
  pi.registerCommand("apara-status", {
    description: "Check the health of the current APARA knowledge base",
    handler: async (_args, ctx) => {
      const cwd = process.cwd();
      const errors = validateRepo(cwd);
      if (errors.length === 0) {
        const config = loadConfig(cwd);
        ctx.ui.notify(`✅ ${config.name} — healthy`, "info");
      } else {
        ctx.ui.notify(`❌ ${errors.length} issues found:\n${errors.join("\n")}`, "warning");
      }
    },
  });
}
```

- [ ] **Step 2: Test manually with Pi Agent**

```bash
cd /path/to/test-repo
pi -e /Users/lifan/dev/ai/apara/extension/apara.ts
# Then type: /apara-init
# Verify directory structure is created
```

- [ ] **Step 3: Commit**

```bash
git add extension/apara.ts
git commit -m "feat: Pi Agent extension skeleton with init and status commands"
```

---

### Task 6: Ingest Tool

**Files:**
- Modify: `extension/apara.ts` — register the ingest tool
- Create: `extension/src/ingest.ts`
- Create: `extension/test/ingest.test.ts`

- [ ] **Step 1: Write tests for ingest helpers**

Create `extension/test/ingest.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extension
npx vitest run test/ingest.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement ingest helpers**

Create `extension/src/ingest.ts`:

```typescript
import { appendFileSync, readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parseFrontmatter } from "./frontmatter.js";

export function appendToLog(wikiDir: string, action: string, detail: string): void {
  const date = new Date().toISOString().split("T")[0];
  const entry = `\n## [${date}] ${action} | ${detail}\n`;
  appendFileSync(join(wikiDir, "log.md"), entry);
}

export function appendToIndex(
  wikiDir: string,
  pagePath: string,
  title: string,
  type: string
): void {
  const entry = `\n- [${title}](${pagePath}) — _${type}_\n`;
  appendFileSync(join(wikiDir, "index.md"), entry);
}

export function isIngested(wikiDir: string, sourcePath: string): boolean {
  const summariesDir = join(wikiDir, "summaries");
  if (!existsSync(summariesDir)) return false;

  const files = readdirSync(summariesDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const content = readFileSync(join(summariesDir, file), "utf-8");
    try {
      const page = parseFrontmatter(content);
      if (page.para_sources.includes(sourcePath)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function getUningestedSources(rawDir: string, wikiDir: string): string[] {
  const uningested: string[] = [];

  function walk(dir: string, prefix: string): void {
    const { readdirSync, statSync } = require("fs");
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath, relativePath);
      } else if (entry.endsWith(".md")) {
        if (!isIngested(wikiDir, relativePath)) {
          uningested.push(relativePath);
        }
      }
    }
  }

  walk(rawDir, "");
  return uningested;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extension
npx vitest run test/ingest.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Register the ingest tool in the extension**

Add to `extension/apara.ts`:

```typescript
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { appendToLog, appendToIndex } from "./src/ingest.js";

// Inside the default export function, add:

pi.registerTool({
  name: "apara_ingest",
  label: "Ingest Source",
  description:
    "Ingest a raw source file into the APARA wiki. Reads the source, creates a summary page, and updates the index and log. The LLM should then update or create relevant entity/concept pages based on the source content.",
  parameters: Type.Object({
    source_path: Type.String({ description: "Path to the source file relative to raw/, e.g. projects/learn-rust/ch1.md" }),
  }),
  async execute(_toolCallId, params) {
    const cwd = process.cwd();
    const config = loadConfig(cwd);
    const rawDir = join(cwd, config.raw_dir);
    const wikiDir = join(cwd, config.wiki_dir);
    const fullPath = join(rawDir, params.source_path);

    if (!existsSync(fullPath)) {
      throw new Error(`Source file not found: ${params.source_path}`);
    }

    const content = readFileSync(fullPath, "utf-8");
    appendToLog(wikiDir, "ingest", params.source_path);

    return {
      content: [
        {
          type: "text" as const,
          text: `Source file read successfully: ${params.source_path}\n\nContent:\n\n${content}\n\nPlease:\n1. Create a summary page at wiki/summaries/${basename(params.source_path)}\n2. Update or create relevant entity/concept pages\n3. Update wiki/index.md with new pages\n4. Commit with message "ingest: ${params.source_path}"`,
        },
      ],
    };
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add extension/src/ingest.ts extension/test/ingest.test.ts extension/apara.ts
git commit -m "feat: ingest tool and helpers"
```

---

### Task 7: Lifecycle Tool

**Files:**
- Create: `extension/src/lifecycle.ts`
- Create: `extension/test/lifecycle.test.ts`
- Modify: `extension/apara.ts` — register lifecycle tool

- [ ] **Step 1: Write tests for lifecycle operations**

Create `extension/test/lifecycle.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd extension
npx vitest run test/lifecycle.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement lifecycle module**

Create `extension/src/lifecycle.ts`:

```typescript
import { renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export type ParaCategory = "projects" | "areas" | "resources" | "archives";

export function getParaCategory(sourcePath: string): string {
  return sourcePath.split("/")[0];
}

export function moveSource(
  rawDir: string,
  sourcePath: string,
  targetCategory: ParaCategory
): { oldPath: string; newPath: string } {
  const parts = sourcePath.split("/");
  const itemPath = parts.slice(1).join("/");
  const oldFull = join(rawDir, sourcePath);
  const newRelative = `${targetCategory}/${itemPath}`;
  const newFull = join(rawDir, newRelative);

  if (!existsSync(oldFull)) {
    throw new Error(`Source not found: ${sourcePath}`);
  }

  mkdirSync(dirname(newFull), { recursive: true });
  renameSync(oldFull, newFull);

  return { oldPath: sourcePath, newPath: newRelative };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd extension
npx vitest run test/lifecycle.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Register lifecycle tool in extension**

Add to `extension/apara.ts`:

```typescript
import { moveSource } from "./src/lifecycle.js";
import { recalculateAllHeat } from "./src/heat.js";
import { StringEnum } from "@mariozechner/pi-ai";

// Inside the default export function:

pi.registerTool({
  name: "apara_lifecycle",
  label: "PARA Lifecycle",
  description:
    "Move a source between PARA categories (projects, areas, resources, archives). Recalculates heat on affected wiki pages.",
  parameters: Type.Object({
    source_path: Type.String({ description: "Current path relative to raw/, e.g. projects/learn-rust" }),
    target_category: StringEnum(["projects", "areas", "resources", "archives"] as const),
  }),
  async execute(_toolCallId, params) {
    const cwd = process.cwd();
    const config = loadConfig(cwd);
    const rawDir = join(cwd, config.raw_dir);
    const wikiDir = join(cwd, config.wiki_dir);

    const { oldPath, newPath } = moveSource(rawDir, params.source_path, params.target_category as any);
    const heatChanges = recalculateAllHeat(wikiDir);
    appendToLog(wikiDir, "lifecycle", `${oldPath} → ${newPath}`);

    let summary = `Moved ${oldPath} → ${newPath}`;
    if (heatChanges.length > 0) {
      summary += `\n\nHeat changes:\n${heatChanges.map((c) => `  ${c.path}: ${c.oldHeat} → ${c.newHeat}`).join("\n")}`;
    }

    return {
      content: [{ type: "text" as const, text: summary }],
    };
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add extension/src/lifecycle.ts extension/test/lifecycle.test.ts extension/apara.ts
git commit -m "feat: lifecycle tool for PARA category transitions"
```

---

### Task 8: Lint and Query Tools

**Files:**
- Modify: `extension/apara.ts` — register lint and query tools

- [ ] **Step 1: Register lint tool in extension**

Add to `extension/apara.ts`:

```typescript
import { getUningestedSources } from "./src/ingest.js";

pi.registerTool({
  name: "apara_lint",
  label: "Wiki Lint",
  description:
    "Health-check the APARA wiki. Finds: uningested sources, orphan pages, missing cross-references, and stale pages.",
  parameters: Type.Object({}),
  async execute() {
    const cwd = process.cwd();
    const config = loadConfig(cwd);
    const rawDir = join(cwd, config.raw_dir);
    const wikiDir = join(cwd, config.wiki_dir);

    const uningested = getUningestedSources(rawDir, wikiDir);
    const errors = validateRepo(cwd);

    let report = "## Wiki Health Report\n\n";

    if (errors.length > 0) {
      report += `### Structural Issues\n${errors.map((e) => `- ❌ ${e}`).join("\n")}\n\n`;
    }

    if (uningested.length > 0) {
      report += `### Uningested Sources (${uningested.length})\n${uningested.map((s) => `- 📄 ${s}`).join("\n")}\n\n`;
    }

    report += "Please also check for:\n- Contradictions between pages\n- Orphan pages with no inbound links\n- Concepts mentioned but lacking their own page\n- Broken [[wiki-links]]";

    appendToLog(wikiDir, "lint", `${errors.length} structural issues, ${uningested.length} uningested`);

    return {
      content: [{ type: "text" as const, text: report }],
    };
  },
});
```

- [ ] **Step 2: Register query tool in extension**

Add to `extension/apara.ts`:

```typescript
pi.registerTool({
  name: "apara_query",
  label: "Wiki Query",
  description:
    "Query the APARA wiki. Reads the wiki index to find relevant pages, then reads those pages to answer the question. Prioritizes hot pages over cold ones.",
  parameters: Type.Object({
    question: Type.String({ description: "The question to answer" }),
  }),
  async execute(_toolCallId, params) {
    const cwd = process.cwd();
    const config = loadConfig(cwd);
    const wikiDir = join(cwd, config.wiki_dir);
    const indexPath = join(wikiDir, "index.md");

    let indexContent = "";
    if (existsSync(indexPath)) {
      indexContent = readFileSync(indexPath, "utf-8");
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Question: ${params.question}\n\nWiki Index:\n\n${indexContent}\n\nPlease:\n1. Identify relevant wiki pages from the index\n2. Read those pages (prioritize hot pages)\n3. Synthesize an answer with citations\n4. If the answer is valuable, offer to save it as a wiki/synthesis/ page`,
        },
      ],
    };
  },
});
```

- [ ] **Step 3: Test manually with Pi Agent**

```bash
cd /path/to/test-repo
pi -e /Users/lifan/dev/ai/apara/extension/apara.ts
# /apara-init
# Then try querying and linting
```

- [ ] **Step 4: Commit**

```bash
git add extension/apara.ts
git commit -m "feat: lint and query tools"
```

---

### Task 8.5: PARA Removal Refactor

Remove all PARA-specific code (heat, lifecycle, PARA categories) and simplify to the plain LLM Wiki pattern.

**Files:**
- Delete: `extension/src/lifecycle.ts`, `extension/test/lifecycle.test.ts`
- Delete: `extension/src/heat.ts`, `extension/test/heat.test.ts`
- Modify: `extension/src/frontmatter.ts` — remove `Heat` type, `heat` field; rename `para_sources` → `sources`
- Modify: `extension/test/frontmatter.test.ts` — update to match simplified frontmatter
- Modify: `extension/src/repo.ts` — `initRepo()` creates `raw/` (no PARA subdirs)
- Modify: `extension/test/repo.test.ts` — remove PARA subdir assertions
- Modify: `extension/apara.ts` — remove lifecycle tool, remove heat/lifecycle imports

- [ ] **Step 1: Delete PARA-only modules**

```bash
rm extension/src/lifecycle.ts extension/test/lifecycle.test.ts
rm extension/src/heat.ts extension/test/heat.test.ts
```

- [ ] **Step 2: Simplify frontmatter.ts**

Remove `Heat` type and `heat` field from `WikiPage`. Rename `para_sources` to `sources`.

```typescript
export type PageType = "entity" | "concept" | "summary" | "synthesis";

export interface WikiPage {
  title: string;
  type: PageType;
  sources: string[];       // was para_sources
  created: string;
  updated: string;
  links: string[];
  body: string;
}
```

Update `parseFrontmatter` and `serializePage` to match.

- [ ] **Step 3: Update frontmatter.test.ts**

Remove heat assertions, update `para_sources` → `sources` in test data.

- [ ] **Step 4: Simplify repo.ts initRepo()**

Remove PARA subdirectories. `initRepo()` should create:
- `raw/` (single directory, no prescribed structure)
- `wiki/entities/`, `wiki/concepts/`, `wiki/summaries/`, `wiki/synthesis/`
- `wiki/index.md`, `wiki/log.md`

- [ ] **Step 5: Update repo.test.ts**

Remove assertions for `raw/projects`, `raw/areas`, `raw/resources`, `raw/archives`.
Add assertion for `raw/` existing.

- [ ] **Step 6: Remove lifecycle tool from apara.ts**

- Remove `import { moveSource } from "./src/lifecycle.js"`
- Remove `import { recalculateAllHeat } from "./src/heat.js"`
- Delete the entire `apara_lifecycle` tool registration block
- Remove heat recalculation from any remaining tools

- [ ] **Step 7: Run tests and fix any failures**

```bash
cd extension && npx vitest run
```

All remaining tests (repo, frontmatter, ingest, git) should pass.

- [ ] **Step 8: Commit**

```bash
git add -A extension/src/ extension/test/ extension/apara.ts
git commit -m "refactor: remove PARA, simplify to LLM Wiki pattern"
```

---

## Phase 2: RPC Client Library

Bridge between the web app and Pi Agent subprocess.

### Task 9: Pi Agent RPC Client

**Files:**
- Create: `app/src/lib/rpc-client.ts`
- Create: `app/src/lib/rpc-types.ts`
- Create: `app/test/rpc-client.test.ts`

- [ ] **Step 1: Define RPC types**

Create `app/src/lib/rpc-types.ts`:

```typescript
// Commands sent to Pi Agent stdin
export interface RpcPromptCommand {
  id?: string;
  type: "prompt";
  message: string;
  streamingBehavior?: "steer" | "followUp";
}

export interface RpcAbortCommand {
  type: "abort";
}

export interface RpcGetMessagesCommand {
  id?: string;
  type: "get_messages";
}

export type RpcCommand = RpcPromptCommand | RpcAbortCommand | RpcGetMessagesCommand;

// Events received from Pi Agent stdout
export interface RpcResponse {
  id?: string;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
}

export interface RpcTextDelta {
  type: "text_delta";
  contentIndex: number;
  delta: string;
}

export interface RpcMessageUpdateEvent {
  type: "message_update";
  message: unknown;
  assistantMessageEvent: RpcTextDelta | { type: string; [key: string]: unknown };
}

export interface RpcAgentEndEvent {
  type: "agent_end";
  messages: unknown[];
}

export interface RpcMessageEvent {
  type: "message_start" | "message_end";
  message: unknown;
}

export interface RpcExtensionUiRequest {
  type: "extension_ui_request";
  id: string;
  method: string;
  [key: string]: unknown;
}

export type RpcEvent =
  | RpcResponse
  | RpcMessageUpdateEvent
  | RpcAgentEndEvent
  | RpcMessageEvent
  | RpcExtensionUiRequest
  | { type: string; [key: string]: unknown };
```

- [ ] **Step 2: Implement the RPC client**

Create `app/src/lib/rpc-client.ts`:

```typescript
import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import type { RpcCommand, RpcEvent } from "./rpc-types.js";

export class PiRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";

  constructor(
    private options: {
      cwd: string;
      extensionPath?: string;
      model?: string;
    }
  ) {
    super();
  }

  start(): void {
    const args = ["--mode", "rpc", "--no-session"];
    if (this.options.extensionPath) {
      args.push("-e", this.options.extensionPath);
    }
    if (this.options.model) {
      args.push("--model", this.options.model);
    }

    this.process = spawn("pi", args, {
      cwd: this.options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf-8");

      while (true) {
        const newlineIndex = this.buffer.indexOf("\n");
        if (newlineIndex === -1) break;

        let line = this.buffer.slice(0, newlineIndex);
        this.buffer = this.buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line.length === 0) continue;

        try {
          const event: RpcEvent = JSON.parse(line);
          this.emit("event", event);
          this.emit(event.type, event);
        } catch {
          // skip non-JSON lines
        }
      }
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      this.emit("stderr", chunk.toString("utf-8"));
    });

    this.process.on("exit", (code) => {
      this.emit("exit", code);
      this.process = null;
    });
  }

  send(command: RpcCommand): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("Pi Agent process not running");
    }
    this.process.stdin.write(JSON.stringify(command) + "\n");
  }

  async prompt(message: string): Promise<void> {
    this.send({ type: "prompt", message });
  }

  abort(): void {
    this.send({ type: "abort" });
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
```

- [ ] **Step 3: Write basic tests**

Create `app/test/rpc-client.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PiRpcClient } from "../src/lib/rpc-client.js";

describe("PiRpcClient", () => {
  it("can be instantiated with options", () => {
    const client = new PiRpcClient({
      cwd: "/tmp",
      extensionPath: "/path/to/ext.ts",
      model: "claude-sonnet-4-20250514",
    });
    expect(client).toBeDefined();
    expect(client.isRunning).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd app
npx vitest run test/rpc-client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/rpc-types.ts app/src/lib/rpc-client.ts app/test/rpc-client.test.ts
git commit -m "feat: Pi Agent RPC client library"
```

---

## Phase 3: Web App Shell

### Task 10: Web App Scaffold

**Files:**
- Create: `app/package.json`
- Create: `app/src/` structure (framework-dependent)

This task is intentionally framework-agnostic. The implementer should:

- [ ] **Step 1: Choose and scaffold the web framework**

Pick one of: Astro, Next.js, or SvelteKit. Initialize in the `app/` directory.

```bash
cd app
# Example for Astro:
npm create astro@latest . -- --template minimal
# Example for Next.js:
npx create-next-app@latest . --typescript --app
# Example for SvelteKit:
npx sv create .
```

- [ ] **Step 2: Set up the two-panel layout shell**

Create the base layout with:
- Left panel (content area) — empty placeholder, will hold tabs
- Right panel (chat) — empty placeholder with fixed width
- Tab bar in the left panel: Dashboard, Wiki, Sources, Timeline

The exact file paths depend on the framework chosen. Use the framework's layout system.

- [ ] **Step 3: Verify the app starts**

```bash
cd app
npm run dev
# Open http://localhost:3000 (or whatever port)
# Should see the two-panel layout with tab bar
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: web app scaffold with two-panel layout"
```

---

### Task 11: Chat Panel — Pi Agent Integration

**Files:**
- Create: `app/src/components/ChatPanel.tsx` (or `.svelte`/`.astro`)
- Create: `app/src/lib/chat-store.ts` (or framework equivalent)
- Modify: `app/src/` server route to spawn Pi Agent

- [ ] **Step 1: Create server-side Pi Agent manager**

Create a server route/API endpoint that:
- Spawns `pi --mode rpc --no-session -e <extension-path>` as a subprocess
- Exposes WebSocket or SSE endpoint for the frontend to receive streamed events
- Accepts POST requests with user messages to forward to Pi Agent stdin

The exact implementation depends on the framework. Key integration:

```typescript
import { PiRpcClient } from "../lib/rpc-client.js";

const client = new PiRpcClient({
  cwd: "/path/to/knowledge-repo", // from .apara.yaml or config
  extensionPath: "/path/to/extension/apara.ts",
});

client.start();

// Forward events to frontend via WebSocket/SSE
client.on("event", (event) => {
  // send to connected frontend clients
});

// Handle messages from frontend
function handleUserMessage(message: string) {
  client.prompt(message);
}
```

- [ ] **Step 2: Create ChatPanel component**

Build a chat UI component with:
- Message list (user messages + assistant responses)
- Input field at the bottom
- Streaming text display (accumulate `text_delta` events)
- "Save to wiki" button on assistant responses

- [ ] **Step 3: Verify chat works end-to-end**

```bash
cd app
npm run dev
# Open the app, type a message in chat
# Verify Pi Agent responds via RPC
# Verify streaming text appears
```

- [ ] **Step 4: Commit**

```bash
git add app/src/
git commit -m "feat: chat panel with Pi Agent RPC integration"
```

---

### Task 12: Dashboard View

**Files:**
- Create: `app/src/components/Dashboard.tsx`
- Create: `app/src/lib/repo-reader.ts`

- [ ] **Step 1: Create repo reader module**

`app/src/lib/repo-reader.ts` — reads the git repo to populate dashboard data:

```typescript
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { parseFrontmatter } from "../../extension/src/frontmatter.js";

export function getPendingSources(rawDir: string, wikiDir: string): string[] {
  // Reuse getUningestedSources from extension
  const { getUningestedSources } = require("../../extension/src/ingest.js");
  return getUningestedSources(rawDir, wikiDir);
}

export function getActivePages(wikiDir: string): { path: string; title: string; linkCount: number }[] {
  const pages: { path: string; title: string; linkCount: number }[] = [];
  const subdirs = ["entities", "concepts", "summaries", "synthesis"];

  for (const subdir of subdirs) {
    const dir = join(wikiDir, subdir);
    if (!existsSync(dir)) continue;

    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const content = readFileSync(join(dir, file), "utf-8");
      try {
        const page = parseFrontmatter(content);
        pages.push({
          path: `${subdir}/${file}`,
          title: page.title,
          linkCount: page.links.length,
        });
      } catch {
        continue;
      }
    }
  }

  return pages.sort((a, b) => b.linkCount - a.linkCount).slice(0, 10);
}

export function getRecentActivity(wikiDir: string, count = 10): string[] {
  const logPath = join(wikiDir, "log.md");
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, "utf-8");
  const entries = content.match(/^## \[.+$/gm) ?? [];
  return entries.slice(-count).reverse();
}

```

- [ ] **Step 2: Build Dashboard component**

Create `app/src/components/Dashboard.tsx` (or framework equivalent) with four widget sections:
- Recent Sources (recently added files in `raw/`)
- Pending Inbox list (with count badge)
- Active Pages list (most-connected wiki pages, sorted by link count)
- Recent Activity feed

Each widget fetches data from the repo reader via a server API route.

- [ ] **Step 3: Wire Dashboard as the default tab**

Set Dashboard as the default active tab in the layout.

- [ ] **Step 4: Verify dashboard renders with sample data**

Create a test repo with some sample sources and wiki pages, verify the dashboard displays them correctly.

- [ ] **Step 5: Commit**

```bash
git add app/src/
git commit -m "feat: dashboard view with sources, inbox, active pages, and activity widgets"
```

---

### Task 13: Wiki Browser View

**Files:**
- Create: `app/src/components/WikiBrowser.tsx`

- [ ] **Step 1: Build wiki browser component**

Features:
- Lists all wiki pages grouped by type (entities, concepts, summaries, synthesis)
- Click a page to render its markdown content
- Parse and make `[[wiki-links]]` clickable (navigate to linked page)
- Show page metadata sidebar: title, type, sources list, links list, dates
- Search input that filters pages by title

Use a markdown rendering library (e.g., `react-markdown` with `remark-gfm`, or the framework equivalent).

- [ ] **Step 2: Add API route to read wiki pages**

Server route that:
- Lists all wiki pages with their frontmatter (for the sidebar/list)
- Returns a single page's content by path

- [ ] **Step 3: Connect chat → wiki browser**

When chat output mentions a wiki page path, make it clickable — clicking switches to the Wiki tab and opens that page.

- [ ] **Step 4: Verify navigation works**

Test clicking between pages, following wiki-links, and switching from chat.

- [ ] **Step 5: Commit**

```bash
git add app/src/
git commit -m "feat: wiki browser view with markdown rendering and cross-references"
```

---

### Task 14: Source Manager View

**Files:**
- Create: `app/src/components/SourceManager.tsx`

- [ ] **Step 1: Build source manager component**

Features:
- Tree view of `raw/` showing the directory structure (flat or topic-based)
- Each file shows: name, ingestion status (✅ ingested / ⬜ pending)
- Click a pending source → pre-fills chat with "ingest [path]"
- Drag-and-drop file upload into any directory

- [ ] **Step 2: Add API route for source management**

Server routes for:
- Listing the `raw/` directory tree
- Uploading a file to a specific `raw/` path
- Reading a source file's content

- [ ] **Step 3: Verify source operations**

Test uploading a file, seeing it appear as pending, clicking to trigger ingest via chat.

- [ ] **Step 4: Commit**

```bash
git add app/src/
git commit -m "feat: source manager view with tree and upload"
```

---

### Task 15: Timeline View

**Files:**
- Create: `app/src/components/Timeline.tsx`

- [ ] **Step 1: Build timeline component**

Features:
- Parse `wiki/log.md` and render entries as a styled timeline
- Each entry shows: date, action type (icon), detail text
- Filter buttons: All, Ingest, Query, Lint
- Search input
- Click an entry to navigate to the relevant wiki page or source

- [ ] **Step 2: Add API route for timeline data**

Server route that parses `wiki/log.md` and returns structured entries.

- [ ] **Step 3: Verify timeline renders and filters work**

- [ ] **Step 4: Commit**

```bash
git add app/src/
git commit -m "feat: timeline view with filtering and search"
```

---

## Phase 4: Integration & Polish

### Task 16: Chat ↔ Panel Wiring

**Files:**
- Modify: various components

- [ ] **Step 1: Wire Dashboard → Chat interactions**

- Clicking a pending inbox item pre-fills chat with `ingest <path>`
- Clicking an active page opens it in Wiki Browser

- [ ] **Step 2: Wire Chat → Wiki Browser**

- Parse chat responses for wiki page paths (e.g., `wiki/concepts/ownership.md`)
- Render these as clickable links that switch to Wiki tab and open the page

- [ ] **Step 3: Wire Source Manager → Chat**

- Click pending source sends ingest command to chat

- [ ] **Step 4: Verify all cross-panel interactions**

Test each interaction path end-to-end.

- [ ] **Step 5: Commit**

```bash
git add app/src/
git commit -m "feat: cross-panel interaction wiring"
```

---

### Task 17: Git Sync UI

**Files:**
- Create: `app/src/components/SyncStatus.tsx`

- [ ] **Step 1: Add sync status indicator**

Small component in the app header/footer showing:
- Current git branch
- Sync status (up to date / ahead / behind)
- Pull / Push buttons

- [ ] **Step 2: Add API route for git operations**

Server routes for:
- Getting git status (branch, ahead/behind counts)
- Triggering git pull
- Triggering git push

- [ ] **Step 3: Verify sync works between two local repos**

Clone the test repo, make changes in one, sync to the other.

- [ ] **Step 4: Commit**

```bash
git add app/src/
git commit -m "feat: git sync status and push/pull controls"
```

---

### Task 18: AGENTS.md Schema File

**Files:**
- Create: `extension/templates/AGENTS.md`

- [ ] **Step 1: Write the AGENTS.md template**

Create `extension/templates/AGENTS.md` — the schema file that gets placed in the knowledge repo:

```markdown
# APARA Wiki Conventions

You are maintaining an APARA knowledge base. Follow these conventions for all wiki operations.

## Directory Structure

- `raw/` — source documents (never modify). Organized however the user wants (flat or by topic).
- `wiki/` — LLM-maintained knowledge graph
  - `entities/` — people, places, tools, specific things
  - `concepts/` — ideas, principles, patterns
  - `summaries/` — one summary per ingested source
  - `synthesis/` — cross-cutting analyses and comparisons
  - `index.md` — catalog of all pages
  - `log.md` — chronological activity log

## Page Format

Every wiki page MUST have YAML frontmatter:

```yaml
---
title: "Page Title"
type: entity | concept | summary | synthesis
sources:
  - path/relative/to/raw/dir
created: YYYY-MM-DD
updated: YYYY-MM-DD
links:
  - relative/path/to/linked/page.md
---
```

## Naming Conventions

- File names: lowercase, hyphens, `.md` extension (e.g., `ownership-borrowing.md`)
- One concept per page — split if a page covers multiple distinct ideas
- Summary pages match source filename (e.g., source `rust-book-ch1.md` → summary `rust-book-ch1.md`)

## Cross-Referencing Rules

- Create a link when a page mentions another page's topic
- Create a NEW page when a concept is mentioned 3+ times across existing pages but has no page
- Use `[[wiki-links]]` syntax for cross-references within page body
- Update the `links` frontmatter field to match all outbound links

## Ingest Workflow

1. Read the source document
2. Discuss key takeaways with the user
3. Create/update summary page in `wiki/summaries/`
4. Update or create relevant entity/concept pages
5. Update `wiki/index.md` with any new pages
6. Append entry to `wiki/log.md`
7. Git commit with message `ingest: <source-path>`

## Handling Contradictions

When new information contradicts existing wiki content:
- Note the contradiction explicitly in the affected page
- Include both claims with their sources
- Flag for user review
```

- [ ] **Step 2: Update init command to copy AGENTS.md**

Modify `extension/src/repo.ts` `initRepo()` to copy this template into the repo root.

- [ ] **Step 3: Commit**

```bash
git add extension/templates/AGENTS.md extension/src/repo.ts
git commit -m "feat: AGENTS.md schema template for knowledge repos"
```

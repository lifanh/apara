# AGENTS.md

Instructions for AI agents working on the APARA codebase.

## Project Overview

APARA is an LLM Wiki second brain system. This repo contains the **application code** (Pi Agent extension + web app), not the knowledge data. Knowledge repos are separate git repositories that APARA operates on.

## Repository Layout

- `extension/` — Pi Agent extension (the engine). Entry point: `extension/apara.ts`
  - `extension/src/` — modules: `repo.ts`, `frontmatter.ts`, `ingest.ts`, `git.ts`
  - `extension/test/` — vitest test files, one per module
- `app/` — web app workspace (not yet built)
- `doc/specs/` — design spec and implementation plan
- `doc/llm-wiki.md` — reference document for the LLM Wiki pattern

## Tech Stack

- **Language:** TypeScript (ESM, `"type": "module"`)
- **Runtime:** Node.js
- **Test framework:** Vitest
- **Package manager:** npm with workspaces (`extension`, `app`)
- **Extension framework:** [Pi Coding Agent](https://github.com/nichochar/pi-coding-agent) — registers commands and tools via `ExtensionAPI`
- **Schema validation:** `@sinclair/typebox`
- **YAML:** `yaml` package for frontmatter and config parsing

## Conventions

### Code Style

- Use `import`/`export` (ESM), not `require`
- Imports use `.js` extension for local modules (e.g., `import { foo } from "./bar.js"`)
- Prefer `const` over `let`; avoid `var`
- Functions are plain named exports, not classes
- No comments unless the code is genuinely complex
- Error handling: throw `Error` with descriptive messages; don't over-validate internal calls

### File Naming

- Source files: `kebab-case.ts` (e.g., `frontmatter.ts`, `repo.ts`)
- Test files: `<module>.test.ts` in `extension/test/`
- One module = one test file

### Testing

- Each module has a corresponding test file
- Tests use temp directories (`mkdtempSync`) cleaned up in `afterEach`
- Run tests: `cd extension && npx vitest run`
- All tests must pass before committing

### Git

- Commit messages: `type: description` (e.g., `feat:`, `fix:`, `refactor:`, `docs:`, `test:`)
- Only stage files related to the current change
- Do not commit `node_modules/`, `dist/`, or `.superpowers/`

## Key Data Structures

### WikiPage (`extension/src/frontmatter.ts`)

```typescript
interface WikiPage {
  title: string;
  type: "entity" | "concept" | "summary" | "synthesis";
  sources: string[];     // paths relative to raw/
  created: string;       // YYYY-MM-DD
  updated: string;       // YYYY-MM-DD
  links: string[];       // relative paths to other wiki pages
  body: string;          // markdown content after frontmatter
}
```

### AparaConfig (`extension/src/repo.ts`)

```typescript
interface AparaConfig {
  name: string;          // display name
  model?: string;        // LLM model
  wiki_dir: string;      // default: "wiki"
  raw_dir: string;       // default: "raw"
  auto_commit: boolean;  // default: true
  remote?: string;       // git remote for sync
}
```

## Architecture Decisions

- **Knowledge repos are separate from this app repo.** The extension operates on a knowledge repo path (currently `process.cwd()`). The app code and knowledge data have independent lifecycles.
- **3 tools, not 4.** We removed the Lifecycle tool (PARA pivot). Tools are: `apara_ingest`, `apara_query`, `apara_lint`.
- **No heat/cold system.** All wiki pages are equal; no priority tiers.
- **`wiki/log.md` is the activity log.** No separate database for operational state.
- **Git is the sync mechanism.** No SQLite sidecar, no external database.

## Implementation Plan

The full task list with progress is in `doc/specs/2026-04-12-apara-plan.md`. Check the Progress table for current status before starting work.

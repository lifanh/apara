# APARA Design Spec

> An LLM Wiki second brain — an incremental life/knowledge tracking system.

## Overview

APARA uses the LLM Wiki pattern to create a unified system for knowledge synthesis. Raw sources are collected in a simple directory structure; a unified wiki knowledge graph synthesizes across all sources. An LLM agent (Pi Agent) does all the maintenance — summarizing, cross-referencing, filing, and bookkeeping.

## Requirements

- **Unified purpose**: a knowledge garden with deep synthesis and cross-referencing
- **Simple source organization**: raw sources live in a flat or topic-based directory structure — organized however the user wants
- **Text-focused inputs**: primarily markdown, notes, articles, book highlights, meeting notes
- **Dedicated web app**: TS web app communicating with Pi Agent via RPC (JSON protocol over stdin/stdout)
- **Git-backed**: all data (sources + wiki) lives in a configurable git repository; git is the sync and version control mechanism
- **Single-user, multi-device**: git push/pull for sync between machines

## Architecture

Three layers: Git Repo (data) → Pi Agent (engine) → Web App (UI).

```
┌─────────────────────────────────────────────────────────┐
│                    TS Web App (UI)                       │
│                                                         │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐  │
│  │ Dashboard  │ │   Chat   │ │  Wiki  │ │  Sources   │  │
│  │   Home    │ │  Query   │ │ Browser│ │  Manager   │  │
│  └───────────┘ └──────────┘ └────────┘ └────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Timeline / Activity Log               │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ RPC (JSON Lines over stdin/stdout)
┌──────────────────────┴──────────────────────────────────┐
│              Pi Agent (subprocess: pi --mode rpc)        │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  APARA Extension                                    ││
│  │  ┌─────────┐ ┌─────────┐ ┌──────┐                  ││
│  │  │ Ingest  │ │  Query  │ │ Lint │                  ││
│  │  │  Tool   │ │  Tool   │ │ Tool │                  ││
│  │  └─────────┘ └─────────┘ └──────┘                  ││
│  └─────────────────────────────────────────────────────┘│
│  Schema (AGENTS.md) — wiki conventions, page formats    │
└──────────────────────┬──────────────────────────────────┘
                       │ reads/writes
┌──────────────────────┴──────────────────────────────────┐
│                Git Repository (Data)                     │
│                                                         │
│  raw/                        wiki/                      │
│  ├── rust/                   ├── index.md               │
│  │   ├── rust-book-ch1.md    ├── log.md                 │
│  │   └── rust-blog-post.md   ├── entities/              │
│  ├── health/                 ├── concepts/              │
│  │   └── sleep-article.md    ├── summaries/             │
│  └── cooking/                └── synthesis/             │
│      └── sourdough-guide.md                             │
│                              .apara.yaml (config)       │
└─────────────────────────────────────────────────────────┘
```

## Data Layer: Git Repo Structure

```
my-brain/                         # the git repo
├── .apara.yaml                   # app config (repo name, LLM model, preferences)
├── AGENTS.md                     # Pi Agent schema — wiki conventions, page formats
│
├── raw/                          # source documents (immutable, user-organized)
│   ├── rust/
│   │   ├── rust-book-ch1.md
│   │   └── rust-blog-post.md
│   ├── health/
│   │   ├── sleep-article.md
│   │   └── exercise-notes.md
│   ├── cooking/
│   │   └── sourdough-guide.md
│   └── trip-planning-notes.md    # flat files are fine too
│
├── wiki/                         # unified knowledge graph (LLM-maintained)
│   ├── index.md                  # catalog of all pages with summaries
│   ├── log.md                    # chronological activity log
│   ├── entities/                 # people, places, tools, specific things
│   ├── concepts/                 # ideas, principles, patterns
│   ├── summaries/                # source summaries (one per ingested source)
│   └── synthesis/                # cross-cutting analyses, comparisons, insights
│
└── .git/
```

### Wiki Page Frontmatter

Every wiki page has YAML frontmatter:

```yaml
---
title: "Ownership and Borrowing"
type: concept                     # entity | concept | summary | synthesis
sources:                          # which raw sources feed this page
  - rust/rust-book-ch1.md
  - rust/rust-blog-post.md
created: 2026-04-10
updated: 2026-04-12
links:                            # explicit cross-references
  - entities/rust.md
  - concepts/memory-safety.md
---
```

### .apara.yaml (Config)

```yaml
# Repository-level configuration
name: "My Brain"                  # display name for this knowledge base
model: "claude-sonnet-4-20250514"          # default LLM model for Pi Agent
wiki_dir: "wiki"                  # wiki output directory (default: wiki/)
raw_dir: "raw"                    # source input directory (default: raw/)
auto_commit: true                 # git commit after each operation
remote: "origin"                  # git remote for sync (optional)
```

## Engine Layer: Pi Agent APARA Extension

A Pi Agent extension providing three core tools.

### Ingest Tool

- **Input**: source file path(s) in `raw/`
- **Flow**: read source → discuss key takeaways with user via chat → create summary page in `wiki/summaries/` → update or create relevant entity/concept pages → update `wiki/index.md` → append to `wiki/log.md` → git commit
- A single ingest may touch 10-15 wiki pages

### Query Tool

- **Input**: natural language question
- **Flow**: read `wiki/index.md` to find relevant pages → read those pages → synthesize answer with citations → optionally save as a `wiki/synthesis/` page if user says "keep this"

### Lint Tool

- **Input**: none (entire wiki) or a scope
- **Checks**: contradictions between pages, stale claims, orphan pages (no inbound links), missing pages (concepts mentioned but no page exists), broken cross-references, uningested sources in `raw/`
- **Output**: report with suggested fixes; user approves fixes to apply

### AGENTS.md (Schema)

Lives in the repo root. Tells Pi Agent:

- Wiki page format conventions (frontmatter schema, markdown style)
- Naming conventions for files and directories
- Cross-referencing rules (when to create a link vs. a new page)
- How to handle contradictions between sources
- Ingest workflow steps

This file co-evolves as you use the system.

## UI Layer

### Layout: Chat-Centric with Panels

The app uses a two-panel layout:

- **Left panel**: tabbed content area switching between Dashboard, Wiki Browser, Source Manager, and Timeline
- **Right panel**: persistent Pi Agent chat — always visible, never hidden

The chat is the primary interaction surface. All LLM operations (ingest, query, lint) happen through conversation. The left panel provides rich browsing and visualization context alongside the chat.

### Views

#### Dashboard (landing page)

Four widgets:

- **Recent Sources** — recently added source files with ingestion status. Click a source to start an ingest conversation.
- **Pending Inbox** — sources in `raw/` not yet ingested. Your processing queue. Click a source to start an ingest conversation in the chat panel.
- **Active Pages** — most-connected or recently-updated wiki pages. The pulse of the knowledge base.
- **Recent Activity** — compact feed of last N actions (ingests, saved queries, lint fixes).

#### Chat / Query Interface

Conversational interface powered by Pi Agent via RPC. Supports:

- Natural language queries against the wiki
- Ingest commands ("ingest the new rust article")
- Lint requests ("check the wiki health")
- Saving query responses back to the wiki ("keep this")

The chat shows structured responses — the LLM reports which pages it created/updated, with clickable links that open in the Wiki Browser panel.

#### Wiki Browser

Rendered markdown viewer for wiki pages. Features:

- Follow `[[wiki-links]]` between pages
- Page metadata sidebar: type, source list, linked pages, created/updated dates
- Breadcrumb navigation
- Search across wiki pages

#### Source Manager

Browse and manage raw sources. Features:

- Tree view of `raw/` showing the directory structure
- Each file shows: name, ingestion status (✅ ingested / ⬜ pending)
- Click a pending source → pre-fills chat with "ingest [path]"
- Drag-and-drop file upload into any directory
- Click a source to view its content or start an ingest

#### Timeline / Activity Log

Chronological view of all wiki activity. Features:

- Filterable by action type (ingest, query, lint)
- Searchable
- Each entry links to the relevant wiki pages or sources
- Mirrors `wiki/log.md` but with richer UI

### Interaction Flow: Chat ↔ Panels

The chat and panels are connected:

- Clicking a pending source in Dashboard → pre-fills chat with "ingest [source]"
- Chat mentions a wiki page → clickable link opens it in Wiki Browser
- Saving a query response → creates a new page visible in Wiki Browser

## Tech Decisions

- **Web framework**: TS-based, TBD (Astro, Next.js, SvelteKit, or similar)
- **LLM runtime**: Pi Agent via RPC subprocess (`pi --mode rpc`)
- **Data storage**: Git repository (configurable path via `.apara.yaml`)
- **Sync**: Git push/pull for multi-device
- **Markdown rendering**: TBD (e.g., remark/rehype, markdown-it)
- **Search**: index.md-based at small scale; consider qmd or similar for larger wikis

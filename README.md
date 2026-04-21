# APARA

An LLM Wiki second brain — an incremental knowledge tracking system.

APARA uses the [LLM Wiki](doc/llm-wiki.md) pattern: instead of re-deriving knowledge from raw documents on every query (like RAG), an LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked collection of markdown files. You add sources, the LLM summarizes, cross-references, and maintains everything.

## Architecture

Three layers:

```
Git Repo (data) → Pi Agent (engine) → Web App (UI)
```

- **Git Repo** — a standard git repository containing raw source documents (`raw/`) and the LLM-maintained wiki (`wiki/`). Human-readable markdown, synced across devices via git.
- **Pi Agent Extension** — a [Pi Coding Agent](https://github.com/nichochar/pi-coding-agent) extension providing three tools: ingest, query, and lint.
- **Web App** — a React 19 + Tailwind CSS + shadcn UI with a Bun backend server. Pi Agent runs in-process via the SDK (`@mariozechner/pi-coding-agent`). REST API + WebSocket for real-time updates.

## Knowledge Repo Structure

APARA operates on a separate knowledge repository (not this application repo):

```
my-brain/                         # the knowledge git repo
├── .apara.yaml                   # config (repo name, LLM model, preferences)
├── AGENTS.md                     # schema for Pi Agent (wiki conventions)
├── raw/                          # source documents (user-organized, immutable)
│   ├── rust/
│   │   └── rust-book-ch1.md
│   └── health/
│       └── sleep-article.md
├── wiki/                         # LLM-maintained knowledge graph
│   ├── index.md                  # catalog of all pages
│   ├── log.md                    # chronological activity log
│   ├── entities/                 # people, places, tools
│   ├── concepts/                 # ideas, principles, patterns
│   ├── summaries/                # one per ingested source
│   └── synthesis/                # cross-cutting analyses
└── .git/
```

## Tools

| Tool | Description |
|------|-------------|
| **Ingest** | Read a source file, create summary page, update entity/concept pages, update index and log |
| **Query** | Search the wiki index, read relevant pages, synthesize an answer with citations |
| **Lint** | Health-check: find uningested sources, orphan pages, broken links, contradictions |

## Project Structure

```
apara/                            # this repo (application code)
├── extension/                    # Pi Agent extension
│   ├── apara.ts                  # extension entry point (commands + tools)
│   ├── src/
│   │   ├── repo.ts               # init/validate/loadConfig for knowledge repos
│   │   ├── frontmatter.ts        # wiki page YAML frontmatter parser/serializer
│   │   ├── ingest.ts             # log/index helpers, ingestion detection
│   │   └── git.ts                # git operations (add, commit, status)
│   ├── templates/                # template files
│   └── test/                     # vitest tests
├── app/                          # web app
│   ├── src/                      # React frontend
│   │   └── components/           # Dashboard, WikiBrowser, SourceManager,
│   │                             # ChatPanel, Timeline, SyncStatus
│   ├── server/                   # Bun HTTP/WebSocket server (REST API + Pi Agent SDK)
│   └── test/                     # tests
└── doc/
    ├── llm-wiki.md               # LLM Wiki pattern reference
    └── specs/                    # design spec and implementation plan
```

## Development

```bash
# Install dependencies
bun install

# Run extension tests
cd extension && bunx vitest run

# Run app dev server
cd app && bunx vp dev

# Run app backend server
cd app && bun run server/index.ts --repo /path/to/knowledge-repo

# Run app tests
cd app && bunx vp test
```

## Deployment

### Local

```bash
cd app && bun run server/index.ts --repo /path/to/knowledge-repo
```

Opens on `http://localhost:3000`. No auth required — server binds to `127.0.0.1` only.

### Cloud (VPS)

Set environment variables and run the same server binary:

```bash
export APARA_REPO_PATH=/path/to/knowledge-repo
export APARA_AUTH_TOKEN=your-secret-token
cd app && bun run server/index.ts --port 3000
```

With `APARA_AUTH_TOKEN` set, the server binds to `0.0.0.0` and requires token authentication. The knowledge repo should be a git repo on the server's persistent disk — use `git push`/`pull` (available in the UI) for backup and sync.

**Requirements:** Bun runtime. No external processes needed — Pi Agent runs in-process via the SDK.

## Status

All planned phases complete. The APARA web app is functional with all four views (Dashboard, Wiki Browser, Source Manager, Timeline), chat with markdown rendering and persistent named conversations, cross-panel wiring, Git Sync UI, and AGENTS.md schema template. See [the implementation plan](doc/specs/2026-04-12-apara-plan.md) for full progress.

## Design Documents

- [Design Spec](doc/specs/2026-04-12-apara-design.md) — architecture, data model, UI layout
- [Implementation Plan](doc/specs/2026-04-12-apara-plan.md) — task breakdown with progress tracking
- [LLM Wiki Pattern](doc/llm-wiki.md) — the underlying knowledge management pattern

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

## Quick Start

```bash
bun install
bun run build
APARA_REPO_PATH=/path/to/knowledge-repo bun run start
```

Opens on `http://localhost:3000`.

## Development

```bash
# Install dependencies
bun install

# Run extension tests
cd extension && bun vitest run

# Run app dev server (frontend hot reload)
cd app && bun vp dev

# Run app backend server (in a separate terminal)
cd app && bun run server/index.ts --repo /path/to/knowledge-repo

# Run all tests
bun run test
```

## Deployment

### Local

```bash
bun run build
APARA_REPO_PATH=/path/to/repo bun run start
```

No auth required — server binds to `127.0.0.1` only.

### Docker

```bash
docker build -t apara .
docker run -p 3000:3000 \
  -v /path/to/repo:/data/repo \
  -e APARA_REPO_PATH=/data/repo \
  -e ANTHROPIC_API_KEY=sk-... \
  apara
```

Or with Docker Compose:

```bash
cp .env.example .env  # edit with your values
docker compose up
```

### Cloud (VPS)

Set `APARA_AUTH_TOKEN` to enable auth and bind to `0.0.0.0`:

```bash
export APARA_REPO_PATH=/path/to/repo
export APARA_AUTH_TOKEN=your-secret-token
export ANTHROPIC_API_KEY=sk-...
bun run start
```

Place behind a reverse proxy (Caddy, nginx) for TLS. See [Deployment Guide](doc/deployment.md) for full details including reverse proxy examples.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APARA_REPO_PATH` | Yes | Path to the knowledge repo |
| `APARA_AUTH_TOKEN` | For remote | Enables token auth, binds to 0.0.0.0 |
| `ANTHROPIC_API_KEY` | Yes | LLM API key for Pi Agent |
| `APARA_ALLOWED_ORIGIN` | No | CORS allowed origin |
| `PORT` | No | Server port (default: 3000) |
| `APARA_TRUST_PROXY` | No | Set to `1` when behind a trusted reverse proxy so the auth rate limiter uses the proxy-supplied client IP |

## Design Documents

- [Deployment Guide](doc/deployment.md) — production deployment instructions
- [Design Spec](doc/specs/2026-04-12-apara-design.md) — architecture, data model, UI layout
- [Implementation Plan](doc/specs/2026-04-12-apara-plan.md) — task breakdown with progress tracking
- [Production Readiness](doc/specs/2026-04-22-production-deploy.md) — deployment milestone spec
- [LLM Wiki Pattern](doc/llm-wiki.md) — the underlying knowledge management pattern

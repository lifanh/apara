# Architecture

## System Overview

APARA is an LLM Wiki second brain with two components:
1. **Pi Agent Extension** (`extension/`) — the engine that operates on a git-backed knowledge repo via three tools (ingest, query, lint)
2. **Web App** (`app/`) — React SPA + Bun backend providing chat UI and knowledge management views

## Two-Process Architecture

- **Vite dev server** (port 5173) — serves the React SPA, proxies `/api/*` and `/ws` to the backend
- **Bun server** (`server/index.ts`, port 3000) — REST API + WebSocket, spawns Pi Agent as a child process via JSON Lines RPC

## Frontend Architecture

- **App.tsx** — root layout with `ResizablePanelGroup` (left 65% + right 35%)
- **ContentPanel.tsx** — left panel with tabs: Dashboard, Wiki, Sources, Timeline
- **ChatPanel.tsx** — right panel with WebSocket chat to Pi Agent
- Tab state and wiki navigation lifted to App level (`activeTab`, `selectedWikiPath`, `openWikiPage`)

### Component Patterns
- Named export function components, one main export per file
- Tailwind CSS + shadcn/ui components from `@/components/ui/`
- Data fetching via `useEffect` + `fetch()` (no React Query)
- Sub-components defined in same file below main export

## Backend Architecture

All routes inline in `server/index.ts` using Bun's native `fetch` handler:
- `GET /api/dashboard` — aggregated stats
- `GET /api/wiki[?path=X]` — list or single wiki page
- `GET /api/sources[?path=X]` — list or single source file
- `GET /api/log` — raw wiki/log.md content
- `WS /ws` — single-session WebSocket for Pi Agent chat

Data logic extracted to modules: `dashboard.ts`, `wiki.ts`, `auth.ts`, `pi-manager.ts`.

### Security
- Path traversal protection via `safePath()` function on all file-serving endpoints
- Optional auth via `APARA_AUTH_TOKEN` env var (cookie-based)

## Data Flow

```
Knowledge Repo (filesystem)
  → extension/src/ modules (parseFrontmatter, getUningestedSources)
  → server/ modules (reuse extension data layer via relative imports)
  → REST API (JSON responses)
  → React components (fetch in useEffect)
```

The server imports directly from `../../extension/src/frontmatter.js` and `../../extension/src/ingest.js`.

## Key Interfaces

- `WikiPage` — title, type, sources[], created, updated, links[], body
- `AparaConfig` — name, model?, wiki_dir, raw_dir, auto_commit, remote?
- WebSocket messages defined in `src/lib/ws-types.ts` (client/server types)
- Pi Agent RPC protocol in `src/lib/rpc-types.ts`

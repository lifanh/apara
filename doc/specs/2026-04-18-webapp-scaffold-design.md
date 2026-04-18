# Web App Scaffold & Deployment Design

**Date:** 2026-04-18
**Status:** Approved
**Scope:** Task 10 (Web App Scaffold) and deployment architecture

## Stack

| Layer | Technology | Role |
|---|---|---|
| Server runtime | **Bun** | HTTP server, WebSocket, subprocess management, package manager |
| Frontend toolchain | **Vite+** (`vp`) | Dev server, HMR, build, test (Vitest), lint (Oxlint), format (Oxfmt) |
| UI framework | **React** SPA | Client-side rendering |
| Styling | **Tailwind CSS** + **shadcn/ui** | Utility CSS + accessible component primitives |
| Bundler | **Rolldown** (via Vite 8+) | Production builds |

## Architecture

### Two-process dev, single-process prod

- **Dev**: `vp dev` on `:5173` for React HMR, Bun API server on `:3000`. Vite proxies `/api/*` and `/ws` to Bun.
- **Prod**: `vp build` → static files. Bun serves static assets + API + WebSocket from a single `:3000` port.

### Deployment flexibility

- **Local**: `bun run server` → opens browser to `localhost:3000`. No auth. Repo path from config or CLI arg.
- **Cloud (VPS)**: Same binary, auth enabled via env var (`APARA_AUTH_TOKEN`), public URL, repo on server, git remote for sync.

```
[Any device / browser]
        │ HTTPS
        ▼
[Host (local or cloud VPS)]
  ├── Bun Server
  │     ├── Serves React SPA (static files)
  │     ├── REST API (/api/*)
  │     └── WebSocket (/ws)
  ├── Pi Agent subprocess (pi --mode rpc)
  └── Git repo (raw/ + wiki/)
        └── git push/pull to GitHub for backup/sync
```

### Directory structure

```
app/
├── server/              # Bun server code
│   ├── index.ts         # Entry point: Bun.serve()
│   ├── pi-manager.ts    # Pi Agent subprocess lifecycle
│   ├── auth.ts          # Optional auth middleware
│   └── lib/
│       └── rpc-client.ts    # (moved from src/lib/, server-only)
├── src/                 # React SPA (Vite root)
│   ├── components/      # React components
│   ├── lib/             # Shared types, stores, utilities
│   │   └── rpc-types.ts     # (existing, shared by server + client)
│   ├── App.tsx
│   └── main.tsx
├── public/              # Static assets
├── vite.config.ts       # Vite+ config (dev, build, test, lint, fmt)
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

## Communication Layer

### Browser ↔ Bun Server

**WebSocket** (`/ws`) — single persistent connection per session:
- **Client → Server**: user chat messages, abort requests
- **Server → Client**: streamed Pi Agent events (`text_delta`, `message_update`, `agent_end`, etc.)

**REST** (`/api/*`) — stateless reads for repo data:
- `GET /api/config` — `.apara.yaml` contents
- `GET /api/wiki` — wiki index / page listing
- `GET /api/wiki/:path` — individual wiki page content
- `GET /api/sources` — raw/ file listing
- `GET /api/sources/:path` — raw source content
- `GET /api/log` — wiki/log.md parsed entries

### Bun Server ↔ Pi Agent

- Uses the existing `PiRpcClient` — moves from `app/src/lib/` to `app/server/lib/` since it uses Node/Bun APIs (`child_process`, `EventEmitter`) and is server-only code. The `rpc-types.ts` stays shared in `app/src/lib/` since both server and client reference the event types.
- Bun spawns one Pi Agent subprocess per session
- RPC client forwards WebSocket messages as `RpcCommand` objects to Pi stdin
- RPC client emits `RpcEvent` objects back, which Bun forwards over the WebSocket to the browser

### Chat message flow

```
User types message
  → Browser sends JSON over WebSocket
    → Bun receives, calls piClient.prompt(message)
      → Pi Agent processes via LLM
      → Pi Agent emits text_delta events on stdout
    → Bun forwards each event over WebSocket
  → Browser renders streaming text in chat panel
```

## UI Layout

Two-panel, chat-centric layout:

```
┌─────────────────────────────────────────────────────┐
│  [Dashboard] [Wiki] [Sources] [Timeline]            │
├────────────────────────────────┬────────────────────┤
│                                │                    │
│         Content Panel          │    Chat Panel      │
│         (left, flex)           │    (right, fixed)  │
│                                │                    │
│  - Dashboard: stats, recent    │  - Message list    │
│    activity, uningested count  │  - Streaming text  │
│  - Wiki: page browser/viewer   │  - Input field     │
│  - Sources: raw/ file tree     │  - Tool call       │
│  - Timeline: log.md entries    │    indicators      │
│                                │                    │
├────────────────────────────────┼────────────────────┤
│                                │  [  Type here… ]   │
└────────────────────────────────┴────────────────────┘
```

- **Right panel (chat)**: Fixed width (~400px), always visible. Uses shadcn/ui `ScrollArea` for message list, `Input` for chat field. Resizable via shadcn `ResizablePanelGroup`.
- **Left panel (content)**: Fills remaining width. Tab bar at top using shadcn `Tabs`. Only one tab active at a time.
- **Responsive**: On small screens, panels stack vertically — chat slides in as a drawer/overlay.
- **Tab contents** (all initially placeholder, built in later tasks):
  - **Dashboard** — wiki stats, recent log entries, uningested source count
  - **Wiki** — page list with type icons, click to view rendered markdown
  - **Sources** — file tree of `raw/`, click to view content
  - **Timeline** — parsed `wiki/log.md` as a vertical timeline

## Authentication (Cloud Mode)

Simple token-based auth, enabled by environment variable:

- If `APARA_AUTH_TOKEN` is set, auth is required. If unset, no auth (local mode).
- **Login**: Single page with a token input field. Submits to `POST /api/auth` which sets an HTTP-only cookie.
- **Protection**: All `/api/*` routes and the WebSocket upgrade check the cookie. Unauthorized requests get `401`.
- **No user accounts**: Single-user system. One token = one user. No signup, no password reset, no sessions table.

## Configuration

### Knowledge repo path

- **CLI arg** (primary): `bun run server --repo /path/to/knowledge-repo`
- **Env var** (fallback): `APARA_REPO_PATH=/path/to/knowledge-repo`
- **Default**: current working directory

The server reads `.apara.yaml` from the repo path to get `wiki_dir`, `raw_dir`, model preference, and extension path.

### Package manager

- **Bun** as both runtime and package manager (`bun install`, `bun add`, etc.)
- Monorepo workspaces via `package.json` `"workspaces"` field — Bun supports this natively
- Lockfile: `bun.lock` (replaces `package-lock.json`)

### Vite+ config (`app/vite.config.ts`)

```ts
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "http://localhost:3000", ws: true },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

Vite+ auto-detects Bun as the package manager from `bun.lock`. Commands like `vp install` delegate to `bun install`. `vp dev`, `vp build`, `vp test` work independently of the package manager choice.

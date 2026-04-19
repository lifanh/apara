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
- **Client → Server**: user chat messages, abort requests, ping
- **Server → Client**: stable app-level events (see below), not raw Pi RPC events

The server maps Pi RPC events to a stable app event protocol, decoupling the UI from the Pi Agent internals:

```ts
// Client → Server
type ClientMessage =
  | { type: "prompt"; text: string }
  | { type: "abort" }
  | { type: "ping" };

// Server → Client
type ServerMessage =
  | { type: "run_started"; runId: string }
  | { type: "assistant_delta"; runId: string; text: string }
  | { type: "tool_status"; runId: string; tool: string; status: "start" | "end" }
  | { type: "run_finished"; runId: string }
  | { type: "repo_changed" }
  | { type: "error"; code: string; message: string }
  | { type: "pong" };
```

**REST** (`/api/*`) — stateless reads for repo data:
- `GET /api/config` — sanitized config (name, wikiDir, rawDir, model); does not expose raw `.apara.yaml`
- `GET /api/wiki` — wiki page listing (directory scan + frontmatter parse)
- `GET /api/wiki?path=concepts/foo.md` — individual wiki page content (query param, not path segment, to support nested paths)
- `GET /api/sources` — raw/ file listing with metadata (name, size, type)
- `GET /api/sources?path=books/bar.pdf` — source content: text preview for text files (with size limit), metadata-only response for binary files
- `GET /api/log` — raw `wiki/log.md` content (structured parsing deferred to a later task)

All file-path parameters are resolved against the repo root and boundary-checked — any path that resolves outside the repo root returns `403`.

### Bun Server ↔ Pi Agent

- Uses the existing `PiRpcClient` — moves from `app/src/lib/` to `app/server/lib/` since it uses Node/Bun APIs (`child_process`, `EventEmitter`) and is server-only code. The `rpc-types.ts` stays shared in `app/src/lib/` since both server and client reference the event types.
- Bun spawns one Pi Agent subprocess per session
- RPC client forwards WebSocket messages as `RpcCommand` objects to Pi stdin
- RPC client receives `RpcEvent` objects, maps them to `ServerMessage`, and forwards over WebSocket

### Session lifecycle

- **One session = one WebSocket connection.** Single-user system; only one active session at a time.
- **One active prompt at a time.** A second `prompt` message while one is running returns an error.
- **Reconnect:** On WebSocket close, the Pi subprocess is killed after a short grace period (5s). A new connection spawns a fresh subprocess. No session resume in v1.
- **Heartbeat:** Client sends `ping` every 30s. Server responds with `pong`. If no ping is received for 60s, server closes the connection and cleans up the subprocess.
- **Cleanup:** On server shutdown or unexpected disconnect, all child processes are killed via process group signal.

### Chat message flow

```
User types message
  → Browser sends { type: "prompt", text } over WebSocket
    → Bun receives, calls piClient.prompt(message)
      → Pi Agent processes via LLM
      → Pi Agent emits text_delta events on stdout
    → Bun maps to { type: "assistant_delta", ... } and forwards over WebSocket
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
- **Login**: Single page with a token input field. Submits to `POST /api/auth` which sets a cookie.
- **Cookie flags**: `HttpOnly`, `SameSite=Strict`, `Secure` when served over HTTPS.
- **Origin validation**: `POST /api/auth` and WebSocket upgrade requests must have a valid `Origin` header matching the server's host. Reject cross-origin requests.
- **Protection**: All `/api/*` routes and the WebSocket upgrade check the cookie. Unauthorized requests get `401`.
- **Local mode**: When auth is disabled (no `APARA_AUTH_TOKEN`), the server binds to `127.0.0.1` only, not `0.0.0.0`, to prevent LAN exposure.
- **Rate limiting**: Simple delay (1s) after failed login attempts to discourage brute-force.
- **No user accounts**: Single-user system. One token = one user. No signup, no password reset, no sessions table.

## Configuration

### Knowledge repo path

- **CLI arg** (primary): `bun run server --repo /path/to/knowledge-repo`
- **Env var** (fallback): `APARA_REPO_PATH=/path/to/knowledge-repo`
- **No default**: if neither is provided, the server exits with an error message explaining how to set the repo path. (The app repo is separate from the knowledge repo, so `cwd` is almost never correct.)
- **Validation on startup**: the resolved path must contain `.apara.yaml` or a valid `wiki/` + `raw/` structure. If not, the server exits with a descriptive error.

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

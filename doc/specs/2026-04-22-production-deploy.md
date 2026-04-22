# Production Deployment — Design & Implementation Plan

> **Milestone goal:** Make APARA deployable as a single-user production service accessible over the internet with proper security, observability, and containerisation.

## Current State

APARA has all features implemented (Phases 1–5 complete). The app runs locally via `bun run server/index.ts --repo <path>`. The Pi Agent is integrated as an SDK (`createAgentSession`), not a subprocess. Auth exists but is minimal (single shared token in a cookie). The server is single-session (one WebSocket at a time).

### What Works Today

- Bun HTTP server serves built frontend from `dist/` and exposes REST + WebSocket APIs
- Token auth gated by `APARA_AUTH_TOKEN` env var; when set, binds to `0.0.0.0`
- Origin validation on WebSocket upgrade
- SIGINT/SIGTERM handlers for cleanup
- All features: chat, wiki browser, source manager, timeline, git sync, persistent chats

### What's Missing for Production

| Category | Gap | Impact |
|----------|-----|--------|
| Packaging | No Dockerfile or container config | Can't deploy to any platform |
| Build | No unified production build + start script | Manual multi-step process |
| Security | No session expiry, no CSRF, timing-safe comparison | Vulnerable on public internet |
| Security | No security headers (CSP, X-Frame-Options, etc.) | Browser-level protections missing |
| Ops | No `/health` endpoint | Orchestrators can't health-check |
| Ops | No structured logging / request logging | Blind in production |
| Ops | No CORS headers on REST APIs | Cross-origin access blocked |
| Config | No `.env.example` or deployment docs | Users don't know what to configure |
| Infra | No CI/CD pipeline | No automated build/test/deploy |
| Resilience | No graceful shutdown (drain in-flight) | Requests dropped on redeploy |

### Out of Scope (This Milestone)

- Multi-user / multi-session support (architectural change, separate milestone)
- Database migration away from disk-based chat storage (works fine for single-user with persistent volume)
- Custom domain / DNS configuration (platform-specific)
- Horizontal scaling (single-user product)

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Host / VPS / PaaS               │
│                                                  │
│  ┌──────────────┐      ┌──────────────────────┐  │
│  │ Reverse Proxy│      │   Persistent Volume  │  │
│  │ (Caddy/nginx)│      │   /data/repo         │  │
│  │  TLS + HTTPS │      │   ├── wiki/           │  │
│  └──────┬───────┘      │   ├── raw/            │  │
│         │              │   └── .apara/          │  │
│         ▼              └──────────┬─────────────┘  │
│  ┌──────────────┐                │               │
│  │  Docker       │◄──────────────┘               │
│  │  Container    │                               │
│  │              │                               │
│  │  Bun Server   │                               │
│  │  ├─ REST API  │                               │
│  │  ├─ WebSocket │                               │
│  │  ├─ Static    │                               │
│  │  │  (dist/)   │                               │
│  │  └─ Pi Agent  │                               │
│  │     (SDK)     │                               │
│  └──────────────┘                               │
└──────────────────────────────────────────────────┘
```

The Dockerfile builds the frontend (Vite), then runs the Bun server which serves `dist/` as static files and handles API + WebSocket. A reverse proxy terminates TLS. The knowledge repo lives on a persistent volume mounted into the container.

---

## Task Sequence

Tasks are ordered by dependency. Each task is independently committable.

### Phase 6: Production Readiness

---

### Task 21: Health Check Endpoint

**Files:** `app/server/index.ts`

**Why first:** Zero-dependency, immediately useful for all subsequent testing.

- [ ] Add `GET /health` route returning `{ status: "ok", version: "<pkg version>" }`
- [ ] Place it before the auth check so it's always accessible
- [ ] Add optional `GET /ready` that verifies the knowledge repo is accessible (checks `wiki/` and `raw/` exist)
- [ ] Test manually with `curl`

---

### Task 22: Security Hardening

**Files:** `app/server/auth.ts`, `app/server/index.ts`

**Depends on:** Task 21

- [ ] **Step 1: Timing-safe token comparison** — Replace `===` with `crypto.timingSafeEqual` in `checkAuth()` to prevent timing attacks
- [ ] **Step 2: Session expiry** — Add `Max-Age` (e.g., 7 days) to the auth cookie in `createAuthCookie()`
- [ ] **Step 3: Security headers** — Add response headers to all non-API responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws:; img-src 'self' data:`
- [ ] **Step 4: CORS** — Add CORS headers to `/api/*` routes. Allow origin from `APARA_ALLOWED_ORIGIN` env var (default: same-origin only)
- [ ] **Step 5: Rate limiting on `/api/auth`** — Simple in-memory rate limiter: max 5 attempts per IP per minute

---

### Task 23: Graceful Shutdown

**Files:** `app/server/index.ts`

**Depends on:** Task 21

- [ ] On SIGINT/SIGTERM, stop accepting new connections
- [ ] Wait for active WebSocket to close (with a 10s timeout)
- [ ] Save any active conversation before exiting
- [ ] Then call `server.stop()` and exit

---

### Task 24: Structured Logging

**Files:** `app/server/logger.ts` (new), `app/server/index.ts`

**Depends on:** Task 23

- [ ] **Step 1: Create logger module** — Simple structured logger that writes JSON lines to stdout:
  ```
  {"ts":"...","level":"info","msg":"request","method":"GET","path":"/api/wiki","status":200,"ms":12}
  ```
  Levels: `info`, `warn`, `error`. No external dependencies (just `JSON.stringify` + `console.log`).
- [ ] **Step 2: Add request logging** — Log every HTTP request with method, path, status, and duration
- [ ] **Step 3: Log server lifecycle events** — Startup (with config summary), shutdown, WebSocket connect/disconnect, Pi Agent session init/dispose
- [ ] **Step 4: Log errors** — Catch and log unhandled errors in API routes instead of letting them crash

---

### Task 25: Production Build & Start Scripts

**Files:** `package.json`, `app/package.json`

**Depends on:** Task 24

- [ ] **Step 1: Add root `build` script** — `cd app && bun run build` (builds Vite frontend into `app/dist/`)
- [ ] **Step 2: Add root `start` script** — `cd app && bun run server/index.ts` (serves built frontend + API)
- [ ] **Step 3: Add root `dev` script** — Runs Vite dev server + Bun server concurrently for development
- [ ] **Step 4: Verify** — Run `bun run build && bun run start --repo /tmp/test-repo` and confirm the app works end-to-end

---

### Task 26: Environment Documentation

**Files:** `.env.example` (new), `doc/deployment.md` (new)

**Depends on:** Task 25

- [ ] **Step 1: Create `.env.example`** with all env vars:
  ```env
  # Required: path to the APARA knowledge repo
  APARA_REPO_PATH=/path/to/knowledge-repo

  # Optional: set to enable auth (required for non-localhost access)
  APARA_AUTH_TOKEN=

  # Optional: restrict CORS to a specific origin
  APARA_ALLOWED_ORIGIN=

  # Required: LLM provider API key (used by Pi Agent SDK)
  # Set the key for whichever provider your model uses:
  ANTHROPIC_API_KEY=
  # OPENAI_API_KEY=
  # GOOGLE_API_KEY=

  # Optional: server port (default: 3000)
  PORT=3000
  ```
- [ ] **Step 2: Create `doc/deployment.md`** covering:
  - Prerequisites (Bun, Git, LLM API key)
  - Local production run (build + start)
  - Docker deployment (reference Task 27)
  - Environment variables reference table
  - Setting up a knowledge repo
  - Reverse proxy examples (Caddy snippet, nginx snippet)
  - Persistent storage guidance

---

### Task 27: Dockerfile & Container Config

**Files:** `Dockerfile` (new), `.dockerignore` (new)

**Depends on:** Task 26

- [ ] **Step 1: Create `.dockerignore`**
  ```
  node_modules/
  .git/
  dist/
  .superpowers/
  doc/
  *.md
  ```
- [ ] **Step 2: Create multi-stage `Dockerfile`**
  - **Stage 1 (build):** `oven/bun:1` base → copy source → `bun install` → `bun run build`
  - **Stage 2 (runtime):** `oven/bun:1-slim` base → copy `app/server/`, `app/dist/`, `app/package.json`, `node_modules/` → expose port 3000 → `CMD ["bun", "run", "server/index.ts"]`
- [ ] **Step 3: Create `docker-compose.yml`** for easy local deployment:
  ```yaml
  services:
    apara:
      build: .
      ports:
        - "3000:3000"
      volumes:
        - ./my-repo:/data/repo
      environment:
        - APARA_REPO_PATH=/data/repo
        - APARA_AUTH_TOKEN=${APARA_AUTH_TOKEN}
        - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  ```
- [ ] **Step 4: Test** — Build image, run container with a test repo, verify health endpoint and full app functionality

---

### Task 28: CI/CD Pipeline

**Files:** `.github/workflows/ci.yml` (new)

**Depends on:** Task 27

- [ ] **Step 1: Create GitHub Actions workflow** triggered on push/PR to `main`:
  - Install Bun
  - `bun install`
  - Run extension tests: `cd extension && bun vitest run`
  - Run app tests: `cd app && bun vp test`
  - Run linting: `bun oxlint` in both workspaces
  - Build app: `cd app && bun run build`
  - Build Docker image (verify it builds, don't push)
- [ ] **Step 2: Add build status badge** to `README.md`

---

### Task 29: Update README & Final Polish

**Files:** `README.md`

**Depends on:** Task 28

- [ ] Rewrite README with:
  - Project description and screenshot/demo
  - Quick start (local dev)
  - Production deployment (link to `doc/deployment.md`)
  - Environment variables summary
  - Architecture overview (link to spec)
  - Contributing section
- [ ] Verify all scripts work from a clean clone: `bun install && bun run build && bun run start`
- [ ] Verify Docker build works: `docker build -t apara .`

---

## Dependency Graph

```
Task 21 (Health Check)
  ├─► Task 22 (Security Hardening)
  └─► Task 23 (Graceful Shutdown)
         └─► Task 24 (Structured Logging)
                └─► Task 25 (Build Scripts)
                       └─► Task 26 (Env Docs)
                              └─► Task 27 (Dockerfile)
                                     └─► Task 28 (CI/CD)
                                            └─► Task 29 (README)
```

Tasks 22 and 23 can be done in parallel (both depend only on Task 21).
Tasks 24–29 are sequential — each builds on the previous.

---

## Success Criteria

- [ ] `docker build -t apara . && docker run` starts a working APARA instance
- [ ] `/health` returns 200 with version info
- [ ] Auth token is validated with timing-safe comparison and cookie has expiry
- [ ] Security headers present on all responses
- [ ] Server logs structured JSON to stdout
- [ ] Graceful shutdown saves active conversation and drains connections
- [ ] CI pipeline passes on every push
- [ ] A new user can deploy APARA by reading `doc/deployment.md` alone

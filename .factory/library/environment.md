# Environment

## Runtime
- **Node.js** for Vite dev server and extension tests
- **Bun** for backend server (`bun run server/index.ts`)
- **Package manager**: bun (with npm workspaces at root)

## Key Commands
- Vite dev: `bun run dev` from `app/` (uses `vp` wrapper — NOT `npx vp dev`)
- Backend: `bun run server/index.ts --repo <path>` from `app/`
- App tests: `cd app && npx vitest run`
- Extension tests: `cd extension && npx vitest run`
- Lint: `cd app && npx oxlint`
- Typecheck: `npx tsc --noEmit -p app/tsconfig.app.json && npx tsc --noEmit -p app/tsconfig.server.json`

## Dependencies
- No external services (no DB, no Redis)
- Knowledge repo is a local git directory
- Pi Agent (`pi` CLI) needed for chat functionality (not needed for UI testing)

## Environment Variables
- `APARA_REPO_PATH` — path to knowledge repo (alternative to `--repo` flag)
- `APARA_AUTH_TOKEN` — optional auth token (when set, enables cookie auth)

---
name: app-worker
description: Builds web app features — React components, Bun API routes, server-side tests
---

# App Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

For features involving the APARA web app: React components, API routes, server-side logic, and UI integration.

## Required Skills

- `agent-browser` — MUST invoke for manual verification of UI features after implementation. Use to navigate to http://localhost:5173, interact with components, and verify visual correctness.

## Work Procedure

### 1. Understand the Feature

Read the feature description, preconditions, and expectedBehavior thoroughly. Read `AGENTS.md` for constraints. Read `.factory/library/architecture.md` for system context. Check existing components for patterns.

### 2. Plan the Implementation

Identify:
- Which files to create/modify
- API routes needed (add inline to `server/index.ts` or extract to module)
- Component structure (main export + sub-components in same file)
- Props and callbacks needed for cross-component communication

### 3. Write Tests First (TDD)

For server-side logic:
- Create test file in `app/test/<module>.test.ts`
- Follow existing patterns: `describe`/`it`, temp dirs with `mkdtempSync`, cleanup in `afterEach`
- Run tests to confirm they fail: `cd /Users/lifan/dev/ai/apara/app && npx vitest run`

### 4. Implement

**Components:**
- Named export function in `src/components/<Name>.tsx`
- Use Tailwind CSS + shadcn/ui components from `@/components/ui/`
- Sub-components defined below main export in same file
- Data fetching: `useEffect` + `fetch()`
- Use `lucide-react` for icons

**API Routes:**
- Add inline to `server/index.ts` following existing pattern
- Use `safePath()` for any file-serving endpoints (path traversal protection)
- Extract data logic to separate module (e.g., `server/<feature>.ts`) if complex
- Use `Response.json()` for JSON, `new Response()` for text

**Wiring:**
- Tab content goes in `ContentPanel.tsx` (import component, add to TabsContent)
- Cross-panel callbacks thread through `App.tsx` → `ContentPanel` → component
- For chat pre-fill: add callback prop that sets chat input state via App.tsx

**Import conventions:**
- Frontend: `@/components/ui/...`, `@/lib/...` (no `.js` extension)
- Server: use `.js` extension for local imports (ESM)
- Extension reuse: `../../extension/src/module.js`

### 5. Run Validators

```bash
cd /Users/lifan/dev/ai/apara/app && npx vitest run
cd /Users/lifan/dev/ai/apara/app && bunx tsc --noEmit -p tsconfig.app.json
cd /Users/lifan/dev/ai/apara/app && bunx tsc --noEmit -p tsconfig.server.json
cd /Users/lifan/dev/ai/apara/app && npx oxlint
```

Fix all failures before proceeding.

### 6. Manual Verification with agent-browser

Invoke the `agent-browser` skill. Steps:
1. Start the backend server if not running: check port 3000, if not listening start it
2. Start the Vite dev server if not running: check port 5173, if not listening start it
3. Navigate to http://localhost:5173
4. Exercise each interaction described in the feature's expectedBehavior
5. Take screenshots as evidence
6. Record each check in `interactiveChecks`

**IMPORTANT:** Start servers using the commands from `.factory/services.yaml`. The test knowledge repo must exist — if not, run `.factory/init.sh` first. Use `APARA_REPO_PATH` env var to point to the test repo.

### 7. Clean Up

Stop any servers you started. Kill processes by port:
```bash
lsof -ti :3000 | xargs kill 2>/dev/null || true
lsof -ti :5173 | xargs kill 2>/dev/null || true
```

## Example Handoff

```json
{
  "salientSummary": "Built SourceManager component with tree view, ingestion status indicators, content preview, and chat pre-fill wiring. Tree renders files from /api/sources grouped by directory with expand/collapse. Added drag-and-drop upload via POST /api/sources/upload. 4 new tests in source-manager.test.ts, all passing. Verified in agent-browser: tree renders, status indicators correct, clicking pending source pre-fills chat input.",
  "whatWasImplemented": "SourceManager component (src/components/SourceManager.tsx) with recursive tree view, ingestion status from /api/dashboard cross-reference, content preview panel, chat pre-fill callback, drag-and-drop upload zone. POST /api/sources/upload endpoint in server/index.ts with safePath validation. ContentPanel updated to render SourceManager in Sources tab. App.tsx updated with setChatInput callback threaded to ContentPanel and ChatPanel.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd /Users/lifan/dev/ai/apara/app && npx vitest run", "exitCode": 0, "observation": "6 test files, 52 tests passed" },
      { "command": "cd /Users/lifan/dev/ai/apara && npx tsc --noEmit -p app/tsconfig.app.json", "exitCode": 0, "observation": "No type errors" },
      { "command": "cd /Users/lifan/dev/ai/apara/app && npx oxlint", "exitCode": 0, "observation": "No lint issues" }
    ],
    "interactiveChecks": [
      { "action": "Clicked Sources tab", "observed": "Tree view rendered with 3 files across 2 directories (books/, articles/)" },
      { "action": "Checked ingestion indicators", "observed": "books/sample-book.md shows checkmark, articles/ai-safety.md and rust-intro.md show pending dot" },
      { "action": "Clicked pending file articles/ai-safety.md", "observed": "Chat input pre-filled with 'ingest articles/ai-safety.md', message not sent" },
      { "action": "Clicked books/sample-book.md", "observed": "Content preview panel shows markdown content of sample-book.md" }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "app/test/source-manager.test.ts",
        "cases": [
          { "name": "returns source tree with ingestion status", "verifies": "API returns files with isIngested flag" },
          { "name": "handles empty raw directory", "verifies": "Returns empty array for empty raw/" },
          { "name": "upload creates file in correct location", "verifies": "POST /api/sources/upload writes file" },
          { "name": "upload rejects path traversal", "verifies": "Paths with .. are rejected with 403" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- A required shadcn component is missing and needs installation
- The chat pre-fill mechanism requires architectural changes not described in the feature
- Existing API endpoints return data in an unexpected format
- Port conflicts prevent starting dev servers

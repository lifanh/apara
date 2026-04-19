# User Testing

## Validation Surface

**Primary surface:** Browser UI at http://localhost:5173
**Tool:** agent-browser

### Setup Requirements
1. Create test knowledge repo with sample data (wiki pages, raw sources, log.md)
2. Initialize git in test repo
3. Start Bun backend (port 3000) with `APARA_REPO_PATH` pointing to test repo
4. Start Vite dev server (port 5173) — use `bun run dev` from app/, NOT `npx vp dev`
5. Wait for both servers to be healthy before testing

### Test Repo Structure
```
<test-repo>/
├── .apara.yaml
├── .git/
├── raw/
│   ├── books/sample-book.md (ingested — referenced by wiki/entities/typescript.md)
│   ├── articles/ai-safety.md (pending — not referenced by any wiki page)
│   └── rust-intro.md (pending)
├── wiki/
│   ├── entities/typescript.md (sources: [books/sample-book.md])
│   ├── concepts/type-safety.md (sources: [])
│   ├── index.md
│   └── log.md (4 sample entries: 2 ingest, 1 lint, 1 query)
```

### Important Notes
- Pi Agent (`pi` CLI) is NOT available in the test environment — assertions requiring actual Pi Agent responses cannot be fully tested
- WebSocket chat connects but Pi Agent subprocess won't spawn without `pi` binary
- Focus validation on UI rendering, interaction, and API integration
- For timeline validation `VAL-TL-005`, the default fixture may not include a wiki-page path entry in `wiki/log.md`; append a temporary entry like `## [2026-04-13] query | entities/typescript.md` for navigation validation, then restore the original log.
- For panel-wiring validation `VAL-WIRE-003`, send a prompt and wait for an assistant message; if no assistant response can be produced due missing `pi`, mark the assertion blocked with screenshot evidence.
- In chat-related assertions, wait until the input is enabled (not `Connecting…`) before validating pre-fill behavior.
- For git-sync behind-state checks, after pushing a remote-only commit from a second clone, run `git fetch origin` in the backend repo before asserting `behind > 0` so tracking refs are current.

## Validation Concurrency

**Machine:** 32GB RAM, 12 CPU cores
**Resource profile per validator:**
- Bun backend: ~52MB
- Vite dev server: ~391MB
- agent-browser instance: ~200MB
- Total per instance: ~200MB (servers shared)

**Available headroom:** ~18.2GB (26GB free * 0.7)
**Max concurrent validators:** 5

## Flow Validator Guidance: agent-browser

- Use only `http://localhost:5173` (UI) and `http://localhost:3000` (API).
- Stay inside the assigned milestone assertions and evidence directory.
- Do not alter repository code or mission files; only interact through UI/API and test-repo fixtures.
- For source-manager assertions, run serially within one browser context to avoid shared-state collisions (uploads, empty-directory checks, tree refreshes).
- In headless runs, if OS-level drag gestures are unavailable, validate upload assertions through the Source Manager file input while still verifying `POST /api/sources/upload`, tree update, and on-disk file creation.
- Capture required evidence for each assertion: screenshots plus specified network/console artifacts.
- If agent-browser network capture returns no requests, collect required endpoint evidence with `curl` (headers + response body) and store it in the assertion evidence directory.

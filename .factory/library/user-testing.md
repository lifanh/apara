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

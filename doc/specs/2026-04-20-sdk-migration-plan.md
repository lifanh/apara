# Pi Agent SDK Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pi Agent RPC subprocess integration with in-process SDK (`createAgentSession`), eliminating IPC overhead and simplifying deployment.

**Architecture:** The Bun server currently spawns a Pi Agent subprocess (`pi --mode rpc`) and communicates via JSON-lines over stdin/stdout (`PiRpcClient`). The migration embeds the Pi Agent directly in-process using `createAgentSession()` from `@mariozechner/pi-coding-agent`. The 3 APARA tools move from the extension file to `customTools` on the session. The WebSocket protocol (`ServerMessage`/`ClientMessage`) and REST API are unchanged — only the server-side plumbing between WebSocket handler and agent changes.

**Tech Stack:** `@mariozechner/pi-coding-agent` SDK (v0.67.68+), Bun, TypeScript ESM

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/server/pi-manager.ts` | **Rewrite** | Wraps `AgentSession` (SDK). Creates session, subscribes to events, maps to `ServerMessage`, handles prompt/abort/cleanup. |
| `app/server/tools.ts` | **Create** | Defines the 3 APARA `ToolDefinition` objects (`apara_ingest`, `apara_query`, `apara_lint`) for `customTools`. |
| `app/server/index.ts` | **Modify** | Update WebSocket `open` handler: instantiate SDK-based `PiManager` instead of `PiRpcClient`-based one. Remove `PiRpcClient` import. |
| `app/server/lib/rpc-client.ts` | **Delete** | No longer needed — SDK replaces subprocess IPC. |
| `app/src/lib/rpc-types.ts` | **Delete** | No longer needed — was only used by `rpc-client.ts` and `pi-manager.ts`. |
| `app/test/pi-manager.test.ts` | **Rewrite** | Test the new SDK-based `PiManager` with a mock `AgentSession`. |
| `app/test/rpc-client.test.ts` | **Delete** | Tests for deleted module. |
| `app/package.json` | **Modify** | Add `@mariozechner/pi-coding-agent` as a runtime dependency. |
| `extension/apara.ts` | **Keep** | Extension file stays for CLI usage. Not loaded by the web app anymore. |

---

### Task 1: Add Pi Agent SDK dependency to app workspace

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Add the dependency**

```bash
cd app && bun add @mariozechner/pi-coding-agent
```

- [ ] **Step 2: Verify installation**

```bash
cd app && bun run -e "const sdk = await import('@mariozechner/pi-coding-agent'); console.log('createAgentSession' in sdk ? 'OK' : 'MISSING')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/package.json bun.lock
git commit -m "feat: add pi-coding-agent SDK dependency to app workspace"
```

---

### Task 2: Extract APARA tool definitions into `app/server/tools.ts`

Port the 3 tool definitions from `extension/apara.ts` to standalone `ToolDefinition` objects for `customTools`. These are pure data + functions with no dependency on `ExtensionAPI`.

**Files:**
- Create: `app/server/tools.ts`
- Reference: `extension/apara.ts` (source of tool logic)
- Reference: `extension/src/repo.ts` (for `loadConfig`, `validateRepo`)
- Reference: `extension/src/ingest.ts` (for `appendToLog`, `getUningestedSources`)

- [ ] **Step 1: Create `app/server/tools.ts`**

```ts
import { Type } from "@sinclair/typebox";
import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { loadConfig, validateRepo } from "../../extension/src/repo.js";
import { appendToLog, getUningestedSources } from "../../extension/src/ingest.js";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

export function createAparaTools(repoRoot: string): ToolDefinition[] {
  const config = loadConfig(repoRoot);
  const rawDir = join(repoRoot, config.raw_dir);
  const wikiDir = join(repoRoot, config.wiki_dir);

  const ingestTool: ToolDefinition = {
    name: "apara_ingest",
    label: "Ingest Source",
    description:
      "Ingest a raw source file into the APARA wiki. Reads the source, creates a summary page, and updates the index and log. The LLM should then update or create relevant entity/concept pages based on the source content.",
    parameters: Type.Object({
      source_path: Type.String({ description: "Path to the source file relative to raw/, e.g. rust/ch1.md" }),
    }),
    async execute(_toolCallId, params) {
      const fullPath = join(rawDir, params.source_path);
      if (!existsSync(fullPath)) {
        throw new Error(`Source file not found: ${params.source_path}`);
      }
      const content = readFileSync(fullPath, "utf-8");
      appendToLog(wikiDir, "ingest", params.source_path);
      return {
        content: [
          {
            type: "text" as const,
            text: `Source file read successfully: ${params.source_path}\n\nContent:\n\n${content}\n\nPlease:\n1. Create a summary page at wiki/summaries/${basename(params.source_path)}\n2. Update or create relevant entity/concept pages\n3. Update wiki/index.md with new pages\n4. Commit with message "ingest: ${params.source_path}"`,
          },
        ],
      };
    },
  };

  const lintTool: ToolDefinition = {
    name: "apara_lint",
    label: "Wiki Lint",
    description:
      "Health-check the APARA wiki. Finds: uningested sources, orphan pages, missing cross-references, and stale pages.",
    parameters: Type.Object({}),
    async execute() {
      const uningested = getUningestedSources(rawDir, wikiDir);
      const errors = validateRepo(repoRoot);

      let report = "## Wiki Health Report\n\n";
      if (errors.length > 0) {
        report += `### Structural Issues\n${errors.map((e) => `- ❌ ${e}`).join("\n")}\n\n`;
      }
      if (uningested.length > 0) {
        report += `### Uningested Sources (${uningested.length})\n${uningested.map((s) => `- 📄 ${s}`).join("\n")}\n\n`;
      }
      report += "Please also check for:\n- Contradictions between pages\n- Orphan pages with no inbound links\n- Concepts mentioned but lacking their own page\n- Broken [[wiki-links]]";
      appendToLog(wikiDir, "lint", `${errors.length} structural issues, ${uningested.length} uningested`);
      return {
        content: [{ type: "text" as const, text: report }],
      };
    },
  };

  const queryTool: ToolDefinition = {
    name: "apara_query",
    label: "Wiki Query",
    description:
      "Query the APARA wiki. Reads the wiki index to find relevant pages, then reads those pages to answer the question.",
    parameters: Type.Object({
      question: Type.String({ description: "The question to answer" }),
    }),
    async execute(_toolCallId, params) {
      const indexPath = join(wikiDir, "index.md");
      let indexContent = "";
      if (existsSync(indexPath)) {
        indexContent = readFileSync(indexPath, "utf-8");
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Question: ${params.question}\n\nWiki Index:\n\n${indexContent}\n\nPlease:\n1. Identify relevant wiki pages from the index\n2. Read those pages\n3. Synthesize an answer with citations\n4. If the answer is valuable, offer to save it as a wiki/synthesis/ page`,
          },
        ],
      };
    },
  };

  return [ingestTool, lintTool, queryTool];
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd app && npx tsc --noEmit server/tools.ts
```

If tsc isn't configured for server files, verify with:

```bash
cd app && bun run -e "await import('./server/tools.ts'); console.log('OK')"
```

Expected: `OK` (no runtime errors on import)

- [ ] **Step 3: Commit**

```bash
git add app/server/tools.ts
git commit -m "feat: extract APARA tool definitions for SDK customTools"
```

---

### Task 3: Rewrite `PiManager` to use SDK `AgentSession`

Replace the RPC-client-based `PiManager` with one that creates and manages an `AgentSession`.

**Files:**
- Rewrite: `app/server/pi-manager.ts`

- [ ] **Step 1: Rewrite `pi-manager.ts`**

```ts
import { randomUUID } from "crypto";
import {
  createAgentSession,
  createCodingTools,
  SessionManager,
  SettingsManager,
  getAgentDir,
  AuthStorage,
  ModelRegistry,
  type AgentSession,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import type { ServerMessage } from "../src/lib/ws-types.js";
import { createAparaTools } from "./tools.js";

export class PiManager {
  private session: AgentSession | null = null;
  private unsubscribe: (() => void) | null = null;
  private activeRunId: string | null = null;
  private messageHandler: ((message: ServerMessage) => void) | null = null;

  constructor(
    private repoPath: string,
    private agentDir: string,
  ) {}

  async init(): Promise<void> {
    const authStorage = AuthStorage.create(this.agentDir);
    const modelRegistry = ModelRegistry.create(authStorage, this.agentDir);

    const { session } = await createAgentSession({
      cwd: this.repoPath,
      agentDir: this.agentDir,
      tools: createCodingTools(this.repoPath),
      customTools: createAparaTools(this.repoPath),
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory(),
      authStorage,
      modelRegistry,
    });

    this.session = session;
    this.unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      this.mapEvent(event);
    });
  }

  handlePrompt(text: string): ServerMessage | undefined {
    if (this.activeRunId) {
      return {
        type: "error",
        code: "busy",
        message: "A prompt is already in progress",
      };
    }

    if (!this.session) {
      return {
        type: "error",
        code: "not_ready",
        message: "Agent session not initialized",
      };
    }

    this.activeRunId = randomUUID();
    this.emit({ type: "run_started", runId: this.activeRunId });
    void this.session.prompt(text);
    return undefined;
  }

  handleAbort(): void {
    void this.session?.abort();
  }

  onMessage(handler: (message: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.session?.dispose();
    this.session = null;
    this.activeRunId = null;
  }

  private emit(message: ServerMessage): void {
    this.messageHandler?.(message);
  }

  private mapEvent(event: AgentSessionEvent): void {
    if (!this.activeRunId) return;

    switch (event.type) {
      case "message_update": {
        const assistantEvent = event.assistantMessageEvent as
          | { type?: unknown; delta?: unknown }
          | undefined;
        if (
          assistantEvent?.type === "text_delta" &&
          typeof assistantEvent.delta === "string"
        ) {
          this.emit({
            type: "assistant_delta",
            runId: this.activeRunId,
            text: assistantEvent.delta,
          });
        }
        break;
      }
      case "tool_execution_start": {
        if (typeof event.toolName !== "string") break;
        this.emit({
          type: "tool_status",
          runId: this.activeRunId,
          tool: event.toolName,
          status: "start",
        });
        break;
      }
      case "tool_execution_end": {
        if (typeof event.toolName !== "string") break;
        this.emit({
          type: "tool_status",
          runId: this.activeRunId,
          tool: event.toolName,
          status: "end",
        });
        break;
      }
      case "agent_end": {
        this.emit({
          type: "run_finished",
          runId: this.activeRunId,
        });
        this.activeRunId = null;
        break;
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/server/pi-manager.ts
git commit -m "feat: rewrite PiManager to use Pi Agent SDK session"
```

---

### Task 4: Update `index.ts` to use SDK-based `PiManager`

**Files:**
- Modify: `app/server/index.ts`

- [ ] **Step 1: Remove old imports**

Remove these imports from `app/server/index.ts`:

```ts
import { PiRpcClient } from "./lib/rpc-client.js";
```

The `PiManager` import stays but now points to the rewritten module.

- [ ] **Step 2: Add agentDir import**

Add to imports:

```ts
import { getAgentDir } from "@mariozechner/pi-coding-agent";
```

- [ ] **Step 3: Update WebSocket `open` handler**

Replace the synchronous `PiManager` construction in the `open` handler (lines 274-279):

```ts
// Old:
piManager = new PiManager(
  new PiRpcClient({
    cwd: resolvedRepo,
    extensionPath: resolve(import.meta.dir, "../../extension/apara.ts"),
  })
);
piManager.onMessage((message: ServerMessage) => {
  ws.send(JSON.stringify(message));
});
```

With async init:

```ts
// New:
const manager = new PiManager(resolvedRepo, getAgentDir());
manager.onMessage((message: ServerMessage) => {
  ws.send(JSON.stringify(message));
});
manager.init().then(() => {
  piManager = manager;
}).catch((err) => {
  ws.send(JSON.stringify({
    type: "error",
    code: "init_failed",
    message: err instanceof Error ? err.message : "Failed to initialize agent",
  } satisfies ServerMessage));
  ws.close(1011, "Agent init failed");
});
```

Also remove the `resolve` import if it was only used for the extension path (check — it's also used for `resolvedRepo` on line 34, so keep it).

- [ ] **Step 4: Verify the server starts**

```bash
cd app && bun run server/index.ts --repo /path/to/test-knowledge-repo
```

Expected: Server starts without errors. (Use any existing knowledge repo or create a temp one with `wiki/` and `raw/` dirs.)

- [ ] **Step 5: Commit**

```bash
git add app/server/index.ts
git commit -m "feat: wire up SDK-based PiManager in server"
```

---

### Task 5: Delete RPC client and types

**Files:**
- Delete: `app/server/lib/rpc-client.ts`
- Delete: `app/src/lib/rpc-types.ts`
- Delete: `app/test/rpc-client.test.ts`

- [ ] **Step 1: Delete the files**

```bash
rm app/server/lib/rpc-client.ts
rm app/src/lib/rpc-types.ts
rm app/test/rpc-client.test.ts
```

- [ ] **Step 2: Remove the empty `app/server/lib/` directory if empty**

```bash
rmdir app/server/lib/ 2>/dev/null || true
```

- [ ] **Step 3: Verify no remaining references**

```bash
grep -r "rpc-client\|rpc-types\|PiRpcClient\|RpcEvent\|RpcCommand\|RpcResponse" app/server/ app/src/ app/test/ --include='*.ts'
```

Expected: No matches.

- [ ] **Step 4: Commit**

```bash
git add -u app/server/lib/rpc-client.ts app/src/lib/rpc-types.ts app/test/rpc-client.test.ts
git commit -m "refactor: remove RPC client and types (replaced by SDK)"
```

---

### Task 6: Rewrite `pi-manager.test.ts` for SDK-based PiManager

**Files:**
- Rewrite: `app/test/pi-manager.test.ts`

The old tests mocked `PiRpcClient` (an `EventEmitter`). The new tests mock `AgentSession` (which has `prompt()`, `abort()`, `dispose()`, `subscribe()`).

- [ ] **Step 1: Rewrite the test file**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../src/lib/ws-types.js";

// We test PiManager's event mapping and prompt lifecycle.
// Since PiManager.init() calls createAgentSession (which needs auth/model setup),
// we test the class by constructing it and injecting a mock session via internals.

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: vi.fn(),
  createCodingTools: vi.fn(() => []),
  SessionManager: { inMemory: vi.fn(() => ({})) },
  SettingsManager: { inMemory: vi.fn(() => ({})) },
  AuthStorage: { create: vi.fn(() => ({})) },
  ModelRegistry: { create: vi.fn(() => ({})) },
  getAgentDir: vi.fn(() => "/tmp/agent"),
}));

// Import after mock
const { PiManager } = await import("../server/pi-manager.js");

function createMockSession() {
  let listener: ((event: any) => void) | null = null;
  return {
    prompt: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    subscribe: vi.fn((fn: (event: any) => void) => {
      listener = fn;
      return () => { listener = null; };
    }),
    emit(event: any) {
      listener?.(event);
    },
  };
}

describe("PiManager", () => {
  let manager: InstanceType<typeof PiManager>;
  let mockSession: ReturnType<typeof createMockSession>;
  let messages: ServerMessage[];

  beforeEach(async () => {
    mockSession = createMockSession();

    const { createAgentSession } = await import("@mariozechner/pi-coding-agent");
    (createAgentSession as any).mockResolvedValue({
      session: mockSession,
      extensionsResult: { extensions: [], errors: [] },
    });

    manager = new PiManager("/tmp/repo", "/tmp/agent");
    await manager.init();

    messages = [];
    manager.onMessage((msg: ServerMessage) => messages.push(msg));
  });

  describe("handlePrompt", () => {
    it("sends prompt to session and emits run_started", () => {
      const result = manager.handlePrompt("hello");
      expect(result).toBeUndefined();
      expect(mockSession.prompt).toHaveBeenCalledWith("hello");
      expect(messages[0]).toEqual(expect.objectContaining({ type: "run_started" }));
    });

    it("returns busy error if prompt already active", () => {
      manager.handlePrompt("first");
      const result = manager.handlePrompt("second");
      expect(result).toEqual({
        type: "error",
        code: "busy",
        message: "A prompt is already in progress",
      });
    });

    it("allows new prompt after agent_end", () => {
      manager.handlePrompt("first");
      mockSession.emit({ type: "agent_end", messages: [] });

      const result = manager.handlePrompt("second");
      expect(result).toBeUndefined();
      expect(mockSession.prompt).toHaveBeenCalledTimes(2);
    });
  });

  describe("handleAbort", () => {
    it("calls abort on session", () => {
      manager.handleAbort();
      expect(mockSession.abort).toHaveBeenCalled();
    });
  });

  describe("event mapping", () => {
    it("maps text_delta to assistant_delta", () => {
      manager.handlePrompt("hello");
      mockSession.emit({
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "hi there" },
      });

      expect(messages).toContainEqual(
        expect.objectContaining({ type: "assistant_delta", text: "hi there" })
      );
    });

    it("maps tool_execution_start to tool_status start", () => {
      manager.handlePrompt("hello");
      mockSession.emit({
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "apara_ingest",
        args: {},
      });

      expect(messages).toContainEqual(
        expect.objectContaining({ type: "tool_status", tool: "apara_ingest", status: "start" })
      );
    });

    it("maps tool_execution_end to tool_status end", () => {
      manager.handlePrompt("hello");
      mockSession.emit({
        type: "tool_execution_end",
        toolCallId: "tc1",
        toolName: "apara_ingest",
        result: {},
        isError: false,
      });

      expect(messages).toContainEqual(
        expect.objectContaining({ type: "tool_status", tool: "apara_ingest", status: "end" })
      );
    });

    it("maps agent_end to run_finished", () => {
      manager.handlePrompt("hello");
      mockSession.emit({ type: "agent_end", messages: [] });

      expect(messages).toContainEqual(expect.objectContaining({ type: "run_finished" }));
    });
  });

  describe("cleanup", () => {
    it("disposes session", () => {
      manager.cleanup();
      expect(mockSession.dispose).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd app && npx vp test pi-manager
```

Expected: All tests pass.

- [ ] **Step 3: Run full test suite**

```bash
cd app && npx vp test
```

Expected: All tests pass (no regressions from deleted files).

- [ ] **Step 4: Commit**

```bash
git add app/test/pi-manager.test.ts
git commit -m "test: rewrite pi-manager tests for SDK-based implementation"
```

---

### Task 7: Update design doc to reflect SDK architecture

**Files:**
- Modify: `doc/specs/2026-04-18-webapp-scaffold-design.md`

- [ ] **Step 1: Update architecture diagram**

In `doc/specs/2026-04-18-webapp-scaffold-design.md`, replace the architecture diagram's `Pi Agent subprocess (pi --mode rpc)` line and the `pi-manager.ts` description:

Old (line 38):
```
  ├── Pi Agent subprocess (pi --mode rpc)
```

New:
```
  ├── Pi Agent SDK (in-process, via @mariozechner/pi-coding-agent)
```

Old `pi-manager.ts` description (line 49):
```
│   ├── pi-manager.ts    # Pi Agent subprocess lifecycle
```

New:
```
│   ├── pi-manager.ts    # Pi Agent SDK session lifecycle
```

- [ ] **Step 2: Update the Bun ↔ Pi Agent communication section**

Replace lines 104-109 (the "Bun Server ↔ Pi Agent" section):

Old:
```
- Uses the existing `PiRpcClient` — moves from `app/src/lib/` to `app/server/lib/` since it uses Node/Bun APIs (`child_process`, `EventEmitter`) and is server-only code. The `rpc-types.ts` stays shared in `app/src/lib/` since both server and client reference the event types.
- Bun spawns one Pi Agent subprocess per session
- RPC client forwards WebSocket messages as `RpcCommand` objects to Pi stdin
- RPC client receives `RpcEvent` objects, maps them to `ServerMessage`, and forwards over WebSocket
```

New:
```
- Uses Pi Agent SDK (`createAgentSession` from `@mariozechner/pi-coding-agent`) — the agent runs in-process, no subprocess.
- APARA tools are registered as `customTools` on the session (defined in `app/server/tools.ts`).
- `PiManager` subscribes to `AgentSession` events and maps them to `ServerMessage` for the WebSocket.
```

- [ ] **Step 3: Commit**

```bash
git add doc/specs/2026-04-18-webapp-scaffold-design.md
git commit -m "docs: update design doc for SDK-based Pi Agent integration"
```

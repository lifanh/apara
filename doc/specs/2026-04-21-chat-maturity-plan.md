# Chat Maturity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add markdown rendering to chat assistant messages and persistent named conversations stored in `.apara/chats/`.

**Architecture:** Extract a shared `MarkdownContent` component from WikiBrowser for use in ChatPanel. Add a `chats.ts` server module for JSON file CRUD in `.apara/chats/`. Extend `ws-types.ts` with a `set_conversation` client message. Extend `use-chat.ts` with conversation state management. Add REST routes for chat CRUD and auto-save on prompt/run_finished.

**Tech Stack:** React 19, react-markdown, remark-gfm, Bun server, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/src/components/MarkdownContent.tsx` | **Create** | Shared markdown renderer (react-markdown + remark-gfm + component overrides) |
| `app/server/chats.ts` | **Create** | Conversation CRUD — read/write/list/delete JSON files in `.apara/chats/` |
| `app/test/chats.test.ts` | **Create** | Tests for conversation CRUD module |
| `app/src/components/WikiBrowser.tsx` | **Modify** | Replace inline ReactMarkdown with MarkdownContent |
| `app/src/components/ChatPanel.tsx` | **Modify** | Use MarkdownContent for assistant messages; add conversation header UI |
| `app/src/lib/ws-types.ts` | **Modify** | Add `set_conversation` client message type |
| `app/src/lib/use-chat.ts` | **Modify** | Add conversation state (activeId, list, load, create, rename, delete) |
| `app/server/index.ts` | **Modify** | Add `/api/chats` routes, handle `set_conversation` WS message, auto-save |
| `app/server/pi-manager.ts` | **Modify** | Add `onRunFinished` callback for auto-save trigger |
| `extension/src/repo.ts` | **Modify** | Add `.apara/chats/` to `initRepo()` |
| `extension/test/repo.test.ts` | **Modify** | Assert `.apara/chats/` created by initRepo |

---

### Task 1: Extract shared MarkdownContent component

Extract the `ReactMarkdown` configuration from `WikiBrowser.tsx` into a reusable component, then use it in WikiBrowser. This task touches only the markdown extraction — no ChatPanel changes yet.

**Files:**
- Create: `app/src/components/MarkdownContent.tsx`
- Modify: `app/src/components/WikiBrowser.tsx`

- [ ] **Step 1: Create MarkdownContent component**

Create `app/src/components/MarkdownContent.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  children: string;
  onLinkClick?: (wikiPath: string) => void;
}

export function MarkdownContent({ children, onLinkClick }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: linkChildren }) =>
          href?.startsWith("wiki:") && onLinkClick ? (
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => onLinkClick(href.slice(5))}
            >
              {linkChildren}
            </button>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {linkChildren}
            </a>
          ),
        h1: ({ children: c }) => (
          <h1 className="text-2xl font-semibold tracking-tight">{c}</h1>
        ),
        h2: ({ children: c }) => (
          <h2 className="text-xl font-semibold tracking-tight">{c}</h2>
        ),
        h3: ({ children: c }) => <h3 className="text-lg font-semibold">{c}</h3>,
        p: ({ children: c }) => <p className="leading-7">{c}</p>,
        ul: ({ children: c }) => <ul className="list-disc space-y-2 pl-5">{c}</ul>,
        ol: ({ children: c }) => <ol className="list-decimal space-y-2 pl-5">{c}</ol>,
        code: ({ children: c }) => (
          <code className="bg-muted rounded px-1.5 py-0.5 text-[0.9em]">{c}</code>
        ),
        pre: ({ children: c }) => (
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">{c}</pre>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 2: Update WikiBrowser to use MarkdownContent**

In `app/src/components/WikiBrowser.tsx`:

Remove these imports:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

Add this import:
```tsx
import { MarkdownContent } from "@/components/MarkdownContent";
```

Replace the `<ReactMarkdown>` block (lines 226-267) with:
```tsx
<MarkdownContent onLinkClick={openPage}>
  {renderedBody}
</MarkdownContent>
```

- [ ] **Step 3: Verify the app builds**

```bash
cd app && vp build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Verify existing tests pass**

```bash
cd app && vp test
```

Expected: All 45 tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/MarkdownContent.tsx src/components/WikiBrowser.tsx
git commit -m "refactor: extract shared MarkdownContent component from WikiBrowser"
```

---

### Task 2: Add markdown rendering to ChatPanel

Use the new `MarkdownContent` component for assistant message bubbles. User messages stay plain text.

**Files:**
- Modify: `app/src/components/ChatPanel.tsx`

- [ ] **Step 1: Update ChatPanel imports**

In `app/src/components/ChatPanel.tsx`, add this import:

```tsx
import { MarkdownContent } from "@/components/MarkdownContent";
```

- [ ] **Step 2: Update MessageBubble to render markdown for assistant messages**

Replace the `<div className="whitespace-pre-wrap break-words">` block inside `MessageBubble` (lines 105-109) with:

```tsx
{isUser ? (
  <div className="whitespace-pre-wrap break-words">{message.text}</div>
) : (
  <div className="prose-sm max-w-none space-y-2">
    <MarkdownContent onLinkClick={onOpenWikiPage}>
      {message.text}
    </MarkdownContent>
    {!message.finished && (
      <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current" />
    )}
  </div>
)}
```

Remove the old `MessageText` component and the `findWikiPageMentions` import since wiki links are now handled by `MarkdownContent`'s `onLinkClick`. Check if `findWikiPageMentions` is used elsewhere in this file — if not, remove the import:

```tsx
// Remove this import:
import { findWikiPageMentions } from "@/lib/wiki-links";
```

Also remove the `MessageText` function (lines 121-160) and the `type ReactNode` import if no longer needed.

- [ ] **Step 3: Verify the app builds**

```bash
cd app && vp build
```

Expected: Build succeeds.

- [ ] **Step 4: Verify tests pass**

```bash
cd app && vp test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/ChatPanel.tsx
git commit -m "feat: render assistant chat messages as markdown"
```

---

### Task 3: Add `.apara/chats/` to initRepo

Update the extension's `initRepo` to create the `.apara/chats/` directory in the knowledge repo.

**Files:**
- Modify: `extension/src/repo.ts`
- Modify: `extension/test/repo.test.ts`

- [ ] **Step 1: Update the test to assert `.apara/chats/` is created**

In `extension/test/repo.test.ts`, add a new assertion inside the existing `"creates raw and wiki directory structure"` test (after line 52):

```typescript
expect(existsSync(join(tempDir, ".apara/chats"))).toBe(true);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd extension && bunx vitest run test/repo.test.ts
```

Expected: The test `"creates raw and wiki directory structure"` fails with `.apara/chats` not existing.

- [ ] **Step 3: Add `.apara/chats` to initRepo dirs**

In `extension/src/repo.ts`, add to the `dirs` array (after line 49, inside `initRepo`):

```typescript
join(repoRoot, ".apara", "chats"),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd extension && bunx vitest run test/repo.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/src/repo.ts extension/test/repo.test.ts
git commit -m "feat: add .apara/chats/ directory to initRepo"
```

---

### Task 4: Conversation CRUD server module

Create `app/server/chats.ts` with functions to list, get, create, update, delete, and save conversations as JSON files.

**Files:**
- Create: `app/server/chats.ts`
- Create: `app/test/chats.test.ts`

- [ ] **Step 1: Write the tests**

Create `app/test/chats.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createChat,
  deleteChat,
  getChat,
  listChats,
  saveChat,
  updateChatTitle,
  type StoredConversation,
} from "../server/chats.js";

describe("chats", () => {
  let chatsDir: string;

  beforeEach(() => {
    const tempDir = mkdtempSync(join(tmpdir(), "apara-chats-"));
    chatsDir = join(tempDir, ".apara", "chats");
    mkdirSync(chatsDir, { recursive: true });
  });

  afterEach(() => {
    const parent = join(chatsDir, "..", "..");
    rmSync(parent, { recursive: true, force: true });
  });

  describe("createChat", () => {
    it("creates a JSON file and returns the id", () => {
      const { id } = createChat(chatsDir);
      expect(id).toBeTruthy();
      expect(existsSync(join(chatsDir, `${id}.json`))).toBe(true);
    });

    it("initializes with empty messages and default title", () => {
      const { id } = createChat(chatsDir);
      const chat = getChat(chatsDir, id);
      expect(chat).not.toBeNull();
      expect(chat!.title).toBe("New conversation");
      expect(chat!.messages).toEqual([]);
    });
  });

  describe("getChat", () => {
    it("returns null for nonexistent chat", () => {
      expect(getChat(chatsDir, "nonexistent")).toBeNull();
    });

    it("returns the stored conversation", () => {
      const { id } = createChat(chatsDir);
      const chat = getChat(chatsDir, id);
      expect(chat).not.toBeNull();
      expect(chat!.id).toBe(id);
    });
  });

  describe("listChats", () => {
    it("returns empty array when no chats exist", () => {
      expect(listChats(chatsDir)).toEqual([]);
    });

    it("returns summaries sorted by updatedAt desc", () => {
      const { id: id1 } = createChat(chatsDir);
      const chat1 = getChat(chatsDir, id1)!;
      chat1.updatedAt = "2026-04-20T10:00:00.000Z";
      saveChat(chatsDir, chat1);

      const { id: id2 } = createChat(chatsDir);
      const chat2 = getChat(chatsDir, id2)!;
      chat2.updatedAt = "2026-04-21T10:00:00.000Z";
      saveChat(chatsDir, chat2);

      const list = listChats(chatsDir);
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2);
      expect(list[1].id).toBe(id1);
    });

    it("includes messageCount but not messages", () => {
      const { id } = createChat(chatsDir);
      const chat = getChat(chatsDir, id)!;
      chat.messages = [
        { id: "m1", role: "user", text: "hello", tools: [], finished: true },
      ];
      saveChat(chatsDir, chat);

      const list = listChats(chatsDir);
      expect(list[0].messageCount).toBe(1);
      expect((list[0] as Record<string, unknown>).messages).toBeUndefined();
    });
  });

  describe("updateChatTitle", () => {
    it("updates the title of an existing chat", () => {
      const { id } = createChat(chatsDir);
      const result = updateChatTitle(chatsDir, id, "My Topic");
      expect(result).toBe(true);

      const chat = getChat(chatsDir, id)!;
      expect(chat.title).toBe("My Topic");
    });

    it("returns false for nonexistent chat", () => {
      expect(updateChatTitle(chatsDir, "nope", "title")).toBe(false);
    });
  });

  describe("deleteChat", () => {
    it("deletes the chat file", () => {
      const { id } = createChat(chatsDir);
      expect(deleteChat(chatsDir, id)).toBe(true);
      expect(existsSync(join(chatsDir, `${id}.json`))).toBe(false);
    });

    it("returns false for nonexistent chat", () => {
      expect(deleteChat(chatsDir, "nope")).toBe(false);
    });
  });

  describe("saveChat", () => {
    it("persists messages to disk", () => {
      const { id } = createChat(chatsDir);
      const chat = getChat(chatsDir, id)!;
      chat.messages = [
        { id: "m1", role: "user", text: "hello", tools: [], finished: true },
        { id: "m2", role: "assistant", text: "hi there", tools: [], finished: true },
      ];
      chat.title = "Greeting";
      saveChat(chatsDir, chat);

      const reloaded = getChat(chatsDir, id)!;
      expect(reloaded.messages).toHaveLength(2);
      expect(reloaded.title).toBe("Greeting");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && vp test chats
```

Expected: Fails because `../server/chats.js` doesn't exist yet.

- [ ] **Step 3: Implement the chats module**

Create `app/server/chats.ts`:

```typescript
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: { tool: string; status: "start" | "end" }[];
  finished: boolean;
}

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export function createChat(chatsDir: string): { id: string } {
  mkdirSync(chatsDir, { recursive: true });
  const id = randomUUID();
  const now = new Date().toISOString();
  const conversation: StoredConversation = {
    id,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  writeFileSync(join(chatsDir, `${id}.json`), JSON.stringify(conversation, null, 2));
  return { id };
}

export function getChat(chatsDir: string, id: string): StoredConversation | null {
  const filePath = join(chatsDir, `${id}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf-8")) as StoredConversation;
}

export function listChats(chatsDir: string): ChatSummary[] {
  if (!existsSync(chatsDir)) {
    return [];
  }
  const files = readdirSync(chatsDir).filter((f) => f.endsWith(".json"));
  const summaries: ChatSummary[] = [];

  for (const file of files) {
    const raw = readFileSync(join(chatsDir, file), "utf-8");
    const chat = JSON.parse(raw) as StoredConversation;
    summaries.push({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messages.length,
    });
  }

  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export function updateChatTitle(chatsDir: string, id: string, title: string): boolean {
  const chat = getChat(chatsDir, id);
  if (!chat) {
    return false;
  }
  chat.title = title;
  chat.updatedAt = new Date().toISOString();
  writeFileSync(join(chatsDir, `${id}.json`), JSON.stringify(chat, null, 2));
  return true;
}

export function deleteChat(chatsDir: string, id: string): boolean {
  const filePath = join(chatsDir, `${id}.json`);
  if (!existsSync(filePath)) {
    return false;
  }
  rmSync(filePath);
  return true;
}

export function saveChat(chatsDir: string, conversation: StoredConversation): void {
  conversation.updatedAt = new Date().toISOString();
  writeFileSync(
    join(chatsDir, `${conversation.id}.json`),
    JSON.stringify(conversation, null, 2),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && vp test chats
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd app && git add server/chats.ts test/chats.test.ts
git commit -m "feat: conversation CRUD module for .apara/chats/"
```

---

### Task 5: Add `set_conversation` to WebSocket protocol

Extend the client/server message types so the client can tell the server which conversation is active.

**Files:**
- Modify: `app/src/lib/ws-types.ts`
- Modify: `app/test/ws-types.test.ts`

- [ ] **Step 1: Add test for set_conversation parsing**

In `app/test/ws-types.test.ts`, add inside the `parseClientMessage` describe block:

```typescript
it("parses a valid set_conversation message", () => {
  const msg = parseClientMessage('{"type":"set_conversation","conversationId":"abc-123"}');
  expect(msg).toEqual({ type: "set_conversation", conversationId: "abc-123" });
});

it("returns null for set_conversation without conversationId", () => {
  expect(parseClientMessage('{"type":"set_conversation"}')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && vp test ws-types
```

Expected: 2 new tests fail.

- [ ] **Step 3: Update ws-types.ts**

In `app/src/lib/ws-types.ts`, update the `ClientMessage` type (line 1-4):

```typescript
export type ClientMessage =
  | { type: "prompt"; text: string }
  | { type: "abort" }
  | { type: "ping" }
  | { type: "set_conversation"; conversationId: string };
```

Add a case to `parseClientMessage` in the switch block (after the `"ping"` case, before `default`):

```typescript
case "set_conversation":
  if (typeof obj.conversationId !== "string" || obj.conversationId.length === 0) {
    return null;
  }
  return { type: "set_conversation", conversationId: obj.conversationId };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && vp test ws-types
```

Expected: All 12 tests pass (10 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/ws-types.ts test/ws-types.test.ts
git commit -m "feat: add set_conversation client message to WS protocol"
```

---

### Task 6: Add onRunFinished callback to PiManager

The server needs to know when a run finishes to trigger auto-save. Add an `onRunFinished` callback to `PiManager`.

**Files:**
- Modify: `app/server/pi-manager.ts`
- Modify: `app/test/pi-manager.test.ts`

- [ ] **Step 1: Add test for onRunFinished callback**

In `app/test/pi-manager.test.ts`, add a new describe block after the `"cleanup"` describe:

```typescript
describe("onRunFinished", () => {
  it("calls the callback when agent_end fires", () => {
    const callback = vi.fn();
    manager.onRunFinished(callback);

    manager.handlePrompt("hello");
    const runId = messages[0].type === "run_started" ? (messages[0] as { runId: string }).runId : "";
    mockSession.emit({ type: "agent_end", messages: [] });

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(runId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && vp test pi-manager
```

Expected: Fails because `onRunFinished` is not a function.

- [ ] **Step 3: Implement onRunFinished**

In `app/server/pi-manager.ts`, add a new private field after `messageHandler` (line 19):

```typescript
private runFinishedHandler: ((runId: string) => void) | null = null;
```

Add a new public method after `onMessage` (after line 76):

```typescript
onRunFinished(handler: (runId: string) => void): void {
  this.runFinishedHandler = handler;
}
```

In the `mapEvent` method, inside the `"agent_end"` case (line 130-136), add the callback call before setting `activeRunId` to null:

```typescript
case "agent_end": {
  const finishedRunId = this.activeRunId;
  this.emit({
    type: "run_finished",
    runId: this.activeRunId,
  });
  this.activeRunId = null;
  if (finishedRunId) {
    this.runFinishedHandler?.(finishedRunId);
  }
  break;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && vp test pi-manager
```

Expected: All 11 tests pass (10 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
cd app && git add server/pi-manager.ts test/pi-manager.test.ts
git commit -m "feat: add onRunFinished callback to PiManager"
```

---

### Task 7: Add chat REST routes and auto-save to server

Wire up `/api/chats` REST routes and the auto-save mechanism in the server.

**Files:**
- Modify: `app/server/index.ts`

- [ ] **Step 1: Add imports**

In `app/server/index.ts`, add these imports after the existing imports:

```typescript
import { createChat, deleteChat, getChat, listChats, saveChat, updateChatTitle, type StoredConversation } from "./chats.js";
```

- [ ] **Step 2: Add chatsPath constant**

After the `rawPath` constant (line 37), add:

```typescript
const chatsPath = join(resolvedRepo, ".apara", "chats");
```

- [ ] **Step 3: Add conversation tracking state**

After `let heartbeatTimer` (line 55), add:

```typescript
let activeConversation: StoredConversation | null = null;
```

- [ ] **Step 4: Add chat REST routes**

Inside the `if (url.pathname.startsWith("/api/"))` block, before the final `return new Response("Not found", { status: 404 })` (line 252), add:

```typescript
if (url.pathname === "/api/chats" && req.method === "GET") {
  return Response.json(listChats(chatsPath));
}

if (url.pathname === "/api/chats" && req.method === "POST") {
  return Response.json(createChat(chatsPath));
}

if (url.pathname.startsWith("/api/chats/")) {
  const chatId = url.pathname.slice("/api/chats/".length);
  if (!chatId) {
    return new Response("Not found", { status: 404 });
  }

  if (req.method === "GET") {
    const chat = getChat(chatsPath, chatId);
    if (!chat) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(chat);
  }

  if (req.method === "PATCH") {
    const body = (await req.json()) as { title?: string };
    if (typeof body.title !== "string") {
      return new Response("title is required", { status: 400 });
    }
    const ok = updateChatTitle(chatsPath, chatId, body.title);
    if (!ok) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const ok = deleteChat(chatsPath, chatId);
    if (!ok) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json({ ok: true });
  }
}
```

- [ ] **Step 5: Handle `set_conversation` in WebSocket message handler**

In the `websocket.message` handler's switch statement (after the `"abort"` case, around line 311), add:

```typescript
case "set_conversation": {
  const chat = getChat(chatsPath, parsed.conversationId);
  if (chat) {
    activeConversation = chat;
  }
  break;
}
```

- [ ] **Step 6: Wire auto-save on prompt**

In the `"prompt"` case of the websocket message handler, after calling `piManager?.handlePrompt(parsed.text)`, add the auto-save logic:

```typescript
case "prompt": {
  const error = piManager?.handlePrompt(parsed.text);
  if (error) {
    ws.send(JSON.stringify(error));
  } else if (activeConversation) {
    activeConversation.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      text: parsed.text,
      tools: [],
      finished: true,
    });
    saveChat(chatsPath, activeConversation);
  }
  break;
}
```

- [ ] **Step 7: Wire auto-save on run finished**

In the `websocket.open` handler, after `piManager.onMessage(...)` (line 275-277), add:

```typescript
piManager.onRunFinished(() => {
  if (activeConversation) {
    saveChat(chatsPath, activeConversation);
  }
});
```

- [ ] **Step 8: Update cleanupSession to clear conversation**

In `cleanupSession()`, add after `piManager = null`:

```typescript
activeConversation = null;
```

- [ ] **Step 9: Verify the app builds**

```bash
cd app && vp build
```

Expected: Build succeeds.

- [ ] **Step 10: Run full test suite**

```bash
cd app && vp test
```

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
cd app && git add server/index.ts
git commit -m "feat: chat REST routes and auto-save on prompt/run_finished"
```

---

### Task 8: Add conversation state to use-chat hook

Extend the `useChat` hook with conversation management: active conversation ID, list, load, create, rename, delete. The hook fetches conversation list on mount, loads the most recent (or creates one), and sends `set_conversation` over WS.

**Files:**
- Modify: `app/src/lib/use-chat.ts`

- [ ] **Step 1: Add conversation types and state**

In `app/src/lib/use-chat.ts`, add these types after the existing types:

```typescript
export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
```

Add to the `UseChatReturn` interface:

```typescript
activeConversationId: string | null;
conversations: ChatSummary[];
loadConversation: (id: string) => void;
createConversation: () => void;
renameConversation: (id: string, title: string) => void;
deleteConversation: (id: string) => void;
```

- [ ] **Step 2: Add state variables inside useChat**

After the existing `useState` calls (lines 27-29), add:

```typescript
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
const [conversations, setConversations] = useState<ChatSummary[]>([]);
const activeConversationIdRef = useRef<string | null>(null);
```

- [ ] **Step 3: Add helper to send set_conversation**

After the `connect` function, add a helper:

```typescript
function sendSetConversation(ws: WebSocket, conversationId: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_conversation", conversationId } satisfies ClientMessage));
  }
}
```

- [ ] **Step 4: Add conversation fetch on mount**

Add a new `useEffect` after the WS connect effect:

```typescript
useEffect(() => {
  let cancelled = false;

  async function initConversations() {
    const res = await fetch("/api/chats");
    if (!res.ok || cancelled) return;
    const list = (await res.json()) as ChatSummary[];

    let targetId: string;
    if (list.length > 0) {
      setConversations(list);
      targetId = list[0].id;
    } else {
      const createRes = await fetch("/api/chats", { method: "POST" });
      if (!createRes.ok || cancelled) return;
      const { id } = (await createRes.json()) as { id: string };
      targetId = id;
      const refreshRes = await fetch("/api/chats");
      if (refreshRes.ok && !cancelled) {
        setConversations((await refreshRes.json()) as ChatSummary[]);
      }
    }

    if (cancelled) return;

    const chatRes = await fetch(`/api/chats/${targetId}`);
    if (!chatRes.ok || cancelled) return;
    const chat = (await chatRes.json()) as { messages: ChatMessage[] };

    setActiveConversationId(targetId);
    activeConversationIdRef.current = targetId;
    setMessages(chat.messages);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendSetConversation(wsRef.current, targetId);
    }
  }

  void initConversations();
  return () => { cancelled = true; };
}, []);
```

- [ ] **Step 5: Send set_conversation on WS open**

In the `ws.onopen` callback (inside the `connect` function), after the ping interval setup, add:

```typescript
if (activeConversationIdRef.current) {
  sendSetConversation(ws, activeConversationIdRef.current);
}
```

- [ ] **Step 6: Add loadConversation**

Add after the `abort` callback:

```typescript
const loadConversation = useCallback(async (id: string) => {
  const res = await fetch(`/api/chats/${id}`);
  if (!res.ok) return;
  const chat = (await res.json()) as { messages: ChatMessage[] };

  setActiveConversationId(id);
  activeConversationIdRef.current = id;
  setMessages(chat.messages);
  setIsStreaming(false);
  activeRunIdRef.current = null;

  if (wsRef.current?.readyState === WebSocket.OPEN) {
    sendSetConversation(wsRef.current, id);
  }
}, []);
```

- [ ] **Step 7: Add createConversation**

```typescript
const createConversation = useCallback(async () => {
  const res = await fetch("/api/chats", { method: "POST" });
  if (!res.ok) return;
  const { id } = (await res.json()) as { id: string };

  setActiveConversationId(id);
  activeConversationIdRef.current = id;
  setMessages([]);
  setIsStreaming(false);
  activeRunIdRef.current = null;

  if (wsRef.current?.readyState === WebSocket.OPEN) {
    sendSetConversation(wsRef.current, id);
  }

  const listRes = await fetch("/api/chats");
  if (listRes.ok) {
    setConversations((await listRes.json()) as ChatSummary[]);
  }
}, []);
```

- [ ] **Step 8: Add renameConversation**

```typescript
const renameConversation = useCallback(async (id: string, title: string) => {
  const res = await fetch(`/api/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return;

  setConversations((prev) =>
    prev.map((c) => (c.id === id ? { ...c, title } : c)),
  );
}, []);
```

- [ ] **Step 9: Add deleteConversation**

```typescript
const deleteConversation = useCallback(async (id: string) => {
  const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
  if (!res.ok) return;

  setConversations((prev) => {
    const remaining = prev.filter((c) => c.id !== id);
    if (activeConversationIdRef.current === id && remaining.length > 0) {
      void loadConversation(remaining[0].id);
    } else if (remaining.length === 0) {
      void createConversation();
    }
    return remaining;
  });
}, [loadConversation, createConversation]);
```

- [ ] **Step 10: Update the return value**

Update the return statement to include the new values:

```typescript
return {
  messages,
  isConnected,
  isStreaming,
  send,
  abort,
  activeConversationId,
  conversations,
  loadConversation,
  createConversation,
  renameConversation,
  deleteConversation,
};
```

- [ ] **Step 11: Verify the app builds**

```bash
cd app && vp build
```

Expected: Build succeeds.

- [ ] **Step 12: Commit**

```bash
cd app && git add src/lib/use-chat.ts
git commit -m "feat: conversation state management in use-chat hook"
```

---

### Task 9: Conversation UI in ChatPanel header

Add the conversation list dropdown, new chat button, and title editing to the ChatPanel header.

**Files:**
- Modify: `app/src/components/ChatPanel.tsx`

- [ ] **Step 1: Update ChatPanel to use new useChat fields**

In `ChatPanel.tsx`, update the destructuring of `useChat()`:

```typescript
const {
  messages,
  isConnected,
  isStreaming,
  send,
  abort,
  activeConversationId,
  conversations,
  loadConversation,
  createConversation,
  renameConversation,
  deleteConversation,
} = useChat();
```

- [ ] **Step 2: Add conversation UI state**

After the `useChat()` call, add:

```typescript
const [showConversations, setShowConversations] = useState(false);
const [isEditingTitle, setIsEditingTitle] = useState(false);
const [editTitle, setEditTitle] = useState("");
const activeConversation = conversations.find((c) => c.id === activeConversationId);
```

Add `useState` to the React import if not already there.

- [ ] **Step 3: Add imports for icons**

Add to the top of the file:

```typescript
import { List, Plus, Trash2 } from "lucide-react";
```

- [ ] **Step 4: Replace the chat header**

Replace the existing header div (the `<div className="flex items-center justify-between border-b p-3">` block) with:

```tsx
<div className="relative border-b px-3 py-2">
  <div className="flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => setShowConversations(!showConversations)}
      title="Conversations"
    >
      <List className="h-4 w-4" />
    </Button>

    {isEditingTitle ? (
      <form
        className="flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (activeConversationId && editTitle.trim()) {
            renameConversation(activeConversationId, editTitle.trim());
          }
          setIsEditingTitle(false);
        }}
      >
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => {
            if (activeConversationId && editTitle.trim()) {
              renameConversation(activeConversationId, editTitle.trim());
            }
            setIsEditingTitle(false);
          }}
          className="h-7 text-sm"
          autoFocus
        />
      </form>
    ) : (
      <button
        type="button"
        className="hover:bg-muted flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-semibold"
        onClick={() => {
          setEditTitle(activeConversation?.title ?? "");
          setIsEditingTitle(true);
        }}
        title="Click to rename"
      >
        {activeConversation?.title ?? "Chat"}
      </button>
    )}

    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => createConversation()}
      title="New conversation"
    >
      <Plus className="h-4 w-4" />
    </Button>

    <span
      className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
      title={isConnected ? "Connected" : "Disconnected"}
    />
  </div>

  {showConversations && (
    <div className="bg-popover absolute left-0 right-0 top-full z-10 max-h-80 overflow-y-auto border-b shadow-md">
      {conversations.length === 0 ? (
        <p className="text-muted-foreground p-3 text-sm">No conversations yet.</p>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.id}
            className={`hover:bg-muted group flex cursor-pointer items-center gap-2 px-3 py-2 ${
              conv.id === activeConversationId ? "bg-muted" : ""
            }`}
            onClick={() => {
              loadConversation(conv.id);
              setShowConversations(false);
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{conv.title}</p>
              <p className="text-muted-foreground text-xs">
                {conv.messageCount} messages · {formatRelativeDate(conv.updatedAt)}
              </p>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive hidden shrink-0 group-hover:block"
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              }}
              title="Delete conversation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
    </div>
  )}
</div>
```

- [ ] **Step 5: Add formatRelativeDate helper**

Add at the bottom of the file:

```typescript
function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
```

- [ ] **Step 6: Verify the app builds**

```bash
cd app && vp build
```

Expected: Build succeeds.

- [ ] **Step 7: Run full test suite**

```bash
cd app && vp test && cd ../extension && bunx vitest run
```

Expected: All tests pass (app + extension).

- [ ] **Step 8: Commit**

```bash
cd app && git add src/components/ChatPanel.tsx
git commit -m "feat: conversation list, new chat, and title editing in ChatPanel"
```

---

### Task 10: Update plan progress and README

Update documentation to reflect the new chat maturity features.

**Files:**
- Modify: `doc/specs/2026-04-12-apara-plan.md`
- Modify: `README.md`

- [ ] **Step 1: Update the progress table**

In `doc/specs/2026-04-12-apara-plan.md`, add a new row to the Progress table after the Task 18 row:

```
| 5 | Task 19: Chat Markdown Rendering | ✅ Done | `<hash>` |
| 5 | Task 20: Persistent Named Conversations | ✅ Done | `<hash>` |
```

Update the "Current state" line to mention the new features:

```
**Current state:** All phases complete. Chat now renders markdown in assistant messages and supports persistent named conversations stored in `.apara/chats/`.
```

- [ ] **Step 2: Update README status**

In `README.md`, update the Status section (line 117-119) to:

```markdown
## Status

All planned phases complete. The APARA web app is functional with all four views (Dashboard, Wiki Browser, Source Manager, Timeline), chat with markdown rendering and persistent named conversations, cross-panel wiring, Git Sync UI, and AGENTS.md schema template. See [the implementation plan](doc/specs/2026-04-12-apara-plan.md) for full progress.
```

- [ ] **Step 3: Commit**

```bash
git add doc/specs/2026-04-12-apara-plan.md README.md
git commit -m "docs: update progress and README for chat maturity features"
```

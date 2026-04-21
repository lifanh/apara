# Chat Maturity Design Spec

> Markdown rendering in assistant messages and persistent named conversations.

## Overview

Two improvements to the chat experience that make APARA viable for daily personal knowledge management use:

1. **Markdown rendering** — assistant messages render as rich markdown (code blocks, lists, headers, tables, links) instead of plain pre-wrapped text.
2. **Named conversations** — chat history persists across page reloads as named conversations stored in the knowledge repo. Users can switch between conversations, start new ones, rename, and delete.

## Markdown Rendering

### Approach

Reuse the existing `react-markdown` + `remark-gfm` setup from `WikiBrowser.tsx`. Extract a shared `MarkdownContent` component used by both WikiBrowser and ChatPanel.

### Behavior

- **Assistant messages** get full markdown rendering: code blocks with background, lists, headers, inline code, tables, and links.
- **User messages** stay plain text — they're short prompts, not markdown.
- **Wiki page links** using the `wiki:` protocol are clickable, navigating to the wiki page in the WikiBrowser tab (same behavior as WikiBrowser).
- **Streaming cursor** (blinking `|`) is appended after the rendered markdown during streaming.

### File Changes

- Create `app/src/components/MarkdownContent.tsx` — shared component with the `react-markdown` configuration (remarkPlugins, custom component overrides for headings, code, lists, etc.).
- Modify `WikiBrowser.tsx` — replace inline `ReactMarkdown` usage with `MarkdownContent`.
- Modify `ChatPanel.tsx` — use `MarkdownContent` for assistant message bubbles.

## Conversation Storage

### Format

- Directory: `.apara/chats/` in the knowledge repo (git-synced, hidden from wiki/source views).
- One JSON file per conversation: `{id}.json`.
- `initRepo()` in `extension/src/repo.ts` updated to create `.apara/chats/`.

### Schema

```typescript
interface StoredConversation {
  id: string;           // UUID
  title: string;        // auto-generated from first user message (~60 chars, word boundary)
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
  messages: StoredMessage[];
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: { tool: string; status: "start" | "end" }[];
  finished: boolean;
}
```

### Auto-Save

The server writes the active conversation to disk on two events:

1. When a user prompt arrives (saves the new user message).
2. When a `run_finished` event fires (saves the completed assistant message).

This ensures incremental persistence — conversations survive server crashes mid-conversation.

## Server API

All routes under `/api/chats`. Authenticated when `APARA_AUTH_TOKEN` is set (same as existing API routes).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chats` | List conversations (id, title, createdAt, updatedAt, messageCount). Sorted by updatedAt desc. No messages included. |
| `GET` | `/api/chats/:id` | Full conversation with messages. |
| `POST` | `/api/chats` | Create new conversation. Returns `{ id }`. |
| `PATCH` | `/api/chats/:id` | Rename conversation. Body: `{ title }`. |
| `DELETE` | `/api/chats/:id` | Delete the conversation JSON file. |

### Server Module

New file `app/server/chats.ts` with functions:

- `listChats(chatsDir: string): ChatSummary[]`
- `getChat(chatsDir: string, id: string): StoredConversation | null`
- `createChat(chatsDir: string): { id: string }`
- `updateChatTitle(chatsDir: string, id: string, title: string): boolean`
- `deleteChat(chatsDir: string, id: string): boolean`
- `saveChat(chatsDir: string, conversation: StoredConversation): void`

## Chat Panel UI

### Header

- The static "Chat" title becomes the active conversation's title. Clicking it enables inline editing (rename).
- **"New Chat" button** (+ icon) creates a new conversation and clears the message area.
- **Conversation list toggle** (list icon) opens a dropdown/popover below the header showing recent conversations.
- Connection indicator (green/red dot) stays in its current position.

### Conversation List Dropdown

- Recent conversations sorted by `updatedAt` desc.
- Each item shows: title (truncated), relative date ("2h ago", "yesterday"), message count.
- Click to switch — loads that conversation's messages into the chat view.
- Hover reveals a delete button (trash icon).
- Scrollable, shows up to ~20 conversations.

### Behavior

- **First page load**: client fetches `GET /api/chats` via REST. If no conversations exist, creates one via `POST /api/chats` titled "New conversation". Loads the most recent conversation's messages via `GET /api/chats/:id`. Then connects WS and sends `set_conversation` with the active ID.
- **Switching conversations**: swap displayed messages (fetch via REST), send `set_conversation` over WS to update save target. Agent session stays continuous (display-only history — the agent doesn't know about conversation boundaries).
- **Chat input pre-fill** (from Dashboard/Source Manager `setChatInput`): works within the current active conversation.

### State Management

The `useChat` hook gains conversation awareness:

- `activeConversationId: string | null` — currently displayed conversation.
- `conversations: ChatSummary[]` — list for the dropdown.
- `loadConversation(id: string)` — fetch and display a conversation's messages.
- `createConversation()` — create new, clear messages, set as active.
- `renameConversation(id: string, title: string)` — PATCH request.
- `deleteConversation(id: string)` — DELETE request, switch to another or create new.

## Agent Session Lifecycle

Unchanged. One `PiManager` / `AgentSession` per WebSocket connection. Conversations are a UI/storage concept — the agent session is continuous within a connection and doesn't know about conversation boundaries. Reloading the page creates a fresh agent session as it does today.

The server needs to know the active conversation ID so it can auto-save. The client sends this via a new `ClientMessage` type:

```typescript
{ type: "set_conversation", conversationId: string }
```

Sent on WS connect (with the active conversation ID) and whenever the user switches conversations.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `app/src/components/MarkdownContent.tsx` | Shared markdown renderer component |
| `app/server/chats.ts` | Conversation CRUD (JSON file I/O) |
| `app/test/chats.test.ts` | Tests for conversation CRUD |

### Modified Files

| File | Changes |
|------|---------|
| `app/src/components/ChatPanel.tsx` | Markdown rendering for assistant messages, conversation header UI (title, new chat button, conversation list dropdown) |
| `app/src/components/WikiBrowser.tsx` | Replace inline `ReactMarkdown` with shared `MarkdownContent` |
| `app/src/lib/use-chat.ts` | Add conversation state management (activeId, list, load, create, rename, delete, auto-save coordination) |
| `app/src/lib/ws-types.ts` | Add `set_conversation` client message type |
| `app/server/index.ts` | Add `/api/chats` routes, handle `set_conversation` WS message, auto-save on prompt/run_finished |
| `app/server/pi-manager.ts` | Add `onRunFinished` callback hook for auto-save trigger |
| `extension/src/repo.ts` | Add `.apara/chats/` to `initRepo()` directory list |

## Non-Goals

- Agent context replay when switching conversations (display-only history).
- Conversation search/full-text search within conversations.
- Conversation export or sharing.
- Multi-user conversation ownership.

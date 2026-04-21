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
  writeFileSync(
    join(chatsDir, `${conversation.id}.json`),
    JSON.stringify(conversation, null, 2),
  );
}

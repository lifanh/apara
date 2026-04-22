import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createChat,
  deleteChat,
  getChat,
  isValidChatId,
  listChats,
  saveChat,
  updateChatTitle,
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
      writeFileSync(join(chatsDir, `${id1}.json`), JSON.stringify(chat1, null, 2));

      const { id: id2 } = createChat(chatsDir);
      const chat2 = getChat(chatsDir, id2)!;
      chat2.updatedAt = "2026-04-21T10:00:00.000Z";
      writeFileSync(join(chatsDir, `${id2}.json`), JSON.stringify(chat2, null, 2));

      const list = listChats(chatsDir);
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2);
      expect(list[1].id).toBe(id1);
    });

    it("skips corrupted JSON files rather than throwing", () => {
      const { id } = createChat(chatsDir);
      writeFileSync(join(chatsDir, "broken.json"), "{not valid json");

      const list = listChats(chatsDir);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(id);
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

    it("updates updatedAt timestamp on save", () => {
      const { id } = createChat(chatsDir);
      const chat = getChat(chatsDir, id)!;
      chat.updatedAt = "2020-01-01T00:00:00.000Z";
      saveChat(chatsDir, chat);

      const reloaded = getChat(chatsDir, id)!;
      expect(reloaded.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
      expect(new Date(reloaded.updatedAt).getTime()).toBeGreaterThan(
        new Date("2020-01-01T00:00:00.000Z").getTime(),
      );
    });

    it("creates the chats directory if it does not exist", () => {
      const { id } = createChat(chatsDir);
      const chat = getChat(chatsDir, id)!;
      rmSync(chatsDir, { recursive: true, force: true });

      saveChat(chatsDir, chat);

      expect(existsSync(chatsDir)).toBe(true);
      expect(existsSync(join(chatsDir, `${id}.json`))).toBe(true);
    });

    it("rejects ids with path traversal", () => {
      const chat = {
        id: "../evil",
        title: "bad",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      expect(() => saveChat(chatsDir, chat)).toThrow();
    });
  });

  describe("isValidChatId", () => {
    it("accepts UUID-formatted ids", () => {
      const { id } = createChat(chatsDir);
      expect(isValidChatId(id)).toBe(true);
    });

    it("rejects ids with path separators", () => {
      expect(isValidChatId("../evil")).toBe(false);
      expect(isValidChatId("foo/bar")).toBe(false);
      expect(isValidChatId("..")).toBe(false);
    });

    it("rejects non-UUID strings", () => {
      expect(isValidChatId("")).toBe(false);
      expect(isValidChatId("not-a-uuid")).toBe(false);
    });
  });

  describe("path traversal protection", () => {
    it("getChat rejects non-UUID ids even if a matching file exists", () => {
      writeFileSync(
        join(chatsDir, "..", "sneaky.json"),
        JSON.stringify({ id: "sneaky", title: "x", createdAt: "", updatedAt: "", messages: [] }),
      );
      expect(getChat(chatsDir, "../sneaky")).toBeNull();
      // cleanup the file we wrote outside chatsDir
      rmSync(join(chatsDir, "..", "sneaky.json"), { force: true });
    });

    it("deleteChat rejects non-UUID ids", () => {
      const outsidePath = join(chatsDir, "..", "sneaky.json");
      writeFileSync(outsidePath, "target");
      expect(deleteChat(chatsDir, "../sneaky")).toBe(false);
      expect(existsSync(outsidePath)).toBe(true);
      rmSync(outsidePath, { force: true });
    });
  });
});

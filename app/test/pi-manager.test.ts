import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PiManager } from "../server/pi-manager.js";

function createMockRpcClient() {
  const client = new EventEmitter() as EventEmitter & {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    isRunning: boolean;
  };

  client.start = vi.fn();
  client.stop = vi.fn();
  client.prompt = vi.fn().mockResolvedValue(undefined);
  client.abort = vi.fn();
  client.isRunning = false;
  return client;
}

describe("PiManager", () => {
  let manager: PiManager;
  let mockClient: ReturnType<typeof createMockRpcClient>;

  beforeEach(() => {
    mockClient = createMockRpcClient();
    manager = new PiManager(mockClient as any);
  });

  describe("handlePrompt", () => {
    it("starts the client if not running", () => {
      mockClient.isRunning = false;
      manager.handlePrompt("hello");
      expect(mockClient.start).toHaveBeenCalled();
    });

    it("does not start the client if already running", () => {
      mockClient.isRunning = true;
      manager.handlePrompt("hello");
      expect(mockClient.start).not.toHaveBeenCalled();
    });

    it("sends the prompt to the client", () => {
      mockClient.isRunning = true;
      manager.handlePrompt("hello");
      expect(mockClient.prompt).toHaveBeenCalledWith("hello");
    });

    it("returns an error if a prompt is already active", () => {
      mockClient.isRunning = true;
      manager.handlePrompt("first");

      const result = manager.handlePrompt("second");
      expect(result).toEqual({
        type: "error",
        code: "busy",
        message: "A prompt is already in progress",
      });
    });

    it("allows a new prompt after agent_end", () => {
      mockClient.isRunning = true;
      manager.handlePrompt("first");

      mockClient.emit("agent_end", { type: "agent_end", messages: [] });

      const result = manager.handlePrompt("second");
      expect(result).toBeUndefined();
      expect(mockClient.prompt).toHaveBeenCalledTimes(2);
    });
  });

  describe("handleAbort", () => {
    it("calls abort on the client", () => {
      mockClient.isRunning = true;
      manager.handleAbort();
      expect(mockClient.abort).toHaveBeenCalled();
    });
  });

  describe("event mapping", () => {
    it("maps text_delta to assistant_delta", () => {
      mockClient.isRunning = true;
      const messages: unknown[] = [];
      manager.onMessage((msg) => messages.push(msg));

      manager.handlePrompt("hello");

      mockClient.emit("event", {
        type: "message_update",
        message: {},
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: "hi there",
        },
      });

      expect(messages).toHaveLength(2);
      expect(messages[1]).toEqual(
        expect.objectContaining({
          type: "assistant_delta",
          text: "hi there",
        })
      );
    });

    it("maps tool_execution_start to tool_status start", () => {
      mockClient.isRunning = true;
      const messages: unknown[] = [];
      manager.onMessage((msg) => messages.push(msg));

      manager.handlePrompt("hello");

      mockClient.emit("event", {
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "apara_ingest",
        args: {},
      });

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: "tool_status",
          tool: "apara_ingest",
          status: "start",
        })
      );
    });

    it("maps agent_end to run_finished", () => {
      mockClient.isRunning = true;
      const messages: unknown[] = [];
      manager.onMessage((msg) => messages.push(msg));

      manager.handlePrompt("hello");
      mockClient.emit("agent_end", { type: "agent_end", messages: [] });

      expect(messages).toContainEqual(
        expect.objectContaining({ type: "run_finished" })
      );
    });
  });

  describe("cleanup", () => {
    it("stops the client", () => {
      manager.cleanup();
      expect(mockClient.stop).toHaveBeenCalled();
    });
  });
});

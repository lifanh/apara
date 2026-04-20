import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../src/lib/ws-types.js";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: vi.fn(),
  createCodingTools: vi.fn(() => []),
  SessionManager: { inMemory: vi.fn(() => ({})) },
  SettingsManager: { inMemory: vi.fn(() => ({})) },
  AuthStorage: { create: vi.fn(() => ({})) },
  ModelRegistry: { create: vi.fn(() => ({})) },
  getAgentDir: vi.fn(() => "/tmp/agent"),
}));

vi.mock("../server/tools.js", () => ({
  createAparaTools: vi.fn(() => []),
}));

const { PiManager } = await import("../server/pi-manager.js");

function createMockSession() {
  let listener: ((event: Record<string, unknown>) => void) | null = null;
  return {
    prompt: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    subscribe: vi.fn((fn: (event: Record<string, unknown>) => void) => {
      listener = fn;
      return () => {
        listener = null;
      };
    }),
    emit(event: Record<string, unknown>) {
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
    (createAgentSession as ReturnType<typeof vi.fn>).mockResolvedValue({
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

    it("returns not_ready error before init", () => {
      const uninitManager = new PiManager("/tmp/repo", "/tmp/agent");
      const result = uninitManager.handlePrompt("hello");
      expect(result).toEqual({
        type: "error",
        code: "not_ready",
        message: "Agent session not initialized",
      });
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
        expect.objectContaining({ type: "assistant_delta", text: "hi there" }),
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
        expect.objectContaining({ type: "tool_status", tool: "apara_ingest", status: "start" }),
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
        expect.objectContaining({ type: "tool_status", tool: "apara_ingest", status: "end" }),
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

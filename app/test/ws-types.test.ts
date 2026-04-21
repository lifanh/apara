import { describe, expect, it } from "vitest";
import {
  parseClientMessage,
  parseServerMessage,
} from "../src/lib/ws-types.js";

describe("ws-types", () => {
  describe("parseClientMessage", () => {
    it("parses a valid prompt message", () => {
      const msg = parseClientMessage('{"type":"prompt","text":"hello"}');
      expect(msg).toEqual({ type: "prompt", text: "hello" });
    });

    it("parses a valid abort message", () => {
      const msg = parseClientMessage('{"type":"abort"}');
      expect(msg).toEqual({ type: "abort" });
    });

    it("parses a valid ping message", () => {
      const msg = parseClientMessage('{"type":"ping"}');
      expect(msg).toEqual({ type: "ping" });
    });

    it("returns null for invalid JSON", () => {
      expect(parseClientMessage("not json")).toBeNull();
    });

    it("returns null for unknown message type", () => {
      expect(parseClientMessage('{"type":"unknown"}')).toBeNull();
    });

    it("returns null for prompt without text", () => {
      expect(parseClientMessage('{"type":"prompt"}')).toBeNull();
    });

    it("parses a valid set_conversation message", () => {
      const msg = parseClientMessage('{"type":"set_conversation","conversationId":"abc-123"}');
      expect(msg).toEqual({ type: "set_conversation", conversationId: "abc-123" });
    });

    it("returns null for set_conversation without conversationId", () => {
      expect(parseClientMessage('{"type":"set_conversation"}')).toBeNull();
    });
  });

  describe("parseServerMessage", () => {
    it("parses a run_started message", () => {
      const msg = parseServerMessage('{"type":"run_started","runId":"r1"}');
      expect(msg).toEqual({ type: "run_started", runId: "r1" });
    });

    it("parses an assistant_delta message", () => {
      const msg = parseServerMessage(
        '{"type":"assistant_delta","runId":"r1","text":"hi"}'
      );
      expect(msg).toEqual({
        type: "assistant_delta",
        runId: "r1",
        text: "hi",
      });
    });

    it("parses an error message", () => {
      const msg = parseServerMessage(
        '{"type":"error","code":"busy","message":"prompt in progress"}'
      );
      expect(msg).toEqual({
        type: "error",
        code: "busy",
        message: "prompt in progress",
      });
    });

    it("returns null for invalid JSON", () => {
      expect(parseServerMessage("bad")).toBeNull();
    });
  });
});

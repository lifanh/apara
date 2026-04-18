import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ChildProcess, spawn } from "child_process";
import { PiRpcClient } from "../src/lib/rpc-client.js";
import type { RpcEvent } from "../src/lib/rpc-types.js";

describe("PiRpcClient", () => {
  describe("instantiation", () => {
    it("can be created with options", () => {
      const client = new PiRpcClient({
        cwd: "/tmp",
        extensionPath: "/path/to/ext.ts",
        model: "claude-sonnet-4-20250514",
      });
      expect(client).toBeDefined();
      expect(client.isRunning).toBe(false);
    });

    it("starts as not running", () => {
      const client = new PiRpcClient({ cwd: "/tmp" });
      expect(client.isRunning).toBe(false);
    });
  });

  describe("JSONL parsing", () => {
    let client: PiRpcClient;
    let mockProc: ChildProcess;

    beforeEach(() => {
      client = new PiRpcClient({ cwd: "/tmp" });
      // Spawn a dummy process we can write to stdout of
      mockProc = spawn("cat", [], { stdio: ["pipe", "pipe", "pipe"] });
      // Inject the mock process
      (client as any).process = mockProc;
    });

    afterEach(() => {
      mockProc.kill();
    });

    it("parses complete JSONL lines into events", async () => {
      const events: RpcEvent[] = [];
      client.on("event", (e: RpcEvent) => events.push(e));

      // Attach the JSONL reader
      (client as any).attachStdoutReader();

      // Write a complete JSONL line to the mock process stdout
      mockProc.stdout!.push(Buffer.from('{"type":"agent_start"}\n'));

      // Give the event loop a tick
      await new Promise((r) => setTimeout(r, 10));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("agent_start");
    });

    it("handles chunked data across multiple writes", async () => {
      const events: RpcEvent[] = [];
      client.on("event", (e: RpcEvent) => events.push(e));

      (client as any).attachStdoutReader();

      // Write partial JSON, then complete it
      mockProc.stdout!.push(Buffer.from('{"type":"agent'));
      await new Promise((r) => setTimeout(r, 10));
      expect(events).toHaveLength(0);

      mockProc.stdout!.push(Buffer.from('_start"}\n'));
      await new Promise((r) => setTimeout(r, 10));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("agent_start");
    });

    it("handles multiple events in a single chunk", async () => {
      const events: RpcEvent[] = [];
      client.on("event", (e: RpcEvent) => events.push(e));

      (client as any).attachStdoutReader();

      mockProc.stdout!.push(
        Buffer.from('{"type":"agent_start"}\n{"type":"turn_start"}\n')
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("agent_start");
      expect(events[1].type).toBe("turn_start");
    });

    it("skips non-JSON lines", async () => {
      const events: RpcEvent[] = [];
      client.on("event", (e: RpcEvent) => events.push(e));

      (client as any).attachStdoutReader();

      mockProc.stdout!.push(
        Buffer.from('not json\n{"type":"agent_start"}\n')
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("agent_start");
    });

    it("handles \\r\\n line endings", async () => {
      const events: RpcEvent[] = [];
      client.on("event", (e: RpcEvent) => events.push(e));

      (client as any).attachStdoutReader();

      mockProc.stdout!.push(Buffer.from('{"type":"agent_start"}\r\n'));

      await new Promise((r) => setTimeout(r, 10));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("agent_start");
    });
  });

  describe("response correlation", () => {
    let client: PiRpcClient;
    let mockProc: ChildProcess;

    beforeEach(() => {
      client = new PiRpcClient({ cwd: "/tmp" });
      mockProc = spawn("cat", [], { stdio: ["pipe", "pipe", "pipe"] });
      (client as any).process = mockProc;
      (client as any).attachStdoutReader();
    });

    afterEach(() => {
      mockProc.kill();
    });

    it("resolves send() promise when response arrives", async () => {
      const promise = client.send({ type: "get_state" });

      // Grab the id that was assigned
      const id = (client as any).lastRequestId;

      // Simulate response from Pi Agent
      mockProc.stdout!.push(
        Buffer.from(
          JSON.stringify({
            id: `req_${id}`,
            type: "response",
            command: "get_state",
            success: true,
            data: { isStreaming: false },
          }) + "\n"
        )
      );

      const result = await promise;
      expect(result).toEqual({ isStreaming: false });
    });

    it("rejects send() promise on error response", async () => {
      const promise = client.send({ type: "set_model", provider: "x", modelId: "y" });

      const id = (client as any).lastRequestId;

      mockProc.stdout!.push(
        Buffer.from(
          JSON.stringify({
            id: `req_${id}`,
            type: "response",
            command: "set_model",
            success: false,
            error: "Model not found",
          }) + "\n"
        )
      );

      await expect(promise).rejects.toThrow("Model not found");
    });

    it("emits non-response events normally while correlating", async () => {
      const events: RpcEvent[] = [];
      client.on("event", (e: RpcEvent) => events.push(e));

      const promise = client.send({ type: "get_state" });
      const id = (client as any).lastRequestId;

      // Emit an event, then the response
      mockProc.stdout!.push(
        Buffer.from(
          '{"type":"agent_start"}\n' +
            JSON.stringify({
              id: `req_${id}`,
              type: "response",
              command: "get_state",
              success: true,
              data: {},
            }) +
            "\n"
        )
      );

      await promise;
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("agent_start");
    });
  });

  describe("prompt and helpers", () => {
    let client: PiRpcClient;
    let mockProc: ChildProcess;
    let written: string[];

    beforeEach(() => {
      client = new PiRpcClient({ cwd: "/tmp" });
      mockProc = spawn("cat", [], { stdio: ["pipe", "pipe", "pipe"] });
      (client as any).process = mockProc;
      (client as any).attachStdoutReader();

      written = [];
      const origWrite = mockProc.stdin!.write.bind(mockProc.stdin!);
      mockProc.stdin!.write = ((data: string) => {
        written.push(data);
        return origWrite(data);
      }) as any;
    });

    afterEach(() => {
      mockProc.kill();
    });

    it("prompt() sends a prompt command", () => {
      client.prompt("Hello");
      expect(written).toHaveLength(1);
      const cmd = JSON.parse(written[0].trim());
      expect(cmd.type).toBe("prompt");
      expect(cmd.message).toBe("Hello");
      expect(cmd.id).toBeDefined();
    });

    it("abort() sends an abort command", () => {
      client.abort();
      expect(written).toHaveLength(1);
      const cmd = JSON.parse(written[0].trim());
      expect(cmd.type).toBe("abort");
    });
  });

  describe("stop", () => {
    it("kills the process and sets isRunning to false", () => {
      const client = new PiRpcClient({ cwd: "/tmp" });
      const mockProc = spawn("cat", [], { stdio: ["pipe", "pipe", "pipe"] });
      (client as any).process = mockProc;

      expect(client.isRunning).toBe(true);
      client.stop();
      expect(client.isRunning).toBe(false);
    });
  });
});

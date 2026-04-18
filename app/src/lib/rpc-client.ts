import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { StringDecoder } from "string_decoder";
import type { RpcCommand, RpcEvent, RpcResponse } from "./rpc-types.js";

export interface PiRpcClientOptions {
  cwd: string;
  extensionPath?: string;
  model?: string;
}

export class PiRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";
  private decoder = new StringDecoder("utf8");
  private requestId = 0;
  private pending = new Map<
    string,
    { resolve: (data: unknown) => void; reject: (err: Error) => void }
  >();

  get lastRequestId(): number {
    return this.requestId;
  }

  constructor(private options: PiRpcClientOptions) {
    super();
  }

  start(): void {
    const args = ["--mode", "rpc", "--no-session"];
    if (this.options.extensionPath) {
      args.push("-e", this.options.extensionPath);
    }
    if (this.options.model) {
      args.push("--model", this.options.model);
    }

    this.process = spawn("pi", args, {
      cwd: this.options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.attachStdoutReader();

    this.process.stderr?.on("data", (chunk: Buffer) => {
      this.emit("stderr", chunk.toString("utf-8"));
    });

    this.process.on("exit", (code) => {
      this.emit("exit", code);
      this.process = null;
    });
  }

  private attachStdoutReader(): void {
    if (!this.process?.stdout) return;

    this.process.stdout.on("data", (chunk: Buffer | string) => {
      this.buffer +=
        typeof chunk === "string" ? chunk : this.decoder.write(chunk);

      while (true) {
        const idx = this.buffer.indexOf("\n");
        if (idx === -1) break;

        let line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.length === 0) continue;

        this.handleLine(line);
      }
    });
  }

  private handleLine(line: string): void {
    let parsed: RpcEvent;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    if (this.isResponse(parsed)) {
      const resp = parsed as RpcResponse;
      if (resp.id && this.pending.has(resp.id)) {
        const p = this.pending.get(resp.id)!;
        this.pending.delete(resp.id);
        if (resp.success) {
          p.resolve(resp.data);
        } else {
          p.reject(new Error(resp.error ?? "Unknown error"));
        }
        return;
      }
    }

    this.emit("event", parsed);
    this.emit(parsed.type, parsed);
  }

  private isResponse(obj: unknown): obj is RpcResponse {
    return (
      typeof obj === "object" &&
      obj !== null &&
      (obj as Record<string, unknown>).type === "response"
    );
  }

  send(command: RpcCommand): Promise<unknown> {
    if (!this.process?.stdin?.writable) {
      throw new Error("Pi Agent process not running");
    }

    const id = `req_${++this.requestId}`;
    const payload = { ...command, id };
    this.process.stdin.write(JSON.stringify(payload) + "\n");

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  prompt(message: string): Promise<unknown> {
    return this.send({ type: "prompt", message });
  }

  abort(): void {
    if (!this.process?.stdin?.writable) return;
    const id = `req_${++this.requestId}`;
    this.process.stdin.write(JSON.stringify({ id, type: "abort" }) + "\n");
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  waitForAgentEnd(): Promise<unknown[]> {
    return new Promise((resolve) => {
      const handler = (event: RpcEvent) => {
        if (event.type === "agent_end") {
          this.off("event", handler);
          resolve((event as { type: "agent_end"; messages: unknown[] }).messages);
        }
      };
      this.on("event", handler);
    });
  }
}

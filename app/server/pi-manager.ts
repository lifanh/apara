import { randomUUID } from "crypto";
import type { RpcEvent } from "../src/lib/rpc-types.js";
import type { ServerMessage } from "../src/lib/ws-types.js";
import type { PiRpcClient } from "./lib/rpc-client.js";

export class PiManager {
  private activeRunId: string | null = null;
  private messageHandler: ((message: ServerMessage) => void) | null = null;

  constructor(private client: PiRpcClient) {
    this.client.on("event", (event: RpcEvent) => this.mapEvent(event));
    this.client.on("agent_end", () => {
      if (!this.activeRunId) {
        return;
      }

      this.emit({
        type: "run_finished",
        runId: this.activeRunId,
      });
      this.activeRunId = null;
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

    if (!this.client.isRunning) {
      this.client.start();
    }

    this.activeRunId = randomUUID();
    this.emit({
      type: "run_started",
      runId: this.activeRunId,
    });
    void this.client.prompt(text);
    return undefined;
  }

  handleAbort(): void {
    this.client.abort();
  }

  onMessage(handler: (message: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  cleanup(): void {
    this.client.stop();
    this.activeRunId = null;
  }

  private emit(message: ServerMessage): void {
    this.messageHandler?.(message);
  }

  private mapEvent(event: RpcEvent): void {
    if (!this.activeRunId) {
      return;
    }

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
        if (typeof event.toolName !== "string") {
          break;
        }
        this.emit({
          type: "tool_status",
          runId: this.activeRunId,
          tool: event.toolName,
          status: "start",
        });
        break;
      }
      case "tool_execution_end": {
        if (typeof event.toolName !== "string") {
          break;
        }
        this.emit({
          type: "tool_status",
          runId: this.activeRunId,
          tool: event.toolName,
          status: "end",
        });
        break;
      }
    }
  }
}

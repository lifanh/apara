import { randomUUID } from "crypto";
import {
  createAgentSession,
  createCodingTools,
  SessionManager,
  SettingsManager,
  AuthStorage,
  ModelRegistry,
  type AgentSession,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import type { ServerMessage } from "../src/lib/ws-types.js";
import { createAparaTools } from "./tools.js";

export class PiManager {
  private session: AgentSession | null = null;
  private unsubscribe: (() => void) | null = null;
  private activeRunId: string | null = null;
  private messageHandler: ((message: ServerMessage) => void) | null = null;

  constructor(
    private repoPath: string,
    private agentDir: string,
  ) {}

  async init(): Promise<void> {
    const authStorage = AuthStorage.create(this.agentDir);
    const modelRegistry = ModelRegistry.create(authStorage, this.agentDir);

    const { session } = await createAgentSession({
      cwd: this.repoPath,
      agentDir: this.agentDir,
      tools: createCodingTools(this.repoPath),
      customTools: createAparaTools(this.repoPath),
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory(),
      authStorage,
      modelRegistry,
    });

    this.session = session;
    this.unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      this.mapEvent(event);
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

    if (!this.session) {
      return {
        type: "error",
        code: "not_ready",
        message: "Agent session not initialized",
      };
    }

    this.activeRunId = randomUUID();
    this.emit({ type: "run_started", runId: this.activeRunId });
    void this.session.prompt(text);
    return undefined;
  }

  handleAbort(): void {
    void this.session?.abort();
  }

  onMessage(handler: (message: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.session?.dispose();
    this.session = null;
    this.activeRunId = null;
  }

  private emit(message: ServerMessage): void {
    this.messageHandler?.(message);
  }

  private mapEvent(event: AgentSessionEvent): void {
    if (!this.activeRunId) return;

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
        if (typeof event.toolName !== "string") break;
        this.emit({
          type: "tool_status",
          runId: this.activeRunId,
          tool: event.toolName,
          status: "start",
        });
        break;
      }
      case "tool_execution_end": {
        if (typeof event.toolName !== "string") break;
        this.emit({
          type: "tool_status",
          runId: this.activeRunId,
          tool: event.toolName,
          status: "end",
        });
        break;
      }
      case "agent_end": {
        this.emit({
          type: "run_finished",
          runId: this.activeRunId,
        });
        this.activeRunId = null;
        break;
      }
    }
  }
}

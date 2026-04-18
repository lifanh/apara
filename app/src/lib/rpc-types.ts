export interface RpcPromptCommand {
  id?: string;
  type: "prompt";
  message: string;
  images?: Array<{ type: "image"; url: string }>;
  streamingBehavior?: "steer" | "followUp";
}

export interface RpcSteerCommand {
  id?: string;
  type: "steer";
  message: string;
  images?: Array<{ type: "image"; url: string }>;
}

export interface RpcFollowUpCommand {
  id?: string;
  type: "follow_up";
  message: string;
  images?: Array<{ type: "image"; url: string }>;
}

export interface RpcAbortCommand {
  id?: string;
  type: "abort";
}

export interface RpcGetStateCommand {
  id?: string;
  type: "get_state";
}

export interface RpcGetMessagesCommand {
  id?: string;
  type: "get_messages";
}

export interface RpcSetModelCommand {
  id?: string;
  type: "set_model";
  provider: string;
  modelId: string;
}

export interface RpcNewSessionCommand {
  id?: string;
  type: "new_session";
  parentSession?: string;
}

export interface RpcCompactCommand {
  id?: string;
  type: "compact";
  customInstructions?: string;
}

export interface RpcSetAutoCompactionCommand {
  id?: string;
  type: "set_auto_compaction";
  enabled: boolean;
}

export type RpcCommand =
  | RpcPromptCommand
  | RpcSteerCommand
  | RpcFollowUpCommand
  | RpcAbortCommand
  | RpcGetStateCommand
  | RpcGetMessagesCommand
  | RpcSetModelCommand
  | RpcNewSessionCommand
  | RpcCompactCommand
  | RpcSetAutoCompactionCommand
  | { id?: string; type: string; [key: string]: unknown };

export interface RpcResponse {
  id?: string;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface RpcSessionState {
  isStreaming: boolean;
  isCompacting: boolean;
  sessionId: string;
  sessionName?: string;
  messageCount: number;
  pendingMessageCount: number;
  autoCompactionEnabled: boolean;
}

export type RpcEvent =
  | RpcResponse
  | { type: "agent_start" }
  | { type: "agent_end"; messages: unknown[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: unknown; toolResults: unknown[] }
  | { type: "message_start"; message: unknown }
  | { type: "message_end"; message: unknown }
  | {
      type: "message_update";
      message: unknown;
      assistantMessageEvent: { type: string; [key: string]: unknown };
    }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; partialResult?: unknown }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: unknown; isError: boolean }
  | { type: "queue_update"; steering: string[]; followUp: string[] }
  | { type: "compaction_start"; reason: string }
  | { type: "compaction_end"; reason: string; result: unknown; aborted: boolean }
  | { type: "extension_ui_request"; id: string; method: string; [key: string]: unknown }
  | { type: "extension_error"; extensionPath: string; event: string; error: string }
  | { type: string; [key: string]: unknown };

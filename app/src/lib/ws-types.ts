export type ClientMessage =
  | { type: "prompt"; text: string }
  | { type: "abort" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "run_started"; runId: string }
  | { type: "assistant_delta"; runId: string; text: string }
  | { type: "tool_status"; runId: string; tool: string; status: "start" | "end" }
  | { type: "run_finished"; runId: string }
  | { type: "repo_changed" }
  | { type: "error"; code: string; message: string }
  | { type: "pong" };

export function parseClientMessage(raw: string): ClientMessage | null {
  const obj = parseJsonObject(raw);
  if (!obj) {
    return null;
  }

  switch (obj.type) {
    case "prompt":
      if (typeof obj.text !== "string" || obj.text.length === 0) {
        return null;
      }
      return { type: "prompt", text: obj.text };
    case "abort":
      return { type: "abort" };
    case "ping":
      return { type: "ping" };
    default:
      return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  const obj = parseJsonObject(raw);
  if (!obj || typeof obj.type !== "string") {
    return null;
  }

  return obj as ServerMessage;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

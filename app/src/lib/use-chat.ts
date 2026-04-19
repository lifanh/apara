import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "./ws-types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolEvent[];
  finished: boolean;
}

export interface ToolEvent {
  tool: string;
  status: "start" | "end";
}

interface UseChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  isStreaming: boolean;
  send: (text: string) => void;
  abort: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
        }
      }, 30_000);
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case "run_started":
          activeRunIdRef.current = msg.runId;
          setIsStreaming(true);
          setMessages((prev) => [
            ...prev,
            {
              id: msg.runId,
              role: "assistant",
              text: "",
              tools: [],
              finished: false,
            },
          ]);
          break;

        case "assistant_delta":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.runId ? { ...m, text: m.text + msg.text } : m,
            ),
          );
          break;

        case "tool_status":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.runId
                ? {
                    ...m,
                    tools:
                      msg.status === "start"
                        ? [...m.tools, { tool: msg.tool, status: "start" }]
                        : m.tools.map((t) =>
                            t.tool === msg.tool && t.status === "start"
                              ? { ...t, status: "end" as const }
                              : t,
                          ),
                  }
                : m,
            ),
          );
          break;

        case "run_finished":
          activeRunIdRef.current = null;
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.runId ? { ...m, finished: true } : m,
            ),
          );
          break;

        case "error":
          setIsStreaming(false);
          activeRunIdRef.current = null;
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: `Error: ${msg.message}`,
              tools: [],
              finished: true,
            },
          ]);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsStreaming(false);
      wsRef.current = null;
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      tools: [],
      finished: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    wsRef.current.send(
      JSON.stringify({ type: "prompt", text } satisfies ClientMessage),
    );
  }, []);

  const abort = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: "abort" } satisfies ClientMessage),
    );
  }, []);

  return { messages, isConnected, isStreaming, send, abort };
}

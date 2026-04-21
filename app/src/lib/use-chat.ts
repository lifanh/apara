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

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  isStreaming: boolean;
  send: (text: string) => void;
  abort: () => void;
  activeConversationId: string | null;
  conversations: ChatSummary[];
  loadConversation: (id: string) => void;
  createConversation: () => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);

  function sendSetConversation(ws: WebSocket, conversationId: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "set_conversation", conversationId } satisfies ClientMessage));
    }
  }

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
      if (activeConversationIdRef.current) {
        sendSetConversation(ws, activeConversationIdRef.current);
      }
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

  useEffect(() => {
    let cancelled = false;

    async function initConversations() {
      const res = await fetch("/api/chats");
      if (!res.ok || cancelled) return;
      const list = (await res.json()) as ChatSummary[];

      let targetId: string;
      if (list.length > 0) {
        setConversations(list);
        targetId = list[0].id;
      } else {
        const createRes = await fetch("/api/chats", { method: "POST" });
        if (!createRes.ok || cancelled) return;
        const { id } = (await createRes.json()) as { id: string };
        targetId = id;
        const refreshRes = await fetch("/api/chats");
        if (refreshRes.ok && !cancelled) {
          setConversations((await refreshRes.json()) as ChatSummary[]);
        }
      }

      if (cancelled) return;

      const chatRes = await fetch(`/api/chats/${targetId}`);
      if (!chatRes.ok || cancelled) return;
      const chat = (await chatRes.json()) as { messages: ChatMessage[] };

      setActiveConversationId(targetId);
      activeConversationIdRef.current = targetId;
      setMessages(chat.messages);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendSetConversation(wsRef.current, targetId);
      }
    }

    void initConversations();
    return () => { cancelled = true; };
  }, []);

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

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/chats/${id}`);
    if (!res.ok) return;
    const chat = (await res.json()) as { messages: ChatMessage[] };

    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    setMessages(chat.messages);
    setIsStreaming(false);
    activeRunIdRef.current = null;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendSetConversation(wsRef.current, id);
    }
  }, []);

  const createConversation = useCallback(async () => {
    const res = await fetch("/api/chats", { method: "POST" });
    if (!res.ok) return;
    const { id } = (await res.json()) as { id: string };

    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    setMessages([]);
    setIsStreaming(false);
    activeRunIdRef.current = null;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendSetConversation(wsRef.current, id);
    }

    const listRes = await fetch("/api/chats");
    if (listRes.ok) {
      setConversations((await listRes.json()) as ChatSummary[]);
    }
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const res = await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (!res.ok) return;

    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeConversationIdRef.current === id && remaining.length > 0) {
        void loadConversation(remaining[0].id);
      } else if (remaining.length === 0) {
        void createConversation();
      }
      return remaining;
    });
  }, [loadConversation, createConversation]);

  return {
    messages,
    isConnected,
    isStreaming,
    send,
    abort,
    activeConversationId,
    conversations,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
  };
}

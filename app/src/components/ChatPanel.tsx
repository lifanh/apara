import { useEffect, useRef, useState, type FormEvent } from "react";
import { List, Plus, Trash2 } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat, type ChatMessage } from "@/lib/use-chat";

interface ChatPanelProps {
  onOpenWikiPage: (path: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
}

export function ChatPanel({
  onOpenWikiPage,
  inputValue,
  onInputChange,
}: ChatPanelProps) {
  const {
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
  } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || !isConnected || isStreaming) return;
    send(text);
    onInputChange("");
  }

  return (
    <div className="flex h-full flex-col border-l">
      <div className="relative border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowConversations(!showConversations)}
            title="Conversations"
          >
            <List className="h-4 w-4" />
          </Button>

          {isEditingTitle ? (
            <form
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (activeConversationId && editTitle.trim()) {
                  renameConversation(activeConversationId, editTitle.trim());
                }
                setIsEditingTitle(false);
              }}
            >
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => {
                  if (activeConversationId && editTitle.trim()) {
                    renameConversation(activeConversationId, editTitle.trim());
                  }
                  setIsEditingTitle(false);
                }}
                className="h-7 text-sm"
                autoFocus
              />
            </form>
          ) : (
            <button
              type="button"
              className="hover:bg-muted flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-semibold"
              onClick={() => {
                setEditTitle(activeConversation?.title ?? "");
                setIsEditingTitle(true);
              }}
              title="Click to rename"
            >
              {activeConversation?.title ?? "Chat"}
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => createConversation()}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <span
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            title={isConnected ? "Connected" : "Disconnected"}
          />
        </div>

        {showConversations && (
          <div className="bg-popover absolute left-0 right-0 top-full z-10 max-h-80 overflow-y-auto border-b shadow-md">
            {conversations.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">No conversations yet.</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`hover:bg-muted group flex cursor-pointer items-center gap-2 px-3 py-2 ${
                    conv.id === activeConversationId ? "bg-muted" : ""
                  }`}
                  onClick={() => {
                    loadConversation(conv.id);
                    setShowConversations(false);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{conv.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {conv.messageCount} messages · {formatRelativeDate(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive hidden shrink-0 group-hover:block"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Send a message to start chatting with Pi Agent.
          </p>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenWikiPage={onOpenWikiPage}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={isConnected ? "Type here…" : "Connecting…"}
          disabled={!isConnected}
          className="flex-1"
        />
        {isStreaming ? (
          <Button type="button" size="sm" variant="destructive" onClick={abort}>
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            disabled={!inputValue.trim() || !isConnected}
          >
            Send
          </Button>
        )}
      </form>
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function MessageBubble({
  message,
  onOpenWikiPage,
}: {
  message: ChatMessage;
  onOpenWikiPage: (path: string) => void;
}) {
  const isUser = message.role === "user";
  const activeTools = message.tools.filter((t) => t.status === "start");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
        ) : (
          <div className="prose-sm max-w-none space-y-2">
            <MarkdownContent onLinkClick={onOpenWikiPage}>
              {message.text}
            </MarkdownContent>
            {!message.finished && (
              <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current" />
            )}
          </div>
        )}
        {activeTools.length > 0 && (
          <div className="text-muted-foreground mt-1 text-xs">
            ⚙ {activeTools.map((t) => t.tool).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

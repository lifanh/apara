import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat, type ChatMessage } from "@/lib/use-chat";
import { findWikiPageMentions } from "@/lib/wiki-links";

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
  const { messages, isConnected, isStreaming, send, abort } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

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
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Chat</h2>
        <span
          className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
          title={isConnected ? "Connected" : "Disconnected"}
        />
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
        <div className="whitespace-pre-wrap break-words">
          <MessageText text={message.text} onOpenWikiPage={onOpenWikiPage} />
          {!message.finished && message.role === "assistant" && (
            <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-current" />
          )}
        </div>
        {activeTools.length > 0 && (
          <div className="text-muted-foreground mt-1 text-xs">
            ⚙ {activeTools.map((t) => t.tool).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageText({
  text,
  onOpenWikiPage,
}: {
  text: string;
  onOpenWikiPage: (path: string) => void;
}) {
  const mentions = findWikiPageMentions(text);
  if (mentions.length === 0) {
    return text;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const mention of mentions) {
    if (cursor < mention.start) {
      parts.push(text.slice(cursor, mention.start));
    }

    parts.push(
      <button
        key={`${mention.start}-${mention.text}`}
        type="button"
        className="text-left align-baseline underline underline-offset-2"
        onClick={() => onOpenWikiPage(mention.path)}
      >
        {mention.text}
      </button>,
    );

    cursor = mention.end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

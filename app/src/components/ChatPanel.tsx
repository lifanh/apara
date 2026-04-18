import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatPanel() {
  const [input, setInput] = useState("");

  return (
    <div className="flex h-full flex-col border-l">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold">Chat</h2>
      </div>
      <ScrollArea className="flex-1 p-4">
        <p className="text-muted-foreground text-sm">
          Send a message to start chatting with Pi Agent.
        </p>
      </ScrollArea>
      <div className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type here…"
          className="flex-1"
        />
        <Button size="sm" disabled={!input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

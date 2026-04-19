import { useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ContentPanel } from "@/components/ContentPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SyncStatus } from "@/components/SyncStatus";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedWikiPath, setSelectedWikiPath] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  function openWikiPage(path: string) {
    setSelectedWikiPath(path.startsWith("wiki/") ? path.slice(5) : path);
    setActiveTab("wiki");
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={65} minSize={30}>
            <ContentPanel
              activeTab={activeTab}
              onTabChange={setActiveTab}
              selectedWikiPath={selectedWikiPath}
              onOpenWikiPage={openWikiPage}
              setChatInput={setChatInput}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={20}>
            <ChatPanel
              onOpenWikiPage={openWikiPage}
              inputValue={chatInput}
              onInputChange={setChatInput}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <SyncStatus />
    </div>
  );
}

export default App;

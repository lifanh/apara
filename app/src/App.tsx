import { useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ContentPanel } from "@/components/ContentPanel";
import { ChatPanel } from "@/components/ChatPanel";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedWikiPath, setSelectedWikiPath] = useState<string | null>(null);

  function openWikiPage(path: string) {
    setSelectedWikiPath(path.startsWith("wiki/") ? path.slice(5) : path);
    setActiveTab("wiki");
  }

  return (
    <div className="h-screen">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={65} minSize={30}>
          <ContentPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedWikiPath={selectedWikiPath}
            onOpenWikiPage={openWikiPage}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={20}>
          <ChatPanel onOpenWikiPage={openWikiPage} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;

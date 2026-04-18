import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ContentPanel } from "@/components/ContentPanel";
import { ChatPanel } from "@/components/ChatPanel";

function App() {
  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={65} minSize={30}>
          <ContentPanel />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={20}>
          <ChatPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;

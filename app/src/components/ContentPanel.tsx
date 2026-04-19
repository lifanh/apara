import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dashboard } from "@/components/Dashboard";
import { SourceManager } from "@/components/SourceManager";
import { Timeline } from "@/components/Timeline";
import { WikiBrowser } from "@/components/WikiBrowser";

interface ContentPanelProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  selectedWikiPath: string | null;
  onOpenWikiPage: (path: string) => void;
  setChatInput: (value: string) => void;
}

export function ContentPanel({
  activeTab,
  onTabChange,
  selectedWikiPath,
  onOpenWikiPage,
  setChatInput,
}: ContentPanelProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex h-full flex-col">
      <TabsList className="w-full justify-start rounded-none border-b">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="wiki">Wiki</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>
      <TabsContent keepMounted value="dashboard" className="flex-1 overflow-hidden">
        <Dashboard setChatInput={setChatInput} onOpenWikiPage={onOpenWikiPage} />
      </TabsContent>
      <TabsContent keepMounted value="wiki" className="flex-1 overflow-hidden">
        <WikiBrowser
          selectedPath={selectedWikiPath}
          onOpenPage={onOpenWikiPage}
        />
      </TabsContent>
      <TabsContent keepMounted value="sources" className="flex-1 overflow-hidden">
        <SourceManager setChatInput={setChatInput} />
      </TabsContent>
      <TabsContent keepMounted value="timeline" className="flex-1 overflow-hidden">
        <Timeline onOpenWikiPage={onOpenWikiPage} onTabChange={onTabChange} />
      </TabsContent>
    </Tabs>
  );
}

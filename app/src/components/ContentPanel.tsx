import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dashboard } from "@/components/Dashboard";

export function ContentPanel() {
  return (
    <Tabs defaultValue="dashboard" className="flex h-full flex-col">
      <TabsList className="w-full justify-start rounded-none border-b">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="wiki">Wiki</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="flex-1 overflow-hidden">
        <Dashboard />
      </TabsContent>
      <TabsContent value="wiki" className="flex-1 p-4">
        <p className="text-muted-foreground">Wiki — coming soon</p>
      </TabsContent>
      <TabsContent value="sources" className="flex-1 p-4">
        <p className="text-muted-foreground">Sources — coming soon</p>
      </TabsContent>
      <TabsContent value="timeline" className="flex-1 p-4">
        <p className="text-muted-foreground">Timeline — coming soon</p>
      </TabsContent>
    </Tabs>
  );
}

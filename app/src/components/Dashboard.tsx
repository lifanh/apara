import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardData {
  pending: string[];
  activePages: { path: string; title: string; type: string; linkCount: number }[];
  recentActivity: string[];
  stats: { wikiPages: number; sources: number; pendingCount: number };
}

interface DashboardProps {
  setChatInput: (value: string) => void;
  onOpenWikiPage: (path: string) => void;
}

export function Dashboard({ setChatInput, onOpenWikiPage }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-4">
        <p className="text-destructive text-sm">Failed to load dashboard: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-6 p-4 md:grid-cols-2">
        <StatsBar stats={data.stats} />

        <div className="col-span-full grid gap-6 md:grid-cols-2">
          <Widget title="Pending Inbox" badge={data.pending.length}>
            {data.pending.length === 0 ? (
              <p className="text-muted-foreground text-sm">All sources ingested</p>
            ) : (
              <ul className="space-y-1">
                {data.pending.map((source) => (
                  <li key={source}>
                    <button
                      type="button"
                      className="hover:bg-muted flex w-full items-center rounded px-1 py-0.5 text-left text-sm"
                      title={source}
                      onClick={() => setChatInput(`ingest ${source}`)}
                    >
                      <span className="text-muted-foreground mr-1.5">⬜</span>
                      <span className="truncate">{source}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <Widget title="Active Pages" badge={data.activePages.length}>
            {data.activePages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No wiki pages yet</p>
            ) : (
              <ul className="space-y-1">
                {data.activePages.map((page) => (
                  <li key={page.path}>
                    <button
                      type="button"
                      className="hover:bg-muted flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-sm"
                      onClick={() => onOpenWikiPage(page.path)}
                    >
                      <span className="truncate" title={page.path}>
                        {page.title}
                      </span>
                      <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                        {page.type} · {page.linkCount} links
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </div>

        <Widget title="Recent Activity" className="col-span-full">
          {data.recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet</p>
          ) : (
            <ul className="space-y-1">
              {data.recentActivity.map((entry, i) => (
                <li key={i} className="text-sm font-mono truncate" title={entry}>
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </ScrollArea>
  );
}

function StatsBar({
  stats,
}: {
  stats: DashboardData["stats"];
}) {
  return (
    <div className="col-span-full flex gap-6">
      <StatCard label="Wiki Pages" value={stats.wikiPages} />
      <StatCard label="Sources" value={stats.sources} />
      <StatCard label="Pending" value={stats.pendingCount} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted rounded-lg px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Widget({
  title,
  badge,
  className,
  children,
}: {
  title: string;
  badge?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge !== undefined && badge > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

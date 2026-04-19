import { useEffect, useMemo, useState } from "react";
import { FileInput, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  filterTimelineEntries,
  parseTimelineEntries,
  resolveTimelineNavigation,
  type TimelineAction,
  type TimelineEntry,
  type TimelineFilter,
} from "@/lib/timeline";

interface TimelineProps {
  onOpenWikiPage: (path: string) => void;
  onTabChange: (value: string) => void;
}

const FILTERS: Array<{ value: TimelineFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "ingest", label: "Ingest" },
  { value: "query", label: "Query" },
  { value: "lint", label: "Lint" },
];

export function Timeline({ onOpenWikiPage, onTabChange }: TimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetch("/api/log")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((rawLog) => {
        if (cancelled) {
          return;
        }
        setEntries(parseTimelineEntries(rawLog));
      })
      .catch((err: Error) => {
        if (cancelled) {
          return;
        }
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEntries = useMemo(
    () => filterTimelineEntries(entries, filter, searchText),
    [entries, filter, searchText],
  );

  function handleEntryClick(entry: TimelineEntry) {
    const target = resolveTimelineNavigation(entry.detail);
    if (!target) {
      return;
    }

    if (target.type === "wiki") {
      onOpenWikiPage(target.path);
      return;
    }

    onTabChange("sources");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <p className="text-muted-foreground mt-1 text-xs">Recent ingest, query, and lint activity</p>
      </div>

      <div className="border-b px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search timeline details"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading timeline…</p>
          ) : error ? (
            <p className="text-destructive text-sm">Failed to load timeline: {error}</p>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No timeline entries yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Activity will appear here after ingest, query, or lint actions.
              </p>
            </div>
          ) : visibleEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No entries match your filters.</p>
          ) : (
            <ol className="relative ml-2 border-l pl-5">
              {visibleEntries.map((entry) => {
                const target = resolveTimelineNavigation(entry.detail);
                const isClickable = Boolean(target);
                return (
                  <li key={entry.id} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[1.45rem] top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                      <ActionIcon action={entry.action} />
                    </span>
                    <button
                      type="button"
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        isClickable ? "hover:bg-muted cursor-pointer" : "cursor-default"
                      }`}
                      onClick={() => handleEntryClick(entry)}
                      disabled={!isClickable}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          {entry.action}
                        </span>
                        <time className="text-muted-foreground text-xs font-mono">{entry.date}</time>
                      </div>
                      <p className="text-sm break-words">{entry.detail}</p>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ActionIcon({ action }: { action: TimelineAction }) {
  switch (action) {
    case "ingest":
      return <FileInput className="h-3.5 w-3.5 text-blue-600" aria-label="ingest" />;
    case "query":
      return <Search className="h-3.5 w-3.5 text-indigo-600" aria-label="query" />;
    case "lint":
      return <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="lint" />;
  }
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { rewriteWikiLinks } from "@/lib/wiki-links";

type PageType = "entity" | "concept" | "summary" | "synthesis";

interface WikiPageSummary {
  path: string;
  title: string;
  type: PageType;
  sources: string[];
  links: string[];
  created: string;
  updated: string;
}

interface WikiPageData extends WikiPageSummary {
  body: string;
}

interface WikiBrowserProps {
  selectedPath: string | null;
  onOpenPage: (path: string) => void;
}

const PAGE_TYPE_ORDER: PageType[] = ["entity", "concept", "summary", "synthesis"];

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  entity: "Entities",
  concept: "Concepts",
  summary: "Summaries",
  synthesis: "Synthesis",
};

export function WikiBrowser({ selectedPath, onOpenPage }: WikiBrowserProps) {
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [page, setPage] = useState<WikiPageData | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(selectedPath);
  const [search, setSearch] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setIsLoadingList(true);
    fetch("/api/wiki")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<WikiPageSummary[]>;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setPages(data);
        setListError(null);
      })
      .catch((err: Error) => {
        if (cancelled) {
          return;
        }
        setListError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingList(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedPath) {
      setCurrentPath(stripWikiPrefix(selectedPath));
    }
  }, [selectedPath]);

  useEffect(() => {
    if (!currentPath && pages.length > 0) {
      setCurrentPath(stripWikiPrefix(selectedPath ?? pages[0].path));
    }
  }, [currentPath, pages, selectedPath]);

  useEffect(() => {
    if (!currentPath) {
      return;
    }

    let cancelled = false;
    setIsLoadingPage(true);

    fetch(`/api/wiki?path=${encodeURIComponent(currentPath)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<WikiPageData>;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setPage(data);
        setPageError(null);
      })
      .catch((err: Error) => {
        if (cancelled) {
          return;
        }
        setPage(null);
        setPageError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return pages;
    }
    return pages.filter((entry) => entry.title.toLowerCase().includes(query));
  }, [pages, search]);

  const groupedPages = useMemo(
    () =>
      PAGE_TYPE_ORDER.map((type) => ({
        type,
        pages: filteredPages.filter((entry) => entry.type === type),
      })).filter((group) => group.pages.length > 0),
    [filteredPages],
  );

  const renderedBody = page ? rewriteWikiLinks(page.body, pages) : "";

  function openPage(path: string) {
    const normalizedPath = stripWikiPrefix(path);
    setCurrentPath(normalizedPath);
    onOpenPage(normalizedPath);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search wiki pages"
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem,minmax(0,1fr),18rem]">
        <ScrollArea className="min-h-60 border-b lg:border-r lg:border-b-0">
          <div className="space-y-4 p-4">
            {isLoadingList ? (
              <p className="text-muted-foreground text-sm">Loading pages…</p>
            ) : listError ? (
              <p className="text-destructive text-sm">Failed to load pages: {listError}</p>
            ) : groupedPages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No wiki pages match that search.</p>
            ) : (
              groupedPages.map((group) => (
                <section key={group.type}>
                  <h3 className="mb-2 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {PAGE_TYPE_LABELS[group.type]}
                  </h3>
                  <div className="space-y-1">
                    {group.pages.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left ${
                          entry.path === currentPath
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:border-border hover:bg-muted/70"
                        }`}
                        onClick={() => openPage(entry.path)}
                      >
                        <div className="font-medium">{entry.title}</div>
                        <div className="text-muted-foreground mt-1 text-xs">{entry.path}</div>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </ScrollArea>

        <ScrollArea className="min-h-0 border-b lg:border-b-0">
          <div className="mx-auto max-w-3xl p-6">
            {pageError ? (
              <p className="text-destructive text-sm">Failed to load page: {pageError}</p>
            ) : isLoadingPage && !page ? (
              <p className="text-muted-foreground text-sm">Loading page…</p>
            ) : !page ? (
              <p className="text-muted-foreground text-sm">Select a wiki page to view it.</p>
            ) : (
              <article className="space-y-6">
                <header className="space-y-1">
                  <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                    {page.type}
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
                  <p className="text-muted-foreground text-sm">{page.path}</p>
                </header>

                <MarkdownContent onLinkClick={openPage}>
                  {renderedBody}
                </MarkdownContent>
              </article>
            )}
          </div>
        </ScrollArea>

        <ScrollArea className="min-h-60 border-t lg:border-l lg:border-t-0">
          <div className="space-y-6 p-4">
            {page ? (
              <>
                <MetadataSection title="Metadata">
                  <MetadataRow label="Created" value={page.created || "—"} />
                  <MetadataRow label="Updated" value={page.updated || "—"} />
                  <MetadataRow label="Type" value={page.type} />
                </MetadataSection>

                <MetadataSection title="Sources">
                  {page.sources.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No sources listed.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {page.sources.map((source) => (
                        <li key={source} className="bg-muted rounded-md px-3 py-2 font-mono text-xs">
                          {source}
                        </li>
                      ))}
                    </ul>
                  )}
                </MetadataSection>

                <MetadataSection title="Links">
                  {page.links.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No linked pages.</p>
                  ) : (
                    <div className="space-y-2">
                      {page.links.map((link) => (
                        <button
                          key={link}
                          type="button"
                          className="hover:bg-muted w-full rounded-md border px-3 py-2 text-left text-sm"
                          onClick={() => openPage(link)}
                        >
                          {link}
                        </button>
                      ))}
                    </div>
                  )}
                </MetadataSection>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Page metadata will appear here.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function MetadataSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function stripWikiPrefix(path: string): string {
  return path.startsWith("wiki/") ? path.slice(5) : path;
}

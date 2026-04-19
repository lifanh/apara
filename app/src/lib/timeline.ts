export type TimelineAction = "ingest" | "query" | "lint";
export type TimelineFilter = "all" | TimelineAction;

export interface TimelineEntry {
  id: string;
  date: string;
  action: TimelineAction;
  detail: string;
}

export type TimelineNavigationTarget =
  | { type: "wiki"; path: string }
  | { type: "source"; path: string };

const LOG_ENTRY_PATTERN = /^## \[(\d{4}-\d{2}-\d{2})\]\s+([a-z]+)\s*\|\s*(.+)$/gim;
const WIKI_PATH_PATTERN =
  /\b(?:wiki\/)?(entities|concepts|summaries|synthesis)\/[A-Za-z0-9._/-]+\.md\b/i;
const SOURCE_PATH_PATTERN =
  /\b(?:raw\/)?([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.[A-Za-z0-9._-]+)\b/;

export function parseTimelineEntries(rawLog: string): TimelineEntry[] {
  const entries: Array<TimelineEntry & { order: number }> = [];

  for (const [order, match] of Array.from(rawLog.matchAll(LOG_ENTRY_PATTERN)).entries()) {
    const date = match[1];
    const action = normalizeTimelineAction(match[2]);
    const detail = match[3]?.trim();

    if (!action || !detail) {
      continue;
    }

    entries.push({
      id: `${date}-${action}-${order}`,
      date,
      action,
      detail,
      order,
    });
  }

  return entries
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order)
    .map(({ order: _order, ...entry }) => entry);
}

export function filterTimelineEntries(
  entries: TimelineEntry[],
  filter: TimelineFilter,
  searchText: string,
): TimelineEntry[] {
  const normalizedSearch = searchText.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filter !== "all" && entry.action !== filter) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    return entry.detail.toLowerCase().includes(normalizedSearch);
  });
}

export function resolveTimelineNavigation(detail: string): TimelineNavigationTarget | null {
  const wikiMatch = detail.match(WIKI_PATH_PATTERN);
  if (wikiMatch) {
    return { type: "wiki", path: stripWikiPrefix(wikiMatch[0]) };
  }

  const sourceMatch = detail.match(SOURCE_PATH_PATTERN);
  if (!sourceMatch) {
    return null;
  }

  const normalizedPath = sourceMatch[1].replace(/^raw\//, "");
  if (!normalizedPath) {
    return null;
  }

  return { type: "source", path: normalizedPath };
}

function normalizeTimelineAction(value: string): TimelineAction | null {
  const action = value.trim().toLowerCase();
  if (action === "ingest" || action === "query" || action === "lint") {
    return action;
  }
  return null;
}

function stripWikiPrefix(path: string): string {
  return path.startsWith("wiki/") ? path.slice(5) : path;
}

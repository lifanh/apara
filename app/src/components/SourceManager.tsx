import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SourceListItem {
  name: string;
  size: number;
  isDirectory: boolean;
}

interface DashboardData {
  pending: string[];
}

interface SourceTreeNode {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  children: SourceTreeNode[];
}

type PreviewState =
  | { status: "idle" }
  | { status: "loading"; path: string }
  | { status: "text"; path: string; content: string }
  | { status: "binary"; path: string; size: number; kind: string }
  | { status: "error"; path: string; message: string };

interface SourceManagerProps {
  setChatInput: (value: string) => void;
}

export function SourceManager({ setChatInput }: SourceManagerProps) {
  const [sources, setSources] = useState<SourceListItem[]>([]);
  const [pendingSources, setPendingSources] = useState<Set<string>>(new Set());
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [uploadPath, setUploadPath] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tree = useMemo(() => buildTree(sources), [sources]);
  const sourceByPath = useMemo(
    () => new Map(sources.map((item) => [normalizePath(item.name), item])),
    [sources],
  );

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [sourcesResponse, dashboardResponse] = await Promise.all([
        fetch("/api/sources"),
        fetch("/api/dashboard"),
      ]);

      if (!sourcesResponse.ok || !dashboardResponse.ok) {
        throw new Error(`HTTP ${sourcesResponse.status}/${dashboardResponse.status}`);
      }

      const sourceData = (await sourcesResponse.json()) as SourceListItem[];
      const dashboardData = (await dashboardResponse.json()) as DashboardData;
      const normalizedDirectories = new Set(
        sourceData.filter((entry) => entry.isDirectory).map((entry) => normalizePath(entry.name)),
      );

      setSources(sourceData);
      setPendingSources(
        new Set((dashboardData.pending ?? []).map((entry) => normalizePath(entry))),
      );
      setExpandedDirectories((current) => {
        const next = new Set(
          [...current].filter((directoryPath) => normalizedDirectories.has(directoryPath)),
        );
        if (next.size === 0) {
          for (const directoryPath of getTopLevelDirectories(sourceData)) {
            next.add(directoryPath);
          }
        }
        return next;
      });
      setSelectedPath((current) => {
        if (!current) {
          return current;
        }
        return sourceData.some((entry) => normalizePath(entry.name) === current) ? current : null;
      });
      setUploadPath((current) => {
        if (!current) {
          return current;
        }
        return normalizedDirectories.has(current) ? current : "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function loadPreview(path: string) {
    setPreview({ status: "loading", path });

    try {
      const response = await fetch(`/api/sources?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.startsWith("text/plain")) {
        const content = await response.text();
        setPreview({ status: "text", path, content });
        return;
      }

      const metadata = (await response.json()) as { size: number; type?: string };
      setPreview({
        status: "binary",
        path,
        size: metadata.size,
        kind: metadata.type ?? "binary",
      });
    } catch (err) {
      setPreview({
        status: "error",
        path,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  function handleDirectoryToggle(path: string) {
    setSelectedPath(path);
    setUploadPath(path);
    setExpandedDirectories((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function handleFileSelect(path: string) {
    setSelectedPath(path);
    if (pendingSources.has(path)) {
      setChatInput(`ingest ${path}`);
    }
    void loadPreview(path);
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (uploadPath) {
          formData.append("path", uploadPath);
        }

        const response = await fetch("/api/sources/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || `HTTP ${response.status}`);
        }
      }

      await loadSources();
      setUploadMessage(
        files.length === 1
          ? `Uploaded ${files[0].name}`
          : `Uploaded ${files.length} files`,
      );
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    void uploadFiles(files);
    event.target.value = "";
  }

  const selectedSource = selectedPath ? sourceByPath.get(selectedPath) : null;
  const pendingCount = sources.filter(
    (entry) => !entry.isDirectory && pendingSources.has(normalizePath(entry.name)),
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Source Manager</h2>
          <p className="text-muted-foreground text-xs">
            {pendingCount} pending · {sources.length} total entries
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadSources()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem,minmax(0,1fr)]">
        <div className="border-b lg:border-r lg:border-b-0">
          <div
            className={`border-b p-3 ${
              isDragging ? "bg-primary/10 border-primary" : "bg-muted/30"
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Drop files to upload</p>
                <p className="text-muted-foreground truncate text-xs">
                  Target: raw/{uploadPath ? `${uploadPath}/` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Select
              </Button>
            </div>
            {uploadMessage && (
              <p className="text-muted-foreground mt-2 text-xs">{uploadMessage}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFileInputChange}
            />
          </div>

          <ScrollArea className="h-[calc(100%-4.5rem)]">
            <div className="p-2">
              {isLoading ? (
                <p className="text-muted-foreground px-2 py-4 text-sm">Loading sources…</p>
              ) : error ? (
                <p className="text-destructive px-2 py-4 text-sm">
                  Failed to load sources: {error}
                </p>
              ) : tree.length === 0 ? (
                <div className="px-2 py-8 text-center">
                  <p className="text-sm font-medium">No files in raw/ yet</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Drag files here to start ingesting sources.
                  </p>
                </div>
              ) : (
                <TreeView
                  nodes={tree}
                  selectedPath={selectedPath}
                  expandedDirectories={expandedDirectories}
                  pendingSources={pendingSources}
                  onDirectoryToggle={handleDirectoryToggle}
                  onFileSelect={handleFileSelect}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            <h3 className="text-sm font-semibold">Content Preview</h3>
            {!selectedPath ? (
              <p className="text-muted-foreground text-sm">
                Select a source file to preview its content.
              </p>
            ) : selectedSource?.isDirectory ? (
              <p className="text-muted-foreground text-sm">
                Selected directory: <span className="font-mono">{selectedSource.name}</span>
              </p>
            ) : preview.status === "loading" && preview.path === selectedPath ? (
              <p className="text-muted-foreground text-sm">Loading preview…</p>
            ) : preview.status === "error" && preview.path === selectedPath ? (
              <p className="text-destructive text-sm">Failed to load preview: {preview.message}</p>
            ) : preview.status === "binary" && preview.path === selectedPath ? (
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">Binary or large file</p>
                <p className="text-muted-foreground mt-1">
                  {preview.kind} · {formatSize(preview.size)}
                </p>
              </div>
            ) : preview.status === "text" && preview.path === selectedPath ? (
              <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs leading-5 whitespace-pre-wrap">
                {preview.content}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">
                Select a source file to preview its content.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function TreeView({
  nodes,
  selectedPath,
  expandedDirectories,
  pendingSources,
  onDirectoryToggle,
  onFileSelect,
}: {
  nodes: SourceTreeNode[];
  selectedPath: string | null;
  expandedDirectories: Set<string>;
  pendingSources: Set<string>;
  onDirectoryToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          expandedDirectories={expandedDirectories}
          pendingSources={pendingSources}
          onDirectoryToggle={onDirectoryToggle}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  expandedDirectories,
  pendingSources,
  onDirectoryToggle,
  onFileSelect,
}: {
  node: SourceTreeNode;
  depth: number;
  selectedPath: string | null;
  expandedDirectories: Set<string>;
  pendingSources: Set<string>;
  onDirectoryToggle: (path: string) => void;
  onFileSelect: (path: string) => void;
}) {
  const isExpanded = node.isDirectory && expandedDirectories.has(node.path);
  const isSelected = selectedPath === node.path;
  const isPending = !node.isDirectory && pendingSources.has(node.path);

  return (
    <div>
      <button
        type="button"
        className={`hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
          isSelected ? "bg-primary/10 text-primary" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => (node.isDirectory ? onDirectoryToggle(node.path) : onFileSelect(node.path))}
      >
        {node.isDirectory ? (
          <>
            <ChevronRight
              className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <span className="h-4 w-4 shrink-0" />
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{node.name}</span>
            <span className="ml-auto shrink-0">
              {isPending ? (
                <span title="Pending ingestion">
                  <CircleDashed className="h-4 w-4 text-amber-500" aria-label="pending" />
                </span>
              ) : (
                <span title="Ingested">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="ingested" />
                </span>
              )}
            </span>
          </>
        )}
      </button>
      {node.isDirectory && isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedDirectories={expandedDirectories}
              pendingSources={pendingSources}
              onDirectoryToggle={onDirectoryToggle}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildTree(items: SourceListItem[]): SourceTreeNode[] {
  const root: InternalTreeNode = {
    name: "",
    path: "",
    size: 0,
    isDirectory: true,
    childrenMap: new Map(),
  };

  for (const item of items) {
    const normalizedName = normalizePath(item.name);
    if (!normalizedName) {
      continue;
    }

    const segments = normalizedName.split("/").filter(Boolean);
    let current = root;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const path = segments.slice(0, index + 1).join("/");
      const isLast = index === segments.length - 1;
      const existing = current.childrenMap.get(segment);

      if (existing) {
        if (isLast) {
          existing.isDirectory = item.isDirectory;
          existing.size = item.size;
        }
        current = existing;
        continue;
      }

      const node: InternalTreeNode = {
        name: segment,
        path,
        size: isLast ? item.size : 0,
        isDirectory: isLast ? item.isDirectory : true,
        childrenMap: new Map(),
      };
      current.childrenMap.set(segment, node);
      current = node;
    }
  }

  return sortNodes([...root.childrenMap.values()]).map(toPublicNode);
}

function sortNodes(nodes: InternalTreeNode[]): InternalTreeNode[] {
  for (const node of nodes) {
    if (node.childrenMap.size > 0) {
      const sortedChildren = sortNodes([...node.childrenMap.values()]);
      node.childrenMap = new Map(sortedChildren.map((child) => [child.name, child]));
    }
  }

  return nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function toPublicNode(node: InternalTreeNode): SourceTreeNode {
  return {
    name: node.name,
    path: node.path,
    size: node.size,
    isDirectory: node.isDirectory,
    children: [...node.childrenMap.values()].map(toPublicNode),
  };
}

function getTopLevelDirectories(items: SourceListItem[]): string[] {
  return items
    .filter((entry) => entry.isDirectory && !normalizePath(entry.name).includes("/"))
    .map((entry) => normalizePath(entry.name));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function formatSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

interface InternalTreeNode {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  childrenMap: Map<string, InternalTreeNode>;
}

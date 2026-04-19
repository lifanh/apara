import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  remote: string | null;
}

interface GitCommandResult {
  ok: boolean;
  output: string;
}

const REFRESH_INTERVAL_MS = 15_000;

export function SyncStatus() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"pull" | "push" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/git/status");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const next = (await response.json()) as GitStatus;
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch git status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => {
      void loadStatus();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [loadStatus]);

  async function runAction(action: "pull" | "push") {
    setBusyAction(action);
    setLastOutput(null);
    setError(null);

    try {
      const response = await fetch(`/api/git/${action}`, { method: "POST" });
      const result = (await response.json()) as GitCommandResult;
      if (!result.ok) {
        setError(result.output);
      } else {
        setLastOutput(result.output);
      }
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusyAction(null);
    }
  }

  const statusText = useMemo(() => formatSyncText(status), [status]);
  const hasRemote = Boolean(status?.remote);
  const disableActions = isLoading || busyAction !== null || !hasRemote;

  return (
    <div className="border-t px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium">
          Branch:{" "}
          <span className="font-mono">{status?.branch ?? (isLoading ? "loading..." : "unknown")}</span>
        </span>
        <span className="text-muted-foreground text-xs">{statusText}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disableActions}
            onClick={() => void runAction("pull")}
          >
            {busyAction === "pull" ? "Pulling…" : "Pull"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disableActions}
            onClick={() => void runAction("push")}
          >
            {busyAction === "push" ? "Pushing…" : "Push"}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="text-destructive mt-1 text-xs">{error}</p>
      ) : lastOutput ? (
        <p className="text-muted-foreground mt-1 truncate text-xs" title={lastOutput}>
          {lastOutput}
        </p>
      ) : null}
    </div>
  );
}

function formatSyncText(status: GitStatus | null): string {
  if (!status) {
    return "loading sync status…";
  }

  if (!status.remote) {
    return "no remote";
  }

  if (status.ahead > 0 && status.behind > 0) {
    return `ahead by ${status.ahead}, behind by ${status.behind}`;
  }

  if (status.ahead > 0) {
    return `ahead by ${status.ahead}`;
  }

  if (status.behind > 0) {
    return `behind by ${status.behind}`;
  }

  return "up to date";
}

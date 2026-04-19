import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { createServer } from "net";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

interface RunningServer {
  child: ChildProcessWithoutNullStreams;
  baseUrl: string;
}

const tempDirs: string[] = [];
const runningServers: RunningServer[] = [];

afterEach(async () => {
  for (const server of runningServers.splice(0)) {
    server.child.kill("SIGTERM");
    await waitForExit(server.child);
  }

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("source upload api", () => {
  it("accepts uploads up to 10MB", async () => {
    const repoPath = createKnowledgeRepo();
    const { baseUrl } = await startServer(repoPath);

    const body = new FormData();
    body.append("path", "articles");
    body.append("file", new Blob([new TextEncoder().encode("# Small source")]), "small.md");

    const response = await fetch(`${baseUrl}/api/sources/upload`, { method: "POST", body });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, path: "articles/small.md" });
    expect(readFileSync(join(repoPath, "raw", "articles", "small.md"), "utf-8")).toBe("# Small source");
  });

  it("rejects uploads larger than 10MB with status 413", async () => {
    const repoPath = createKnowledgeRepo();
    const { baseUrl } = await startServer(repoPath);

    const body = new FormData();
    body.append("path", "articles");
    body.append("file", new Blob([new Uint8Array(MAX_UPLOAD_SIZE_BYTES + 1)]), "huge.md");

    const response = await fetch(`${baseUrl}/api/sources/upload`, { method: "POST", body });
    expect(response.status).toBe(413);
    expect(await response.text()).toContain("10MB");
    expect(existsSync(join(repoPath, "raw", "articles", "huge.md"))).toBe(false);
  });
});

function createKnowledgeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "apara-upload-api-"));
  tempDirs.push(root);

  mkdirSync(join(root, "raw", "articles"), { recursive: true });
  mkdirSync(join(root, "wiki"), { recursive: true });
  writeFileSync(join(root, ".apara.yaml"), "name: Test\nwiki_dir: wiki\nraw_dir: raw\nauto_commit: false\n");
  writeFileSync(join(root, "wiki", "index.md"), "# Index\n");
  writeFileSync(join(root, "wiki", "log.md"), "# Log\n");

  return root;
}

async function startServer(repoPath: string): Promise<{ baseUrl: string }> {
  const port = await getFreePort();
  const child = spawn("bun", ["run", "server/index.ts", "--repo", repoPath, "--port", String(port)], {
    cwd: APP_ROOT,
    env: process.env,
    stdio: "pipe",
  });
  runningServers.push({ child, baseUrl: `http://127.0.0.1:${port}` });
  await waitForHealthcheck(`http://127.0.0.1:${port}/api/dashboard`, child);
  return { baseUrl: `http://127.0.0.1:${port}` };
}

async function waitForHealthcheck(url: string, child: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 15_000;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    await sleep(150);
  }

  throw new Error(`Server healthcheck failed: ${lastError ?? "unknown error"}`);
}

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        rejectPort(new Error("Unable to allocate port"));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
    server.on("error", rejectPort);
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolveExit) => {
    if (child.exitCode !== null) {
      resolveExit();
      return;
    }
    child.once("exit", () => resolveExit());
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

import { execSync, spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createServer } from "net";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));

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

describe("git api routes", () => {
  it("returns branch with no remote and handles pull/push errors gracefully", async () => {
    const repoPath = createStandaloneRepo();
    const { baseUrl } = await startServer(repoPath);

    const statusResponse = await fetchJson(`${baseUrl}/api/git/status`);
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toMatchObject({
      branch: "main",
      ahead: 0,
      behind: 0,
      remote: null,
    });

    const pullResponse = await postJson(`${baseUrl}/api/git/pull`);
    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body.ok).toBe(false);
    expect(typeof pullResponse.body.output).toBe("string");
    expect(pullResponse.body.output.length).toBeGreaterThan(0);

    const pushResponse = await postJson(`${baseUrl}/api/git/push`);
    expect(pushResponse.status).toBe(200);
    expect(pushResponse.body.ok).toBe(false);
    expect(typeof pushResponse.body.output).toBe("string");
    expect(pushResponse.body.output.length).toBeGreaterThan(0);
  });

  it("reports ahead count and pushes commits to remote", async () => {
    const { localRepo, peerRepo } = createSyncedRepos();
    runGit(localRepo, "git config user.name \"APARA Test\"");
    runGit(localRepo, "git config user.email \"test@example.com\"");
    writeFileSync(join(localRepo, "local-change.md"), "new change\n");
    runGit(localRepo, "git add local-change.md");
    runGit(localRepo, "git commit -m \"local change\"");

    const { baseUrl } = await startServer(localRepo);

    const before = await fetchJson(`${baseUrl}/api/git/status`);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({
      branch: "main",
      ahead: 1,
      behind: 0,
      remote: "origin/main",
    });

    const pushResponse = await postJson(`${baseUrl}/api/git/push`);
    expect(pushResponse.status).toBe(200);
    expect(pushResponse.body.ok).toBe(true);

    const after = await fetchJson(`${baseUrl}/api/git/status`);
    expect(after.status).toBe(200);
    expect(after.body.ahead).toBe(0);

    runGit(peerRepo, "git fetch origin");
    const peerLog = runGit(peerRepo, "git log --oneline origin/main -1");
    expect(peerLog).toContain("local change");
  });

  it("reports behind count and pulls commits from remote", async () => {
    const { localRepo, peerRepo } = createSyncedRepos();
    runGit(peerRepo, "git config user.name \"APARA Test\"");
    runGit(peerRepo, "git config user.email \"test@example.com\"");
    writeFileSync(join(peerRepo, "peer-change.md"), "peer change\n");
    runGit(peerRepo, "git add peer-change.md");
    runGit(peerRepo, "git commit -m \"peer change\"");
    runGit(peerRepo, "git push");

    runGit(localRepo, "git fetch");
    const { baseUrl } = await startServer(localRepo);

    const before = await fetchJson(`${baseUrl}/api/git/status`);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({
      branch: "main",
      ahead: 0,
      behind: 1,
      remote: "origin/main",
    });

    const pullResponse = await postJson(`${baseUrl}/api/git/pull`);
    expect(pullResponse.status).toBe(200);
    expect(pullResponse.body.ok).toBe(true);

    const after = await fetchJson(`${baseUrl}/api/git/status`);
    expect(after.status).toBe(200);
    expect(after.body.behind).toBe(0);
    expect(readFileSync(join(localRepo, "peer-change.md"), "utf-8")).toBe("peer change\n");
  });
});

function createStandaloneRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "apara-git-no-remote-"));
  tempDirs.push(root);
  runGit(root, "git init -b main");
  runGit(root, "git config user.name \"APARA Test\"");
  runGit(root, "git config user.email \"test@example.com\"");
  writeKnowledgeRepoFiles(root);
  runGit(root, "git add .");
  runGit(root, "git commit -m \"init\"");
  return root;
}

function createSyncedRepos(): { localRepo: string; peerRepo: string } {
  const root = mkdtempSync(join(tmpdir(), "apara-git-remote-"));
  tempDirs.push(root);

  const seedRepo = join(root, "seed");
  mkdirSync(seedRepo, { recursive: true });
  runGit(seedRepo, "git init -b main");
  runGit(seedRepo, "git config user.name \"APARA Test\"");
  runGit(seedRepo, "git config user.email \"test@example.com\"");
  writeKnowledgeRepoFiles(seedRepo);
  runGit(seedRepo, "git add .");
  runGit(seedRepo, "git commit -m \"seed\"");

  const remoteRepo = join(root, "remote.git");
  runGit(root, `git clone --bare "${seedRepo}" "${remoteRepo}"`);

  const localRepo = join(root, "local");
  const peerRepo = join(root, "peer");
  runGit(root, `git clone "${remoteRepo}" "${localRepo}"`);
  runGit(root, `git clone "${remoteRepo}" "${peerRepo}"`);

  return { localRepo, peerRepo };
}

function writeKnowledgeRepoFiles(repoPath: string) {
  mkdirSync(join(repoPath, "raw"), { recursive: true });
  mkdirSync(join(repoPath, "wiki"), { recursive: true });
  writeFileSync(join(repoPath, ".apara.yaml"), "name: Test\nwiki_dir: wiki\nraw_dir: raw\nauto_commit: false\n");
  writeFileSync(join(repoPath, "raw", "sample.md"), "# Sample\n");
  writeFileSync(join(repoPath, "wiki", "index.md"), "# Index\n");
  writeFileSync(join(repoPath, "wiki", "log.md"), "# Log\n");
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

async function fetchJson(url: string): Promise<{ status: number; body: any }> {
  const response = await fetch(url);
  return { status: response.status, body: await response.json() };
}

async function postJson(url: string): Promise<{ status: number; body: any }> {
  const response = await fetch(url, { method: "POST" });
  return { status: response.status, body: await response.json() };
}

function runGit(cwd: string, command: string): string {
  return execSync(command, { cwd, encoding: "utf-8" }).trim();
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

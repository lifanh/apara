import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";
import type { ServerWebSocket } from "bun";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { parseClientMessage, type ServerMessage } from "../src/lib/ws-types.js";
import { checkAuth, createAuthCookie, isAuthEnabled, validateOrigin } from "./auth.js";
import { getDashboardData } from "./dashboard.js";
import { getGitStatus, runGitPull, runGitPush } from "./git.js";
import { safePath } from "./path-utils.js";
import { PiManager } from "./pi-manager.js";
import { getSourcePreview, listSources, writeUploadedSource } from "./sources.js";
import { getWikiPageData, listWikiPages } from "./wiki.js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    repo: { type: "string" },
    port: { type: "string", default: "3000" },
  },
});

const repoPath = values.repo ?? process.env.APARA_REPO_PATH;
if (!repoPath) {
  console.error(
    "Error: No knowledge repo path provided.\n\n" +
      "Usage:\n" +
      "  bun run server/index.ts --repo /path/to/knowledge-repo\n\n" +
      "Or set the APARA_REPO_PATH environment variable."
  );
  process.exit(1);
}

const resolvedRepo = resolve(repoPath);
const configPath = join(resolvedRepo, ".apara.yaml");
const wikiPath = join(resolvedRepo, "wiki");
const rawPath = join(resolvedRepo, "raw");

if (!existsSync(configPath) && !(existsSync(wikiPath) && existsSync(rawPath))) {
  console.error(
    `Error: ${resolvedRepo} does not appear to be an APARA knowledge repo.\n` +
      "Expected .apara.yaml or wiki/ + raw/ directories."
  );
  process.exit(1);
}

const port = Number.parseInt(values.port ?? "3000", 10);
const hostname = isAuthEnabled() ? "0.0.0.0" : "127.0.0.1";
const distPath = join(import.meta.dir, "..", "dist");
const hasDistFiles = existsSync(distPath);
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

let piManager: PiManager | null = null;
let activeWs: ServerWebSocket<unknown> | null = null;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

function resetHeartbeat() {
  if (!activeWs) {
    return;
  }

  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
  }

  heartbeatTimer = setTimeout(() => {
    activeWs?.close(1001, "Heartbeat timeout");
    cleanupSession();
  }, 60_000);
}

function cleanupSession() {
  piManager?.cleanup();
  piManager = null;
  activeWs = null;
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
}

const server = Bun.serve({
  port,
  hostname,

  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      if (isAuthEnabled()) {
        const cookie = req.headers.get("cookie") ?? "";
        const origin = req.headers.get("origin");
        if (!checkAuth(cookie) || !validateOrigin(origin, url.host)) {
          return new Response("Unauthorized", { status: 401 });
        }
      }

      if (!server.upgrade(req)) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    if (url.pathname === "/api/auth" && req.method === "POST") {
      if (!isAuthEnabled()) {
        return Response.json({ ok: true });
      }

      const body = (await req.json()) as { token?: string };
      if (body.token && body.token === process.env.APARA_AUTH_TOKEN) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": createAuthCookie(body.token, url.protocol === "https:"),
          },
        });
      }

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
      return new Response("Unauthorized", { status: 401 });
    }

    if (url.pathname.startsWith("/api/")) {
      if (isAuthEnabled()) {
        const cookie = req.headers.get("cookie") ?? "";
        if (!checkAuth(cookie)) {
          return new Response("Unauthorized", { status: 401 });
        }
      }

      if (url.pathname === "/api/dashboard") {
        return Response.json(getDashboardData(wikiPath, rawPath));
      }

      if (url.pathname === "/api/config") {
        if (!existsSync(configPath)) {
          return Response.json({});
        }
        return Response.json({ raw: readFileSync(configPath, "utf-8") });
      }

      if (url.pathname === "/api/wiki") {
        const requestedPath = url.searchParams.get("path");
        if (requestedPath) {
          const fullPath = safePath(wikiPath, requestedPath);
          if (!fullPath) {
            return new Response("Forbidden", { status: 403 });
          }
          if (!existsSync(fullPath)) {
            return new Response("Not found", { status: 404 });
          }

          const page = getWikiPageData(wikiPath, requestedPath);
          if (!page) {
            return new Response("Not found", { status: 404 });
          }

          return Response.json(page);
        }

        return Response.json(listWikiPages(wikiPath));
      }

      if (url.pathname === "/api/sources") {
        const requestedPath = url.searchParams.get("path");
        if (requestedPath) {
          const fullPath = safePath(rawPath, requestedPath);
          if (!fullPath) {
            return new Response("Forbidden", { status: 403 });
          }
          if (!existsSync(fullPath)) {
            return new Response("Not found", { status: 404 });
          }

          const preview = getSourcePreview(fullPath, requestedPath);
          if (typeof preview === "string") {
            return new Response(preview, {
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }

          return Response.json(preview);
        }

        return Response.json(listSources(rawPath));
      }

      if (url.pathname === "/api/sources/upload" && req.method === "POST") {
        let formData: FormData;
        try {
          formData = await req.formData();
        } catch {
          return new Response("Invalid multipart payload", { status: 400 });
        }

        const file = formData.get("file");
        const pathField = formData.get("path");
        if (!(file instanceof File)) {
          return new Response("file is required", { status: 400 });
        }
        if (pathField !== null && typeof pathField !== "string") {
          return new Response("Invalid path", { status: 400 });
        }
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          return new Response("Upload too large: file size exceeds 10MB limit", { status: 413 });
        }

        try {
          const relativePath = writeUploadedSource(
            rawPath,
            pathField ?? "",
            file.name,
            new Uint8Array(await file.arrayBuffer()),
          );
          return Response.json({ ok: true, path: relativePath });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          if (message === "Forbidden") {
            return new Response(message, { status: 403 });
          }
          if (message === "Invalid file name") {
            return new Response(message, { status: 400 });
          }
          return new Response(message, { status: 500 });
        }
      }

      if (url.pathname === "/api/log") {
        const logPath = join(wikiPath, "log.md");
        return new Response(existsSync(logPath) ? readFileSync(logPath, "utf-8") : "", {
          headers: { "Content-Type": "text/markdown" },
        });
      }

      if (url.pathname === "/api/git/status") {
        try {
          return Response.json(getGitStatus(resolvedRepo));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to get git status";
          return new Response(message, { status: 500 });
        }
      }

      if (url.pathname === "/api/git/pull" && req.method === "POST") {
        return Response.json(runGitPull(resolvedRepo));
      }

      if (url.pathname === "/api/git/push" && req.method === "POST") {
        return Response.json(runGitPush(resolvedRepo));
      }

      return new Response("Not found", { status: 404 });
    }

    if (hasDistFiles) {
      const filePath = join(distPath, url.pathname === "/" ? "index.html" : url.pathname);
      if (existsSync(filePath)) {
        return new Response(Bun.file(filePath));
      }
      return new Response(Bun.file(join(distPath, "index.html")));
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      if (activeWs) {
        ws.close(1008, "Only one session at a time");
        return;
      }

      activeWs = ws;
      piManager = new PiManager(resolvedRepo, getAgentDir());
      piManager.onMessage((message: ServerMessage) => {
        ws.send(JSON.stringify(message));
      });
      piManager.init().catch((err) => {
        ws.send(JSON.stringify({
          type: "error",
          code: "init_failed",
          message: err instanceof Error ? err.message : "Failed to initialize agent",
        } satisfies ServerMessage));
        ws.close(1011, "Agent init failed");
      });
      resetHeartbeat();
    },

    message(ws, message) {
      const raw =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const parsed = parseClientMessage(raw);
      if (!parsed) {
        return;
      }

      resetHeartbeat();

      switch (parsed.type) {
        case "prompt": {
          const error = piManager?.handlePrompt(parsed.text);
          if (error) {
            ws.send(JSON.stringify(error));
          }
          break;
        }
        case "abort":
          piManager?.handleAbort();
          break;
        case "ping":
          ws.send(JSON.stringify({ type: "pong" satisfies ServerMessage["type"] }));
          break;
      }
    },

    close() {
      setTimeout(() => cleanupSession(), 5_000);
    },
  },
});

console.log(`APARA server running on http://${hostname}:${port}`);
console.log(`Knowledge repo: ${resolvedRepo}`);
console.log(
  isAuthEnabled()
    ? "Auth: enabled (APARA_AUTH_TOKEN set)"
    : "Auth: disabled (local mode, bound to 127.0.0.1)"
);

process.on("SIGINT", () => {
  cleanupSession();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanupSession();
  server.stop();
  process.exit(0);
});

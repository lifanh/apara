import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { parseArgs } from "util";
import type { ServerWebSocket } from "bun";
import { parseClientMessage, type ServerMessage } from "../src/lib/ws-types.js";
import { checkAuth, createAuthCookie, isAuthEnabled, validateOrigin } from "./auth.js";
import { PiRpcClient } from "./lib/rpc-client.js";
import { PiManager } from "./pi-manager.js";

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

function safePath(base: string, requested: string): string | null {
  const fullPath = resolve(base, requested);
  const rel = relative(base, fullPath);
  if (rel.startsWith("..") || rel === "") {
    if (rel === "") {
      return fullPath;
    }
    return null;
  }
  return fullPath;
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
      if (body.token === process.env.APARA_AUTH_TOKEN) {
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
          return new Response(readFileSync(fullPath, "utf-8"), {
            headers: { "Content-Type": "text/markdown" },
          });
        }

        if (!existsSync(wikiPath)) {
          return Response.json([]);
        }

        const files = readdirSync(wikiPath, { recursive: true }) as string[];
        return Response.json(files.filter((file) => file.endsWith(".md")));
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

          const fileStat = statSync(fullPath);
          if (
            fileStat.size < 1_000_000 &&
            /\.(md|txt|yaml|yml|json|csv|tsv)$/i.test(requestedPath)
          ) {
            return new Response(readFileSync(fullPath, "utf-8"), {
              headers: { "Content-Type": "text/plain" },
            });
          }

          return Response.json({
            name: requestedPath,
            size: fileStat.size,
            type: "binary",
          });
        }

        if (!existsSync(rawPath)) {
          return Response.json([]);
        }

        const files = readdirSync(rawPath, { recursive: true }) as string[];
        return Response.json(
          files.map((file) => {
            const fullPath = join(rawPath, file);
            const fileStat = statSync(fullPath);
            return {
              name: file,
              size: fileStat.size,
              isDirectory: fileStat.isDirectory(),
            };
          })
        );
      }

      if (url.pathname === "/api/log") {
        const logPath = join(wikiPath, "log.md");
        return new Response(existsSync(logPath) ? readFileSync(logPath, "utf-8") : "", {
          headers: { "Content-Type": "text/markdown" },
        });
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
      piManager = new PiManager(
        new PiRpcClient({
          cwd: resolvedRepo,
          extensionPath: resolve(import.meta.dir, "../../extension/apara.ts"),
        })
      );
      piManager.onMessage((message: ServerMessage) => {
        ws.send(JSON.stringify(message));
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

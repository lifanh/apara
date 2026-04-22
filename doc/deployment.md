# Deployment Guide

## Prerequisites

- **Bun ≥1.1** — runtime and package manager
- **Git** — required for sync and version history
- **LLM API key** — Anthropic, OpenAI, or Google depending on your model
- **A knowledge repo** — initialize one using the Pi Agent extension (`apara_ingest` tool)

## Local Production Run

```bash
bun install
bun run build
APARA_REPO_PATH=/path/to/knowledge-repo ANTHROPIC_API_KEY=sk-... bun run start
```

The server binds to `127.0.0.1:3000` by default. Set `APARA_AUTH_TOKEN` to bind to `0.0.0.0` for non-localhost access.

## Docker Deployment

Build the image:

```bash
docker build -t apara .
```

Run the container:

```bash
docker run -d \
  --name apara \
  -p 3000:3000 \
  -e APARA_REPO_PATH=/data/knowledge-repo \
  -e ANTHROPIC_API_KEY=sk-... \
  -e APARA_AUTH_TOKEN=your-secret-token \
  -v /path/to/knowledge-repo:/data/knowledge-repo \
  apara
```

## Docker Compose

Create a `.env` file from `.env.example`, then:

```bash
docker compose up -d
```

This references the included `docker-compose.yml`. Ensure `APARA_REPO_PATH`, your LLM API key, and the volume mount are configured in `.env`.

## Environment Variables

| Variable | Required? | Default | Description |
|---|---|---|---|
| `APARA_REPO_PATH` | Yes | — | Absolute path to the APARA knowledge repo |
| `APARA_AUTH_TOKEN` | No | — | Bearer token for API auth; when set, server binds to `0.0.0.0` |
| `APARA_ALLOWED_ORIGIN` | No | same-origin | Restrict CORS to a specific origin |
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API key (if using Claude models) |
| `OPENAI_API_KEY` | Yes* | — | OpenAI API key (if using OpenAI models) |
| `GOOGLE_API_KEY` | Yes* | — | Google API key (if using Gemini models) |
| `PORT` | No | `3000` | Server listen port |

*At least one LLM provider key is required.

## Reverse Proxy

### Caddy

```caddyfile
apara.example.com {
  reverse_proxy localhost:3000
}
```

Caddy handles TLS automatically. WebSocket connections are proxied by default.

### nginx

```nginx
server {
    listen 443 ssl;
    server_name apara.example.com;

    ssl_certificate     /etc/ssl/certs/apara.pem;
    ssl_certificate_key /etc/ssl/private/apara.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Persistent Storage

The knowledge repo must live on a persistent volume when running in containers. Git history, wiki pages, and raw sources all reside in this directory. If the container is destroyed without a persistent mount, all knowledge data is lost.

For Docker, use a bind mount (`-v /host/path:/container/path`) or a named volume. For Kubernetes, use a PersistentVolumeClaim.

## Health Checks

| Endpoint | Behavior |
|---|---|
| `GET /health` | Always returns `200 OK`. Use for liveness probes. |
| `GET /ready` | Returns `200` if `wiki/` and `raw/` directories exist in the knowledge repo. Returns `503 Service Unavailable` if either is missing. Use for readiness probes. |

Example Docker health check:

```bash
docker run -d \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  ...
  apara
```

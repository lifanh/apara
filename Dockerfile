FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY app/package.json app/
COPY extension/package.json extension/
RUN bun install --frozen-lockfile

COPY . .

RUN cd app && bun run build

FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/app/server/ ./app/server/
COPY --from=build /app/app/dist/ ./app/dist/
COPY --from=build /app/app/package.json ./app/
COPY --from=build /app/app/src/lib/ ./app/src/lib/
COPY --from=build /app/package.json ./
COPY --from=build /app/extension/ ./extension/

EXPOSE 3000

ENV NODE_ENV=production
ENV APARA_BIND_HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "app/server/index.ts"]

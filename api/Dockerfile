# Stage 1: Build React UI
FROM node:20-slim AS ui-builder
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/index.html ui/tsconfig.json ui/vite.config.ts ./
COPY ui/src ./src
RUN npm run build

# Stage 2: API runtime
FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

COPY api/package*.json ./
RUN npm ci

COPY api/src ./src
COPY api/tsconfig.json ./

# Copy built UI into public/ so Express can serve it
COPY --from=ui-builder /ui/dist ./public

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/recruitiq.db
ENV FIXTURE_PATH=/data/fixtures.json

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]

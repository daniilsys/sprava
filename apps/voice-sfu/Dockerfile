# ── Base ───────────────────────────────────────────────────────────────────────
# Debian slim (glibc) — mediasoup pre-built ARM64 binary runs natively, no compilation needed
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# ── Builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy workspace manifests for layer-cache-friendly install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/voice-sfu/package.json ./apps/voice-sfu/package.json

# Install deps (mediasoup downloads pre-built binary — no C++ compilation)
RUN pnpm install --frozen-lockfile --filter voice-sfu...

# Copy source and compile TypeScript
COPY apps/voice-sfu/ ./apps/voice-sfu/
RUN pnpm --filter voice-sfu build

# Create a self-contained deployment in /standalone
# (copies dist/ + node_modules/ with only prod deps)
RUN pnpm deploy --filter voice-sfu --prod --legacy /standalone

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

COPY --from=builder /standalone ./

ENV NODE_ENV=production

# ── Required environment variables ────────────────────────────────────────────
# REDIS_URL              e.g. redis://redis:6379
# MEDIASOUP_LISTEN_IP    IP the worker binds to        (default: 0.0.0.0)
# MEDIASOUP_ANNOUNCED_IP public/NAT IP sent to clients (default: 127.0.0.1)
# RTC_MIN_PORT           lower bound of UDP range      (default: 10000)
# RTC_MAX_PORT           upper bound of UDP range      (default: 59999)

# Expose mediasoup WebRTC port range (publish at runtime with -p or in compose)
EXPOSE 10000-59999/udp
EXPOSE 10000-59999/tcp

CMD ["node", "dist/index.js"]

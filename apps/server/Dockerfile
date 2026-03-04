FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

WORKDIR /app

# Copy workspace manifests for layer-cache-friendly install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY apps/server/package.json ./apps/server/package.json

RUN pnpm install --frozen-lockfile

# Prisma client generation requires the DB package sources.
COPY packages/db/ ./packages/db/
RUN pnpm --filter @sprava/db generate

COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

# Build API once at image build time.
RUN pnpm --filter server build

ENV NODE_ENV=production
EXPOSE 3000

# Run compiled server (tsx loader keeps workspace TS packages compatible).
WORKDIR /app/apps/server
CMD ["node", "--import", "tsx", "dist/server.js"]

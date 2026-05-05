# ─────────────────────────────────────────────────────────────────────────────
# ResortPro API — multi-stage Docker build
# Build context: repo ROOT  (docker build -f apps/api/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 2: install dependencies ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy the entire repo so pnpm can resolve all workspace packages correctly
COPY . .

# Install all deps (workspace needs all package.json files present)
RUN pnpm install --frozen-lockfile

# ── Stage 3: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Restore installed workspace
COPY --from=deps /app ./

# 1. Generate Prisma client
RUN pnpm --filter @resort-pro/database exec prisma generate

# 2. Bundle API with tsup — @resort-pro/* are inlined, @prisma/client stays external
RUN pnpm --filter @resort-pro/api build

# 3. Create a flattened production-only node_modules (resolves all pnpm symlinks)
RUN pnpm deploy --filter @resort-pro/api --prod /standalone

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies (real files, no symlinks)
COPY --from=builder /standalone/node_modules         ./node_modules

# Prisma native query engine + generated client
COPY --from=builder /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma        ./node_modules/@prisma

# Prisma schema + migrations (needed for `prisma migrate deploy`)
COPY --from=builder /app/packages/database/prisma    ./prisma

# Compiled bundle (tsup output — single CJS file + sourcemap)
COPY --from=builder /app/apps/api/dist               ./dist
COPY --from=builder /app/apps/api/package.json       ./package.json

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Run migrations then start the server
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/index.js"]

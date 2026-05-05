# ─────────────────────────────────────────────────────────────────────────────
# ResortPro API — multi-stage Docker build
# Build context: repo ROOT  (docker build -f apps/api/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
# Install pnpm directly via npm — more reliable than corepack in CI/Docker
RUN npm install -g pnpm@9

# ── Stage 2: install + build ──────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy full repo so pnpm workspace resolves all packages
COPY . .

# Install all deps
RUN pnpm install --no-frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @resort-pro/database exec prisma generate

# Bundle API with tsup — @resort-pro/* inlined, @prisma/client stays external
RUN pnpm --filter @resort-pro/api build

# Flatten production deps (resolves pnpm symlinks → real files, no devDeps)
RUN pnpm deploy --filter @resort-pro/api --prod /standalone

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app
ENV NODE_ENV=production

# Production node_modules (flattened, no symlinks)
COPY --from=builder /standalone/node_modules         ./node_modules

# Prisma native query engine + generated client
COPY --from=builder /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma        ./node_modules/@prisma

# Prisma schema + migrations
COPY --from=builder /app/packages/database/prisma    ./prisma

# Compiled bundle
COPY --from=builder /app/apps/api/dist               ./dist
COPY --from=builder /app/apps/api/package.json       ./package.json

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/index.js"]

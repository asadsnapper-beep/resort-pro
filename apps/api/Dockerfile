# ─────────────────────────────────────────────────────────────────────────────
# ResortPro API — multi-stage Docker build
# Build context: repo ROOT  (docker build -f apps/api/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN npm install -g pnpm@9

# ── Stage 2: install + build ──────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile

# Generate Prisma client (explicit schema path — works with shamefully-hoist)
RUN cd packages/database && npx prisma generate --schema=prisma/schema.prisma

# Bundle API — tsup inlines @resort-pro/* and keeps @prisma/client external
RUN pnpm --filter @resort-pro/api build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app
ENV NODE_ENV=production

# Copy the full pnpm virtual store (contains all deps + generated Prisma client)
COPY --from=builder /app/node_modules   ./node_modules

# Prisma schema + migrations (for prisma migrate deploy at startup)
COPY --from=builder /app/packages/database/prisma   ./prisma

# Bundled API output
COPY --from=builder /app/apps/api/dist   ./dist
COPY --from=builder /app/apps/api/package.json   ./package.json

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/scripts/seed-demo.js; node dist/index.js"]

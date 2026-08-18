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

# Scoped to @resort-pro/api + its workspace deps, not the whole workspace —
# see apps/web/Dockerfile's identical fix for why: an unscoped install here
# has the same latent risk of pulling in apps/desktop's electron (irrelevant
# to this image) and failing on its large, occasionally-flaky binary
# download. This build happened not to hit it yet, but it's the same bug.
RUN pnpm install --no-frozen-lockfile --filter "@resort-pro/api..."

# Generate Prisma client (explicit schema path — works with shamefully-hoist)
RUN cd packages/database && npx prisma generate --schema=prisma/schema.prisma

# Bundle API — tsup inlines @resort-pro/* and keeps @prisma/client external
RUN pnpm --filter @resort-pro/api build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
# postgresql-client supplies pg_dump/pg_restore for the backup sidecar, which
# runs this same image. Baking them in rather than bind-mounting scripts from
# the host: the staging deploy hands Portainer the compose file as a *string*,
# so the repo is not on that host and a bind mount would silently resolve to
# nothing.
RUN apk add --no-cache openssl wget postgresql16-client
WORKDIR /app
ENV NODE_ENV=production

# Copy the full pnpm virtual store (contains all deps + generated Prisma client)
COPY --from=builder /app/node_modules   ./node_modules

# Prisma schema + migrations (for prisma migrate deploy at startup)
COPY --from=builder /app/packages/database/prisma   ./prisma

# Bundled API output
COPY --from=builder /app/apps/api/dist   ./dist
COPY --from=builder /app/apps/api/package.json   ./package.json

# Backup/restore scripts — versioned with the code that they protect.
COPY scripts/backup-db.sh scripts/restore-db.sh   ./scripts/
RUN chmod +x ./scripts/*.sh

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/scripts/seed-demo.js && node dist/scripts/seed-admin.js && node dist/index.js"]

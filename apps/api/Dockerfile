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

# Bundle API with tsup — @resort-pro/* inlined, @prisma/client stays external
RUN pnpm --filter @resort-pro/api build

# Flatten production deps into /standalone (resolves pnpm symlinks → real files)
RUN pnpm deploy --filter @resort-pro/api --prod /standalone

# Copy prisma schema into standalone and generate client there
# This ensures .prisma/client lands inside /standalone/node_modules
RUN cp -r packages/database/prisma /standalone/prisma
WORKDIR /standalone
RUN npx prisma generate --schema=prisma/schema.prisma

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl wget
WORKDIR /app
ENV NODE_ENV=production

# Everything comes from the standalone deploy directory
COPY --from=builder /standalone/node_modules   ./node_modules
COPY --from=builder /standalone/prisma         ./prisma
COPY --from=builder /app/apps/api/dist         ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/index.js"]

# ─────────────────────────────────────────────────────────────────────────────
# ResortPro Web — Next.js standalone Docker build
# Build context: repo ROOT  (docker build -f apps/web/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 2: install all deps ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json               ./apps/web/
COPY packages/types/package.json         ./packages/types/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY . .

# NEXT_PUBLIC_API_URL bakes into the client bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @resort-pro/web build

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output (includes its own node_modules + server.js)
# outputFileTracingRoot=repo root → standalone lands at .next/standalone/
COPY --from=builder /app/apps/web/.next/standalone          ./
# Static assets must be copied alongside server.js
COPY --from=builder /app/apps/web/.next/static              ./apps/web/.next/static
COPY --from=builder /app/apps/web/public                    ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# server.js is at apps/web/server.js when outputFileTracingRoot is repo root
CMD ["node", "apps/web/server.js"]

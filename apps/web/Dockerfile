# ─────────────────────────────────────────────────────────────────────────────
# ResortPro Web — Next.js standalone Docker build
# Build context: repo ROOT  (docker build -f apps/web/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 2: install dependencies ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy the entire repo so pnpm can resolve all workspace packages correctly
COPY . .

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Restore installed workspace
COPY --from=deps /app ./

# NEXT_PUBLIC_API_URL bakes into the client bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @resort-pro/web build

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output includes its own node_modules + server.js
# outputFileTracingRoot=repo root → standalone lands reflecting monorepo structure
COPY --from=builder /app/apps/web/.next/standalone          ./
COPY --from=builder /app/apps/web/.next/static              ./apps/web/.next/static
COPY --from=builder /app/apps/web/public                    ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]

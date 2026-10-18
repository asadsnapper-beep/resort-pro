# ─────────────────────────────────────────────────────────────────────────────
# ResortPro Web — Next.js standalone Docker build
# Build context: repo ROOT  (docker build -f apps/web/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# Base image comes from our own GHCR copy of the Docker official node image,
# made by .github/workflows/mirror-base-images.yml. Docker Hub refused these
# pulls with 429 "unauthenticated pull rate limit"; AWS public ECR then refused
# them with 429 "Data limit exceeded". Both quotas are per source IP on shared
# runners and neither is ours to raise. GHCR is not metered against us and the
# build jobs already log in to it.
#
# Pinned by digest so a build is reproducible and upstream cannot change what
# we ship. To refresh: run the "Mirror base images to GHCR" workflow, take the
# digest from its job summary, and update NODE_IMAGE here and in
# apps/api/Dockerfile. That is a deliberate commit, not an automatic one.
#
# Overridable for a local build without GHCR access:
#   docker build --build-arg NODE_IMAGE=node:20-alpine -f apps/web/Dockerfile .
ARG NODE_IMAGE=ghcr.io/asadsnapper-beep/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat python3 make g++
# Install pnpm directly via npm — more reliable than corepack in CI/Docker
RUN npm install -g pnpm@9

# ── Stage 2: install + build ──────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy full repo so pnpm workspace resolves all packages
COPY . .

# Install only @resort-pro/web + its workspace dependencies — NOT the whole
# workspace. An unscoped `pnpm install` here also installed apps/desktop's
# electron (a package this image never uses), whose postinstall downloads
# a large Chromium binary from GitHub's CDN — that download hung/reset
# ("socket hang up") twice in a row and failed the whole build both times,
# even though nothing about electron was ever needed to build the web app.
# @resort-pro/embed is not a dependency of web, but web's build bundles it into
# public/embed.js (scripts/bundle-embed.mjs), so its vite toolchain has to be
# installed too. Without it the build stops with a message saying exactly this.
RUN pnpm install --no-frozen-lockfile --filter "@resort-pro/web..." --filter "@resort-pro/embed"

# NEXT_PUBLIC_* vars bake into the client bundle at build time — must be
# passed as build args, not just runtime env, or they silently stay unset.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLARITY_ID=""
ENV NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID

RUN pnpm --filter @resort-pro/web build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output (self-contained server.js + node_modules)
COPY --from=builder /app/apps/web/.next/standalone          ./
COPY --from=builder /app/apps/web/.next/static              ./apps/web/.next/static
# public/ may be empty — copy only if it contains files (gitkeep ensures dir exists)
COPY --from=builder /app/apps/web/public/                   ./apps/web/public/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]

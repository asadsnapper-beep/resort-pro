# Part 10 — Deployment & Infrastructure

## Overview
Docker-based deployment। Production-এ **Coolify** দিয়ে host করা হবে। Local dev-এ Docker Compose।

---

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | internal | Primary database |
| redis | redis:7-alpine | internal | Cache + session |
| api | custom Dockerfile | 4000 | Fastify backend |
| web | custom Dockerfile | 3000 | Next.js frontend |

---

## Docker Compose Files

### Local Development (`docker-compose.yml`)
```bash
docker compose up -d postgres redis mail
```
- postgres, redis, MailHog (local email testing)
- API + web local-এ `pnpm dev` দিয়ে চালানো হয়

### Production (`docker-compose.production.yml` / `coolify.yml`)
```bash
docker compose -f docker-compose.production.yml --env-file .env.production up --build
```
- সব 4 service চলে
- Coolify SSL termination handle করে
- Port 80/443 expose করা হয় না (Coolify করে)

---

## Dockerfiles

### API Dockerfile (`apps/api/Dockerfile`)
```dockerfile
FROM node:20-alpine
WORKDIR /app
# Install pnpm, copy workspace files
# Run prisma generate
# Build TypeScript
# Start: node dist/index.js
```

### Web Dockerfile (`apps/web/Dockerfile`)
```dockerfile
FROM node:20-alpine AS builder
# Build args: NEXT_PUBLIC_API_URL
# Next.js standalone build

FROM node:20-alpine AS runner
# Copy .next/standalone
# Start: node server.js
```

---

## Environment Variables

### API (apps/api)
```env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
DATABASE_URL=postgresql://user:pass@postgres:5432/resortpro
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=15m
CORS_ORIGIN=https://your-domain.com
APP_DOMAIN=resortpro.app

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=ResortPro <noreply@resortpro.app>

# Admin
SUPER_ADMIN_EMAILS=your@email.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Web (apps/web)
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

---

## Coolify Deployment Steps

1. Coolify-তে নতুন project → "Docker Compose" select
2. Repo connect → compose file: `docker-compose.production.yml`
3. Coolify UI-তে সব environment variables set করুন
4. Deploy — Coolify automatically SSL + reverse proxy handle করবে

---

## Health Checks

### API Health
```
GET /health → { status: "ok", timestamp, version }
```
Docker healthcheck: `wget -qO- http://localhost:4000/health || exit 1`

### Service Dependencies
```
api → depends on: postgres (healthy), redis (healthy)
web → depends on: api (healthy)
```

---

## Local Development Setup

```bash
# 1. Clone repo
git clone ...
cd "Hotel management"

# 2. Install dependencies
pnpm install

# 3. Start Docker services
docker compose up -d postgres redis mail

# 4. Setup database
cd packages/database
cp .env.example .env
# Edit DATABASE_URL
npx prisma migrate dev
npx prisma db seed

# 5. Start API
cd apps/api
cp .env.example .env
# Fill in env vars
pnpm dev  # runs on :4000

# 6. Start Web
cd apps/web
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm dev  # runs on :3000
```

---

## pnpm Workspace Commands

```bash
# Run specific app
pnpm --filter api dev
pnpm --filter web dev

# Build all
pnpm build

# Database
pnpm --filter @resort-pro/database migrate:dev
pnpm --filter @resort-pro/database generate
pnpm --filter @resort-pro/database seed
```

---

## Key Files
| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local dev services |
| `docker-compose.production.yml` | Production deployment |
| `coolify.yml` | Coolify-specific compose (same as production) |
| `apps/api/Dockerfile` | API container build |
| `apps/web/Dockerfile` | Web container build |
| `.env.example` | Environment variable template |
| `pnpm-workspace.yaml` | Monorepo workspace config |

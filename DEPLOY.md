# ResortPro — Coolify Deployment Guide

## Architecture

```
Internet
   │
   ▼
Coolify (Traefik reverse proxy + Let's Encrypt SSL)
   ├── app.yourdomain.com  → web  (Next.js,  port 3000)
   ├── api.yourdomain.com  → api  (Fastify,   port 4000)
   ├── postgres            → internal Docker network only
   └── redis               → internal Docker network only
```

---

## Prerequisites

- VPS with **Coolify v4** installed (DigitalOcean, Hetzner, etc.)
- Domain pointed to your server:
  ```
  A    app.yourdomain.com   →  <server IP>
  A    api.yourdomain.com   →  <server IP>
  A    *.yourdomain.com     →  <server IP>   ← for tenant custom domains
  ```
- GitHub repo connected to Coolify

---

## Step 1 — Add Project in Coolify

1. **Projects → New Project** → name it `ResortPro`
2. Inside the project → **New Resource → Docker Compose**
3. **Source**: Connect your GitHub repo
4. **Compose file**: `docker-compose.coolify.yml`  ← use this file, NOT the other one
5. **Branch**: `main`

---

## Step 2 — Set Environment Variables

In Coolify → **Environment Variables** tab, add every variable below.

> ⚠️ `API_URL` is **baked into the Next.js bundle at build time**.  
> If it's wrong, the browser can't reach the API. Set it before the first build.

```env
# === REQUIRED — set these before first deploy ===

# Your API public URL (MUST be https:// — used by the browser)
API_URL=https://api.yourdomain.com

# Your web app public URL
WEB_URL=https://app.yourdomain.com

# For Traefik routing labels in docker-compose.coolify.yml
API_DOMAIN=api.yourdomain.com
WEB_DOMAIN=app.yourdomain.com

# Platform root domain
APP_DOMAIN=yourdomain.com

# Database (Postgres will auto-create this DB)
POSTGRES_USER=resortpro
POSTGRES_PASSWORD=<strong random password>
POSTGRES_DB=resortpro

# Auth — generate with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-byte hex string>
JWT_EXPIRES_IN=7d

# === OPTIONAL (app still works without these) ===

# Email — get from https://resend.com/api-keys
RESEND_API_KEY=re_xxxx

# Stripe — get from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
STRIPE_PRICE_STARTER=price_xxxx
STRIPE_PRICE_PRO=price_xxxx
STRIPE_PRICE_ENTERPRISE=price_xxxx

# Super admin logins (comma-separated)
SUPER_ADMIN_EMAILS=you@yourdomain.com
```

---

## Step 3 — Configure Domains in Coolify

After saving environment variables, go to each service and set its domain:

| Service    | Domain                    |
|------------|---------------------------|
| `api`      | `api.yourdomain.com`      |
| `web`      | `app.yourdomain.com`      |
| `postgres` | *(no domain — internal)*  |
| `redis`    | *(no domain — internal)*  |

Coolify handles **SSL (Let's Encrypt)** automatically once the domain is set.

---

## Step 4 — Deploy

Click **Deploy**. Coolify will:
1. Pull the repo
2. Build the `api` Docker image (runs `prisma generate` + `tsup` build)
3. Build the `web` Docker image (runs `next build` with `NEXT_PUBLIC_API_URL` baked in)
4. Start `postgres` and `redis` first (healthcheck)
5. Start `api` → runs `prisma migrate deploy` automatically on startup
6. Start `web`

First build takes ~5-8 minutes (pnpm install + TypeScript compile).

---

## Troubleshooting

### Web loads but API calls fail (network error / 502)

**Cause**: `NEXT_PUBLIC_API_URL` was wrong at build time.

**Fix**:
1. Correct `API_URL` in Coolify environment variables
2. **Rebuild** (not just restart) — click **Rebuild** in Coolify

### API container keeps restarting

Check API logs in Coolify. Common causes:

| Log message | Fix |
|---|---|
| `connect ECONNREFUSED postgres` | Postgres healthcheck not passing yet — wait or increase `start_period` |
| `JWT_SECRET is not set` | Add `JWT_SECRET` env var |
| `migrate deploy` failed | See migration errors below |

### Prisma migration fails on startup

Run the migration manually via Coolify's **Terminal** tab on the `api` container:
```bash
node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
```

### CORS errors in browser console

`CORS_ORIGIN` on the API must match your web app URL exactly (including https, no trailing slash):
```
WEB_URL=https://app.yourdomain.com   ← no trailing slash
```

### Tenant custom domains not resolving

Add a wildcard DNS record:
```
A    *.yourdomain.com   →  <server IP>
```

### Build fails with "Cannot find module"

Run `pnpm install` locally and commit the updated `pnpm-lock.yaml`:
```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "update lockfile"
git push
```

---

## Updating (Redeploy)

Push to `main` → Coolify auto-deploys (if webhook is configured).

Or manually click **Redeploy** in Coolify.

> If you changed any `NEXT_PUBLIC_*` env vars, you must **Rebuild** (not just Redeploy) because those values are baked in at build time.

---

## Local Production Test

Before deploying to Coolify, test the production build locally:

```bash
# 1. Copy and fill env file
cp .env.example .env.production
# Edit .env.production — set API_URL=http://localhost:4000, WEB_URL=http://localhost:3000

# 2. Build and run
docker compose -f docker-compose.production.yml --env-file .env.production up --build

# 3. Open
#   Web: http://localhost:3000
#   API: http://localhost:4000/docs
```

---

## Useful Coolify Commands (via Terminal tab)

```bash
# View running processes
ps aux

# Check DB connection
node_modules/.bin/prisma db pull --schema=prisma/schema.prisma

# Run DB migration manually
node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

# Open Prisma Studio (then expose port temporarily in Coolify)
node_modules/.bin/prisma studio --schema=prisma/schema.prisma
```

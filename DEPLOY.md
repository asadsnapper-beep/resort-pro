# ResortPro — Coolify Deployment Guide

## Prerequisites
- A VPS (DigitalOcean, Hetzner, etc.) with Coolify installed
- A domain pointed to your server (e.g. `resortpro.app`)
- GitHub repo connected to Coolify

---

## Architecture

```
Internet → Coolify (Traefik reverse proxy + SSL)
               ├── web  (Next.js)  → :3000
               ├── api  (Fastify)  → :4000
               ├── postgres        → :5432 (internal only)
               └── redis           → :6379 (internal only)
```

---

## Step-by-Step Coolify Setup

### 1. Add a New Project in Coolify
1. Go to **Projects → New Project** → name it `ResortPro`

### 2. Add a Docker Compose Service
1. Inside the project → **New Resource → Docker Compose**
2. **Source**: Connect your GitHub repo
3. **Compose file**: `docker-compose.production.yml`
4. **Branch**: `main`

### 3. Set Environment Variables
In Coolify's **Environment Variables** tab, add all variables from `.env.example`:

| Variable | Example | Notes |
|----------|---------|-------|
| `API_URL` | `https://api.yourdomain.com` | Your API's public URL |
| `WEB_URL` | `https://app.yourdomain.com` | Your web app's public URL |
| `APP_DOMAIN` | `resortpro.app` | Platform root domain |
| `APP_IP` | `1.2.3.4` | Server public IP (optional) |
| `POSTGRES_PASSWORD` | *(strong random string)* | DB password |
| `REDIS_PASSWORD` | *(strong random string)* | Redis password |
| `JWT_SECRET` | *(64-byte hex)* | Generate below |
| `RESEND_API_KEY` | `re_xxx...` | From resend.com |
| `STRIPE_SECRET_KEY` | `sk_live_xxx...` | From stripe.com |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx...` | From stripe.com |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Configure Domains in Coolify
For each service, add a domain in the **Domains** tab:

| Service | Domain example |
|---------|---------------|
| `web` | `app.yourdomain.com` |
| `api` | `api.yourdomain.com` |

Coolify handles **SSL (Let's Encrypt)** automatically.

### 5. Deploy
Click **Deploy** — Coolify will:
1. Pull your repo
2. Build both Docker images
3. Run `prisma migrate deploy` on first API start
4. Start all services

---

## DNS Records

Point your domain to your server IP:

```
A    app.yourdomain.com    →  <server IP>
A    api.yourdomain.com    →  <server IP>
A    *.yourdomain.com      →  <server IP>   ← for custom tenant domains
```

The wildcard `*` record enables custom domain white-labelling for resort owners.

---

## Updating (Zero-downtime)

Push to `main` → Coolify auto-deploys (if webhook is configured):
```bash
git push origin main
```

Or manually click **Redeploy** in Coolify.

---

## Local Production Test

Before deploying to Coolify, test locally:

```bash
# 1. Copy and fill env file
cp .env.example .env.production

# 2. Build and run
docker compose -f docker-compose.production.yml --env-file .env.production up --build

# 3. Open
#   Web: http://localhost:3000
#   API: http://localhost:4000/docs
```

---

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs -f web

# Run a DB migration manually
docker compose -f docker-compose.production.yml exec api \
  node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

# Open Prisma Studio (local only)
docker compose -f docker-compose.production.yml exec api \
  node_modules/.bin/prisma studio --schema=prisma/schema.prisma

# Restart a service
docker compose -f docker-compose.production.yml restart api
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API won't start | Check `DATABASE_URL` is correct and postgres is healthy |
| Web shows API error | Verify `NEXT_PUBLIC_API_URL` matches your actual API domain |
| Migrations fail | Run migration command manually (see above) |
| Custom domains not working | Make sure wildcard DNS `*.yourdomain.com` is set |
| Build fails (tsup) | Run `pnpm install` locally and commit updated `pnpm-lock.yaml` |

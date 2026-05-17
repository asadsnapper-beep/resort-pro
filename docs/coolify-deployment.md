# Coolify Deployment Guide — ResortPro

সব কিছু যা শিখলাম Coolify-তে ResortPro deploy করতে গিয়ে।

---

## 📋 Server Info

| Item | Value |
|------|-------|
| Server IP | `88.99.141.243` |
| Domain | `resortpro.site` |
| Web App | `https://app.resortpro.site` |
| API | `https://api.resortpro.site` |
| Coolify Dashboard | `http://88.99.141.243:8000` |
| Coolify Version | v4 |

---

## 🏗️ Architecture

```
Browser
  │
  ├── https://app.resortpro.site  →  Next.js (port 3000)
  └── https://api.resortpro.site  →  Fastify API (port 4000)
                                         │
                                    PostgreSQL (5432)
                                    Redis (6379)

Coolify → Traefik (reverse proxy) → Docker containers
```

---

## 🐳 Docker Setup

### Strategy
- **Local Mac → build → push to GHCR → Coolify pulls image**
- Server-এ build করা যায় না (OOM — server RAM কম)
- GitHub Actions build-ও কাজ করেনি (esbuild export* issue)

### Image Registry
```
ghcr.io/asadsnapper-beep/resort-pro-api:latest
ghcr.io/asadsnapper-beep/resort-pro-web:latest
```

### GHCR Login (local Mac থেকে)
```bash
echo "GITHUB_TOKEN" | docker login ghcr.io -u asadsnapper-beep --password-stdin
```

### API Image Build & Push
```bash
cd "Hotel management"
docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile \
  -t ghcr.io/asadsnapper-beep/resort-pro-api:latest \
  --push \
  .
```

### Web Image Build & Push
> ⚠️ **CRITICAL:** `NEXT_PUBLIC_API_URL` must be passed at BUILD TIME — না হলে `localhost:4000` bake হয়ে যায়!

```bash
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=https://api.resortpro.site \
  -f apps/web/Dockerfile \
  -t ghcr.io/asadsnapper-beep/resort-pro-web:latest \
  --push \
  .
```

### Platform Flag কেন লাগে?
Mac (ARM/Apple Silicon) → `arm64` build করে, কিন্তু server চলে `linux/amd64`।
`--platform linux/amd64` ছাড়া server-এ "no matching manifest" error আসে।

---

## 🔧 Coolify Setup

### Deployment Type
**Docker Compose (Empty)** → `docker-compose.coolify.yml` paste করতে হয়

### Network
Coolify-এর external network `coolify`-তে join করতে হয়:
```yaml
networks:
  coolify:
    external: true
```

### Coolify-তে Image Redeploy
নতুন image push করার পর Coolify dashboard থেকে:
**Project → web/api service → Deploy button click**

---

## 🌍 Cloudflare DNS

```
Type  Name  Content          Proxy
A     app   88.99.141.243    🔴 DNS only (এখন)
A     api   88.99.141.243    🔴 DNS only (এখন)
```

### ⚠️ SSL সমস্যা
DNS only mode-এ Traefik-এর self-signed cert ব্যবহার হয়:
```
subject= /CN=TRAEFIK DEFAULT CERT
```
Browser এটা trust করে না → XHR/fetch block হয় → Login fail দেখায়।

### Temporary Fix (browser)
1. `https://api.resortpro.site/health` এ যাও
2. "Advanced" → "Proceed to api.resortpro.site (unsafe)" click করো
3. এখন login কাজ করবে

### Permanent Fix (recommended)
Cloudflare DNS-এ `app` এবং `api` records orange cloud (Proxied) করো → SSL/TLS → Full mode।

---

## 🗄️ Database

### Schema Sync
Coolify terminal-এ (API container):
```bash
node_modules/.bin/prisma db push --schema=prisma/schema.prisma --accept-data-loss
```

### Migration
```bash
node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
```

---

## 👤 User Management

### Super Admin (AdminUser table — আলাদা)
Login URL: `https://app.resortpro.site/admin/login`

Super admin create করতে (Coolify API terminal-এ):
```bash
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('YOUR_PASSWORD', 12);
  await prisma.adminUser.create({
    data: {
      email: 'your@email.com',
      passwordHash: hash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    }
  });
  console.log('Admin created!');
  await prisma.\$disconnect();
}
main().catch(console.error);
"
```

### Tenant Owner (regular user — slug দরকার)
Login URL: `https://app.resortpro.site/auth/login`

Tenant + Owner create করতে (Coolify API terminal-এ):
```bash
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('YOUR_PASSWORD', 12);
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Hotel Name',
      slug: 'hotelslug',
      email: 'owner@email.com',
      plan: 'ENTERPRISE',
      planStatus: 'active',
      isActive: true,
    }
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'owner@email.com',
      passwordHash: hash,
      firstName: 'First',
      lastName: 'Last',
      role: 'OWNER',
      isActive: true,
    }
  });
  console.log('Tenant + Owner created!');
  await prisma.\$disconnect();
}
main().catch(console.error);
"
```

### Tenant Plan Active করতে
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.tenant.update({
    where: { slug: 'your-slug' },
    data: { planStatus: 'active', plan: 'ENTERPRISE' }
  });
  console.log('Done!');
  await prisma.\$disconnect();
}
main().catch(console.error);
"
```

---

## ⚠️ Known Issues & Fixes

### 1. `export * from '@prisma/client'` — esbuild fail
**File:** `packages/database/src/index.ts`
**Fix:** ওই line remove করো। শুধু prisma instance export করো।

### 2. `@fastify/static` version mismatch
**Error:** `expected '5.x' fastify version`
**Fix:** `apps/api/package.json`-এ `"@fastify/static": "^7.0.4"` use করো (v9 না)

### 3. pnpm workspace Docker compatibility
**Fix:** `.npmrc`-এ `shamefully-hoist=true` add করো

### 4. `admin` slug conflict
`/admin` route Next.js-এ super admin panel-এর জন্য reserved।
Tenant slug হিসেবে `admin` use করলে conflict হয়।
**Fix:** Slug পরিবর্তন করো — যেমন `resortpro`, `grandpalace` ইত্যাদি

### 5. Dashboard infinite loading (trialing + trialEndsAt: null)
`trialEndsAt: null` হলে `trialDaysLeft = 0` হয় → dashboard upgrade page-এ redirect করে → আবার redirect → loop।
**Fix 1:** Tenant-এর `planStatus: 'active'` করো
**Fix 2:** `layout.tsx`-এ exempt paths check করো (already fixed)

### 6. `prisma db push` — column missing
**Error:** `column X does not exist`
**Fix:** `prisma db push --accept-data-loss` run করো

### 7. `UserRole` invalid values
Valid roles: `OWNER, MANAGER, STAFF, GUEST, PARTNER, RECEPTIONIST, MARKETER, DEVELOPER`
Invalid: `SUPER_ADMIN, ADMIN` (এগুলো `AdminUser.role`-এ, regular user-এ না)

---

## 🔑 Environment Variables (Coolify)

```env
# Required
DATABASE_URL=postgresql://resortpro:PASSWORD@postgres:5432/resortpro
REDIS_URL=redis://redis:6379
JWT_SECRET=your-strong-secret
CORS_ORIGIN=https://app.resortpro.site

# Optional (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Optional (Email)
RESEND_API_KEY=re_...

# Super admin emails
SUPER_ADMIN_EMAILS=your@email.com
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `docker-compose.coolify.yml` | Coolify deployment (pre-built images) |
| `apps/api/Dockerfile` | API multi-stage build |
| `apps/web/Dockerfile` | Web Next.js build (NEXT_PUBLIC_API_URL arg) |
| `.github/workflows/docker-build.yml` | GitHub Actions (currently broken) |
| `.npmrc` | `shamefully-hoist=true` for pnpm+Docker |
| `packages/database/src/index.ts` | Prisma client (no re-export from @prisma/client) |
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard billing check (exempt paths fix) |

---

## 🚀 Deploy Checklist (নতুন deployment-এ)

- [ ] Server-এ Coolify install
- [ ] GitHub packages public করো (GHCR)
- [ ] Cloudflare DNS records add করো
- [ ] Coolify-তে Docker Compose resource create করো
- [ ] Environment variables set করো
- [ ] Local থেকে API image build + push করো (`--platform linux/amd64`)
- [ ] Local থেকে Web image build + push করো (`--build-arg NEXT_PUBLIC_API_URL=...`)
- [ ] Coolify-তে deploy করো
- [ ] Coolify terminal-এ `prisma db push` run করো
- [ ] Super admin user create করো
- [ ] `https://api.resortpro.site/health` check করো
- [ ] Login test করো

---

## 🔗 Login URLs (Summary)

| Role | URL | Fields |
|------|-----|--------|
| Super Admin | `/admin/login` | email + password |
| Owner/Manager/Staff | `/auth/login` | slug + email + password |

---

*Last updated: May 2026*

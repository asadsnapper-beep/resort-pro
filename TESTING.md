# ResortPro — Critical Testing Guide

পরে আবার test করার সময় এই checklist ধরে এগোলে কোনো critical path মিস হবে না। প্রতিটা area-তে: **কী test করব · কীভাবে · expected**।

> শেষ full pass: 2026-06-19 — 67/67 automated tests pass; critical API/auth/AI/table-ordering smoke pass।

---

## 0. Setup (test শুরুর আগে)

```bash
# API (port 4000) — main repo থেকে
cd apps/api && pnpm dev            # tsx watch
# Web (port 3000)
cd apps/web && pnpm dev
# DB: local Postgres (resortpro), DATABASE_URL .env-এ
```

**⚠️ Gotcha:** `tsx watch` মাঝে মাঝে edit reload করে না → route বদলালে **API restart** করো (`lsof -ti:4000 | xargs kill -9` তারপর আবার `pnpm dev`)।

**Credentials (local demo):**
| Role | Login |
|------|-------|
| Super-admin | `asadsnapper@gmail.com` / `Admin@123456` → /admin |
| Owner (demo) | slug `demo` · `demo@resortpro.app` / `Demo@ResortPro2026!` → /auth/login |
| Demo tenant id | `bc068f1a-d3b4-42e8-a27e-f6068ed16ba9` |

---

## 1. Automated tests (আগে এটা)
```bash
cd apps/api && pnpm test
```
**Expected:** সব pass (শেষবার 67/67)।
- race-condition test-এ `Unique constraint failed on invoiceNumber` log দেখলে **ভয় নেই** — এটা intentional (concurrent booking: একটা জেতে, বাকিরা fail)।

---

## 2. Auth & Roles
- [ ] Admin login (`/api/admin/login`) → 200 + token
- [ ] Owner login slug সহ (`/api/auth/login` {email,password,slug}) → 200। **slug ছাড়া fail হবে**
- [ ] Owner token দিয়ে admin endpoint (`/api/admin/stats`) → **403** (boundary)
- [ ] httpOnly refresh cookie set হয় login-এ (`rp_refresh`)
- [ ] ভুল password → 401

## 3. Multi-tenant isolation (সবচেয়ে গুরুত্বপূর্ণ)
- [ ] Tenant A-র token দিয়ে Tenant B-র room/booking পড়া যায় না (automated: `tenant-isolation.test.ts`)
- [ ] Public `/site/:slug` শুধু সেই tenant-এর data দেয়

## 4. Booking lifecycle
- [ ] Room create → book → check-in → checkout (automated: `booking-lifecycle.test.ts`)
- [ ] Overlapping dates → **409**
- [ ] Concurrent same-room booking → ঠিক ১টা 201, বাকিরা 409 (`race-condition.test.ts`)

## 5. Public website
- [ ] `GET /site/demo` → 200, tenant + rooms + website + themeConfig
- [ ] `GET /site/<unknown>` → 404
- [ ] `POST /site/:slug/book` → 201 (PENDING booking তৈরি)
  - ⚠️ **জানা gap:** confirmation email / owner notification নেই (website-improvements.md P1)
  - ⚠️ **জানা gap:** PENDING double-booking আটকায় না (P2)
- [ ] `POST /site/:slug/feedback` → support ticket তৈরি
- [ ] `POST /site/:slug/pageview` → 204
- [ ] Browser: `/<slug>` site লোড হয়, theme render হয়, section toggle কাজ করে
- [ ] Builder: `/dashboard/website` split-pane preview live update হয়, save হয়

## 6. Table ordering (tablet kiosk)
- [ ] **আগে dashboard থেকে table বানাও** (`/dashboard/restaurant/tables`) — নাহলে `/table/:slug/:n` → 404
- [ ] `GET /table/demo/1` → tenant + menuItems
- [ ] Tablet page `/<slug>/table/<n>` → menu, cart, place order
- [ ] Pay-first (CASH) → order তৈরি, KDS-এ যায়
- [ ] KDS (`/dashboard/orders`, Chef role) → table badge, status update, fullscreen button
- [ ] Order status poll → READY হলে tablet-এ "Food is Ready" alert

## 7. AI gating (ships dark — সবচেয়ে যত্নে)
প্রতিবার test শেষে **safe OFF-এ ফেরত আনো**।
- [ ] Master OFF: `/api/ai/status` → সব false
- [ ] Master OFF: `POST /api/ai/content/generate` → **403 AI_DISABLED** (Claude পর্যন্ত পৌঁছায় না)
- [ ] Super-admin Settings → AI master toggle ON + save → DB persist
- [ ] Master ON + tenant `ai_content` flag ON → status true, guarded endpoint 200
- [ ] Owner UI: AI OFF → sidebar "AI Content" link hidden + page "not enabled" gate
- [ ] Owner UI: AI ON → generator UI দেখায়
- [ ] **Generate চালানোর জন্য token লাগে** — platform key (`PlatformSettings.aiApiKey`) সেট থাকতে হবে; নাহলে 503 AI_NOT_CONFIGURED
- [ ] Test শেষে: master OFF + flag OFF

## 8. Feature flags / super-admin
- [ ] `/admin/tenants/:id` → Feature Flags page, AI category-তে ৩টা flag
- [ ] Flag toggle → DB-তে persist
- [ ] Super-admin Settings: trial days, plans edit, AI master switch

## 9. অন্যান্য module (regression spot-check)
- [ ] Invoices (create, PDF)
- [ ] F&B menu CRUD
- [ ] Housekeeping, Inventory
- [ ] CRM / offers / packages / loyalty
- [ ] Reports / dashboard stats লোড হয়
- [ ] Custom domain verify flow (`/dashboard/website` domain tab)

---

## পরিচিত gap (bug না — planned, plan/ folder-এ)
- Web booking-এ email/notification নেই → `plan/website-improvements.md` P1
- PENDING double-booking → P2
- Room booking-এ online payment নেই → P3
- Testimonials manual → P4
- AI ৩টা feature-এর মধ্যে শুধু `ai_content` wired; chatbot + business_insights এখনো plan-এ

---

## Deploy-এর সময় (staging/main)
- [ ] Pending migrations apply হয়েছে (`prisma migrate deploy`): `table_ordering`, `ai_master_switch`, `ai_schema`
- [ ] AI master switch staging-এ OFF (accidental token খরচ এড়াতে)

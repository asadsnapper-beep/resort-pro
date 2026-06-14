# ResortPro — System Review & Architecture Audit

> **লেখা হয়েছে:** 2026-06-15
> **Reviewer:** Claude (expert architecture review)
> **Scope:** পুরো codebase — system design, architecture, data flow, workflow, security, scalability, technical debt
> **পড়ার নিয়ম:** এটা একটা *honest* audit। অনেক কিছু ভালো হয়েছে, কিন্তু কিছু জায়গায় serious গর্ত আছে যেগুলো production-এ users আসার আগে ঠিক করা দরকার। প্রতিটা সমস্যার পাশে **severity** (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low) দেওয়া আছে।

---

## ১. Executive Summary (এক নজরে)

ResortPro হলো ছোট resort/hotel owner-দের জন্য একটা **multi-tenant SaaS platform**। এটা শুধু একটা booking app না — এটা একটা পুরো business operating system: booking, front-desk, housekeeping, restaurant (F&B), inventory, CRM, marketing automation, loyalty, invoicing, public website builder (theme system), custom domain, embed widget, এমনকি একটা Super-Admin control plane (platform team-এর জন্য)।

**সামগ্রিক রায়:** Feature-এর দিক থেকে এটা impressively complete — অনেক funded startup-এর থেকেও বেশি feature আছে এখানে। কিন্তু **engineering foundation-এ কিছু structural দুর্বলতা** আছে যেগুলো এখন (users কম থাকতে) ব্যথা দিচ্ছে না, কিন্তু scale করলে বা একটা security incident হলে বড় ক্ষতি করতে পারে।

| দিক | অবস্থা |
|------|--------|
| Feature completeness | 🟢 চমৎকার (90+ model, 37 route) |
| Code organization | 🟢 ভালো (পরিষ্কার monorepo, feature-wise routes) |
| **Tenant isolation (security)** | 🔴 ঝুঁকিপূর্ণ — পুরোপুরি manual |
| **DB migration discipline** | 🔴 ভাঙা — schema drift চলছে |
| Scalability (multi-instance) | 🟠 এখনো single-instance assumption |
| Test coverage | 🟠 পাতলা (8 test file) |
| Auth & secrets | 🟠 কিছু default/localStorage ঝুঁকি |
| Observability | 🟡 basic metrics আছে, error tracking নেই |

---

## ২. System Architecture (উঁচু থেকে দেখা)

### ২.১ Monorepo Layout

```
resort-pro/  (pnpm workspace + Turborepo)
│
├── apps/
│   ├── api/            → Fastify REST API (port 4000) — সব business logic এখানে
│   ├── web/            → Next.js 14 App Router (port 3000) — dashboard + public website
│   ├── desktop/        → Electron app (better-sqlite3) — offline front-desk sync
│   ├── embed/          → Vite-built JS widget — booking widget অন্যের site-এ বসানোর জন্য
│   └── wordpress-plugin/ → PHP plugin — WordPress site-এ embed
│
├── packages/
│   ├── database/       → Prisma schema + client (single source of truth)
│   ├── types/          → shared TypeScript types (JwtPayload, UserRole, ইত্যাদি)
│   ├── ui/             → shared React components
│   ├── config/         → shared config
│   └── payment-registry/ → payment gateway registry
│
└── docs/               → plan/ (14 parts), ARCHITECTURE.md, ইত্যাদি
```

**মূল্যায়ন:** 🟢 এই structure টা পরিষ্কার এবং industry-standard। `packages/database` কে single source of truth রাখা, `packages/types` দিয়ে frontend-backend type share করা — সঠিক সিদ্ধান্ত।

### ২.২ Runtime Architecture

```
                       ┌──────────────────────────────────────┐
                       │          Clients                       │
   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐
   │ Web      │  │ Desktop   │  │ Embed     │  │ WordPress   │
   │ (Next.js)│  │ (Electron)│  │ Widget    │  │ Plugin      │
   └────┬─────┘  └────┬──────┘  └────┬──────┘  └──────┬──────┘
        │ REST        │ /api/sync    │ /embed         │ /embed
        └─────────────┴──────┬───────┴────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │   Fastify API (4000)  │
                  │  ─ JWT auth           │
                  │  ─ Zod validation     │
                  │  ─ WebSocket (chat)   │
                  │  ─ In-process crons   │
                  └───────┬──────────────┘
                          │ Prisma
                          ▼
            ┌──────────────────────────────┐
            │      PostgreSQL (single DB)    │  ← সব tenant একই DB-তে
            └──────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────┬────────────┐
        ▼                 ▼                  ▼            ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐  ┌─────────┐
   │ Stripe   │      │ bKash /   │      │ Resend /  │  │ Local   │
   │          │      │ SSLCommerz│      │ SMTP      │  │ uploads │
   └─────────┘      └──────────┘      └──────────┘  └─────────┘
```

### ২.৩ Deployment Topology (3 environment)

| Environment | কোথায় | Branch | Tool | URL |
|-------------|--------|--------|------|-----|
| **Local** | MacBook | — | pnpm dev | `localhost:3000` / `:4000` |
| **Staging** | Home Server | `dev` | Portainer | `resortpro.webcoronet.com` |
| **Production** | Main Server | `main` | Coolify | `app.resortpro.site` |

**মূল্যায়ন:** 🟢 3-tier flow (Local → dev → main) সঠিক। 🟡 কিন্তু staging আর production-এর DB schema একই migration থেকে আসছে না (নিচে section ৫ দেখো)।

---

## ৩. Data Flow & Core Workflows

### ৩.১ Authentication Flow

```
Login:  POST /api/auth/login { email, password, slug }
        → bcrypt verify
        → JWT issue (15m, payload: { sub, email, role, tenantId })
        → Refresh token issue (7d, DB-তে RefreshToken table-এ stored)

Request: Bearer JWT → request.jwtVerify() → request.user = { sub, email, role, tenantId }
         → preHandler: requireAuth / requireRole(...)

Refresh: 401 হলে → axios interceptor → POST /api/auth/refresh
         → পুরনো token delete, নতুন pair issue (rotation)

Demo:    POST /api/auth/demo-login { role } → throwaway demo tenant-এ login
```

**মূল্যায়ন:** 🟢 Refresh token rotation + DB storage ভালো। 🟠 কিন্তু token localStorage-এ থাকে (XSS ঝুঁকি, section ৪.৩)।

### ৩.২ Multi-Tenancy Model — **সবচেয়ে গুরুত্বপূর্ণ অংশ**

ResortPro **shared database, shared schema** model ব্যবহার করে:
- প্রতিটা table-এ `tenantId` column আছে
- JWT থেকে `tenantId` বের হয়
- প্রতিটা Prisma query-তে **হাতে করে** `where: { tenantId }` লেখা হয়

```typescript
// প্রতিটা handler-এ এই pattern:
const { tenantId } = request.user as JwtPayload;
const bookings = await prisma.booking.findMany({ where: { tenantId, ... } });
```

🔴 **এটাই সবচেয়ে বড় ঝুঁকি — section ৪.১-এ বিস্তারিত।**

### ৩.৩ Booking Creation Flow

```
Guest/Staff → POST /api/bookings
  → room availability check (date overlap + external calendar conflict)
  → guest find-or-create (email দিয়ে)
  → booking create
  → (auto) invoice generate
  → payment intent (Stripe / bKash / SSLCommerz / cash)
  → notification + automation trigger
```

**মূল্যায়ন:** 🟢 Conflict check (external calendar সহ) করা হচ্ছে — এটা সঠিক। 🟡 কিন্তু এটা একটা DB transaction-এ মোড়া আছে কিনা যাচাই করা দরকার — race condition-এ double-booking হতে পারে (section ৪.৬)।

### ৩.৪ Public Website / Theme Flow

```
Visitor → <slug>.resortpro.site  (অথবা custom domain)
  → Next.js (public)/[slug]/page.tsx
  → GET /site/:slug/...  (public, auth ছাড়া)
  → WebsiteContent + Theme (luxe/minimal/coastal) render
  → Booking widget → POST /site/:slug/bookings
```

**মূল্যায়ন:** 🟢 Theme system (DB-driven, plan-gated, preview modal) সুন্দরভাবে বানানো। সদ্য fix করা `/demo` route conflict-টা এই flow-এরই একটা bug ছিল।

### ৩.৫ Offline Desktop Sync

```
Desktop (Electron) → better-sqlite3 (local queue)
  → অফলাইনে কাজ → queue জমে
  → online হলে → POST /api/sync → server reconcile
```

**মূল্যায়ন:** 🟡 Offline-first front desk একটা শক্তিশালী differentiator। কিন্তু conflict resolution strategy (একই booking দুই জায়গায় edit হলে) document করা নেই — verify করা দরকার।

### ৩.৬ Background Jobs (in-process crons)

| Job | কাজ |
|-----|-----|
| `pre-arrival-reminder` | check-in-এর আগে guest-কে reminder |
| `ical-sync` | external calendar (Airbnb/Booking.com) sync |
| `daily-report-dispatch` | owner-কে দৈনিক report email |
| `automation engine` | rule-based automation (notif triggers) |
| `trial-emails` | trial lifecycle email (প্রতি 12 ঘণ্টা) |

🟠 **এই crons গুলো API process-এর ভেতরে চলে** — multi-instance হলে duplicate চলবে (section ৪.৪)।

---

## ৪. Critical Issues (যা ঠিক করতে হবে)

### ৪.১ 🔴 Tenant Isolation পুরোপুরি Manual — #1 ঝুঁকি

**সমস্যা:** Tenant data আলাদা রাখার পুরো দায়িত্ব developer-এর memory-র উপর। প্রতিটা query-তে `where: { tenantId }` লিখতে হয়। কোনো **Prisma middleware / `$extends` / Row-Level Security নেই** যেটা automatic enforce করবে।

একটা মাত্র জায়গায় `tenantId` ভুলে গেলে → **এক resort আরেক resort-এর booking/guest/revenue দেখে ফেলবে।** এটা একটা SaaS-এর জন্য business-ending bug।

বাস্তব প্রমাণ: এই codebase-এ ইতিমধ্যে কিছু route-এ `requireAuth` বনাম `requireRole` ভুল ছিল (এই সপ্তাহেই fix হয়েছে)। মানে এই ধরনের "ভুলে যাওয়া" ইতিমধ্যেই ঘটেছে — শুধু role-এ, isolation-এ পরের বার ঘটতে পারে।

**সমাধান (পছন্দের ক্রমে):**
1. **Prisma Client Extension** দিয়ে tenant-scoped client বানাও — প্রতি request-এ `prisma.$extends` করে এমন client দাও যেটা auto-`tenantId` যোগ করে। সব route ওই scoped client ব্যবহার করবে।
2. অথবা **PostgreSQL Row-Level Security (RLS)** — DB level-এ `SET app.tenant_id` করে policy enforce করো। সবচেয়ে শক্তিশালী, কিন্তু setup জটিল।
3. **অন্তত একটা integration test suite** যেটা প্রতিটা list endpoint-এ cross-tenant leak check করে।

> এটা না করলে বাকি সব ঠিক করেও SaaS টা ঝুঁকিতে থাকবে। **সর্বোচ্চ অগ্রাধিকার।**

### ৪.২ 🔴 Database Migration Discipline ভাঙা — Schema Drift

**সমস্যা:** `schema.prisma`-তে ~90 model, কিন্তু `migrations/` folder-এ মাত্র **14টা migration**। মানে অনেক column (~70টা শুধু Tenant model-এ) schema-তে যোগ হয়েছে কিন্তু কখনো migration file বানানো হয়নি — সম্ভবত `prisma db push` দিয়ে।

এর সরাসরি ফল আমরা এই সপ্তাহেই ভুগেছি: staging DB-তে `telegramBotToken`, `mapVisible`, `isFeatured`, `discoveryTier` ইত্যাদি column ছিল না, তাই `seed-demo` বারবার fail করেছে এবং হাতে করে `ALTER TABLE` চালাতে হয়েছে।

**কেন এটা বিপজ্জনক:**
- Production-এ `prisma migrate deploy` চালালে এই column গুলো তৈরি হবে না → app crash।
- দুই environment-এর schema আলাদা → "আমার এখানে কাজ করে, ওখানে করে না"।
- Rollback অসম্ভব — কোন change কখন হলো তার history নেই।

**সমাধান:**
1. এখনই একটা **baseline migration** বানাও যেটা current `schema.prisma`-র সাথে DB-কে মেলায় (`prisma migrate diff` দিয়ে SQL generate করে একটা migration হিসেবে commit করো)।
2. এরপর থেকে **কখনো `db push` না** — সবসময় `prisma migrate dev` (local) → migration file commit → `migrate deploy` (staging/prod)।
3. CI-তে একটা check: "schema.prisma আর migrations sync আছে কিনা" (`prisma migrate diff --exit-code`)।

> Memory-তে এটা [[staging-db-schema-debt]] হিসেবে লেখা আছে — কিন্তু এটা একটা note না, এটা একটা **blocker** যা baseline migration দিয়ে স্থায়ীভাবে শেষ করা দরকার।

### ৪.৩ 🟠 Auth Token localStorage-এ — XSS ঝুঁকি

**সমস্যা:** Access token + refresh token দুটোই `localStorage`-এ (`resort-pro-auth`)। যেকোনো XSS (একটা malicious dependency, একটা reflected script) পুরো token চুরি করতে পারে।

**সমাধান:** Refresh token কে অন্তত **httpOnly, Secure, SameSite cookie**-তে রাখো। Access token memory-তে (short-lived) রাখা যায়। এতে XSS দিয়ে refresh token চুরি করা যাবে না।

### ৪.৪ 🟠 In-Process Crons — Multi-Instance হলে Duplicate

**সমস্যা:** ৫টা cron API process-এর ভেতরে `setInterval`/cron দিয়ে চলে। আজ একটা instance, তাই সমস্যা নেই। কিন্তু scale করতে গিয়ে ২টা container চালালে — **প্রতিটা guest দুটো reminder email পাবে, দুটো daily report যাবে।**

**সমাধান:**
1. স্বল্পমেয়াদে: crons আলাদা একটা "worker" process/container-এ সরাও (একটাই চলবে)।
2. দীর্ঘমেয়াদে: একটা job queue (BullMQ + Redis — যেটা ইতিমধ্যে dependency-তে আছে) ব্যবহার করো, leader election সহ।

### ৪.৫ 🟠 Redis declared কিন্তু ব্যবহার হচ্ছে না

**সমস্যা:** `ioredis` package.json-এ আছে, কিন্তু `apps/api/src`-এ কোথাও import হয় না। Rate limiting **in-memory** (`@fastify/rate-limit` কোনো store ছাড়া)। মানে:
- Multi-instance হলে rate limit কাজ করবে না (প্রতি instance আলাদা গুনবে)।
- Cache/session share হয় না।

**সমাধান:** Rate limit-কে Redis store-এ দাও, অথবা ioredis dependency সরিয়ে দাও যদি ব্যবহার না করো (confusion এড়াতে)।

### ৪.৬ 🟡 Booking Race Condition (double-booking)

**সমস্যা:** Availability check আর booking create যদি একই DB transaction + lock-এ না থাকে, তাহলে দুজন একই room একসাথে বুক করতে পারে (concurrent request)।

**সমাধান:** Booking create-কে একটা `prisma.$transaction`-এ মোড়াও, এবং room/date-এর উপর serializable isolation বা unique constraint (overlap exclusion) ব্যবহার করো। PostgreSQL-এ `EXCLUDE USING gist` দিয়ে date-range overlap DB-level-এ আটকানো যায়।

### ৪.৭ 🟡 JWT Secret-এ Default Value

```typescript
secret: process.env.JWT_SECRET || 'dev-secret-change-in-production'
```

**সমস্যা:** Production-এ env ভুলে না দিলে app crash করবে না — বরং একটা **পরিচিত default secret** দিয়ে চলবে। যে কেউ ওই secret দিয়ে যেকোনো user-এর token বানাতে পারবে।

**সমাধান:** Production-এ `JWT_SECRET` না থাকলে startup-এ **fail fast** (throw)। Default secret শুধু `NODE_ENV !== 'production'`-এ।

### ৪.৮ 🟡 Money Type Inconsistency

**সমস্যা:** `ARCHITECTURE.md` বলে সব টাকা `Decimal(10,2)`। কিন্তু নতুন column (`accountCredit FLOAT`) FLOAT হিসেবে যোগ হয়েছে। FLOAT-এ টাকা রাখলে rounding error হয় (`0.1 + 0.2 ≠ 0.3`)।

**সমাধান:** সব monetary field `Decimal`-এ রাখো, একটাও FLOAT না।

### ৪.৯ 🟡 CSP নিষ্ক্রিয়

```typescript
await app.register(helmet, { contentSecurityPolicy: false });
```

**সমস্যা:** Content-Security-Policy বন্ধ → XSS-এর বিরুদ্ধে একটা গুরুত্বপূর্ণ defense layer নেই। (embed widget-এর কারণে হয়তো বন্ধ করা হয়েছে, কিন্তু সেটা origin-specific করে চালু রাখা যায়।)

### ৪.১০ 🟡 Test Coverage পাতলা

**সমস্যা:** 37 route + 90 model-এর জন্য মাত্র **8টা test file** (4 API, 4 e2e)। Critical path (booking, payment, tenant isolation) automated test-এ ঢাকা নেই।

**সমাধান:** অগ্রাধিকার দাও — (১) tenant isolation, (২) booking/availability, (৩) payment webhook। এগুলো ভাঙলে সবচেয়ে বড় ক্ষতি।

---

## ৫. কী কী ভালো হয়েছে (Strengths)

এগুলো ভাঙার দরকার নেই — বরং রক্ষা করো:

- 🟢 **পরিষ্কার monorepo + feature-wise route organization** — নতুন feature যোগ করা সহজ।
- 🟢 **Consistent API response** (`{ success, data }` / `{ success, error }`) + Zod validation + centralized error handler।
- 🟢 **Swagger/OpenAPI docs** auto-generated।
- 🟢 **Refresh token rotation** DB-backed।
- 🟢 **শক্তিশালী Super-Admin control plane** — audit log, GDPR suite, feature flags, churn risk, MRR analytics, platform health dashboard। এটা অনেক mature SaaS-এও থাকে না।
- 🟢 **Theme system** — DB-driven, plan-gated, live preview। ভালো architecture।
- 🟢 **Bangladesh-specific payment** (bKash, SSLCommerz) — সঠিক market fit।
- 🟢 **Offline-first desktop app** — front desk-এর জন্য বড় differentiator।
- 🟢 **Soft deletes, UUID PK, composite unique index** — সঠিক DB principles (যেখানে অনুসরণ করা হয়েছে)।

---

## ৬. Scalability — ভবিষ্যতে কী ভাঙবে

| Users | কী ঘটবে | কী লাগবে |
|-------|---------|----------|
| 1–50 tenant | এখন যেমন চলছে চলবে | কিছুই না |
| 50–500 | DB query slow হবে (tenantId index দরকার), crons duplicate ঝুঁকি | proper index audit, worker process আলাদা |
| 500+ | single DB hot হবে, in-memory rate limit ভাঙবে | Redis wire করা, read replica, connection pooling (PgBouncer) |
| Enterprise tenant | shared schema-তে noisy neighbor | বড় tenant-দের জন্য আলাদা DB option |

**মূল কথা:** আজকের architecture একটা **single powerful instance**-এর জন্য optimized। Horizontal scale করার আগে — crons আলাদা করা, Redis wire করা, এবং tenant isolation শক্ত করা — এই তিনটা must।

---

## ৭. সুপারিশকৃত Priority Roadmap

### Phase 0 — এখনই (production-এ users আসার আগে) 🔴
1. **Baseline migration** বানাও — schema drift স্থায়ীভাবে শেষ করো (§4.2)
2. **Tenant isolation** — Prisma extension দিয়ে auto-scoping + cross-tenant leak test (§4.1)
3. **JWT secret fail-fast** production-এ (§4.7)
4. CI-তে `migrate diff --exit-code` check যোগ করো

### Phase 1 — শীঘ্রই (১–২ সপ্তাহ) 🟠
5. Refresh token → httpOnly cookie (§4.3)
6. Crons → আলাদা worker process (§4.4)
7. Booking creation → transaction + overlap constraint (§4.6)
8. Critical path test (booking, payment, isolation) (§4.10)

### Phase 2 — মাঝারি মেয়াদ 🟡
9. Redis wire করা (rate limit + cache) অথবা dependency সরানো (§4.5)
10. Money field সব Decimal-এ একীভূত করা (§4.8)
11. Error tracking (Sentry) + structured log aggregation
12. CSP origin-specific করে চালু করা (§4.9)

### Phase 3 — দীর্ঘমেয়াদ 🟢
13. Job queue (BullMQ) — automation/email scalable করা
14. Read replica + PgBouncer (যখন 500+ tenant)
15. Enterprise tenant-দের জন্য isolated-DB option

---

## ৮. উপসংহার (Architect-এর সৎ মতামত)

ResortPro **product হিসেবে দুর্দান্ত** — feature depth, Bangladesh market fit, super-admin tooling সবই strong। এটা একটা real, sellable SaaS।

কিন্তু **engineering foundation-এ দুটো গর্ত আছে যেগুলো এখনই সারাতে হবে**, কারণ এগুলো users বাড়ার সাথে সাথে exponentially বিপজ্জনক হবে:

1. **Tenant isolation manual** — একটা ভুল query = data breach = company শেষ।
2. **Migration drift** — staging-এ যে ব্যথা পেয়েছ, production-এ সেটা outage হবে।

এই দুটো ঠিক করলে বাকিটা incrementally improve করা যায়। আমার সুপারিশ — **নতুন feature বানানোর আগে Phase 0 শেষ করো।** এক সপ্তাহের কাজ, কিন্তু এটাই business টাকে সুরক্ষিত করবে।

বাকি সব (Redis, crons, tests) — গুরুত্বপূর্ণ, কিন্তু users বাড়ার সাথে সাথে ধাপে ধাপে করা যায়।

> **এক লাইনে:** "Feature-এ তুমি অনেক এগিয়ে; এখন foundation-টাকে feature-এর সমান শক্ত করার সময়।"

---

*এই document-টা living — প্রতিটা বড় architectural সিদ্ধান্তের পর update করা উচিত।*

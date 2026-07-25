# Auth & Origin Hardening — Plan

> লক্ষ্য: tenant-এর public website-এ চলা কোনো কোড যেন owner/superadmin-এর session চুরি করতে না পারে।
> এটা [Theme Studio Tier 2](./theme-studio-and-design-service.md)-এর precondition, কিন্তু Tier 2 না করলেও নিজে থেকেই দরকারি।

---

## যাচাই করা বর্তমান অবস্থা (সব curl/কোড দিয়ে confirmed)

### ১. কোনো origin isolation নেই

```
resortpro.site/auth/login      → 200
resortpro.site/dashboard       → 200
resortpro.site/demo            → 200   ← tenant public page, একই origin
app.resortpro.site/demo        → 200   ← এখানেও tenant page
app.resortpro.site/            → 200
```

দুইটা origin-ই **দুই কাজই** করছে। কারণ [middleware.ts](../apps/web/src/middleware.ts)-এ `SKIP_PREFIXES` চেকটা host চেকের **আগে** চলে:

```ts
const SKIP_PREFIXES = ['/_next', '/api', '/auth', '/dashboard', '/admin'];
if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();
```

তাই `/dashboard` **যেকোনো** host-এ কাজ করে।

### ২. Token কোথায় আছে

| Token | কোথায় | আয়ু | JS পড়তে পারে? |
|---|---|---|---|
| Refresh token (`rp_refresh`) | httpOnly cookie, `sameSite: strict`, `path: /api/auth` | ৭ দিন | ❌ না ✅ |
| **Access token (JWT)** | **localStorage** (`resort-pro-auth`) | **১ দিন** (`JWT_EXPIRES_IN=1d`) | **✅ হ্যাঁ** ⚠️ |
| Admin token | **localStorage** (`admin_token`) | — | **✅ হ্যাঁ** ⚠️ |

**ভালো খবর:** cookie infrastructure আগে থেকেই আছে — `@fastify/cookie`, CORS credentials, axios `withCredentials: true`, `/api/auth/refresh` endpoint ([auth.ts:16-35](../apps/api/src/routes/auth.ts))। মানে access token-ও cookie-তে সরানো যতটা ভাবা হয়েছিল তার চেয়ে কম কাজ।

### ৩. কোনো security header নেই

`resortpro.site/demo`-তে কোনো `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` নেই — শুধু `locale` cookie।

### ৪. আক্রমণের রাস্তা (আজকের অবস্থায়)

Owner `resortpro.site/auth/login`-এ login করে → JWT যায় `resortpro.site` origin-এর localStorage-এ → সেই **একই origin**-এ `resortpro.site/<slug>` tenant page। ওখানে কোনো JS চললে:

```js
localStorage.getItem('resort-pro-auth')   // ১ দিনের বৈধ JWT
```

আজ exploitable না (এখন theme-এ JS allow করা হয় না), কিন্তু এটা একটা **latent ঝুঁকি** — ওই origin-এ যেকোনো XSS (theme হোক বা অন্য কোনো bug) মানেই account takeover।

### ৫. আলাদা bug (পথে পাওয়া গেল) 🔴

```
demo.resortpro.site/  → 503
```

`*.resortpro.site` wildcard subdomain **production-এ live না** — যদিও কোডে middleware আছে ও feature আগে "built" বলে mark করা ([subdomain system](./README.md), commit `0f1ba2e`)। DNS wildcard এবং/অথবা Coolify/Traefik-এ wildcard TLS cert নেই। তাই tenant site এখন `resortpro.site/<slug>`-এই চলছে — যেটা ঠিক ওই একই origin সমস্যা তৈরি করছে।

---

# Phase ভাগ

## Phase A — CSP + security headers ⭐ আগে এটা

**কেন আগে:** সবচেয়ে কম কাজ, কোনো infra dependency নেই, আর Tier 2-র ঝুঁকিটা **structurally** বন্ধ করে দেয়। CSP থাকলে template-এ কেউ ভুলে বা ইচ্ছে করে script ঢোকালেও browser সেটা চালাবেই না।

| কী | কোথায় |
|---|---|
| Global headers — HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options` | `apps/web/next.config.js` → `async headers()` |
| Tenant public page-এ কড়া CSP — `script-src 'self' 'nonce-<random>'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` | `apps/web/src/middleware.ts` (per-request nonce) |
| Dashboard/admin-এ আলাদা (একটু শিথিল) CSP | একই middleware, host/path অনুযায়ী |

⚠️ **সৎ কথা:** Next.js নিজে কিছু inline script inject করে, তাই nonce-based CSP tune করতে একটু কষ্ট হয় — `unsafe-inline` ছাড়া প্রথমবার কিছু ভাঙতে পারে। তাই প্রথমে `Content-Security-Policy-Report-Only` দিয়ে চালু করে, log দেখে ঠিক করে তারপর enforce করা উচিত। এটাই নিরাপদ রাস্তা।

**আকার:** ছোট-মাঝারি | **ঝুঁকি:** কম (Report-Only দিয়ে শুরু করলে শূন্য)

---

## Phase B — Access token → httpOnly cookie

**মূল সমাধান।** Token JS-এর নাগালের বাইরে চলে গেলে localStorage সমস্যাটাই আর থাকে না।

### ধাপ

1. **API**: login/register/refresh-এ access token-ও cookie-তে সেট করা (`rp_access`, httpOnly, `sameSite: strict`, `secure` in prod)
2. **Dual-read (transition)**: `requireAuth` middleware Bearer header **অথবা** cookie — দুইটাই মানবে। তাই পুরনো session ভাঙবে না
3. **Frontend**: axios interceptor থেকে `Authorization` header বাদ, শুধু `withCredentials` (আগে থেকেই আছে)
4. **CSRF protection**: cookie auto-send হয় বলে দরকার — `sameSite: strict` মূল রক্ষা, সাথে state-changing route-এ custom header চেক (`X-Requested-With`)
5. **Admin panel**: `admin_token`-ও একইভাবে
6. **Cleanup**: সব ঠিক চললে localStorage token ও Bearer fallback সরানো

### 🔴 Desktop app — এটা ভাঙবে, handle করতে হবে

[preload.ts:38](../apps/desktop/src/preload.ts)-এ desktop app renderer থেকে token নিয়ে sync করে:

```ts
triggerSync: (token: string) => ipcRenderer.invoke('trigger-sync', token)
```

httpOnly cookie হলে renderer আর token পড়তে পারবে না → sync ভেঙে যাবে।

**সমাধান (আসলে আগের চেয়ে ভালো):** Electron main process নিজেই session cookie পড়তে পারে —

```ts
const cookies = await session.fromPartition('persist:resortpro').cookies.get({ name: 'rp_access' })
```

তাই renderer-কে token হাতে দেওয়ার দরকারই নেই। এটা desktop app-এর জন্যও বেশি নিরাপদ।

**আকার:** মাঝারি-বড় | **ঝুঁকি:** মাঝারি (dual-read দিয়ে করলে rollback সহজ)

---

## Phase C — Origin isolation

প্রতিটা origin-এর একটাই কাজ থাকবে:

| Origin | শুধু যা serve করবে |
|---|---|
| `resortpro.site` | Marketing landing page |
| `app.resortpro.site` | Dashboard + `/auth/*` + `/admin/*` |
| `<slug>.resortpro.site` + custom domain | Tenant public site |

Middleware-এ host-aware routing — `SKIP_PREFIXES` চেকটা host চেকের **পরে** সরানো, আর ভুল host-এ এলে redirect (block না, নাহলে bookmark ভাঙবে)।

### ⚠️ Ordering constraint

এটা **Phase 0 (নিচে) ছাড়া করা যাবে না**। কারণ এখন wildcard subdomain 503, তাই সব live tenant site `resortpro.site/<slug>`-এ চলছে। ওটা বন্ধ করলে সব tenant-এর website মরে যাবে।

আরেকটা ব্যাপার: origin বদলালে localStorage per-origin বলে owner-রা **একবার logout** হয়ে যাবে। Phase B আগে হয়ে গেলে (cookie `.resortpro.site` domain-এ scoped) এই সমস্যা হবে না — তাই **B আগে, C পরে**।

**আকার:** মাঝারি | **ঝুঁকি:** মাঝারি-উচ্চ (ভুল করলে সব site down)

---

## Phase 0 — Wildcard subdomain live করা (তোমার infra কাজ)

Phase C-র precondition, আর নিজে থেকেও একটা bug fix:

1. DNS-এ `*.resortpro.site` → server IP (A record বা CNAME)
2. Coolify/Traefik-এ wildcard TLS cert (`*.resortpro.site`) — Let's Encrypt DNS-01 challenge লাগবে
3. Coolify-র Web service-এ domain হিসেবে `*.resortpro.site` যোগ করা

এটা আমি করতে পারব না — Coolify chat বা তোমার নিজের করতে হবে। চাইলে prompt লিখে দিতে পারি।

---

# সুপারিশকৃত order

```
Phase A (CSP, Report-Only → enforce)      ← এখনই, কম ঝুঁকি, Tier 2 unblock করে
        ↓
Phase B (cookie auth + desktop fix)       ← মূল সমাধান
        ↓
Phase 0 (wildcard subdomain — তুমি)       ← infra
        ↓
Phase C (origin isolation)                ← সবশেষে, সবচেয়ে ঝুঁকিপূর্ণ
```

**শুধু Phase A করলেই Tier 2 template theme নিরাপদে শুরু করা যাবে** — কারণ CSP browser-লেভেলে script আটকে দেয়। B ও C হলো গভীরতর/স্থায়ী সমাধান।

---

## ঝুঁকি সারসংক্ষেপ

| বিষয় | নোট |
|---|---|
| CSP প্রথমবার কিছু ভাঙতে পারে | Report-Only mode দিয়ে শুরু — শূন্য ঝুঁকি |
| Cookie migration-এ session ভাঙা | Dual-read (Bearer **অথবা** cookie) দিয়ে zero-downtime |
| Desktop app sync | Main process থেকে cookie পড়ে — আসলে বেশি নিরাপদ |
| Origin isolation-এ site down | Phase 0 ছাড়া করা যাবে না, সাবধানে + staging-এ আগে test |
| CSRF (cookie auth-এর পরে) | `sameSite: strict` + custom header চেক |

---

## Status

📋 **Plan only — কোনো code লেখা হয়নি।** অনুমোদনের অপেক্ষায়।

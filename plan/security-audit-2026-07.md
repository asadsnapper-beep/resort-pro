# Security Audit — ResortPro (2026-07-25)

> পুরো project একজন ethical hacker-এর দৃষ্টিতে দেখা। ৪৫৯টা endpoint, ১৮k লাইন route code, auth/tenant-isolation/payment/upload/admin — সব attack surface।
> প্রতিটা finding **কোড পড়ে নিশ্চিত** (runtime exploit test করা যায়নি কারণ local DB ছিল না, কিন্তু কোড থেকে প্রমাণ স্পষ্ট)।

---

## Severity সারসংক্ষেপ

| # | Finding | Severity | অবস্থা |
|---|---------|----------|--------|
| 1 | `groupBy` tenant-isolation bypass — cross-tenant data leak | 🔴 CRITICAL | ✅ **FIXED** (commit 4adf981) — groupBy hook |
| 2 | `tenantPrisma(undefined)` → unscoped query (JWT type-confusion) | 🟠 HIGH | ✅ **FIXED** (4adf981) — token guard + fail-closed |
| 3 | Default hardcoded secret fallback (JWT + cookie) | 🟠 HIGH | ✅ **FIXED** (4adf981) — prod fail-fast |
| 4 | Swagger `/docs` production-এ public | 🟡 MEDIUM | ✅ **FIXED** (6bf356b) — prod-এ gated |
| 5 | Login/admin-login/reset-এ brute-force rate-limit নেই | 🟡 MEDIUM | ✅ **FIXED** (6bf356b) — per-route limits, 429 verified |
| 6 | কিছু payment gateway-এ webhook signature skip | 🟡 MEDIUM | ⬜ বাকি (verify() re-check বাঁচায়, তাই কম জরুরি) |
| 7 | `trustProxy: true` (blanket) — XFF spoofing | 🟢 LOW | ⬜ বাকি |
| 8 | Upload mimetype client-trusted, magic-byte check নেই | 🟢 LOW | ⬜ বাকি |
| + | localStorage token / same-origin / CSP নেই | 🟠 HIGH | ⬜ [আলাদা plan](./auth-origin-hardening.md)-এ |

> **আপডেট (2026-07-25):** CRITICAL + HIGH + MEDIUM (finding 1-5) সব fixed, dev-এ pushed। বাকি ৩টা LOW + auth-origin plan।

---

## 🔴 1. `groupBy` — Cross-tenant data leak (CRITICAL)

**কোথায়:** [`packages/database/src/index.ts`](../packages/database/src/index.ts) — `tenantPrisma` extension।

**সমস্যা:** `tenantPrisma` যে operation গুলো intercept করে tenantId inject করে সেই তালিকায় **`groupBy` নেই**। Prisma-র সব aggregation hook আছে (`aggregate`, `count`) কিন্তু `groupBy` বাদ পড়েছে। তাই `db.model.groupBy(...)` **কোনো tenant filter ছাড়াই** সব tenant-এর data নিয়ে চলে।

**যেখানে exploit হচ্ছে (৮ জায়গা, একটাতেও manual tenantId নেই):**

| ফাইল | কী leak হচ্ছে |
|---|---|
| [dashboard.ts:212](../apps/api/src/routes/dashboard.ts) | সব tenant-এর booking source breakdown |
| [dashboard.ts:238](../apps/api/src/routes/dashboard.ts) | সব tenant-এর expense-by-category (টাকার অঙ্ক!) |
| [dashboard.ts:294](../apps/api/src/routes/dashboard.ts) | সব tenant-এর guest nationality distribution |
| [expenses.ts:165](../apps/api/src/routes/expenses.ts) | সব tenant-এর expense sum by category |
| [crm.ts:820](../apps/api/src/routes/crm.ts) | সব tenant-এর guest tier distribution |
| [crm.ts:827](../apps/api/src/routes/crm.ts) | সব tenant-এর email-send status counts |
| [loyalty.ts:90](../apps/api/src/routes/loyalty.ts) | সব tenant-এর loyalty tier stats |
| [externalCalendars.ts:73](../apps/api/src/routes/externalCalendars.ts) | সব tenant-এর OTA booking counts |

**প্রভাব:** একজন owner তার নিজের dashboard খুললেই **প্রতিযোগী resort-দের** মোট খরচ, revenue mix, guest জাতীয়তা, loyalty পরিসংখ্যান দেখে ফেলছে — aggregate হলেও এটা multi-tenant SaaS-এর মূল প্রতিশ্রুতি (data isolation) ভাঙছে। GDPR/privacy দৃষ্টিতেও গুরুতর।

**Fix (২টা স্তর):**
1. **তাৎক্ষণিক** — ৮টা call-এ `where`-এ ম্যানুয়ালি `tenantId` যোগ (owner-এর tenantId handler-এ আছে)
2. **স্থায়ী** — `tenantPrisma`-তে `groupBy` hook যোগ করা (`aggregate`-এর মতোই `args.where = { tenantId, ...args.where }`)। তাহলে ভবিষ্যতে কেউ নতুন `groupBy` লিখলেও নিরাপদ

---

## 🟠 2. `tenantPrisma(undefined)` → unscoped query (HIGH)

**কোথায়:** [`middleware/auth.ts:5-13`](../apps/api/src/middleware/auth.ts) + `tenantPrisma`।

**সমস্যা:** `requireAuth` শুধু `jwtVerify()` করে, token-এর **type** চেক করে না। Refresh token একই `JWT_SECRET` দিয়ে signed ([auth.ts:184](../apps/api/src/routes/auth.ts)), payload `{ sub, type: 'refresh' }` — এতে `tenantId` নেই। এই token bare `requireAuth`-এ পাঠালে:

```
jwtVerify() পাশ → tenantId = undefined → tenantPrisma(undefined)
→ where: { tenantId: undefined, ... }
```

Prisma-তে `tenantId: undefined` মানে **"এই field ফিল্টার করো না"** → query পুরো unscoped হয়ে যায়। যেমন bare `requireAuth`-এর কোনো `db.model.findMany()` সব tenant-এর row ফেরত দেবে (২০টা bare-requireAuth endpoint আছে)।

**কেন এখনই full-blown না:** refresh token httpOnly cookie-তে, path `/api/auth`-এ scoped — attacker সহজে হাতে পায় না। কিন্তু এটা একটা **defense-in-depth ব্যর্থতা** — token type confusion + undefined-tenant fallback দুটোই একসাথে থাকা বিপজ্জনক। ভবিষ্যতে কোনো XSS (finding #১-এর origin issue) দিয়ে refresh token বেরোলে এটাই full account/tenant bypass হয়ে যাবে।

**Fix:**
1. `requireAuth`-এ token-এর `type !== 'refresh'` (বা `tenantId` আছে কিনা) চেক করা — না থাকলে 401
2. `tenantPrisma`-তে guard: `tenantId` falsy হলে throw (fail-closed) — silent unscoped কখনো না
3. Access token payload-এ explicit `type: 'access'` যোগ করে verify করা

---

## 🟠 3. Default hardcoded secret fallback (HIGH)

**কোথায়:** [`app.ts:99,127`](../apps/api/src/app.ts)

```ts
secret: process.env.JWT_SECRET || 'dev-secret-change-in-production'
secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'cookie-secret'
```

**সমস্যা:** Production-এ কোনো কারণে (env misconfig, নতুন server, deploy bug) `JWT_SECRET` না থাকলে app crash না করে **সবাই-জানা hardcoded secret** দিয়ে চলতে থাকবে। তখন যে কেউ ওই secret দিয়ে **যেকোনো user বা SUPER_ADMIN-এর token forge** করতে পারবে — সম্পূর্ণ takeover। এটা সবচেয়ে খারাপ ধরনের "silent" ব্যর্থতা: সব কাজ করছে বলে মনে হবে, কিন্তু সম্পূর্ণ unlocked।

**Fix:** Startup-এ fail-fast — production-এ `JWT_SECRET`/`COOKIE_SECRET` না থাকলে app boot-ই না করা:
```ts
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
```
(একই ভাবে `COOKIE_SECRET`।) এখনই prod env-এ secret গুলো সত্যিই set আছে কিনা যাচাই করা দরকার।

---

## 🟡 4. Swagger `/docs` production-এ public (MEDIUM)

**কোথায়:** [`app.ts:182`](../apps/api/src/app.ts) — `swaggerUi` কোনো env gate ছাড়া `/docs`-এ registered।

**সমস্যা:** `api.resortpro.site/docs` সম্ভবত পুরো ৪৫৯-endpoint API surface, schema, parameter নাম প্রকাশ করছে — attacker-এর জন্য roadmap। নিজে থেকে vuln না, কিন্তু বাকি সব attack সহজ করে দেয়।

**Fix:** production-এ `/docs` বন্ধ, অথবা admin-auth-এর পেছনে। (`if (process.env.NODE_ENV !== 'production') await app.register(swaggerUi, ...)`)

**যাচাই দরকার:** `curl -s -o /dev/null -w "%{http_code}" https://api.resortpro.site/docs` — 200 হলে confirmed।

---

## 🟡 5. Brute-force rate-limit নেই auth-এ (MEDIUM)

**কোথায়:** [`auth.ts`](../apps/api/src/routes/auth.ts) login/register/reset, [`admin.ts:104`](../apps/api/src/routes/admin.ts) admin-login — কোনোটাতে per-route rate-limit override নেই। শুধু global 100/min/IP প্রযোজ্য।

**সমস্যা:** ১০০/মিনিট/IP credential-stuffing বা admin password brute-force-এর জন্য অনেক বেশি ঢিলা। বিশেষত admin-login — একটাই high-value target।

**Fix:** login/admin-login/forgot-password-এ কড়া rate-limit (যেমন ৫/মিনিট/IP + account-level lockout/backoff)। `@fastify/rate-limit` per-route config সাপোর্ট করে।

---

## 🟡 6. Payment webhook signature optional (MEDIUM)

**কোথায়:** [`payments.ts:415`](../apps/api/src/routes/payments.ts) — `if (gw.verifyWebhookSignature)`।

**সমস্যা:** stripe/sslcommerz/razorpay/payhere signature verify করে, কিন্তু **bkash/nagad/khalti/esewa করে না** — ওদের জন্য signature চেক পুরো skip হয়। মানে attacker forged webhook পাঠাতে পারে।

**কেন CRITICAL না:** signature skip হলেও পরের ধাপে `gw.verify()` সরাসরি gateway-র API-তে (যেমন bKash execute+status) গিয়ে আসল status confirm করে ([bkash.ts:153](../packages/payment-registry/src/gateways/bkash.ts))। তাই forged webhook দিয়ে fake "payment success" করা যায় না। Defense-in-depth আছে।

**তবু ঝুঁকি:** payment ID enumeration দিয়ে অপ্রয়োজনীয় verify() call trigger করা (গেটওয়ে API-তে load/rate-limit), আর signature না থাকা মানে একটা layer কম।

**Fix:** সব gateway-এ `verifyWebhookSignature` implement করা, আর যেগুলোতে নেই সেগুলোতে অন্তত orderId-কে unauthenticated enumeration থেকে বাঁচানো।

---

## 🟢 7. `trustProxy: true` blanket (LOW)

**কোথায়:** [`app.ts:77`](../apps/api/src/app.ts)

**সমস্যা:** `trustProxy: true` মানে `X-Forwarded-For` header পুরোপুরি বিশ্বাস করা। API origin যদি Cloudflare/Traefik ছাড়াও সরাসরি reachable হয়, attacker XFF spoof করে rate-limit bypass ও audit-log-এ ভুয়া IP লিখতে পারে।

**Fix:** blanket `true`-র বদলে নির্দিষ্ট proxy IP/subnet (Cloudflare range বা Traefik-এর internal IP) trust করা। আর origin firewall-এ শুধু proxy থেকে ইনকামিং allow করা।

---

## 🟢 8. Upload mimetype client-trusted (LOW)

**কোথায়:** [`storage.ts:validate`](../apps/api/src/services/storage.ts) — শুধু client-এর পাঠানো `mimetype` চেক করে, ফাইলের আসল magic-byte না।

**সমস্যা:** কেউ HTML/script content `image/png` mimetype দিয়ে পাঠাতে পারে। তবে: extension mimetype থেকে নেওয়া হয় (user filename না), SVG allowlist-এ নেই, static plugin `.png`-কে `image/png` content-type দেয় — তাই browser HTML হিসেবে render করবে না। Stored-XSS ঝুঁকি প্রায় নেই।

**Fix (nice-to-have):** magic-byte validation (`file-type` package) যোগ করা, `Content-Disposition` header set করা uploaded file-এ।

---

## ✅ যা ঠিক আছে (audit-এ ভালো লেগেছে)

- **Password reset** — `randomBytes(32)`, single-use, expiry চেক, reset-এ সব refresh token invalidate ([auth.ts:438-490](../apps/api/src/routes/auth.ts)) — সঠিক
- **Refresh token** — httpOnly, `sameSite: strict`, DB-backed, rotation-এ পুরনোটা delete — সঠিক
- **Password hashing** — bcrypt
- **tenantPrisma** মূল pattern — findMany/create/update/delete/upsert/count/aggregate সব intercept করে (শুধু groupBy বাদ)
- **findUnique** — cross-tenant হলে null ফেরত (isolation বজায়)
- **CORS** — regex + allowlist, credentialed, wildcard reflect করে না — সঠিক
- **Admin auth** — আলাদা `AdminUser` টেবিল, bcrypt, role-based, audit log
- **Payment verify()** — gateway API-তে independent re-check (webhook trust করে না) — খুব ভালো pattern
- **Upload** — random filename, folder allowlist, mimetype allowlist, path traversal নেই

---

## সুপারিশকৃত fix order

| ধাপ | কী | কেন আগে | আকার |
|---|---|---|---|
| **1** | Finding #3 — prod secret fail-fast + prod env যাচাই | সবচেয়ে বিপর্যয়কর, ৫ মিনিটের কাজ | XS |
| **2** | Finding #1 — `groupBy` tenant fix (hook + ৮ call) | Confirmed exploitable, active data leak | S |
| **3** | Finding #2 — token-type guard + `tenantPrisma` fail-closed | Isolation-এর দ্বিতীয় স্তর | S |
| **4** | Finding #4, #5 — swagger gate + auth rate-limit | সহজ, ঝুঁকি কমায় | S |
| **5** | [auth-origin-hardening](./auth-origin-hardening.md) — CSP + cookie token | Tier 2-র precondition | M-L |
| **6** | Finding #6, #7, #8 — webhook sig, trustProxy, magic-byte | Hardening | M |

**সুপারিশ:** ধাপ ১-২-৩ একসাথে (সব ছোট, tenant isolation + secret — সবচেয়ে জরুরি), তারপর ৪, তারপর auth-origin plan।

---

## যা runtime-এ যাচাই করা বাকি (local DB ছিল না বলে)

এগুলো কোড থেকে নিশ্চিত, কিন্তু live PoC দিলে ১০০% হবে:
- Finding #1 — দুই tenant বানিয়ে একজনের dashboard-এ অন্যের expense sum দেখা যায় কিনা
- Finding #2 — refresh token Bearer হিসেবে পাঠিয়ে `/api/notifications` সব tenant-এর ফেরত দেয় কিনা
- Finding #4 — `api.resortpro.site/docs` সত্যিই 200 কিনা (এক curl)

চাইলে local Postgres চালু করে এগুলোর live PoC দেখাতে পারি।

---

## Status

📋 **Audit সম্পূর্ণ, কোনো fix এখনো করা হয়নি।** অনুমোদনের অপেক্ষায় — কোন finding থেকে শুরু করব।

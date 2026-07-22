# Error Monitoring & Reporting — Sentry

লক্ষ্য: **bug user-এর আগে আমি জানব** + user-এর "report a problem" option। Tool: **Sentry** (free tier দিয়ে শুরু)।

> তারিখ: 2026-06-19 · সিদ্ধান্ত: Sentry SaaS (free tier, দ্রুত)। পরে দরকার হলে self-host GlitchTip-এ সরানো যাবে (Sentry-compatible)।

---

## কী আছে এখন (এগুলোর উপরে বসবে)
- pino logging (API)
- `metrics` util — method/path/status/duration (`apps/api/src/utils/metrics.ts`, app.ts hook)
- admin **Health** page
- Support tickets + public feedback endpoint (user report-এর ভিত্তি)

Sentry এগুলোর উপরে **exception capture + alert** যোগ করে।

---

## Phase 1 — Sentry exception capture + alert ($0)

### API (Fastify)
- `@sentry/node` (+ `@sentry/profiling-node` optional)
- `apps/api/src/index.ts`-এ `Sentry.init()` সবার আগে; Fastify error handler-এ `Sentry.captureException`
- `SENTRY_DSN_API` env var (DSN — Sentry project থেকে)
- existing `app.setErrorHandler` + onResponse hook-এর সাথে integrate

### Web (Next.js)
- `@sentry/nextjs` — `npx @sentry/wizard@latest -i nextjs` (config auto বানায়)
- client + server + edge — তিন config
- `SENTRY_DSN_WEB` env var

### Alert
- Sentry dashboard → Alerts → "new issue" বা "error spike" → **email** (পরে Slack/webhook)
- শুধু new/critical-এ alert (spam এড়াতে)

**Effort:** আধা দিন। **Value:** সর্বোচ্চ — crash হলেই জানবে।

---

## Phase 2 — Uptime monitor ($0)

Error tracker site পুরো down হলে চুপ থাকে (কোড চলে না)। তাই আলাদা:
- **UptimeRobot (free)** — প্রতি ৫ মিনিটে `/health` (API) + homepage (web) ping
- Down → email/SMS alert
- (admin Health page-ও আছে, কিন্তু external monitor independent — server মরলেও alert আসে)

---

## Phase 3 — User-facing error reporting ($0)

### Frontend Error Boundary
- React Error Boundary — page crash করলে সাদা স্ক্রিনের বদলে friendly fallback
- "Report this problem" button → context (page URL, user, tenant, error id) সহ পাঠায়
- Sentry-র `captureException` + optional `Sentry.showReportDialog` (user feedback)

### Manual "Report a bug"
- Dashboard-এ ছোট widget → existing **support ticket** system-এ যায় (নতুন infra লাগবে না)
- Sentry error id attach করলে dev-side debug সহজ

---

## 🔒 Privacy / সতর্কতা
- **PII scrub** — guest email/phone/name, payment, API key কখনো Sentry-তে না। `beforeSend` hook-এ scrub
- `tracesSampleRate` কম রাখো (cost/quota) — যেমন 0.1
- Error message-এ raw DB data পাঠিও না
- AI key / tokens কখনো capture না

---

## Env vars (যোগ করতে হবে)
```
SENTRY_DSN_API=...      # apps/api
SENTRY_DSN_WEB=...      # apps/web (NEXT_PUBLIC_ লাগতে পারে client-এর জন্য)
SENTRY_ENVIRONMENT=development|staging|production
```
staging (Portainer) ও main (Coolify) — আলাদা environment tag, যাতে কোথায় error বোঝা যায়।

---

## Build Sequence
| ধাপ | কাজ | Effort |
|-----|-----|--------|
| 1 | Sentry account + ২টা project (api, web) → DSN | ছোট |
| 2 | API `@sentry/node` init + error handler + PII scrub | ছোট |
| 3 | Web `@sentry/nextjs` wizard + scrub | ছোট |
| 4 | Alert rules (email) | ছোট |
| 5 | UptimeRobot — /health + homepage | ছোট |
| 6 | Frontend Error Boundary + "Report problem" → ticket | মাঝারি |

> শুরু: ধাপ ১–৪ (catch-before-user)। তারপর ৫ (uptime), ৬ (user report)।

---

## পরে (দরকার হলে)
- Sentry free tier (৫k errors/মাস) ছোট পড়লে → **self-host GlitchTip** (Coolify-তে, Sentry-compatible, ০ খরচ) — শুধু DSN বদলালেই হবে
- Performance/tracing, release tracking (deploy-এর সাথে error tie করা)

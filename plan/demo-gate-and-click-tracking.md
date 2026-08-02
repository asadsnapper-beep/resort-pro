# Plan: Demo Lead Capture + Free-Trial Click Visibility + Microsoft Clarity

Status: **Planning — not yet implemented.** Decisions locked in via user Q&A on 2026-08-02:
- Demo gate: **instant access + email copy** (no magic-link wait)
- Clarity scope: **marketing pages only**, never `/dashboard/*`, `/admin/*`, or tenant public sites (`/[slug]`)

---

## 1. Demo email-gate (lead capture)

### Goal
Turn `/try` from an anonymous, frictionless demo into a lead-capture point: every demo viewer leaves behind a real email address, so marketing knows who is evaluating the product.

### Current flow (as of this plan)
- `apps/web/src/app/try/page.tsx` — visitor picks a role card (OWNER/MANAGER/.../CHEF), no form.
- Calls `POST /auth/demo-login` (`apps/api/src/routes/auth.ts:610`) with just `{ role }` — no email, no password, no auth check, no rate limit.
- API maps role → a seeded demo user in the `demo` tenant, issues a 90-minute JWT, client stores it and redirects to `/dashboard`.
- No record of who viewed it. No rate limiting on this endpoint today.

### New flow
1. Visitor clicks a role card on `/try` (unchanged UX up to this point).
2. A lightweight modal/inline step appears: **"Enter your email to access the demo"** — one field, one submit button. Copy should say plainly what happens next (e.g. "We'll email you a copy of this — no spam, just your demo access").
3. On submit:
   - Client calls a new endpoint `POST /auth/demo-login` (extended) or a new `POST /demo/request` that takes `{ email, role }`.
   - Server creates a `DemoLead` row (email, role, ip, userAgent, createdAt).
   - Server does the *existing* demo-login logic (issue the 90-min JWT) and returns it in the same response — **no waiting on email delivery**, matches the "instant access" decision.
   - Server fires an async (non-blocking) email via the existing Resend integration: "Your ResortPro demo access" — includes the role they picked, a link back to `/try`, and a soft marketing CTA ("Ready to start your free 14-day trial?" → `/plans`).
4. Client stores the token and routes to `/dashboard` exactly as today.

### Data model — new `DemoLead`
```prisma
model DemoLead {
  id         String   @id @default(cuid())
  email      String
  role       String   // matches the /try persona key (OWNER, MANAGER, ...)
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([email])
  @@index([createdAt])
  @@map("demo_leads")
}
```
No FK to `Tenant`/`User` — this is a marketing record, not an auth record; the actual demo session still uses the existing seeded `demo` tenant users, unchanged.

### API changes
- `apps/api/src/routes/auth.ts` — extend the `demo-login` request schema to require `email` (string, email format) in addition to `role`. Reject with a clear 400 if missing/invalid (basic format check only — no verification step, per the "instant access" decision).
- Inside the handler, after issuing the token: `await prisma.demoLead.create({ data: { email, role, ipAddress: request.ip, userAgent: request.headers['user-agent'] } })` — write must not block or fail the response; wrap in try/catch and log-only on failure (a lead-tracking write failing should never break someone's ability to see the demo).
- Add a route-level rate-limit override (matching the existing pattern in `auth.ts`, e.g. `config: { rateLimit: { max: 10, timeWindow: '1 minute' } }`) since this endpoint is now doing a DB write + email send per call and is unauthenticated.
- New email template in the existing guest/transactional email utilities (`apps/api/src/utils/guest-emails.ts` or a sibling file) — reuse the existing `sendEmail`/`wrapGuest`-style wrapper already used for booking emails, keep visual consistency with other ResortPro emails.

### Admin visibility
- New admin page `apps/admin panel/demo-leads` (or a tab under an existing admin page — `tenants` or `export` are the closest existing neighbors) listing: email, role picked, when, and — as a nice-to-have — whether that email later matches a real `Tenant.email`/`User.email` (a simple `WHERE email IN (...)` cross-check) to show demo→signup conversion. This second part can be a fast-follow, not required for v1.
- CSV export of demo leads — check whether the existing `/admin/export` page already has a generic "pick a table, export CSV" mechanism; if so, add `DemoLead` to it rather than building a bespoke export button.

### Edge cases to handle
- Same email tries multiple roles / retries — allow it, every submission is its own lead row (marketing wants to see repeat interest, not just first touch). No dedup needed for v1.
- Invalid/malformed email — reject client-side and server-side, don't create a lead row, don't issue a token.
- Disposable/throwaway email domains (mailinator etc.) — not blocked in v1; flag as a future enhancement if lead quality turns out to be an issue in practice, not worth pre-building.

---

## 2. Free Trial button click visibility

### Recommendation: don't build a parallel in-house counter — use Clarity's Smart Events (§3) instead
Building a custom click-tracking table/endpoint/admin-dashboard just for one button duplicates what Clarity gives for free once it's installed (§3): Clarity lets you define a **Smart Event** in its own dashboard (no code change) that matches "click on element containing text 'Free Trial'" and then shows you a click count, trend chart, and — uniquely — the actual click heatmap and session recordings of people who clicked it. That's strictly more useful than a bare number in an admin table, for zero extra engineering.

### What this means practically
- No new DB table, no new admin page for this specific ask.
- After Clarity is live (§3), a one-time manual step in the Clarity dashboard: define a Smart Event for each Free Trial CTA. Since the buttons currently link to different destinations depending on page (`/plans` on the EN landing page, `/auth/register` on the `bn` landing page and `DemoBanner`), each is a distinct Smart Event target — Clarity supports matching by CSS selector or link text, so this is a few minutes of dashboard configuration, not code.
- If, after using Clarity for a while, a simple always-visible number inside ResortPro's own admin panel turns out to still be wanted (e.g. "47 clicks this week" without opening Clarity), that's a small follow-up: one `POST /marketing/track-click` fire-and-forget call (same pattern as the existing tenant-site `trackPageView`) + a counter table. Deliberately deferred out of v1 scope here since it's speculative until Clarity data is seen.

---

## 3. Microsoft Clarity integration

### Scope: marketing pages only
Covered pages: `/` (EN landing), `/bn` (Bangla landing), `/plans`, `/try`, `/contact`, and any other top-level public marketing route that isn't behind auth.
Explicitly **excluded**: `/dashboard/*`, `/admin/*`, `/auth/*` (login/register forms — no reason to record credential entry), and `/[slug]` tenant public sites (those are each tenant's own site — out of scope, and they already have their own optional GA4 integration per-tenant).

### Why scope it this way (recorded for future reference)
`/dashboard/*` renders real guest names, bookings, payment amounts — a session recording tool there would capture that PII in Clarity's cloud, which is a GDPR problem this project already has explicit tooling for (`/admin/gdpr`) and shouldn't casually reopen. Marketing pages are anonymous, pre-login, no PII risk.

### Implementation approach
- Root layout `apps/web/src/app/layout.tsx` wraps the entire app (there's no separate marketing-only layout today — landing/plans/try/bn all sit at the app root alongside `(dashboard)` and `admin`). Rather than restructuring route groups just for this, add one small client component, e.g. `apps/web/src/components/analytics/ClarityScript.tsx`, that:
  1. Reads the current pathname (`usePathname()`),
  2. Renders Next.js `<Script>` loading the Clarity snippet **only** when the pathname does NOT start with `/dashboard`, `/admin`, `/auth`, or match `/[a-z0-9-]+` tenant-slug pattern (reuse whatever slug-detection logic already exists, if any, or simply an allowlist of the known marketing paths — allowlist is safer than a slug-exclusion regex here, since a denylist can silently miss a new tenant route in the future).
  3. Mount this component once in the root layout.
- New env var: `NEXT_PUBLIC_CLARITY_ID` (added to `apps/web/.env.example`, matching the existing `NEXT_PUBLIC_API_URL` pattern). Component no-ops (renders nothing) if the env var is unset — keeps local dev clean and makes it safe to merge before the Clarity project is actually created.
- No backend changes needed — Clarity is purely a client-side script + Microsoft's own dashboard.

### Setup steps outside the codebase (for the user, not Claude)
1. Sign up at clarity.microsoft.com (free), create a project for resortpro.site.
2. Copy the Project ID, set `NEXT_PUBLIC_CLARITY_ID` in production env (Coolify).
3. After a few days of traffic, define Smart Events in Clarity's dashboard for the Free Trial CTAs (§2) and the `/try` demo entry point.

---

## Implementation order
1. `DemoLead` schema + migration (shadow-DB diff, per project convention — never `db push`).
2. API: extend `/auth/demo-login`, add rate limit, add lead-write + email send.
3. Web: email-capture step on `/try`, wire to updated endpoint.
4. Admin: demo leads list page (or export-table addition).
5. Web: `ClarityScript` component + env var, mount in root layout, verify it's absent on `/dashboard` and present on `/` via browser devtools network tab.
6. Manual (non-code): create Clarity project, set prod env var, define Smart Events post-launch.

## Files expected to change
- `packages/database/prisma/schema.prisma` (+ new migration)
- `apps/api/src/routes/auth.ts`
- `apps/api/src/utils/guest-emails.ts` (or new sibling file for the demo-access email template)
- `apps/web/src/app/try/page.tsx`
- `apps/web/src/app/admin/(panel)/...` — new or extended page for demo leads
- `apps/web/src/components/analytics/ClarityScript.tsx` (new)
- `apps/web/src/app/layout.tsx`
- `apps/web/.env.example`

## Explicitly out of scope for v1 (noted so it isn't silently forgotten)
- Magic-link email verification before granting demo access (rejected in favor of instant access)
- In-house free-trial click counter (deferred — Clarity Smart Events cover it)
- Clarity on tenant public sites or the authenticated dashboard (privacy/GDPR — excluded)
- Disposable-email blocking on the demo-lead form

# ResortPro — Active Project Memory

> Last reconciled: 2026-08-05. Read this before beginning a new task, then
> open the linked source documents relevant to that task. This is a concise
> working memory, not a replacement for the detailed plans.

## Source-of-truth order

1. The founder's latest explicit instruction in the active conversation.
2. Current production code and migrations.
3. `plan/launch-pricing-and-trial-abuse-prevention.md` (locked 2026-08-04)
   for pricing, promotion, customer rights, and billing behaviour.
4. `apps/web/DESIGN_TOKENS.md`, `plan/design-system-migration.md`, and
   `plan/landing-page-design-instructions.md` for visual work.
5. Task-specific plan/documentation and `docs/PROGRESS.md`.

Several older documents are historical. In particular, references to a $0
"Free Forever" plan, the old $20/$50/$100 packages, or a 14-day trial are
superseded by the locked pricing decision below. Never revive those choices
without a new founder decision.

## Product and platform

- ResortPro is a multi-tenant resort-management SaaS for small and independent
  resorts: bookings, front desk, rooms, housekeeping, restaurant/F&B,
  inventory, CRM, invoices, direct-booking websites, custom domains, analytics,
  and super-admin controls.
- Runtime: Next.js web app, Fastify API, PostgreSQL/Prisma, Redis/BullMQ,
  Resend email, Stripe/bKash/SSLCommerz. Desktop client is Electron; mobile
  Expo work is archived/deferred.
- The Electron desktop app is a web-app wrapper today. A true offline-first
  roadmap exists but is not complete: offline bookings must remain drafts until
  the server confirms availability; finance remains read-only offline; inventory
  uses delta movements; the server is authoritative for availability.
- Dashboard: `https://app.resortpro.site`; marketing: `https://resortpro.site`;
  API: `https://api.resortpro.site`; public tenant sites use a slug/subdomain or
  a verified custom domain.
- Tenant isolation is application-level via `tenantId`; treat a missing tenant
  filter as a critical security issue. The architectural audit recommends a
  scoped Prisma client/RLS and broad isolation tests before serious scale.

## Locked commercial model

The only self-serve plans are defined in `packages/types/src/plans.ts`:

| Customer name | Internal key | Monthly / annual | Limits |
|---|---|---:|---|
| Solo | `FREE` | $10 / $100 | 1 property, 5 rooms, 2 staff |
| Independent Resort | `STARTER` | $19 / $190 | 1 property, 20 rooms, 20 staff |
| Resort Group | `PROFESSIONAL` | $59 / $590 | 5 properties, 200 rooms, 100 staff |

- `FREE` is only a legacy enum name; it is a paid Solo plan, never a $0 tier.
- `ENTERPRISE` remains legacy/custom only and is not publicly selectable.
- All three paid plans receive a server-controlled three-calendar-month launch
  offer when eligible. Do not hard-code its dates or promise an open-ended
  trial.
- Solo retains core daily operations and data export. Independent starts custom
  domain and extended operations; Resort Group adds multi-property, OTA/corporate
  capabilities, advanced reporting, and higher AI allowance.
- Pricing principles: no data hostage, read-only before destructive action,
  clear capacity warnings, 60-day price-change notice, and 12-month price
  protection for existing paid customers.
- Stripe/bKash price IDs are production configuration, not source-code values.
  The repository compose files have mappings, but Coolify stores its own raw
  compose configuration; verify new values there before claiming paid checkout
  is operational.

## Design rules

- Dashboard work uses the 3-tier system: tokens → primitives → composite
  patterns. Use `PageShell`, `PageHeader`, and `ActionButton` when they match;
  do not add raw hex, arbitrary type sizes, or inline visual shadows.
- New modals always use `ModalShell` with portal/body-scroll behaviour.
- Existing dashboard migrations are visual refactors, not silent redesigns.
  Preserve page-specific layout/header shape, test light/dark/mobile, and run
  `node scripts/design-system-ratchet.mjs`; the baseline may only decrease.
- Landing page: Nunito is the primary font; Bitcount Prop Single is a sparse
  accent for metrics/eyebrows/numbers. White canvas, deep navy `#183153` as
  dark anchor, coral `#EF725C` as main accent, plus pale peach/gold/mist blue.
  No green-led identity, no cream `#F7F3ED` canvas, no multicolour/italic H1,
  and show the ResortPro wordmark only once per placement.
- The landing-page instruction's current $0-pricing section is stale; use the
  locked commercial model above until that document is updated.

## Authentication and user experience

- Standard owner sign-in is `/auth/login`; workspace (tenant slug), email, and
  password are currently required. New welcome emails link to this clean login
  page with `?workspace=` to prefill the workspace.
- Legacy `/{slug}/dashboard` email links redirect to the same clean login page;
  never generate new tenant-slug dashboard paths.
- Registration creates the workspace and either sends the owner to the
  launch-offer onboarding path or to secure checkout for an incomplete plan.

## Delivery and operations

- The required release path is **local → `dev` staging → `main` production**.
  Do not send an untested local change straight to `main` except for an
  explicitly approved emergency fix.
- Work on a focused feature/fix branch, verify locally, merge/push to `dev`,
  then test staging at `https://resortpro.webcoronet.com` (API:
  `https://resortpro-api.webcoronet.com`). `.github/workflows/deploy-staging.yml`
  builds SHA-tagged `:dev-<sha>` images and updates the Portainer staging stack.
- Only after the staging flow works, merge `dev` into `main`. `main` deployment
  uses `.github/workflows/deploy.yml`: it builds SHA-tagged API and web GHCR
  images, patches Coolify's stored raw compose via its API, then waits for API
  and web health checks. A green deploy workflow confirms both health endpoints,
  not necessarily every separate CI job.
- Production deploys completed successfully for pricing/welcome-email changes
  through commit `4b9b371` (2026-08-05 context).
- The independent CI workflow currently has stale test expectations around the
  old free/trial access behaviour; fix fixtures and the pnpm setup before using
  its status as a release-quality signal.
- Before production changes: preserve unrelated working-tree edits, run
  relevant build/tests, deploy only after an explicit implementation request,
  and report any configuration action that needs founder-owned credentials.

## Project state and roadmap

- Core PMS, front desk, calendar, check-in/out, invoices, rate plans, guest
  communication, walk-ins, maintenance, themes, website builder, referrals,
  admin controls, and many operations modules are largely built.
- Strategic gaps from the plan index/audits: dependable backups/restore,
  review management, dynamic pricing, full Booking.com/Airbnb integration,
  facilities/activities, operational SMS/WhatsApp triggers, hardened tenant
  isolation, migration discipline, observability, and self-serve activation.
- Commercially, the intended near-term strategy is a pilot-first launch:
  hand-onboard 2–3 real resorts, create honest proof/testimonials, focus on
  one acquisition channel, and measure activation, conversion, churn, and
  support cost before changing price.
- AI ships behind feature flags. Keep the platform AI master switch safe/off by
  default, enforce quotas, protect tenant data, and avoid model/API cost before
  real demand justifies it.

## Always read for a task

| Task type | Read first |
|---|---|
| Dashboard UI or modal | `apps/web/DESIGN_TOKENS.md`, `plan/design-system-migration.md`, `AGENTS.md` |
| Landing/marketing design | `plan/landing-page-design-instructions.md` plus this file's pricing correction |
| Pricing/billing/onboarding | `plan/launch-pricing-and-trial-abuse-prevention.md`, `code-instructions/pricing-implementation-steps-2-4.md`, `packages/types/src/plans.ts` |
| Deploy/production | `.github/workflows/deploy.yml`, `docs/coolify-deployment.md`, `DEPLOY.md` |
| Feature work | `docs/PROGRESS.md`, then the relevant `plan/*.md` and task document |
| Security/data | `plan/security-audit-2026-07.md`, `plan/auth-origin-hardening.md`, `docs/SYSTEM_REVIEW.md` |

# ResortPro — Active Project Memory

> Last reconciled: 2026-09-10. Read this before beginning a new task, then
> open the linked source documents relevant to that task. This is a concise
> working memory, not a replacement for the detailed plans.
>
> **This file is the entry point for a new conversation.** The repository holds
> around a hundred plan documents and a dozen top-level ones, written over
> months; several now describe things that have since shipped or changed. When
> this file and another document disagree, this file wins — and if you find a
> document that is wrong, say so rather than quietly working around it.

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

## How the founder wants to work

These have been said more than once. They are not preferences to weigh; treat
them as constraints.

- **Small steps.** Never take a large multi-file task in one go. Smallest
  useful piece → verify it → check in → next. An approved plan is not approval
  to do all of it silently.
- **Never push without explicit approval.** Not to `dev`, not to `main`. Say
  what would be pushed and wait.
- **Anything that needs a server, write a prompt.** There is no access to the
  staging or production hosts from here. Write a self-contained prompt, save it
  under `plan/fixes/`, send the file — never a list of steps for the founder to
  perform by hand. **And say plainly, before the file, which session to paste it
  in, in what order, and what to bring back.** The founder has said they often
  cannot tell which session a prompt belongs to.
- **Production data safety is absolute.** Never `prisma db push`, never
  `migrate reset`, never `--accept-data-loss` against a real database.
  Migrations only. SQL in verification prompts is read-only.
- **Bangla is gated.** No unconditional Bangla in the product UI — always
  `isBn = useLocale() === 'bn'`. English is the default for everyone outside
  Bangladesh. (Conversation with the founder is Bangla/Banglish; that is
  separate.)
- **Report honestly.** If a test fails, show it. If a step was skipped, say so.
  If something was proven only by unit test and not on a device or server, say
  which. A green CI run is not evidence that the code is live.

## What shipped since the previous reconciliation (2026-08-05 → 2026-09-10)

About 150 commits reached `main`. The parts that change how you should think
about the codebase:

- **Check-out billing is built.** One calculation for what a stay owes,
  provenance on every charge (`sourceType` + `sourceId`), immutable finalised
  invoices, adjustments instead of edits, and settlement in a single
  transaction. The rules live in `plan/billing-contract.md` — read it before
  touching anything that produces money.
- **Restaurant charges reach the room.** A food order carries an explicit
  `settlement` (`CHARGE_TO_ROOM` / `PAY_NOW`) rather than having it inferred.
  Cancelling a billed order issues a credit; it never edits the original.
- **Early check-in / late check-out.** `StayTimePolicy` per tenant, wall-clock
  windows in `Tenant.timezone`, `StayTimeGrant` for what was actually given.
  **Off by default** (`enabled` defaults to `false`) — a tenant turns it on in
  settings.
- **The Android staff app** — session restore, app lock, Bangla, housekeeping
  laid out for the person doing the work, an outbox-backed sync badge, and
  walk-in guest documents from the camera or the gallery.
- **Backups now include the uploads volume.** `guest_documents` rows hold only
  a URL; the images live on disk. See "Backups" below — this is partly still
  open.

## Documents that are wrong today

Do not trust these without checking the code first. Fixing them is welcome;
silently believing them is how a session goes wrong.

- `plan/landing-page-design-instructions.md` still carries a $0-pricing
  section. Use the locked commercial model below.
- Anything describing mobile as Expo, archived, or deferred.
- Corrected on 2026-09-10: `plan/README.md` and
  `plan/checkout-billing-completeness.md` used to say P0 check-out billing was
  "❌ Not built — loses money today" long after it shipped. Both now say built.
  The evidence section inside the P0 plan is deliberately kept as the *before*
  picture and is labelled as such — do not read it as current.
- The general rule: a `plan/*.md` describes the state on the day it was
  written. Check the code before believing a status line, and fix the line when
  you find it wrong.

## Product and platform

- ResortPro is a multi-tenant resort-management SaaS for small and independent
  resorts: bookings, front desk, rooms, housekeeping, restaurant/F&B,
  inventory, CRM, invoices, direct-booking websites, custom domains, analytics,
  and super-admin controls.
- Runtime: Next.js web app, Fastify API, PostgreSQL/Prisma, Redis/BullMQ,
  Resend email, Stripe/bKash/SSLCommerz. Desktop client is Electron.
- **Mobile is a native Android app** in `apps/android` — Kotlin, Jetpack
  Compose, Room, `site.resortpro.android`, minSdk 24, versionName 0.1.0. It is
  a staff app (housekeeping, walk-in check-in, guest documents), not a guest
  app, and it is offline-first with a Room-backed outbox. The older Expo/React
  Native effort is archived; do not resurrect it, and do not describe mobile as
  "deferred".
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
- **The two environments get their compose differently, and this trips people
  up.** Staging's workflow sends the *whole* `docker-compose.staging.yml` as
  text, so any edit to that file reaches staging on the next deploy.
  Production's compose lives **in Coolify's own database, not in git**; the
  workflow fetches it, rewrites only the image tags, and puts it back. So a
  change to `docker-compose.coolify.yml` — a new volume, a new env var, a
  changed entrypoint — **never reaches production on its own**. It has to be
  typed into Coolify by hand. Design changes so the part that must ship in the
  image does, and only the unavoidable line needs a manual edit.
- A green deploy is not proof the new code is running. Prove it with something
  only the new build has — a route that did not exist (401 rather than 404), a
  row in `_prisma_migrations`, a changed response. If a batch adds no such
  marker, say so instead of implying the deploy was verified.
- The API's `CMD` chains `migrate deploy && seed-demo && seed-admin && index.js`
  with `&&`. A failing seed therefore means the API never starts at all.
- Staging deploys have hit a Cloudflare 100-second timeout (524) on the
  Portainer stack update. It is not fixed and will recur.
- Before production changes: preserve unrelated working-tree edits, run
  relevant build/tests, deploy only after an explicit implementation request,
  and report any configuration action that needs founder-owned credentials.

### Backups — read before promising anything about them

- The `backup` sidecar runs `scripts/backup-db.sh`, which runs two independent
  legs: `backup-postgres.sh` (`pg_dump -Fc`, verified with `pg_restore --list`)
  and `backup-uploads.sh` (a plain `tar` of the uploads volume, verified with
  `tar -tf`). They are separate processes on purpose — neither may take the
  other down.
- **Guest ID and passport images are not in the database.** `guest_documents`
  holds a URL; the file is on disk under `<tenantId>/guest-docs/`. A dump alone
  restores every row and no image.
- Staging had **no database backup at all** from August until 2026-09-10 —
  about fifty consecutive 0-byte dump files. Two separate credential mismatches
  in the same compose file, found one after the other: `PGPASSWORD` had no
  default where the database had one, and then `POSTGRES_DB` defaulted to
  `resortpro` where the database is `resortpro_staging`. Both fixed;
  `scripts/check-backup-credentials.mjs` now asserts in CI that the backup
  resolves to the same user, database and password as postgres, and prints them
  in the log on every run.
- Two lessons worth more than the fixes. **A manual run proving a script works
  says nothing about the scheduled run** — read the container's own startup
  log. And **a comment warning about a hazard does not prevent it**: the
  PGPASSWORD fix carried a comment about mismatched defaults, written without
  checking the line two below it, which held the next instance of exactly that
  bug. Mechanical checks, not warnings.
- Staging's backup was verified end to end on 2026-09-10: two `ok` lines from
  the container's own startup run, a 361 KB dump, and a restore into a scratch
  database whose tenant/booking counts matched the live database exactly.
- **Production has no backup service at all.** Established 2026-09-10 by
  reading the server: Coolify's stored compose has four services — `postgres`,
  `redis`, `api`, `web`. The `backup` and `worker` services exist only in
  `docker-compose.coolify.yml` in git, which is **not** what production runs.
  The deploy workflow only `sed`s the two image tags in Coolify's stored
  compose (`deploy.yml`), so it can never add a service. No amount of
  deploying will bring them into existence. **Production has never had a
  database backup.** Do not describe it as backed up, and do not assume the
  service is there and merely misconfigured.
- **The worker has never run on production either**, so pre-arrival reminders,
  iCal sync, daily reports, automation sequences, trial emails and the expiry
  of abandoned public booking holds have never happened. Turning it on for the
  first time is its own decision, not a side effect of a backup fix: it acts on
  a backlog that has been accumulating for months. Read the second half of
  `plan/fixes/backup-restore-runbook.md` before it is ever started.
- Whatever is added, backups still sit on the same host as the database.
  Copying them off-box has not been done.
- The general lesson, which has now cost real time twice: **a service in a
  compose file in git is not a service that is running.** Staging's whole file
  is sent to Portainer on each deploy, so git is truth there. Production's is
  not. Check the server before reasoning about production's topology.

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

## Known open, as of 2026-09-10

Do not re-discover these; do not claim any of them is done without checking.

- **Production has no backup service and no worker** — see "Backups" above for
  the detail. The next step is reconnaissance, not a fix:
  `plan/fixes/production-backup-recon.md`.
- **Deleting a guest does not delete their ID photograph.** `GuestDocument`
  cascades from both `Guest` and `Tenant`, so the rows go; the file on disk is
  only ever removed by the explicit `DELETE /guests/:id/documents/:docId`
  route. Every other path — deleting a guest, deleting a tenant, staging's
  nightly demo refresh — leaves the passport or NID scan on disk with nothing
  pointing at it. Staging currently holds four such orphans against zero
  `guest_documents` rows. This is a privacy problem, not just wasted disk: a
  guest asking to be deleted is not actually deleted.
- **Old guest documents on staging and production still carry `localhost`
  URLs.** New uploads are fixed (the route now derives the origin from the
  request); the existing rows were never repaired, and those documents are
  unreachable. Repairing them is an undecided, separate job.
- **Android:** a rejected sync change still vanishes silently (`flushOutbox`
  deletes on 4xx); an offline restart logs the housekeeper out entirely; there
  is no both-sides resolution UI for a 409; no global offline banner; "Report a
  problem" does not create a maintenance ticket. The walk-in document Retry
  button has not been pressed on a real device.
- **`SEED_DEMO_REFRESH`** is set in Coolify's stored compose but no deploy has
  used it. The safer first move is a one-off manual
  `docker exec … SEED_DEMO_REFRESH=1 node dist/scripts/seed-demo.js`, because
  the seed gates API startup.
- **Signup and `/plans`:** open product question — whether every signup CTA
  should route through `/plans` first. Also check whether the launch promotion
  is actually live before "Start Free Trial" in `DemoBanner.tsx` keeps promising
  a trial.
- **Host DNS**, containers stuck in `Created` — root cause still unknown.
- Restaurant billing remainder: COMPLIMENTARY/CORPORATE settlement, the QR
  token flow, and reporting.

## Always read for a task

| Task type | Read first |
|---|---|
| Anything that produces money | `plan/billing-contract.md` — provenance, idempotency, immutable invoices, adjustments over edits |
| Dashboard UI or modal | `apps/web/DESIGN_TOKENS.md`, `plan/design-system-migration.md`, `AGENTS.md` |
| Landing/marketing design | `plan/landing-page-design-instructions.md` plus this file's pricing correction |
| Pricing/billing/onboarding | `plan/launch-pricing-and-trial-abuse-prevention.md`, `code-instructions/pricing-implementation-steps-2-4.md`, `packages/types/src/plans.ts` |
| Android app | `apps/android/README.md`, `plan/mobile-app-ux.md`, `plan/offline-sync-conflicts.md` |
| Deploy/production | `.github/workflows/deploy.yml`, `docs/coolify-deployment.md`, `DEPLOY.md`, and the compose caveat above |
| Backups/restore | `plan/fixes/backup-restore-runbook.md` |
| Feature work | `docs/PROGRESS.md`, then the relevant `plan/*.md` and task document |
| Security/data | `plan/security-audit-2026-07.md`, `plan/auth-origin-hardening.md`, `docs/SYSTEM_REVIEW.md` |

## Repository facts worth knowing before you start

- pnpm workspace + Turbo. Apps: `apps/web` (Next.js), `apps/api` (Fastify),
  `apps/android` (Kotlin), `apps/desktop` (Electron), `apps/embed`,
  `apps/wordpress-plugin`. Shared: `packages/database` (Prisma),
  `packages/types`.
- Work usually happens in a **git worktree** under `.claude/worktrees/`, not
  the main checkout. The stash stack is shared across worktrees — never bare
  `git stash`.
- The Android build needs JDK 17; there is no system Java. Use
  `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
- The API container ships only `dist/` and has no `tsx`. Scripts run as
  `node dist/scripts/<name>.js` and must be listed in `apps/api/tsup.config.ts`
  to exist at all.
- `prisma migrate diff --exit-code` against a shadow database is how you prove
  hand-written SQL matches the datamodel. Do that rather than trusting a
  migration by eye.
- Tenant scoping does not survive a Prisma interactive transaction — the
  callback hands back an unextended client, so pass `tenantId` explicitly
  inside `$transaction`.
- `createMany({ skipDuplicates })` drops duplicates **silently**, and Postgres
  treats NULLs as distinct in unique indexes. Both have caused real bugs here.

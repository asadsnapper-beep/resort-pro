# ResortPro Customer Readiness Report

**Audit date:** 18 August 2026  
**Scope:** repository and safe local-test environment only. No production data, production credentials, paid payment gateway, real email delivery, or production infrastructure was changed.

## 1. Verdict

**🔴 NOT READY FOR CUSTOMER**

ResortPro has a substantial and working core: the tested booking lifecycle, concurrent room-booking protection, tenant checks for rooms/bookings, authentication flows, and role-based dashboard navigation passed. It is not safe to onboard a real paying resort yet because the deployed dependency set contains known critical security vulnerabilities, the deployment definition does not start the required background worker, upload persistence is not configured in the production compose file, and backup/restore has not been implemented or rehearsed.

## 2. Readiness score

**Overall: 44 / 100**

| Area | Score | Evidence-based assessment |
|---|---:|---|
| Core functionality | 70 | Rooms, booking, check-in and checkout happy path pass API integration tests. |
| Booking reliability | 70 | Overlap checks and a five-request race test pass; OTA and payment flows remain incomplete/unproven. |
| Data integrity | 45 | Booking transaction is good, but inventory writes are non-atomic and recovery is absent. |
| Multi-tenant isolation | 65 | Scoped Prisma and 13 targeted tests pass; not every resource family has an adversarial test. |
| Security | 15 | `pnpm audit --prod` reports 4 critical and 48 high vulnerabilities. |
| UX / operations | 60 | Critical role views work on desktop/mobile; full receptionist workflow was not run end-to-end. |
| Performance | 45 | Pagination exists in key lists, but important queries fetch unbounded data. |
| Reliability | 35 | Worker is missing from compose and external dependency failures have limited recovery. |
| Observability | 30 | Pino logs, health check, in-memory metrics and admin audit log exist; no error tracking/central monitoring. |
| Backup / recovery | 0 | Backup/restore is documented as not built; no restore rehearsal. |
| Test coverage | 55 | 68 API tests and 44 E2E checks pass, but payments, inventory, upload, recovery and public booking have little/no automated coverage. |
| Deployment readiness | 30 | Containers build, but migration and service topology safety are incomplete. |

## 3. Launch blockers

### P0 — Known critical dependency vulnerabilities

- **Affected feature:** all authenticated web and API use.
- **Evidence:** `pnpm audit --prod --audit-level=low` on 18 August found **103 vulnerabilities: 4 critical, 48 high, 42 moderate, 9 low**. It specifically reports `next@14.2.14` vulnerable to a Next.js middleware authorization bypass (patched in `>=14.2.25`), and `@fastify/jwt@8.0.1` pulls vulnerable `fast-jwt@4.0.5` with critical JWT advisories.
- **Relevant locations:** [apps/web/package.json](../../apps/web/package.json), [apps/api/package.json](../../apps/api/package.json).
- **Reproduction:** run the audit command above with network access.
- **Business impact:** a known authorization or JWT issue can undermine tenant/admin access boundaries.
- **Minimum fix:** upgrade Next.js to a current patched compatible release, upgrade Fastify/JWT chain to patched versions, update the lockfile, then run API tests, full E2E, production build, and the audit again. Do not treat the result as clear until critical/high production vulnerabilities are remediated or explicitly risk-accepted with compensating controls.

### P0 — No implemented, verified backup and restore capability

- **Affected feature:** every customer record: bookings, guests, invoices, documents and configuration.
- **Evidence:** [plan/README.md](../../plan/README.md) marks `tenant-backup-restore` as “Not built”; [plan/tenant-backup-restore.md](../../plan/tenant-backup-restore.md) is a future plan, not an implementation. Repository search found no backup job, restore endpoint, `pg_dump` process, or restore verification.
- **Reproduction:** inspect the plan and deployed service definitions; no executable backup/restore service exists.
- **Business impact:** a mistaken deletion, bad migration, disk/database failure, or operator error has no demonstrated recovery path.
- **Minimum fix:** configure automated encrypted PostgreSQL backups outside the database host, retention, access control and monitoring; write a restoration runbook; restore a backup into an isolated database and verify bookings, invoices, documents and tenant boundaries before onboarding.

### P0 — Required background worker is absent from production and staging compose definitions

- **Affected feature:** pre-arrival reminders, iCal syncing, daily reports, automation sequences, trial email lifecycle and expiry of abandoned public booking holds.
- **Evidence:** [apps/api/src/worker.ts](../../apps/api/src/worker.ts) is the only process that schedules these jobs. [docker-compose.coolify.yml](../../docker-compose.coolify.yml), [docker-compose.production.yml](../../docker-compose.production.yml), and [docker-compose.staging.yml](../../docker-compose.staging.yml) define `postgres`, `redis`, `api`, and `web`, but no `worker` service. CI starts `node dist/worker.js` separately in [ci.yml](../../.github/workflows/ci.yml), proving it is required rather than embedded in the API process.
- **Reproduction:** deploy from either compose definition; no container executes `node dist/worker.js`.
- **Business impact:** external availability will become stale, abandoned booking holds will not expire, and promised customer communications/reports will silently stop.
- **Minimum fix:** add a single-replica worker service using the API image with `node dist/worker.js`; give it database/Redis/email environment variables, restart policy, health/liveness check and monitoring. Ensure only one scheduler instance is active.

### P0 — Customer-uploaded files can be non-persistent in the documented production deployment

- **Affected feature:** room images, website images, guest ID/passport documents, profiles and menus.
- **Evidence:** storage defaults to `local` when no database/env setting exists in [storage.ts](../../apps/api/src/services/storage.ts). The production/coolify compose files neither set S3/R2 storage variables nor mount an `uploads` volume for the API. The container filesystem is replaced on redeploy.
- **Reproduction:** deploy with the supplied compose and default storage configuration, upload an image, recreate the API container; local upload files are not guaranteed to remain.
- **Business impact:** customer documents and website assets can disappear after a redeploy. ID document loss is particularly serious.
- **Minimum fix:** require an object-storage configuration before launch (R2/S3 private bucket, encryption, lifecycle, least-privilege credentials, signed/private document access), test upload/read/delete and a redeploy. Do not use a public object/CDN URL for guest identity documents.

## 4. Important non-blocking issues

| Severity | Finding | Evidence and recommended fix |
|---|---|---|
| P1 | Payment gateway credentials are stored/read as plaintext JSON. | [schema.prisma](../../packages/database/prisma/schema.prisma) describes `TenantPaymentConfig.credentials` as encrypted but [payments.ts](../../apps/api/src/routes/payments.ts) contains `TODO: decrypt in production`; storage credentials are also in `PlatformSettings.storageConfig`. Use KMS-backed envelope encryption, key rotation and masked audit logs before enabling tenant payment credentials. |
| P1 | External calendar URLs enable SSRF. | Owner/manager controlled `icalUrl` accepts any Zod-valid URL and is fetched by [externalCalendars.ts](../../apps/api/src/routes/externalCalendars.ts) and the cron in [ical-sync.ts](../../apps/api/src/jobs/ical-sync.ts), with no HTTPS-only rule, host allowlist, DNS/IP private-range blocking or redirect validation. Add URL policy plus egress restriction. |
| P1 | Public checkout is bearer-by-ID rather than a signed, expiring guest capability. | [payments.ts](../../apps/api/src/routes/payments.ts) exposes booking guest name/email/details through `GET /checkout/booking/:bookingId` and allows `POST /checkout/init` by booking ID. UUID guessing is hard but not authorization. Use a random checkout token stored hashed, scope it to the booking and expiry, and never return guest email unnecessarily. |
| P1 | Inventory movement and stock update are not atomic. | [inventory.ts](../../apps/api/src/routes/inventory.ts) reads stock then runs movement creation and stock update via `Promise.all`; concurrent OUT requests can both pass the old-stock check and overwrite each other. Use one serializable transaction with conditional atomic decrement; add concurrent OUT tests. |
| P1 | Migration safety is unverified. | Local `prisma migrate status` shows **42 unapplied committed migrations**. This does not prove production drift, but production startup runs `prisma migrate deploy` automatically in [apps/api/Dockerfile](../../apps/api/Dockerfile) with no backup, rehearsal or rollback gate. Rehearse an upgrade from a production clone and verify rollback/restore before real data. |
| P2 | Landing E2E tests are stale. | The test suite expects retired text/CTAs in [landing.spec.ts](../../apps/web/tests/e2e/landing.spec.ts); the current page uses “Run your resort without the daily confusion.” and “Try ResortPro” in [LandingPage.tsx](../../apps/web/src/components/landing/LandingPage.tsx). Update tests to current intended content and use resilient role/URL assertions. |
| P2 | Reports/inventory can degrade at realistic scale. | Dashboard/reports and low-stock filtering use broad `findMany`; low-stock filtering fetches all candidate inventory to filter in JavaScript. Add indexed SQL filtering/raw query or persisted low-stock state, pagination and load tests with the stated 50,000-booking scenario. |
| P2 | Observability is local-only. | [metrics.ts](../../apps/api/src/utils/metrics.ts) keeps only 2,000 in-process entries and resets on restart. No Sentry/OTel/central logging integration was found. Add error tracking, alerting for 5xx, worker failures, webhook failures, backup failures and request IDs propagated into logs. |
| P2 | Auto-invoice errors can occur after test teardown without surfacing to staff. | API tests pass but emitted an asynchronous invoice FK error during test cleanup; [bookings.ts](../../apps/api/src/routes/bookings.ts) catches invoice creation failures and sends only an admin notification. Ensure invoice jobs are durable/retried and surface an owner-visible reconciliation alert. |

## 5. What already works well

- **Booking concurrency:** `race-condition.test.ts` passed. Exactly one of five simultaneous same-room/same-date requests succeeded and four returned conflict.
- **Booking lifecycle:** API integration test covered register, room creation, booking, overlap rejection, check-in, duplicate check-in rejection, checkout and availability.
- **Targeted tenant protection:** two simulated tenants could not list, read, update, delete, cancel or check-in the other tenant’s tested room/booking. The database wrapper in [packages/database/src/index.ts](../../packages/database/src/index.ts) fails closed without a tenant ID and scopes the common Prisma operations, including `groupBy`.
- **Role UX smoke:** 44 of 52 Chromium/Mobile Safari auth/role tests passed. Owner, receptionist, shareholder, staff and chef navigation/visibility checks passed on both form factors.
- **Build/type validation:** API typecheck, web typecheck and web production build completed successfully. Prisma schema validation also passed.

## 6. Real resort simulation results

| Workflow | Result | What was actually exercised |
|---|---|---|
| Registration and email-verification guard | PASS | API integration tests. Delivery itself was disabled locally. |
| Room setup and booking creation | PASS | API integration tests. |
| Overlap prevention | PASS | Same-room overlap gives 409; five-way concurrency test passed. |
| Check-in / checkout | PASS | API integration tests. |
| Cancellation, extension, early checkout, no-show | PARTIAL | Code exists but full scenario matrix was not executed. |
| Guest CRM/documents | PARTIAL | Routes and tenant checks inspected; upload persistence and document privacy are not launch-ready. |
| Staff permissions | PASS / PARTIAL | Key UI roles tested; API authorization across every module not adversarially tested. |
| Inventory integrity under concurrent updates | FAIL | Source confirms non-atomic read/compute/write. |
| Public website availability and booking | PARTIAL | Implemented and inspected; real payment/OTA workflow not run. |
| Payment gateway verification/webhooks/refunds | NOT TESTED | No safe real gateway sandbox credentials or webhook environment were provided. |
| Multi-tenant cross-access | PASS / PARTIAL | Tested for rooms, bookings, guests and selected mutations; other resource families remain untested. |
| Worker jobs | FAIL in documented deployment | Worker code exists but compose does not run it. |
| Backup and restoration | NOT TESTED / NOT IMPLEMENTED | No implementation or rehearsal found. |

## 7. Security findings

### Confirmed

1. **P0:** 4 critical and 48 high dependency vulnerabilities, including known Next.js authorization bypass and Fast JWT advisories.
2. **P1:** payment and storage credentials are stored as unencrypted JSON despite code comments claiming encryption.
3. **P1:** authenticated calendar configuration can cause server-side requests to arbitrary URLs (SSRF).
4. **P1:** public booking checkout uses a booking UUID as access control and reveals guest information.

### Theoretical / not proven in this audit

- A cross-tenant read/write in modules outside rooms/bookings/guests.
- Payment webhook signature bypass for a live configured gateway.
- Production secret exposure. A repository scan looked only for secret-shaped strings and did not disclose values; no confirmed committed production key was reported from that scan.

## 8. Data integrity findings

- **Positive:** booking creation uses a serializable transaction and handles serialization failure as a 409. Invoice numbering uses an atomic tenant-scoped counter.
- **Risk:** no database exclusion constraint prevents overlapping active bookings; the protection is application/transaction based, so every alternate booking write path must be kept inside that invariant.
- **Risk:** `Booking` has indexes on `tenantId`, date range and status separately, but not a composite index supporting the common tenant + room + active-status + date-overlap conflict query. Benchmark before scale.
- **Confirmed:** inventory stock is not concurrency-safe.
- **Recovery gap:** no verified way to restore corrupted/deleted tenant data.

## 9. Missing tests, ranked by business risk

1. A security regression suite for patched dependencies and protected Next.js routes.
2. Payment capability-token, webhook signature, replay/idempotency, duplicate charge, partial payment and refund tests.
3. Concurrent inventory OUT/adjustment test and atomic rollback test.
4. Tenant-isolation attack tests for invoices, payments, documents, inventory, staff, CRM, reports, website configuration and uploads.
5. Full booking state matrix: amend dates, cancellation/refund, no-show, extension, early checkout, OTA conflict and multi-room/group booking.
6. Worker integration tests: one scheduled execution, duplicate worker prevention, retry/dead-letter behavior and failed email/iCal handling.
7. Storage persistence/access-control tests, including document authorization and deploy survival.
8. Updated landing E2E and a real public-booking UI test.

## 10. Production infrastructure gaps

- No worker service in production/staging compose.
- No deploy-time backup, restore verification or migration rehearsal/rollback plan.
- Local file upload default has no persistent volume/object-store requirement.
- Redis has no configured password in the supplied production compose (internal network reduces exposure but authentication is still a recommended defence-in-depth control).
- No external error tracking, durable metrics, alerting or worker failure dashboard.
- `health` only means the HTTP process responds; it does not check database, Redis, queue/worker, storage, email or payment reachability.
- Egress restrictions are absent, which makes arbitrary URL fetches more dangerous.

## 11. Minimum launch checklist

### Must complete before customer

- [ ] Upgrade/lock all critical and high production dependencies; rerun `pnpm audit --prod` with no critical/high findings accepted for launch.
- [ ] Add worker service, prove one worker is live, and alert when it stops.
- [ ] Configure persistent private object storage; validate uploads across a container recreation.
- [ ] Establish automated PostgreSQL backups and successfully restore one into an isolated environment.
- [ ] Rehearse pending migrations from a production-like database clone; document rollback/restore decision points.
- [ ] Encrypt gateway/storage credentials at rest and migrate existing secrets safely.
- [ ] Fix SSRF controls on calendar URLs and replace public checkout IDs with expiring signed/capability tokens.
- [ ] Make inventory movement transactionally safe and add a concurrency test.
- [ ] Run a controlled staging acceptance pass: owner onboarding, room/rate setup, booking, edit/cancel, payment sandbox, check-in/out, document upload, website booking, iCal sync and staff roles.
- [ ] Add production alerts for 5xxs, failed jobs, failed emails/webhooks, failed migrations and backup failures.

### Can complete after a controlled pilot begins

- [ ] Update stale landing E2E tests.
- [ ] Broaden tenant-isolation tests to every resource family.
- [ ] Load test dashboard, reports and low-stock paths at expected customer volume.
- [ ] Add durable job queue/retry/dead-letter semantics for all external integrations.
- [ ] Improve receptionist keyboard/mobile efficiency and destructive-action confirmation coverage.

## 12. First-customer recommendation

**C. Keep ResortPro internal until blockers are fixed.**

Do not onboard a paying or trusted customer while known critical dependencies, missing backup/restore proof, non-running worker and non-persistent upload configuration remain. Once every “must complete” item is verified in staging, onboard **one trusted resort as a controlled pilot**, with daily monitoring and a named support owner. Only move to normal paying onboarding after that pilot completes at least one real booking-to-checkout cycle without data, availability, payment or recovery failures.

## Validation log

| Command / check | Result |
|---|---|
| `pnpm --filter @resort-pro/api test` | PASS — 7 files, 68 tests. |
| `pnpm --filter @resort-pro/api lint` | PASS. |
| `pnpm --filter @resort-pro/web exec tsc --noEmit` | PASS. |
| `pnpm --filter @resort-pro/web build` | PASS; a non-fatal build-time `fetch failed` warning occurred while no local API was running. |
| `node scripts/design-system-ratchet.mjs` | PASS — no regression against baseline. |
| Auth + roles E2E desktop/mobile | PASS — 44 checks. |
| Landing E2E desktop/mobile | FAIL — 8 stale assertions use retired page copy/CTAs. |
| `pnpm --filter @resort-pro/database exec prisma validate` | PASS. |
| `prisma migrate status` against local DB | FAIL — 42 committed migrations are not applied locally; production state was not accessed. |
| `pnpm audit --prod --audit-level=low` | FAIL — 103 reported vulnerabilities, including 4 critical and 48 high. |


# Full Release-Candidate QA Audit

**Date:** 2026-09-30 (Asia/Dhaka)  
**Target:** ResortPro customer handoff next week  
**Perspectives covered:** Super Admin, resort owner, operational staff, shareholder, guest, engineer, QA, business owner, accessibility, security, deployment, and support operations  
**Verdict:** **NO-GO for production handoff. Suitable for controlled desktop staging/UAT only.**

## Executive decision

The core product is substantially functional. The API suite passes 213/213 tests, financial consistency is clean across 72 local bookings, the build completes, tenant isolation/race-condition/checkout tests pass, all 18 Super Admin destinations load, the real guest demo loads on desktop and mobile, and the current E2E suite passes 49/58 checks.

The release is nevertheless blocked by two known Critical authorization/bootstrap issues:

1. A fresh production deployment can seed a SUPER_ADMIN account with a public default password.
2. Every authenticated tenant role can still call tenant Billing APIs, including checkout and Billing Portal creation, because those routes enforce authentication but not OWNER authorization.

Major control gaps also remain in admin RBAC presentation, privileged audit logging, MFA/session security, off-host backup, production environment preflight, web accessibility, production image optimization, browser security headers, and automated coverage of payment/admin/worker code.

## Test matrix and results

| Area | Test performed | Result |
|---|---|---|
| API unit/integration | 21 files, 213 tests | **213/213 passed** |
| API TypeScript | `tsc --noEmit` | Passed |
| API coverage | V8 coverage | 37.56% source statements overall |
| Full build | Turbo monorepo build | Passed; web lint skipped |
| Fresh uncached web build | Direct `next build` | Passed; emitted API `ECONNREFUSED` fetch errors without failing |
| Design-system ratchet | 47 dashboard pages | Passed; one hard-coded color improvement |
| Production compose syntax | Missing vars and dummy required vars | Syntax passed in both cases |
| E2E Chromium + Mobile Safari | 58 tests | **49 passed, 9 failed** |
| Super Admin destinations | 18 pages, real sidebar clicks | **18/18 passed** |
| Admin role presentation | SUPPORT, FINANCE, VIEWER | Failed |
| Financial consistency | 72 bookings | **0 mismatches, 0 sanity warnings** |
| Accessibility page observations | 32 desktop/mobile page observations plus admin sweep | Major failures found |
| Keyboard-only sample | Login, demo gate, Owner Rooms modal | Partial pass; modal focus semantics failed |
| Read-only concurrency smoke | 100 API health + 100 landing requests, concurrency 10 | 200/200 successful |
| Dependency vulnerability audit | `pnpm audit --prod` | Not executed; external metadata upload requires explicit approval |
| Real payment/email/storage/domain | No external side effects authorized | Not end-to-end verified |
| Backup restore | Script syntax only | No isolated restore drill performed |

## Passed functionality

### Business and data integrity

- Booking lifecycle, checkout finalization, invoice consistency, duplicate checkout prevention, undelivered food exclusion, partial payments, and checkout side-effect deduplication passed automated integration tests.
- Tenant isolation tests passed.
- Concurrent booking protection passed: only one competing booking succeeds and failed races do not leave orphaned room state.
- Inventory concurrency tests passed.
- Walk-in returning-guest matching tests passed.
- Private guest upload access tests passed.
- Plan/feature-flag synchronization tests passed.
- Trial-email first-run, backlog, and deduplication tests passed.
- Read-only balance audit checked 72 bookings: zero stored/recomputed payment mismatches and zero sanity warnings.

### Role and UI coverage

- Owner, Shareholder, Receptionist, Staff, and Chef role expectations passed in the current Mobile Safari run.
- Owner/Shareholder revenue visibility, restricted operational menu visibility, Staff housekeeping restrictions, Chef Kitchen Display, and demo logout behavior passed.
- The guest website at `/demo` returned 200 on desktop and mobile, rendered non-blank content, had one H1, no horizontal overflow, no missing image alt attributes in the rendered sample, and no observed console error.
- Sampled Owner dashboard pages returned 200 with no blank pages, console errors, or horizontal overflow on desktop/mobile.

### Super Admin

- All 18 destinations returned 200, stayed on the expected route, and rendered non-blank content with no normal-read API errors:
  Overview, Tenants, Users, Billing & MRR, Themes, Design Requests, Demo Leads, Audit Log, Export, Referrals, Team, Announcements, GDPR, Enterprise, Domains, Health, Storage, and Settings.
- All 18 actual sidebar clicks reached the correct route and active state.
- The known default credential was rejected by the existing local AdminUser record.
- The admin API generally enforced SUPPORT/FINANCE/VIEWER scope with 403 responses.
- Permanent tenant deletion has SUPER_ADMIN enforcement and typed tenant-name confirmation.

## Critical release blockers

### RC-C01 — Fresh deploy can create a Super Admin with a known default password

`apps/api/src/scripts/seed-admin.ts` falls back to `Admin@123456` when `SUPER_ADMIN_PASSWORD` is absent. `apps/api/Dockerfile` runs this seed on every API startup. Production compose files pass `SUPER_ADMIN_EMAILS` but do not pass `SUPER_ADMIN_PASSWORD`.

**Impact:** A new production database can start with a predictable platform-owner credential.

**Release requirement:** Remove the fallback, fail closed, use a one-time strong bootstrap secret/invite, add the secret to every deployment definition, rotate existing credentials, and verify a fresh-database deployment.

### RC-C02 — Tenant Billing APIs do not enforce OWNER

`apps/api/src/routes/billing.ts` uses its local `requireAuth` for Billing status, invoices, Stripe checkout, bKash checkout, and Billing Portal routes. It does not check the tenant user’s role.

**Impact:** A Manager, Receptionist, Staff, Chef, Developer, Marketer, or other authenticated role can potentially read subscription details and initiate payment-management flows by calling the API directly.

**Release requirement:** Enforce OWNER at the API boundary for all tenant Billing endpoints and add negative tests for every non-owner role. UI hiding is only defense in depth.

## Major findings

### RC-M01 — Admin RBAC UI is false and confusing

SUPPORT, FINANCE, and VIEWER each see all 18 admin navigation items and are labelled “Super Admin” in three places. Restricted calls return 403, but affected pages often render blank dashboards or incomplete forms instead of an Access Denied state.

**Required:** Shared role-capability matrix, truthful role label, filtered navigation, route guards, explicit 403 UI, and automated role-route tests.

### RC-M02 — Privileged audit trail can silently fail or be omitted

`logAdminAction()` swallows every database error and lets the mutation succeed. Sensitive mutations without complete audit coverage include referral rewards, bulk feature-flag changes, and SSL status changes.

**Required:** Inventory every privileged mutation, make high-risk mutation+audit atomic where appropriate, surface audit failure, and record actor, target, request ID, and before/after state.

### RC-M03 — Super Admin security lacks MFA and revocable sessions

Admin login has rate limiting, bcrypt password verification, generic errors, and an eight-hour JWT. It lacks MFA, server-side session revocation, recent-authentication checks for destructive actions, and login/security alerts. The panel relies on client-side stored auth.

**Required:** MFA for SUPER_ADMIN, revocable short-lived privileged sessions, step-up authentication, and security-event alerting.

### RC-M04 — Admin mobile layout is unusable

At 390 × 844 the fixed 240 px admin sidebar remains visible, leaving roughly 150 px for the main panel. There is no responsive drawer/collapse behavior.

**Required:** Responsive admin navigation or a clearly documented and enforced desktop-only first-release policy.

### RC-M05 — Production environment configuration is not fail-closed

`docker compose ... config --quiet` exits successfully even when API URL, web URL, database password, and JWT secret are unset; it only prints warnings. The API rejects a missing production JWT at runtime, but there is no complete preflight for all required services and URLs.

The checked local environment is development and is not evidence of production readiness: multiple production URLs/secrets/storage/Redis settings were absent or local-only.

**Required:** Add a single production environment schema/preflight that rejects missing, placeholder, localhost, malformed, or weak required values before deployment.

### RC-M06 — Production image optimization dependency is missing

`next start` reported that `sharp` is required for standalone image optimization, and the fresh standalone output did not contain `sharp`. The Docker image uses standalone Next output.

**Impact:** Next-optimized images can return errors in production even though the build and root health check pass.

**Required:** Add and package the supported `sharp` dependency, build the Docker image, request real optimized image URLs, and include that in the health/smoke suite.

### RC-M07 — Web response security headers are absent at the app layer

The sampled web response exposed `X-Powered-By: Next.js` and did not include CSP, frame-ancestor/X-Frame protection, Referrer-Policy, Permissions-Policy, or HSTS. The API’s Helmet response did include strong baseline headers.

Production ingress may add some headers, but no repository-controlled evidence proves it.

**Required:** Define headers in Next/config or verified ingress policy, especially CSP because public theme HTML/CSS and browser-stored privileged tokens increase XSS impact.

### RC-M08 — Uploaded theme HTML is filtered by regex, not robustly sanitized

Theme rendering intentionally uses `dangerouslySetInnerHTML`. Upload validation rejects scripts, inline `on*`, JavaScript URLs, fetch/XHR/eval, and triple braces, but it does not use an allow-list HTML sanitizer and does not explicitly reject all active/deceptive elements or CSS exfiltration patterns.

**Required:** Parse and sanitize with a strict allow-list, ban active/embed/form/navigation elements, sanitize URLs and CSS, add adversarial fixtures, and isolate previews.

### RC-M09 — Backups do not survive host loss

Daily verified database dumps exist, but they are stored on the same host as production. No restore drill was executed during this audit because it requires an isolated target database and explicit operational authorization.

**Required:** Encrypted off-host copies, monitored retention, documented credentials, and a timed restore drill before handoff.

### RC-M10 — Automated coverage is too low in the highest-risk areas

API source statement coverage is 37.56%. Particularly low areas:

| Area | Statement coverage |
|---|---:|
| Admin routes | 13.99% |
| Billing routes | 13.89% |
| Payment routes | 10.00% |
| Worker | 0% |
| Background jobs | approximately 0–1% for most jobs |
| Storage service | 6.61% |
| GDPR utilities | 0.74% |

Web unit tests report no test files. Web lint opens an interactive configuration prompt and cannot act as an unattended gate. The Next build explicitly skips linting.

**Required:** Prioritize authorization, payment webhook/idempotency, worker dedupe, admin mutation/audit, GDPR, storage, and restore tests; make lint/test thresholds required in CI.

### RC-M11 — Current E2E gate is red and partially stale

Current full run: **49 passed, 9 failed**.

- Eight failures are the same four landing tests in Chromium and Mobile Safari. They expect retired text/links: “Let your resort feel effortless,” “The morning view,” “Build your workspace,” and “Log in.” The product now uses different approved content.
- One Chromium Rooms navigation test stayed at `/dashboard`; the equivalent Mobile Safari test passed and the route passed in the independent dashboard sweep. This is currently classified as navigation/test timing flakiness, not a confirmed Rooms defect.

**Required:** Update landing expectations to approved current copy, stabilize the demo-login/navigation helper, rerun until the release commit is green, and add Super Admin coverage.

## Accessibility audit — WCAG 2.1 AA

### Summary

Automated DOM checks covered 32 page/viewport observations across public/auth/guest/Owner dashboard, plus the 18-page Super Admin sweep. Counts below are observations, not de-duplicated components.

- 58 visible input/select/textarea observations lacked a programmatically associated label.
- 52 visible button observations lacked an accessible name.
- 770 interactive-element observations were under the conservative 44 × 44 CSS pixel touch-target threshold.
- No missing `alt` attribute was observed in sampled rendered images.
- No horizontal overflow was observed on sampled real product pages; the only overflow occurred on a 404 route.

### Findings

| Area | WCAG | Severity | Evidence |
|---|---|---|---|
| Login/register fields lack associated labels | 1.3.1, 3.3.2, 4.1.2 | Major | Login: 3 fields; Register: 7 fields, repeated desktop/mobile |
| Guest site booking/contact controls lack labels | 1.3.1, 3.3.2, 4.1.2 | Major | `/demo`: 6 unlabeled controls per viewport |
| Guest site has unnamed icon buttons | 4.1.2 | Major | 4 desktop, 5 mobile |
| Owner dashboard controls lack names/labels | 3.3.2, 4.1.2 | Major | Restaurant, Settings, Bookings and other sampled pages |
| Super Admin Settings accessibility | 3.3.2, 4.1.2 | Major | 34 unnamed buttons, 43 unlabeled fields |
| Add Room modal lacks dialog semantics/focus placement | 2.4.3, 4.1.2 | Major | Opens via keyboard and closes with Escape, but no `role=dialog`; focus remains outside |
| Login tab order includes an empty-name link | 2.4.4, 4.1.2 | Major | Keyboard audit reached an unlabeled anchor before form fields |
| Many touch targets are under 44 × 44 | 2.5.5 advisory target | Moderate | 770 sampled observations across repeated viewports |

Actual VoiceOver/NVDA announcement testing and contrast measurement with production branding were not completed; those require a manual assistive-technology session and final production theme.

## Performance smoke

Read-only local development smoke, 100 requests per endpoint at concurrency 10:

| Endpoint | Success | p50 | p95 | Max |
|---|---:|---:|---:|---:|
| API `/health` | 100/100 | 2.1 ms | 19.8 ms | 63.5 ms |
| Landing HTML `/` | 100/100 | 61.7 ms | 3665.5 ms | 3665.9 ms |

The landing tail includes development compilation and is not a production capacity result. It proves basic concurrent stability only. A production-like load test with realistic authenticated reads, database volume, CDN, and agreed traffic targets remains required.

## External/infrastructure verification still required

These were not falsely marked as passed:

- Real Stripe checkout, webhook, refund, Billing Portal, and idempotent replay
- Real bKash flow and callback failure recovery
- Email delivery, bounce handling, password reset, receipt, and lifecycle messages
- SMS/WhatsApp/Telegram delivery and webhook verification
- Real S3/R2 upload, signed private document access, deletion, and credential rotation
- Custom domain DNS and trusted TLS certificate
- Worker execution over time, restart behavior, and duplicate-notification prevention in production
- Encrypted off-host backup and full restore
- Production observability, alert delivery, incident ownership, and rollback
- Dependency vulnerability audit (requires explicit approval to send dependency metadata to npm)
- Full VoiceOver/NVDA and final-brand contrast audit
- Realistic production capacity/soak test

## Release gates in priority order

### Must close before customer production access

1. RC-C01 default Super Admin bootstrap password.
2. RC-C02 tenant Billing OWNER authorization.
3. RC-M01 truthful admin RBAC navigation/routes.
4. RC-M02 complete, reliable privileged audit logging.
5. RC-M06 standalone image optimization.
6. Off-host backup plus successful restore drill.
7. Production environment preflight and real integration smoke tests.

### Must close or explicitly contract as a limitation

1. Admin mobile support.
2. MFA/session hardening.
3. Accessibility failures.
4. Web security headers and theme sanitizer.
5. Red/stale E2E gate, missing web tests/lint, and low high-risk coverage.

## Recommended final acceptance sequence

1. Fix Critical and Must-close Major findings.
2. Build the exact Docker images from the release commit without cache.
3. Deploy to a production-like staging environment using the final domains and providers.
4. Run fresh-database bootstrap, RBAC, payment, email, storage, worker, custom-domain/TLS, and backup/restore tests.
5. Run the complete automated suite until fully green.
6. Conduct keyboard + VoiceOver/NVDA UAT and mobile/desktop customer UAT.
7. Freeze the commit, rotate credentials, document limitations, name the rollback/support owners, and collect written sign-off.

## Safety and data handling

No real payment, outbound message, domain change, tenant suspension/deletion, GDPR anonymization, reward, publish action, credential change, or production mutation was performed. Temporary automation stayed under `/tmp`; permanent results are stored only in `reports/qa/`.


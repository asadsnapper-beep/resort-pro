# Super Admin Release-Readiness Review

**Date:** 2026-09-29  
**Perspective:** ResortPro platform owner / Super Admin preparing for customer handoff next week  
**Scope:** Super Admin login and navigation, all admin pages, role separation, destructive controls, auditability, secrets, deployment safety, mobile behavior, accessibility, automated tests, build, and unresolved customer-facing authorization risk.  
**Release verdict:** **NO-GO until the Critical blockers are fixed and retested.**

## Executive summary

The Super Admin control plane is broad and its normal desktop read flows are stable: all **18/18 admin destinations** loaded at the expected URL with non-blank content, and the sidebar navigation/active state worked for all 18 links. The API test suite passed **213/213 tests**, API type-check passed, the design-system ratchet passed, and the full monorepo build passed.

Those strengths are not enough for customer handoff yet. A fresh production deployment can create the Super Admin with a public default password, and the previously reported tenant Billing authorization flaw remains in source. The admin UI also exposes every navigation item to SUPPORT, FINANCE, and VIEWER users and labels all of them “Super Admin,” while restricted APIs return 403 behind partially rendered or blank pages. Audit logging is fail-open and several sensitive mutations do not create audit records. The admin panel is not usable at a 390 px mobile viewport.

Do not give production access to a customer until the two Critical findings below are closed. The Major findings should either be fixed before handoff or explicitly risk-accepted with an owner and deadline.

## Release gate

| Gate | Result | Handoff impact |
|---|---|---|
| Fresh-deploy Super Admin credentials | **Critical fail** | Blocks release |
| Tenant Billing authorization | **Critical fail** | Blocks release |
| Admin RBAC UI and truthful identity | Major fail | Fix before inviting non-Super-Admin staff |
| Auditability of privileged mutations | Major fail | Fix before production operations |
| Desktop Super Admin navigation | Pass | 18/18 destinations passed |
| Admin mobile usability | Major fail | Desktop-only limitation is currently required |
| API automated tests | Pass | 213/213 passed |
| Web unit tests | Gap | No test files found |
| Web lint gate | Fail | Interactive setup prompt; cannot run unattended |
| Production build | Pass | Monorepo build completed |
| E2E regression suite | Partial | Functional coverage mostly passes; stale/flaky tests remain |
| Backup disaster recovery | Major gap | Same-host backup only; host loss is not covered |

## Coverage and method

### Live browser review

- Tested `/admin/login` and all 18 panel destinations at desktop size.
- Clicked each real sidebar link and verified the exact route and active state.
- Monitored HTTP responses, API failures, console errors, request failures, and blank-page behavior.
- Repeated the role review as SUPER_ADMIN, SUPPORT, FINANCE, and VIEWER without changing production-like records.
- Repeated layout checks at 390 × 844.
- Did not create, update, delete, reward, suspend, anonymize, publish, or send anything.

The configured local AdminUser password was not available and the known default correctly returned 401 in the existing local database. To keep the review read-only, protected-page tests used short-lived locally signed development tokens against the actual API authorization middleware. This validates page/API behavior after authentication, but it is not a substitute for a final production login smoke test with the real handoff account.

### Automated checks

| Check | Result |
|---|---|
| `pnpm --filter @resort-pro/api test` | **Pass:** 21 files, 213 tests |
| `pnpm --filter @resort-pro/api lint` | **Pass:** TypeScript no-emit check |
| `pnpm --filter @resort-pro/web test` | Exits successfully but reports **no test files** |
| `pnpm --filter @resort-pro/web lint` | **Fail:** opens interactive ESLint configuration prompt |
| `node scripts/design-system-ratchet.mjs` | **Pass:** no design-system regression |
| `pnpm build` | **Pass:** all scoped packages; web compiled/type-checked and generated 113 static pages |
| Playwright Chromium project | **25 passed, 4 failed**; all four failures are stale landing-page expectations |
| Playwright Mobile Safari project | **22 passed, 7 failed**; four stale landing tests and three navigation-race failures |

## What worked

- **18/18 admin pages** returned HTTP 200, stayed on the intended route, rendered non-blank content, and produced no observed normal-read API or console failures as SUPER_ADMIN.
- **18/18 sidebar links** navigated correctly and received the active state.
- Admin API role checks generally reject restricted SUPPORT, FINANCE, and VIEWER calls with 403.
- Admin login has a 10-attempts-per-minute rate limit and generic invalid-credential errors.
- Tenant permanent deletion requires SUPER_ADMIN, an exact tenant-name confirmation, and records an audit event before deletion.
- The AI and storage GET endpoints mask stored keys rather than returning their values to the browser.
- Production compose includes persistent uploads, a dedicated worker, health checks, daily database dumps, and verified backup archives.

## Critical findings — release blockers

### C-01 — Fresh production deployments can seed a known Super Admin password

The admin seed script falls back to a hard-coded, publicly visible password when `SUPER_ADMIN_PASSWORD` is absent. The API Docker image runs that seed automatically on every startup. The production, Coolify, and alternate Coolify compose files pass `SUPER_ADMIN_EMAILS` but do not pass `SUPER_ADMIN_PASSWORD`.

On an empty database, configuring an admin email without separately injecting the missing variable creates a real SUPER_ADMIN account with the known default. The current local database rejecting that password does not reduce the fresh-deploy risk.

**Evidence:**

- `apps/api/src/scripts/seed-admin.ts:5-18`
- `apps/api/Dockerfile:60`
- `docker-compose.production.yml:58-74`
- Equivalent omission in `docker-compose.coolify.yml` and `coolify.yml`

**Required outcome:** Remove the fallback entirely; fail startup/seed when no strong password or one-time bootstrap mechanism is present. Pass the required secret in every production deployment definition. Rotate every existing admin password and perform a fresh-database deployment test.

### C-02 — Any authenticated tenant role can reach Billing APIs, including payment-management actions

The Billing routes still call only `requireAuth`; they do not enforce the Owner role. This includes subscription status and invoices plus Stripe checkout, bKash checkout, and Stripe Billing Portal creation. The dashboard hiding the Billing menu is not an authorization boundary.

This was live-confirmed in the 2026-09-09 sidebar audit for Manager and Developer roles and was re-confirmed unchanged in source during this review.

**Evidence:** `apps/api/src/routes/billing.ts:101-127`, `:205-212`, `:283-308`, `:311-318`, `:437-441`.

**Required outcome:** Enforce OWNER at the API layer on every tenant Billing read and mutation, add regression tests for all non-owner roles, and add a page guard as defense in depth.

## Major findings

### M-01 — Admin role UI is misleading and exposes unusable destinations

SUPPORT, FINANCE, and VIEWER each saw all 18 admin sidebar links. The sidebar, account area, and header badge called every role “Super Admin.” Restricted APIs correctly returned 403 in many cases, but the corresponding pages showed blank dashboards or incomplete shells instead of a clear Access Denied state.

Examples observed:

- SUPPORT: dashboard metrics, Team, GDPR, Storage, and Settings APIs returned 403.
- FINANCE: Team, Audit Log, GDPR, Storage, and Settings returned 403.
- VIEWER: dashboard/Billing data and Team, Audit Log, GDPR, Storage, and Settings returned 403.

**Evidence:** `apps/web/src/app/admin/(panel)/layout.tsx:15-33` defines one unfiltered navigation list, while `:73-75`, `:108-110`, and `:133-137` hard-code the Super Admin label.

**Required outcome:** Define one shared role-to-capability matrix, filter navigation from it, render the actual role, add route-level guards, and show an explicit 403 page. Keep API enforcement as the final authority.

### M-02 — Privileged audit logging can silently disappear

`logAdminAction()` catches every database error and allows the primary mutation to succeed. That produces an untracked privileged action exactly when the audit store is unhealthy. Several sensitive mutations also omit audit calls, including referral rewards, bulk feature-flag changes, and SSL status updates.

Examples:

- Referral rewards can change account credit or grant a paid plan without an audit record.
- Bulk feature flag changes return success without logging who changed what.
- SSL state changes return success without an audit record.

**Evidence:** `apps/api/src/routes/admin.ts:86-110`, `:1789-1855`, `:2765-2793`, `:2880-2905`.

**Required outcome:** Define which operations must be atomic with their audit entry, log all privileged mutations, surface audit-write failures, and add coverage that proves the actor, target, before/after values, request ID, and timestamp are recorded.

### M-03 — Super Admin authentication lacks control-plane hardening

Positive controls are rate limiting, hashed passwords, generic credential errors, and an eight-hour token. Missing controls include MFA/2FA, a shorter privileged session or re-authentication for high-risk actions, server-managed session revocation, and production login/audit alerts. A stolen admin browser token gives broad control until expiry.

**Evidence:** `apps/api/src/routes/admin.ts:118-158`; the panel uses client-side stored auth and a client-side redirect in `apps/web/src/app/admin/(panel)/layout.tsx:36-58`.

**Required outcome:** Require MFA for SUPER_ADMIN, add revocable sessions, and require recent authentication for delete, impersonation, credential, GDPR, billing, and role-management actions.

### M-04 — Admin panel is not usable on mobile

At 390 × 844 there was no document overflow only because the fixed 240 px sidebar consumed most of the viewport. The main panel began at x=240 and had about 150 px remaining. There is no mobile drawer/collapse behavior, so tables, forms, and settings are effectively unusable.

**Evidence:** fixed `w-60` non-collapsing sidebar at `apps/web/src/app/admin/(panel)/layout.tsx:66-68`.

**Required outcome:** Add a responsive admin drawer or explicitly enforce/document a desktop-only supported environment for the first release. A desktop-only decision should be visible at login, not discovered after entry.

### M-05 — Platform secrets are masked in responses but stored plaintext in the database

The AI API key is stored directly in `platformSettings.aiApiKey`, and object-storage access/secret keys are stored directly inside `platformSettings.storageConfig`. Masking GET responses is good UI hygiene but does not protect a database dump or database-reader compromise.

**Evidence:** `apps/api/src/routes/admin.ts:1707-1745` and `:3165-3200`.

**Required outcome:** Move credentials to a secret manager or encrypt them with a key outside the database. Redact them from logs, backups, exports, and error telemetry; document rotation.

### M-06 — Backups do not cover host loss

The backup sidecar creates daily verified dumps, but the dumps live on the same host. The compose comments correctly acknowledge that losing the host loses both the live database and its backups.

**Required outcome:** Configure encrypted off-host copies, retention, restore credentials, monitoring, and one documented restore drill before handoff.

### M-07 — Web quality gates cannot reliably protect the handoff

- Web unit tests contain no test files.
- Web lint is not configured for unattended CI and exits on an interactive prompt.
- Landing E2E tests assert retired copy/links while the product now uses new content; four tests fail in both browser projects.
- Three Mobile Safari role tests fail because login navigation is interrupted by a competing redirect to `/dashboard`; Chromium role flows passed, so this is currently classified as test flakiness rather than a confirmed feature defect.
- The Next build log says linting is skipped.

**Evidence:** `apps/web/tests/e2e/landing.spec.ts:3-29` expects old copy while `apps/web/src/components/landing/LandingPage.tsx` renders the current hero and CTA set.

**Required outcome:** Make lint non-interactive, update landing tests to the approved copy, stabilize role-login navigation, add Super Admin smoke/RBAC tests, and make these gates required before the customer build.

## Accessibility and UX findings

- Admin login’s visible labels are not programmatically associated with its two fields, and the fields lack useful autocomplete metadata.
- The Settings scan found **34 unnamed buttons** and **43 inputs/selects without accessible names**.
- Audit Log had four unlabeled form controls; Export had one; GDPR had one unnamed button.
- Irreversible GDPR anonymization relies on a basic browser confirmation. It should use a high-friction, specific confirmation pattern and disclose what cannot be recovered.

These issues are unlikely to stop a sighted mouse user, but they materially affect keyboard, screen-reader, and error-prone administrative work.

## Recommended one-week handoff plan

### Day 1 — Close security blockers

1. Remove the default Super Admin password and make production bootstrap fail closed.
2. Add `SUPER_ADMIN_PASSWORD`/one-time bootstrap handling to every deployment definition and rotate credentials.
3. Enforce OWNER on all tenant Billing endpoints and add negative role tests.

### Day 2 — Make admin roles truthful

1. Implement the shared role-capability matrix.
2. Filter menus, show real roles, protect routes, and render an Access Denied page.
3. Add automated SUPPORT/FINANCE/VIEWER route and API tests.

### Day 3 — Restore audit confidence

1. Inventory every admin mutation.
2. Add missing audit events and decide which actions must fail if auditing fails.
3. Add request IDs and before/after metadata; test an audit-database failure.

### Day 4 — Production operations

1. Configure off-host encrypted backups and run a restore drill.
2. Move/encrypt stored platform credentials.
3. Verify production domain, TLS, email, Stripe/bKash, object storage, worker, health monitoring, and alert ownership.

### Day 5 — Regression and customer acceptance

1. Fix the web lint gate and stale/flaky E2E tests.
2. Run the full desktop/mobile suite on the release commit.
3. Run a real production-like Super Admin login, MFA/session, role, destructive-confirmation, backup/restore, and billing-permission smoke test.
4. Freeze the release commit and record sign-off from product, engineering, and the business owner.

## Handoff checklist

- [ ] C-01 fixed and fresh-database bootstrap retested
- [ ] C-02 fixed with non-owner negative tests
- [ ] Existing privileged passwords and API keys rotated
- [ ] Real production Super Admin login verified
- [ ] SUPPORT/FINANCE/VIEWER menus and routes verified
- [ ] Privileged mutation audit inventory completed
- [ ] Off-host backup and restore drill completed
- [ ] Production TLS has no warning or default certificate
- [ ] Email, payment, storage, and worker smoke tests passed
- [ ] Web lint, build, API tests, and E2E suite green
- [ ] Known limitations documented for the customer
- [ ] Named rollback owner and support contact assigned

## Final decision

**Do not hand the current build to the customer as production-ready.** The product is close enough for a controlled staging/UAT demonstration on desktop, but production access should wait for both Critical blockers and the privileged-audit/RBAC controls to be fixed and retested. If mobile Super Admin support is not part of the first contract, document it explicitly; otherwise M-04 also becomes a release blocker.


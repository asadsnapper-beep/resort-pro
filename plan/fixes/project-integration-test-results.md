# ResortPro — Integration Test Results

**Started:** 2026-08-11  
**Status:** In progress — this is a live evidence log, not a claim that every
feature has already been tested. Each item below states exactly what was run.

## Test method

- API automated suite: `pnpm --filter @resort-pro/api test`
- Web unit suite: `pnpm --filter @resort-pro/web test`
- Browser E2E suite: `pnpm --filter @resort-pro/web test:e2e`
- Targeted browser tests and authenticated smoke tests follow after the baseline.
- No production records are created or altered during these checks.

## Baseline results

| Area | Command | Result | Evidence / next action |
|---|---|---:|---|
| API | `pnpm --filter @resort-pro/api test` | **PASS** — 68 tests, 7 files | Tests exercise auth, roles, tenant isolation, booking lifecycle and booking races. Warnings exposed the invoice-number defect below. |
| Web unit command | `pnpm --filter @resort-pro/web test` | **FAIL** | Vitest discovers `tests/e2e/*.spec.ts`, which import Playwright. These suites must be excluded from Vitest or moved to a separate unit-test include pattern. |
| Browser E2E | `pnpm --filter @resort-pro/web test:e2e` | **PARTIAL** | It began 58 tests; early auth, landing and role tests passed, but the run exposed a failing stale dashboard test. The rest is being rerun in targeted groups. |
| Dashboard mock test | Playwright: `sidebar shows all navigation items` | **FAIL** | The test’s localStorage auth mock is rejected and the app redirects to `/auth/login`; the test is not reaching the dashboard. It also asserts the retired label `Rooms & Villas`. |

## Confirmed defects

### P0 — automatic invoices can be skipped after a number collision

**Evidence:** The API suite logged `PrismaClientKnownRequestError` / unique
constraint failure on `invoiceNumber` from `apps/api/src/routes/bookings.ts:73`.
It occurred while booking-lifecycle, tenant-isolation and race-condition tests
were executing. The booking tests still pass because invoice creation is
intentionally non-blocking, so this can leave a valid confirmed booking without
an invoice.

**Cause:** `Invoice.invoiceNumber` is globally unique, but `autoCreateInvoice`
finds the last number *within one tenant* and produces only `INV-{year}-{n}`.
Different tenants can therefore both choose `INV-2026-0001`; concurrent requests
within the same tenant can choose the same next number too.

**Required fix:** Generate a globally unique, transaction-safe invoice sequence.
Recommended options are a database-backed counter per tenant with the tenant
slug/code in the number, or a globally incrementing counter. Protect it with a
transaction/retry on unique conflict. Do not silently swallow invoice-creation
errors: record an audit/error event and place the booking in an invoice-retry
queue.

### P1 — the default web test command is broken

**Evidence:** `pnpm --filter @resort-pro/web test` runs `vitest run`, but Vitest
collects `apps/web/tests/e2e/*.spec.ts`. Those files call Playwright’s
`test.describe`, producing four suite failures before meaningful web-unit tests
run.

**Required fix:** Add a Vitest config with a unit-test include/exclude rule
(exclude `tests/e2e/**`), and keep Playwright only under `test:e2e`. CI should
run both commands independently and make their names explicit.

### P1 — one dashboard E2E test is obsolete and never checks the dashboard

**Evidence:** `apps/web/tests/e2e/dashboard.spec.ts` adds a fake localStorage
payload, then expects `Rooms & Villas`. The captured page is the login screen,
so the mocked authentication is no longer compatible with the current auth
bootstrap. The product navigation has also changed to `Rooms`.

**Required fix:** Replace the localStorage mock with the existing real demo-role
login helper used by `roles.spec.ts`. Assert current, role-appropriate sidebar
labels. This is test debt, not yet evidence of a dashboard feature defect.

### P1 — the web application does not pass TypeScript validation

**Evidence:** `pnpm --filter @resort-pro/web exec tsc --noEmit` fails with seven
errors. `dashboard/website/page.tsx` accesses `section.fixed` although that
property is not present in every section union member (three errors). The
Discover page passes a `Pin` into state/functions typed as a full `Resort`
(four errors), even though `Pin` lacks several required resort fields.

**Required fix:** Define a shared section type with an optional `fixed` field (or
narrow before access), and either map `Pin` to `Resort` at the boundary or type
the selected-map item according to the data it actually contains. Restore web
type-checking as a mandatory CI gate; the current Next build explicitly skips it.

### P1 — booking documents are inconsistent across entry points

**Evidence:** Source-flow verification found two different Walk-in forms.
`/dashboard/front-desk` supports Add Document and uploads the file after walk-in
creation. `/dashboard/bookings` opens the older
`components/bookings/WalkInModal.tsx`, which has no document control. New Booking
can upload a document during confirmation, but `BookingDetailSheet` does not
show linked guest documents after creation.

**Required fix:** Consolidate both entry points behind one booking/walk-in
creation flow, retain the document on the guest + booking relationship, and add
a document section to Booking Detail. Detailed acceptance criteria are in
`plan/fixes/booking-document-visibility.md`.

### P2 — asynchronous guest-email work can run after a deleted test booking

**Evidence:** During API test cleanup, `guest-emails.ts:302` logged a
`booking.update Record to update not found` error. It may be caused by teardown
racing a background email task, so it is not yet classified as a production bug.

**Required fix:** Make post-email booking updates resilient to a missing booking
and ensure background jobs have a lifecycle/queue with cancellation or safe
idempotency. Reproduce outside test teardown before escalating priority.

### P2 — email delivery is not covered by the local test environment

**Evidence:** API tests report that `RESEND_API_KEY` is absent and skip real
delivery. This does not contradict the production secret being present; it means
the local automated suite cannot prove welcome, booking, referral or password
emails arrive.

**Required fix:** Add a test mail provider/mock and assert the message payloads
and relevant database side effects. Keep real provider credentials out of tests.

### P2 — production build has deployment-quality warnings

**Evidence:** `pnpm --filter @resort-pro/web build` completed successfully and
generated 113 pages, but emitted two recurring warnings: no `metadataBase` is
configured (so social/Open Graph URLs resolve as `http://localhost:3000`) and
the Handlebars runtime uses unsupported `require.extensions` in the theme-preview
bundle.

**Required fix:** Set `metadataBase` from the canonical public site URL in the
root metadata, and replace/isolate the Handlebars runtime import so the browser
bundle does not rely on Node-only `require.extensions`. The build also says it
is skipping type validation and linting, so those must remain separate required
CI commands rather than being assumed by `next build`.

## Still to test

- [ ] Owner dashboard modules: Rooms through Website, including create/edit flows.
- [ ] Front Desk, booking lifecycle, payment/invoice and document visibility in a browser.
- [ ] Public resort site: availability, date selection, checkout and confirmation.
- [ ] Referral, shareholder and billing flows end-to-end with safe test data.
- [ ] Super Admin pages and tenant plan editing with an authorised admin account.
- [ ] Role-by-role access checks beyond the current demo E2E coverage.
- [ ] Failure states: expired trial, no rooms, payment failure, deleted guest/room and concurrent edits.

## Browser smoke-test evidence

The following checks used the built-in Owner demo on `localhost`. For each route,
the browser received HTTP 200, stayed on the intended route, showed the expected
page heading, and captured no console errors or API responses with status 400+.
This verifies wiring and initial data loading only; it does **not** prove every
create/edit/delete action yet.

| Surface | Routes that passed initial smoke test |
|---|---|
| Daily operations | Dashboard, Rooms, Bookings, Front Desk, Guests, Calendar, Housekeeping, Maintenance |
| Restaurant | Inventory, F&B Orders, Restaurant & Menu, Restaurant Tables |
| Finance & analytics | Invoices, Expenses, Analytics, Billing & Subscription |
| Sales & marketing | CRM & Email Marketing, SMS & WhatsApp Marketing, Offers & Promotions, Package Deals, Loyalty |
| Ownership & team | Referral Program, Shareholders, Staff |
| Public site | Home, Plans, Try Demo, Discover, Blog, and the demo resort public website (`/demo`) |

The following pages still need a separately captured route result or an
interaction test: AI Content, Assets, Channels, Corporate Accounts, Group
Bookings, Rate Plans, Reports, My Shares, Properties, Vehicles, Venues, Profile,
Website, Settings, Support, Suspended and Upgrade.

## Compile validation

- API TypeScript validation (`pnpm --filter @resort-pro/api lint`): **PASS**.
- Web production build (`pnpm --filter @resort-pro/web build`): **PASS with the
  warnings above**; all 113 generated routes completed.

## Retest exit criteria

The audit is complete only when every checklist item in
`plan/fixes/project-integration-audit.md` has a dated PASS / FAIL / BLOCKED
result, critical flows have a repeatable automated test, and P0/P1 findings have
been fixed and regression-tested.

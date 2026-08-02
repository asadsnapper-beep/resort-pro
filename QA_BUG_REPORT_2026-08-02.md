# ResortPro QA Bug Report — 2026-08-02

## Test environment and scope

- Local Docker PostgreSQL, Redis, and Mailpit were running and healthy.
- API: Fastify development server on `http://localhost:4000`.
- Web: Next.js development server on `http://localhost:3000`.
- Browser: Playwright Chromium, logged in as `owner@palmparadise.com` for `palm-paradise-resort`.
- Automated API suite: **67/67 passed**, including the tenant-isolation suite.
- Browser smoke passed HTTP 200 routing for dashboard, rooms, bookings, front desk, restaurant, website, invoices, and settings. Public `/demo` loaded at desktop and 375px with no horizontal overflow; an unknown slug returned 404.

## Critical

No critical data-loss, authentication-bypass, or cross-tenant data-leak defects were reproduced. The existing API tenant-isolation suite passed (13/13).

## High

### H-1 — Documented database migration cannot run against the supplied local database

**Area:** setup / `pnpm --filter @resort-pro/database migrate:deploy`

**Reproduction:**

1. Start the documented local Docker services with `docker compose up -d`.
2. Run `pnpm --filter @resort-pro/database migrate:deploy` from the repository root.

**Expected:** Prisma applies (or recognizes) the 31 project migrations, so a developer can prepare the provided local test database.

**Actual:** Prisma exits with P3005: `The database schema is not empty`, because the local database has application tables but no migration history.

**Evidence:** `31 migrations found in prisma/migrations` followed by `Error: P3005`. This blocks the setup path specified in the QA brief; testing continued only because the pre-existing schema was usable by the API.

## Medium

### M-1 — Dashboard announcements request always fails with a raw 500 and leaks ORM internals

**Route:** authenticated dashboard shell; `GET /api/tenant/announcements`

**Reproduction:**

1. Open `http://localhost:3000/auth/login`.
2. Sign in as `owner@palmparadise.com` for slug `palm-paradise-resort`.
3. Open any dashboard page (for example `/dashboard`, `/dashboard/rooms`, or `/dashboard/bookings`).
4. Inspect the browser Network panel, or send an authenticated request to `/api/tenant/announcements`.

**Expected:** The endpoint returns a successful empty/list response when no announcements apply; dashboard loading makes no failed request.

**Actual:** Every request returns HTTP 500. The response body exposes Prisma’s query failure, including the absolute server path and the invalid filter field.

**Evidence:**

```text
STATUS=500
Invalid `db.platformAnnouncement.findMany()` invocation in
/Users/parthohore/Hotel management/apps/api/src/routes/tenants.ts:394:59
Unknown argument `tenantId`
```

This also generated repeated browser-console errors: `Failed to load resource: the server responded with a status of 500`.

### M-2 — Checkout triggers an invalid Prisma payment-status query in the checkout-email path

**Area:** booking checkout / receipt-email side effect

**Reproduction:**

1. Create a booking, check it in, then check it out.
2. Observe the API/server logs during checkout.

**Expected:** Checkout completes without an application error and its receipt-email lookup uses a valid payment-status enum.

**Actual:** The server logs a Prisma validation error from `sendCheckoutEmail` querying payment status `COMPLETED`, which is not a valid `PaymentStatus` value. The lifecycle test itself still reports success, indicating this side effect is not surfaced to the UI.

**Evidence:**

```text
Invalid `prisma.booking.findUnique()` invocation in src/utils/guest-emails.ts:225:40
Invalid value for argument `status`. Expected PaymentStatus.
```

### M-3 — Normal rapid dashboard/public navigation exhausts the global rate limit and leaves widgets failing

**Routes:** dashboard shell and public tenant-site data requests

**Reproduction:**

1. Sign in as the owner on localhost.
2. Visit dashboard, rooms, bookings, front desk, restaurant, website, invoices, and settings in succession, waiting for each page to become idle.
3. Visit `/demo` and reload at a 375px viewport.
4. Inspect Network.

**Expected:** Navigation should not cause its supporting data requests to fail; if throttling is required, user-visible retries/fallbacks should avoid a broken state.

**Actual:** The API begins returning 429 responses to ordinary page dependencies, including `/api/dashboard`, `/api/notifications`, `/api/invoices`, `/api/billing/status`, `/site/demo/menu`, `/site/demo/venues`, and `/site/demo/availability/calendar`.

**Evidence:** Browser capture included many `429 Too Many Requests` responses after the successive page loads, each accompanied by a console `Failed to load resource` error. The local global limit header is `x-ratelimit-limit: 100`.

## Low

### L-1 — Local UI authentication fails when the web app is opened through `127.0.0.1` instead of `localhost`

**Route:** `/auth/login` in local development

**Reproduction:**

1. Run the documented API and web development servers.
2. Open `http://127.0.0.1:3000/auth/login`.
3. Enter the valid owner credentials and submit.

**Expected:** The loopback host works like the documented localhost host, or the UI clearly states that localhost is required.

**Actual:** The UI shows `Invalid email or password` although the credentials are valid. Browser console reports a CORS preflight failure because the API allows `http://localhost:3000` but not `http://127.0.0.1:3000`.

**Evidence:**

```text
Access to XMLHttpRequest at 'http://localhost:4000/api/auth/login'
from origin 'http://127.0.0.1:3000' has been blocked by CORS policy
```

## Environment/test limitations

- The initial 58-test Playwright run could not launch because Chromium/WebKit were absent. Chromium was installed and used for the live browser pass; WebKit/mobile-Safari tests were not rerun.
- No code or test files were modified for this assessment.
- Email delivery is disabled locally because `RESEND_API_KEY` is not configured; the checkout Prisma error was nevertheless emitted before email delivery would occur.

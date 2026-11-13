# Dashboard Sidebar Comprehensive QA

**Date:** 2026-09-09  
**Scope:** Every Owner desktop sidebar destination, every mobile More-menu destination, collapsible group behavior, responsive navigation, role visibility, direct-route authorization, core page rendering, create/open controls, console/API failures, and baseline accessibility.  
**Overall verdict:** Navigation is operational, but the sidebar is **not production-ready** because Billing APIs lack owner-role enforcement and mobile feature filtering differs from desktop.

## Executive summary

- Desktop sidebar: **36/36 destinations navigated to the exact expected URL**.
- Mobile More menu: **37/37 destinations navigated to the exact expected URL**.
- Every tested Owner destination returned HTTP 200, rendered non-blank content, and produced no observed API 4xx/5xx during its normal read flow.
- All seven desktop groups expanded correctly, each clicked link received the active state, and expanded groups persisted in localStorage.
- No page-level horizontal overflow was detected at 1440 px or 390 px in the navigation sweep.
- Create/open UI was safely opened without submitting data on Properties, Rooms, Rate Plans, Packages, Front Desk, Bookings, Group Bookings, Venues, Vehicles, Guests, Staff, Housekeeping, Assets, Restaurant, F&B Orders, Tables, Inventory, Offers, Referrals, and Shareholders.
- No booking, room, guest, invoice, payment, message, campaign, staff record, or operational record was created, changed, sent, or deleted.

## Sidebar navigation results

| Group | Destinations tested | Result |
|---|---|---|
| Daily tier | Dashboard, Rooms, Front Desk, Bookings, Calendar | 5/5 passed |
| Overview | Analytics, Invoices, Expenses, Daily Reports | 4/4 passed |
| Rooms & Bookings | Properties, Rate Plans, Packages, Group Bookings, Channels, Venues & Events, Corporate Accounts, Vehicle Rental | 8/8 passed |
| Guests | Guests, Loyalty, Support | 3/3 passed |
| Operations | Staff, Housekeeping, Maintenance, Assets | 4/4 passed |
| Restaurant | Restaurant, F&B Orders, Tables, Inventory | 4/4 passed |
| Marketing | Offers, CRM, SMS Marketing, Website | 4/4 passed |
| Account | Billing, Referrals, Shareholders, Settings | 4/4 passed |

The isolated Overview retest also confirmed that **New Invoice** reaches `/dashboard/invoices/new`; the earlier aborted RSC observation was test timing, not a confirmed product defect.

## Core page and create-control results

| Area | Read/load result | Safe interaction result |
|---|---|---|
| Properties | 200; empty state rendered | Add Property opened |
| Rooms | 200; 10 demo rooms and status filters rendered | Add Room opened |
| Rate Plans | 200 | New Rate Plan dialog opened |
| Packages | 200; package cards rendered | New Package dialog opened |
| Front Desk | 200; arrival/departure/in-house summary rendered | Walk-In form opened |
| Bookings | 200; filters and pagination rendered | New Booking dialog opened |
| Calendar | 200 | New Booking correctly routes to Bookings workflow |
| Group Bookings | 200 | New Group dialog opened |
| Channels | 200; no-calendar empty state rendered | Add Calendar CTA present |
| Venues & Events | 200; venue/booking views rendered | Add Venue dialog opened |
| Corporate Accounts | 200 | Add Company CTA present |
| Vehicle Rental | 200; Fleet/Rentals views rendered | Add Vehicle dialog opened |
| Guests | 200; guest rows rendered | Add Guest form opened |
| Loyalty | 200; tier filters rendered | Settings control present |
| Support | 200; ticket status filters rendered | Channels control present |
| Staff | 200; four functional sections rendered | Add Staff form opened |
| Housekeeping | 200; operational tabs and tasks rendered | New Task form opened |
| Maintenance | 200; status/priority filters rendered | New Ticket CTA present |
| Assets | 200 | Add Asset dialog opened |
| Restaurant | 200; menu/category data rendered | Add Item form opened |
| F&B Orders | 200; order/status data rendered | New Order form opened |
| Tables | 200; empty state rendered | Add Table form opened |
| Inventory | 200; stock data rendered | Add Item form opened |
| Offers | 200; empty state rendered | New Offer dialog opened |
| CRM | 200; Contacts/Campaigns/Sequences/Templates/Analytics rendered | Search control present |
| SMS Marketing | 200; campaign/status data rendered | New Campaign control present |
| Website | 200; readiness, theme, preview and publish UI rendered | Preview toggle worked |
| Billing | 200; subscription and plan data rendered | No payment action executed |
| Referrals | 200 | Copy changed to “Copied!” and showed confirmation |
| Shareholders | 200; ownership summary rendered | Add Shareholder dialog opened |
| Settings | Covered by dedicated Settings deep-QA report | See dedicated report |

## Findings

### Critical — Billing read and payment-management APIs allow every authenticated tenant role

The desktop sidebar hides Billing from everyone except Owner, but the API routes use only `requireAuth`, not `requireRole('OWNER')`:

- `GET /api/billing/status`
- `GET /api/billing/invoices`
- `POST /api/billing/checkout`
- `POST /api/billing/checkout/bkash`
- `POST /api/billing/portal`

Live verification showed both Manager and Developer could type `/dashboard/billing`, receive the full Billing & Subscription page, and load its APIs without an authorization error. Source review shows the same weakness applies to any authenticated tenant role and includes mutation-capable payment endpoints. A non-owner could potentially start a subscription checkout or open the tenant's billing portal.

**Evidence:** `apps/api/src/routes/billing.ts` billing routes; `apps/web/src/app/(dashboard)/dashboard/billing/page.tsx`.

**Required outcome:** Enforce Owner role on billing reads and mutations at the API layer. Add a page-level role guard as defense in depth, but do not rely on hiding the sidebar item.

### Major — mobile More menu ignores module entitlements and AI availability

Desktop sidebar visibility filters by role, plan/module entitlement, and AI status. `MobileMoreSheet` only calls `getVisibleItems(role)` and never applies `featureFlag` or `aiFeature` filtering.

Confirmed behavior for the Owner demo:

- Desktop: **36** available destinations; AI Content hidden because the AI feature is not live.
- Mobile: **37** destinations; AI Content is visible and successfully routes to `/dashboard/ai-content`.

The same implementation can expose disabled paid modules on mobile when a role is otherwise eligible. This creates inconsistent product promises and lets users enter workflows the tenant did not purchase or enable.

**Evidence:** `apps/web/src/components/dashboard/sidebar.tsx` computes `hasFeature` and `aiStatus`; `apps/web/src/components/dashboard/MobileMoreSheet.tsx` bypasses both.

### Major — restricted direct URLs render broken pages instead of a clear access-denied state

For routes whose APIs correctly reject the role, the document still returns 200 and the dashboard page renders without a route-level guard:

| Role | Hidden route typed directly | API behavior | UI behavior |
|---|---|---|---|
| Shareholder | Expenses | Three 403 responses | Expenses shell; no Access Denied explanation |
| Receptionist | Staff | Two 403 responses | Staff shell; no Access Denied explanation |
| Marketer | Bookings | 403 | Bookings shell; no Access Denied explanation |
| Staff | Settings | 403 | Incomplete/empty main content |
| Chef | Guests | 403 responses | Guests shell; no Access Denied explanation |

API authorization prevents data access in these samples, but users see an apparently broken product. Add a shared route-level authorization boundary that redirects or renders an explicit 403 state.

### Minor — repeated missing desktop navigation translations

Desktop navigation logs missing English messages for `venues`, `corporateAccounts`, `vehicles`, `assets`, and `shareholders`. Fallback text keeps links usable, but error noise can hide real console failures. Mobile avoids the noise by checking translation availability first; desktop should use the same approach.

### Minor — widespread accessible-name and form-label gaps

Representative observed counts in main content:

- Packages: 8 unnamed visible buttons.
- Front Desk: 3 unnamed visible buttons.
- Venues: 6 unnamed visible buttons.
- Maintenance: 5 unnamed visible buttons.
- Restaurant: 20 unnamed visible buttons.
- Inventory: 12 unnamed visible buttons.
- Bookings: 3 visible form fields without programmatic labels.
- CRM: 2 visible fields without programmatic labels.

Several create overlays opened visually but exposed no `role="dialog"`, including Rooms, Guests, Staff, Housekeeping, Restaurant, F&B Orders, Tables, and Inventory. Keyboard Escape generally closed the overlays, but screen-reader dialog semantics are inconsistent.

### Minor — navigation labels drift between desktop and mobile

Examples include Rooms & Villas vs Rooms, Daily Reports vs Reports, Booking Calendar vs Calendar, Channel Sync vs Channels, and Vehicle Rental vs Vehicles. Routes are correct, but this makes documentation, onboarding, and support instructions less predictable.

## Role visibility baseline

Role and entitlement filtering produced the following previously captured destination totals on the Owner-demo tenant:

| Role | Visible destinations |
|---|---:|
| Owner | 36 desktop / 37 mobile |
| Manager | 32 role-eligible mobile items before entitlement correction; desktop entitlement filtering applies |
| Shareholder | 3 |
| Receptionist | 14 |
| Marketer | 10 |
| Developer | 4 |
| Staff | 2 |
| Chef | 2 |

The Manager mobile count illustrates the entitlement-filtering defect: mobile lists every role-eligible module plus AI Content instead of matching the desktop's enabled-module result.

## Test environment and limitations

- Local Next.js web app and local Fastify API, authenticated through the built-in demo-login endpoint.
- Chromium headless browser, desktop viewport 1440×1000 and mobile viewport 390×844.
- Mutation controls were opened and validation/UI shape was inspected, but final create/send/delete/payment actions were intentionally not executed against shared demo data.
- External payment, email, SMS, WhatsApp, DNS, and third-party channel delivery were not invoked.
- This report records current behavior; no product code was changed.


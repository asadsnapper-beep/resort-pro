# ResortPro Booking System — Deep QA Audit

**Date:** 2026-10-28  
**Perspectives:** resort owner, receptionist, guest, accountant, operations manager, security reviewer, accessibility reviewer, and senior QA engineer  
**Scope:** dashboard bookings, public website booking, room availability, pricing/rate plans, offers, payments, check-in/out, cancellation/refund, walk-in, group bookings, invoices, room/housekeeping side effects, roles, tenant isolation, concurrency, desktop and mobile  
**Verdict:** **NO-GO for next-week customer handoff until BK-001 through BK-005 are fixed and retested.** The normal single-booking lifecycle is strong, but adversarial tests reproduced financial-integrity and room-state failures, and two alternative booking paths can report or complete a stay without the canonical payment/invoice lifecycle.

## Executive summary

The booking system is not just UI. Important core behavior is implemented and tested:

- owner and receptionist booking workspaces load and call real APIs;
- booking list, search, status/date filters and creation modals are wired;
- single-booking create → check-in → checkout works;
- overlapping and simultaneous bookings are protected by serializable transactions;
- exactly one of five concurrent requests for the same room/date wins;
- checkout is idempotent and does not double-charge on concurrent retries;
- checkout freezes one invoice, reconciles room/food/extras/tax/payment totals, moves the room to Cleaning and creates a housekeeping task;
- tenant isolation and returning walk-in guest matching pass;
- desktop owner/receptionist and iPhone layout checks pass;
- API and web TypeScript checks pass.

However, the release is unsafe because the same invariants are not enforced on every entry point. The most serious reproduced failures are:

1. A staff payment endpoint accepts a **negative amount**, creates a paid transaction and reduces the booking's paid balance below zero.
2. Check-in accepts an arbitrary `roomId` without availability validation; two active bookings can become checked into the **same occupied room**.
3. A checked-in booking can be cancelled, but the room remains **OCCUPIED**.
4. Luxe's room-specific public modal tells the guest **“You're booked!”** while the API created only a `PENDING` hold that auto-cancels after 30 minutes.
5. Group bulk checkout bypasses the canonical bill/invoice/payment/audit/email/loyalty finalisation used by single checkout.

This means the happy path is good, but a receptionist, guest theme, retry, or group workflow can create contradictory room and financial state.

## Test methodology

The audit applied:

- requirements and state-transition review;
- risk-based and exploratory testing;
- positive, negative and boundary-value tests;
- API contract and database-persistence checks;
- concurrency/race and idempotency tests;
- authorization and tenant-isolation tests;
- financial reconciliation review;
- cross-channel consistency review (dashboard, walk-in, public site, group);
- browser journeys on desktop Chromium and iPhone 14 emulation;
- responsive overflow, console and network checks;
- static code-path inspection for every mutation and side effect.

## Automated evidence

| Check | Result |
|---|---:|
| Focused booking/API regression suite | **59/59 passed** |
| Adversarial isolated-tenant probes | **4/4 reproduced unsafe outcomes** |
| Owner booking browser journey | Pass |
| Receptionist booking page/API | Pass |
| iPhone booking layout/actions | Pass; no document-level horizontal overflow |
| API TypeScript (`tsc --noEmit`) | Pass |
| Web TypeScript (`tsc --noEmit`) | Pass |
| Next ESLint | Not runnable non-interactively; project prompts to create ESLint config |

Focused regression coverage included lifecycle, five-way concurrent booking, checkout finalisation/idempotency, returning walk-in guest, tenant isolation and booking utilities.

The initial combined browser run produced HTTP 429 on later mobile requests because repeated demo logins shared one local IP/rate-limit bucket. Fresh-server, focused owner/receptionist/mobile runs passed. This was treated as a test-environment constraint, not a booking failure.

## Channel coverage matrix

| Booking channel | Create | Availability/conflict | Pricing | Payment | Lifecycle | Result |
|---|---:|---:|---:|---:|---:|---|
| Dashboard single booking | Yes | Strong | Rate-plan aware | Present | Canonical | Pass with payment validation gaps |
| Dashboard walk-in | Yes | Strong | Rate-plan aware/override | Advance supported | Check-in | Mostly works; financial update is outside create transaction |
| Public shared BookingForm | Yes | Strong | **Base rate only** | Gateway checkout | Pending → payment | Major pricing/config gaps |
| Luxe room modal | Yes | Strong | **Base rate only** | **None** | **False success** | Critical |
| Group booking | Yes | Strong create conflict check | **Base rate only** | Child payments | **Bulk flow bypasses canonical checkout** | Critical |
| Modify booking | Yes | Strong | Re-resolved | Existing payment retained | Pending/confirmed only | Offer-price drift risk |
| Cancellation/no-show | Yes | N/A | Fee/refund record | Manual refund ledger | **Broken for checked-in room state** | Critical |

## Critical findings

### BK-001 — Critical — Payment endpoint accepts negative values and is not atomic/idempotent

`POST /api/bookings/:id/payment` casts the request body without Zod validation. It creates a `PAID` Payment row, then separately updates `booking.paidAmount`.

The isolated adversarial test sent `amount: -100` with `method: CASH` and received 201. Database result:

- Payment status: `PAID`
- Payment amount: `-100`
- Booking `paidAmount`: `-100`

The endpoint also allows overpayment and has no idempotency key. Payment creation and booking balance update are separate writes, so a crash can leave them inconsistent; simultaneous requests can also overwrite each other's read-derived balance.

**Business impact:** corrupted folios, false refunds/revenue, wrong balance due, duplicate collections and irreconcilable reports.

**Required fix:** validate a strict positive amount and allowed method; reject payment on terminal/cancelled bookings; enforce remaining-balance policy; wrap payment + atomic balance increment + audit entry in one transaction; accept an idempotency key; add negative, zero, overpayment, retry and concurrent-payment regression tests.

### BK-002 — Critical — Check-in room override can double-occupy a room

`PATCH /api/bookings/:id/check-in` accepts optional `roomId`, but does not verify that the room belongs to the tenant, is active, is available for the booking dates, or is not already occupied. Booking update, room status update and deposit creation run in `Promise.all`, not one transaction.

The adversarial test created one checked-in booking in Room 2, then checked a second confirmed booking into Room 2 using the override. The API returned 200 and the database contained two `CHECKED_IN` bookings for the same room and dates.

**Business impact:** two guests receive the same room; front desk and housekeeping state become untrustworthy.

**Required fix:** use one serializable transaction; tenant-scope and validate the override room; run the standard overlap/occupancy check excluding the current booking; compare-and-set booking status; update old/new room state correctly; add same-room, cross-tenant, inactive-room and double-click tests.

### BK-003 — Critical — Cancelling a checked-in booking leaves the room occupied

The cancellation route blocks Checked Out/Cancelled/No Show, but allows `CHECKED_IN`. It changes only booking/payment records; it does not update the room or create an operational task.

The adversarial test cancelled a checked-in stay. The booking became `CANCELLED`, while the room remained `OCCUPIED`.

**Business impact:** ghost occupancy, unavailable inventory, wrong front-desk counts and possible manual room reassignment mistakes.

**Required fix:** either forbid cancellation after check-in and require checkout/early-departure, or implement an explicit early-departure transaction that finalises charges, moves the room to Cleaning and creates housekeeping/audit records. Cancellation + refund writes must be one transaction.

### BK-004 — Critical — Luxe public modal gives false booking confirmation

The room-specific Luxe `BookingModal` calls the public booking endpoint, which always creates a `PENDING` 30-minute payment hold. It then immediately renders:

- “You're booked!”
- a confirmation number;
- “Confirmation sent”

It does not redirect to checkout or call the manual-payment confirmation path. The expiry worker later cancels this unpaid pending row.

**Business impact:** a guest believes the reservation is confirmed, travels or stops shopping, while ResortPro silently releases it after 30 minutes.

**Required fix:** remove the separate booking implementation and use the shared canonical BookingForm/checkout contract. Never display confirmed language until backend status is `CONFIRMED`; pending/manual-pay wording must be explicit and durable.

### BK-005 — Critical — Group bulk checkout bypasses billing finalisation

Single checkout correctly performs a compare-and-set, payment write, canonical `bill()`, invoice finalisation, line-item freeze, booking invoice link, room Cleaning state, housekeeping task, billing audit, email and loyalty side effects.

Group bulk checkout performs only:

- booking status → `CHECKED_OUT`;
- room status → `CLEANING`;
- housekeeping task creation;
- group status update.

It does not calculate/freeze invoices, collect/validate settlement, write `checkedOutBy`, create billing audit rows, send checkout documents, award loyalty, or surface undelivered-food warnings.

**Business impact:** group guests can be checked out with no authoritative invoice/final bill; revenue and audit history can be missing even though operations says the stay is complete.

**Required fix:** extract one canonical checkout service and invoke it for each child booking inside a controlled batch. Return per-booking success/failure and preserve idempotency. Do not maintain a second partial lifecycle.

## Major findings

### BK-006 — Major — Public and group pricing ignore rate plans

Internal booking and walk-in creation call `resolveRate()` night by night. Public website and group creation calculate `room.basePrice × nights`; their UI quotes the same base price. Documentation says rate resolution applies to public website bookings too, but the implementation does not.

**Impact:** seasonal/weekend/promotional rate plans can be undercharged or overcharged on the most important direct-booking channel.

**Required fix:** create one pricing quote service used by availability, every UI quote, public booking, dashboard, walk-in, group, modify and invoice. Return a quote ID/version and revalidate on submit.

### BK-007 — Major — Manual checkout can bypass tenant payment configuration

Unauthenticated `POST /api/payments/checkout/init` accepts `gateway: manual` and changes any known booking ID from Pending to Confirmed. It does not verify that the tenant enabled manual/pay-at-resort checkout. The UI gateway list may hide Manual, but the API still accepts it directly.

**Impact:** a guest can bypass a resort's mandatory online-payment rule and hold inventory without payment.

**Required fix:** validate the requested gateway against the tenant's enabled payment methods and booking state; use a signed, short-lived checkout token bound to booking + tenant; reject cancelled/expired/non-pending bookings.

### BK-008 — Major — Capacity and date/business-rule validation is incomplete

Server routes do not enforce `adults + children <= room.maxOccupancy`. Public shared BookingForm lets adults reach 10 independent of the selected room. Dashboard/public APIs also accept past check-in dates as long as checkout is later. Check-in has no configured check-in-date/time guard or override reason.

**Impact:** impossible occupancy, inaccurate guest counts, historical bookings and operational mistakes can be persisted by direct API calls or inconsistent UIs.

**Required fix:** centralize room-capacity, stay-date, min/max-stay and operational override rules on the server; return machine-readable validation errors; keep UI constraints as convenience only.

### BK-009 — Major — Abandoned promo bookings consume limited offers permanently

Public booking increments `Offer.usedCount` when the `PENDING` hold is created. The expiry worker cancels stale unpaid bookings but does not remove/reverse `BookingOffer` usage. Cancellation also does not restore an offer usage.

**Impact:** abandoned or automated checkout attempts can exhaust a limited promo without producing a paid/confirmed stay.

**Required fix:** reserve versus consume promo usage explicitly. Consume on confirmation/payment, or release the reservation atomically on expiry/cancellation. Add concurrency tests for the last available redemption.

### BK-010 — Major — Modifying dates/room can silently lose an applied offer price

The modify route recalculates `totalAmount` from the rate plan/base price when dates or room change, but it does not recalculate or remove attached `BookingOffer` rows. The UI can still show an attached offer while the booking total has returned to full price; `usedCount` remains consumed.

**Required fix:** make repricing return a complete pricing breakdown, revalidate every attached offer against the new stay, update discount snapshots and usage in one transaction, and require explicit staff confirmation of price change.

### BK-011 — Major — Group create/update can report misleading success and drift from children

Group creation silently `continue`s when guest information is missing or a room ID is invalid, then returns 201 with a partially created group. Percentage discount has no maximum of 100. Check-in/out ordering is not validated. Updating group dates changes only the group header, not child bookings, availability conflicts or prices.

**Impact:** staff can believe several rooms were reserved when some were skipped; group summary dates can disagree with real bookings; discounts can create negative totals.

**Required fix:** reject the whole request with indexed validation errors unless an explicit partial-success contract is designed; enforce date order and percentage ≤100; update children through a preview + conflict/repricing transaction.

### BK-012 — Major — Booking deposit has no complete apply/refund lifecycle

Check-in stores `booking.deposit` and also writes a `PAID` Payment row, while intentionally leaving `booking.paidAmount` and `paymentStatus` unchanged. `bill()` labels it held money, but no booking endpoint was found to apply it to the folio or return it at checkout.

The adversarial test confirmed: paid payment sum 250, booking paidAmount 0, payment status Pending.

**Impact:** financial screens can disagree about money received and a security deposit can become stranded with no auditable disposition.

**Required fix:** model deposits separately or add explicit held/applied/refunded states and checkout controls. Do not count held cash as a normal `PAID` booking payment unless reconciliation understands it.

### BK-013 — Major — Public checkout exposes guest details by bare booking ID

`GET /api/payments/checkout/booking/:bookingId` is public and returns guest name/email, dates, room, amount and resort. UUID entropy reduces guessing risk, but booking IDs appear in URLs/history/referrers and can be shared.

**Required fix:** use a signed short-lived checkout token, minimize returned PII, set strict referrer/cache policies and verify slug/tenant binding.

### BK-014 — Major — No maintained regression suite for several release-critical paths

Strong tests exist for the single lifecycle, concurrency and checkout. No maintained tests were found for group booking/bulk checkout, public booking price parity, promo expiry restoration, negative/duplicate payment, check-in room override, checked-in cancellation or Luxe false confirmation.

**Required fix:** convert the adversarial scenarios into permanent regression tests and add browser tests for every public theme and payment mode.

## Minor/accessibility findings

### BK-015 — Minor — Booking forms have incomplete accessible naming

Browser automation could not locate New Booking date inputs by their visible labels because labels are not connected with `htmlFor`/`id`. ModalShell's icon-only close button has no accessible name. Several public/custom booking modals similarly use visual labels and icon buttons without programmatic names; the Luxe side panel lacks dialog semantics/focus trapping.

**Required fix:** associate every label/input, add accessible names, dialog semantics, initial focus and focus trap, and verify Escape/focus restoration. Add axe or equivalent WCAG regression checks.

### BK-016 — Minor — ESLint is not configured for non-interactive CI

`pnpm --filter @resort-pro/web lint` prompts to create an ESLint configuration and exits 1 in automation. TypeScript passes, but lint cannot function as a release gate.

**Required fix:** commit the chosen ESLint configuration and run it non-interactively in CI.

## What passed strongly

- Same-room overlap returns 409.
- Five simultaneous overlapping requests produce exactly one successful booking.
- Non-overlapping dates remain bookable after a conflict.
- Single checkout compare-and-set rejects duplicate/concurrent checkout.
- Invoice totals agree across bill, checkout summary, stored invoice and invoice page.
- Undelivered food is excluded and surfaced as a warning.
- Draft invoices are replaced without duplicate lines; deliberate adjustment lines survive.
- Checkout moves the room to Cleaning and creates housekeeping work.
- Checkout email and loyalty side effects are claimed once.
- Returning walk-in guests are matched conservatively by phone/name and explicit guest ID is tenant-scoped.
- Owner and Receptionist can load the booking workspace; unauthorized API roles are covered by role middleware.
- Tenant isolation suite passed.
- Booking search and empty state worked in the browser.
- New Booking and Walk-in interfaces opened from the real dashboard.
- iPhone layout retained both actions and did not overflow the document.
- No product data remained from adversarial tests; their isolated tenant was deleted.

## Release recommendation

The system is suitable for an internal demo of the standard single-booking happy path, but not for customer handoff where staff will use room overrides, cancellations, payments and group checkout or guests can book through every published theme.

### Minimum customer-handoff gate

1. Fix and permanently test BK-001, BK-002 and BK-003.
2. Route Luxe and every public theme through one canonical booking/checkout component.
3. Route group checkout through the same canonical finalisation service as single checkout.
4. Use one pricing service for every channel and revalidate occupancy/dates server-side.
5. Enforce enabled payment methods and signed checkout tokens.
6. Repair promo reservation/release and modify-booking repricing.
7. Complete the deposit lifecycle.
8. Add the missing API + Playwright regression matrix.
9. Run staging tests with real sandbox gateways, email delivery, worker/cron, tax and timezone configuration.

After fixes, rerun the full matrix with at least: Owner, Manager and Receptionist; desktop and real mobile browser; standard, Luxe and dynamic themes; manual and each enabled gateway sandbox; single, walk-in and multi-room group stays; cancellation before/after payment; early departure; retry/double-click; concurrent last-room and last-promo-use scenarios.

## Safety, cleanup and limitations

- All mutation tests used isolated QA tenants and records; cleanup completed.
- No real customer booking, payment, refund, email or SMS was sent.
- Email was disabled locally (`RESEND_API_KEY` absent); email content/provider delivery was not end-to-end tested.
- No real payment gateway credentials were used; gateway redirect, webhook authenticity and settlement reconciliation require staging sandbox tests.
- The pending-expiry worker was code-reviewed but not allowed to wait 30 minutes in real time.
- Browser tests used Chromium and iPhone 14 emulation, not physical devices or Safari/WebKit payment sheets.
- Temporary QA test files were removed after execution; the permanent report is this document.

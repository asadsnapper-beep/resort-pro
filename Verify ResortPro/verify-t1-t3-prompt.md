# Verify ResortPro booking-lifecycle fixes (Tier 1–3)

You are verifying a specific set of already-implemented fixes on branch
`feat/booking-lifecycle-and-concurrency-fixes` in the ResortPro repo
(`/Users/parthohore/Hotel management`). You did not write this code — your
job is to independently confirm each fix actually works, using real data and
real requests, not by reading the code and assuming it's correct.

**Do not trust the code by inspection alone. For every item below: exercise
it for real (curl / DB query / browser), observe the actual result, and only
then mark it pass/fail.** If something fails, say so plainly — do not soften
it into "mostly works" or fix it silently; report it and stop for that item.

## Setup

- API: `cd apps/api && pnpm dev` (port 4000). If already running and
  stale, kill with `pkill -9 -f "tsx.*src/index.ts"` and restart.
- Web: already running on port 3000, or `cd apps/web && pnpm dev`.
- DB: Postgres in Docker, container `resortpro-postgres`, db `resortpro`,
  user `resortpro`. Query via
  `docker exec resortpro-postgres psql -U resortpro -d resortpro -c "..."`.
- Dashboard login: slug `palm-paradise-resort`, email
  `owner@palmparadise.com`, password `Password123!`.
  Get a bearer token via:
  `curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"slug":"palm-paradise-resort","email":"owner@palmparadise.com","password":"Password123!"}'`
- Create any test guests/bookings/rate-plans/offers you need with real
  far-future dates (e.g. 2029+) so they don't collide with existing seed
  data. **Delete everything you create when you're done**, per item, not
  just at the end — leave the DB exactly as you found it.

## Items to verify

### 1. Public booking double-booking race (`apps/api/src/routes/website.ts`)

Fire 10 truly-concurrent `curl` requests (background `&` + `wait`, not
sequential) at `POST /site/palm-paradise-resort/book` for the **same**
room + dates. Expect exactly **1** `201` and the rest `409` with the
message "Room was just booked by someone else...". Confirm via DB that
exactly one booking row exists for that room/dates.

### 2. Internal booking double-booking race (`apps/api/src/routes/bookings.ts`, `POST /`)

Same test via `POST /api/bookings` (needs the bearer token) instead of the
public endpoint. Same expectation: 1 success, rest 409.

### 3. Group booking conflict check (`apps/api/src/routes/groupBookings.ts`, `POST /`)

- Create a normal booking on a room for some future dates.
- Create a group booking (`POST /api/group-bookings`) whose `bookings[]`
  array includes that same room + overlapping dates → expect `409`, and
  confirm via DB that **no** group_booking row or child booking was left
  behind (full rollback).
- Create a group booking listing the **same room twice** in one submission
  → expect `409` (self-conflict), no orphan rows.
- Create a group booking with two different free rooms → expect `201`,
  both child bookings created, group discount math correct
  (`price × nights × (1 - discount%)` for PERCENTAGE, or `price × nights - discount` for FLAT).

### 4. Abandoned PENDING booking expiry (`apps/api/src/jobs/expire-pending-bookings.ts`)

Insert 3 bookings directly via SQL:
- PENDING, `createdAt` 40 minutes ago, `paidAmount = 0` → should be expired
- PENDING, `createdAt` 5 minutes ago, `paidAmount = 0` → should NOT be touched (too recent)
- PENDING, `createdAt` 40 minutes ago, `paidAmount > 0` → should NOT be touched (already paid)

Run the job directly: write a throwaway script that imports and calls
`expireStalePendingBookings()` from that file (`npx tsx` it), or wait for
the real cron (fires every 5 min if the worker process — `pnpm dev:worker`
— is running). Confirm: only booking #1 flips to `CANCELLED` with
`cancellationReason` starting with "Auto-expired", `cancelledBy: 'system'`;
#2 and #3 are unchanged. Run it a second time — expect 0 further changes
(idempotent).

### 5. App-wide validation error status codes (`apps/api/src/app.ts`)

Send an intentionally invalid body to any endpoint that uses a Zod
`.parse()` call (e.g. `PATCH /api/food-orders/:id/status` with
`{"status":"BOGUS"}`). Expect HTTP **400** with body shape
`{"success":false,"error":"Validation failed","details":[...]}` — **not**
a raw 500 with `{"statusCode":500,"error":"Internal Server Error",...}`.
Try it against at least two different route files to confirm it's fixed
globally, not just for one file.

### 6. Restaurant order payment tracking (`apps/api/src/routes/foodOrders.ts`)

- `POST /api/food-orders` with no `bookingId` (a walk-in/table order) →
  confirm the created order's `paymentStatus` is `"PENDING"`, not `"PAID"`.
- `PATCH /api/food-orders/:id/payment` with `{"method":"CASH"}` → confirm
  `paymentStatus` becomes `"PAID"` and `paymentMethod` is set.
- Cancel a different order (`PATCH /:id/status` → `CANCELLED`), then try
  to mark IT as paid → expect `400` ("Cannot mark a cancelled order as
  paid").
- In the browser: open `/dashboard/orders`, create a walk-in order, confirm
  the red "Unpaid" badge + method-picker + "Mark Paid" button appear, click
  it, confirm the badge disappears and DB reflects `PAID`.

### 7. No-show handling (`apps/api/src/routes/bookings.ts`, `PATCH /:id/cancel`)

- Create a `CONFIRMED` booking. Call
  `PATCH /api/bookings/:id/cancel` with `{"isNoShow": true}` → expect
  `status: "NO_SHOW"` (not `CANCELLED`), `cancellationReason` auto-filled,
  no cancellation email attempted.
- Try to mark a `PENDING` booking as no-show → expect `400` ("Only a
  confirmed booking can be marked as a no-show").
- Try to no-show/cancel a booking that's already `NO_SHOW`/`CANCELLED` →
  expect `400`.
- Confirm the room frees up in `GET /api/rooms/availability` for those
  dates afterward.
- In the browser: open a CONFIRMED booking's detail sheet, confirm a
  "Mark No-Show" button appears (only for CONFIRMED, not PENDING), click
  through the modal, confirm the booking list shows a "No Show" pill.

### 8. Group bulk-checkout housekeeping (`apps/api/src/routes/groupBookings.ts`, `POST /:id/bulk-checkout`)

Create a group booking with 2 rooms, `POST /:id/bulk-checkin`, then
`POST /:id/bulk-checkout`. Confirm via DB: both rooms end up `CLEANING`
(not `AVAILABLE`), and a `HousekeepingTask` row (`type: CHECKOUT`,
`status: PENDING`) exists for each room.

### 9. Rate plan night-by-night pricing (`apps/api/src/routes/ratePlans.ts`, `resolveRate`)

- Create a `WEEKEND` rate plan: `daysOfWeek: [5,6]` (Fri/Sat), some price
  higher than the room's base price.
- Pick a 5-night date range starting on a **Tuesday** so it spans 3
  weekday nights + 2 weekend nights (verify the actual day-of-week with
  `date +%A` or Python, don't guess).
- Call `GET /api/rate-plans/resolve?roomId=&checkIn=&checkOut=` → confirm
  `nightlyBreakdown` shows base price for the 3 weekday nights and the
  weekend price for the 2 weekend nights, and `totalPrice` equals the sum.
- Create a real booking over that same range via `POST /api/bookings` →
  confirm `totalAmount` equals that same `totalPrice` (this is the actual
  money charged, not just a preview).
- Clean up the rate plan and booking afterward.

### 10. Balance-consistency audit script (`apps/api/src/scripts/audit-balances.ts`)

Run `cd apps/api && npx tsx src/scripts/audit-balances.ts` (or
`npm run audit:balances`). Expect **0 mismatches, 0 sanity warnings**
across all tenants right now (this was already fixed this session — if it
finds something new, that's a genuine regression worth flagging, not
something to silently ignore).

### 11. Docs accuracy (`apps/web/src/app/docs/rate-plans/page.tsx`, `docs/settings/page.tsx`)

Open both pages in the browser (`/docs/rate-plans`, `/docs/settings`).
Confirm neither page claims a "Cancellation Policy" field, "Advance
Booking" field, "Maximum Stay" field, meal-plan types, or room-type/
multi-room picker exists on a rate plan or in Settings — none of these
are real fields in the actual forms. The rate-plan field table should only
list: Rate Type, Plan Name, Price/Night, Room (optional), Minimum Nights,
Applies on Days, Start/End Date.

## Report format

For each of the 11 items: **PASS** or **FAIL**, with the actual command
output / DB query result you observed as evidence (not a paraphrase). If
anything fails, include the exact request and response so it can be
debugged — don't attempt to fix it yourself unless asked.

Confirm at the end that all test data you created (guests, bookings, rate
plans, group bookings, food orders) has been deleted and the DB is clean.

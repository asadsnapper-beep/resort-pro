# Task 29 — Check-in / Check-out Flow

**Branch:** `feature/checkin-checkout`
**Priority:** 🔴 Critical
**Estimate:** 1 day

---

## Goal
Proper guest arrival/departure flow with status lifecycle: `confirmed → checked_in → checked_out`।

---

## Prisma Changes

```prisma
model Booking {
  // existing fields...
  actualCheckIn   DateTime?
  actualCheckOut  DateTime?
}

enum BookingStatus {
  // existing: PENDING CONFIRMED CANCELLED NO_SHOW
  CHECKED_IN   // new
  CHECKED_OUT  // new
}
```

Run: `pnpm db:push`

---

## Steps

### Step 1 — API enhancements
**`PATCH /api/bookings/:id/check-in`** (already exists — enhance):
- Set `actualCheckIn = now()`
- Set booking `status = CHECKED_IN`
- Set room `status = OCCUPIED`
- Auto-create housekeeping task: type `CHECKOUT`, scheduled for checkout date

**`PATCH /api/bookings/:id/check-out`** (already exists — enhance):
- Set `actualCheckOut = now()`
- Set booking `status = CHECKED_OUT`
- Set room `status = CLEANING`
- Trigger invoice generation
- Create housekeeping task: type `CHECKOUT` (if not already)

### Step 2 — Booking Detail UI changes
In booking detail sheet/page:

**Check-in button:**
- Show when: `status === 'confirmed'` AND `checkIn <= today`
- Confirm modal: "Check in [Guest Name] to Room [X]?"
- On confirm → call check-in API → refresh

**Check-out button:**
- Show when: `status === 'checked_in'`
- Show summary before confirming:
  - Nights stayed
  - Room total (nights × rate)
  - Restaurant orders total
  - Grand total
- On confirm → call check-out API → show invoice link

### Step 3 — Status badge update
Add `CHECKED_IN` (green) and `CHECKED_OUT` (gray) to status badge colors throughout the app.

### Step 4 — Dashboard widget update
Homepage dashboard: "Today's Check-ins" and "Today's Check-outs" lists — click each to go to booking.

---

## Acceptance Criteria
- [ ] Check-in button visible on correct bookings
- [ ] Check-in sets actualCheckIn, status, room status
- [ ] Check-out button visible after check-in
- [ ] Check-out shows cost summary before confirming
- [ ] Room becomes CLEANING after checkout
- [ ] Status badges updated everywhere
- [ ] Dashboard shows today's arrivals/departures

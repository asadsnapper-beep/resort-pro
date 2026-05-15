# Task 33 — Walk-in Booking (Front Desk Quick Add)

**Branch:** `feature/walkin-booking`
**Priority:** 🟡 Important
**Estimate:** 0.5 day

---

## Goal
Guest directly resort-এ এসে গেছে — ৩০ সেকেন্ডে booking create। Online flow ছাড়া।

---

## Steps

### Step 1 — API change
`POST /api/bookings` — add `source` field:
```prisma
enum BookingSource { ONLINE WALK_IN PHONE OTA }
model Booking {
  source BookingSource @default(ONLINE)
}
```

Walk-in bookings: `source = WALK_IN`, can skip email confirmation।

### Step 2 — Quick booking modal
Trigger: "Walk-in" button (prominent, green) at top of `/dashboard/bookings` page.

Full-screen modal with minimal form:
- **Room:** dropdown (shows only available rooms for selected dates, with price)
- **Check-in date:** date picker (default: today)
- **Check-out date:** date picker (default: tomorrow)
- **Guest name:** text (required)
- **Phone:** text (optional)
- **Adults / Children:** number inputs
- **Payment:** radio (Cash / Card / Pending)
- **Auto check-in:** checkbox (tick = immediately set status to `checked_in`)
- **Skip email:** checkbox (default: checked for walk-in)

Submit → create booking → if auto check-in ticked → also call check-in API → success toast with booking ref।

### Step 3 — Available rooms API
`GET /api/rooms/available?checkIn=&checkOut=` — rooms not booked in that range, with current status।

(May already exist — verify and expose properly।)

---

## Acceptance Criteria
- [ ] Walk-in button visible and prominent
- [ ] Only available rooms shown in dropdown
- [ ] Booking created in < 30 seconds
- [ ] Auto check-in option works
- [ ] Payment method recorded
- [ ] Shows in booking list + calendar immediately
- [ ] Source = WALK_IN recorded

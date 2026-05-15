# Task 28 — Visual Booking Calendar (Gantt View)

**Branch:** `feature/booking-calendar`
**Priority:** 🔴 Critical
**Estimate:** 1 day

---

## Goal
Room × Date Gantt grid — front desk-এর #1 daily tool। কোন room কোন দিন booked তা একনজরে দেখা।

---

## Steps

### Step 1 — API endpoint
`GET /api/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:
```json
{
  "rooms": [
    {
      "id": "...", "number": "101", "name": "Deluxe", "type": "DELUXE", "status": "available",
      "bookings": [
        { "id": "...", "guestName": "John", "checkIn": "2026-05-15", "checkOut": "2026-05-18", "status": "confirmed", "nights": 3 }
      ]
    }
  ],
  "dateRange": ["2026-05-15", "2026-05-16", ..., "2026-05-44"]
}
```

### Step 2 — Frontend page
`apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx`

- 30-day window, ← → navigation buttons
- Header row: dates (Mon 15, Tue 16, ...)
- Each room row: room number + name, then booking blocks spanning correct columns
- Booking block: guest name, color by status
  - `confirmed` → indigo bg
  - `checked_in` → green bg
  - `checked_out` → gray bg
  - `cancelled` → red/strikethrough
- Empty cell click → new booking modal (room + date pre-filled)
- Booking block click → existing booking detail sheet
- Today column: amber/yellow highlight
- Room with `MAINTENANCE` status → orange lock icon, cells blocked

### Step 3 — Sidebar link
Add `Calendar` link (CalendarDays icon) to dashboard sidebar, between Bookings and Guests.

### Step 4 — Mobile
Horizontal scroll on small screens. Room column sticky left.

---

## API File
`apps/api/src/routes/bookings.ts` — add new route:
```ts
app.get('/calendar', { preHandler: requireRole('OWNER', 'MANAGER', 'STAFF') }, async (request, reply) => {
  // query rooms + their bookings in date range
});
```

---

## Acceptance Criteria
- [ ] All rooms visible in grid
- [ ] Bookings show as colored blocks spanning correct dates
- [ ] Click empty cell → booking create pre-filled
- [ ] Click block → booking detail
- [ ] Navigate month forward/backward
- [ ] Today highlighted
- [ ] Mobile: horizontal scroll works

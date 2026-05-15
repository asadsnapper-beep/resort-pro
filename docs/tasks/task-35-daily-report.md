# Task 35 — Daily / Shift Report

**Branch:** `feature/daily-report`
**Priority:** 🟡 Important
**Estimate:** 0.5 day

---

## Goal
End-of-day summary report — owner/manager প্রতিদিন দেখে। Print করা যায়।

---

## Steps

### Step 1 — API
`GET /api/reports/daily?date=YYYY-MM-DD`

Response:
```json
{
  "date": "2026-05-15",
  "occupancy": {
    "totalRooms": 20,
    "occupied": 14,
    "rate": 70,
    "nightsSold": 14
  },
  "arrivals": [
    { "bookingId": "...", "guestName": "John", "room": "101", "nights": 3, "checkOut": "2026-05-18" }
  ],
  "departures": [
    { "bookingId": "...", "guestName": "Jane", "room": "205", "totalBill": 15000 }
  ],
  "noShows": [],
  "revenue": {
    "rooms": 70000,
    "restaurant": 12500,
    "extras": 3000,
    "total": 85500
  },
  "payments": {
    "cash": 30000,
    "card": 40000,
    "online": 12500,
    "pending": 3000
  },
  "housekeeping": {
    "completed": 18,
    "pending": 2
  },
  "maintenance": {
    "open": 3,
    "resolvedToday": 1
  }
}
```

### Step 2 — UI page
`apps/web/src/app/(dashboard)/dashboard/reports/page.tsx`

Layout:
- **Date picker** top right (default: today)
- **Occupancy card** — big % number, rooms occupied / total
- **Arrivals section** — table: guest, room, nights, check-out date
- **Departures section** — table: guest, room, total bill, payment status
- **Revenue summary** — 4 boxes: Rooms / Restaurant / Extras / Total
- **Payments breakdown** — Cash / Card / Online / Pending (color bar)
- **Housekeeping status** — completed vs pending
- **Maintenance** — open tickets count

### Step 3 — Print layout
`@media print` CSS:
- Hide sidebar, top nav, date picker, print button
- Clean white background
- Resort name + date as print header
- All sections in single-column layout

### Step 4 — Email self
"Email Report" button → `POST /api/reports/daily/email?date=` → sends formatted summary to owner's email।

### Step 5 — Sidebar link
Add `Reports` link (FileBarChart icon) to dashboard sidebar।

---

## Acceptance Criteria
- [ ] Today's arrivals/departures listed correctly
- [ ] Occupancy % accurate
- [ ] Revenue correctly sums rooms + restaurant + extras
- [ ] Payment breakdown correct
- [ ] Print produces clean output (no sidebar/nav)
- [ ] Date picker changes all data
- [ ] Email report sends to owner

# Front Desk System — ResortPro

> Real-time operations hub — Check-in, Check-out, Walk-in, Room Map।

---

## Overview

Front desk হলো hotel এর দৈনন্দিন কাজের কেন্দ্র। এখান থেকে staff আজকের arrivals/departures দেখে, guests check-in/check-out করে, walk-in guest নেয়, এবং room map এ live status দেখে।

---

## Features

### ১. Today's Dashboard
- **Date header** — আজকের তারিখ + মোট in-house guests
- **Room Stats Bar** — Total / Occupied / Available / Cleaning / Maintenance (5 cards)
- **Quick Stats** — Today's Arrivals / Departures / In-House (color blocks)
- **Auto-refresh** — প্রতি 60 সেকেন্ডে automatic reload
- **Manual refresh** button (↻)

### ২. List View — 3 Tabs
| Tab | কী দেখায় | Action |
|-----|----------|--------|
| Arrivals | আজকে check-in expected (CONFIRMED/PENDING) | Check In button |
| Departures | আজকে check-out expected (CHECKED_IN) | Check Out button |
| In-House | সব currently CHECKED_IN guests | Check Out button |

প্রতিটি Booking Card:
- Guest নাম, ফোন, room number, guests count, nights
- Source badge (Walk-in / Booking.com / Airbnb)
- Balance due warning (amber)
- Special requests (truncated)

### ৩. Map View
- Room grid — floor এ ভাগ করা
- প্রতিটি room tile এ: status color, room #, name, guest নাম (if occupied)
- CONFIRMED room তে "Check In" button
- CHECKED_IN room তে "Check Out" button
- Color legend নিচে

### ৪. Check-In Modal
- Booking summary — confirmation #, room, stay dates, guests, balance due
- Optional deposit collection (amount input)
- Room notes input
- Special requests banner (if any)

### ৫. Check-Out Modal
- Bill summary — total, already paid, balance due
- Payment collection — **balance auto-filled** in input, CASH/CARD/BANK_TRANSFER selector
- Confirm check-out → booking CHECKED_OUT, room → CLEANING

### ৬. Walk-In Modal
- Guest name + phone
- Adults + children count
- Check-in / check-out dates
- Available room picker — **date change করলে room list refresh হয়** (queryKey এ dates)
- Estimated total (basePrice × nights)
- Advance payment + method (CASH/CARD/BANK/LATER)
- Notes

---

## Room Statuses (5টা)

| Status | Color | মানে |
|--------|-------|------|
| `AVAILABLE`   | Green  | ফাঁকা, booking নেওয়া যাবে |
| `OCCUPIED`    | Blue   | Guest আছে |
| `CLEANING`    | Amber  | Check-out এর পরে cleaning চলছে |
| `MAINTENANCE` | Red    | Repair/maintenance এ |
| `RESERVED`    | Purple | Hold করা |

---

## API Endpoints

```
GET /api/front-desk/today      Today's arrivals, departures, in-house, room stats
GET /api/front-desk/room-map   Rooms grouped by floor with active booking overlay
```

### `GET /api/front-desk/today` response shape
```json
{
  "date": "2026-06-13",
  "roomStats": { "total": 20, "occupied": 5, "available": 12, "cleaning": 2, "maintenance": 1 },
  "totalGuests": 8,
  "arrivals":   { "count": 3, "pending": 2, "bookings": [...] },
  "departures": { "count": 2, "pending": 2, "bookings": [...] },
  "inHouse":    { "count": 5, "bookings": [...] }
}
```

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/front-desk/
    page.tsx          ← Full page (modals, booking cards, room map, stats)

apps/api/src/routes/
  frontDesk.ts        ← /today + /room-map endpoints
```

---

## Data Flow

```
Today's Arrivals:
  checkIn = today date range, status IN (CONFIRMED, PENDING)

Today's Departures:
  checkOut = today date range, status = CHECKED_IN

In-House:
  status = CHECKED_IN (all, not date filtered)

Check-In flow:
  PATCH /api/bookings/:id/check-in
    → booking.status: CHECKED_IN
    → booking.actualCheckIn: now
    → room.status: OCCUPIED
    → optional deposit recorded

Check-Out flow:
  PATCH /api/bookings/:id/check-out
    → booking.status: CHECKED_OUT
    → booking.actualCheckOut: now
    → room.status: CLEANING
    → additional payment recorded

Walk-In flow:
  POST /api/bookings/walk-in
    → guest created (or found by phone/email)
    → booking created (CHECKED_IN immediately)
    → room.status: OCCUPIED
    → advance payment recorded
```

---

## উন্নতির সুযোগ (Future)

- [ ] Overdue checkout list — যে guests কাল check-out করার কথা কিন্তু এখনো CHECKED_IN
- [ ] Search/filter arrivals by name or room
- [ ] Extend stay option from Check-Out modal
- [ ] Housekeeping queue — CLEANING rooms এ task assign
- [ ] Night audit report — daily summary PDF

---

## Status

সব core feature ✅ live:
- Today dashboard, arrivals/departures/in-house tabs, check-in/check-out/walk-in modals
- Room map with floor groups, live status colors, inline actions
- Auto-refresh 60s, balance tracking, source badges — June 2026

### Bug fixes applied (June 2026)
1. ✅ `capacity` → `maxOccupancy` in room-map API (Prisma field name fix — was causing runtime error)
2. ✅ `outOfOrder` → `maintenance` in roomStats (OUT_OF_ORDER status doesn't exist in schema)
3. ✅ Walk-In queryKey এ `checkIn`/`checkOut` যোগ — dates change হলে rooms refresh হয়
4. ✅ Check-out payment input balance pre-filled (balance computed before useState)
5. ✅ `CLEANING` status সব জায়গায় যোগ — API PATCH endpoint, RoomDetailSheet actions, rooms stats

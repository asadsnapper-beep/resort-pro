# Calendar System — ResortPro

> দুটো আলাদা calendar: (1) Booking Gantt Calendar — ভেতরের dashboard এ সব bookings দেখায়। (2) External Calendar (Channel Sync) — Booking.com / Airbnb iCal sync করে room block করে।

---

## Part 1: Booking Calendar (Gantt View)

**Route:** `/dashboard/calendar`
**API:** `GET /api/bookings/gantt?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Features

- **Gantt chart** — rooms (Y axis) × dates (X axis), 30-day window
- **Room column** — room number, name, type badge (STD/DLX/STE...), maintenance indicator
- **Booking blocks** — color by status, guest name, nights count
- **Today column** — amber highlight
- **Weekend columns** — indigo date label
- **Booking detail panel** — click booking → right-side panel with full details + "Open Booking" button
- **Navigation** — Prev/Next 7-day steps, Today button, manual refresh
- **Cell click** — empty cell → pre-fills room + check-in in new booking URL
- **Quick stats** — Total Rooms, Occupied Today, Maintenance, Bookings in View
- **Month header** — shows month name on day-1 and first visible day

### Booking Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| `CONFIRMED` | Indigo | bg-indigo-500 |
| `CHECKED_IN` | Emerald | bg-emerald-500 |
| `CHECKED_OUT` | Gray | bg-gray-400 |
| `PENDING` | Amber | bg-amber-400 |
| `CONFLICT` | Red | bg-red-500 |

### API Response Shape

```json
{
  "rooms": [
    {
      "id": "...",
      "number": "101",
      "name": "Ocean Suite",
      "type": "SUITE",
      "status": "OCCUPIED",
      "floor": 1,
      "basePrice": 5000,
      "maxOccupancy": 2,
      "bookings": [
        {
          "id": "...",
          "confirmationNumber": "RES-2026-001",
          "guestName": "Karim Hossain",
          "checkIn": "2026-06-13",
          "checkOut": "2026-06-15",
          "nights": 2,
          "status": "CHECKED_IN",
          "totalAmount": 10000,
          "adults": 2,
          "children": 0
        }
      ]
    }
  ],
  "dates": ["2026-06-10", "2026-06-11", ...],
  "from": "2026-06-10",
  "to": "2026-07-09"
}
```

---

## Part 2: External Calendar Sync (Channel Sync)

**Route:** `/dashboard/channels`
**API:** `/api/external-calendars/*`

### Features

- **Add calendar** — iCal URL paste + Test button (validates before save)
- **Room grouping** — calendars grouped by room
- **Sync status** — last sync time, error message, bookings imported count
- **Manual sync** — "Sync Now" button per calendar
- **Pause/Resume** — toggle isActive
- **Source detection** — Booking.com / Airbnb / Agoda / Expedia color badges
- **Auto-sync** — cron job runs every 15 minutes

### iCal Sync Logic

```
syncOneCalendar(cal):
  1. Fetch iCal URL (10s timeout)
  2. Parse VEVENT blocks (RFC 5545, handles folded lines, DATE + DATE-TIME)
  3. For each event:
     - CANCELLED  → find matching booking by externalUid → mark CANCELLED
     - TENTATIVE  → skip (don't block rooms for tentative holds)
     - exists     → update dates if changed
     - new        → conflict check vs direct bookings
       • conflict found → direct booking → status: CONFLICT + conflictNote
       • no conflict   → create blocked booking (status: CONFIRMED, source: cal.name)
  4. Update lastSyncAt, clear lastError
```

### Conflict Detection

When an OTA booking overlaps a direct (internal) booking:
- Direct booking → `status: CONFLICT`
- `conflictNote` field set with details
- Staff can see red "⚠ Conflict" in Gantt calendar
- Staff must resolve manually

### External Booking in DB

```
booking.externalUid    = VEVENT UID (for dedup)
booking.externalSource = calendar name (e.g. "Booking.com")
booking.source         = cal.name.toUpperCase() (max 20 chars)
booking.walkIn         = false
booking.guestId        = dummy guest (ical-dummy@{tenantId}.internal)
booking.totalAmount    = 0
booking.status         = CONFIRMED
```

---

## API Endpoints

### Gantt
```
GET /api/bookings/gantt?from=YYYY-MM-DD&to=YYYY-MM-DD
```

### External Calendars
```
GET    /api/external-calendars              List all (with importedCount per calendar)
POST   /api/external-calendars              Add calendar → 201 + immediate sync
PATCH  /api/external-calendars/:id          Update name/url/isActive
DELETE /api/external-calendars/:id          Remove calendar
POST   /api/external-calendars/:id/sync     Manual sync now
GET    /api/external-calendars/:id/status   Last sync info
POST   /api/external-calendars/test-url     Validate iCal URL before saving
```

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/calendar/
    page.tsx          ← Gantt chart (room × date grid, booking blocks)

  app/(dashboard)/dashboard/channels/
    page.tsx          ← External calendar management (iCal sync UI)

apps/api/src/routes/
  bookings.ts         ← GET /gantt endpoint
  externalCalendars.ts ← External calendar CRUD + test-url

apps/api/src/utils/
  ical-parser.ts      ← Pure iCal parser (no npm dependency)

apps/api/src/jobs/
  ical-sync.ts        ← Sync logic + cron (every 15 min)
```

---

## উন্নতির সুযোগ (Future)

- [ ] Month view toggle (currently only 30-day Gantt)
- [ ] Drag-to-create booking directly on calendar
- [ ] Drag-to-extend booking duration
- [ ] Color-code by room type (not just status)
- [ ] Export calendar as PDF/print
- [ ] OTA conflict notification via email/SMS to manager
- [ ] Auto-resolve conflict (cancel the direct booking and refund)
- [ ] Calendar export (publish our bookings as iCal for OTAs)

---

## Status

সব core feature ✅ live:
- Gantt calendar, 30-day view, booking blocks, cell-click to new booking
- External iCal sync, 15-min cron, conflict detection, manual sync
- Channel sync UI with test-URL validation — June 2026

### Bug fixes applied (June 2026)
1. ✅ Gantt API তে `isActive: true` যোগ — soft-deleted rooms calendar এ দেখাতো না এখন
2. ✅ External calendar POST `ok()` format fix — `{ data: cal }` → `reply.code(201).send(ok(cal))`
3. ✅ `CONFLICT` status `STATUS_CONFIG` তে যোগ — red color + Legend এ দেখায়
4. ✅ Currency `$` hardcoded সরানো — `formatCurrency()` ব্যবহার করা হচ্ছে
5. ✅ Navigation step 14→7 days (weekly step, 30-day window)
6. ✅ N+1 `importedCount` query → single `groupBy` aggregate
7. ✅ TENTATIVE iCal events skip — tentative holds room block করে না
8. ✅ Dead code: `tooltip` state + `BookingTooltip` GanttRow এ সরানো
9. ✅ Channels page rooms query `isActive: true` যোগ — inactive rooms modal এ দেখাতো

### Channel Sync UI bug fixes applied (June 2026)
10. ✅ `preselectedRoom` modal এ pass হচ্ছিল না — room header থেকে "Add Calendar" চাপলে room pre-select হতো না। Fixed: `AddCalendarModal` এ `preselectedRoom` prop যোগ, `roomId` state initialize `preselectedRoom?.id ?? ''`।
11. ✅ "Other" source name input disappears — `setName(customValue)` করলে `name !== 'Other'` হয়ে input হারিয়ে যেত। Fixed: separate `customName` state, `effectiveName = name === 'Other' ? customName : name`।
12. ✅ Sync failure তে card refresh হতো না — `qc.invalidateQueries` ছিল `try` block এ। Fixed: `finally` block এ move করা হয়েছে।
13. ✅ Room picker এ inactive rooms দেখাতো — `roomsApi.list({ limit: 200 })` → `roomsApi.list({ limit: 200, isActive: true })`।

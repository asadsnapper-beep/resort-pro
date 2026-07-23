# ResortPro — Housekeeping Module

## Overview

Room cleaning status track করা, housekeeping staff-কে task assign করা, এবং room readiness dashboard। Front desk জানবে কোন room clean, কোন room dirty, কোন room inspect করতে হবে।

---

## ১. Room Status System

```
প্রতিটা Room এর একটা Housekeeping Status থাকবে:

CLEAN       ✅  — Ready for check-in
DIRTY       🔴  — Guest checked out, cleaning needed
CLEANING    🟡  — Housekeeping currently cleaning
INSPECTING  🔵  — Supervisor inspecting
DO_NOT_DISTURB 🚫 — Guest DND flag
OUT_OF_ORDER   ⚠️  — Maintenance issue
```

---

## ২. Dashboard Views

### Housekeeping Dashboard `/dashboard/housekeeping`

```
┌─────────────────────────────────────────────────────┐
│  Housekeeping                    [Today: Jun 6]     │
│                                                      │
│  Summary: ✅12 Clean  🔴8 Dirty  🟡3 Cleaning  ⚠️1 OOO │
│                                                      │
│  [Floor Plan View]  [List View]  [Staff View]       │
│                                                      │
│  Filter: [All Floors ▾]  [All Status ▾]  [Assign ▾]│
└─────────────────────────────────────────────────────┘
```

### Floor Plan View
```
Floor 1:
  [101 ✅]  [102 🔴]  [103 🟡 Sara]  [104 🔴]
  [105 ✅]  [106 🔴]  [107 ✅]       [108 🚫 DND]

Floor 2:
  [201 ✅]  [202 🔴]  [203 ✅]  [204 ⚠️ OOO]
```

### Room Card (click করলে details)
```
┌─────────────────────┐
│  Room 102           │
│  🔴 Dirty           │
│  Checked out: 11am  │
│  Next check-in: 3pm │
│                     │
│  Assign to: [Sarah ▾]│
│  Priority: [High ▾] │
│                     │
│  [Assign Task]      │
└─────────────────────┘
```

---

## ৩. Staff Task System

### Housekeeping Task
```
Task created when room becomes Dirty:
  - Room number
  - Task type: CHECKOUT_CLEANING | STAYOVER | TURNDOWN | DEEP_CLEAN
  - Priority: HIGH (checkout today) | NORMAL | LOW
  - Assigned to: staff member
  - Estimated time: 30-45 min
  - Special notes: "Extra blankets needed"

Task flow:
  Created → Assigned → In Progress → Done → Inspected → Clean
```

### Staff Performance (optional)
```
Per staff member:
  - Rooms cleaned today: 8
  - Avg time per room: 32 min
  - Pending tasks: 2
```

---

## ৪. Notification Flow

```
Guest checks out
    ↓
Room status → DIRTY (auto)
    ↓
Housekeeping supervisor gets notification
    ↓
Supervisor assigns to staff
    ↓
Staff marks "In Progress" (from phone/tablet)
    ↓
Staff marks "Done"
    ↓
Supervisor inspects → marks "Clean"
    ↓
Front Desk gets notification: "Room 102 Ready ✅"
    ↓
Can now check-in next guest
```

---

## ৫. Database Schema

```prisma
enum HousekeepingStatus {
  CLEAN
  DIRTY
  CLEANING
  INSPECTING
  DO_NOT_DISTURB
  OUT_OF_ORDER
}

enum TaskType {
  CHECKOUT_CLEANING
  STAYOVER
  TURNDOWN
  DEEP_CLEAN
  INSPECTION
}

model HousekeepingTask {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id])

  type        TaskType
  status      String   @default("PENDING") // PENDING|ASSIGNED|IN_PROGRESS|DONE|INSPECTED
  priority    String   @default("NORMAL")  // HIGH|NORMAL|LOW
  assignedTo  String?  // staff user ID
  notes       String?

  startedAt   DateTime?
  completedAt DateTime?
  inspectedAt DateTime?
  inspectedBy String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Room model-এ field যোগ:
// housekeepingStatus HousekeepingStatus @default(CLEAN)
// lastCleanedAt      DateTime?
```

---

## ৬. API Endpoints

```
// Dashboard
GET    /api/tenant/housekeeping/rooms      → all rooms with HK status
GET    /api/tenant/housekeeping/tasks      → task list (filter by status/staff)
POST   /api/tenant/housekeeping/tasks      → create task
PATCH  /api/tenant/housekeeping/tasks/:id  → update status / reassign
DELETE /api/tenant/housekeeping/tasks/:id  → cancel task

PATCH  /api/tenant/rooms/:id/status        → update room HK status
                                             (checkout triggers DIRTY auto)
```

---

## ৭. Integration Points

```
Booking checkout:
  → Room status auto → DIRTY
  → HousekeepingTask auto-created (HIGH priority if next booking same day)

Booking check-in:
  → Room must be CLEAN (API validates before confirm)
  → If DIRTY → front desk warning

DND:
  → Guest can set from room (future: in-room tablet/QR)
  → Staff cannot enter until DND removed
```

---

## ৮. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ HousekeepingTask model
  ✦ Room.housekeepingStatus field
  ✦ Auto-task trigger on checkout

Step 2 — API (2 days)
  ✦ Room status endpoints
  ✦ Task CRUD + assign
  ✦ Auto-create task on booking checkout

Step 3 — Dashboard UI (2.5 days)
  ✦ /dashboard/housekeeping page
  ✦ Floor plan view (grid of room status cards)
  ✦ Task list + assign modal
  ✦ Real-time status update (polling or WebSocket)

Total: ~5 days
```

---

## Extras (Lost & Found, Minibar, Laundry) — see [housekeeping-extras.md](./housekeeping-extras.md)

Three more tabs on `/dashboard/housekeeping` beyond the Tasks tab documented above:
Lost & Found tracking, a minibar price list + per-room consumption log, and laundry
orders — both minibar and laundry can push charges straight to a guest's bill via
the existing `InvoiceExtra` mechanism (`POST /api/bookings/:id/invoice/extras`).

## Bug Fixes Applied (June 2026)

### 1. ✅ DAILY/TURNDOWN task complete করলে room AVAILABLE হয়ে যেত
**Problem:** `PATCH /:id/status` always did `room.update({ status: 'AVAILABLE' })` on COMPLETED — even DAILY and TURNDOWN tasks, which happen while the guest is still in the room. Guest in room 201 doing TURNDOWN → room suddenly AVAILABLE → front desk could book it!  
**Fix:** Only CHECKOUT, DEEP_CLEAN, CHECKIN tasks update room status:
- `IN_PROGRESS` → room: `CLEANING`
- `COMPLETED` → room: `AVAILABLE`
- DAILY, TURNDOWN → no room status change

### 2. ✅ Stats cards showed current page counts only
**Problem:** `pendingCount` etc. came from `allTasks` (current page, max 20 items). Real totals were wrong.  
**Fix:** Added `GET /api/housekeeping/stats` endpoint with `count()` per status. Frontend uses a separate query for accurate totals.

### 3. ✅ Search was client-side (current page only)
**Problem:** Searching room number only scanned the 20 items in the current page.  
**Fix:** `search` param passed to API → Prisma `OR` filter on room.number, room.name, staff firstName/lastName.

### 4. ✅ search/date filter didn't reset page
**Problem:** Applying a new filter while on page 3 left page at 3, showing wrong/empty results.  
**Fix:** Both `setSearch` and `setDateFilter` now call `setPage(1)`.

### 5. ✅ NewTaskModal form didn't reset on close/reopen
**Problem:** Half-filled form data persisted between modal opens.  
**Fix:** `useEffect(() => { if (open) setForm(blankForm); }, [open])`.

### 6. ✅ Room list included inactive rooms
**Problem:** `roomsApi.list({ limit: 100 })` returned all rooms including deactivated ones.  
**Fix:** `roomsApi.list({ limit: 200, isActive: true })`.

### 7. ✅ `assignedToId: undefined as unknown as string` hacky cast
**Problem:** Type-unsafe cast when no staff selected.  
**Fix:** Explicit payload object with `assignedToId: form.assignedToId || undefined`.

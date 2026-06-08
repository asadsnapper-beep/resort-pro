# ResortPro — Maintenance & Room Issues Module

## Overview

Room বা property-র maintenance issue track করা। Staff issue report করবে, supervisor assign করবে, resolved হলে close করবে। Room out-of-order থাকলে booking আটকানো।

---

## ১. Maintenance Request Flow

```
Issue Report হওয়ার উপায়:
  1. Staff app/dashboard থেকে
  2. Guest QR code scan করে (room-এ থাকা QR)
  3. Front desk manually enter করে

Flow:
  Reported → Assigned → In Progress → Resolved → Verified & Closed
```

---

## ২. Dashboard `/dashboard/maintenance`

```
┌──────────────────────────────────────────────────────┐
│  Maintenance                            [+ New Issue]│
│                                                      │
│  🔴 Open: 5   🟡 In Progress: 3   ✅ Resolved: 12   │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🔴 HIGH   Room 204 — AC not cooling            │ │
│  │ Reported: Jun 6 10:30am by Housekeeping        │ │
│  │ Assigned: [Rahim - Technician ▾]              │ │
│  │ [Start] [View Details] [Mark OOO]             │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🟡 MEDIUM Room 101 — Door lock malfunction     │ │
│  │ In Progress — Assigned to Karim                │ │
│  │ Started: 11:45am | ETA: 1:00pm                │ │
│  │ [View Details] [Mark Resolved]                │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### New Issue Form
```
Location:     [Room ▾]  Room: [204 ▾]
Category:     [AC/Heating ▾]  (Plumbing/Electric/Furniture/etc.)
Title:        [ AC not cooling properly              ]
Description:  [ Guest complained room is very hot... ]
Priority:     ○ LOW  ● MEDIUM  ○ HIGH  ○ URGENT
Photos:       [+ Upload]
Mark Room OOO while repairing: [✓]
```

---

## ৩. Database Schema

```prisma
model MaintenanceRequest {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  roomId      String?
  room        Room?    @relation(fields: [roomId], references: [id])

  title       String
  description String?
  category    String   // AC | PLUMBING | ELECTRIC | FURNITURE | OTHER
  priority    String   // LOW | MEDIUM | HIGH | URGENT
  status      String   @default("OPEN")  // OPEN|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED

  reportedBy  String?  // user ID
  assignedTo  String?  // user ID
  photos      String[] // image URLs

  markRoomOoo Boolean  @default(false)
  startedAt   DateTime?
  resolvedAt  DateTime?
  resolution  String?  // what was done

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## ৪. API Endpoints

```
GET    /api/tenant/maintenance             → list (filter by status/priority/room)
POST   /api/tenant/maintenance             → create issue
PATCH  /api/tenant/maintenance/:id         → update (assign, status change)
DELETE /api/tenant/maintenance/:id         → delete

// When markRoomOoo = true → Room.housekeepingStatus = OUT_OF_ORDER
// When resolved → Room.housekeepingStatus restore
```

---

## ৫. Integration

```
OOO Room:
  → Booking availability API skips OOO rooms
  → Front desk room map shows ⚠️ OOO
  → Housekeeping dashboard shows OOO

Notifications:
  → HIGH/URGENT issue → immediate notification to manager
  → Issue resolved → front desk notified (room ready)
```

---

## ৬. Implementation Steps

```
Step 1 — Database + API (1.5 days)
  ✦ MaintenanceRequest model
  ✦ CRUD endpoints
  ✦ OOO auto-toggle on Room

Step 2 — Dashboard UI (1.5 days)
  ✦ /dashboard/maintenance page
  ✦ Issue list + create/edit modal
  ✦ Assign + status update

Total: ~3 days
```

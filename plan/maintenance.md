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

---

## Bug Fixes Applied (June 2026)

### 1. ✅ `ok(reply, data)` × 5 — সব API response broken (CRITICAL)
**Problem:** `maintenance.ts`-এর সব `ok()` call ভুল ছিল: `ok(reply, tickets)`, `ok(reply, { open... })`, `ok(reply, ticket)`, `ok(reply, { deleted: true })`. `ok(data, message?)` এর signature অনুযায়ী `reply` object টাকে `data` হিসেবে পাঠানো হচ্ছিল — Fastify reply object JSON-serialize করলে circular reference error বা গার্বেজ data।  
**Fix:** সব `ok(reply, x)` → `ok(x)` করা হয়েছে।

### 2. ✅ Priority sort উল্টো — URGENT সবার শেষে দেখাত
**Problem:** `orderBy: [{ priority: 'asc' }, ...]` — Prisma alphabetical sort করে: HIGH → LOW → NORMAL → **URGENT**। Comment এ "URGENT first" লেখা কিন্তু URGENT সবার শেষে!  
**Fix:** `orderBy: { createdAt: 'desc' }` রাখা হয়েছে, তারপর application code এ `PRIORITY_RANK = { URGENT:0, HIGH:1, NORMAL:2, LOW:3 }` দিয়ে sort করা হয়।

### 3. ✅ `PATCH /:id` দিয়ে RESOLVED করলে `resolvedAt` set হত না
**Problem:** `PATCH /:id` এ `status: 'RESOLVED'` পাঠালে ticket resolved হত কিন্তু `resolvedAt: null` থাকত — summary-র "Resolved Today" count-এ ধরা পড়ত না।  
**Fix:** `body.status === 'RESOLVED'` হলে `resolvedAt: new Date()` set হয়; also `restoreRoomIfClear` call করা হয়।

### 4. ✅ `restoreRoomIfClear` — guest থাকলেও room `AVAILABLE` হয়ে যেত
**Problem:** সব maintenance ticket resolve হলে room সবসময় `AVAILABLE` হত — কিন্তু যদি কোনো guest তখনও `CHECKED_IN` থাকে, room `AVAILABLE` দেখানো হলে front desk দ্বিতীয় booking করতে পারত!  
**Fix:** Room restore করার আগে active `CHECKED_IN` booking check করা হয়:
- Active booking আছে → `OCCUPIED`
- কোনো active booking নেই → `AVAILABLE`

### 5. ✅ `CreateTicketModal` — Rooms dropdown সবসময় empty ছিল
**Problem:** `select: r => (r.data.data?.rooms ?? r.data.data ?? [])` — `r.data.data` is `{ data: [...], pagination: {...} }` (paginated format), not `{ rooms: [...] }`. তাই `rooms` undefined, `??` fallback হিসেবে pagination object পেত — `.map()` crash।  
**Fix:** `select: r => (r.data.data?.data ?? [])` — paginated array সরাসরি access। `isActive: true` filter যোগ।

### 6. ✅ `CreateTicketModal` — Staff dropdown সবসময় empty ছিল
**Problem:** Same issue — `r.data.data?.staff` → undefined।  
**Fix:** `select: r => (r.data.data?.data ?? [])`.

### 7. ✅ `userId` → `sub` in `JwtPayload`
**Problem:** `const { tenantId, userId } = request.user as JwtPayload` — `JwtPayload`-এ `userId` field নেই, আছে `sub`।  
**Fix:** `const { tenantId, sub: userId } = request.user as JwtPayload`.

### 8. ✅ Status change এ summary invalidate হত না
**Problem:** `TicketCard`-এর "Start Work" button click করলে (`OPEN → IN_PROGRESS`) শুধু `['maintenance']` invalidate হত, `['maintenance-summary']` নয়। Summary এর "Open"/"In Progress" count 60 সেকেন্ড পর্যন্ত পুরনো থাকত।  
**Fix:** `onSuccess` এ `['maintenance-summary']` ও invalidate করা হয়।

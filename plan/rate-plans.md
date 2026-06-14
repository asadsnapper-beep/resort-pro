# Rate Plans System — ResortPro

> Dynamic pricing engine — Season, Weekend, Promo, Early Bird, Last Minute rates।

---

## Overview

Rate Plans হলো hotel এর dynamic pricing system। একটা room এর base price এর উপর বিভিন্ন rule apply করে automatically সঠিক price দেখায়। Booking তৈরির সময় সিস্টেম সব active plan check করে সবচেয়ে উপযুক্তটা বাছাই করে।

---

## Rate Plan Types (Priority Order)

| Type | Priority | কখন apply | Description |
|------|----------|-----------|-------------|
| `PROMO` | **6** (highest) | যেকোনো সময় | Special sale — সব কিছু override করে |
| `SEASONAL` | 5 | নির্দিষ্ট date range | Peak season, off-season pricing |
| `WEEKEND` | 4 | নির্দিষ্ট weekdays | Fri/Sat/Sun higher rates |
| `EARLY_BIRD` | 3 | নির্দিষ্ট date range + min nights | আগে book করলে discount |
| `LAST_MINUTE` | 2 | নির্দিষ্ট date range | Room fill করতে শেষ মুহূর্তে discount |
| `STANDARD` | 1 (lowest) | সবসময় | Default fallback rate |

**Tie-breaker:** Same type এর মধ্যে room-specific plan beats global (All Rooms) plan।

---

## Rate Resolution Logic

```
resolveRate(tenantId, roomId, checkIn, checkOut):
  1. সব active plans load করো (room-specific + global)
  2. Filter করো:
     - minNights check — stay length >= plan.minNights
     - date range — checkIn plan.startDate থেকে plan.endDate এর মধ্যে
     - daysOfWeek — checkIn day plan এর allowed days এ আছে কিনা
  3. Sort: type priority (desc) → room-specific first
  4. Best plan return করো
  5. কোনো plan না পেলে → null (caller room.basePrice ব্যবহার করে)
```

---

## Features

### ১. Rate Plans List
- সব plans table view — type badge, name, room, date range, days, min nights, price
- Inactive plans dim হয়ে দেখায়
- Priority legend at top
- Stats: Total / Active / Types used / Rooms covered

### ২. Create / Edit Modal
- **Type selector** — 6 type এর grid (single click)
- **Conditional fields:**
  - SEASONAL/PROMO/EARLY_BIRD/LAST_MINUTE → date range (start + end)
  - WEEKEND → days-of-week picker (auto-defaults: Fri + Sat + Sun)
- **Room** — All Rooms বা specific room (optional)
- **Min Nights** — minimum stay requirement
- **Active toggle** — inactive plans apply হয় না

### ৩. Toggle Active/Inactive
- প্রতিটা plan এ toggle button — instantly activate/deactivate

### ৪. Delete Plan
- Confirmation dialog → hard delete

---

## API Endpoints

```
GET    /api/rate-plans                        List all plans (with room info)
POST   /api/rate-plans                        Create plan (OWNER/MANAGER)
PATCH  /api/rate-plans/:id                    Update plan (OWNER/MANAGER)
DELETE /api/rate-plans/:id                    Delete plan (OWNER/MANAGER)
GET    /api/rate-plans/resolve?roomId=&checkIn=&checkOut=   Resolve best price
```

### `GET /api/rate-plans/resolve` response
```json
{
  "roomId": "...",
  "basePrice": 5000,
  "resolved": { "price": 3500, "planName": "Summer Sale", "planType": "PROMO" },
  "effectivePrice": 3500
}
```
`resolved` = null হলে base price ব্যবহার করো।

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/rate-plans/
    page.tsx          ← List + PlanModal (create/edit)

apps/api/src/routes/
  ratePlans.ts        ← CRUD + resolveRate() exported function

packages/database/prisma/
  schema.prisma       ← RatePlan model
```

---

## Prisma Model

```prisma
model RatePlan {
  id          String        @id @default(uuid())
  tenantId    String
  roomId      String?       // null = applies to all rooms
  name        String
  type        RatePlanType  // STANDARD | SEASONAL | WEEKEND | PROMO | EARLY_BIRD | LAST_MINUTE
  price       Decimal       @db.Decimal(10, 2)
  startDate   DateTime?
  endDate     DateTime?
  daysOfWeek  Int[]         // [0=Sun, 1=Mon, ..., 6=Sat]
  minNights   Int           @default(1)
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  room        Room?         @relation(fields: [roomId], references: [id])
}
```

---

## Data Flow

```
New Booking:
  POST /api/bookings
    → resolveRate(tenantId, roomId, checkIn, checkOut)
    → effectivePrice found → totalAmount calculated
    → plan info stored with booking

Walk-In:
  POST /api/bookings/walk-in
    → same resolveRate flow
```

---

## উন্নতির সুযোগ (Future)

- [ ] Rate plan preview — নির্দিষ্ট date range এ কোন room এ কোন rate apply হবে calendar view
- [ ] Bulk rate update — সব STANDARD plan এ ৫% বাড়াও
- [ ] Rate plan copy — existing plan duplicate করে edit
- [ ] Override warning — যদি দুটো plan একই room+date এ conflict করে
- [ ] Revenue forecast — upcoming bookings এ rate impact দেখানো

---

## Status

সব core feature ✅ live:
- 6 rate types, priority resolution, room-specific vs global, min nights, date range, days-of-week
- Full CRUD, active/inactive toggle — June 2026

### Bug fixes applied (June 2026)
1. ✅ `ok(reply, data)` → `ok(data)` — GET list, PATCH, GET /resolve সব response fix
2. ✅ WEEKEND type auto-defaults to Fri+Sat+Sun when selected
3. ✅ Date range validation — endDate < startDate হলে form error দেখায়

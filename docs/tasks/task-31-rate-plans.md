# Task 31 — Rate Plans & Seasonal Pricing

**Branch:** `feature/rate-plans`
**Priority:** 🟡 Important
**Estimate:** 1 day

---

## Goal
Multiple price plans per room — Standard, Weekend, Peak Season, Early Bird, Last-minute। Dynamic pricing without manual changes।

---

## Prisma

```prisma
enum RatePlanType { STANDARD SEASONAL WEEKEND PROMO EARLY_BIRD LAST_MINUTE }

model RatePlan {
  id          String       @id @default(cuid())
  tenantId    String
  roomId      String?      // null = all rooms
  name        String
  type        RatePlanType @default(STANDARD)
  price       Float
  startDate   DateTime?
  endDate     DateTime?
  daysOfWeek  Int[]        // 0=Sun, 6=Sat (for weekend rates)
  minNights   Int          @default(1)
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())

  room        Room?        @relation(fields: [roomId], references: [id])
  tenant      Tenant       @relation(fields: [tenantId], references: [id])

  @@map("rate_plans")
}
```

---

## Steps

### Step 1 — API
- `GET /api/rate-plans` — list all active plans (with room name)
- `POST /api/rate-plans` — create plan
- `PATCH /api/rate-plans/:id` — edit
- `DELETE /api/rate-plans/:id` — deactivate

**Rate resolution logic** (util function `resolveRate(roomId, checkIn, checkOut)`):
Priority: PROMO > SEASONAL > WEEKEND > STANDARD

### Step 2 — UI page
`/dashboard/rate-plans`

- Table of current plans: name, type badge, room (or "All Rooms"), price, date range, status toggle
- Add Plan modal: name, type, room selector, price, date range (optional), min nights, days of week (for weekend)
- Edit / delete per row

### Step 3 — Booking integration
When creating a booking → show applicable rate plan + price. Allow override.

### Step 4 — Public website
Booking form: auto-fetch rate for selected room + dates via `GET /site/:slug/rate?roomId=&checkIn=&checkOut=`

---

## Acceptance Criteria
- [ ] Rate plans CRUD works
- [ ] Priority resolution correct (promo > seasonal > weekend > standard)
- [ ] Booking form shows correct rate for date range
- [ ] Public booking form uses rate plans
- [ ] Toggle active/inactive per plan

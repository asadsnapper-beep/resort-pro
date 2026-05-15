# Task 37 — Group Booking

**Branch:** `feature/group-booking`
**Priority:** 🟢 Nice to Have
**Estimate:** 1.5 days

---

## Goal
Wedding, conference, tour group — multiple rooms একসাথে, single booking reference + invoice।

---

## Prisma

```prisma
model GroupBooking {
  id            String    @id @default(cuid())
  tenantId      String
  groupName     String
  contactName   String
  contactPhone  String
  contactEmail  String?
  checkIn       DateTime
  checkOut      DateTime
  discount      Float     @default(0)  // % discount
  notes         String?
  status        String    @default("confirmed")
  bookings      Booking[] @relation("GroupBookings")
  createdAt     DateTime  @default(now())
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  @@map("group_bookings")
}

model Booking {
  groupBookingId String?
  groupBooking   GroupBooking? @relation("GroupBookings", fields: [groupBookingId], references: [id])
}
```

---

## API
- `GET/POST /api/group-bookings`
- `GET /api/group-bookings/:id` — with all room bookings
- `POST /api/group-bookings/:id/invoice` — combined invoice for all rooms

## UI
- `/dashboard/group-bookings` — list of groups
- Create group booking: group name, contact, dates, select multiple rooms, group discount %
- Group detail: room allocation table, combined invoice

## Acceptance Criteria
- [ ] Multiple rooms under one group reference
- [ ] Group discount applies to all rooms
- [ ] Single combined invoice
- [ ] Check-in/out per room still works individually

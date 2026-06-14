# Booking System — ResortPro

> সম্পূর্ণ booking workflow এর technical reference। কী আছে, কীভাবে কাজ করে, এবং কোথায় code আছে।

---

## Overview

ResortPro এর booking system hotel এর পুরো reservation lifecycle manage করে — guest এর প্রথম booking থেকে শুরু করে final check-out পর্যন্ত।

---

## Features

### ১. Booking List Page (`/dashboard/bookings`)
- **Stats bar** — Today's Arrivals, Today's Departures, Active Bookings, Month Revenue
- **Status filter** — All / Pending / Confirmed / Checked In / Checked Out / Cancelled
- **Server-side search** — guest name, email, confirmation number (debounced 350ms)
- **Date range filter** — Today / Tomorrow / This Week / This Month shortcuts + custom date picker
- **Walk-in badge** — bookings created via Walk-in Modal আলাদা করে চেনা যায়
- **Pagination** — 20 per page

### ২. New Booking Modal (4-step wizard)
| Step | কী করে |
|------|---------|
| 1 — Dates | Check-in, check-out, adults, children |
| 2 — Room | Available rooms দেখায় (date conflict check করে), price/night + estimated total |
| 3 — Guest | Existing guest search + **New Guest quick-create** (modal ভেতরে) |
| 4 — Confirm | Full summary, rate plan badge (যদি applicable), special requests |

- Rate plan auto-resolve: `GET /api/rate-plans/resolve?roomId=&checkIn=&checkOut=`
- Guest না থাকলে Step 3 থেকেই নতুন guest তৈরি করা যায়

### ৩. Walk-in Modal
- Single form — guest info + room selection + dates একসাথে
- `autoCheckIn` toggle — তৈরির সাথে সাথে check-in করে দেয়
- Payment method: Cash / Card / Pending
- `skipEmail` — confirmation email skip করার option
- Source: `WALK_IN` হিসেবে mark হয়

### ৪. Booking Detail Sheet (Right sidebar)
**Status timeline:** Booked → Confirmed → Checked In → Checked Out

**Sections:**
- Guest info (name, email, phone) + **profile link** → `/dashboard/guests?id=`
- Stay details (check-in/out dates, nights, guests, room)
- Actual check-in/out timestamps (checked-in হলে দেখায়)
- Payment section:
  - Total / Paid / Outstanding
  - Progress bar (%)
  - Payment history list
  - Record Payment inline form (amount + method)
  - Send Payment Link (generates Stripe/payment gateway link)
- Packages section — add/remove packages inline
- Special Requests (amber box)

**Action footer:**
| Booking Status | Available Actions |
|---------------|-------------------|
| PENDING / CONFIRMED | Check In, Cancel Booking |
| CHECKED_IN | Check Out, Cancel Booking |
| CHECKED_OUT | View Invoice |

### ৫. Check-in Confirmation Modal
- Guest, room, stay, guests count দেখায়
- **Date mismatch warning:**
  - Early check-in (blue) — আজকের আগের তারিখ
  - Late check-in (orange) — scheduled date পেরিয়ে গেছে
- Outstanding balance warning (amber)

### ৬. Check-out Confirmation Modal
- Stay summary + balance due
- Fully paid → "✓ Fully Paid" (green)
- Balance due → red warning "Collect payment before checking out"

---

## Booking Statuses

| Status | মানে |
|--------|------|
| `PENDING` | তৈরি হয়েছে, confirm হয়নি |
| `CONFIRMED` | Confirmed, guest আসেনি |
| `CHECKED_IN` | Guest room এ আছে |
| `CHECKED_OUT` | Guest চলে গেছে |
| `CANCELLED` | বাতিল |
| `NO_SHOW` | Guest আসেনি, booking expired |

## Payment Statuses

| Status | মানে |
|--------|------|
| `UNPAID` | কোনো payment নেই |
| `PARTIAL` | কিছু paid, বাকি আছে |
| `PAID` | সম্পূর্ণ পরিশোধ |
| `REFUNDED` | Refund দেওয়া হয়েছে |

---

## API Endpoints

```
GET    /api/bookings                          List (filter: status, search, dateFrom, dateTo, page, limit)
POST   /api/bookings                          Create booking
GET    /api/bookings/:id                      Get single booking
PATCH  /api/bookings/:id                      Update booking
DELETE /api/bookings/:id                      Cancel booking

POST   /api/bookings/:id/check-in             Check in guest
POST   /api/bookings/:id/check-out            Check out guest

POST   /api/bookings/:id/payments             Record payment
POST   /api/bookings/:id/payment-link         Generate payment link (Stripe)

GET    /api/bookings/calendar?month=&year=    Calendar view
GET    /api/bookings/gantt?from=&to=          Gantt/room-grid view

GET    /api/bookings/:id/packages             List applied packages
POST   /api/bookings/:id/packages             Apply package
DELETE /api/bookings/:id/packages/:packageId  Remove package

GET    /api/bookings/:id/invoice              Get/create invoice
```

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/bookings/
    page.tsx                  ← Booking list, filters, stats bar
    [id]/
      invoice/page.tsx        ← Invoice view

  components/bookings/
    BookingDetailSheet.tsx    ← Right-slide detail panel
    NewBookingModal.tsx       ← 4-step booking wizard
    WalkInModal.tsx           ← Walk-in quick booking

  hooks/
    use-debounce.ts           ← Search debounce hook

apps/api/src/routes/
  bookings.ts                 ← All booking API routes (~1000 lines)

packages/database/prisma/
  schema.prisma               ← Booking, Payment models
```

---

## Data Flow

```
New Booking:
User → NewBookingModal → POST /api/bookings → Prisma create → Email sent

Check-in:
Staff → BookingDetailSheet → POST /api/bookings/:id/check-in
  → status: CHECKED_IN, actualCheckIn: now, room: OCCUPIED
  → Housekeeping task auto-created for checkout day

Check-out:
Staff → BookingDetailSheet → POST /api/bookings/:id/check-out
  → status: CHECKED_OUT, actualCheckOut: now, room: DIRTY
  → Housekeeping task: CLEAN room
  → Invoice auto-generated

Walk-in:
Staff → WalkInModal → POST /api/bookings (source: WALK_IN)
  → Guest auto-created if new
  → Optional: immediate check-in
```

---

## Prisma Models

```prisma
model Booking {
  id              String   @id @default(uuid())
  tenantId        String
  guestId         String
  roomId          String
  confirmationNo  String   @unique
  status          String   // PENDING | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW
  paymentStatus   String   // UNPAID | PARTIAL | PAID | REFUNDED
  source          String?  // DIRECT | WALK_IN | OTA | WEBSITE
  checkIn         DateTime
  checkOut        DateTime
  actualCheckIn   DateTime?
  actualCheckOut  DateTime?
  adults          Int
  children        Int
  totalAmount     Decimal
  paidAmount      Decimal
  specialRequests String?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  guest    Guest     @relation(...)
  room     Room      @relation(...)
  payments Payment[]
  packages BookingPackage[]
  invoice  Invoice?
}
```

---

## উন্নতির সুযোগ (Future)

- [ ] Calendar / Gantt view integrate করা dashboard booking page এ
- [ ] Bulk check-in (group bookings)
- [ ] Booking modification (dates/room change with price diff)
- [ ] OTA sync (Booking.com, Airbnb) — channel manager
- [ ] Automated pre-arrival email (T-1 day reminder)
- [ ] Mobile check-in QR code for guests

---

## Status

সব core feature ✅ live:
- Booking list, new booking, walk-in, check-in/out, payment, packages, invoice
- Date range filter, server-side search, date mismatch warning (June 2026)

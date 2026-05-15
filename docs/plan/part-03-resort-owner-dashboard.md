# Part 03 — Resort Owner Dashboard

## Overview
Resort owner এবং staff-দের জন্য complete management dashboard। `/dashboard` route-এ accessible।

---

## Dashboard Modules

### 1. Main Dashboard (`/dashboard`)
- Revenue summary (today, this week, this month)
- Occupancy rate
- Upcoming check-ins / check-outs
- Recent bookings
- Quick stats: total rooms, active bookings, guests

**API:** `GET /api/dashboard`, `GET /api/dashboard/revenue`, `GET /api/dashboard/occupancy`

---

### 2. Room Management (`/dashboard/rooms`)
- Room list with status (available, occupied, maintenance, cleaning)
- Add / edit / delete rooms
- Room types: STANDARD, DELUXE, SUITE, VILLA, COTTAGE, BUNGALOW
- Per-room: number, name, floor, amenities, max occupancy, base price, images
- Bulk status update
- Real-time availability check

**API:** `GET/POST /api/rooms`, `PATCH /api/rooms/:id`, `PATCH /api/rooms/:id/status`

---

### 3. Booking Management (`/dashboard/bookings`)
- Booking list with filters (status, date range, room)
- Create new booking
- Booking detail sheet (slide-in panel)
  - Check-in / Check-out actions
  - Add payment (cash/card/bank transfer/Stripe)
  - Send payment link to guest (Stripe Checkout)
  - Cancel booking
- Booking calendar view
- Confirmation number auto-generated

**API:** `GET/POST /api/bookings`, `PATCH /api/bookings/:id/check-in`, `PATCH /api/bookings/:id/check-out`, `POST /api/bookings/:id/payment`, `POST /api/bookings/:id/payment-link`

---

### 4. Guest Management / CRM (`/dashboard/guests`, `/dashboard/crm`)
- Guest profiles (name, email, phone, nationality, ID)
- Stay history
- Total stays count
- Loyalty tracking
- Birthday field for automated birthday emails
- Email sequence enrollment

**API:** `GET/POST/PATCH /api/guests`, `GET/POST /api/crm`

---

### 5. Staff Management (`/dashboard/staff`)
- Staff list with roles (OWNER, MANAGER, STAFF)
- Invite staff via email
- Activate / deactivate staff accounts
- Department assignment

**API:** `GET/POST/PATCH /api/staff`

---

### 6. Housekeeping (`/dashboard/housekeeping`)
- Task list (PENDING, IN_PROGRESS, COMPLETED, SKIPPED)
- Task types: DAILY, DEEP_CLEAN, TURNDOWN, CHECKOUT, CHECKIN
- Assign tasks to housekeeping staff
- Update task status

**API:** `GET/POST /api/housekeeping`, `PATCH /api/housekeeping/:id/status`

---

### 7. Restaurant / Food Orders (`/dashboard/restaurant`, `/dashboard/orders`)
- Menu management (categories, items, price, availability)
- Food order tracking (PENDING → PREPARING → READY → DELIVERED)
- Menu categories: BREAKFAST, LUNCH, DINNER, APPETIZER, DESSERT, BEVERAGE, SPECIAL

**API:** `GET/POST/PATCH /api/menu`, `GET/POST /api/food-orders`, `PATCH /api/food-orders/:id/status`

---

### 8. Inventory Management (`/dashboard/inventory`)
- Stock tracking with categories (LINEN, TOILETRIES, CLEANING, FOOD_BEVERAGE, etc.)
- Movement log (IN, OUT, ADJUSTMENT)
- Low stock alerts
- Unit cost tracking

**API:** `GET/POST/PATCH /api/inventory`, `POST /api/inventory/:id/movement`

---

### 9. Support Tickets (`/dashboard/support`)
- Guest ticket system (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- Categories: MAINTENANCE, HOUSEKEEPING, FOOD_BEVERAGE, BILLING, COMPLAINT, REQUEST
- Priority levels: LOW, MEDIUM, HIGH, URGENT
- Staff assignment
- Live chat per ticket (WebSocket)
- Message history

**API:** `GET/POST /api/tickets`, `PATCH /api/tickets/:id/status`, `POST /api/tickets/:id/messages`

---

### 10. Website Builder (`/dashboard/website`)
- Resort public website customization
- Hero title, subtitle, description
- Logo, cover image
- Color scheme
- Amenities list
- Room showcase
- Booking form integration

**API:** `GET/PUT /api/website`

---

### 11. Billing & Subscription (`/dashboard/billing`)
- Current plan display (STARTER / PROFESSIONAL / ENTERPRISE)
- Trial days remaining
- Stripe Customer Portal link
- Invoice history
- Upgrade flow → Stripe Checkout

**API:** `GET /api/billing/status`, `POST /api/billing/checkout`, `POST /api/billing/portal`

---

### 12. Settings (`/dashboard/settings`)
- Resort profile (name, email, phone, address, currency)
- Timezone settings
- Notification preferences

**API:** `GET/PATCH /api/tenant`

---

## Layout & Navigation

### Sidebar (`apps/web/src/components/dashboard/sidebar.tsx`)
Navigation links সহ resort name + logo display।

### Top Nav (`apps/web/src/components/dashboard/top-nav.tsx`)
- Search bar
- Notification bell (real-time unread count)
- Dark/light mode toggle
- **Trial warning banner** — trial শেষ হওয়ার ৭ দিন আগে থেকে দেখায়

### Auth Guard (`apps/web/src/app/(dashboard)/layout.tsx`)
- Login check
- **Subscription status check** — `billingApi.getStatus()` call করে
  - Trial expired → `/dashboard/upgrade`
  - Account suspended → `/dashboard/suspended`
  - Subscription canceled/past_due → `/dashboard/upgrade`

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/web/src/app/(dashboard)/layout.tsx` | Auth + subscription enforcement |
| `apps/web/src/components/dashboard/sidebar.tsx` | Navigation sidebar |
| `apps/web/src/components/dashboard/top-nav.tsx` | Top bar + trial banner |
| `apps/api/src/routes/` | সব API routes |

---

## Phase 6 — Operations (T-28 to T-39)

> Resort owner হিসেবে daily operation-এ যা লাগে। এই features ছাড়া product "incomplete" feel করে।

---

### 🔴 Critical Modules (T-28 / T-29 / T-30)

---

### T-28 — Visual Booking Calendar (`/dashboard/calendar`)

**কী:** Room × Date Gantt grid। প্রতিটা row = একটা room, প্রতিটা column = একটা দিন। Booking দেখায় color-coded block হিসেবে।

**Features:**
- 30-day sliding window (← → navigation)
- Booking block: guest name, nights, status color
  - `confirmed` → indigo, `checked_in` → green, `checked_out` → gray, `cancelled` → red/strikethrough
- Click on booking block → booking detail sheet
- Click on empty cell → new booking pre-filled (room + date)
- Room status indicator (maintenance → orange lock icon)
- Today column highlighted
- Mobile: horizontal scroll

**API:** `GET /api/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns rooms with their bookings in the date range

**Key Files:**
- `apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx`
- `apps/api/src/routes/bookings.ts` → new `/calendar` endpoint

---

### T-29 — Check-in / Check-out Flow

**কী:** Booking status lifecycle — `confirmed → checked_in → checked_out`। Real check-in/out action with proper UI flow।

**Check-in Flow:**
- Booking detail-এ "Check In" button (visible when status = confirmed, check-in date = today/past)
- Confirm modal: guest name, room number, ID verification note
- On confirm: status → `checked_in`, `actualCheckIn` timestamp set, room status → `OCCUPIED`
- Housekeeping task auto-created for checkout day

**Check-out Flow:**
- "Check Out" button (visible when status = checked_in)
- Shows: total nights, room charges, restaurant charges, extras total
- Confirm → status → `checked_out`, `actualCheckOut` set, room → `CLEANING`
- Invoice auto-generated (T-30)
- Housekeeping checkout task triggered

**Prisma changes:**
```prisma
model Booking {
  actualCheckIn   DateTime?
  actualCheckOut  DateTime?
  // status already exists — add checked_in, checked_out to enum
}
```

**API:**
- `PATCH /api/bookings/:id/check-in` (already exists — enhance with room status update)
- `PATCH /api/bookings/:id/check-out` (already exists — enhance with invoice trigger)

---

### T-30 — Guest Invoice / Folio

**কী:** Guest-এর সব charges এক জায়গায় — room rent + restaurant orders + extras = itemized printable bill।

**Features:**
- Auto-generate on checkout
- Line items: room × nights × rate, food orders (linked by room/booking), extras (manual add)
- Subtotal → tax (configurable rate per tenant) → total
- Payment status: paid / partial / unpaid
- Print button → browser print (styled invoice)
- Email to guest button (Resend)
- PDF download (html-to-pdf or print-to-PDF)

**Invoice fields:**
- Invoice number (auto: `INV-{year}-{seq}`)
- Resort name + logo + address
- Guest name + booking ref
- Check-in / check-out dates
- Line items table
- Tax breakdown
- Total + amount paid + balance due

**API:**
- `GET /api/bookings/:id/invoice` — compute invoice
- `POST /api/bookings/:id/invoice/send-email` — email to guest
- `PATCH /api/bookings/:id/invoice/extras` — add manual charge

**Prisma:**
```prisma
model InvoiceExtra {
  id          String   @id @default(cuid())
  bookingId   String
  description String
  amount      Float
  booking     Booking  @relation(fields: [bookingId], references: [id])
}
```

---

### 🟡 Important Modules (T-31 to T-35)

---

### T-31 — Rate Plans & Seasonal Pricing

**কী:** একটা room-এর multiple price plans — Standard, Weekend, Peak Season, Early Bird, Last-minute।

**Features:**
- Rate plan list per room (or per room type)
- Plan fields: name, type (standard/seasonal/promo), date range (optional), price, min nights
- Priority order (promo overrides seasonal overrides standard)
- Booking create/edit-এ rate plan picker
- Public website booking form-এ auto-apply correct rate

**Prisma:**
```prisma
model RatePlan {
  id         String   @id @default(cuid())
  tenantId   String
  roomId     String?  // null = applies to all rooms
  name       String
  type       RatePlanType
  price      Float
  startDate  DateTime?
  endDate    DateTime?
  minNights  Int      @default(1)
  isActive   Boolean  @default(true)
}
enum RatePlanType { STANDARD SEASONAL WEEKEND PROMO EARLY_BIRD LAST_MINUTE }
```

**API:** `GET/POST/PATCH/DELETE /api/rate-plans`

---

### T-32 — Guest Communication (Auto Emails)

**কী:** Guest-কে automatic email পাঠানো booking lifecycle-এর সাথে। Resend integration।

**Triggers & Templates:**
| Event | Template | Timing |
|-------|----------|--------|
| Booking confirmed | Booking confirmation + details | Immediate |
| Check-in tomorrow | Pre-arrival reminder | 1 day before |
| Checked out | Invoice + thank you | On checkout |
| Booking cancelled | Cancellation notice + refund info | Immediate |

**Features:**
- Email templates editable per tenant (resort name, logo auto-injected)
- Toggle per trigger (owner can disable any)
- Test email button
- Send log (last 30 days)

**API:**
- `GET/PUT /api/email-settings` — toggle + template customization
- Triggered from booking status changes (hooks in bookings.ts)

---

### T-33 — Walk-in Booking (Front Desk Quick Add)

**কী:** Guest directly এসে গেছে — quick booking without online flow। Front desk থেকে ৩০ সেকেন্ডে booking create।

**Features:**
- Quick booking button (prominent, top of bookings page)
- Minimal form: room picker (shows available rooms for date range), guest name, phone, check-in/out, adults/children
- Auto check-in option (if guest already here)
- Payment: cash / card / pending
- Skip email confirmation option
- Booking created → immediately shows in calendar

**UI:** Full-screen modal or dedicated `/dashboard/bookings/walk-in` page

**API:** Uses existing `POST /api/bookings` — adds `source: 'WALK_IN'` field

---

### T-34 — Maintenance Tracking (`/dashboard/maintenance`)

**কী:** Room maintenance request system — housekeeping-এর বাইরে technical issues।

**Features:**
- Create ticket: room, issue type (AC, Plumbing, Electrical, Furniture, Door, Other), description, priority (urgent/high/normal/low)
- Assign to staff member
- Status: open → in_progress → resolved
- Room auto-marked as maintenance (blocks new bookings)
- When resolved → room status restored
- Photo attachment (optional)
- Resolution notes

**Prisma:**
```prisma
model MaintenanceTicket {
  id          String   @id @default(cuid())
  tenantId    String
  roomId      String
  issueType   String
  description String
  priority    MaintenancePriority @default(NORMAL)
  status      MaintenanceStatus   @default(OPEN)
  assignedTo  String?
  resolvedAt  DateTime?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
enum MaintenancePriority { URGENT HIGH NORMAL LOW }
enum MaintenanceStatus   { OPEN IN_PROGRESS RESOLVED }
```

**API:** `GET/POST /api/maintenance`, `PATCH /api/maintenance/:id`

---

### T-35 — Daily / Shift Report (`/dashboard/reports`)

**কী:** দিনের end-of-day summary — owner/manager প্রতিদিন দেখে।

**Report sections:**
- **Occupancy:** rooms occupied / total, occupancy %, nights sold
- **Arrivals & Departures:** today's check-ins (list), check-outs (list), no-shows
- **Revenue:** room revenue, restaurant revenue, extras, total
- **Payments:** cash collected, card, online, pending
- **Housekeeping:** completed tasks, pending
- **Maintenance:** open tickets, resolved today

**Features:**
- Date picker (default: today)
- Print button (clean print layout)
- Email report to self button
- Quick comparison: yesterday / same day last week

**API:** `GET /api/reports/daily?date=YYYY-MM-DD` — aggregates from bookings, food-orders, payments, housekeeping

---

### 🟢 Future Enhancement Modules (T-36 to T-39)

---

### T-36 — Package Deals

**কী:** Bundle pricing — room + services = one price।

**Examples:** Honeymoon Package (room + flowers + dinner), Family Fun (room + breakfast + pool), Corporate (room + meeting room + lunch)

**Prisma:** `Package` model → packageItems (room type + included services + total price)

**Public website:** Package section on homepage, book package → pre-filled booking

---

### T-37 — Group Booking

**কী:** Wedding, conference, tour group — multiple rooms, single booking reference।

**Features:** Group name, contact person, multiple room selection, group discount %, single invoice, room allocation list

**Prisma:** `GroupBooking` → has many `Booking` records

---

### T-38 — Guest Loyalty Program

**কী:** Repeat guest reward system।

**Features:** Visit count, total spend tracking, tier (Silver 3+ stays / Gold 7+ / Platinum 15+), auto-discount (5%/10%/15%), loyalty badge on guest profile

**Prisma:** Add `loyaltyTier`, `totalVisits`, `totalSpend` to Guest model

---

### T-39 — Expense & Cost Tracking

**কী:** Operating expenses — resort চালাতে যা খরচ হয়।

**Features:** Add expense (category: utilities/salary/supplies/maintenance/marketing/other, amount, date, vendor, note), monthly summary, revenue vs expense P&L chart

**Prisma:** `Expense` model (tenantId, category, amount, date, vendor, description)

---

## Updated Key Files (Phase 6)

| File | Purpose |
|------|---------|
| `apps/web/src/app/(dashboard)/dashboard/calendar/page.tsx` | T-28 Gantt calendar |
| `apps/web/src/app/(dashboard)/dashboard/maintenance/page.tsx` | T-34 maintenance tickets |
| `apps/web/src/app/(dashboard)/dashboard/reports/page.tsx` | T-35 daily report |
| `apps/api/src/routes/bookings.ts` | T-28/29/30/33 enhancements |
| `apps/api/src/routes/rate-plans.ts` | T-31 new file |
| `apps/api/src/routes/maintenance.ts` | T-34 new file |
| `apps/api/src/routes/reports.ts` | T-35 new file |

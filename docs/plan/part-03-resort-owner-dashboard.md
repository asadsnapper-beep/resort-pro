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

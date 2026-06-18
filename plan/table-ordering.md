# Table Ordering System — Tablet Kiosk

## Overview

প্রতিটা restaurant table-এ একটা Android tablet বসানো থাকবে। Customer সেই tablet থেকে menu দেখবে, order করবে, pay করবে। Food ready হলে tablet screen-এ notification দেখাবে।

Tablet lockdown: Android Screen Pinning বা Play Store kiosk browser app (যেমন Kiosk Browser Lockdown) দিয়ে করা হবে — আলাদা Android APK বানাতে হবে না।

---

## Customer Flow

```
Tablet open → Menu দেখো → Cart → Pay First → Order Confirmed → [Food Ready alert]
```

1. Tablet সবসময় ordering page-এ open থাকে
2. Customer menu browse করে, cart-এ add করে
3. Pay করতে হবে **order place হওয়ার আগেই** (bKash / Card / Cash)
4. Payment verify হলে order KDS-এ যায়
5. Chef KDS-এ order READY mark করলে **tablet screen-এ "Food is Ready!" দেখায়**
6. কিছুক্ষণ পর screen auto-reset হয়ে নতুন order নেওয়ার জন্য ready হয়

---

## Schema Changes

### নতুন Model: `RestaurantTable`

```prisma
model RestaurantTable {
  id           String      @id @default(uuid())
  tenantId     String
  tableNumber  Int
  label        String?     // "Window Table", "VIP 1" etc
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  tenant       Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  foodOrders   FoodOrder[]

  @@unique([tenantId, tableNumber])
  @@index([tenantId])
  @@map("restaurant_tables")
}
```

### Updated: `FoodOrder`

নতুন fields:
- `restaurantTableId String?` — কোন table থেকে order
- `paymentStatus PaymentStatus @default(PENDING)` — pay-first tracking
- `paymentMethod PaymentMethod?`
- `gatewayPaymentId String?`

---

## API Endpoints

### Public (no auth — tablet থেকে call হবে)

| Method | Route | কাজ |
|--------|-------|-----|
| GET | `/public/table/:slug/:tableNumber` | Tenant info + menu items |
| POST | `/public/table/:slug/:tableNumber/order` | Order create + payment intent |
| POST | `/public/table/payment/verify` | Payment verify → order activate |
| GET | `/public/table/:slug/:tableNumber/status/:orderId` | Order status poll (food ready check) |

### Dashboard (auth required)

| Method | Route | কাজ |
|--------|-------|-----|
| GET | `/api/restaurant/tables` | Table list |
| POST | `/api/restaurant/tables` | Table তৈরি |
| PATCH | `/api/restaurant/tables/:id` | Table edit |
| DELETE | `/api/restaurant/tables/:id` | Table delete |

---

## Pages & Components

### Public — Tablet Ordering Page
- **Route:** `/<slug>/table/<tableNumber>`
- **Features:**
  - Menu categories + items (touch-friendly, বড় cards)
  - Cart sidebar বা bottom sheet
  - Pay-first modal (bKash / Card / Cash option)
  - Order confirmation screen (order number দেখাবে)
  - **"Food is Ready!" full-screen alert** — polling বা SSE দিয়ে
  - Auto-reset after 60s of idle post-delivery

### Dashboard — Table Management Page
- **Route:** `/dashboard/restaurant/tables`
- **Features:**
  - Table list (number, label, active/inactive)
  - Add / Edit / Delete table
  - প্রতি table-এর URL copy button (staff tablet-এ দেবে)
  - Per-table today's orders + revenue

### KDS Update (existing)
- প্রতিটা order card-এ **Table Number badge** দেখাবে
- Payment status badge (Paid / Unpaid)
- Unpaid order KDS-এ show করবে না (pay-first enforce)

---

## "Food is Ready" — Real-time Alert

**Approach:** Simple polling (every 5s) — WebSocket-এর চেয়ে সহজ, tablet-এর জন্য যথেষ্ট।

```
Tablet polls GET /public/table/:slug/:tableNumber/status/:orderId every 5s
→ status === 'READY' হলে full-screen alert দেখাবে
→ 60s পর auto-dismiss + page reset
```

Alert UI:
- Full-screen green overlay
- বড় হরফে "🍽️ Your Food is Ready!"
- Table number + order number
- "Thank You" message
- Auto-dismiss countdown

---

## Build Sequence

### Phase 1 — Schema + API
- [ ] `RestaurantTable` model + migration
- [ ] `FoodOrder` নতুন fields + migration
- [ ] Public menu endpoint
- [ ] Order create + payment verify endpoint
- [ ] Order status endpoint (for polling)
- [ ] Dashboard table CRUD endpoints

### Phase 2 — Public Ordering Page
- [ ] `/<slug>/table/<tableNumber>` route
- [ ] Menu grid (category filter, touch-friendly)
- [ ] Cart (add/remove/qty)
- [ ] Pay-first flow (bKash/Card/Cash)
- [ ] Order confirmation screen
- [ ] Polling → "Food is Ready!" full-screen alert
- [ ] Auto-reset after delivery

### Phase 3 — Dashboard Table Management
- [ ] `/dashboard/restaurant/tables` page
- [ ] Table CRUD UI
- [ ] Table URL copy button
- [ ] KDS-এ table number badge + paid status

---

## Tablet Setup (Staff করবে — একবারই)

1. Android tablet-এ Chrome open করো
2. URL দাও: `https://app.resortpro.site/<slug>/table/<tableNumber>`
3. Android Screen Pinning চালু করো (Settings → Security → Screen Pinning)
4. Done — customer শুধু এই পেজেই থাকবে

বা Play Store থেকে "Kiosk Browser Lockdown" install করে URL set করো।

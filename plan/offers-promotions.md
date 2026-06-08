# ResortPro — Offers & Promotions System

## Overview

Resort owner dashboard থেকে offer তৈরি করবে। Active offer গুলো public website-এ automatically দেখাবে। Booking form-এ promo code support থাকবে।

---

## ১. কোথায় কোথায় দেখাবে (Guest Side)

```
Public Website:
├── Hero Banner-এর নিচে — Announcement Bar
│   "🎉 Eid Special — 30% off, valid till Jun 15. Code: EID30"
│
├── Offers Section (আলাদা section)
│   প্রতিটা offer card:
│   ├── Offer title + description
│   ├── Discount badge (30% OFF / ৳500 OFF)
│   ├── Valid dates
│   ├── Applicable rooms (All rooms / Deluxe only)
│   └── "Use Code: EID30" বা auto-apply link
│
└── Room Card-এ
    Room-এ offer থাকলে:
    ├── ~~৳8,000~~ ৳5,600 (30% off)
    └── 🏷 Offer badge

Booking Form:
└── Promo Code field
    ├── Code enter করলে → API validate করবে
    ├── Valid হলে → discount preview দেখাবে
    └── Invalid হলে → error message
```

---

## ২. Dashboard (Owner Side)

### Offers List Page `/dashboard/offers`

```
┌─────────────────────────────────────────────────┐
│  Offers & Promotions             [+ New Offer]  │
│                                                   │
│  [Active: 2]  [Scheduled: 1]  [Expired: 5]      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🟢 Eid Special                              │ │
│  │ 30% off all rooms | Code: EID30             │ │
│  │ Jun 1 – Jun 15, 2026                        │ │
│  │ 23 bookings used this offer                 │ │
│  │ [Edit] [Pause] [Delete]                     │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### New Offer Form

```
Offer Title:        [ Eid Special                    ]
Description:        [ Book now and save 30%...       ]
Offer Type:
  ● Percentage Discount    [ 30 ] %
  ○ Fixed Amount Off       [ ৳500 ]
  ○ Free Night             (e.g., stay 2 get 1 free)

Promo Code:         [ EID30           ] (auto-generate option)
Min Stay:           [ 1 ] nights
Valid From:         [ 2026-06-01 ]
Valid To:           [ 2026-06-15 ]
Max Uses:           [ 100 ] (blank = unlimited)
Applicable Rooms:
  ● All Rooms
  ○ Select specific rooms: [Deluxe ✓] [Suite ✓] [Standard]

Show on Website:    [✓] Announcement Bar
                    [✓] Offers Section
                    [✓] Room Cards
Display Priority:   [ 1 ] (higher = shows first)
```

---

## ৩. Database Schema

```prisma
model Offer {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  title       String
  description String?
  type        OfferType  // PERCENTAGE | FIXED | FREE_NIGHT
  value       Float      // 30 for 30%, 500 for ৳500, 1 for 1 free night
  promoCode   String?    // nullable = no code needed, auto-apply
  minStay     Int        @default(1)

  validFrom   DateTime
  validTo     DateTime
  maxUses     Int?       // null = unlimited
  usedCount   Int        @default(0)

  roomIds     String[]   // empty = all rooms
  showOnBar   Boolean    @default(true)
  showSection Boolean    @default(true)
  showOnCards Boolean    @default(true)
  priority    Int        @default(0)
  isActive    Boolean    @default(true)

  bookings    BookingOffer[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum OfferType {
  PERCENTAGE
  FIXED
  FREE_NIGHT
}

model BookingOffer {
  id        String  @id @default(cuid())
  bookingId String
  offerId   String
  discount  Float   // actual amount saved
  booking   Booking @relation(fields: [bookingId], references: [id])
  offer     Offer   @relation(fields: [offerId], references: [id])
}
```

---

## ৪. API Endpoints

```
// Owner (authenticated)
GET    /api/tenant/offers              → list all offers
POST   /api/tenant/offers              → create offer
PATCH  /api/tenant/offers/:id          → update offer
DELETE /api/tenant/offers/:id          → delete offer
GET    /api/tenant/offers/:id/stats    → usage stats

// Public (no auth needed)
GET    /api/public/:slug/offers        → active offers for website display
POST   /api/public/:slug/offers/validate → validate promo code
  body: { code, roomId, checkIn, checkOut }
  returns: { valid, discount, offerTitle, finalPrice }
```

---

## ৫. Booking Form Integration

Booking create সময়:
```typescript
// POST /api/public/:slug/bookings body-তে add হবে:
{
  promoCode?: string
  offerId?: string   // auto-apply offer হলে
}

// API validate করবে → discount apply করবে → BookingOffer entry বানাবে
// Invoice-এ "Discount (EID30): -৳2,400" দেখাবে
```

---

## ৬. Implementation Steps

```
Step 1 — Database (1 day)
  ✦ Offer + BookingOffer model add to schema
  ✦ Migrate

Step 2 — API (2 days)
  ✦ Owner CRUD endpoints
  ✦ Public GET /offers endpoint
  ✦ Public POST /offers/validate endpoint
  ✦ Booking create-এ offer/promo code apply logic

Step 3 — Dashboard UI (2 days)
  ✦ /dashboard/offers page — list + create + edit
  ✦ Stats: used count, revenue impact

Step 4 — Public Website (2 days)
  ✦ Announcement Bar component (all themes-এ)
  ✦ Offers Section (all themes-এ)
  ✦ Room card-এ discount badge
  ✦ Booking form-এ promo code field + validate

Total: ~7 days
```

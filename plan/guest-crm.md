# ResortPro — Guest CRM & Loyalty Program

## Overview

প্রতিটা guest-এর profile, booking history, preferences, এবং loyalty points track করা। Resort owner repeat guest-দের চিনবে, personalized service দেবে, এবং loyalty reward দিয়ে আবার আসতে উৎসাহিত করবে।

---

## ১. Guest Profile

### Guest List `/dashboard/guests`

```
┌─────────────────────────────────────────────────────┐
│  Guests                    [Search]  [Export]       │
│                                                      │
│  Filter: [All ▾]  [This month ▾]  [VIP only]       │
│                                                      │
│  Rahman Ahmed          ⭐ VIP                       │
│  📞 01712-345678       3 stays | ৳48,000 lifetime  │
│  Last visit: Jun 4     Loyalty: 480 pts             │
│  [View Profile]                                     │
│  ─────────────────────────────────────────────     │
│  Fatima Khan                                        │
│  📞 01812-567890       1 stay | ৳16,000 lifetime   │
│  Last visit: May 20    Loyalty: 160 pts             │
│  [View Profile]                                     │
└─────────────────────────────────────────────────────┘
```

### Guest Profile Page

```
┌──────────────────────────────────────────────────┐
│  Rahman Ahmed                    ⭐ VIP Guest    │
│  📞 01712-345678  📧 rahman@email.com            │
│  📍 Dhaka, Bangladesh                            │
│                                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐       │
│  │  3   │ │৳48K │ │ 480  │ │  Deluxe  │       │
│  │Stays │ │Total │ │Points│ │Fav. Room │       │
│  └──────┘ └──────┘ └──────┘ └──────────┘       │
│                                                   │
│  Preferences:                                    │
│  🛏 High floor    🚭 Non-smoking                 │
│  🥗 Vegetarian   🌡 Cool AC preferred            │
│                                                   │
│  Notes:                                          │
│  "Allergic to feather pillows"                   │
│  "Always asks for extra towels"                  │
│                                                   │
│  Booking History:                                │
│  Jun 4–6  Room 201  ৳16,000  ✅ Checked out     │
│  Apr 10   Room 305  ৳24,000  ✅ Checked out     │
│  Feb 3    Room 201  ৳8,000   ✅ Checked out     │
│                                                   │
│  [Send Message] [Add Note] [Award Points]        │
└──────────────────────────────────────────────────┘
```

---

## ২. Loyalty Program

### Point System

```
Earn points:
  ৳100 spend = 1 point  (configurable by resort)

Redeem points:
  100 points = ৳100 discount on next booking
  (or configurable redemption rate)

Tiers:
  🥉 BRONZE   0–499 pts      (new guests)
  🥈 SILVER   500–1999 pts   (+5% bonus on earn)
  🥇 GOLD     2000–4999 pts  (+10% bonus + free upgrade if available)
  💎 DIAMOND  5000+ pts      (+15% bonus + free breakfast + priority)
```

### Owner Settings `/dashboard/loyalty-settings`
```
Earn Rate:    [ 1 ] point per ৳[ 100 ]
Redeem Rate:  [ 100 ] points = ৳[ 100 ]
Point Expiry: [ 12 ] months after last activity

Tier Thresholds:
  Bronze:  0 pts
  Silver:  [ 500 ] pts
  Gold:    [ 2000 ] pts
  Diamond: [ 5000 ] pts

Tier Benefits (optional text):
  Gold benefit:    [ Free room upgrade if available ]
  Diamond benefit: [ Free breakfast + priority check-in ]

Enable Loyalty: [✓]
Show on website: [✓]  (shows "Join our loyalty program" section)
```

---

## ৩. Guest Auto-Detection

```
Phone number দিয়ে guest match করা:

New booking আসলে:
  → Phone number check করা existing guests-এ
  → Match হলে → existing guest profile-এ booking যোগ
  → No match → new guest profile তৈরি
  → Loyalty points auto-add after checkout

Website থেকে book করলে:
  → Phone enter করলে "Welcome back, Rahman! You have 480 pts"
  → Points balance দেখাবে booking form-এ
  → Redeem option দেখাবে (use 400 pts = ৳400 off)
```

---

## ৪. Guest Segmentation

```
Dashboard-এ segments দেখা:

Segment          Count    Action
─────────────────────────────────────────────
VIP (5+ stays)     12     [Send special offer]
Lapsed (6mo+)      45     [Win-back campaign]
Birthday this mo   8      [Send birthday offer]
High spenders      20     [Send upgrade offer]
First timers       34     [Send welcome series]
```

---

## ৫. Database Schema

```prisma
model Guest {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  name        String
  phone       String
  email       String?
  address     String?
  city        String?
  country     String?
  idType      String?  // NID | PASSPORT
  idNumber    String?
  dateOfBirth DateTime?

  // Preferences
  preferences Json?    // { floor: "high", smoking: false, diet: "vegetarian" }
  notes       String?  // staff notes

  // Loyalty
  loyaltyPoints Int    @default(0)
  loyaltyTier   String @default("BRONZE")  // BRONZE|SILVER|GOLD|DIAMOND
  totalSpent    Float  @default(0)
  totalStays    Int    @default(0)
  lastStayAt    DateTime?

  // Tags
  tags        String[] // ["VIP", "Corporate", "Honeymoon"]

  bookings    Booking[]
  pointsLog   LoyaltyPointsLog[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, phone])  // per tenant, phone is unique identifier
}

model LoyaltyPointsLog {
  id          String   @id @default(cuid())
  guestId     String
  guest       Guest    @relation(fields: [guestId], references: [id])
  type        String   // EARN | REDEEM | EXPIRE | MANUAL
  points      Int      // positive = earn, negative = redeem
  reason      String?  // "Booking #BK-2345" or "Manual adjustment"
  bookingId   String?
  createdAt   DateTime @default(now())
}

// Booking model-এ add:
// guestId     String?
// guest       Guest?  @relation(fields: [guestId], references: [id])
// pointsEarned Int    @default(0)
// pointsRedeemed Int  @default(0)
```

---

## ৬. API Endpoints

```
GET    /api/tenant/guests              → list (search, filter by tier/tag)
GET    /api/tenant/guests/:id          → guest profile + booking history
PATCH  /api/tenant/guests/:id          → update preferences, notes, tags
POST   /api/tenant/guests/:id/points   → manual points add/remove
GET    /api/tenant/guests/:id/points-log → points history

GET    /api/tenant/loyalty/settings    → get loyalty config
PUT    /api/tenant/loyalty/settings    → update loyalty config

// Public (booking form)
GET    /api/public/:slug/guest/lookup?phone=01712... → guest lookup by phone
POST   /api/public/:slug/bookings redeem points in booking payload
```

---

## ৭. Implementation Steps

```
Step 1 — Database (1 day)
  ✦ Guest + LoyaltyPointsLog models
  ✦ Booking.guestId FK
  ✦ Auto-match guest on booking (by phone)
  ✦ Points auto-add after checkout

Step 2 — API (2 days)
  ✦ Guest CRUD
  ✦ Guest lookup by phone (public)
  ✦ Points management
  ✦ Loyalty settings

Step 3 — Dashboard UI (2 days)
  ✦ /dashboard/guests page
  ✦ Guest profile page
  ✦ Points log
  ✦ Loyalty settings page

Step 4 — Booking Form Integration (1 day)
  ✦ Phone → guest lookup
  ✦ "Welcome back" message
  ✦ Points balance + redeem option

Total: ~6 days
```

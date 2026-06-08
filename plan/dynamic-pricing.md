# ResortPro — Dynamic Pricing & Revenue Management

## Overview

Season, demand, এবং occupancy অনুযায়ী room price automatically adjust করা। Peak season-এ বেশি, off-season-এ কম। Last-minute discount বা advance booking discount দেওয়া। Owner pricing rule set করলে system automatically apply করবে।

---

## ১. Pricing Rules System

### Rule Types

```
1. SEASONAL PRICING
   ─────────────────
   Date range-এ fixed rate বা % change:
   "Eid season (Jun 1–10): all rooms +40%"
   "Monsoon (Jul–Aug): Standard rooms -20%"

2. OCCUPANCY-BASED
   ─────────────────
   Occupancy % দেখে price change:
   "৭০%+ occupied → +15%"
   "৩০% এর নিচে → -10%"
   (Check করবে every hour)

3. DAY OF WEEK
   ─────────────────
   "Friday–Saturday: +25%"
   "Sunday–Thursday: base rate"

4. LENGTH OF STAY
   ─────────────────
   "৩ রাত বা বেশি → -10%"
   "৭ রাত বা বেশি → -20%"

5. ADVANCE BOOKING
   ─────────────────
   "৩০ দিন আগে book → -15%"
   "৭ দিন আগে book → base"
   "Same day → +10%"

6. LAST MINUTE
   ─────────────────
   "Check-in ২৪ ঘণ্টার মধ্যে → -25%"
   (Unsold rooms fill করার জন্য)
```

---

## ২. Dashboard UI

### Pricing Rules Page `/dashboard/pricing`

```
┌────────────────────────────────────────────────────┐
│  Pricing Rules                     [+ Add Rule]   │
│                                                    │
│  Active Rules: 4   Upcoming: 2   Paused: 1        │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │ 🟢 Eid Special Pricing                    │   │
│  │ Jun 1 – Jun 15 | All rooms | +40%         │   │
│  │ Applied 23 times this period              │   │
│  │ [Edit] [Pause] [Delete]                   │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │ 🟢 Weekend Surge                           │   │
│  │ Every Fri–Sat | All rooms | +25%           │   │
│  │ Ongoing                                    │   │
│  │ [Edit] [Pause] [Delete]                   │   │
│  └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### Add Pricing Rule

```
Rule Name:    [ Eid Special                    ]
Rule Type:
  ● Date Range    ○ Day of Week
  ○ Occupancy     ○ Length of Stay
  ○ Advance Book  ○ Last Minute

Date From:    [ Jun 1, 2026 ]
Date To:      [ Jun 15, 2026 ]

Apply To:
  ● All Rooms
  ○ Room Type: [Deluxe ✓] [Suite ✓] [Standard]

Adjustment:
  ● % change:  [ +40 ] %
  ○ Fixed rate: ৳[      ] per night
  ○ Fixed add: +৳[      ] per night

Priority:     [ 10 ] (higher wins when rules overlap)
Active:       [✓]
```

### Price Calendar View

```
Calendar দেখলে প্রতিটা date-এ effective price দেখাবে:

June 2026:
         Mon    Tue    Wed    Thu    Fri    Sat    Sun
Jun 1   ৳11,200 ৳11,200 ৳11,200 ৳11,200 ৳14,000 ৳14,000 ৳11,200
        +40%   +40%   +40%   +40%  +40%+25% +40%+25% +40%
Jun 8   ৳11,200 ৳11,200 ...

Hover on a date → see which rules applied
```

---

## ৩. How Pricing Calculation Works

```
Base price: ৳8,000 (room's basePrice)

Step 1: Collect all active rules for this date/room
  - Eid rule: +40%
  - Weekend rule: +25%
  - 30-day advance: -15%

Step 2: Apply by priority (highest first)
  Method: Stacking (সব rules একসাথে apply)
  OR: Highest wins (এক rule)
  → Owner choose করবে (Settings-এ)

Step 3: Final price
  Stacking: 8000 × 1.40 × 1.25 × 0.85 = ৳11,900
  Or: Highest rule only: 8000 × 1.40 = ৳11,200

Step 4: Apply to availability API response
  → Booking form-এ এই price দেখাবে
  → Calendar-এ এই price দেখাবে
```

---

## ৪. Rate Plans (Advanced)

```
Multiple rate plans একসাথে offer করা:

Rate Plan:          BAR        Breakfast     Non-Refund
Base:              ৳8,000     ৳10,500       ৳6,500
Includes:          Room only  Room+breakfast Room only
Cancel policy:     Free 48h   Free 24h      No refund
Min stay:          1 night    1 night       2 nights
Book window:       Anytime    Anytime       7d+ advance

→ Booking form-এ rate plan choose করতে পারবে guest
```

---

## ৫. Database Schema

```prisma
model PricingRule {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  name        String
  type        String   // DATE_RANGE|DAY_OF_WEEK|OCCUPANCY|LENGTH_OF_STAY|ADVANCE|LAST_MINUTE

  // DATE_RANGE
  dateFrom    DateTime?
  dateTo      DateTime?

  // DAY_OF_WEEK  (bitmask or array)
  daysOfWeek  Int[]   // [5, 6] = Friday, Saturday

  // OCCUPANCY
  occupancyMin Float?  // 0.7 = 70%
  occupancyMax Float?

  // LENGTH_OF_STAY
  minNights   Int?
  maxNights   Int?

  // ADVANCE_BOOKING / LAST_MINUTE
  daysBeforeMin Int?
  daysBeforeMax Int?

  // Adjustment
  adjustType  String   // PERCENT | FIXED_RATE | FIXED_ADD
  adjustValue Float    // +40 or -15 or 11200

  // Apply to
  allRooms    Boolean  @default(true)
  roomIds     String[] // specific room IDs

  priority    Int      @default(0)
  stackingMode String  @default("STACK")  // STACK | HIGHEST_WINS

  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## ৬. API Endpoints

```
// Owner
GET    /api/tenant/pricing/rules        → list rules
POST   /api/tenant/pricing/rules        → create rule
PATCH  /api/tenant/pricing/rules/:id    → update
DELETE /api/tenant/pricing/rules/:id    → delete

GET    /api/tenant/pricing/calendar     → price per date (calendar view)
  ?roomId=&from=2026-06-01&to=2026-06-30

// Internal (used by availability & booking APIs)
GET    /api/internal/pricing/calculate
  ?tenantId=&roomId=&checkIn=&checkOut=
  → { pricePerNight, totalPrice, appliedRules[] }
```

---

## ৭. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ PricingRule model
  ✦ Migrate

Step 2 — Pricing Engine (2 days)
  ✦ Rule evaluation service (calculatePrice function)
  ✦ Integrate into availability API (price changes per date)
  ✦ Integrate into booking create (validate price)

Step 3 — Dashboard UI (2 days)
  ✦ /dashboard/pricing page
  ✦ Rule list + create/edit forms
  ✦ Price calendar view

Step 4 — Booking Form (1 day)
  ✦ Show dynamic price (not just basePrice)
  ✦ "Rate includes: Eid discount +40%" tooltip

Total: ~5.5 days
```

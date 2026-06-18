# AI Guest Personalization

## Overview

Returning guest-দের জন্য personalized experience তৈরি করা — past stays থেকে preferences learn করে, next visit-এ automatically সেই preferences apply করা। Staff-কে guest arrive করার আগেই context দেওয়া।

---

## Goals

- "Welcome back, Mr. Ahmed — your usual high-floor room with extra pillows is ready"
- Returning guest-দের automatically preferred room type suggest করা
- Special occasions detect করা (birthday, anniversary) → upsell opportunity
- Staff briefing: guest history + preferences before check-in

---

## How It Works

```
Guest Books / Checks In
         ↓
Guest Profile Enrichment
├── Past stays analysis
├── Requests made (room service, amenities)
├── Complaints logged
├── Review sentiment
└── Spending patterns (F&B, spa, extras)
         ↓
AI Profile Generation (Claude)
├── Preference summary
├── Predicted needs for this visit
├── Upsell opportunities
└── Risk flags (past complaints to avoid repeat)
         ↓
Staff Pre-Arrival Briefing Card
         ↓
Automated Personalization Actions
├── Pre-assign preferred room
├── Pre-order preferred amenities
├── Birthday/anniversary alert → upgrade offer
└── Personalized welcome message
```

---

## Guest Preference Tracking

```prisma
model GuestPreference {
  id        String   @id @default(cuid())
  guestId   String   @unique
  hotelId   String

  // Room preferences
  preferredFloor      String?  // "high" | "low" | "ground"
  preferredRoomType   String?  // roomTypeId
  bedPreference       String?  // "king" | "twin" | "queen"
  smokingPreference   String?  // "non-smoking" | "smoking"
  pillowPreference    String?  // "soft" | "firm" | "extra"

  // Dietary & F&B
  dietaryRestrictions Json?    // ["vegetarian", "halal", "nut-free"]
  preferredDrinks     Json?
  breakfastStyle      String?  // "buffet" | "room-service" | "skip"

  // Services
  wakeUpCallTime      String?
  housekeepingTime    String?  // "morning" | "afternoon" | "do-not-disturb"
  newsletterOptin     Boolean  @default(false)

  // AI-derived
  aiProfile           String?  // AI-generated preference summary
  aiProfileUpdatedAt  DateTime?
  loyaltyTier         String?  // "silver" | "gold" | "platinum"
  lifetimeSpend       Float    @default(0)
  totalStays          Int      @default(0)
  avgRating           Float?   // avg of their reviews

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  guest Guest @relation(fields: [guestId], references: [id])
  hotel Hotel @relation(fields: [hotelId], references: [id])
}

model StayInsight {
  id          String   @id @default(cuid())
  guestId     String
  hotelId     String
  stayId      String   // reservationId
  insights    Json     // { spent_on_spa: true, complained_about: ["wifi"], requested: ["extra_towels"] }
  aiSummary   String?
  createdAt   DateTime @default(now())

  guest Guest @relation(fields: [guestId], references: [id])
}

model SpecialOccasion {
  id          String   @id @default(cuid())
  guestId     String
  hotelId     String
  type        String   // "birthday" | "anniversary" | "honeymoon" | "graduation"
  date        DateTime
  notes       String?
  autoAlert   Boolean  @default(true)

  guest Guest @relation(fields: [guestId], references: [id])
}
```

---

## AI Guest Profile Prompt

```
Based on this guest's stay history, create a concise preference profile for hotel staff.

Guest: {name}
Total stays: {n}
Stay history:
{list of stays with room type, special requests, complaints, F&B spend}

Reviews given:
{sentiment summary}

Generate:
{
  "preferenceSummary": "2-3 sentence summary for front desk staff",
  "preferredRoomType": "...",
  "preferredFloor": "high|low|any",
  "knownRequests": ["extra pillows", "late checkout"],
  "avoidances": ["avoid noisy rooms near elevator"],
  "upsellOpportunities": ["spa package - visited spa 3x", "breakfast upgrade"],
  "loyaltyNote": "VIP — has stayed 8 times, always leaves positive reviews"
}
```

---

## Pre-Arrival Staff Briefing Card

Sent to front desk staff 24h before guest check-in:

```
┌─────────────────────────────────────────────────────┐
│  👤 Pre-Arrival Briefing — Ahmed Hassan             │
│  Check-in: Tomorrow, 3PM | Room 512 (Deluxe Sea)   │
├─────────────────────────────────────────────────────┤
│  🏨 8th stay with us | Gold loyalty member         │
│  Lifetime spend: $12,400                            │
├─────────────────────────────────────────────────────┤
│  ✅ Preferences                                     │
│  • High floor preferred (assigned ✓)                │
│  • King bed (assigned ✓)                            │
│  • Extra firm pillows — pre-place in room           │
│  • Halal dietary — note for restaurant              │
├─────────────────────────────────────────────────────┤
│  ⚠️ Notes                                           │
│  • Had WiFi complaint on last stay — verify Rm 512  │
├─────────────────────────────────────────────────────┤
│  🎂 Special: Birthday in 2 days!                    │
│  → Complimentary cake? [Send Request]               │
├─────────────────────────────────────────────────────┤
│  💡 Upsell opportunities                            │
│  • Spa package (visited 4x previously)              │
│  • Airport pickup (used 3x)                         │
└─────────────────────────────────────────────────────┘
```

---

## API Endpoints

```
GET  /api/guests/:id/profile                — full guest profile + preferences
PUT  /api/guests/:id/preferences            — update preferences
GET  /api/guests/:id/briefing               — pre-arrival briefing card
POST /api/guests/:id/occasions              — add special occasion
GET  /api/ai/personalization/upcoming       — upcoming check-ins with AI briefings
POST /api/ai/personalization/generate/:guestId — regenerate AI profile
```

---

## Implementation Phases

### Phase 1 — Preference Tracking (1 week)
- [ ] `GuestPreference` model + migration
- [ ] Preferences UI in guest profile
- [ ] Staff update preferences during/after stay
- [ ] Special occasions tracking

### Phase 2 — AI Profile + Briefing (1 week)
- [ ] AI profile generation from stay history
- [ ] Pre-arrival briefing card
- [ ] Front desk notification (24h before check-in)
- [ ] Briefing card UI

### Phase 3 — Automated Actions (future)
- [ ] Auto room assignment based on preferences
- [ ] Birthday/anniversary automated offer
- [ ] Personalized email before arrival
- [ ] Upsell suggestions to front desk

---

## Files to Create/Modify

```
apps/api/src/routes/guests/preferences.ts         — endpoints
apps/api/src/services/ai/guestProfiler.ts         — AI profile generation
apps/api/src/jobs/pre-arrival-briefing.ts         — daily briefing job
apps/web/src/pages/guests/profile/               — enhanced guest profile UI
apps/web/src/pages/front-desk/arrival-briefing/  — briefing card UI
packages/database/prisma/schema.prisma            — models
```

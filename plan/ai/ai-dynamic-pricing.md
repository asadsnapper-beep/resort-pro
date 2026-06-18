# AI Dynamic Pricing Engine

## Overview

হোটেলের room rate স্বয়ংক্রিয়ভাবে adjust করবে — occupancy, demand, seasonality, competitor pricing, এবং events-এর ভিত্তিতে।

---

## Goals

- Revenue per available room (RevPAR) ১৫–২৫% বাড়ানো
- Manual pricing এর প্রয়োজন কমানো
- Hotel manager কে explanation সহ suggestions দেওয়া (not silent auto-change)

---

## How It Works

```
Input Signals
├── Current occupancy %
├── Bookings pace (bookings in last 24h, 7d)
├── Upcoming local events (fetched from API)
├── Historical booking patterns (same dates last year)
├── Competitor prices (optional scraping or manual input)
└── Current listed rate vs market avg

       ↓

Pricing Model (ML)
├── Rule-based baseline (configurable min/max)
├── Demand multiplier (0.8x – 2.0x)
└── Seasonality adjustment

       ↓

Output
├── Suggested price per room type
├── Confidence score
├── Explanation (why this price)
└── Manager approve / auto-apply toggle
```

---

## Data Requirements

### Existing Data (already in DB)
- `Reservation` — occupancy history
- `Room` / `RoomType` — inventory
- `RatePlan` — current pricing

### New Data Needed
- `PricingRule` table — min/max bounds per room type, per hotel
- `PricingSuggestion` table — AI generated suggestions + status
- `ExternalEvent` table — local events, holidays

---

## Database Schema

```prisma
model PricingRule {
  id          String   @id @default(cuid())
  hotelId     String
  roomTypeId  String
  minPrice    Float
  maxPrice    Float
  strategy    String   @default("balanced") // "aggressive" | "balanced" | "conservative"
  autoApply   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  hotel    Hotel    @relation(fields: [hotelId], references: [id])
  roomType RoomType @relation(fields: [roomTypeId], references: [id])
}

model PricingSuggestion {
  id           String   @id @default(cuid())
  hotelId      String
  roomTypeId   String
  date         DateTime
  suggestedPrice Float
  currentPrice   Float
  confidence     Float    // 0.0 – 1.0
  reasoning      String   // AI explanation text
  status         String   @default("pending") // "pending" | "approved" | "rejected" | "auto-applied"
  appliedAt      DateTime?
  createdAt      DateTime @default(now())

  hotel    Hotel    @relation(fields: [hotelId], references: [id])
  roomType RoomType @relation(fields: [roomTypeId], references: [id])
}
```

---

## API Endpoints

```
POST /api/ai/pricing/generate          — নতুন suggestions generate করো (hotel manager trigger করে)
GET  /api/ai/pricing/suggestions       — pending suggestions list
PUT  /api/ai/pricing/suggestions/:id/approve  — approve + apply
PUT  /api/ai/pricing/suggestions/:id/reject   — reject
POST /api/ai/pricing/rules             — pricing rules set করো
GET  /api/ai/pricing/rules             — current rules
POST /api/ai/pricing/auto-run          — scheduled nightly job trigger
```

---

## AI Logic (Prompt / Model)

**Option A — Rule-Based ML (Phase 1)**
```
base_price = room_type.base_rate
occupancy_factor = current_occupancy / 100  # 0.0 – 1.0
demand_multiplier = 1 + (occupancy_factor - 0.5) * 0.8
seasonality_multiplier = lookup_seasonality(date)
suggested = base_price * demand_multiplier * seasonality_multiplier
suggested = clamp(suggested, rule.minPrice, rule.maxPrice)
```

**Option B — Claude LLM (Phase 2, with context)**
```
Prompt: "Given the following hotel data for [date]:
- Room type: [name], base rate: [price]
- Current occupancy: [x]%
- Bookings in last 7 days for this date: [n]
- Local events: [list]
- Last year same date occupancy: [y]%
- Competitor avg price: [z] (if available)

Suggest an optimal price with reasoning. Return JSON:
{ suggestedPrice: number, confidence: number, reasoning: string }"
```

---

## Frontend UI

### Manager Dashboard — Pricing Page
- **Suggestion Cards**: date, room type, current vs suggested price, confidence bar, reason
- **Approve / Reject / Edit** buttons per suggestion
- **Bulk Approve** option
- **Auto-apply toggle** per room type (with min/max guard)
- **Pricing Rules** settings panel
- **Historical chart**: AI suggested vs actual rate vs occupancy

---

## Implementation Phases

### Phase 1 — Rule-Based Engine (2 weeks)
- [ ] `PricingRule` + `PricingSuggestion` migration
- [ ] Rule-based pricing algorithm
- [ ] API endpoints (generate, approve, reject)
- [ ] Nightly scheduled job
- [ ] Basic manager UI

### Phase 2 — Claude LLM Integration (1 week)
- [ ] Anthropic SDK integration in `apps/api`
- [ ] Prompt engineering + JSON response parsing
- [ ] Fallback to rule-based if Claude unavailable
- [ ] Reasoning text display in UI

### Phase 3 — Competitor Pricing (future)
- [ ] Manual competitor price input
- [ ] Optional: web scraping (legal review needed)

---

## Files to Create/Modify

```
apps/api/src/routes/ai/pricing.ts          — endpoints
apps/api/src/services/ai/pricingEngine.ts  — core logic
apps/api/src/jobs/nightly-pricing.ts       — scheduled job
apps/web/src/pages/pricing/               — UI components
packages/database/prisma/schema.prisma    — new models
packages/database/prisma/migrations/      — migration file
```

---

## Cost Control Design

| Control | Value | Impact |
|---------|-------|--------|
| Run schedule | Nightly batch only | No real-time Claude calls |
| Output tokens | 150 max per suggestion | JSON only, no prose |
| Fallback | Rule-based if Claude unavailable | Zero cost baseline |
| BYOK | Owner pays Anthropic | Platform cost zero |
| AiUsage tracking | `YYYY-MM` month key | Monthly cost visibility |
| Auto-apply guard | minPrice/maxPrice hard clamp | No runaway prices |

**Cost estimate** (when Claude used):
- Per hotel per night: ~5 room types × ~30 days = 150 suggestions
- Each call: ~400 tokens input + 150 tokens output = 550 tokens
- Total per hotel per night: 150 × 550 = 82,500 tokens ≈ $0.25 (Sonnet pricing)
- Phase 1 (rule-based only): $0 — Claude বাদেও সব কাজ করে

**API key**: `AiKeys.dashboardKey` reuse করবে — আলাদা key লাগবে না।

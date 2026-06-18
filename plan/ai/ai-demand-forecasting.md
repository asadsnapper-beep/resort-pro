# AI Demand Forecasting

## Overview

ভবিষ্যতের booking demand predict করবে — hotel manager কে আগে থেকে জানাবে কোন dates-এ বেশি bookings আসবে, কোন dates-এ slow period থাকবে। এর উপর ভিত্তি করে staffing, inventory, এবং pricing decision নেওয়া যাবে।

---

## Goals

- ৩০/৬০/৯০ দিনের occupancy forecast
- Slow periods সম্পর্কে আগে সতর্ক করা → প্রমোশন trigger করা
- Peak period আগে চেনা → pricing engine-এ feed করা
- Seasonal trends + local events বিবেচনা করা

---

## Forecast Types

| Type | Horizon | Use Case |
|------|---------|----------|
| Short-term | 7 days | Staffing decisions |
| Mid-term | 30 days | Pricing & promotions |
| Long-term | 90 days | Inventory & renovation planning |

---

## Input Signals

```
Historical Data
├── Past 2 years booking data (date, room type, lead time, source)
├── Cancellation rates by period
└── Revenue by day/week/month

External Signals
├── Local public holidays (country/city specific)
├── Local events (concerts, conferences, festivals)
├── School holiday calendar
└── Weather patterns (beach/mountain resorts)

Real-time Signals
├── Current bookings pace (bookings received per day for future dates)
├── Pending inquiries
└── Website traffic (if integrated)
```

---

## Algorithm Approach

### Phase 1 — Statistical Baseline
```
Simple moving average of same period last year
+ YoY growth rate adjustment
+ Upcoming holiday multiplier
= Baseline forecast
```

### Phase 2 — ML Model (future)
- ARIMA or Prophet model trained per hotel
- Re-trained monthly with new data
- Runs as a background job

### Phase 3 — Claude LLM Insights
- Claude analyzes forecast + context
- Generates natural language summary: "Next month looks 20% below last year. Consider launching an early-bird promotion."

---

## Database Schema

```prisma
model DemandForecast {
  id            String   @id @default(cuid())
  hotelId       String
  forecastDate  DateTime // the date being forecasted
  generatedAt   DateTime @default(now())
  predictedOccupancy Float  // 0.0 – 1.0
  predictedRevenue   Float?
  confidence    Float    // 0.0 – 1.0
  signals       Json?    // what influenced this forecast
  horizon       String   // "7d" | "30d" | "90d"
  modelVersion  String   @default("v1")

  hotel Hotel @relation(fields: [hotelId], references: [id])

  @@unique([hotelId, forecastDate, horizon])
}

model LocalEvent {
  id          String   @id @default(cuid())
  hotelId     String?  // null = global/regional event
  name        String
  startDate   DateTime
  endDate     DateTime
  impactLevel String   // "low" | "medium" | "high"
  eventType   String   // "festival" | "conference" | "sports" | "holiday"
  source      String   @default("manual") // "manual" | "api"
  createdAt   DateTime @default(now())

  hotel Hotel? @relation(fields: [hotelId], references: [id])
}

model ForecastAlert {
  id        String   @id @default(cuid())
  hotelId   String
  alertType String   // "low_demand" | "peak_demand" | "unusual_drop"
  startDate DateTime
  endDate   DateTime
  message   String
  severity  String   // "info" | "warning" | "critical"
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  hotel Hotel @relation(fields: [hotelId], references: [id])
}
```

---

## API Endpoints

```
GET  /api/ai/forecast?horizon=30d          — get forecast for next N days
GET  /api/ai/forecast/calendar             — calendar view with predicted occupancy %
GET  /api/ai/forecast/alerts               — unread demand alerts
POST /api/ai/forecast/generate             — manually trigger forecast run
GET  /api/ai/forecast/accuracy             — compare past forecasts vs actuals
POST /api/ai/events                        — add local event
GET  /api/ai/events                        — list events
```

---

## Frontend UI

### Forecast Calendar
- Month view calendar
- Each day colored by predicted occupancy:
  - 🔴 Red: >85% (high demand)
  - 🟡 Yellow: 60–85% (normal)
  - 🟢 Green: <60% (low demand — opportunity)
- Hover: tooltip with exact % + key factors

### Forecast Chart
- Line chart: predicted vs actual (last 30 days) + predicted next 30 days
- Revenue projection overlay

### Alert Panel
- "⚠️ Oct 15–20 looks 30% below last year — consider a flash sale"
- One-click: create promotion for those dates
- One-click: adjust pricing rules

---

## Implementation Phases

### Phase 1 — Historical Analysis + Alerts (2 weeks)
- [ ] DB migration
- [ ] Historical data aggregation queries
- [ ] Simple forecasting algorithm (same period last year + adjustments)
- [ ] Nightly forecast job
- [ ] Alert generation for low/high demand periods
- [ ] Forecast calendar UI

### Phase 2 — Claude Insights (1 week)
- [ ] Weekly AI summary email/notification to hotel manager
- [ ] Natural language insight generation ("Next weekend looks strong because...")
- [ ] Actionable recommendations with direct links

### Phase 3 — ML Model (future)
- [ ] Prophet/ARIMA model integration
- [ ] Per-hotel model training
- [ ] Model accuracy tracking

---

## Files to Create/Modify

```
apps/api/src/routes/ai/forecast.ts           — endpoints
apps/api/src/services/ai/forecastEngine.ts   — algorithm
apps/api/src/jobs/nightly-forecast.ts        — scheduled job
apps/web/src/pages/forecast/                 — UI
packages/database/prisma/schema.prisma       — models
```

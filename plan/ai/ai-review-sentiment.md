# AI Review & Sentiment Analysis

## Overview

Guest review গুলো (Booking.com, Google, TripAdvisor, internal) Claude দিয়ে analyze করবে — overall sentiment score, key complaints, key praises, এবং actionable improvements বের করবে।

---

## Goals

- সব platform-এর reviews এক জায়গায় দেখা
- Automatically negative trends detect করা ("bathroom complaints increased this month")
- Staff-specific feedback identify করা (mention by name)
- Monthly AI-generated report: "Top 3 things to improve, Top 3 strengths"

---

## How It Works

```
New Review (from any source)
         ↓
Review Ingestion (API pull or webhook)
         ↓
Claude Analysis per Review
├── Overall sentiment: positive / neutral / negative
├── Score: 0–10
├── Category tags: [cleanliness, staff, location, food, value, wifi...]
├── Key phrases extracted
└── Suggested response draft (for manager to reply)
         ↓
Aggregated Analytics
├── Sentiment trend (weekly/monthly)
├── Category breakdown
├── Staff mention tracking
└── Competitor comparison (if reviews imported)
         ↓
Manager Dashboard + Alerts
```

---

## Review Sources (Phase 1: Manual + Internal)

- Internal guest feedback form (post-checkout)
- Manual import (CSV from Booking.com, TripAdvisor export)
- Direct review entry by staff

## Review Sources (Phase 2: API Integration)

- Google Business Profile API
- Booking.com Partner API
- TripAdvisor Content API (needs partnership)
- Airbnb API (limited)

---

## Database Schema

```prisma
model GuestReview {
  id           String   @id @default(cuid())
  hotelId      String
  guestId      String?
  source       String   // "internal" | "google" | "booking_com" | "tripadvisor" | "airbnb"
  externalId   String?  // review ID from external platform
  rating       Float    // 1.0 – 10.0 (normalized)
  title        String?
  content      String
  reviewDate   DateTime
  reviewerName String?
  roomType     String?
  stayDate     DateTime?

  // AI Analysis
  sentimentScore    Float?   // 0.0 – 1.0
  sentimentLabel    String?  // "positive" | "neutral" | "negative"
  categoryTags      Json?    // { cleanliness: 0.8, staff: 0.9, ... }
  keyPhrases        Json?    // ["great breakfast", "noisy AC", ...]
  staffMentions     Json?    // [{ name: "Ahmed", sentiment: "positive" }]
  suggestedResponse String?
  analysisVersion   String?

  // Manager Actions
  managerResponse   String?
  respondedAt       DateTime?
  isPublished       Boolean  @default(false)
  isFlagged         Boolean  @default(false)
  flagReason        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  hotel Hotel  @relation(fields: [hotelId], references: [id])
  guest Guest? @relation(fields: [guestId], references: [id])
}

model ReviewInsightReport {
  id          String   @id @default(cuid())
  hotelId     String
  period      String   // "2024-01" (YYYY-MM)
  reportData  Json     // full AI-generated report object
  summary     String   // AI natural language summary
  topStrengths    Json // ["Excellent staff", "Great location"]
  topWeaknesses   Json // ["Slow WiFi", "Noisy rooms"]
  actionItems     Json // ["Fix WiFi in rooms 201-210", ...]
  reviewCount Int
  avgRating   Float
  createdAt   DateTime @default(now())

  hotel Hotel @relation(fields: [hotelId], references: [id])
}
```

---

## Claude Analysis Prompt

```
Analyze this hotel guest review and return JSON:

Review:
Rating: {rating}/10
Title: {title}
Content: {content}
Stay date: {stayDate}
Room type: {roomType}

Return JSON:
{
  "sentimentScore": 0.0-1.0,
  "sentimentLabel": "positive|neutral|negative",
  "categoryScores": {
    "cleanliness": 0.0-1.0,
    "staff": 0.0-1.0,
    "location": 0.0-1.0,
    "food": 0.0-1.0,
    "value": 0.0-1.0,
    "amenities": 0.0-1.0,
    "noise": 0.0-1.0
  },
  "keyPhrases": ["phrase1", "phrase2"],
  "staffMentions": [{ "name": "string", "sentiment": "positive|negative|neutral" }],
  "mainComplaint": "string or null",
  "mainPraise": "string or null",
  "suggestedResponse": "Professional manager response draft in same language as review"
}
```

---

## Monthly Report Prompt

```
Based on {n} reviews for {hotelName} in {period}:

Aggregated data:
{aggregated_category_scores}
{top_phrases}
{staff_mentions}
{sentiment_distribution}

Generate a hotel manager report:
{
  "executiveSummary": "2-3 sentence overview",
  "topStrengths": ["strength1", "strength2", "strength3"],
  "topWeaknesses": ["weakness1", "weakness2", "weakness3"],
  "actionItems": [
    { "item": "specific action", "priority": "high|medium|low", "category": "..." }
  ],
  "staffHighlights": [...],
  "trendInsights": "What changed vs last month"
}
```

---

## API Endpoints

```
GET  /api/ai/reviews                        — list reviews (filtered)
POST /api/ai/reviews                        — add review manually
POST /api/ai/reviews/import                 — bulk import (CSV)
POST /api/ai/reviews/:id/analyze            — trigger AI analysis
GET  /api/ai/reviews/:id/analysis           — get AI analysis result
POST /api/ai/reviews/:id/respond            — submit manager response
GET  /api/ai/reviews/analytics              — sentiment trends, category breakdown
GET  /api/ai/reviews/report/:period         — monthly AI report
POST /api/ai/reviews/report/generate        — generate monthly report now
GET  /api/ai/reviews/alerts                 — negative trend alerts
```

---

## Frontend UI

### Reviews Dashboard
- **Summary Cards**: avg rating, sentiment score, review count, response rate
- **Sentiment Trend Chart**: last 6 months
- **Category Radar Chart**: cleanliness, staff, food, etc.
- **Review List**: sortable, filterable, with AI tags
- **Review Detail**: full review + AI analysis + suggested response editor

### Monthly Report View
- Narrative summary at top
- Strengths (green) / Weaknesses (red) lists
- Action items with priority badges
- Share/export as PDF

---

## Implementation Phases

### Phase 1 — Internal Reviews + Analysis (1.5 weeks)
- [ ] DB schema migration
- [ ] Review CRUD API
- [ ] Claude analysis per review
- [ ] Reviews dashboard UI
- [ ] Suggested response feature

### Phase 2 — Analytics + Reports (1 week)
- [ ] Aggregated analytics API
- [ ] Monthly report generation
- [ ] Trend alerts

### Phase 3 — External Platform Import (future)
- [ ] CSV import (Booking.com, TripAdvisor)
- [ ] Google Business API integration
- [ ] Auto-import scheduled job

---

## Files to Create/Modify

```
apps/api/src/routes/ai/reviews.ts            — endpoints
apps/api/src/services/ai/reviewAnalyzer.ts   — Claude analysis
apps/api/src/services/ai/reportGenerator.ts  — monthly report
apps/api/src/jobs/monthly-review-report.ts   — scheduled job
apps/web/src/pages/reviews/                  — UI components
packages/database/prisma/schema.prisma       — models
```

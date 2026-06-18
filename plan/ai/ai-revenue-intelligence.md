# AI Revenue Intelligence + Business Suggestions (Priority: High)

## Overview

Owner-কে একটি AI-powered dashboard দেওয়া যা revenue data analyze করে natural language-এ **business suggestion** দেবে, anomalies detect করবে, এবং "এখন আমার কী করা উচিত?" এর উত্তর দেবে। এটাই owner-এর কাছে AI-র সবচেয়ে দৃশ্যমান মূল্য — তাই High priority।

---

## 🔒 Security FIRST — "Ask Your Data" সবচেয়ে বিপজ্জনক AI surface

⚠️ Original plan-এ ছিল: *"Claude generates SQL → fetches data"*। **এটা পুরো platform-এর সবচেয়ে বড় security risk** — AI-generated free-form SQL মানে SQL injection, cross-tenant data leak, এমনকি data মুছে ফেলার সুযোগ। Hacker এখানেই আঘাত করবে।

**Decision: AI কখনো raw SQL লিখবে না।** বদলে:

| নিয়ম | কীভাবে |
|------|--------|
| **Predefined query templates** | কয়েকটা parameterized, server-controlled query (RevPAR, ADR, by-source, by-roomtype...)। AI শুধু কোন template + কোন parameter সেটা **JSON-এ propose** করে। |
| **AI → intent, server → query** | AI ফেরত দেয় `{ metric: "revpar", range: "last_month", groupBy: "roomType" }` → server zod validate → প্রি-লেখা parameterized query চালায়। |
| **Read-only DB user** | revenue query আলাদা read-only Postgres role দিয়ে → write/delete কোনোভাবেই সম্ভব না। |
| **Server-side tenantId** | প্রতি query-তে `tenantId` server inject — AI/user input থেকে না → cross-tenant leak অসম্ভব। |
| **Whitelist only** | template list-এর বাইরে কিছু চাইলে → "এই প্রশ্নের উত্তর এখন দিতে পারছি না"। |
| **No data in prompt beyond scope** | শুধু aggregated number AI-কে দেওয়া হয় explanation-এর জন্য — raw guest PII না। |

মূলনীতি: AI **কোন number চাই** সেটা বলে; **কীভাবে তোলা হবে** সেটা সবসময় server ঠিক করে। README "AI Abuse Hardening" এখানে সম্পূর্ণ প্রযোজ্য।

---

## Goals

- RevPAR, ADR, Occupancy — trend + forecast এক screen-এ
- AI-generated weekly briefing: "This week vs last year"
- Anomaly detection: "Room 301–310 consistently underperforming"
- **Business suggestions** — actionable, কারণসহ (one-click action যেখানে সম্ভব)
- "Ask your data" — owner free-text প্রশ্ন (নিরাপদ template-based, raw SQL না)

---

## Key Metrics Tracked

| Metric | Full Name | Formula |
|--------|-----------|---------|
| RevPAR | Revenue Per Available Room | Total Revenue / Total Available Rooms |
| ADR | Average Daily Rate | Room Revenue / Rooms Sold |
| OCC% | Occupancy Rate | Rooms Sold / Available Rooms × 100 |
| TRevPAR | Total Revenue Per Available Room | All revenue (room + F&B + spa) / Available Rooms |
| GOPPAR | Gross Operating Profit PAR | Gross Operating Profit / Available Rooms |
| LOS | Average Length of Stay | Total Guest Nights / Bookings |
| Lead Time | Avg days between booking and check-in | |
| Cancellation Rate | Cancellations / Total Bookings | |

---

## AI Intelligence Features

### 1. Weekly AI Briefing
Automatically generated every Monday morning:
```
"This week summary for [Hotel Name]:
- RevPAR is $127, up 12% from last year (🟢 strong)
- Occupancy dipped to 68% mid-week — likely due to the conference cancellation
- F&B revenue hit a record high ($18K) driven by the Sunday buffet
- Top 3 actions to take this week: ..."
```

### 2. Anomaly Detection
- Room category consistently below floor average
- Sudden booking pace slowdown
- Unusual cancellation spike
- Revenue source shift (OTA vs direct)

### 3. "Ask Your Data" (Natural Language Query)
Manager can type:
- "How did we do last August vs this August?"
- "Which room type is most profitable?"
- "What's our best booking source this quarter?"

**নিরাপদ flow (raw SQL নয়):**
Claude → `{ metric, range, groupBy }` propose → server zod validate → predefined parameterized query (read-only role, tenantId server-injected) → chart + Claude explanation।

### 4. Recommendation Engine
Based on current metrics, suggests:
- "Launch a mid-week promotion — Tue/Wed OCC is 45%"
- "Consider raising rates for the upcoming long weekend"
- "Your direct booking rate dropped — check OTA commission costs"

---

## Database Schema

```prisma
model RevenueSnapshot {
  id           String   @id @default(cuid())
  hotelId      String
  snapshotDate DateTime
  period       String   // "daily" | "weekly" | "monthly"

  totalRooms      Int
  availableRooms  Int
  roomsSold       Int
  occupancyRate   Float
  adr             Float
  revpar          Float
  roomRevenue     Float
  fbRevenue       Float?
  spaRevenue      Float?
  totalRevenue    Float
  cancellations   Int
  avgLeadTime     Float?

  bySource     Json?    // { "direct": 40%, "booking_com": 35%, ... }
  byRoomType   Json?    // { "deluxe": { adr: 150, occ: 0.8 }, ... }

  createdAt DateTime @default(now())

  hotel Hotel @relation(fields: [hotelId], references: [id])
  @@unique([hotelId, snapshotDate, period])
}

model AIInsight {
  id         String   @id @default(cuid())
  hotelId    String
  insightType String  // "weekly_briefing" | "anomaly" | "recommendation" | "query_response"
  period     String?
  content    Json     // structured insight data
  summary    String   // plain text for notification
  isRead     Boolean  @default(false)
  actionTaken Boolean @default(false)
  createdAt  DateTime @default(now())

  hotel Hotel @relation(fields: [hotelId], references: [id])
}
```

---

## API Endpoints

```
GET  /api/ai/revenue/dashboard              — summary metrics for dashboard
GET  /api/ai/revenue/trends?period=30d      — trend data for charts
GET  /api/ai/revenue/insights               — AI insights list
GET  /api/ai/revenue/insights/weekly        — this week's briefing
POST /api/ai/revenue/query                  — natural language query
GET  /api/ai/revenue/anomalies              — detected anomalies
GET  /api/ai/revenue/recommendations        — current recommendations
POST /api/ai/revenue/snapshot               — manually trigger snapshot
```

---

## "Ask Your Data" Implementation

**Design Decision**: Claude generates SQL → read-only DB user executes → Claude explains result.

```typescript
// Natural language → SQL → Result → Claude explanation
async function queryRevenue(hotelId: string, question: string) {

  // Step 1: Claude generates SQL
  // hotelId always injected — cross-tenant data leak impossible
  const sqlResponse = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    system: `You are a hotel revenue analyst. Generate PostgreSQL SELECT queries only.
             ALWAYS filter by hotelId = '${hotelId}'.
             Available tables: RevenueSnapshot, Reservation, Room, RatePlan.
             Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, or any DDL.
             Return only the SQL query, nothing else.`,
    messages: [{ role: 'user', content: question }],
    max_tokens: 512,
  })

  // Step 2: Validate SQL before executing
  const sql = extractSQL(sqlResponse)
  if (/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/i.test(sql)) {
    throw new Error('Invalid query generated')
  }

  // Step 3: Execute on read-only DB connection
  const data = await readonlyPrisma.$queryRawUnsafe(sql)

  // Step 4: Claude explains (no SQL in this call — explanation only)
  const explanation = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    messages: [{
      role: 'user',
      content: `Question: ${question}\nData: ${JSON.stringify(data)}\n
                Give a concise manager-friendly answer. 2-3 sentences max.`
    }],
    max_tokens: 256,
  })

  return { data, explanation, chartConfig: inferChartType(question, data) }
}
```

**Security controls**:
- Read-only DB user — `GRANT SELECT` only, no INSERT/UPDATE/DELETE
- `hotelId` always injected by server, never from user input
- SQL validated by regex before execution
- Output tokens capped at 256 (explanation only)

---

## Frontend UI

### Revenue Dashboard
```
┌─────────────────────────────────────────────────────┐
│  📊 Revenue Intelligence          [This Month ▼]    │
├──────────┬──────────┬──────────┬────────────────────┤
│ RevPAR   │ ADR      │ OCC%     │ Total Revenue      │
│ $127     │ $187     │ 68%      │ $142,000           │
│ ↑12% YoY│ ↑8% YoY  │ ↓3% YoY  │ ↑15% YoY           │
├──────────┴──────────┴──────────┴────────────────────┤
│  [Trend Chart — RevPAR last 12 months]              │
├─────────────────────────────────────────────────────┤
│  🤖 AI Insights                                     │
│  "Mid-week occupancy is weak. Consider a 15%        │
│   promotion for Tue–Thu stays."   [Create Offer →]  │
│                                                     │
│  "Direct bookings down 8% vs last month.            │
│   Review OTA rate parity."        [View Rates →]   │
├─────────────────────────────────────────────────────┤
│  💬 Ask your data                                   │
│  [Which room type had best RevPAR last quarter?   ] │
│                                            [Ask →]  │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1 — Revenue Snapshots + Dashboard (1.5 weeks)
- [ ] Daily revenue snapshot job
- [ ] Dashboard API with key metrics
- [ ] Trend charts
- [ ] Revenue breakdown by source and room type

### Phase 2 — AI Insights + Anomalies (1 week)
- [ ] Weekly briefing generation (Claude)
- [ ] Anomaly detection algorithm
- [ ] Recommendation engine
- [ ] Insight notification system

### Phase 3 — Natural Language Query (1 week)
- [ ] "Ask your data" UI
- [ ] Claude SQL generation (read-only)
- [ ] Auto chart type inference
- [ ] Query history

---

## Files to Create/Modify

```
apps/api/src/routes/ai/revenue.ts              — endpoints
apps/api/src/services/ai/revenueIntelligence.ts — core AI logic
apps/api/src/jobs/daily-revenue-snapshot.ts    — scheduled job
apps/api/src/jobs/weekly-briefing.ts           — weekly briefing job
apps/web/src/pages/revenue/                    — dashboard UI
packages/database/prisma/schema.prisma         — models
```

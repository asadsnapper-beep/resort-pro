# SMS & WhatsApp Marketing — Campaign Manager
**Resort owner-দের জন্য CRM-style bulk messaging system**

---

## কেন এটা দরকার

Resort owner তার dashboard থেকে guests-দের:
- **Promotional offer** পাঠাতে চায় — "এই ঈদে 20% ছাড়"
- **Seasonal reminder** দিতে চায় — "শীতকালীন package এসে গেছে"
- **Past guest follow-up** করতে চায় — "আবার আসুন, বিশেষ অফার আছে"
- **Event announcement** দিতে চায় — "নতুন restaurant খুলেছে"

এখন শুধু **transactional** SMS আছে (booking confirm, payment, etc.)।
Marketing campaign = owner নিজে লিখে নিজে পাঠাবে, যখন চাইবে।

---

## Feature Scope

### Phase 1 — Basic Broadcast (এটাই build করব, ~3 weeks)

```
Campaign Manager
├── New Campaign
│   ├── Channel: SMS / WhatsApp / Both
│   ├── Audience: segment filter
│   ├── Message: লেখো (character counter)
│   └── Send: এখনই / schedule
│
├── Campaign List
│   ├── Status: Draft / Scheduled / Sending / Sent
│   ├── Reach: কতজনকে গেছে
│   └── Delivered: কতটা delivered
│
└── Templates
    ├── Save message as template
    └── Reuse for next campaign
```

### Phase 2 — Advanced (পরে, ~4 weeks)
- A/B testing (দুটো message, দেখো কোনটা বেশি reply পায়)
- Personalization tokens: `{guest_name}`, `{resort_name}`, `{checkin_date}`
- Auto-campaign trigger: "guest check-out করার 7 দিন পরে automatically message পাঠাও"
- Opt-out management / STOP list

---

## UI — Dashboard Navigation

Sidebar-এ নতুন menu item:

```
GUESTS
  ├── Guests
  ├── Help & Docs
  └── Marketing          ← নতুন
       ├── Campaigns
       └── Templates
```

---

## UI — Campaigns Page (`/dashboard/marketing`)

```
┌─────────────────────────────────────────────────────────┐
│  📣 Marketing Campaigns              [+ New Campaign]   │
│  Reach your guests via SMS & WhatsApp                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [All] [Draft] [Scheduled] [Sent]                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🎉 Eid Special Offer           Sent • May 15      │  │
│  │ SMS • 142 recipients           138 delivered ✓    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🌿 Summer Package Launch       Scheduled • May 25 │  │
│  │ WhatsApp • 89 recipients       Sends in 5 days    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## UI — New Campaign (Step-by-step wizard)

### Step 1 — Channel
```
কোন channel এ পাঠাবে?

  [📱 SMS]    [💬 WhatsApp]    [📱+💬 Both]
```

### Step 2 — Audience
```
কাদের পাঠাবে?

  ○ All Guests            (সব guests যাদের phone number আছে)
  ○ Past Guests           (যারা কমপক্ষে একবার এসেছে)
  ○ Upcoming Guests       (আগামী 7/14/30 দিনে check-in আছে)
  ○ Guests by Date Range  (নির্দিষ্ট সময়ে যারা এসেছিল)
  ○ VIP / Repeat Guests   (2+ বার এসেছে)
  ○ Custom Tags           (tag দিয়ে filter করো)

  Preview: "এই filter-এ 142 জন guest আছে"
```

### Step 3 — Message
```
Message লিখো:

  ┌────────────────────────────────────────────┐
  │ Palm Paradise Resort:                       │
  │ এই ঈদে আমাদের বিশেষ অফার! 2 রাত বুক করলে  │
  │ 20% ছাড়। সীমিত রুম। বুক করুন:             │
  │ palmparadise.com/eid-offer                  │
  └────────────────────────────────────────────┘
  
  157 / 160 characters  (1 SMS)
  
  [Insert Token ▼]  →  {guest_name}, {resort_name}
  [Use Template ▼]
  [Save as Template]
```

### Step 4 — Schedule
```
কখন পাঠাবে?

  ○ এখনই পাঠাও
  ○ Schedule করো  →  [Date picker] [Time picker]

  ⚠️ রাত 10টার পরে বা সকাল 8টার আগে schedule করা যাবে না
     (BTRC guideline)
```

### Step 5 — Review & Send
```
Campaign Summary:

  Channel:    SMS
  Audience:   Past Guests (142 জন)
  Message:    "Palm Paradise Resort: এই ঈদে..."
  Cost:       142 SMS × 0.30 BDT = ~42.60 BDT
  Credits:    Available: 0 / Plan quota: 100 SMS (58 used)
              Remaining: 42 SMS free + 100 paid credits
  
  [← Back]                    [🚀 Send Campaign]
```

---

## UI — Campaign Detail Page

```
┌──────────────────────────────────────────────────────────┐
│  ← Back    Eid Special Offer                    [Sent]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📊 Stats                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   142    │  │   138    │  │    4     │              │
│  │ Sent     │  │ Delivered│  │  Failed  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  📝 Message Preview                                      │
│  "Palm Paradise Resort: এই ঈদে আমাদের বিশেষ অফার!..."  │
│                                                          │
│  👥 Recipient List                     [Export CSV]     │
│  ┌────────────────┬───────────┬────────────────────┐   │
│  │ Name           │ Phone     │ Status             │   │
│  ├────────────────┼───────────┼────────────────────┤   │
│  │ Karim Hossain  │ +880171.. │ ✅ Delivered        │   │
│  │ Rina Begum     │ +880191.. │ ✅ Delivered        │   │
│  │ Rafiq Ahmed    │ +880181.. │ ❌ Failed           │   │
│  └────────────────┴───────────┴────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Database Schema

```prisma
model MarketingCampaign {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])

  name         String
  channel      String   // "sms" | "whatsapp" | "both"
  status       String   @default("draft")  // draft | scheduled | sending | sent | failed

  // Audience
  audienceType String   // all | past | upcoming | date_range | vip | custom
  audienceFilter Json?  // { dateFrom, dateTo, minStays, tags[] }
  recipientCount Int    @default(0)

  // Message
  message      String
  templateId   String?

  // Schedule
  scheduledAt  DateTime?
  sentAt       DateTime?

  // Stats
  deliveredCount Int @default(0)
  failedCount    Int @default(0)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  logs         CampaignLog[]
}

model CampaignLog {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     MarketingCampaign @relation(fields: [campaignId], references: [id])

  guestId      String?
  guestName    String?
  phone        String
  channel      String   // sms | whatsapp
  status       String   // queued | sent | delivered | failed
  error        String?
  sentAt       DateTime?

  createdAt    DateTime @default(now())
}

model MessageTemplate {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])

  name         String
  channel      String   // sms | whatsapp | both
  message      String
  usageCount   Int      @default(0)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## API Endpoints

```
# Campaigns
GET    /api/marketing/campaigns              → list (filter by status)
POST   /api/marketing/campaigns              → create campaign
GET    /api/marketing/campaigns/:id          → get detail + stats
DELETE /api/marketing/campaigns/:id          → delete draft only

# Campaign Actions
POST   /api/marketing/campaigns/:id/send     → send now
POST   /api/marketing/campaigns/:id/schedule → schedule
POST   /api/marketing/campaigns/:id/cancel   → cancel scheduled

# Audience Preview
POST   /api/marketing/audience-preview       → count matching guests

# Templates
GET    /api/marketing/templates
POST   /api/marketing/templates
PUT    /api/marketing/templates/:id
DELETE /api/marketing/templates/:id
```

---

## Send Flow (Backend)

```
Campaign Send করলে:
  1. Guest DB থেকে filter করে phone numbers collect করো
  2. "sending" status set করো
  3. প্রতিটা number-এ BullMQ job queue করো (batch করে)
  4. Worker টা SSL Wireless / Meta API call করে
  5. Response অনুযায়ী CampaignLog update করো (delivered/failed)
  6. সব শেষে campaign status = "sent", stats update
  7. Platform pool হলে: smsUsedThisMonth বাড়াও
```

---

## Important Rules

### Compliance (BTRC / Meta)
- রাত **10 PM — সকাল 8 AM** এর মধ্যে marketing SMS পাঠানো যাবে না
- WhatsApp Marketing Message = Meta-approved template লাগবে (বা conversation window এর মধ্যে)
- **Opt-out**: STOP reply করলে সেই number `blockedNumbers` list-এ যাবে, আর কোনো campaign পাবে না
- Guest number **collect করার সময় consent** নেওয়া উচিত (booking form-এ checkbox)

### Cost Protection
- Send করার আগে quota/credits check করবে
- Quota শেষ হলে error দেখাবে — "Credits কম, buy করুন"
- Partial send হবে না — হয় সব, নয় কিছুই না

---

## Implementation Order

```
Week 1
  ✦ Prisma schema: MarketingCampaign, CampaignLog, MessageTemplate
  ✦ API: CRUD + audience-preview endpoint
  ✦ Sidebar-এ "Marketing" menu যোগ করো

Week 2
  ✦ /dashboard/marketing — campaigns list page
  ✦ /dashboard/marketing/new — 5-step wizard UI
  ✦ Campaign detail page (stats + recipient list)

Week 3
  ✦ BullMQ send queue (SMS + WhatsApp worker)
  ✦ Delivery status tracking
  ✦ Schedule support (cron check every minute)
  ✦ Templates page

Testing
  ✦ BYOC mode দিয়ে test campaign পাঠাও
  ✦ Quota enforcement test
  ✦ Schedule test
```

---

## Estimated Effort

| Task | Est. |
|------|------|
| Schema + API | 4–5 days |
| Campaign list + detail UI | 2–3 days |
| New campaign wizard (5 steps) | 3–4 days |
| Send queue (BullMQ) | 2–3 days |
| Templates UI | 1–2 days |
| Testing + edge cases | 2 days |
| **Total** | **~3 weeks** |

---

## Revenue Angle

Resort owner নিজের credentials দিলে (BYOC mode):
- SSL Wireless bulk rate: **~0.25–0.30 BDT / SMS**
- 500 guests-দের Eid offer পাঠাতে cost: **~150 BDT**
- একটা booking এলে revenue: **5,000–20,000 BDT**
- ROI: **33x–133x**

Platform pool mode হলে:
- ResortPro credits থেকে কাটবে
- Extra credits: 100 SMS = BDT 40

---

*See also: [sms-whatsapp-notifications.md](./sms-whatsapp-notifications.md) — transactional notifications*
*See also: [sms-whatsapp-billing.md](./sms-whatsapp-billing.md) — quota & billing system*

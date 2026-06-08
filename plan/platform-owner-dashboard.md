# Platform Owner Dashboard — ResortPro Super Admin
**তুমি একটা SaaS business চালাচ্ছ — তোমার dashboard কেমন হওয়া উচিত**

---

## Context: তুমি কে?

তুমি ResortPro-এর **platform owner** — resort গুলোর owner না।
তোমার কাছে প্রতিটা resort একটা "customer" (tenant)।

তোমার প্রতিদিনের প্রশ্নগুলো:
- **টাকা:** এই মাসে কত MRR হলো? কোনো payment fail হয়েছে?
- **Growth:** কতজন নতুন sign up করল? কতজন trial থেকে paid হলো?
- **Health:** কোনো resort এর ব্যবহার কমে যাচ্ছে? Churn হওয়ার সম্ভাবনা কোনটায়?
- **Problems:** কোনো system error আছে? কেউ অভিযোগ করেছে?
- **Platform:** SMS কত গেছে? Server কেমন আছে?

---

## বর্তমানে কী আছে (Audit)

Admin panel-এ এখন যা আছে:

| Section | কী করে | অবস্থা |
|---------|--------|--------|
| Overview | Tenant count, MRR, churn risk | ✅ আছে, ভালো শুরু |
| Tenants | Tenant list, plan info | ✅ আছে |
| Users | সব users across tenants | ✅ আছে |
| Billing & MRR | Revenue overview | ✅ আছে |
| Themes | Website theme management | ✅ আছে |
| Audit Log | কে কী করেছে | ✅ আছে |
| Referrals | Referral tracking | ✅ আছে |
| Team | Admin users | ✅ আছে |
| Announcements | Platform-wide notice | ✅ আছে |
| GDPR | Data deletion | ✅ আছে |
| Enterprise | SLA management | ✅ আছে |
| Domains | Custom domain | ✅ আছে |
| Health | System health | ✅ আছে |
| Storage | File storage | ✅ আছে |
| Settings | Platform config | ✅ আছে |
| Export | Data export | ✅ আছে |

**ভালোই আছে।** কিন্তু একটা serious SaaS platform owner হিসেবে যা দরকার তার অনেকটাই নেই বা অসম্পূর্ণ।

---

## কী কী নেই বা অসম্পূর্ণ

### ১. Revenue-এর গভীর picture নেই
এখন শুধু MRR দেখা যায়। কিন্তু:
- এই মাসে কত new revenue এলো?
- কত revenue চলে গেল (churn)?
- Net Revenue Retention কত?
- কোন plan-এ সবচেয়ে বেশি revenue?
- আগামী মাসে expected revenue কত?

### ২. Growth funnel নেই
- কতজন sign up করল → কতজন product ব্যবহার করল → কতজন paid হলো
- Trial period-এ গড়ে কত দিন পরে paid হয়?
- কোথা থেকে customers আসছে?

### ৩. Feature Adoption জানা যায় না
- Booking module কতজন ব্যবহার করছে?
- SMS Marketing feature কেউ ব্যবহার করছে?
- কোন feature কেউ চেনে না — বাদ দেওয়া উচিত?

### ৪. SMS/WhatsApp platform cost নেই
- আমরা platform pool-এ SMS পাঠাই → কত টাকা যাচ্ছে?
- কোন tenant সবচেয়ে বেশি SMS ব্যবহার করছে?

### ৫. Revenue Goal নেই
- এই মাসের target কত? কতটুকু হলো?
- ৬ মাস পরে কোথায় থাকতে চাই?

### ৬. Impersonation / Support Mode নেই
- কোনো resort এর সমস্যা debug করতে হলে তাদের account-এ ঢুকতে হয়
- এখন সেটা সম্ভব না dashboard থেকে

### ৭. Infrastructure Cost tracking নেই
- Server কত টাকা লাগছে প্রতি মাসে?
- SMS, email, storage cost কত?
- MRR থেকে cost বাদ দিলে actual profit কত?
- Cost per tenant কত (আমার কাছে একটা resort চালাতে কত খরচ)?

---

## প্রস্তাবিত পূর্ণ Dashboard Structure

```
PLATFORM OWNER DASHBOARD
│
├── 📊 Overview                ← এখন আছে, upgrade দরকার
│
├── 💰 Revenue & Finance       ← নতুন, deep revenue analysis
│   ├── MRR / ARR Breakdown
│   ├── New vs Churned Revenue
│   ├── Failed Payments Queue
│   └── Upcoming Renewals
│
├── 📈 Growth                  ← নতুন
│   ├── Signup Trend
│   ├── Trial → Paid Funnel
│   ├── Time-to-Convert
│   └── Source Tracking
│
├── 🏨 Tenants                 ← আছে, upgrade দরকার
│   ├── Full List + Search
│   ├── Tenant Detail (deep dive)
│   ├── Impersonation Mode ←  নতুন
│   └── Plan Management
│
├── 🧩 Feature Adoption        ← নতুন
│   ├── Per-feature usage %
│   ├── Active vs Inactive tenants
│   └── Feature health score
│
├── 📱 SMS & Platform Usage    ← নতুন (আমরা SMS system বানিয়েছি)
│   ├── Total SMS this month
│   ├── Per-tenant breakdown
│   └── Platform pool cost
│
├── 🎯 Goals & Milestones      ← নতুন
│   ├── Monthly MRR target
│   └── Milestones (BDT 1L, 5L, 10L MRR)
│
├── 💸 Infrastructure Costs    ← নতুন
│   ├── Auto-tracked: SMS, Email, Storage, Stripe fees
│   ├── Manual entry: Server, DB, Web hosting
│   ├── Profit = MRR − Total Cost
│   └── Cost per tenant
│
├── 🔔 Alerts & Actions        ← নতুন
│   ├── Failed payments (fix now)
│   ├── Trials ending tomorrow
│   ├── High churn risk tenants
│   └── System errors
│
└── বাকিগুলো (আগের মতো)
    ├── Themes, Audit Log, Team, Announcements
    ├── GDPR, Enterprise, Domains
    ├── Health, Storage, Settings, Export, Referrals
```

---

## Section-by-Section বিস্তারিত

---

### 📊 Overview (Upgrade)

**এখন আছে:** Tenant count, MRR, total bookings, churn risk list।

**যা যোগ করতে হবে:**

```
┌──────────────────────────────────────────────────────────────────┐
│  ResortPro Platform — May 2026                                   │
│                                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ MRR     │ │ ARR     │ │ Paying  │ │ Trial   │ │ Churn   │  │
│  │ ৳2.4L   │ │ ৳28.8L  │ │ 42      │ │ 11      │ │ 2.1%    │  │
│  │ +12% ↑  │ │         │ │ tenants │ │ active  │ │ this mo │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                   │
│  Revenue Trend (12 months)          New Signups (30 days)       │
│  ┌───────────────────────────┐       ┌──────────────────────┐   │
│  │ ████████████████         │       │  ·  ·  · ···  ·····  │   │
│  │ Jan Feb Mar Apr May ...  │       │  M  T  W  T  F  S  S │   │
│  └───────────────────────────┘       └──────────────────────┘   │
│                                                                   │
│  🚨 Needs Attention                                              │
│  • 3 failed payments — collect now                               │
│  • 5 trials ending in 3 days                                     │
│  • 2 high churn risk tenants                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

### 💰 Revenue & Finance (নতুন)

**Platform owner হিসেবে সবচেয়ে গুরুত্বপূর্ণ section।**

```
Revenue Breakdown — May 2026

  New MRR:         +৳45,000   (৯ নতুন paying customers)
  Expansion MRR:   +৳12,000   (৪ জন plan upgrade করেছে)
  Churned MRR:     -৳8,000    (২ জন cancel করেছে)
  Contraction MRR: -৳3,000    (১ জন downgrade করেছে)
  ─────────────────────────────────────────
  Net New MRR:     +৳46,000 ✅

  Plan Distribution:
  Free:         12 tenants  →  ৳0
  Starter:      18 tenants  →  ৳54,000
  Professional: 20 tenants  →  ৳1,60,000
  Enterprise:    4 tenants  →  ৳1,00,000
                             ──────────
  Total MRR:               ৳3,14,000
```

**Failed Payments Queue:**
```
  ⚠️ Cox's Bay Resort — ৳8,000 — Card declined (3 days ago)  [Retry] [Email]
  ⚠️ Sundarbans Inn   — ৳4,500 — Expired card (1 day ago)   [Retry] [Email]
```

**Upcoming Renewals (7 days):**
```
  Padma Garden Resort  →  ৳8,000  →  May 28
  Hill View Hotel      →  ৳8,000  →  May 29
  Sea Pearl Resort     →  ৳4,500  →  May 30
```

---

### 📈 Growth Analytics (নতুন)

**Trial → Paid Funnel:**
```
  Signed up (this month):        47
      ↓ Activated product:       38  (81%)
          ↓ Used core feature:   29  (76%)
              ↓ Converted paid:  11  (38%)

  Avg. days trial → paid:  8.3 days
  Best converting plan:    Professional (42%)
```

**Signup Sources:**
```
  Organic Search:    34%  ██████████
  Direct:            28%  ████████
  Referral:          21%  ██████
  Social (Facebook): 11%  ███
  Other:              6%  ██
```

**Geographic:**
```
  Cox's Bazar:    38%  (resort hub)
  Dhaka:          22%  (urban hotels)
  Sylhet:         15%
  Chittagong:     12%
  Others:         13%
```

---

### 🏨 Tenants (Upgrade)

**যা যোগ করতে হবে:**

**Impersonation Mode** — সবচেয়ে দরকারি support tool:
```
Tenants List → [Cox's Bay Resort] → [ 👤 Login as Owner ]
                                           ↓
                              Admin-এর নিজের session রেখে
                              সেই tenant-এর dashboard-এ ঢোকা
                              (debug / support করার জন্য)
                                           ↓
                              Dashboard-এ লাল banner:
                              "⚠️ You are viewing as Cox's Bay Resort
                               [Exit Impersonation]"
```

**Tenant Deep Dive:**
```
Cox's Bay Resort — Professional Plan — Active

  Bookings this month:  47
  Revenue processed:    ৳3,40,000
  Last owner login:     2 days ago
  SMS sent:             142
  Active staff:         8
  Rooms:                12

  Feature Adoption:
  ✅ Bookings        ✅ Invoices       ✅ Housekeeping
  ✅ Guests          ⬜ SMS Marketing  ⬜ Loyalty
  ⬜ Channel Sync    ✅ Website

  Churn Risk: 🟢 LOW
  Reason: Active daily, growing bookings
```

---

### 🧩 Feature Adoption (নতুন)

**কোন feature কাজে লাগছে, কোনটা কেউ ব্যবহার করছে না:**

```
Feature           Active Tenants    % Adoption    Trend
─────────────────────────────────────────────────────
Bookings          53 / 53          100%          →
Invoices          48 / 53           91%          →
Housekeeping      41 / 53           77%          ↑
Guest Profiles    39 / 53           74%          →
Expenses          31 / 53           58%          ↑
Website Builder   27 / 53           51%          →
CRM & Email       18 / 53           34%          →
Loyalty Program   11 / 53           21%          ↑
SMS Marketing      6 / 53           11%          ↑ (নতুন feature)
Channel Sync       4 / 53            8%          →
Group Bookings     8 / 53           15%          →
```

**Insight:** Channel Sync মাত্র ৮% use করছে — হয় feature কঠিন, নয় কেউ জানে না।
→ Action: Announcement দাও, onboarding guide বানাও।

---

### 📱 SMS & Platform Usage (নতুন)

**ResortPro-এর নিজস্ব SMS cost track করতে হবে:**

```
Platform SMS Pool — May 2026

  Total Sent:        2,847 SMS
  Delivered:         2,791 (98%)
  Failed:               56 (2%)

  Platform Cost:     ~৳854  (@ ৳0.30/SMS)
  BYOC Tenants:       8  (নিজের SSL Wireless account)
  Pool Tenants:      45  (ResortPro-এর account থেকে)

  Top 5 Users (Pool):
  Cox's Bay Resort     → 342 SMS
  Sundarbans Hotel     → 287 SMS
  Hill View Resort     → 201 SMS
  Sea Pearl            → 189 SMS
  Padma Garden         → 156 SMS

  WhatsApp (Pool):
  Total Conversations: 423
  Cost:               Free tier-এ আছে (< 1000/month)
```

---

### 🎯 Goals & Milestones (নতুন)

**SaaS business-এ target না থাকলে কোথায় যাচ্ছ বুঝবে না:**

```
Monthly Goals — May 2026

  MRR Target:    ৳3,50,000
  Current MRR:   ৳3,14,000
  Progress:      ██████████████████░░  89.7%

  New Paid:      Target 15 / Got 11
  Churn Rate:    Target < 3% / Current 2.1% ✅

Revenue Milestones:
  ✅ ৳1,00,000 MRR — Achieved Jan 2026
  ✅ ৳2,00,000 MRR — Achieved Mar 2026
  🔄 ৳5,00,000 MRR — On track (est. Aug 2026)
  ⏳ ৳10,00,000 MRR — (est. Dec 2026)
  ⏳ 100 Paying Tenants — (est. Sep 2026)
```

---

### 💸 Business Costs & P&L (নতুন)

**শুধু server cost না — ResortPro চালাতে মোট কত খরচ, আর মোট profit কত।**

এটা আসলে তোমার business-এর **Profit & Loss statement** — real-time।

---

#### সব Cost Categories

```
📦 ১. Infrastructure          ← server, DB, hosting
📣 ২. Marketing & Ads         ← FB ads, Google ads, content
🛠️ ৩. Tools & Software        ← Figma, Notion, Sentry
👷 ৪. People & Freelancers    ← developer payment, designer
⚖️ ৫. Legal & Compliance      ← TIN, trade license, accountant
🌐 ৬. Domain & Security       ← domain renewal, SSL
📦 ৭. Other                   ← miscellaneous
```

---

#### কোনগুলো Auto-tracked হবে (system নিজেই জানে)

```
✅ Auto-tracked:

  SMS (SSL Wireless platform pool)
    Sent: 2,847 × ৳0.30 = ৳854/mo

  Email (Resend/SendGrid)
    Sent: 12,400 × $0.001 = ~৳110/mo

  Storage (S3 / Cloudflare R2)
    Used: 18.4 GB × $0.015/GB = ~৳25/mo

  Stripe Processing Fees (estimate)
    ৳3,14,000 × 2.9% + 53 transactions × ৳88 = ~৳13,770/mo
```

---

#### কোনগুলো Manually Enter করতে হবে

```
❌ Manual entry লাগবে — কিন্তু একবার set করলে প্রতি মাসে auto-carry হবে:

📦 Infrastructure
  API Server (Railway/Render)   ৳4,200/mo   [Recurring]
  Web Hosting (Vercel)          ৳1,500/mo   [Recurring]
  Database (Supabase)           ৳3,800/mo   [Recurring]
  Domain (.com)                 ৳1,200/yr   → ৳100/mo
  SSL Certificate               ৳0 (Let's Encrypt)

📣 Marketing & Ads
  Facebook Ads                  ৳8,000/mo   [Recurring বা One-time]
  Instagram Ads                 ৳3,000/mo   [Recurring]
  Google Ads                    ৳0          (এখন নেই)
  Content creation              ৳2,000/mo   [Recurring]
  Influencer / Review           ৳5,000      [One-time]
  SEO Tools (Ahrefs)            ৳2,500/mo   [Recurring]

🛠️ Tools & Software
  Figma (Design)                ৳1,200/mo   [Recurring]
  Notion (Docs/PM)              ৳800/mo     [Recurring]
  Sentry (Error tracking)       ৳0          (free tier)
  Postman / API tools           ৳0          (free)

👷 People & Freelancers
  Frontend Developer            ৳25,000     [One-time]
  Logo / Branding Design        ৳8,000      [One-time]
  Content Writer (Bangla)       ৳3,000/mo   [Recurring]

⚖️ Legal & Compliance
  Trade License (yearly)        ৳5,000/yr   → ৳416/mo
  Tax Consultant / CA           ৳3,000/mo   [Recurring]
  Lawyer (if needed)            ৳10,000     [One-time]
```

---

#### UI — Business P&L Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  💸 Business P&L — May 2026                [Month ▾] [Export]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  INCOME                                                          │
│  ──────────────────────────────────────────────────────         │
│  MRR (Subscription)                          ৳3,14,000          │
│                                                                   │
│  COSTS                                                           │
│  ──────────────────────────────────────────────────────         │
│                                                                   │
│  📦 Infrastructure              ৳19,467                          │
│     ├─ API Server (Railway)     ৳4,200   manual                 │
│     ├─ Web Host (Vercel)        ৳1,500   manual                 │
│     ├─ Database (Supabase)      ৳3,800   manual                 │
│     ├─ SMS (SSL Wireless)       ৳854     ✅ auto                 │
│     ├─ Email (Resend)           ৳110     ✅ auto                 │
│     ├─ Storage (R2)             ৳25      ✅ auto                 │
│     ├─ Stripe fees              ৳13,770  ✅ auto (estimate)      │
│     └─ Domain                   ৳100     manual                 │
│                                                                   │
│  📣 Marketing & Ads             ৳20,500                          │
│     ├─ Facebook Ads             ৳8,000   manual                 │
│     ├─ Instagram Ads            ৳3,000   manual                 │
│     ├─ Content Creation         ৳2,000   manual                 │
│     ├─ SEO Tools (Ahrefs)       ৳2,500   manual                 │
│     └─ Influencer (one-time)    ৳5,000   manual                 │
│                                                                   │
│  🛠️ Tools & Software            ৳2,000                           │
│     ├─ Figma                    ৳1,200   manual                 │
│     └─ Notion                   ৳800     manual                 │
│                                                                   │
│  👷 People & Freelancers        ৳3,000                           │
│     └─ Content Writer           ৳3,000   manual                 │
│                                                                   │
│  ⚖️ Legal & Compliance          ৳3,416                           │
│     ├─ Tax Consultant           ৳3,000   manual                 │
│     └─ Trade License (monthly)  ৳416     manual                 │
│                                                                   │
│  ──────────────────────────────────────────────────────         │
│  Total Cost:                              ৳48,383                │
│                                                                   │
│  ══════════════════════════════════════════════════════         │
│  Net Profit:                              ৳2,65,617  ✅         │
│  Profit Margin:                           84.6%                  │
│  Cost per Tenant:                         ৳913/month            │
│  ══════════════════════════════════════════════════════         │
│                                                                   │
│  Cost Trend vs Revenue (6 months)                               │
│  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░ Cost                           │
│  ████████████████████████████████ Revenue                       │
│                                                                   │
│  [+ Add Expense]  [📊 Category Breakdown]  [📥 Export CSV]      │
└──────────────────────────────────────────────────────────────────┘
```

---

#### Expense Entry Form

```
+ New Business Expense

  Name:        [ Facebook Ads — May Campaign      ]
  Category:    [ 📣 Marketing & Ads          ▾   ]
  Amount:      [ ৳8,000                           ]
  Currency:    [ BDT ▾ ]  (USD/BDT auto-convert হবে)
  Frequency:   [ Monthly ▾ ]
               Options:
                 One-time    → শুধু এই মাসে
                 Monthly     → প্রতি মাসে auto-add
                 Yearly      → yearly total, monthly ভাগ করে দেখাবে
  Month:       [ May 2026 ▾ ]
  Notes:       [ Reach campaign, 18-45 age, BD ]
  Receipt:     [ 📎 Upload (optional) ]

  [Save Expense]
```

---

#### Marketing ROI Tracking

Facebook/Instagram ads খরচ করলে result কী হলো সেটাও দেখাবে:

```
📣 Marketing ROI — May 2026

  Facebook Ads Spend:   ৳8,000
  Instagram Ads Spend:  ৳3,000
  Total Spend:          ৳11,000
  ─────────────────────────────────
  New Signups (this month):  47
  Attributed to Ads:         ~18  (38% estimate)
  Trial → Paid (from ads):    7
  Revenue from ads:          ৳21,000  (7 × avg ৳3,000/mo)
  ─────────────────────────────────
  ROI:  ৳21,000 / ৳11,000 = 1.9x  ✅
  CPL:  ৳11,000 / 18 = ৳611/signup
  CAC:  ৳11,000 / 7 = ৳1,571/paid customer

  Note: Ad attribution is estimated.
        Exact data requires UTM tracking + signup source field.
```

---

#### Database Schema

```prisma
model PlatformExpense {
  id          String   @id @default(cuid())
  name        String                    // "Facebook Ads — May"
  category    String                    // "marketing" | "infrastructure" |
                                        // "tools" | "people" | "legal" | "other"
  amount      Float                     // সব BDT-তে store করব
  currency    String   @default("BDT")  // "BDT" | "USD"
  exchangeRate Float?                   // USD হলে সেদিনের rate
  amountBDT   Float                     // calculated BDT amount
  frequency   String   @default("one_time") // "one_time" | "monthly" | "yearly"
  month       Int                       // 5 (May)
  year        Int                       // 2026
  notes       String?
  receiptUrl  String?
  isAuto      Boolean  @default(false)  // system-generated (SMS, email, storage)
  source      String?                   // "ssl_wireless" | "resend" | "stripe" | null
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([year, month])
  @@index([category])
  @@map("platform_expenses")
}
```

---

#### মাসের শেষে যা দেখবে

```
May 2026 — Business Summary

  Revenue:    ৳3,14,000
  Costs:      ৳48,383
  ─────────────────────
  Profit:     ৳2,65,617  (84.6% margin)

  Biggest cost:  Stripe fees ৳13,770  (28% of total cost)
  Marketing ROI: 1.9x (৳11k spent → ৳21k revenue attributed)
  Free tenants:  12 (costing ৳10,956, earning ৳0)
  
  💡 Insight: Free tenants কমানো বা convert করলে
     margin 88%+ হবে।
```

---

### 🔔 Smart Alerts (নতুন)

**প্রতিদিন সকালে এটা দেখলেই বুঝবে কী করতে হবে:**

```
⚡ TODAY'S ACTION LIST

🔴 Critical (এখনই করো):
   • Cox's Bay Resort payment ৳8,000 failed — 3 days ago
     [Send Email] [Retry Card] [Call]

🟡 Important (আজকের মধ্যে):
   • 5 trials ending in ≤ 3 days (promote conversion)
     Sundarbans Inn (2 days), Hill View (3 days) ...
     [Send Upgrade Email to All]

🟢 Watch:
   • Padma Garden Resort — login 0 days last 14 days
     Churn risk HIGH — last booking was 3 weeks ago
     [View Tenant] [Send Check-in Email]
```

---

## Admin Role দিয়ে কে কী দেখবে

Platform owner-এর admin panel-এ নিজেও team আছে:

| Admin Role | Access |
|------------|--------|
| **SUPER_ADMIN** | সব কিছু — impersonation, billing, settings, team management |
| **SUPPORT** | Tenants (view + impersonate), Audit log, Health — revenue দেখবে না |
| **FINANCE** | Revenue, Billing, Failed payments, MRR — tenant data দেখবে না |
| **VIEWER** | শুধু Overview stats — read-only সব জায়গায় |

---

## বর্তমান Admin Panel-এর কী উন্নতি দরকার

### Priority 1 — এখনই দরকার
- [ ] **Impersonation Mode** — support দিতে গেলে এটা ছাড়া চলে না
- [ ] **Revenue Breakdown** — New / Expansion / Churned MRR আলাদা দেখাও
- [ ] **Failed Payments Queue** — action বোতাম সহ
- [ ] **Smart Alerts** — daily action list

### Priority 2 — পরের মাসে
- [ ] **Growth Funnel** — signup → activation → conversion
- [ ] **Feature Adoption** — কোন feature কে ব্যবহার করছে
- [ ] **SMS Usage Overview** — platform cost tracking
- [ ] **Goals & Milestones** — MRR target set করা
- [ ] **Infrastructure Costs** — auto-tracked + manual entry, profit margin দেখাবে

### Priority 3 — ৩ মাসের মধ্যে
- [ ] **Tenant Health Score** — algorithmic churn prediction
- [ ] **Revenue Forecasting** — আগামী ৩ মাসে কত MRR হবে
- [ ] **Cohort Analysis** — জানুয়ারির signups এখন কেমন আছে?
- [ ] **NPS Survey** — tenant satisfaction score

---

## Estimated Effort

| Section | কাজের পরিমাণ |
|---------|-------------|
| Impersonation Mode | 2–3 days |
| Revenue Breakdown upgrade | 2 days |
| Failed Payments queue | 1 day |
| Smart Alerts | 2 days |
| Growth Funnel | 3–4 days |
| Feature Adoption | 2–3 days |
| SMS Usage Overview | 1–2 days |
| Goals & Milestones | 1–2 days |
| Infrastructure Costs (auto-track + manual) | 2–3 days |
| **Total** | **~3.5 weeks** |

---

## এক লাইনে চিন্তা

> Resort owner-রা তোমার **product** ব্যবহার করে তাদের **business** চালায়।
> তোমার dashboard তোমাকে বলবে — তোমার **business** কেমন চলছে।
> এই দুটো সম্পূর্ণ আলাদা জিনিস।

---

*Related: [sms-whatsapp-billing.md](./sms-whatsapp-billing.md) — per-tenant SMS billing*
*Related: [roles-permissions.md](./roles-permissions.md) — admin role structure*

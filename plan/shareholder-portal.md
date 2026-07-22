# ResortPro — Shareholder Portal (Ownership & Payout Tracking)

## Overview

Ekhon `SHAREHOLDER` role already ache (Prisma `UserRole` enum-e), kintu eta **generic staff invite-er moto treat kora hoy** — shudhu email + role, kono ownership %, payout, ba investor-specific data capture hoy na. Resort-er real-life 50-jon shareholder থাকলে, kew jane na tar exact share koto, kobe koto payout peyeche, ba kano ei mash-er expense বেশি — shob WhatsApp/spreadsheet-e manually hoy.

Ei plan **duita user-er problem** eksathe shomadhan kore:
- **Shareholder** (passive investor): "amar % ki, amar bhag koto, taka kothay gelo"
- **Owner** (founder): "shareholder-der bhorosha rakhbo, kintu shomoy nosto na kore, r sensitive data (staff salary) lukiye rakhbo"

---

## ১. Full Flow

```
Owner "Add Shareholder" click kore:
  → Existing staff-invite flow-i use hoy, kintu role=SHAREHOLDER select korle
    ekstra field ashe: "Ownership %"

  → System check kore: total allocated % + notun % > 100% hole error
    ("Only 15% remaining — you tried to add 20%")

  → Invite email jay (existing flow-i), shareholder join kore

Proti mash automatic:
  → System calculate kore: (net profit × ownership %) = shareholder-er share
  → Email-e "Monthly Investor Update" pathay — number + short context note

Owner jokhon payout dey (bank/bKash/cash-e, ResortPro-r bahire):
  → Owner "Record Payout" e amount + date + method + note likhe save kore
  → Shareholder-er nijer dashboard-e oita history-te jog hoy

Shareholder login kore dekhe:
  → Nijer % ownership
  → Ei mash-er calculated share (estimate, actual payout na hole o)
  → Payout history (kobe koto peyeche)
  → Monthly report archive
  → Onno shareholder-der % dekhte pay na (privacy)
```

---

## ২. Owner Dashboard — Shareholders Page

### `/dashboard/shareholders` (OWNER-only, notun sidebar item — Account group)

```
┌────────────────────────────────────────────────────────────┐
│  Shareholders                          [+ Add Shareholder] │
│                                                              │
│  Ownership Allocated: 85% ▓▓▓▓▓▓▓▓▓░░  15% remaining        │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Rahim Uddin              15%          [Edit] [Record Payout]│
│  rahim@email.com          Joined: Jan 2026                  │
│  This month's est. share: ৳4,500                             │
│  Last payout: ৳12,000 (May 2026)                             │
│  ─────────────────────────────────────────────────────────  │
│  Karim Ahmed               8%          [Edit] [Record Payout]│
│  karim@email.com          Joined: Mar 2026                  │
│  This month's est. share: ৳2,400                             │
│  Last payout: — (none yet)                                   │
│  ─────────────────────────────────────────────────────────  │
│  ... (48 more)                                                │
└────────────────────────────────────────────────────────────┘
```

### "Add Shareholder" modal (ModalShell — existing invite flow + new field)

```
┌──────────────────────────────────┐
│  Add Shareholder                 │
│                                   │
│  Email:   [___________________]  │
│  Ownership %: [___] %            │
│    (15% remaining — max allowed) │
│                                   │
│  [Cancel]        [Send Invite]   │
└──────────────────────────────────┘
```

### "Record Payout" modal

```
┌──────────────────────────────────┐
│  Record Payout — Rahim Uddin     │
│                                   │
│  Amount: ৳ [___________]         │
│  Date:   [___________]           │
│  Method: [Bank Transfer ▾]       │
│           (Bank / bKash / Cash)  │
│  Note:   [___________________]   │
│                                   │
│  [Cancel]        [Save Payout]   │
└──────────────────────────────────┘
```

---

## ৩. Shareholder's Own View

### `/dashboard` for SHAREHOLDER role — "My Investment" card (top of dashboard)

```
┌────────────────────────────────────────────────────────────┐
│  My Investment                                              │
│                                                              │
│  Ownership: 15%                                              │
│  This month's estimated share: ৳4,500                        │
│  (Based on ৳30,000 net profit this month)                    │
│                                                              │
│  Last payout: ৳12,000 — May 2026                              │
│  [View full payout history →]                                │
└────────────────────────────────────────────────────────────┘
```

### `/dashboard/my-shares` — full history page (SHAREHOLDER-only)

```
┌────────────────────────────────────────────────────────────┐
│  My Shares                                                  │
│                                                              │
│  Ownership: 15%  |  Joined: Jan 2026                          │
│                                                              │
│  Payout History                                              │
│  ─────────────────────────────────────────────────────────  │
│  ৳12,000   May 2026    Bank Transfer   "Q1 distribution"     │
│  ৳8,000    Feb 2026    bKash           "First payout"        │
│                                                              │
│  Monthly Reports                                              │
│  ─────────────────────────────────────────────────────────  │
│  📄 June 2026 report   [Download PDF]                        │
│  📄 May 2026 report    [Download PDF]                        │
└────────────────────────────────────────────────────────────┘
```

**Guardrail**: SHAREHOLDER role শুধু নিজের data দেখবে — অন্য shareholder-দের % বা payout দেখা যাবে না (privacy, owner-এর decision).

---

## ৪. Monthly Investor Update (Auto-Email)

```
Trigger: existing scheduled-report cron (daily-report-dispatch.ts-এর pattern
follow করে, মাসে একবার, 1st তারিখে)

প্রতি shareholder-কে আলাদা email:
  Subject: "Coral Bay Resort — June 2026 Investor Update"

  Body:
    - Net profit this month: ৳30,000 (+12% vs last month)
    - Your share (15%): ৳4,500
    - Occupancy: 68% (৳ revenue trend chart image or summary)
    - Owner's note: "AC repair-এর জন্য expense একটু বেশি ছিল এই মাসে —
      পরের মাস থেকে normal হয়ে যাবে।" (owner types this manually
      before send, optional — যদি না লেখে default summary যায়)
    - [View full report in dashboard →]

Owner control: email পাঠানোর আগে "Review & Send" step — owner
context note লিখে/skip করে confirm করবে, fully-auto blind email na.
```

---

## ৫. Database Schema

```prisma
// User model-এ shareholder-specific fields (SHAREHOLDER role হলেই relevant):
model ShareholderProfile {
  id               String    @id @default(cuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  ownershipPercent Float     // 0–100
  investedAmount   Float?    // optional — কত টাকা invest করেছে (reference only)
  joinedAt         DateTime  @default(now())
  notes            String?   // owner-only internal note about this shareholder

  payouts          Payout[]

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([tenantId])
}

model Payout {
  id                    String              @id @default(cuid())
  tenantId              String
  tenant                Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  shareholderProfileId  String
  shareholderProfile    ShareholderProfile  @relation(fields: [shareholderProfileId], references: [id], onDelete: Cascade)

  amount                Float
  method                String              // BANK_TRANSFER | BKASH | CASH | OTHER
  paidAt                DateTime
  note                  String?
  recordedBy            String              // owner's User id

  createdAt             DateTime            @default(now())

  @@index([tenantId])
  @@index([shareholderProfileId])
}

model InvestorReport {
  id               String    @id @default(cuid())
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  month            String    // "2026-06"

  netProfit        Float
  occupancyRate    Float
  ownerNote        String?   // context note owner adds before sending

  sentAt           DateTime?
  createdAt        DateTime  @default(now())

  @@unique([tenantId, month])
  @@index([tenantId])
}
```

**Validation rule** (application-level, not DB constraint): sum of all `ShareholderProfile.ownershipPercent` for a tenant must stay ≤ 100. Check on create/update.

---

## ৬. API Endpoints

```
// Owner (OWNER-only — more sensitive than regular staff invite)
POST   /api/shareholders/invite
  body: { email, ownershipPercent }
  → extends existing /api/staff/invite — validates total % ≤ 100

GET    /api/shareholders                     → list all + % + last payout (owner view)
PATCH  /api/shareholders/:id                 → update ownership %, notes
DELETE /api/shareholders/:id                 → remove shareholder (soft — keeps payout history)

POST   /api/shareholders/:id/payouts         → record a payout
GET    /api/shareholders/:id/payouts         → payout history for one shareholder

GET    /api/shareholders/summary             → total % allocated, count, this month's profit pool

POST   /api/shareholders/reports/:month/send → send monthly investor update
  body: { ownerNote?: string }
GET    /api/shareholders/reports             → list sent reports

// Shareholder (self-service, SHAREHOLDER role — scoped to own data only)
GET    /api/shareholders/me                  → own %, joined date, this month's est. share
GET    /api/shareholders/me/payouts          → own payout history
GET    /api/shareholders/me/reports          → own monthly report archive
```

---

## ৭. Sidebar / Navigation

```
Owner (OWNER role only):
  Account group → + "Shareholders" (icon: PieChart or Users)

Shareholder (SHAREHOLDER role):
  Daily-tier বা Overview group → + "My Shares" (icon: TrendingUp)
  Dashboard home-এ "My Investment" card সবার আগে (Quick Access button-এর
  মতো prominent — শেয়ারহোল্ডার প্রথম যা দেখবে)
```

---

## ৮. Permissions

```
Invite shareholder / set %/ record payout / send report:
  → OWNER only (MANAGER-ও না — এটা ownership-level sensitive, staff invite-এর
    চেয়ে বেশি guarded)

View own %/ payouts/ reports:
  → SHAREHOLDER (নিজের data-i, অন্য শেয়ারহোল্ডারের না)

View all shareholders' %/ payouts:
  → OWNER only
```

---

## ৯. Implementation Steps

```
Step 1 — Database (1 day)
  ✦ ShareholderProfile, Payout, InvestorReport models
  ✦ Relations to User + Tenant
  ✦ Migration

Step 2 — Backend API (2 days)
  ✦ Extend invite flow: ownershipPercent field + 100%-cap validation
  ✦ CRUD for shareholders (owner view)
  ✦ Payout record + history endpoints
  ✦ "me" scoped endpoints for shareholder self-service
  ✦ Monthly profit-share calculation (net profit × ownership %)

Step 3 — Owner Dashboard UI (2 days)
  ✦ /dashboard/shareholders — list, allocation bar, add/edit
  ✦ Record Payout modal (ModalShell)
  ✦ Add Shareholder modal (extends invite modal)

Step 4 — Shareholder Self-View UI (1 day)
  ✦ "My Investment" dashboard card
  ✦ /dashboard/my-shares — payout history + report archive

Step 5 — Monthly Auto-Report (1.5 days)
  ✦ Cron job (reuse daily-report-dispatch.ts pattern, monthly instead)
  ✦ "Review & Send" flow for owner (context note, approve before send)
  ✦ Email template (reuse wrapEmail branding)
  ✦ InvestorReport record + archive

Step 6 — Polish & Testing (0.5 day)
  ✦ 100%-allocation edge cases, empty states, role-guard tests

Total: ~7–8 days
```

---

## ১০. Open Questions (owner-এর decision লাগবে)

```
- Ownership % কি percentage-only, নাকি টাকার অঙ্কেও (investedAmount) track
  করা জরুরি lawyer/accounting-এর জন্য?
- Payout কি ResortPro-এর মধ্য দিয়েই process হবে (bKash/Stripe payout API),
  নাকি শুধু "record" (বাইরে টাকা পাঠানো হয়, এখানে শুধু log রাখা)?
    → এই plan ধরে নিয়েছে: শুধু record, payment processing না (scope ছোট রাখতে)
- Shareholder বাদ দিলে (exit) — historical payout data কি রাখা হবে,
  নাকি user মুছে গেলে সব মুছে যাবে? (এই plan: soft-delete, history থাকবে)
```

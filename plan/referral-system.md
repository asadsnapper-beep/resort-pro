# ResortPro — Referral System

## Overview

প্রতিটা resort owner একটা unique referral link পাবে। সেই link দিয়ে কেউ signup করলে Super Admin notification পাবে। Admin চাইলে referrer-কে reward দেবে — টাকা (credit) অথবা ১ বছরের free subscription।

---

## ১. কীভাবে কাজ করবে (Full Flow)

```
Owner পায়:
  Referral Link: https://app.resortpro.site/auth/register?ref=PALM25

কেউ সেই link দিয়ে signup করে → নতুন resort register হয়

Super Admin dashboard-এ:
  🔔 Notification: "Palm Paradise Resort referred a new signup — Blue Lagoon Resort"

Admin action:
  ○ কিছু করে না (organic referral)
  ● Credit দেয়: ৳5,000 account credit
  ● Free upgrade দেয়: 1 year PROFESSIONAL plan free
  ● Custom reward: যা খুশি
```

---

## ২. Owner Dashboard — Referral Section

### `/dashboard/referrals`

```
┌──────────────────────────────────────────────────────┐
│  Referral Program                                    │
│                                                      │
│  Your referral link:                                 │
│  ┌──────────────────────────────────────┐ [Copy] │  │
│  │ https://resortpro.site/ref/PALM25   │        │  │
│  └──────────────────────────────────────┘        │  │
│                                                      │
│  Share: [WhatsApp] [Email] [Facebook]               │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Total   │ │ Signed   │ │ Rewards  │            │
│  │ Clicks   │ │   Up     │ │ Earned   │            │
│  │   47     │ │    3     │ │ ৳15,000  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  Referral History:                                   │
│  ─────────────────────────────────────────────────  │
│  Blue Lagoon Resort          May 20, 2026            │
│  Signed up via your link     Status: ✅ Rewarded    │
│  Reward: 1 month free                                │
│                                                      │
│  Sea Breeze Hotel            Jun 1, 2026             │
│  Signed up via your link     Status: ⏳ Pending     │
│  Reward: (waiting for admin)                         │
└──────────────────────────────────────────────────────┘
```

---

## ৩. Signup Page — Referral Detection

```
URL: /auth/register?ref=PALM25

Signup form-এ referral code auto-detect হবে:

  ┌────────────────────────────────────────┐
  │  Create your account                   │
  │                                         │
  │  [Resort Name]                          │
  │  [Email]                               │
  │  [Password]                            │
  │                                         │
  │  ✅ Referred by: Palm Paradise Resort  │
  │     (You may receive a welcome bonus!) │
  │                                         │
  │  [Create Account]                      │
  └────────────────────────────────────────┘

Referral code hidden field-এ store হবে → signup API-তে পাঠাবে
```

---

## ৪. Super Admin Dashboard — Referrals

### `/admin/referrals`

```
┌─────────────────────────────────────────────────────────┐
│  Referrals                                              │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Total   │ │ Pending  │ │ Rewarded │ │ Revenue  │  │
│  │    12    │ │    3     │ │    9     │ │ ৳54,000  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  Filter: [All ▾]  [This month ▾]                       │
│  ─────────────────────────────────────────────────────  │
│  Blue Lagoon Resort  ←  Palm Paradise Resort            │
│  Signed up: May 20, 2026  |  Plan: STARTER             │
│  Status: ⏳ Pending reward                              │
│                                                         │
│  Reward referrer:                                       │
│  ○ Account Credit  ৳[5,000  ]                          │
│  ○ Free Plan: [PROFESSIONAL ▾] for [2] months         │
│  ○ No reward                                            │
│                                                         │
│  Note: [Great referral — active user]                  │
│  [Apply Reward]                                         │
│  ─────────────────────────────────────────────────────  │
│  Sea Breeze Hotel   ←  Palm Paradise Resort             │
│  Signed up: Jun 1, 2026  |  Plan: STARTER              │
│  Status: ⏳ Pending                                    │
│  [Apply Reward]                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ৫. Reward Types

### Type 1 — Account Credit
```
Admin: ৳5,000 credit
→ Tenant.accountCredit += 5000
→ পরবর্তী invoice থেকে auto-deduct হবে
→ Owner dashboard-এ "Account Credit: ৳5,000" দেখাবে
```

### Type 2 — Free Plan Upgrade
```
Admin: PROFESSIONAL plan, 2 months free
→ Tenant.plan = 'PROFESSIONAL'
→ Tenant.planStatus = 'active'
→ Tenant.freeUntil = today + 2 months
→ freeUntil পার হলে normal billing resume
→ Owner-কে WhatsApp/Email: "🎉 আপনার referral reward পেয়েছেন — 2 months PROFESSIONAL free!"
```

### Type 3 — No Reward
```
Admin: "No reward" — referral track করা হলো কিন্তু reward নেই
→ Status → "Reviewed"
```

---

## ৬. Notification System

```
Referral signup হলে:
  → Super Admin dashboard-এ bell notification
  → Admin email: "New referral signup — Blue Lagoon Resort (via Palm Paradise Resort)"

Reward apply হলে:
  → Referrer (Owner) dashboard notification
  → WhatsApp/Email to referrer: reward details
```

---

## ৭. Referral Code Generation

```
Code format: first 6 characters of the resort slug + 12 random characters
  "Palm Paradise Resort" → PALMPA-4B53A4614241

Code stored in Tenant model as referralCode (unique)
Link: https://app.resortpro.site/auth/register?ref=<code>
```

---

## ৮. Database Schema

```prisma
// Tenant model-এ add হবে:
model Tenant {
  // existing...
  referralCode    String?  @unique   // "PALM25" — their outgoing code
  referredById    String?            // who referred them (tenant ID)
  referredBy      Tenant?  @relation("TenantReferrals", fields: [referredById], references: [id])
  referrals       Tenant[] @relation("TenantReferrals")  // who they referred
  accountCredit   Float    @default(0)  // ৳ credit balance
  freeUntil       DateTime?            // free plan expiry date
}

model Referral {
  id              String   @id @default(cuid())
  referrerId      String   // tenant who referred
  referrer        Tenant   @relation("ReferrerReferrals", fields: [referrerId], references: [id])
  referredId      String   // tenant who signed up
  referred        Tenant   @relation("ReferredReferrals", fields: [referredId], references: [id])

  status          String   @default("PENDING")  // PENDING | REWARDED | NO_REWARD
  rewardType      String?  // CREDIT | FREE_PLAN | NONE
  rewardAmount    Float?   // credit amount in ৳
  rewardPlan      String?  // "PROFESSIONAL"
  rewardMonths    Int?     // 2 (default for referral reward)
  rewardNote      String?
  rewardedAt      DateTime?
  rewardedBy      String?  // admin user ID

  createdAt       DateTime @default(now())
}
```

---

## ৯. API Endpoints

```
// Public (signup flow)
POST   /api/auth/register
  body: { ..., referralCode?: string }
  → If referralCode valid → create Referral record, notify admin

// Owner (authenticated)
GET    /api/tenant/referrals            → referral history + stats
GET    /api/tenant/referral-link        → get own referral code + link

// Admin
GET    /api/admin/referrals             → all referrals with status
PATCH  /api/admin/referrals/:id/reward  → apply reward
  body: { type: 'CREDIT'|'FREE_PLAN'|'NONE', amount?, plan?, months?, note? }
  → Apply reward → notify owner
```

---

## ১০. Owner Dashboard Integration

```
Sidebar-এ নতুন item:
  🔗 Referrals  (Settings group-এ অথবা আলাদা)

Settings page-এ tab:
  এখন: Profile | Billing | Modules | ...
  নতুন: + Referral Program tab
```

---

## ১১. Tracking (Click Count)

```
/register?ref=PALM25 visit হলে:
  → referral_clicks table-এ log (optional)
  → Signup না করলেও click count বাড়ে
  → Owner দেখবে: "47 clicks, 3 signups"

Simple tracking:
model ReferralClick {
  id          String   @id @default(cuid())
  code        String
  ip          String?
  userAgent   String?
  converted   Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

---

## ১২. Implementation Steps

```
Step 1 — Database (1 day)
  ✦ Tenant.referralCode (auto-generate on create)
  ✦ Tenant.accountCredit
  ✦ Tenant.freeUntil
  ✦ Referral model
  ✦ ReferralClick model (optional)
  ✦ Migrate

Step 2 — Backend API (2 days)
  ✦ Auto-generate referralCode on tenant registration
  ✦ Register endpoint: detect referralCode → create Referral
  ✦ Owner endpoints: referral link + history
  ✦ Admin reward endpoint: apply credit or free plan
  ✦ Notification on referral signup (admin bell + email)
  ✦ Notification on reward (owner WhatsApp/email)

Step 3 — Owner Dashboard UI (1.5 days)
  ✦ /dashboard/referrals page
  ✦ Referral link display + copy + share buttons
  ✦ Stats (clicks, signups, rewards earned)
  ✦ Referral history list

Step 4 — Admin Panel UI (1 day)
  ✦ /admin/referrals page
  ✦ Pending referrals list
  ✦ Reward form (credit / free plan / none)
  ✦ Stats widget on admin dashboard

Step 5 — Signup Page (0.5 day)
  ✦ Detect ?ref= param
  ✦ Show "Referred by: ..." badge
  ✦ Pass referralCode in register body

Total: ~6 days
```

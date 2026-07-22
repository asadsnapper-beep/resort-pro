# Part 07 — Business Control System (SaaS Lifecycle)

## Overview
ResortPro-র business control layer। Trial → Paid → Expired → Win-back পুরো lifecycle টা automated।

---

## Trial System

### Trial Duration
- Default: **14 days** (Platform Settings থেকে admin যেকোনো সময় change করতে পারেন)
- Registration-এ `trialEndsAt = now + trialDays` set হয়
- Platform Settings DB-তে থাকে → code redeploy ছাড়াই change হয়

### Trial States
```
New signup → planStatus: 'trialing', trialEndsAt: +14 days
Trial active + days > 0 → dashboard full access
Trial active + days <= 7 → warning banner দেখায়
Trial expired (days = 0) → /dashboard/upgrade redirect
Paid → planStatus: 'active' → full access
Past due → /dashboard/upgrade
Canceled → /dashboard/upgrade
Suspended (isActive: false) → /dashboard/suspended
```

---

## Dashboard Access Enforcement

### Layout Guard (`apps/web/src/app/(dashboard)/layout.tsx`)
প্রতিটি dashboard page load-এ:
1. `isAuthenticated()` check — না হলে `/auth/login`
2. `billingApi.getStatus()` call
3. `isActive: false` → `/dashboard/suspended`
4. `planStatus: trialing` + `trialDaysLeft <= 0` → `/dashboard/upgrade`
5. `planStatus: canceled | past_due` → `/dashboard/upgrade`
6. সব OK → dashboard render হয়

---

## Upgrade Wall (`/dashboard/upgrade`)

Beautiful pricing page — trial expired বা subscription canceled হলে দেখায়।

**Features:**
- 3 plan cards (Starter $49, Professional $99, Enterprise $199)
- MOST POPULAR badge on Professional
- Feature list per plan
- Trust badges: 30-day money-back, Cancel anytime, 500+ resorts, Data preserved
- "Choose [Plan]" → Stripe Checkout শুরু হয়
- FAQ / contact support link

---

## Suspended Page (`/dashboard/suspended`)

Admin suspend করলে দেখায়।
- Suspension message
- Resort name display
- "Email Support Team" — mailto link (subject + body pre-filled)
- "Sign Out" button

---

## Trial Warning Banner (Top Nav)

Trial-এ থাকলে এবং ৭ দিনের কম বাকি থাকলে:
- ৫–৭ দিন → **Blue** banner
- ৩–৪ দিন → **Amber** banner
- ০–২ দিন → **Red** banner

Banner-এ trial days remaining + "Choose a plan →" link। Dismiss করা যায়।

---

## Automated Trial Email Sequences

Service: `apps/api/src/services/trial-emails.ts`

Cron: **প্রতি ১২ ঘণ্টায়** চলে (app startup + setInterval)

### Email Triggers

**Trialing tenants (warning emails):**
| Trigger | Subject |
|---------|---------|
| 7 days before expiry | "Your trial ends in 7 days" |
| 3 days before expiry | "⚠️ 3 days left — don't lose your setup" |
| 1 day before expiry | "🚨 Last chance — trial ends tomorrow" |

**Expired trials (win-back emails):**
| Trigger | Subject |
|---------|---------|
| Just expired (day 0) | "Your trial has ended — choose a plan" |
| 3 days after | "Still thinking it over? Your data is waiting" |
| 7 days after | "We saved your resort data 🔒" |
| 30 days after | "Final notice: data deletion scheduled" |

All emails branded (ResortPro green #1a6b5e header), mobile-friendly HTML।

---

## Account Control (Admin Powers)

Admin `/admin/tenants` থেকে যেকোনো tenant-এর জন্য:

| Action | Effect |
|--------|--------|
| **Suspend** | `isActive: false` → owner login করতে পারবেন না |
| **Reactivate** | `isActive: true` → access ফিরে পাবেন |
| **Extend trial** | `trialEndsAt` বাড়ানো হয়, `planStatus: trialing` set হয় |
| **Change plan** | Plan key update হয় |
| **Export data** | সব data JSON-এ download হয় |

---

## Data Retention Policy (Email-এ communicate করা হয়)
- Trial expired → data safe রাখা হয়
- 30 days after expiry → "60 days remaining before deletion" email
- 90 days after expiry → data deletion (planned)

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/services/trial-emails.ts` | Trial email cron service |
| `apps/web/src/app/(dashboard)/layout.tsx` | Subscription enforcement |
| `apps/web/src/app/(dashboard)/dashboard/upgrade/page.tsx` | Upgrade wall |
| `apps/web/src/app/(dashboard)/dashboard/suspended/page.tsx` | Suspended page |
| `apps/web/src/components/dashboard/top-nav.tsx` | Trial warning banner |
| `packages/database/prisma/schema.prisma` → `PlatformSettings` | Trial days + plan config DB |

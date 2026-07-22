# Part 05 — Stripe Payment Integration

## Overview
দুইটি আলাদা payment flow আছে:
1. **SaaS Subscription Billing** — Resort owner-রা ResortPro-কে monthly pay করেন
2. **Guest Payment Links** — Resort owner-রা guest-দের booking payment-এর জন্য link পাঠান

Currently **Stripe Test Mode**-এ আছে। Production-এ যেতে শুধু API keys swap করতে হবে।

---

## Part A: SaaS Subscription Billing

### Plans
| Key | Name | Price | Room Limit |
|-----|------|-------|-----------|
| STARTER | Starter | $49/mo | 20 rooms |
| PROFESSIONAL | Professional | $99/mo | 100 rooms |
| ENTERPRISE | Enterprise | $199/mo | Unlimited |

> Plan name ও price এখন **Platform Settings** থেকে admin edit করতে পারেন।

### Subscription Flow
```
Owner clicks "Upgrade" 
→ POST /api/billing/checkout { planKey }
→ Stripe Checkout Session তৈরি হয়
→ Owner Stripe-এ payment করেন
→ Stripe webhook fire হয় → tenant planStatus: 'active'
→ Owner dashboard-এ redirect হয়
```

### Customer Portal
```
POST /api/billing/portal
→ Stripe Customer Portal URL তৈরি হয়
→ Owner নিজে plan change / cancel করতে পারেন
```

### Tenant Plan Status Values
| Status | Meaning |
|--------|---------|
| `trialing` | Free trial চলছে |
| `active` | Paid subscription active |
| `past_due` | Payment fail হয়েছে |
| `canceled` | Subscription cancel করা |

---

## Part B: Guest Payment Links (Booking Payment)

### Flow
```
Owner booking detail-এ "Send Payment Link" click করেন
→ POST /api/bookings/:id/payment-link
→ Stripe Checkout Session তৈরি হয় (remaining balance)
→ Guest-কে email-এ payment link পাঠানো হয়
→ Guest pay করেন
→ Booking-এ payment record হয়
```

---

## Stripe Webhook Handler (`POST /api/stripe/webhook`)

Raw body handler — Stripe signature verify করা হয়।

| Webhook Event | Action |
|---------------|--------|
| `checkout.session.completed` | planStatus → active |
| `customer.subscription.updated` | plan + period update |
| `customer.subscription.deleted` | planStatus → canceled |
| `invoice.payment_failed` | planStatus → past_due |

**Idempotency:** `StripeWebhookEvent` table-এ প্রতিটি event একবার process হয় (`stripeId @unique`)।

---

## Database Fields Added to Tenant
```prisma
stripeCustomerId      String?
stripeSubscriptionId  String?
planStatus            String    @default("trialing")
trialEndsAt           DateTime?
currentPeriodEnd      DateTime?
billingEmail          String?
```

## Database Fields Added to Booking
```prisma
stripePaymentIntentId String?
stripePaymentLinkId   String?
paymentLinkUrl        String?
```

---

## Environment Variables Required
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/routes/billing.ts` | Subscription + portal + webhook + guest payment |
| `apps/web/src/app/(dashboard)/dashboard/billing/` | Billing dashboard page |
| `apps/web/src/app/(dashboard)/dashboard/upgrade/` | Upgrade wall (plan selection) |
| `apps/web/src/lib/api.ts` → `billingApi` | Frontend billing API calls |

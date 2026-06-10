# Payment Gateway Registry — Global Eco-Tourism Plan

> **Vision:** ResortPro কে South Asia ও বিশ্বের eco-tourism / agro-tourism SME resorts-এর জন্য
> সবচেয়ে accessible hotel management platform বানানো — local payment methods দিয়ে।

**Status:** 📋 Planning  
**Priority:** 🔴 High  
**Phase 1 Target Markets:** 🇧🇩 Bangladesh · 🇮🇳 India · 🇱🇰 Sri Lanka · 🇳🇵 Nepal

---

## 🎯 কেন এই ৪টা দেশ আগে?

| Country | Eco-Tourism Scene | Local Payment Must-Have | Competition Gap |
|---------|-------------------|------------------------|-----------------|
| 🇧🇩 Bangladesh | Sreemangal, Bandarban, Cox's Bazar, Sundarbans | bKash (95%+ mobile payment) | প্রায় শূন্য |
| 🇮🇳 India | Kerala, Coorg, Himachal, Northeast homestays | Razorpay / UPI | Huge underserved SME segment |
| 🇱🇰 Sri Lanka | Tea country, Yala, Sigiriya | Stripe (works fine) | Low — mostly manual |
| 🇳🇵 Nepal | Trek lodges, Chitwan, Pokhara eco resorts | eSewa / Khalti | Very low |

---

## 🗺️ Full Gateway Map (All Phases)

```
Phase 1 — South Asian Eco Belt (Now)
├── 🇧🇩 Bangladesh    → bKash, Nagad, SSLCommerz, Stripe
├── 🇮🇳 India         → Razorpay (UPI + card + netbanking), Cashfree, Stripe  
├── 🇱🇰 Sri Lanka     → PayHere, Stripe
└── 🇳🇵 Nepal         → eSewa, Khalti, Stripe

Phase 2 — SE Asia + East Africa (6 months)
├── 🇹🇭 Thailand      → Omise/Opn, PromptPay, Stripe
├── 🇮🇩 Indonesia     → Midtrans, GoPay, OVO
├── 🇲🇾 Malaysia      → iPay88, GrabPay, Stripe
└── 🇰🇪 Kenya         → M-Pesa (Daraja API), Stripe

Phase 3 — Expansion (12 months)
├── 🇻🇳 Vietnam       → VNPay, MoMo, ZaloPay
├── 🇵🇭 Philippines   → PayMongo, GCash, Maya
├── 🇬🇭 Ghana         → Paystack, MTN MoMo
└── 🇳🇬 Nigeria       → Flutterwave, Paystack

Global Fallback
└── 🌍 Default        → Stripe, PayPal
```

---

## 🏗️ Architecture

### Package Structure

```
packages/
└── payment-registry/           ← নতুন shared package
    ├── package.json
    ├── src/
    │   ├── index.ts             ← main exports
    │   ├── types.ts             ← GatewayConfig, PaymentMethod, PaymentResult types
    │   ├── registry.ts          ← country → available gateways mapping
    │   ├── currency.ts          ← country → default currency + symbol
    │   └── gateways/
    │       ├── base.ts          ← abstract BaseGateway class
    │       ├── stripe.ts        ← ✅ Full implementation (Phase 1)
    │       ├── bkash.ts         ← ✅ Full implementation (Phase 1)
    │       ├── sslcommerz.ts    ← ✅ Full implementation (Phase 1)
    │       ├── nagad.ts         ← ✅ Full implementation (Phase 1)
    │       ├── razorpay.ts      ← ✅ Full implementation (Phase 1)
    │       ├── payhere.ts       ← ✅ Full implementation (Phase 1)
    │       ├── esewa.ts         ← ✅ Full implementation (Phase 1)
    │       ├── khalti.ts        ← ✅ Full implementation (Phase 1)
    │       ├── midtrans.ts      ← 🔲 Stub (Phase 2)
    │       ├── omise.ts         ← 🔲 Stub (Phase 2)
    │       ├── mpesa.ts         ← 🔲 Stub (Phase 2)
    │       ├── flutterwave.ts   ← 🔲 Stub (Phase 3)
    │       └── paystack.ts      ← 🔲 Stub (Phase 3)
```

### API Routes (apps/api)

```
apps/api/src/routes/payment/
├── gateway.route.ts     GET  /payment/gateways         → tenant এর country অনুযায়ী available gateways
├── config.route.ts      GET  /payment/config            → tenant এর active gateway config
│                        PUT  /payment/config            → tenant gateway save করা (owner only)
├── checkout.route.ts    POST /payment/checkout/init     → payment শুরু করা (booking-এর জন্য)
│                        POST /payment/checkout/verify   → payment confirm করা
├── webhook.route.ts     POST /payment/webhook/:provider → gateway callback
└── history.route.ts     GET  /payment/history           → payment history (dashboard)
```

### Web Pages (apps/web)

```
apps/web/src/app/
├── dashboard/
│   └── settings/
│       └── payment/         ← Tenant payment settings page
│           └── page.tsx     → gateway select + credentials form
└── [slug]/                  ← Guest-facing booking site
    └── checkout/
        └── page.tsx         → payment method select + initiate
        └── verify/
            └── page.tsx     → payment success/fail handling
```

---

## 🗄️ Database Schema

```prisma
// Tenant-এর payment configuration
model TenantPaymentConfig {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  
  country         String   // 'BD' | 'IN' | 'LK' | 'NP' | ...
  currency        String   // 'BDT' | 'INR' | 'LKR' | 'NPR' | 'USD'
  activeGateway   String   // 'bkash' | 'razorpay' | 'stripe' | ...
  
  // Encrypted gateway credentials (JSON)
  // { bkash: { appKey, appSecret, username, password }, stripe: { secretKey }, ... }
  gatewayCredentials Json  @default("{}")
  
  // Which payment methods to show guests
  enabledMethods  String[] // ['mobile_banking', 'card', 'net_banking', 'wallet', 'manual']
  
  // Manual payment instructions (shown to guest if they choose "Pay at Resort")
  manualInstructions String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Every payment transaction
model Payment {
  id               String        @id @default(cuid())
  tenantId         String
  tenant           Tenant        @relation(fields: [tenantId], references: [id])
  
  bookingId        String?       // nullable — could be advance deposit etc.
  booking          Booking?      @relation(fields: [bookingId], references: [id])
  
  gateway          String        // 'bkash' | 'stripe' | 'razorpay' | ...
  gatewayPaymentId String?       // gateway-এর নিজস্ব payment ID
  gatewayOrderId   String?       // razorpay/stripe এর order ID
  
  amount           Float
  currency         String
  status           PaymentStatus @default(PENDING)
  
  payerName        String?
  payerEmail       String?
  payerPhone       String?
  
  metadata         Json?         // gateway-specific extra data
  webhookData      Json?         // raw webhook payload (debugging-এর জন্য)
  
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  paidAt           DateTime?

  @@index([tenantId])
  @@index([bookingId])
  @@index([status])
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  CANCELLED
  REFUNDED
  PARTIAL_REFUND
}
```

---

## 🔌 Gateway Interface (Base Class)

```typescript
// packages/payment-registry/src/gateways/base.ts

export interface InitiatePaymentInput {
  amount: number;           // in smallest unit (paisa/cents/paise)
  currency: string;
  orderId: string;          // আমাদের internal payment ID
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl: string;      // webhook URL
  returnUrl: string;        // guest redirect URL after payment
  description?: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  redirectUrl?: string;     // guest কে এখানে redirect করো
  gatewayPaymentId?: string;
  sessionToken?: string;    // bKash / SSLCommerz-এর জন্য
  error?: string;
}

export interface VerifyPaymentInput {
  gatewayPaymentId: string;
  orderId: string;
  rawBody?: string;         // webhook body (signature verify-এর জন্য)
  headers?: Record<string, string>;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  gatewayPaymentId?: string;
  transactionId?: string;
  amount?: number;
  error?: string;
}

export abstract class BaseGateway {
  abstract readonly id: string;       // 'bkash' | 'stripe' | ...
  abstract readonly name: string;     // 'bKash' | 'Stripe' | ...
  abstract readonly countries: string[];  // ['BD'] | ['IN', 'global'] | ...
  abstract readonly methods: string[];    // ['mobile_banking'] | ['card'] | ...

  abstract initiate(input: InitiatePaymentInput, credentials: Record<string, string>): Promise<InitiatePaymentResult>;
  abstract verify(input: VerifyPaymentInput, credentials: Record<string, string>): Promise<VerifyPaymentResult>;
  abstract refund?(paymentId: string, amount: number, credentials: Record<string, string>): Promise<boolean>;
}
```

---

## 🗺️ Registry (country → gateways)

```typescript
// packages/payment-registry/src/registry.ts

export const GATEWAY_REGISTRY: Record<string, string[]> = {
  BD: ['bkash', 'nagad', 'sslcommerz', 'stripe'],
  IN: ['razorpay', 'cashfree', 'stripe'],
  LK: ['payhere', 'stripe'],
  NP: ['esewa', 'khalti', 'stripe'],
  TH: ['omise', 'stripe'],       // Phase 2 stubs
  ID: ['midtrans'],               // Phase 2 stubs
  MY: ['ipay88', 'stripe'],      // Phase 2 stubs
  KE: ['mpesa', 'stripe'],       // Phase 2 stubs
  DEFAULT: ['stripe', 'paypal'],
};

export const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  BD: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  IN: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  LK: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  NP: { code: 'NPR', symbol: 'Rs.', name: 'Nepalese Rupee' },
  TH: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  ID: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  MY: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  KE: { code: 'KES', symbol: 'Ksh', name: 'Kenyan Shilling' },
  US: { code: 'USD', symbol: '$', name: 'US Dollar' },
  DEFAULT: { code: 'USD', symbol: '$', name: 'US Dollar' },
};
```

---

## 🖥️ Dashboard UI — Payment Settings Page

```
┌─────────────────────────────────────────────────────┐
│  Payment Settings                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Your Country:  🇧🇩 Bangladesh                      │
│  Currency:      ৳ BDT (Bangladeshi Taka)            │
│                                                     │
│  Available Gateways for Bangladesh:                 │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  bKash   │  │  Nagad   │  │   SSLCommerz     │  │
│  │  ✅ Active│  │  Set up  │  │   Set up         │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────┐                                       │
│  │  Stripe  │                                       │
│  │  Set up  │                                       │
│  └──────────┘                                       │
│                                                     │
│  Active Gateway: bKash                              │
│  ┌─────────────────────────────────────────────┐   │
│  │  bKash Credentials                          │   │
│  │  App Key:    [••••••••••••••••••]           │   │
│  │  App Secret: [••••••••••••••••••]           │   │
│  │  Username:   [••••••••••••••••••]           │   │
│  │  Password:   [••••••••••••••••••]           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Guest Payment Methods to Show:                     │
│  ☑ Mobile Banking (bKash/Nagad)                    │
│  ☑ Card Payment (SSLCommerz/Stripe)                │
│  ☑ Pay at Resort (Manual)                          │
│                                                     │
│             [Save Payment Settings]                 │
└─────────────────────────────────────────────────────┘
```

---

## 🛒 Guest Checkout UI

```
┌─────────────────────────────────────────────────────┐
│  Complete Your Booking                              │
│  Sunrise Eco Resort · Deluxe Cottage · 3 nights    │
│  Total: ৳ 15,000                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Choose Payment Method:                             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  📱 bKash                          POPULAR  │   │
│  │     Fast mobile payment                     │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  📱 Nagad                                   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  💳 Card / Net Banking (SSLCommerz)         │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  🏨 Pay at Resort                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔒 Security Considerations

- **Credentials Encryption:** Gateway credentials (API keys) → AES-256 encrypt করে DB-তে store
- **Webhook Signature:** প্রতিটি gateway-এর signature verify (bKash HMAC, Stripe `stripe-signature`, Razorpay HMAC-SHA256)
- **Idempotency:** Duplicate webhook ignore করার জন্য `gatewayPaymentId` unique check
- **Amount Validation:** Webhook-এ আসা amount ≡ DB-তে stored amount (price tampering prevent)
- **HTTPS Only:** Callback URL সবসময় HTTPS

---

## 📋 Implementation Steps

### Step 1 — Database (Prisma)
- [ ] `TenantPaymentConfig` model add করা
- [ ] `Payment` model add করা
- [ ] `PaymentStatus` enum add করা
- [ ] Migration generate + run করা

### Step 2 — Payment Registry Package
- [ ] `packages/payment-registry` create করা
- [ ] `types.ts`, `registry.ts`, `currency.ts` লেখা
- [ ] `BaseGateway` abstract class লেখা
- [ ] **bKash** full implementation
- [ ] **SSLCommerz** full implementation
- [ ] **Nagad** full implementation
- [ ] **Razorpay** full implementation (Phase 1)
- [ ] **PayHere** full implementation (Phase 1)
- [ ] **eSewa** full implementation (Phase 1)
- [ ] **Khalti** full implementation (Phase 1)
- [ ] **Stripe** full implementation (global)
- [ ] Phase 2/3 gateways → stub (throws `NotImplementedError`)

### Step 3 — API Routes
- [ ] `GET /payment/gateways` — tenant country অনুযায়ী list
- [ ] `PUT /payment/config` — save credentials (encrypted)
- [ ] `POST /payment/checkout/init` — payment শুরু
- [ ] `POST /payment/checkout/verify` — payment confirm
- [ ] `POST /payment/webhook/:provider` — gateway callbacks
- [ ] `GET /payment/history` — transaction list

### Step 4 — Dashboard UI
- [ ] `/dashboard/settings/payment` page — gateway setup form
- [ ] Payment history table

### Step 5 — Guest Checkout UI
- [ ] `/[slug]/checkout` page — payment method select
- [ ] `/[slug]/checkout/verify` — success/fail page

---

## 📦 NPM Packages Needed

```json
{
  "bkash":       "bKash Tokenized API — custom HTTP calls",
  "stripe":      "stripe",
  "razorpay":    "razorpay",
  "sslcommerz":  "sslcommerz (community package)",
  "crypto":      "built-in Node.js — HMAC signature verify",
  "axios":       "HTTP calls for gateways without SDK"
}
```

---

## 🌐 Phase 2+ Gateway Notes (Stub করে রাখবো)

| Gateway | Docs | Notes |
|---------|------|-------|
| Midtrans | midtrans.com/en/developer | Indonesia — easy API |
| Omise | opn.ooo/docs | Thailand — good docs |
| M-Pesa | developer.safaricom.co.ke | Kenya — Daraja API |
| Flutterwave | developer.flutterwave.com | Nigeria/Africa — covers 34 countries |
| Paystack | paystack.com/docs | Nigeria/Ghana — Stripe-like API |

---

*Plan created: 2026-06-11*  
*Next step: Step 1 — Prisma schema update*

# Online Payment Plan
### "Guest website থেকে book করে সাথে সাথে pay করতে পারবে"

**Status:** 📋 Planning  
**Priority:** 🔴 High  
**Est. সময়:** ~15–20 ঘন্টা

---

## ৪টা Payment Option

| # | Gateway | কারা ব্যবহার করবে | কীভাবে কাজ করে |
|---|---------|-----------------|----------------|
| 1 | **bKash** | বাংলাদেশি guests | Mobile redirect → bKash app/USSD |
| 2 | **SSL Commerce** | বাংলাদেশি guests (card + bank) | Redirect → SSL hosted page |
| 3 | **Stripe** | International guests | Inline card form (no redirect) |
| 4 | **Manual Payment** | যেকোনো | "Pay at Hotel" — no online payment |

---

## Payment Flow (Guest POV)

```
Step 1: Date picker → available rooms
Step 2: Room select
Step 3: Guest details (name, email, phone)
Step 4: Payment method select
         ┌─ bKash      → বাংলাদেশি নম্বর দাও → redirect → confirm
         ├─ SSL Comm.  → redirect → card/bank/MFS select → confirm
         ├─ Stripe     → card number inline → confirm
         └─ Manual     → "We'll contact you" → PENDING booking
Step 5: Confirmation page (booking # + receipt)
```

---

## bKash Integration

### API Details
- **Base URL:** `https://checkout.pay.bka.sh/v1.2.0-beta`
- **Auth:** Username/Password → access token (30 min TTL)
- **Flow:** Create → Execute (2-step)
- **Docs:** https://developer.bka.sh/docs

### Flow
```
1. POST /tokenized/checkout/create
   → paymentID, bkashURL পাই

2. Redirect guest → bkashURL
   → Guest bKash app এ confirm করে

3. bKash redirects back → /api/payments/bkash/callback?paymentID=xxx&status=success
   → POST /tokenized/checkout/execute
   → trxID পাই

4. Booking CONFIRMED করি, receipt email পাঠাই
```

### Env Variables
```
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_BASE_URL=https://checkout.pay.bka.sh/v1.2.0-beta
```

### Schema additions (Booking model)
```
bkashPaymentId   String?   // create এ পাই
bkashTrxId       String?   // execute এ পাই (receipt তে দেখাবে)
```

---

## SSL Commerce Integration

### API Details
- **Gateway:** https://securepay.sslcommerz.com
- **Sandbox:** https://sandbox.sslcommerz.com
- **Auth:** store_id + store_passwd
- **Docs:** https://developer.sslcommerz.com

### Flow
```
1. POST https://securepay.sslcommerz.com/gwprocess/v4/api.php
   Body: store_id, store_passwd, amount, currency, tran_id, success_url, fail_url, cancel_url, customer info
   → GatewayPageURL পাই

2. Redirect guest → GatewayPageURL
   → Guest selects card/bKash/Nagad/Rocket/bank

3. SSL redirects back:
   → success_url: /api/payments/ssl/success (POST with val_id)
   → fail_url:    /api/payments/ssl/fail
   → cancel_url:  /api/payments/ssl/cancel

4. Validate with IPN: POST to SSL validate endpoint with val_id
   → VALID → booking CONFIRMED
```

### Env Variables
```
SSL_STORE_ID=
SSL_STORE_PASSWORD=
SSL_IS_LIVE=false   # true for production
```

### Schema additions (Booking model)
```
sslTranId    String?   // our tran_id sent to SSL
sslValId     String?   // val_id from SSL (for IPN validation)
```

---

## Stripe Integration

### Already exists for billing — extend for guest payments

### Flow
```
1. POST /api/payments/stripe/intent
   Body: { bookingId }
   → clientSecret পাই

2. Frontend: Stripe.js confirmCardPayment(clientSecret)
   → Guest enters card inline (no redirect)

3. Stripe webhook: payment_intent.succeeded
   → booking CONFIRMED
```

Already partially done — just need to wire for public bookings.

---

## Manual Payment

```
Guest submits booking → status: PENDING, paymentStatus: PENDING
Staff receives notification
Staff contacts guest (phone/WhatsApp)
Staff marks payment received in dashboard
Booking → CONFIRMED
```

No additional integration needed.

---

## Database Changes

### Booking model নতুন fields
```
paymentGateway   String?   // "BKASH" | "SSL" | "STRIPE" | "MANUAL"
gatewayTxId      String?   // bkashTrxId / sslValId / stripePaymentIntentId (unified)
gatewayPaymentId String?   // bkashPaymentId / sslTranId (intermediate ID)
paidAt           DateTime? // কখন payment confirm হয়েছে
```

> `source` field already আছে — "DIRECT_WEB" use করবো
> `stripePaymentIntentId` already আছে — reuse করবো Stripe এর জন্য

### Tenant model নতুন fields (payment gateway settings)
```
bkashEnabled     Boolean  @default(false)
bkashAppKey      String?
bkashAppSecret   String?
bkashUsername    String?
bkashPassword    String?

sslEnabled       Boolean  @default(false)
sslStoreId       String?
sslStorePassword String?
sslIsLive        Boolean  @default(false)

stripeGuestEnabled Boolean @default(false)  // Stripe for guest payments (separate from billing)
```

> Owner `/dashboard/settings` এ নিজের gateway credentials দেবে

---

## API Routes (নতুন)

### Public (no auth)
```
POST /site/:slug/book-with-payment    ← booking create + payment initiate
POST /api/payments/bkash/callback     ← bKash redirects here after payment
POST /api/payments/ssl/success        ← SSL redirects here on success
POST /api/payments/ssl/fail           ← SSL redirects here on fail
POST /api/payments/ssl/cancel         ← SSL redirects here on cancel
POST /api/payments/stripe/intent      ← create Stripe PaymentIntent for guest booking
POST /api/webhooks/stripe             ← already exists — add guest payment handler
```

### Dashboard (authenticated)
```
GET  /api/payments/settings           ← get gateway settings for tenant
PATCH /api/payments/settings          ← save gateway credentials
```

---

## Frontend Changes

### Public Website (Booking Form)
- Step 4 add করবো: Payment Method Selection
- bKash: phone number input → redirect
- SSL: redirect button
- Stripe: inline card form (Stripe Elements)
- Manual: simple "Pay at Hotel" confirmation

### Dashboard Settings
- `/dashboard/settings` → "Payment Gateways" section
- Toggle on/off per gateway
- Credential inputs (masked)
- "Test connection" button

---

## Security

| Risk | Solution |
|------|---------|
| Gateway credentials in DB | Encrypted at rest (AES-256) |
| IPN/callback spoofing | SSL: re-validate with SSL server; bKash: re-execute and verify trxID |
| Double charge | Idempotency check — if booking already CONFIRMED, skip |
| CSRF on callback | Use bookingId in callback URL, verify it matches |

---

## Tenant Onboarding Flow

```
Owner → Dashboard → Settings → Payment Gateways
  → Enable bKash → Enter App Key, Secret, Username, Password → Test → Save
  → Enable SSL   → Enter Store ID, Password → Test → Save
  → Enable Stripe → (uses existing Stripe Connect or platform key)
  → Manual is always available (no setup needed)
```

Guest কে শুধু enabled gateway গুলো দেখাবে।
যদি কোনো gateway enabled না থাকে → শুধু Manual option দেখাবে।

---

## Files তৈরি/পরিবর্তন হবে

```
packages/database/prisma/schema.prisma
  → Booking: paymentGateway, gatewayTxId, gatewayPaymentId, paidAt
  → Tenant: bkashEnabled, bkashAppKey, ..., sslEnabled, ...

apps/api/src/
  services/
    bkash.ts          ← NEW: bKash API client (token, create, execute)
    ssl-commerce.ts   ← NEW: SSL Commerce API client
  routes/
    payments.ts       ← NEW: callbacks + settings CRUD
  app.ts              ← register /api/payments routes

apps/web/src/
  components/themes/_widgets/
    PaymentSelector.tsx     ← NEW: payment method picker UI
    StripePaymentForm.tsx   ← NEW: Stripe Elements card form
  app/(dashboard)/dashboard/settings/page.tsx
    → add Payment Gateways section
```

---

## Timeline

| Step | কাজ | সময় |
|------|-----|------|
| 1 | Schema changes + db push | 30 min |
| 2 | bKash service + callback route | 3 hr |
| 3 | SSL Commerce service + callback routes | 3 hr |
| 4 | Stripe guest payment intent route | 1 hr |
| 5 | Dashboard payment settings UI | 2 hr |
| 6 | Booking form — payment step UI | 4 hr |
| 7 | Testing + edge cases | 2 hr |

**মোট: ~15–20 ঘন্টা**

---

## Sandbox Test Credentials

| Gateway | Sandbox |
|---------|---------|
| bKash | https://developer.bka.sh/docs/sandbox |
| SSL Commerce | https://sandbox.sslcommerz.com (test store আছে) |
| Stripe | Existing test keys — use `4242 4242 4242 4242` |
| Manual | কোনো setup নেই |

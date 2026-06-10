# Plan: Global i18n + Localization + Regional Payment Methods

## উদ্দেশ্য

ResortPro শুধু Bangladesh-এর জন্য না — worldwide SaaS হবে।
কিন্তু Bangladesh-এর জন্য special treatment থাকবে:
- Auto Bangla (BN) UI যখন visitor Bangladesh থেকে আসবে
- bKash / SSLCommerz / Nagad local payment support
- Mixed Bangla-English UI (বর্তমানের মতো)

---

## 1. দুটো Layer আলাদা

### Layer 1 — Dashboard UI Language (Staff/Owner দেখে)
Resort owner ও staff যে dashboard ব্যবহার করে।

| User Location | Default Language | পরিবর্তন করা যাবে? |
|---------------|-----------------|-------------------|
| Bangladesh | Bangla (BN) | ✅ হ্যাঁ |
| অন্য দেশ | English (EN) | ✅ হ্যাঁ |

### Layer 2 — Public Website Language (Guest দেখে)
Resort-এর public booking website যা guests দেখে।

| Resort Location | Default Language | Guest পরিবর্তন করতে পারবে? |
|----------------|-----------------|--------------------------|
| Bangladesh | BN + EN (mixed) | ✅ toggle |
| অন্য দেশ | EN only | ✅ owner আরও language যোগ করতে পারবে |

---

## 2. Auto-Detection Logic

```
Visitor আসলে:
  → IP Geolocation check (ipapi.co বা Cloudflare CF-IPCountry header)
  → country === 'BD' ?
      → dashboard language = 'bn'
      → public site = 'bn' (default, toggle আছে)
  → অন্য দেশ:
      → dashboard language = 'en'
      → public site = 'en'

User manually change করলে:
  → localStorage তে save
  → পরবর্তীতে সেটাই দেখাবে
```

### Cloudflare দিয়ে সহজ Detection
Cloudflare Tunnel ব্যবহার করছ — প্রতিটি request-এ `CF-IPCountry` header আসে।
API-তে এই header read করে country detect করা যাবে — কোনো extra IP service লাগবে না।

---

## 3. i18n Architecture

### Technology Stack
- **Next.js App Router** → `next-intl` library (best for App Router)
- **Namespace-based** translation files
- **Server + Client component** দুটোতেই কাজ করবে

### Folder Structure
```
apps/web/src/
  messages/
    en/
      common.json       # buttons, labels, errors
      dashboard.json    # dashboard UI
      booking.json      # booking flow
      auth.json         # login/register
    bn/
      common.json
      dashboard.json
      booking.json
      auth.json
```

### URL Structure
```
Global (English):
  resortpro.site/dashboard
  resortpro.site/auth/login

Bangladesh auto-detect:
  resortpro.site/bn/dashboard   (Bangla)
  resortpro.site/dashboard      (English fallback)
```

অথবা **no URL change** — শুধু localStorage + header দিয়ে switch।
> ✅ Recommended: no URL prefix — cleaner UX, localStorage-based switch

---

## 4. Translation Priority

### Phase 1 (এখনই করব)
| Namespace | কেন priority |
|-----------|-------------|
| `auth.json` | Login/Register — প্রথম impression |
| `common.json` | Buttons, errors, nav |
| `dashboard.json` | Main UI |
| `booking.json` | Revenue-critical flow |

### Phase 2 (পরে)
- Public website themes (resort guest-facing)
- Email templates (BN + EN)
- SMS messages (BN + EN)
- Invoice PDF (BN + EN)

### Phase 3 (future)
- Arabic (AR) — Middle East resorts
- French (FR) — Africa/Europe resorts
- Spanish (ES) — Latin America

---

## 5. Regional Payment Methods

### Architecture — Payment Gateway Registry

প্রতিটি দেশের জন্য আলাদা payment gateway। Tenant যে দেশে আছে সেই দেশের gateways দেখাবে।

```typescript
// packages/types/src/payments.ts
type PaymentGateway = {
  id: string
  name: string
  logo: string
  countries: string[]   // ISO country codes
  currencies: string[]  // ISO currency codes
  type: 'card' | 'mobile_money' | 'bank_transfer' | 'wallet' | 'bnpl'
}

const GATEWAY_REGISTRY: PaymentGateway[] = [
  // ── Bangladesh ──────────────────────────────────────────
  { id: 'bkash',       name: 'bKash',        countries: ['BD'], currencies: ['BDT'], type: 'mobile_money' },
  { id: 'nagad',       name: 'Nagad',         countries: ['BD'], currencies: ['BDT'], type: 'mobile_money' },
  { id: 'rocket',      name: 'Rocket',        countries: ['BD'], currencies: ['BDT'], type: 'mobile_money' },
  { id: 'sslcommerz',  name: 'SSLCommerz',    countries: ['BD'], currencies: ['BDT'], type: 'card' },
  { id: 'shurjopay',   name: 'ShurjoPay',     countries: ['BD'], currencies: ['BDT'], type: 'card' },

  // ── Global ───────────────────────────────────────────────
  { id: 'stripe',      name: 'Stripe',        countries: ['*'], currencies: ['USD','EUR','GBP','...'], type: 'card' },
  { id: 'paypal',      name: 'PayPal',        countries: ['*'], currencies: ['USD','EUR','...'], type: 'wallet' },

  // ── South/Southeast Asia ─────────────────────────────────
  { id: 'razorpay',    name: 'Razorpay',      countries: ['IN'], currencies: ['INR'], type: 'card' },
  { id: 'paytm',       name: 'Paytm',         countries: ['IN'], currencies: ['INR'], type: 'wallet' },
  { id: 'promptpay',   name: 'PromptPay',     countries: ['TH'], currencies: ['THB'], type: 'bank_transfer' },
  { id: 'gcash',       name: 'GCash',         countries: ['PH'], currencies: ['PHP'], type: 'mobile_money' },
  { id: 'grabpay',     name: 'GrabPay',       countries: ['SG','MY','PH'], currencies: ['SGD','MYR','PHP'], type: 'wallet' },

  // ── Middle East ───────────────────────────────────────────
  { id: 'tamara',      name: 'Tamara',        countries: ['SA','AE','KW'], currencies: ['SAR','AED','KWD'], type: 'bnpl' },
  { id: 'tabby',       name: 'Tabby',         countries: ['SA','AE'], currencies: ['SAR','AED'], type: 'bnpl' },

  // ── Africa ────────────────────────────────────────────────
  { id: 'mpesa',       name: 'M-Pesa',        countries: ['KE','TZ','GH'], currencies: ['KES','TZS','GHS'], type: 'mobile_money' },
  { id: 'flutterwave', name: 'Flutterwave',   countries: ['NG','GH','KE','ZA'], currencies: ['NGN','GHS','KES','ZAR'], type: 'card' },
]
```

### Dashboard — Payment Settings

Tenant onboarding-এ country select করলে:
- সেই দেশের available gateways দেখাবে
- Tenant নিজে enable/disable করতে পারবে
- API keys/credentials enter করবে

```
Settings → Payments
  ├── Global
  │   ├── [✅] Stripe (card)        → API key configured
  │   └── [ ] PayPal               → not configured
  └── Bangladesh Local
      ├── [✅] bKash               → configured
      ├── [ ] Nagad                → not configured
      └── [ ] SSLCommerz           → not configured
```

### Public Booking Website — Payment Flow

Guest checkout-এ শুধু **enabled gateways** দেখাবে:

```
Bangladesh resort guest:
  Pay with: [bKash] [Nagad] [Card via SSLCommerz]

Thailand resort guest:
  Pay with: [Card] [PromptPay] [GrabPay]

Global resort guest:
  Pay with: [Card via Stripe] [PayPal]
```

---

## 6. Currency System

### Per-Tenant Currency
- Tenant sign up করার সময় দেশ + currency select করবে
- সব price, invoice, report সেই currency-তে দেখাবে
- Dashboard-এ currency symbol automatically সঠিক হবে

### Exchange Rate (Future)
- Phase 1: Manual currency — tenant নিজে set করে
- Phase 2: Live exchange rate API (for multi-currency resorts)

---

## 7. Implementation Steps

### Step 1 — i18n Foundation (1 session)
- [ ] `next-intl` install ও configure
- [ ] `messages/en/` ও `messages/bn/` folder তৈরি
- [ ] `common.json` translations (buttons, errors, nav)
- [ ] Language switcher component (EN / বাংলা toggle)
- [ ] `CF-IPCountry` header থেকে auto-detect
- [ ] localStorage-এ preference save

### Step 2 — Dashboard Translation (2 sessions)
- [ ] Auth pages (login, register, forgot password)
- [ ] Dashboard layout (sidebar, header)
- [ ] Bookings page
- [ ] Rooms page
- [ ] Guests page

### Step 3 — Payment Gateway Registry (1 session)
- [ ] `GATEWAY_REGISTRY` তৈরি করা
- [ ] Tenant settings-এ country-based gateway list
- [ ] Enable/disable + credentials save
- [ ] Booking checkout-এ gateway selection UI

### Step 4 — BD Local Payments (1-2 sessions)
- [ ] bKash payment flow (existing code improve)
- [ ] Nagad integration
- [ ] SSLCommerz improve (existing code)

### Step 5 — Global Payments (2 sessions)
- [ ] Stripe checkout (existing improve)
- [ ] PayPal integration
- [ ] Razorpay (India)

---

## 8. Super Admin — Global View

Super admin dashboard-এ:
- Tenant-এর country distribution map
- Revenue by country/currency
- Which payment gateways are most used
- Language preference analytics

---

## Key Decisions

| বিষয় | Decision | কারণ |
|------|----------|------|
| i18n library | `next-intl` | App Router-এর জন্য best |
| Language detection | Cloudflare header | Already আছে, free |
| URL structure | No prefix | Cleaner UX |
| Payment approach | Registry pattern | Scalable, easy to add new gateways |
| Phase 1 languages | EN + BN | তোমার immediate market |
| Currency | Per-tenant manual | Simple, no exchange rate complexity |

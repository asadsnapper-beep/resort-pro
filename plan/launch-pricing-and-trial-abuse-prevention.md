# Launch Pricing and Three-Month Free Offer

## সিদ্ধান্ত

ResortPro Bangladesh-first launch pricing তিনটি সহজ plan-এ দেবে। Customer plan বেছে নেবে তার resort-এর আকার অনুযায়ী, feature checklist পড়ে নয়।

| Customer-facing plan | Internal plan key | Monthly price | Annual price | Best for |
|---|---|---:|---:|---|
| Small Resort | `STARTER` | $20 | $200 | ছোট resort বা guesthouse |
| Growing Resort | `PROFESSIONAL` | $50 | $500 | মাঝারি resort |
| Resort Group | `ENTERPRISE` | $100 | $1,000 | বড় resort বা একাধিক property |

Annual price-এ দুই মাস free থাকবে। Public website, `/plans`, registration, billing API, bKash pricing, Stripe price, admin settings, এবং trial email—সব জায়গায় এই এক source of truth ব্যবহার করতে হবে।

বর্তমান enum key (`STARTER`, `PROFESSIONAL`, `ENTERPRISE`) বদলানোর দরকার নেই। শুধু display name বদলালে migration risk কম থাকবে।

## Founding Resort strategy — launch phase

শুরুর SaaS business-এর প্রধান কাজ হলো customer trust, successful onboarding, এবং
real case study তৈরি করা। তাই launch phase-এ `$20` plan-কে deliberately বেশি
attractive করা হবে:

> **Founding Resort Offer:** প্রথম 100টি eligible verified resort `$20/month`
> price-এ Growing Resort-এর Professional operational toolkit পাবে।

Customer-facing copy-তে “$50 value” বলা যাবে না। পরিবর্তে বলা হবে:

> *Founding resorts get the full operational toolkit at our early-partner price.*

এই offer-এর value মানে feature access; unlimited capacity, unlimited support,
বা third-party cost (SMS, WhatsApp, payment gateway, AI) free নয়। Offer নেওয়া
customer-এর price এবং Professional feature access first paid billing date থেকে
12 মাস protect করতে হবে। এরপর কোনো surprise downgrade করা যাবে না—renewal-এর
আগে clear choice এবং অন্তত 60 দিনের notice দিতে হবে।

`$20` plan সাধারণত cheap/limited দেখানো যাবে না। Launch page-এ এটিকে
**Founding Resort** badge দিয়ে সবচেয়ে visible offer হিসেবে দেখাতে হবে। `$50`
এবং `$100` plan থাকবে বড় capacity ও service need-এর জন্য, feature-wall তৈরি
করার জন্য নয়।

## Plan limits and positioning

| Plan | Property | Rooms | Staff | Main promise |
|---|---:|---:|---:|---|
| Small Resort / Founding Resort | 1 | 50 | 15 | $20 early-partner price-এ Professional operational toolkit |
| Growing Resort | 1 | 100 | 30 | বড় single property, priority setup ও support |
| Resort Group | সর্বোচ্চ 5 | 200 | 50 | একাধিক property, group management ও onboarding |

5টির বেশি property, 200টির বেশি room, white-label, SSO, বা bespoke integration চাইলে `Contact sales` flow হবে। $100 plan-এ "unlimited" বলা হবে না।

### Included by plan

- **Launch: all three paid plans:** bookings, calendar, rooms, guests,
  check-in/check-out, invoices, reports, public booking site, staff access,
  housekeeping, browser/desktop access, restaurant/KOT, inventory, CRM,
  marketing, loyalty, offers, custom domain, channel sync, and advanced reports.
- **Small/Founding Resort:** the full operational toolkit with 1-property,
  50-room, 15-staff capacity and standard remote support.
- **Growing Resort:** larger capacity, priority setup/support, and a stronger
  future AI/reporting allowance. It is for scale and service, not a feature tax.
- **Resort Group:** multi-property dashboard, group-level management, revenue
  intelligence, advanced AI allowance, priority support, and onboarding help.

SMS, WhatsApp, payment-gateway charge, AI overage, custom design, onsite hardware setup, and data migration are metered or one-time services. এগুলোকে unlimited plan feature করা যাবে না।

### Phase 2 — after traction

Business-এ stable activation, support load, এবং paying customer proof আসার পরে
plan differentiation ধীরে ধীরে বাড়ানো যাবে। তখন `$50`/`$100` plan-এ new
automation, deeper analytics, higher AI allowance, and premium service যোগ করা
যাবে। Existing Founding Resort customer-এর protected 12-month access কাটা যাবে
না। নতুন feature gate বা price change-এর আগে activation/conversion data দেখে
সিদ্ধান্ত নিতে হবে; assumption থেকে নয়.

## Launch offer

### Customer promise

> **Founding Resort Launch Offer:** প্রথম 100টি eligible verified resort 1 August
> 2026 থেকে 31 August 2026-এর মধ্যে account খুললে August, September, এবং
> October—এই তিন calendar month ResortPro free ব্যবহার করা যাবে। Payment শুরু
> হবে 1 November 2026 থেকে; এরপর তাদের Founding Resort price `$20/month`।

এটি fixed-calendar promotion। এটি signup থেকে 90-day trial নয়। উদাহরণ:

| Signup date | Free access ends | First paid period |
|---|---|---|
| 4 August 2026 | 31 October 2026 | 1–30 November 2026 |
| 31 August 2026 | 31 October 2026 | 1–30 November 2026 |

প্রথম 100টি verified redemption পূর্ণ হয়ে গেলে, অথবা 1 September 2026 বা তার
পরে sign-up করলে standard 14-day trial পাবে, যদি নতুন promotion চালু না হয়।

### Conversion flow

1. Day 0: signup, email verification, resort profile completion, bKash wallet-link (offer activate করার শর্ত — নিচে দেখুন)।
2. Day 0: wallet-link + automated risk score + available Founding Resort slot সিদ্ধান্ত নেয় — approve (launch offer) বা silent-downgrade (standard 14-day trial), কোনো মানুষের অ্যাকশন ছাড়াই। প্রথম 100টি approved redemption-এর পর system automatically standard trial দেবে। উচ্চ risk score শুধু audit dashboard-এ log হয়, block করে না।
3. Day 45: in-app/onboarding message—selected plan এবং value reminder।
4. Day 75: first billing date ও plan confirm করার reminder।
5. Day 85: payment method বা bKash billing instruction চাওয়া।
6. Day 90: unpaid account 7 দিনের grace/read-only state-এ যাবে (নিচে "Payment verification policy" দেখুন); delete করা হবে না।

## Eligibility and abuse-prevention policy

### Policy

একটি verified resort/business একবারই launch offer নিতে পারবে। নতুন email address খুলে একই owner, same bKash wallet, বা একই business দিয়ে আবার offer নেওয়া যাবে না।

Suspicion মানেই account block নয়। Suspicious registration **automatically** standard trial পাবে (offer ছাড়া) — কোনো manual review queue নেই, তাই approve/reject করার জন্য কাউকে বসে থাকতে হবে না। প্রতিটা সিদ্ধান্ত audit log-এ থাকবে, দরকার হলে admin পরে দেখে revoke করতে পারবে, কিন্তু এটা normal flow-কে block করে না। এতে legitimate shared network বা family-owned business ভুল করে reject হলেও অভিজ্ঞতা খারাপ হয় না — তারা শুধু standard trial পায়, account আটকে থাকে না।

### Required signup controls

1. **Email verification** — unverified email দিয়ে account বা promotion activate হবে না।
2. **Mobile OTP — deferred, ভবিষ্যতের জন্য রাখা হয়েছে।** SMS gateway-তে টাকা লাগে (কোনো free Bangladesh SMS/OTP provider এখনো ঠিক করা হয়নি), তাই এই launch-এ implement করা হচ্ছে না। Data model-এ জায়গা রাখা আছে (নিচে দেখুন) — free/সস্তা provider পাওয়া গেলে পরে যোগ করা যাবে, তখন এটাই সবচেয়ে শক্ত dedup signal হয়ে উঠবে। আপাতত এর জায়গায় **bKash wallet-link primary dedup signal**।
3. **Resort identity** — resort name, full address, city, owner name, এবং optionally website/Facebook/Google Business link collect করতে হবে।
4. **bKash wallet-link** — signup-এর কাছাকাছি সময়ে, launch offer activate করতে bKash wallet number link/consent verify করতে হবে (charge না, শুধু ownership link — নিচে "Payment verification policy" দেখুন)। এক bKash wallet number একবারই promotion redeem করতে পারবে। Wallet link না করলে account normal ভাবে চলবে, শুধু standard 14-day trial পাবে, launch offer পাবে না।
5. **Server-side eligibility** — promotion decision browser-এর local state বা UI condition দিয়ে করা যাবে না। Registration transaction-এর মধ্যে API/DB থেকে check করতে হবে।
6. **Rate limits** — register, promotion-retry, এবং bKash wallet-link endpoint-এ strict per-IP ও per-wallet limits থাকবে।

### Fraud signals

নিচের signal automated score বাড়ায়; score একটা threshold পার হলে system নিজেই standard trial-এ silent-downgrade করে দেয় (কোনো manual approval লাগে না):

| Signal | Automated action |
|---|---|
| bKash wallet আগেই promotion নিয়েছে | Offer reject (auto); standard trial |
| Same normalized resort name + city/address | Score বাড়ে; threshold পার হলে auto-downgrade |
| Same device/browser fingerprint থেকে অনেক signup | Score বাড়ে; threshold পার হলে auto-downgrade |
| Short time-এ একই IP থেকে অনেক signup | Rate-limit + score বাড়ে |
| Disposable email domain | Score বাড়ে |
| bKash wallet-link সম্পূর্ণ না হলে | Offer activate হয় না (auto); standard trial |

IP এবং device fingerprint শুধু supportive signal। এগুলো একা ব্যবহার করে block করা যাবে না, কারণ hotel Wi-Fi, agency, বা shared office থেকে legitimate signup হতে পারে। **bKash wallet number-ই এখন সবচেয়ে শক্ত unique-identity signal** (OTP না থাকায়), তাই wallet-dedup check সবসময় হার্ড reject (auto), বাকি signal-গুলো শুধু soft score।

### Payment verification policy

Launch-এ conversion কমানোর জন্য signup-এর সময় card/charge বাধ্যতামূলক নয়, কিন্তু **bKash wallet-link launch offer পাওয়ার শর্ত**:

1. Signup-এর কাছাকাছি: resort identity + bKash wallet-link (consent/ownership check, charge না) → pass হলে automatic launch-offer approval, fail/skip হলে automatic standard 14-day trial। কোনো manual queue নেই।
2. যদি ভবিষ্যতে abuse বেড়ে যায় এবং wallet-link যথেষ্ট মনে না হয়, তখন refundable micro-verification বা trade license/business-page verification যোগ করার কথা ভাবা যাবে — এই launch-এ না।

Payment method ছাড়া renewal automatic বলা যাবে না। Day 85 থেকে user-কে bKash/card method যোগ করতে বলা হবে; payment না হলে **7 দিনের grace/read-only** state প্রযোজ্য হবে (data delete হবে না, শুধু access read-only)।

## Data model

একটি promotion-specific table যোগ করতে হবে। Wallet, IP, এবং fingerprint-এর raw value analytics বা admin list-এ দেখানো যাবে না; server-side secret দিয়ে HMAC hash সংরক্ষণ করতে হবে।

```prisma
model PromotionRedemption {
  id                      String   @id @default(uuid())
  promotionKey            String
  tenantId                String   @unique
  verifiedPhoneHash       String?  // deferred — populated only once mobile OTP ships
  walletIdentityHash       String  // bKash wallet-link, primary dedup key for this launch
  businessFingerprintHash String?
  deviceFingerprintHash   String?
  ipHash                  String?
  status                  PromotionRedemptionStatus @default(APPROVED)
  riskScore               Int      @default(0)
  reviewReason            String?
  redeemedAt              DateTime @default(now())
  expiresAt               DateTime
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([promotionKey, walletIdentityHash])
  @@index([promotionKey, verifiedPhoneHash])
  @@index([promotionKey, businessFingerprintHash])
  @@index([status])
}

enum PromotionRedemptionStatus {
  APPROVED
  DOWNGRADED   // auto-decided standard trial, no offer — replaces the old "REVIEW_REQUIRED"
  REJECTED
  REVOKED      // admin can still revoke after the fact if fraud is found later
}
```

`Tenant`-এ promotion metadata copy করা যেতে পারে (`promotionKey`, `promotionExpiresAt`) দ্রুত entitlement check-এর জন্য, কিন্তু eligibility/audit-এর source of truth হবে `PromotionRedemption`।

`verifiedPhoneHash` column রাখা হয়েছে যাতে ভবিষ্যতে OTP যোগ করলে বড় migration না লাগে — এই launch-এ সবসময় `null`।

## Backend design

### Promotion configuration

`PlatformSettings` বা dedicated `Promotion` table-এ নিচের values থাকবে:

```text
key: LAUNCH_2026_AUG
signupStartsAt: 2026-08-01T00:00:00+06:00
signupEndsAt: 2026-08-31T23:59:59+06:00
accessEndsAt: 2026-10-31T23:59:59+06:00
maxApprovedRedemptions: 100
eligiblePlans: STARTER, PROFESSIONAL, ENTERPRISE
enabled: true
```

Date comparison Asia/Dhaka timezone-এ server-side করতে হবে। Client clock বিশ্বাস করা যাবে না।

### Registration sequence

```text
POST /api/auth/register
  → validate body and rate-limit
  → create pending tenant/user
  → send email verification

POST /api/auth/link-bkash-wallet
  → verify wallet ownership (consent flow, no charge)
  → evaluate promotion eligibility transactionally (auto, no human step)
  → atomically reserve one of the first 100 approved slots (same DB transaction)
  → approved: create PromotionRedemption(status=APPROVED) + set trialEndsAt = 2026-10-31
  → downgraded or full: create PromotionRedemption(status=DOWNGRADED) + keep standard 14-day trial,
    show clear "you have the standard trial" message — never "blocked"/"fraud"
```

Wallet redemption check, first-100 slot count, এবং `PromotionRedemption` insert একই database transaction-এ হবে। Unique constraint/transaction ছাড়া concurrent multiple signup offer redeem করে ফেলতে পারে বা 100-এর বেশি slot চলে যেতে পারে।

### Admin visibility (not a working queue)

Super-admin-এ একটি `Launch Offer` **audit dashboard** দরকার — কাজ করার queue না, শুধু দেখার জন্য:

- approved / downgraded / rejected count
- match reasons: same wallet, business, device, IP
- revoke action (fraud পরে ধরা পড়লে) — এটাই একমাত্র manual action, normal flow-তে দরকার হয় না
- audit log-এ actor, timestamp, previous/new status
- export only hashed identifiers; raw wallet number দেখার permission restricted

## User experience and copy

Signup page-এ offer-এর নিচে এই কথা দেখাতে হবে:

> One launch offer per verified resort/business (linked via bKash wallet). Duplicate or abusive registrations automatically receive the standard trial instead.

First-100 capacity শেষ হলে public offer CTA এবং pricing badge সাথে সাথে hide/update
করতে হবে। পুরোনো offer copy cache/CDN-এ থেকে গেলে trust damage হবে।

Auto-downgrade হলে copy হবে:

> Your account is ready with the standard 14-day trial.

Reject/downgrade হলে "fraud" বা "blocked" লেখা যাবে না — এটা silent, neutral, এবং কখনো account access আটকায় না।

## Required application changes

1. Display name, price, Founding Resort room/staff capacity, এবং feature entitlement source এক করা। বর্তমানে website, billing, Stripe, এবং entitlement defaults-এর values এক নয়। Launch-এ `STARTER`/Founding Resort-কে Professional operational toolkit দিতে হবে; 12-month protection explicit entitlement data-তে রাখতে হবে, শুধু UI copy-তে নয়।
2. bKash wallet-link (consent/ownership, no charge) flow যোগ করা — signup-এর কাছাকাছি ধাপ হিসেবে।
3. `PromotionRedemption` migration, service, transaction, এবং automated scoring logic যোগ করা (manual review UI লাগবে না, শুধু audit dashboard)।
4. Register flow-এ wallet-link step যোগ করা (skip করা যাবে, কিন্তু তাহলে offer পাবে না)।
5. Billing status/upgrade page-এ launch expiry ও first paid date দেখানো।
6. Trial emails-এর copy ও schedule launch campaign অনুযায়ী update করা।
7. bKash billing activation এবং unpaid 7-day grace/read-only state implement করা।
8. Mobile OTP অংশটা কোডে **আনা হবে না** এই launch-এ — শুধু data model-এ ফাঁকা জায়গা রাখা।
9. Landing page ও `/plans`-এ Founding Resort badge/copy দেখানো এবং 100টি approved slot পূর্ণ হলে server-controlled flag থেকে সেটি hide/update করা।

## Test checklist

- Eligible new wallet + new resort while fewer than 100 approved slots → 31 October 2026 পর্যন্ত offer, কোনো manual step ছাড়াই।
- 100th valid redemption → approved; 101st valid redemption → standard trial, offer copy আর দেখায় না।
- Same wallet with new email → no offer, standard trial, automatically, instantly।
- Concurrent signup with same wallet → কেবল একটি approved redemption (transaction/unique constraint কাজ করছে)।
- Same business/address but different wallet → risk score বাড়ে, কিন্তু auto-decide হয় (কোনো queue-তে আটকে থাকে না)।
- Promotion end boundary: 31 August 23:59:59 Dhaka eligible; 1 September ineligible।
- Admin revoke action → entitlement ও audit log ঠিক থাকে (একমাত্র manual admin action)।
- 1 November unpaid account → 7 দিন grace/read-only, তারপরের policy, data intact।
- Plan name/price website, registration, billing, email, Stripe, এবং bKash-এ এক দেখায়।
- Founding Resort customer → Professional operational module access পায় এবং protected period-এর মধ্যে feature/price silently হারায় না।

## Rollout order

1. Normalize all public/internal pricing to $20 / $50 / $100 and add the Founding Resort presentation/12-month protection — কোনো নতুন vendor লাগে না, সবচেয়ে কম risk, এখনই শুরু করা যায়।
2. Ship bKash wallet-link flow, atomic 100-slot counter, এবং automated promotion eligibility service (no manual queue)।
3. Add admin audit dashboard (read-mostly) and audit logging।
4. Test abuse, 100-slot boundary, timezone boundary, and billing transition in staging।
5. Enable campaign and publish the offer page; immediately hide/update it when 100 slots are full.

## Status

Planning complete — revised 2026-08-04: Founding Resort strategy added ($20 gets Professional operational value, first 100 verified resorts, 12-month protection); OTP deferred, bKash wallet-link is the primary dedup signal, review queue fully automated, grace period fixed at 7 days. No production code, price, trial, or billing behaviour has been changed by this document.

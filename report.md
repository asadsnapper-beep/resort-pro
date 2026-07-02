# ResortPro — Pre-Launch Market Readiness Report

**Prepared:** 29 June 2026
**Reviewer:** Full-product audit across 3 user perspectives + critical backend systems
**Goal evaluated:** "Start selling this week."
**Environment audited:** `main` branch @ `29febba` (newest), running locally (web :3000, api :4000, Postgres + Redis via Docker).

---

## এক নজরে (TL;DR — সিদ্ধান্ত)

**Product টা ৮৫% তৈরি — feature দিক থেকে দারুণ, কিন্তু "এই সপ্তাহে বিক্রি" করার জন্য কয়েকটা জিনিস আটকে আছে যেগুলো ছাড়া বিক্রি করা ঠিক হবে না (legal, payment আদায়, ভুল domain, বানানো stat)।**

- ভালো খবর: তিনটা perspective-এর core flow (visitor site, owner dashboard, superadmin panel) সবই কাজ করে এবং দেখতে professional।
- আসল blocker গুলো feature নয় — **trust, legal, আর "টাকা কীভাবে নেবে"** — এগুলো ছাড়া payment processor approve করবে না, আর customer trust পাবে না।
- **বাস্তব পরামর্শ:** এই সপ্তাহে full public launch নয় → **এই সপ্তাহে ২–৩ জন pilot/beta customer** কে hand-hold করে নাও (manual onboarding), আর নিচের **P0 list** ঠিক করতে ৫–৭ দিন নাও, তারপর public sale।

**Verdict: 🟡 Soft-launch ready (pilot customers OK) · 🔴 Public self-serve sale: P0 গুলো আগে ঠিক করতে হবে।**

---

## Verdict at a glance

| Perspective | Works? | Polish | Launch blockers |
|---|---|---|---|
| 🛡️ Superadmin (you) | ✅ Yes | High (desktop) | Not responsive; some live-data wiring |
| 🏨 Resort Owner | ✅ Yes | High | Currency bug, SaaS payment method, onboarding friction |
| 🌐 Website Visitor | ✅ Yes | High | Dead `/resort/[slug]` route, layout overflow, seed-data quality |
| 💳 Commercial backend | ⚠️ Partial | — | **Legal pages, SaaS billing method, domain config, email sender** |

---

## 🔴 P0 — Must fix before taking ANY money (launch blockers)

These are not "nice to have." A payment processor will reject you, or a customer will lose trust, without them.

### 1. No legal pages exist (Terms, Privacy, Refund)
- **Finding:** No Terms of Service, Privacy Policy, or Refund/Cancellation page anywhere in the app.
- **Why it blocks sale:** Stripe, SSLCommerz, and bKash merchant onboarding **require** a live Terms + Refund + Privacy URL before they approve a merchant account. You also collect guest PII (CRM, ID scans) → privacy policy is legally required, and the app already advertises GDPR features.
- **Fix:** Add `/terms`, `/privacy`, `/refund` pages (footer-linked). A standard SaaS template adapted to ResortPro is enough to start.

### 2. How does a Bangladeshi resort owner pay YOU? (SaaS billing gap)
- **Finding:** The SaaS subscription (the $49/mo you charge owners) is **Stripe-only** (`billing.ts`). bKash and SSLCommerz are wired only for the *resort's guests*, not for *your* subscription revenue.
- **Why it blocks sale:** Your target is Bangladesh/Asia resorts. Most won't have an international card for Stripe. So today, **your own customers literally cannot pay you** through the product.
- **Fix (this week):** For pilots, collect subscription payment manually (bKash/bank transfer) and flip the plan in the admin panel. For scale, add bKash/SSLCommerz as a subscription option, or use a manual "request invoice" flow.

### 3. Currency is inconsistent and visibly broken
- **Finding:**
  - Landing & dashboards use **৳ (BDT)**.
  - Pricing page (`/plans`) and signup show **$49 USD**.
  - Room cards render **"$ ৳120/night"** — both symbols at once (real bug).
- **Why it blocks sale:** Pricing confusion kills conversion, and the double-symbol looks broken/untrustworthy.
- **Fix:** Pick one currency story (recommend: BDT pricing for BD market, or clearly localized), and fix the room-price template that prints both `$` and `৳`.

### 4. Fabricated trust stats & fake logos
- **Finding:** Landing claims "**Trusted by 200+ resorts**", "**50,000+ bookings**", "**৳12 Cr+ revenue**", "**4.9★**", plus 6 fake resort logos (Palm Paradise, Sea View Boutique…). Dashboard upgrade screen says "**500+ resorts**" (even inconsistent with the 200+).
- **Why it blocks sale:** For a product launching this week with 0 customers, these are false advertising — legally risky and reputationally fatal if a buyer checks. The number even contradicts itself (200 vs 500).
- **Fix:** Replace with honest framing for a new product ("Built for resorts in Bangladesh", "Now onboarding our first resorts", a real founder note, or remove the stat band until you have real numbers). Remove fake logos.

### 5. Wrong domain everywhere (30 occurrences)
- **Finding:** Your real domain is **resortpro.site**, but the code shows **resortpro.io**, **resortpro.com**, and **resortpro.app** in 30 places — including customer-facing instructions:
  - Email sender: `noreply@resortpro.app` → **emails will fail/spam** (domain not yours/unverified).
  - Custom-domain CNAME instructions shown to owners point to `{slug}.resortpro.app` (settings page) → **customer custom domains won't work**.
  - Embed snippet: `cdn.resortpro.io/embed.js` → embed widget won't load for customers.
  - Subdomain hint on signup: `your-resort.resortpro.com`.
  - Support/sales emails: `support@resortpro.app`, `sales@resortpro.com`.
- **Why it blocks sale:** These aren't cosmetic — wrong sender domain breaks transactional email (signup, password reset, receipts), and wrong CNAME/CDN breaks features customers are paying for.
- **Fix:** Global find-and-replace `resortpro.{io,com,app}` → `resortpro.site` and verify the email/CDN/CNAME targets actually exist and are configured.

### 6. Transactional email not production-ready
- **Finding:** Email uses Resend with a placeholder API key default and the wrong FROM domain (see #5).
- **Why it blocks sale:** Without working email, password reset, signup verification, and booking receipts silently fail.
- **Fix:** Set `RESEND_API_KEY`, verify `resortpro.site` (SPF/DKIM) in Resend, set `EMAIL_FROM=ResortPro <noreply@resortpro.site>`, and send one real test of each transactional email.

---

## 🟠 P1 — Fix within the first 1–2 weeks (hurts conversion / trust)

### 7. Dead public route: `/resort/[slug]` returns 404
- The canonical resort site works at `/<slug>` (e.g. `/palm-paradise-resort` ✅), but `/resort/<slug>` 404s. The "stay" discovery portal links toward this pattern. Confirm every internal link points at the working URL, and add a redirect from the old pattern.

### 8. Onboarding friction: login requires "Resort slug"
- Owner login asks for **slug + email + password**. Most SaaS need only email + password. Asking owners to remember their slug increases failed logins and support tickets. Consider email→tenant lookup (and keep slug only as a fallback/disambiguator).

### 9. Layout overflow on public "stay" pages
- On the discovery/stay layout, the "For Resort Owners" button overflows off the right edge (horizontal scroll). Fix the nav container width/overflow.

### 10. Admin panel is desktop-only (text overlaps on narrow screens)
- On tablet/narrow widths the MRR card text collides ("$99" / "$148" overlap). Fine on a wide monitor (your normal case), but add a min-width or responsive guard so it never looks broken if you demo on a laptop/tablet.

### 11. Seed/demo data quality
- Demo menu items have mismatched names/images (e.g. "Mango Cheesecake" shows a pizza, "Fresh Coconut Water" shows a rice bowl) and placeholder prices (BDT 8–12). Harmless for real customers (they upload their own), but **clean it before any demo/screenshots** — buyers will see it.

### 12. Confirm the real signup→trial→dashboard flow end-to-end
- I verified register/login APIs and the dashboard render, but the seeded tenant's trial had expired (showed the upgrade wall). Before launch, do one clean run: new signup → 14-day trial active → full dashboard access → trial-end → upgrade. Verify the trial countdown and the upgrade CTA both work.

---

## 🟡 P2 — Polish / post-launch

- **Decrypt payment credentials in production** — `payments.ts` has `// TODO: decrypt in production (AES-256)` for stored gateway keys. Required before real guest money flows at scale.
- **Custom-domain cache is in-memory** (`middleware.ts`) — resets on cold start; fine to launch, move to Redis later.
- **Bengali landing page (`/bn`)** also contains the wrong-domain references — include it in the find-and-replace.
- **Consolidate worktrees** — two stale git worktrees (`recursing-chandrasekhar`, `keen-mcnulty`) sit on old commits and caused a "my project looks backdated" scare. Run `git worktree remove` on the ones you don't need.
- **Accessibility/SEO pass** on the public resort sites (alt text, meta tags) — helps owners' Google ranking, a real selling point.

---

## What's genuinely strong (don't second-guess these)

You've built a lot, and it's good:

- **Feature breadth is excellent** — 40+ API route groups, 35+ dashboard pages: bookings, calendar, front desk, group bookings, CRM, loyalty, housekeeping, maintenance, restaurant/F&B, inventory, expenses, invoices, rate plans, packages, channels, marketing, AI content, multi-property.
- **Real payment integrations** — bKash (tokenized checkout) and SSLCommerz hit live endpoints; not stubs. Stripe subscription billing has full checkout + customer portal + webhooks.
- **Public resort website** is genuinely attractive (hero, booking CTA, room explorer, food menu with ordering).
- **Superadmin panel** is comprehensive (Tenants, Billing & MRR, Themes, Audit Log, GDPR, Domains, Health, Storage, Referrals, Announcements) and looks sharp on desktop.
- **Multi-tenancy + entitlements** — tenant-scoped DB layer, plan-based feature gating, trial system.
- **CI/CD** — now green after this week's fixes (lint, schema-drift, build, prisma generate all pass).

---

## Recommended path to revenue (realistic, this week)

1. **Days 1–2:** P0 #4 (honest stats), #3 (currency), #5 (domains) — fast, high-trust wins.
2. **Days 2–4:** P0 #1 (legal pages), #6 (email) — unlocks payment-processor approval + working comms.
3. **Days 3–5:** P0 #2 — decide the "owner pays you" method; for now, **manual bKash/bank + admin flips the plan** is fine for pilots.
4. **In parallel:** sign **2–3 pilot resorts** you onboard by hand. Real logos + a real testimonial replace the fake stats and become your launch proof.
5. **Then:** open self-serve signup publicly.

> বিক্রি শুরু করো এই সপ্তাহেই — কিন্তু **pilot হিসেবে, hand-holding করে**, public self-serve নয়। ৫–৭ দিনে P0 শেষ করে, ২–৩ জন real customer-এর logo/testimonial নিয়ে তারপর public launch। তাতে fake stat-এর দরকারও থাকবে না, trust-ও থাকবে।

---

## Appendix — Evidence checklist (what was actually tested)

| Area | Method | Result |
|---|---|---|
| Landing page | Browser screenshot + a11y snapshot | Renders; fake stats + wrong domain in mockup |
| Pricing `/plans` | Browser | Renders; USD vs ৳ mismatch |
| Signup `/auth/register` | Browser + API `POST /auth/register` | API works (needs `plan` enum uppercase); slug auto-generates |
| Login | API `POST /auth/login` + UI | Works; requires slug |
| Owner dashboard | UI after DB reseed + trial extend | Renders; rich sidebar; trial wall works |
| Rooms page | UI | Works; "$ ৳" double-currency bug |
| Public resort site `/<slug>` | UI | Works well (hero, menu, ordering) |
| `/resort/<slug>` | curl | 404 (dead route) |
| Superadmin panel | UI after admin seed | Works on desktop; overlaps on narrow |
| Admin tenants | UI | Lists tenant + actions |
| Payments (bKash/SSLCommerz) | Code | Real live-endpoint integrations |
| Subscription billing | Code | Full Stripe checkout/portal/webhook; Stripe-only |
| Email | Code | Resend; placeholder key + wrong FROM domain |
| Legal pages | File search | **Missing** |
| Domain consistency | grep | 30 wrong-domain refs |

*Note on local environment:* the local dev database had a failed migration and was reset + reseeded during this audit (local only — staging/production untouched). The app was run from the newest `main` code.

---
---

# Part II — The Business-Owner Lens: What's Missing to Make This a *Business*

> Part I above is the product audit (does it work?). This part is different. Put on the hat of a founder who has actually built a profitable B2B SaaS and ask the only question that matters: **"Will resort owners discover this, pay for it, succeed with it, and keep paying?"**
>
> A great product with no answer to that is a hobby, not a business. ResortPro the *product* is strong. ResortPro the *business* has gaps. Here they are, ranked by how much they decide whether you make money.

## এক নজরে (Business TL;DR)

Product বানানো সহজ অংশটা — তুমি সেটা ভালোভাবেই করেছ। কঠিন অংশ এখনো বাকি: **কীভাবে customer খুঁজে পাবে (distribution), কীভাবে প্রথম দিনেই value দেখাবে (activation), আর কীভাবে মাস ২–৩-এ ধরে রাখবে (retention)।** এই তিনটার পরিষ্কার plan ছাড়া feature যতই থাকুক, business দাঁড়াবে না। নিচে priority অনুযায়ী সাজানো।

---

## 🥇 The 3 questions that decide everything

### 1. Distribution — "তোমার প্রথম ১০০ customer কোথা থেকে আসবে?"
**Lacking:** There is a product, but no visible *acquisition engine*. Building a great dashboard does not make resort owners show up.
- Bangladeshi/Asian small-resort owners do **not** search Google for "resort management software." They are on **Facebook groups, WhatsApp, and trade associations**, and they trust **referrals from other owners** far more than ads.
- **What a successful founder does:** Pick ONE channel and dominate it before adding a second. For this market, the realistic stack is: (a) **direct/field sales** to resorts in one cluster (e.g. Cox's Bazar, Sylhet, Sreemangal) → walk in, demo on a tablet, set them up same day; (b) **owner-to-owner referral** (you already built a Referrals feature — make it the growth loop, not a buried menu item); (c) **the `stay.resortpro.site` discovery portal as a demand magnet** — if guests book through it, owners *need* to be listed, which sells the SaaS for you.
- **Action:** Write a one-page GTM: which 1 region, which 1 channel, target "10 paying resorts in 60 days," and the exact script/offer.

### 2. Activation — "Owner sign-up করার পর প্রথম ১০ মিনিটে কী 'wow' পাবে?"
**Lacking:** A 14-day trial is worthless if the owner never reaches value. Right now setup is manual (add rooms, rates, menu, photos one by one). Most SMB owners will sign up, get overwhelmed, and ghost. That is your #1 future churn source.
- **The "aha moment" must be engineered.** For a resort it is: *"I can see my live bookings / I took my first online payment / my booking page is live and shareable."* Time-to-that-moment should be minutes, not days.
- **What's missing:**
  - **Guided onboarding wizard** (you have an `/onboarding` page — make it a real step-by-step that ends in a live booking link).
  - **Data import** — they're "juggling spreadsheets and WhatsApp" (your own headline). Give them a **CSV/Excel import** for rooms + existing bookings, or do it *for* them in pilot. Re-typing months of bookings by hand = instant abandonment.
  - **Templated starting point** — pre-fill a sample resort they edit, instead of a blank slate.
- **Action:** Define the activation metric ("% of signups that publish a booking page within 24h") and instrument it. That single number predicts revenue.

### 3. Retention — "মাস ২-তে কেন owner টাকা দিতে থাকবে?"
**Lacking:** No visible stickiness or switching-cost strategy. Features attract; *habit and data lock-in* retain.
- **Stickiness levers you should lean on:** their **booking data lives here** (switching cost grows monthly), **guests have their booking link**, **staff log in daily**, **online payments route through you**. Make these the spine of the product so leaving is painful.
- **Retention features that are missing or buried:**
  - **An ROI dashboard for the OWNER** — not just operational stats, but *"ResortPro earned/saved you ৳X this month"* (online bookings captured, no-shows reduced, hours saved). Owners renew when they *see* the value, not assume it.
  - **Dunning / failed-payment recovery** — when a subscription card fails, you need automated retries + reminder emails or you'll bleed MRR silently. Not present.
  - **Lifecycle email** — trial day 1/3/7/13 nudges, onboarding tips, win-back after cancel. (You have `trial-emails.ts` — verify it's a real lifecycle sequence, not one email.)
- **Action:** Build the owner ROI summary + the trial lifecycle sequence. These two move renewal rate more than any new feature.

---

## 🥈 Pricing & Packaging — leaving money and conversions on the table

**Lacking — a deliberate monetization strategy:**
- **Wrong value metric.** Flat $49 "up to 20 rooms" under-charges big resorts and over-charges tiny guesthouses. The natural value metric here is **per-room** (or tiered room bands) — it scales price with the customer's size and ability to pay, and grows your revenue as they grow. This is the single biggest pricing lever.
- **Currency = local.** Price in **৳ (BDT)**, not USD, for a BD market. USD pricing signals "not for us" and adds card friction. (Also fixes the $/৳ inconsistency from Part I.)
- **Take-rate revenue is invisible.** You process guest payments (bKash/SSLCommerz). A real SaaS here often earns a **small % per transaction** on top of (or instead of) subscription — frequently larger than subscription MRR. Decide your model; don't leave it on the floor.
- **No annual lock-in push.** You have "Save 20% annual" — good — but annual prepay also *crushes churn* and improves cash flow. Make it the **default/recommended** option, not the secondary tab.
- **No "land" offer.** A new product fighting for trust often needs a low-friction entry: a cheap "Starter/Lite" tier or a **free forever single-property tier** to get owners in the door, then expand. Pure 14-day trial → $49 is a big first ask for an unknown brand.

**Action:** Move to per-room (or room-band) pricing in BDT, make annual the hero, and decide the transaction take-rate explicitly.

---

## 🥉 Trust & Social Proof — the engine you faked instead of built

**Lacking — a real proof engine** (Part I flagged the *fake* stats; here's the *business* fix):
- Buyers of a new tool ask one thing: *"কোন রিসোর্ট এটা use করে?"* You need **2–3 named pilot resorts, a logo wall, and one video/written testimonial** — these out-convert any feature list.
- **Reviews/ratings have no collection mechanism.** Build a simple "ask happy owners for a testimonial/review" loop (tie it to the Referrals feature).
- **Case study with numbers** — "Resort X increased direct bookings 30% in 60 days." One real case study is your best salesperson.

**Action:** The fastest path is the pilot plan from Part I — onboard 3 resorts by hand this week; their logos + words replace every fabricated stat.

---

## Support & Customer Success — underestimated, and decisive in this market

**Lacking:**
- **WhatsApp support is non-negotiable** for BD SMB owners — they will not file a ticket; they'll WhatsApp you. Make a WhatsApp number the primary support channel and put it in the app.
- **Bangla support + Bangla UI.** There's a `/bn` page, but is the *whole product* usable in Bangla? Owners and especially their staff need it. Half-Bangla erodes trust.
- **No onboarding-call / done-for-you setup offer.** For your first 50 customers, "we'll set it up with you on a call" is a feature, not a cost — it guarantees activation.
- **Self-serve help** — docs exist (`/docs`), good; make sure they're Bangla and linked from inside the app at the point of need.

---

## Measurement — you can't grow what you don't track

**Lacking — a product-analytics / metrics spine:**
- The admin panel shows MRR/tenants (good for *you*), but there's no evidence of **funnel + cohort instrumentation**: signup→activation→paid conversion, trial-to-paid %, **churn rate**, MRR cohorts, feature usage.
- A real SaaS operator lives in these numbers. Without them you're flying blind on *why* people don't convert or *why* they leave.
- **Action:** Instrument the funnel (even lightweight). Define and watch weekly: **activation %, trial→paid %, monthly churn %, net MRR.** These four run the business.

---

## Moat & Differentiation — why ResortPro, not eZee / Cloudbeds / Little Hotelier?

**Lacking — a stated wedge.** Big PMS players exist. You won't win on feature count; you win on a **sharp wedge**:
- **Local-first**: bKash/SSLCommerz native, Bangla, BDT, local support — the incumbents are weak here. *This is your real advantage — make it the entire pitch.*
- **The discovery portal (`stay.resortpro.site`)** is a potential **network-effect moat**: as guests book through it, being listed becomes essential, and you own demand, not just software. Most competitors are pure software. Lean into this.
- **Action:** Write one sentence: *"ResortPro is the only resort platform built for Bangladeshi resorts — local payments, local language, and a guest-booking network that brings you customers."* Then make every page say it.

---

## Operational / Commercial readiness gaps

- **Refund & cancellation policy** (also a P0 in Part I) — required for both compliance *and* customer trust at point of sale.
- **Invoicing for the subscription** (VAT/Mushak where applicable) — BD businesses need proper invoices to expense the tool.
- **Contract/MSA** for any sales-assisted deals.
- **Status page / uptime commitment** — owners run their business on this; one outage during peak booking and you lose them. A basic status/SLA promise builds confidence.
- **Backups & data-export for the customer** — owners must trust their data is safe and portable; advertise it (it *reduces* switching fear and *increases* signups).

---

## The 30-day business plan a successful founder would run

| Week | Focus | The one metric |
|---|---|---|
| **Week 1** | Fix P0 (legal, currency, domains, honest copy, email). Onboard **3 pilot resorts by hand** (you do the setup). | 3 live resorts |
| **Week 2** | Turn pilots into proof: logos, 1 testimonial, 1 mini case study. Stand up WhatsApp support + Bangla. Ship the onboarding wizard + CSV import. | Activation < 24h |
| **Week 3** | Switch pricing to per-room BDT, annual-first, decide transaction take-rate. Build owner ROI summary + trial lifecycle emails. | Trial→paid % |
| **Week 4** | Pick ONE acquisition channel (field sales in one region OR referral loop) and go all-in. Instrument the funnel. | 10 paying resorts |

> **Bottom line (founder's verdict):** তুমি ৯০% builders যেখানে আটকায় সেটা পেরিয়ে গেছ — **product টা আছে এবং ভালো।** এখন যেটা missing সেটা হলো **business mechanics**: distribution, activation, retention, local pricing, আর real proof. এগুলো ছাড়া এটা একটা চমৎকার product যেটা কেউ চিনবে না। এগুলো ঠিক করলে — এটা একটা business. কোড লেখা শেষ; এখন আসল কাজ শুরু।

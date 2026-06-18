# Resort Website — Review & Improvement Plan

Resort-এর booking website (dashboard builder + public site + booking flow) পুরো review করে পাওয়া observation ও fix plan। তিন দৃষ্টিকোণে দেখা: **guest**, **resort owner**, **SaaS/super-admin**।

> তারিখ: 2026-06-19 · ভিত্তি শক্ত, কিন্তু কয়েকটা গর্ত সরাসরি booking/টাকা হারায়।

---

## ✅ যা ইতিমধ্যে শক্ত (ভাঙবে না)

- ৪টা hardcoded theme (`luxe`, `minimal`, `coastal`, `tea-garden-eco-resort`) + AI/upload config-driven theme
- Live split-pane preview editor (postMessage bridge)
- Section on/off toggle (`hiddenSections`), color branding theme-এ সত্যিই apply হয়
- Proper image upload (URL paste না), gallery ২০ পর্যন্ত
- SEO: meta + per-slug `robots.ts` + `sitemap.ts`, GA4 (`googleAnalyticsId`)
- Custom domain + subdomain (`<slug>.resortpro.site`)
- Social links, WhatsApp button, pageview analytics
- Booking form + availability calendar, promo code, feedback→support ticket
- Multi-currency

**মূল ফাইল:**
- Builder: `apps/web/src/app/(dashboard)/dashboard/website/page.tsx`
- Public site: `apps/web/src/app/(public)/[slug]/page.tsx` + `PreviewPage.tsx`
- Themes: `apps/web/src/components/themes/*`
- Public API: `apps/api/src/routes/website.ts` (`publicWebsiteRoutes`)
- Model: `WebsiteContent` (schema.prisma)

---

## 🔴 P1 — Web booking একদম নীরব (সবচেয়ে বড়, সবচেয়ে সস্তা fix)

**পাওয়া গেছে:** `POST /site/:slug/book` একটা PENDING booking বানায়, response-এ confirmation number দেয় — কিন্তু **কোনো email/notification নেই** (`website.ts`-এ `sendEmail`/notification শূন্য, verified)।

**প্রভাব:**
- Guest কোনো confirmation email পায় না → অনিশ্চয়তা, আস্থা কম
- Owner জানেই না booking এসেছে → dashboard-এ PENDING বসে থাকে → guest হারায়

**Fix:**
- Booking create হওয়ার পর:
  1. **Guest-কে confirmation email** (confirmation no, room, dates, total, "pending — resort will confirm")
  2. **Owner-কে notification** — in-app `Notification` row + email (resort-এর `notifPaymentReceived`-এর মতো একটা `notifWebBooking` toggle)
- Existing email infra reuse: `apps/api/src/utils/guest-emails.ts`, `EmailSettings`, Resend
- Files: `apps/api/src/routes/website.ts` (book handler), `utils/guest-emails.ts`

**Effort:** ছোট (~আধা দিন)। **ROI: সর্বোচ্চ।**

---

## 🔴 P2 — একই room/date-এ PENDING double-booking সম্ভব

**পাওয়া গেছে:** booking conflict check শুধু `CONFIRMED`/`CHECKED_IN`-এর বিরুদ্ধে। দুই guest একই room একই date-এ PENDING booking করতে পারে।

**প্রভাব:** overbooking → খারাপ review, refund, manual সামলানো।

**Fix (options):**
- **A (সহজ):** conflict check-এ `PENDING`-ও include করো — তবে stale PENDING (যেগুলো কেউ confirm করেনি) auto-expire করতে হবে (যেমন ৩০ মিনিট hold), নাহলে রুম আটকে থাকবে।
- **B (ভালো):** "hold" concept — PENDING booking ১৫–৩০ মিনিট রুম hold করে; expire হলে release। (table ordering-এর serializable txn pattern reuse করা যায়)
- কমপক্ষে A এখন; B পরে payment-এর সাথে।
- Files: `website.ts` book handler (conflict where clause), একটা cleanup job।

**Effort:** ছোট–মাঝারি।

---

## 🟠 P3 — Room booking-এ online payment নেই (OTA-র সাথে compete)

**পাওয়া গেছে:** room booking শুধু "inquiry" (PENDING/paymentStatus PENDING)। অথচ **table ordering-এ pay-first আছে** আর **payment gateway registry (`TenantPaymentConfig`, bKash/SSLCommerz) already আছে**।

**প্রভাব:** guest এখনই confirm করতে পারে না → Booking.com/Agoda-তে চলে যায়।

**Fix:**
- Booking-এ optional "Pay now to confirm" — bKash/SSLCommerz/card দিয়ে deposit বা full
- Payment success → booking `CONFIRMED` + paymentStatus update, room নিশ্চিত block
- Existing `packages/payment-registry` + table ordering-এর pay-first flow reuse
- Owner toggle: "instant confirm with payment" vs "inquiry only" (সব resort gateway চায় না)
- Files: `website.ts` book + payment verify, `payment-registry`, booking form widget

**Effort:** মাঝারি। **(payment infra আছে বলে অর্ধেক কাজ হয়ে আছে)**

---

## 🟠 P4 — Testimonials হাতে টাইপ (real review import নেই)

**পাওয়া গেছে:** `testimonials` Json — owner manually লেখে।

**প্রভাব:** কম বিশ্বাসযোগ্য; owner-এর কষ্ট।

**Fix (ধাপে):**
- এখন: CSV/bulk import + better star-rating UI
- পরে: Google Places / Facebook review API দিয়ে auto-pull, বা একটা review widget embed
- Files: builder testimonials tab, একটা import endpoint

**Effort:** ছোট (CSV) → মাঝারি (API pull)।

---

## 🟡 P5 — কোথায় কী edit করব গুলিয়ে যায় (owner UX)

**পাওয়া গেছে:** website builder-এ hero/about/gallery/theme; কিন্তু **contact (phone/email/address) → Settings**, **room content → Rooms module**। কোনো ইঙ্গিত নেই।

**Fix:**
- Builder-এ একটা "Contact & Info" read-only কার্ড + "Edit in Settings →" link
- Rooms section preview-তে "Rooms manage করুন →" link
- ছোট onboarding hint

**Effort:** খুব ছোট।

---

## 🟡 P6 — Theme customization সীমিত

**পাওয়া গেছে:** শুধু ২টা color। Font নেই; section **hide হয় কিন্তু reorder হয় না**।

**Fix (ধাপে):**
- Google Fonts selector (heading/body)
- Section drag-to-reorder (`hiddenSections`-এর পাশে একটা `sectionOrder` array)
- আরও hardcoded theme (এখন ৪টা — competitor-এর চেয়ে কম)

**Effort:** মাঝারি।

---

## 🟡 P7 — SaaS-owner lens: conversion data + plan gating

**পাওয়া গেছে:**
- Pageview count আছে, কিন্তু **booking funnel নেই** (কত visitor → কত booking)
- Website/custom domain সব plan-এ খোলা কিনা স্পষ্ট না (paywall lever হতে পারে)

**Fix:**
- Owner dashboard-এ funnel: visitors → booking form open → submitted → confirmed + conversion %
- Custom domain / premium theme / "remove ResortPro badge" — paid plan-এ gate (feature flag দিয়ে)
- Files: website analytics endpoint, plan/feature-flag check

**Effort:** মাঝারি।

---

## 🛠️ Build Sequence (priority = টাকার প্রভাব)

| ধাপ | কাজ | Effort | কেন |
|-----|-----|--------|-----|
| 1 | **P1** — web booking email + owner notification | ছোট | সরাসরি booking/guest বাঁচায় |
| 2 | **P2** — PENDING double-booking আটকানো | ছোট–মাঝারি | overbooking রোধ |
| 3 | **P3** — online payment (instant confirm) | মাঝারি | OTA-র সাথে compete; infra আছে |
| 4 | **P4** — testimonials import | ছোট→মাঝারি | trust = conversion |
| 5 | **P7** — conversion analytics + plan gating | মাঝারি | retention/upsell/revenue |
| 6 | **P5** — builder edit-location hints | খুব ছোট | owner UX |
| 7 | **P6** — fonts + section reorder + আরও theme | মাঝারি | polish/differentiation |

> **সুপারিশ:** ধাপ ১ ও ২ এক বসায় (দুটোই `website.ts` book handler-এ, ছোট, সর্বোচ্চ প্রভাব)। তারপর ৩ (payment)।

---

## Quick wins (১ দিনের কম, এখনই করা যায়)
- P1 (email + notification)
- P2-A (PENDING conflict check)
- P5 (edit-location hints)

এই তিনটা মিলে guest experience + owner trust নাটকীয়ভাবে বাড়ায়, কোনো নতুন infra ছাড়াই।

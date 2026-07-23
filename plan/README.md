# ResortPro — Master Plan Index

সব planning document (feature plans, foundational architecture, marketing/GTM plan, AI roadmap) — আগে ৪টা আলাদা জায়গায় ছড়ানো ছিল (`plan/`, `docs/plan/`, `marketing-plan/`, `plans/`). এখন সব **এই একটা `plan/` folder-এর ভিতরে**, ৩টা subfolder-এ organized:

```
plan/
├── README.md                 ← তুমি এখানে আছো (master index)
├── custom-room-types.md      ← standalone feature plan
├── *.md                      ← ~65টা feature plan (এই README-এর নিচে categorized)
├── ai/                       ← AI feature plans (10টা) + rollout strategy
├── foundation/                ← original part-01..14 architecture plan
└── marketing/                 ← launch/GTM plan (কোনো code build status নাই, business plan)
```

**Status legend**: ✅ Built & working · 🟡 Partial (কিছু আছে, full scope না) · ❌ Not built (শুধু plan, code নাই) · 📋 Future/aspirational

*(Status ta 22 Jul 2026-এর একটা full codebase audit থেকে — feature list বাড়লে/build হলে re-audit lagbe, eta point-in-time snapshot.)*

---

## 🏗️ Core PMS (Property Management)

| File | কী আছে | Status |
|------|---------|--------|
| [front-desk.md](./front-desk.md) | Check-in/out, walk-in booking, room map, daily arrivals/departures | ✅ Built |
| [housekeeping.md](./housekeeping.md) | Room status tracking, cleaning tasks, staff assignment, floor map | ✅ Built |
| [maintenance.md](./maintenance.md) | Issue reporting, assignment, OOO room management | ✅ Built |
| [roles-permissions.md](./roles-permissions.md) | 7-role permission system, access matrix | 🟡 Partial — `/dashboard/roles` আছে, কিন্তু Staff page-এ merge করার plan (see [foundation/part-14](./foundation/part-14-staff-roles-merge.md)) হয়নি, ২টা আলাদা page-ই আছে |
| [staff-management.md](./staff-management.md) | Staff directory, shift scheduling, department management | ✅ Built |
| [shareholder-portal.md](./shareholder-portal.md) | Shareholder ownership %, payout tracking, self-service investor view, monthly auto-report | ✅ Built |

---

## 💰 Revenue & Pricing

| File | কী আছে | Status |
|------|---------|--------|
| [offers-promotions.md](./offers-promotions.md) | Offer creation, promo codes, website display, booking form integration | ✅ Built |
| [dynamic-pricing.md](./dynamic-pricing.md) | Seasonal rules, occupancy-based, day-of-week, advance/last-minute pricing | ❌ Not built — কোনো PricingRule model/seasonal logic নাই |
| [online-payment.md](./online-payment.md) | Stripe + bKash payment integration | ✅ Built — Stripe + bKash + SSLCommerz সব real |
| [corporate-accounts.md](./corporate-accounts.md) | Company/B2B client accounts — consolidated billing, credit terms, corporate rates (separate from one-off Group Bookings) | ✅ Built |
| [reporting-analytics.md](./reporting-analytics.md) | Revenue, occupancy, room performance, guest analytics, scheduled email reports | ✅ Built |

---

## 🌐 Public Website & Booking

| File | কী আছে | Status |
|------|---------|--------|
| [direct-booking-website.md](./direct-booking-website.md) | Full booking engine, Stripe checkout, guest portal, SEO | ✅ Built |
| [facilities-activities.md](./facilities-activities.md) | Facilities section, activity booking, public website display | ❌ Not built |
| [review-management.md](./review-management.md) | Auto review request, collect/approve/display, TripAdvisor/Google links | ❌ Not built |
| [theme-system.md](./theme-system.md) | Super Admin theme management + complete theme development guide for Claude | ✅ Built — ei session-e heavily rework hoyeche |
| [ui-design-plan.md](./ui-design-plan.md) | Full UI redesign plan (11 phases) — use with Claude for design work | 🟡 Partial — ad-hoc kore kisu page redesign hoyeche (sidebar, /try, website builder), systematic 11-phase execution hoy nai |

---

## 👥 Guest Management

| File | কী আছে | Status |
|------|---------|--------|
| [guest-crm.md](./guest-crm.md) | Guest profiles, booking history, loyalty program, points system, tiers | ✅ Built |
| [in-room-dining.md](./in-room-dining.md) | QR-based room food ordering, F&B billing | 🟡 Partial — table-QR ordering আছে, room-QR ordering নাই |

---

## 📣 Marketing & Communication

| File | কী আছে | Status |
|------|---------|--------|
| [sms-whatsapp-notifications.md](./sms-whatsapp-notifications.md) | Booking confirmation, reminders via SMS + WhatsApp | 🟡 Partial — send infra আছে, automated booking-confirm trigger নাই |
| [sms-whatsapp-billing.md](./sms-whatsapp-billing.md) | Per-tenant SMS quota, billing, BYOC credentials | ✅ Built |
| [sms-whatsapp-marketing.md](./sms-whatsapp-marketing.md) | Bulk campaign manager, audience segments, templates | ✅ Built |
| [referral-system.md](./referral-system.md) | Owner referral link → signup tracking → Admin reward (credit / free plan) | ✅ Built |

---

## 🏢 Venue & Events

| File | কী আছে | Status |
|------|---------|--------|
| [event-venue.md](./event-venue.md) | Conference/banquet/lawn booking, event management, pricing | ✅ Built — venue CRUD, booking with double-booking conflict check, half/full-day/hourly pricing. Public website enquiry form not included yet (dashboard-only for now). |

---

## 🔗 Channel Integration (OTA)

| File | কী আছে | Status |
|------|---------|--------|
| [external-calendar-sync.md](./external-calendar-sync.md) | iCal import — Booking.com/Airbnb URL paste → room auto-block | ✅ Built |
| [booking-com-integration.md](./booking-com-integration.md) | Full Booking.com XML API — certified partner required | ❌ Not built |
| [airbnb-integration.md](./airbnb-integration.md) | Airbnb Host API — OAuth, webhooks, messaging | ❌ Not built |
| [embed-plugin.md](./embed-plugin.md) | Embeddable booking widget for external websites | ✅ Built — `apps/embed` package |

---

## ⚙️ Platform & Infrastructure

| File | কী আছে | Status |
|------|---------|--------|
| [platform-owner-dashboard.md](./platform-owner-dashboard.md) | Super Admin — MRR, growth funnel, feature adoption, impersonation | ✅ Built |
| [tenant-backup-restore.md](./tenant-backup-restore.md) | Auto/manual backup, cloud storage, selective restore, plan retention | ❌ Not built — 🔴 High priority chilo originally, ekhono kono code nai |
| [mobile-electron-architecture.md](./mobile-electron-architecture.md) | Mobile + desktop app architecture | 🟡 Partial — Desktop (Electron, `apps/desktop`) built; Mobile (Expo) explicitly archived |

---

## 📦 Other

| File | কী আছে | Status |
|------|---------|--------|
| [custom-room-types.md](./custom-room-types.md) | Custom/flexible room type definitions | — (not yet audited in detail) |
| [security-plan.md](./security-plan.md) | Security hardening plan | — (not yet audited in detail) |
| [inventory.md](./inventory.md) | Stock items, categories, IN/OUT/ADJUSTMENT movements, low-stock filter | ✅ Built |
| [inventory-vendor-po.md](./inventory-vendor-po.md) | Vendor management, purchase orders (draft→sent→received), 30-day demand tracking, low-stock notification bell, CSV import/export | ✅ Built |

---

## 🤖 AI Features

Full detail: [ai/README.md](./ai/README.md) · Rollout order: [ai/ROLLOUT-STRATEGY.md](./ai/ROLLOUT-STRATEGY.md)

Only 3 AI feature-flags exist in the app (`ai_content`, `ai_chatbot`, `ai_business_insights`) — so at most 3 of these 10 plans have real infra; rest are plan-only.

| File | Feature | Status |
|------|---------|--------|
| [ai/ai-content-generator.md](./ai/ai-content-generator.md) | Marketing copy generation (Claude) | ✅ Built |
| [ai/ai-guest-chatbot.md](./ai/ai-guest-chatbot.md) | 24/7 AI guest concierge (Claude) | ✅ Built |
| [ai/ai-revenue-intelligence.md](./ai/ai-revenue-intelligence.md) | Revenue dashboard + "Ask your data" | 🟡 Partial — AIInsight model আছে, dedicated UI unclear |
| [ai/ai-dynamic-pricing.md](./ai/ai-dynamic-pricing.md) | AI-powered room rate optimization | ❌ Not built |
| [ai/ai-demand-forecasting.md](./ai/ai-demand-forecasting.md) | 30/60/90 day occupancy forecast | ❌ Not built |
| [ai/ai-review-sentiment.md](./ai/ai-review-sentiment.md) | Review analysis + monthly AI reports | ❌ Not built |
| [ai/ai-housekeeping-optimizer.md](./ai/ai-housekeeping-optimizer.md) | AI-optimized cleaning schedules | ❌ Not built |
| [ai/ai-guest-personalization.md](./ai/ai-guest-personalization.md) | Guest preferences + pre-arrival briefing | ❌ Not built |
| [ai/ai-staff-scheduling.md](./ai/ai-staff-scheduling.md) | AI staff roster optimization | ❌ Not built |
| [ai/ai-maintenance-predictor.md](./ai/ai-maintenance-predictor.md) | Predictive maintenance alerts | ❌ Not built |

---

## 🧱 Foundation — original architecture plan

Full index: [foundation/README.md](./foundation/README.md)

Part-01 থেকে Part-10 (auth, dashboard, public website, Stripe, super-admin, business control, email/automation, database schema, deployment) — **largely built**, real code matches. Part-11 onwards added later, `foundation/README.md`-এর নিজের table-এ ওগুলো নাই (index stale, files exist):

| File | কী আছে | Status |
|------|---------|--------|
| [foundation/part-11-future-roadmap.md](./foundation/part-11-future-roadmap.md) | Future phases (GDPR, SLA, enterprise) | 📋 Aspirational — `/admin/enterprise`, `/admin/gdpr` scaffolding আছে, depth unverified |
| [foundation/part-12-theme-system.md](./foundation/part-12-theme-system.md) | Theme system architecture | ✅ Built |
| [foundation/part-13-roles-and-permissions.md](./foundation/part-13-roles-and-permissions.md) | Roles & permissions design | 🟡 Partial (see Core PMS section above) |
| [foundation/part-14-staff-roles-merge.md](./foundation/part-14-staff-roles-merge.md) | Decision: merge Roles page into Staff page | ❌ Decided but not executed — conflicts with part-13, `/dashboard/roles` still separate |

---

## 📈 Marketing / GTM Plan (business plan, not code — no build status)

Full docs: [marketing/](./marketing/)

- [marketing/01-launch-plan.md](./marketing/01-launch-plan.md) — 60-day, 10-paying-customer pilot launch goal
- [marketing/02-field-sales-script.md](./marketing/02-field-sales-script.md) — Cox's Bazar / Sylhet in-person sales script
- [marketing/03-pilot-one-pager.md](./marketing/03-pilot-one-pager.md) — printable pilot pitch one-pager
- [marketing/04-facebook-posts.md](./marketing/04-facebook-posts.md) — Bangla FB content plan (2 sell : 6 value post ratio)

---

## 🎯 Biggest gaps if launching beyond the pilot

- **review-management** — guest review collect/display, zero code
- **tenant-backup-restore** — was 🔴 High priority, zero code — no customer-data safety net beyond manual DB backups
- **dynamic-pricing** — no seasonal/occupancy auto-rate automation
- **booking-com / airbnb** — only manual iCal paste, no real OTA channel management
- **facilities-activities** — can't showcase resort activities on the public site
- **shareholder-portal** — SHAREHOLDER role has no ownership %, payout history, or investor reporting — real multi-owner resorts currently track this outside the app

None of these block the **pilot-first strategy** (2–3 hand-onboarded resorts) already agreed in [marketing/01-launch-plan.md](./marketing/01-launch-plan.md) — core PMS + payments + CRM + admin panel are all solid. They matter once selling self-serve at scale.

---

## ✅ Recommended Build Order (original, still roughly valid)

```
Phase 1 — অবশ্যই এখনই (Core PMS):
  1. front-desk (check-in/out)          ✅ done
  2. housekeeping                        ✅ done
  3. offers-promotions                   ✅ done
  4. external-calendar-sync              ✅ done
  5. online-payment                      ✅ done

Phase 2 — পরের ৩ মাস:
  6. guest-crm + loyalty                 ✅ done
  7. dynamic-pricing                      ❌ still open
  8. review-management                    ❌ still open
  9. facilities-activities                ❌ still open
  10. reporting-analytics                 ✅ done
  11. sms-whatsapp-notifications          🟡 partial

Phase 3 — ৬+ মাস পরে:
  12. sms-whatsapp-marketing              ✅ done
  13. in-room-dining                      🟡 partial
  14. event-venue                         ✅ done
  15. staff-management                    ✅ done
  16. maintenance                         ✅ done
  17. booking-com-integration             ❌ still open
  18. airbnb-integration                  ❌ still open
```

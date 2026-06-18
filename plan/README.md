# ResortPro — Feature Plans

এই folder-এ ResortPro-র সব feature-এর implementation plan আছে।

---

## 🏗️ Core PMS (Property Management)

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [front-desk.md](./front-desk.md) | Check-in/out, walk-in booking, room map, daily arrivals/departures | 🔴 High | ~5.5 days |
| [housekeeping.md](./housekeeping.md) | Room status tracking, cleaning tasks, staff assignment, floor map | 🔴 High | ~5 days |
| [maintenance.md](./maintenance.md) | Issue reporting, assignment, OOO room management | 🟡 Medium | ~3 days |
| [roles-permissions.md](./roles-permissions.md) | 7-role permission system, access matrix | 🔴 High | ~1 day |
| [staff-management.md](./staff-management.md) | Staff directory, shift scheduling, department management | 🟡 Medium | ~4 days |

---

## 💰 Revenue & Pricing

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [offers-promotions.md](./offers-promotions.md) | Offer creation, promo codes, website display, booking form integration | 🔴 High | ~7 days |
| [dynamic-pricing.md](./dynamic-pricing.md) | Seasonal rules, occupancy-based, day-of-week, advance/last-minute pricing | 🟡 Medium | ~5.5 days |
| [online-payment.md](./online-payment.md) | Stripe + bKash payment integration | 🔴 High | — |
| [reporting-analytics.md](./reporting-analytics.md) | Revenue, occupancy, room performance, guest analytics, scheduled email reports | 🟡 Medium | ~7 days |

---

## 🌐 Public Website & Booking

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [direct-booking-website.md](./direct-booking-website.md) | Full booking engine, Stripe checkout, guest portal, SEO | 🔴 High | 8–11 weeks |
| [facilities-activities.md](./facilities-activities.md) | Facilities section, activity booking, public website display | 🟡 Medium | ~6.5 days |
| [review-management.md](./review-management.md) | Auto review request, collect/approve/display, TripAdvisor/Google links | 🟡 Medium | ~5 days |
| [theme-system.md](./theme-system.md) | Super Admin theme management + complete theme development guide for Claude | 🟡 Medium | ~3 days |
| [ui-design-plan.md](./ui-design-plan.md) | Full UI redesign plan (11 phases) — use with Claude for design work | 📋 Future | — |

---

## 👥 Guest Management

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [guest-crm.md](./guest-crm.md) | Guest profiles, booking history, loyalty program, points system, tiers | 🟡 Medium | ~6 days |
| [in-room-dining.md](./in-room-dining.md) | QR-based room food ordering, F&B billing | 🟡 Medium | ~3 weeks |

---

## 📣 Marketing & Communication

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [sms-whatsapp-notifications.md](./sms-whatsapp-notifications.md) | Booking confirmation, reminders via SMS + WhatsApp | 🔴 High | ~6 weeks |
| [sms-whatsapp-billing.md](./sms-whatsapp-billing.md) | Per-tenant SMS quota, billing, BYOC credentials | 🔴 High | ~5 weeks |
| [sms-whatsapp-marketing.md](./sms-whatsapp-marketing.md) | Bulk campaign manager, audience segments, templates | 🟡 Medium | ~3 weeks |
| [referral-system.md](./referral-system.md) | Owner referral link → signup tracking → Admin reward (credit / free plan) | 🟡 Medium | ~6 days |

---

## 🏢 Venue & Events

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [event-venue.md](./event-venue.md) | Conference/banquet/lawn booking, event management, pricing | 🟢 Low | ~5.5 days |

---

## 🔗 Channel Integration (OTA)

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [external-calendar-sync.md](./external-calendar-sync.md) | iCal import — Booking.com/Airbnb URL paste → room auto-block | 🔴 Highest | ~10 hours |
| [booking-com-integration.md](./booking-com-integration.md) | Full Booking.com XML API — certified partner required | 🟡 Medium | 14–20 weeks |
| [airbnb-integration.md](./airbnb-integration.md) | Airbnb Host API — OAuth, webhooks, messaging | 🟡 Medium | 18–28 weeks |
| [embed-plugin.md](./embed-plugin.md) | Embeddable booking widget for external websites | 🟢 Low | — |

---

## ⚙️ Platform & Infrastructure

| File | কী আছে | Priority | Est. Effort |
|------|---------|----------|-------------|
| [platform-owner-dashboard.md](./platform-owner-dashboard.md) | Super Admin — MRR, growth funnel, feature adoption, impersonation | 🔴 High | ~3 weeks |
| [tenant-backup-restore.md](./tenant-backup-restore.md) | Auto/manual backup, cloud storage, selective restore, plan retention | 🔴 High | ~3 weeks |
| [mobile-electron-architecture.md](./mobile-electron-architecture.md) | Mobile + desktop app architecture | 📋 Future | — |

---

## ✅ Recommended Build Order

```
Phase 1 — অবশ্যই এখনই (Core PMS):
  1. front-desk (check-in/out)
  2. housekeeping
  3. offers-promotions  ← guest সরাসরি website-এ দেখবে
  4. external-calendar-sync  ← double booking বন্ধ
  5. online-payment

Phase 2 — পরের ৩ মাস:
  6. guest-crm + loyalty
  7. dynamic-pricing
  8. review-management
  9. facilities-activities
  10. reporting-analytics
  11. sms-whatsapp-notifications

Phase 3 — ৬+ মাস পরে:
  12. sms-whatsapp-marketing
  13. in-room-dining
  14. event-venue
  15. staff-management
  16. maintenance
  17. booking-com-integration (certification লাগবে)
  18. airbnb-integration
```

---

## 🤖 AI Features

AI implementation-এর সব plan আলাদা folder-এ আছে।

| File | Feature | Priority | Est. Effort |
|------|---------|----------|-------------|
| [ai/ai-dynamic-pricing.md](./ai/ai-dynamic-pricing.md) | AI-powered room rate optimization | High | ~3 weeks |
| [ai/ai-guest-chatbot.md](./ai/ai-guest-chatbot.md) | 24/7 AI guest concierge (Claude) | High | ~3 weeks |
| [ai/ai-demand-forecasting.md](./ai/ai-demand-forecasting.md) | 30/60/90 day occupancy forecast | High | ~3 weeks |
| [ai/ai-review-sentiment.md](./ai/ai-review-sentiment.md) | Review analysis + monthly AI reports | Medium | ~2.5 weeks |
| [ai/ai-housekeeping-optimizer.md](./ai/ai-housekeeping-optimizer.md) | AI-optimized cleaning schedules | Medium | ~2.5 weeks |
| [ai/ai-revenue-intelligence.md](./ai/ai-revenue-intelligence.md) | Revenue dashboard + "Ask your data" | Medium | ~3 weeks |
| [ai/ai-guest-personalization.md](./ai/ai-guest-personalization.md) | Guest preferences + pre-arrival briefing | Medium | ~2 weeks |
| [ai/ai-staff-scheduling.md](./ai/ai-staff-scheduling.md) | AI staff roster optimization | Low | ~2 weeks |
| [ai/ai-maintenance-predictor.md](./ai/ai-maintenance-predictor.md) | Predictive maintenance alerts | Low | ~2 weeks |
| [ai/ai-content-generator.md](./ai/ai-content-generator.md) | Marketing copy generation (Claude) | Low | ~1 week |

→ **Full AI overview**: [ai/README.md](./ai/README.md)

---

## 📊 Total Effort Estimate (approximate)

| Phase | Features | Est. Time |
|-------|----------|-----------|
| Phase 1 | Core PMS + payments | 6–8 weeks |
| Phase 2 | Guest + revenue features | 8–10 weeks |
| Phase 3 | Advanced + integrations | 4–6 months |

# Subscription Plans — Ideal Structure (Super-Admin Configurable)

ResortPro-র ৩-tier subscription। মূল সিদ্ধান্ত: **কিছুই hardcode না — সব plan + কোন feature কোন plan-এ, super-admin থেকে configure হবে।** AI সব tier-এ থাকবে, পরিমাণ দিয়ে আলাদা।

> তারিখ: 2026-06-19

---

## নীতি (philosophy)

1. **Value metric = room সংখ্যা।** Resort বড় হলে দাম বাড়ে — স্বাভাবিক ও ন্যায্য। (`roomLimit` already আছে)
2. **Core কখনো crippled না** — booking/room/guest/housekeeping সব tier-এ।
3. **AI সব tier-এ, কিন্তু quota/scope দিয়ে আলাদা** — presence দিয়ে না। এতে প্রতিটা plan-এ AI value আছে, আর বেশি AI = upgrade trigger।
4. **প্রতি ধাপে স্পষ্ট upgrade trigger** — customer বড় হলে নিজেই উপরে উঠতে বাধ্য।
5. **Config-driven** — plan, দাম, limit, কোন feature, AI quota — সব super-admin Settings থেকে, deploy ছাড়াই।

---

## ৩ Tier (default — super-admin বদলাতে পারবে)

| | **Starter $19** | **Professional $49** ⭐ | **Premium $99** |
|---|---|---|---|
| কার জন্য | ছোট guesthouse | বাড়ন্ত resort | প্রতিষ্ঠিত/বড় |
| Rooms | ১০ | ৪০ | Unlimited |
| Staff seats | ৩ | ১০ | Unlimited |
| Core PMS (booking, rooms, guests, housekeeping, calendar) | ✅ | ✅ | ✅ |
| Booking website | subdomain + badge | **custom domain, badge নেই** | custom domain |
| Invoicing | basic | ✅ | ✅ |
| F&B + table ordering | ❌ | ✅ | ✅ |
| CRM + email/SMS marketing | ❌ | ✅ | ✅ |
| Offers / packages / loyalty | ❌ | ✅ | ✅ |
| OTA/iCal sync (Airbnb, Booking) | ❌ | ✅ | ✅ |
| Reports | basic | advanced | advanced + revenue intelligence |
| Multi-property | ❌ | ❌ | ✅ |
| Support | email | priority email | priority |
| **AI — সব tier-এ** | content generator (basic) | content + chatbot | সব AI (content + chatbot + business suggestions) |
| **AI monthly quota** | ছোট (~30 গেন/মাস) | মাঝারি (~300) | বড় (~1500) |

> AI সব tier-এ — শুধু **কতটা** আর **কোন AI** আলাদা। quota শেষ হলে → AI credit pack কেনা (extra revenue) বা upgrade।

### Pricing rationale
- **Spread ১ : ২.৬ : ৫.২** ($19 / $49 / $99) — Premium হলো anchor (বড় resort ধরে), Professional মাঝখানে "best value", Starter সহজ "হ্যাঁ"।
- **Charm pricing** — সব $9 ending।
- **Starter কড়াভাবে সীমিত** (১০ room, F&B/marketing/OTA নেই, ছোট AI cap) — entry tier-এর কাজ দরজা খোলা, থিতু হওয়া না। নাহলে কেউ upgrade করবে না।
- **$19-এ AI margin** — token খরচ যেন লাভ না খায় → Starter-এ AI cap ছোট (content-only ~৩০/মাস); বেশি লাগলে upgrade বা credit pack।
- **উঁচু list price + founder discount** — early customer-দের promo (যেমন প্রথম ৩ মাস ৫০% off) দাও; list price উঁচুই থাকে, পরে discount তুলে নেওয়া সহজ। দাম বাড়ানো কঠিন, কমানো সহজ।
- **Annual = ২ মাস free** → $190 / $490 / $990।
- **Market caveat:** এগুলো structure/ratio হিসেবে নাও। শুধু BD-local হলে ৳-এ ভাবা (যেমন ৳1500 / ৳3900 / ৳7900); আঞ্চলিক/আন্তর্জাতিক হলে Premium $149+ হতে পারে।

---

## কেন super-admin configurable (hardcode না)

| Hardcode | Config-driven (recommended) |
|----------|------------------------------|
| দাম বদলাতে deploy | super-admin Settings-এ instant |
| Promo/experiment কঠিন | যেকোনো সময় tier টিউন |
| Feature gate কোডে ছড়ানো | এক জায়গায় (plan config) |
| একজন customer-কে special feature দেওয়া কঠিন | per-tenant override দিয়ে সহজ |

তোমার `PlatformSettings.plans` (JSON) + super-admin Settings UI ইতিমধ্যে আছে — শুধু প্রতিটা plan-এ "কোন feature/AI unlock হবে" যোগ করতে হবে।

---

## আর্কিটেকচার — Entitlements model

### Plan config (super-admin-এ edit হবে)
`PlatformSettings.plans[]`-এর প্রতিটা object extend করা হবে:

```jsonc
{
  "key": "PROFESSIONAL",
  "name": "Professional",
  "price": 50,
  "annualPrice": 500,          // ২ মাস free
  "roomLimit": 40,
  "staffLimit": 10,
  "features": ["..."],          // marketing bullets (display only)
  "flags": [                    // এই plan যে feature flag গুলো on করে
    "restaurant_module", "crm_v2", "ota_sync",
    "custom_domain", "ai_content", "ai_chatbot"
  ],
  "aiMonthlyTokenCap": 300000   // AI quota (0 = AI off)
}
```

### Entitlement resolution (runtime)
```
tenant.plan  →  plan config (PlatformSettings.plans থেকে)
                     ↓
   enabled features = plan.flags  ∪  per-tenant override (TenantFeatureFlag)
                     ↓
   AI cap = plan.aiMonthlyTokenCap   (ai-guard + ai_usage এর সাথে যুক্ত)
```

- **Plan = default entitlement।** Tenant-এর plan বদলালে flags auto আপডেট।
- **Per-tenant override থাকবেই** (`TenantFeatureFlag`) — কাউকে plan না বদলে একটা feature দিতে/কাড়তে। (যেমন beta access, special deal)
- Resolution rule: **override > plan default**।

### বিদ্যমান infra-র সাথে যুক্ত
- Feature flags: `TenantFeatureFlag` + `FLAG_REGISTRY` — already আছে
- AI gate: `isAiEnabled()` + master switch + `ai_usage` — already আছে; শুধু `aiMonthlyTokenCap` plan থেকে পড়ে cap enforce করতে হবে
- Plans JSON + Settings UI — already আছে; extend করতে হবে

---

## AI quota / credits (সব tier-এ AI রাখার মূল কৌশল)

- প্রতি tenant-এর `aiMonthlyTokenCap` plan থেকে আসে → `ai_usage`-এ track → cap ছুঁলে hard stop + "upgrade বা credit কিনুন"
- **AI credit pack** = আলাদা one-time purchase (quota শেষ হলে) → বাড়তি revenue
- Platform-managed key model (BYOK optional) — মনে আছে: AI cost না, revenue stream

---

## আরও lever

- **Annual = ২ মাস free** (cash flow + কম churn) — `annualPrice` field-এ
- **14-day trial** (already আছে) → Professional দিয়ে trial শুরু করাও (সব দেখে অভ্যস্ত হোক)
- **উপরে "Enterprise — Contact us"** — multi-property chain, white-label, custom AI cap; দাম negotiate (config-এ একটা hidden/custom plan)

---

## সতর্কতা (সৎভাবে)

- দামগুলো কাছাকাছি ($30→$50→$70) — tier crisp আলাদা না হলে customer গুলিয়ে ফেলবে। **Room limit + AI quota** দিয়ে পার্থক্য পরিষ্কার রাখো।
- Plan downgrade-এ কী হবে ঠিক করতে হবে — যদি ৪০ room-এর tenant Starter-এ নামে (১৫ room cap)? → existing data রাখো, নতুন room add আটকাও + warning।

---

## Build Sequence

| ধাপ | কাজ | Effort |
|-----|-----|--------|
| 1 | `PlatformSettings.plans`-এ `flags[]`, `staffLimit`, `aiMonthlyTokenCap`, `annualPrice` যোগ | ছোট |
| 2 | Entitlement resolver: tenant.plan → flags + limits (override সহ) | মাঝারি |
| 3 | Plan বদলালে flags auto-apply | ছোট |
| 4 | Super-admin Settings UI: প্রতি plan-এ feature checkbox + AI cap | মাঝারি |
| 5 | AI cap enforce (`ai_usage` vs plan cap) + "limit reached" UX | ছোট |
| 6 | Room/staff limit enforce + downgrade rule | ছোট |
| 7 | AI credit pack purchase (পরে) | মাঝারি |

> **ভিত্তি:** ধাপ ১–২ আগে (plan config + resolver)। বাকি সব এর উপর দাঁড়ায়।

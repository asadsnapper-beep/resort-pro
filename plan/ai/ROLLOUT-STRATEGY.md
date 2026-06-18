# AI Rollout Strategy — Build Now, Run Later

> এই doc-টা আমাদের সিদ্ধান্ত মনে রাখার জন্য — **কীভাবে AI feature গুলো বানাবো কিন্তু টাকা না হওয়া পর্যন্ত off রাখবো।**
> তারিখ: 2026-06-18 · সিদ্ধান্ত: feature flag-এর পেছনে build, default OFF, super-admin থেকে control।

---

## 🎯 মূল কৌশল (এক প্যারায়)

Core product (booking, F&B, table ordering, invoice, website builder) **AI ছাড়াই এখন launch হবে** — token খরচ শূন্য। AI feature গুলো **এখনই বানিয়ে রাখব কিন্তু feature flag-এর পেছনে লুকিয়ে (default OFF)**। Build-এ কোনো Claude token লাগে না — শুধু *চালালে* লাগে। টাকা হলে super-admin dashboard থেকে flag ON করে দিলেই AI চালু — নতুন deploy লাগবে না।

**নীতি:** Build is free. Running costs money. তাই আগে বানাও, পরে চালাও।

---

## কেন এই approach

| কারণ | ব্যাখ্যা |
|------|----------|
| Context এখন গরম | plan + decisions এখন তাজা — পরে নতুন করে শুরু করার চেয়ে সস্তা |
| Build = $0 token | code, migration, UI — কোনোটায় token লাগে না |
| Instant flip | টাকা হলে super-admin flag ON → deploy ছাড়াই চালু |
| Infra আছে | `TenantFeatureFlag` model + super-admin dashboard already আছে — নতুন কিছু না |
| Launch আটকায় না | AI না থাকলেও product-এর ৯০% value আজকেই deliver হয় |

---

## 🚦 দুই স্তরের Feature Flag (বাধ্যতামূলক)

```
1. Global master switch  (platform-wide, super-admin only)
   └── ai_enabled_global = false   ← পুরো AI off

2. Per-tenant flag       (super-admin per customer)
   └── TenantFeatureFlag: "ai_features" = false
```

- দুটোই OFF = AI module-এ কোনো request যায়ই না (zero cost, zero risk)।
- Global ON + per-tenant ON = ঐ customer AI পায়।
- এতে একজন paying customer-কে test দিয়ে বাকিদের off রাখা যায়।

**Server গার্ড:** প্রতিটা `/api/ai/*` ও guest-chat route-এর শুরুতে flag check → off হলে `404`/`403`, Claude call পর্যন্ত পৌঁছায় না।

---

## 📦 যা এখনই করব (token ছাড়া, OFF অবস্থায়)

### Step 1 — Feature flag plumbing
- [ ] Global `ai_enabled_global` setting (super-admin)
- [ ] `TenantFeatureFlag` "ai_features" per-tenant
- [ ] Route guard middleware: flag off → block before any Claude call
- [ ] Super-admin UI: AI on/off toggle (global + per-tenant)

### Step 2 — AI schema ship করা (OFF অবস্থায়ও)
Migration-এ token লাগে না, আর পরে enable করতে আলাদা migration-এর ঝামেলা থাকবে না। এখনই দিয়ে দাও:
- [ ] `AiKeys` (mode: platform/byok, encrypted keys)
- [ ] `AiUsage` (token/query tracking)
- [ ] `GeneratedContent` (content generator, draft-first)
- [ ] `BookingLead` (chatbot lead capture)
- [ ] `GuestChatSession`, `AiAbuse` (chatbot security)
- [ ] `RevenueSnapshot`, `AIInsight` (business suggestions)

### Step 3 — শুধু ৩টা feature build (১০টা না)
High-value ৩টা flag-এর পেছনে:
1. **Content Generator + Onboarding** — [ai-content-generator.md](./ai-content-generator.md)
2. **Guest Chatbot + Booking** — [ai-guest-chatbot.md](./ai-guest-chatbot.md)
3. **Revenue / Business Suggestions** — [ai-revenue-intelligence.md](./ai-revenue-intelligence.md)

বাকি ৭টা plan-এ থাক, পরে দরকার হলে।

### Step 4 — একবার test করে OFF করা ("hidden but verified")
⚠️ Flag-এর পেছনে **untested code রাখা ফাঁদ** — flip-এর দিন কাজ না করলে বিপদ।
- [ ] Anthropic free credit / সামান্য Haiku দিয়ে dev-এ একবার প্রতিটা feature চালিয়ে verify
- [ ] কাজ করছে নিশ্চিত হয়ে flag OFF করে ship
- নীতি: **"hidden and verified"**, **"hidden and never run" না**

### Step 5 — Module isolation
- [ ] সব AI code আলাদা module-এ: `apps/api/src/routes/ai/`, `apps/api/src/services/ai/`, `apps/web/src/...ai/`
- [ ] Flag off = ঐ module-এ কোনো request যায় না → live product-এ bug/maintenance burden শূন্য

---

## 💰 টাকা হলে যা করব (পরে)

1. Super-admin → global `ai_enabled_global` = true
2. প্রথমে **BYOK mode** — যে customer AI চায় সে নিজের token-এর টাকা দেয় → তোমার খরচ শূন্য
3. ২–৩ জন paying customer হলে subscription revenue দিয়ে **platform-managed key** কিনে markup-এ AI বেচা
4. Cost কমাতে: **Haiku model** (Sonnet না), prompt caching, nightly batch jobs

---

## ❌ যা করব না

- AI-র টাকার জন্য launch আটকে রাখা
- ১০টা AI feature একসাথে বানানো
- কখনো test না করে flag-এর পেছনে code লুকানো
- সব customer-কে BYOK setup করতে বাধ্য করা (AI optional, core না)
- AI-কে raw SQL/DB write access দেওয়া (README "AI Abuse Hardening" দেখো)

---

## 🔗 সম্পর্কিত doc

- [README.md](./README.md) — cost model, abuse hardening, model naming alignment
- [ai-content-generator.md](./ai-content-generator.md) · [ai-guest-chatbot.md](./ai-guest-chatbot.md) · [ai-revenue-intelligence.md](./ai-revenue-intelligence.md)
- Launch-এর জন্য আসল পরবর্তী কাজ: **subscription billing** (AI নয়) — customer থেকে টাকা নেওয়ার ব্যবস্থা

---

## এক লাইনে মনে রাখার কথা

> **Build behind flag, default OFF, super-admin controlled. Build is free, running costs money — তাই আগে বানাও, verify করো, off করে রাখো; টাকা হলে flip করো।**

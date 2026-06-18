# AI Implementation Plan — ResortPro

এই ফোল্ডারে ResortPro প্ল্যাটফর্মের সমস্ত AI feature-এর implementation plan রয়েছে।

## Feature List

| # | Feature | File | Priority | Status |
|---|---------|------|----------|--------|
| 1 | AI Content Generator + Onboarding | [ai-content-generator.md](./ai-content-generator.md) | **High** ↑ | Planned |
| 2 | AI Guest Chatbot + Booking | [ai-guest-chatbot.md](./ai-guest-chatbot.md) | High | Planned |
| 3 | AI Revenue / Business Suggestions | [ai-revenue-intelligence.md](./ai-revenue-intelligence.md) | **High** ↑ | Planned |
| 4 | AI Dynamic Pricing Engine | [ai-dynamic-pricing.md](./ai-dynamic-pricing.md) | High | Planned |
| 5 | AI Demand Forecasting | [ai-demand-forecasting.md](./ai-demand-forecasting.md) | Medium | Planned |
| 6 | AI Review & Sentiment Analysis | [ai-review-sentiment.md](./ai-review-sentiment.md) | Medium | Planned |
| 7 | AI Housekeeping Optimizer | [ai-housekeeping-optimizer.md](./ai-housekeeping-optimizer.md) | Medium | Planned |
| 8 | AI Guest Personalization | [ai-guest-personalization.md](./ai-guest-personalization.md) | Medium | Planned |
| 9 | AI Staff Scheduling | [ai-staff-scheduling.md](./ai-staff-scheduling.md) | Low | Planned |
| 10 | AI Maintenance Predictor | [ai-maintenance-predictor.md](./ai-maintenance-predictor.md) | Low | Planned |

> **Priority v2 (re-ordered):** Content+Onboarding আর Revenue Suggestions উপরে তোলা হয়েছে — কারণ এ দুটো সরাসরি **acquisition (খালি dashboard ভরা)** আর **money (business suggestion)**-এ আঘাত করে। Pricing/Forecasting-এর cold-start সমস্যা আছে (নতুন tenant-এর historical data নেই), তাই rule-based থেকে শুরু — নিচে dynamic-pricing plan দেখো।

## Architecture Overview

```
ResortPro AI Layer
├── Claude API (Anthropic)          — chatbot, content generation, analysis
├── Internal ML Models              — pricing, demand forecasting
├── Embeddings + Vector DB          — guest personalization, search
└── Scheduled AI Jobs               — nightly analytics, recommendations
```

## Tech Stack

- **LLM**: Claude claude-sonnet-4-6 (via Anthropic SDK)
- **Embeddings**: `text-embedding-3-small` বা Claude Embeddings
- **Vector DB**: pgvector (existing PostgreSQL-এ extension হিসেবে)
- **Queue**: Bull/BullMQ (Redis) — async AI jobs
- **API**: Fastify endpoints in `apps/api`
- **Frontend**: React components in `apps/web`

## Cross-Cutting Design Decisions

এই decisions সব AI feature-এ apply হবে — feature-specific plan-এ repeat করা হয়নি।

### Security
| Rule | কীভাবে |
|------|--------|
| API key never in plaintext | AES-256-GCM encrypt, `packages/utils/ai-crypto.ts` |
| API key never logged | সব AI call-এর আগে/পরে log করা নিষেধ |
| Multi-tenant isolation | প্রতি Claude call-এ `tenantId` server-side inject — user input থেকে না |
| Prompt injection defense | Multi-layer (নিচে Abuse Hardening দেখো) — শুধু regex নয় |
| No raw AI SQL | AI কখনো SQL লেখে না; predefined parameterized query + read-only DB role (revenue plan দেখো) |

### Cost Control
| Control | সব feature-এ |
|---------|-------------|
| BYOK model | Owner নিজের Anthropic key দেবে — platform cost zero |
| `AiUsage` tracking | প্রতি feature-এ `month` key দিয়ে track |
| Dashboard vs guest | `"YYYY-MM"` vs `"YYYY-MM-guest"` — আলাদা tracking |
| Monthly query limit | 500/month soft cap (feature level) |
| Batch over real-time | Heavy jobs (pricing, forecasting) রাতে — real-time শুধু chat |
| Fallback-first | Claude unavailable হলে rule-based/cached response |

### Privacy
| Rule | কীভাবে |
|------|--------|
| IP never stored plain | SHA-256 hash only |
| Guest chat: no personal data | নাম, email, phone collect করবে না |
| Guest conversation: memory-only | Session শেষে gone — DB-তে message save নেই (Phase 1) |
| AiAbuse log: trimmed | flaggedMsg 500 char-এ trim করে store |

### API Key Management
```
Owner → Settings UI → PUT /ai/settings
              ↓
        encryptKey()  ←  AES-256-GCM (AI_ENCRYPTION_KEY env var)
              ↓
        AiKeys table (dashboardKey, guestKey)
              ↓
Any AI feature → decryptKey() → Anthropic client (per-request)
```
- `dashboardKey` — owner dashboard AI, pricing, revenue features
- `guestKey` — guest chatbot (optional, falls back to dashboardKey)

### Token Budgets
| Feature | Max input context | Max output tokens |
|---------|------------------|------------------|
| Guest chat | Last 6 messages | 512 |
| Dashboard chat | Last 10 messages | 1024 |
| Pricing suggestion | Single prompt | 150 |
| Revenue query explanation | Single prompt | 256 |
| Weekly briefing | Aggregated data | 512 |
| Review analysis | Single review | 400 |
| Content generation | Brief + context | 600 |

---

## Guiding Principles

1. **Multi-tenant safe** — প্রতিটি AI call-এ `tenantId` server-side scope করা হবে
2. **Cost-aware** — usage tracking + token budgets + batch jobs (key model নিচে দেখো)
3. **Security-first** — key encryption + prompt injection defense + privacy by default
4. **Fallback-first** — AI unavailable হলে rule-based fallback চলবে
5. **Explainable** — AI recommendation-এর সাথে কারণ দেখানো হবে
6. **Human-in-the-loop** — AI কখনো নিজে কিছু publish/apply করে না; সব proposal → owner approve → তারপর system apply

---

## ⚠️ Model Naming Alignment (IMPORTANT — code শুরুর আগে ঠিক করো)

এই plan ফাইলগুলো abstract-ভাবে লেখা — actual codebase schema-র সাথে মেলে না। Code শুরুর আগে সব AI model নিচের নাম অনুযায়ী ঠিক করতে হবে:

| Plan-এ লেখা (ভুল) | আসল codebase model | Field |
|-------------------|--------------------|-------|
| `Hotel`, `Resort` | `Tenant` | `tenantId` |
| `Reservation` | `Booking` | — |
| `RoomType` | `Room` (আলাদা RoomType model নেই) | `Room.type` field |
| `resortId`, `hotelId` | `tenantId` | — |
| `RatePlan` | `RatePlan` ✅ (ঠিক আছে) | — |

সব নতুন AI model-এ `tenantId String` + `@@index([tenantId])` + Tenant relation — existing pattern অনুযায়ী।

---

## 💰 AI Cost Model Decision (BYOK বনাম Platform-Managed)

**Original plan: BYOK** (owner নিজের Anthropic key দেবে, platform cost zero)।

**সমস্যা:** non-technical resort owner-কে console.anthropic.com → account → USD credit card → API key — এই process করানো বড় adoption barrier। তোমার pitch ("নিজে পারি ≠ নিজে করবো")-এর বিপরীত। BD-তে অনেকের USD card-ও নেই।

**Decision (v2): Hybrid**
- **Default: Platform-managed key** — platform Anthropic credit পাইকারিতে কেনে, plan tier-এ "AI credits" হিসেবে markup দিয়ে বেচে। AI = **revenue stream + premium upsell**, cost না।
- **Optional: BYOK** — technical owner চাইলে নিজের key দিতে পারবে (power-user feature, default না)।
- প্রতি tenant-এ hard monthly token cap → cost runaway / financial-DoS বন্ধ।

`AiKeys` table-এ তাই `mode: "platform" | "byok"`। Platform mode-এ owner কোনো key দেয় না।

---

## 🔒 AI Abuse Hardening (Cross-Cutting — সব feature-এ বাধ্যতামূলক)

"Hacker যাতে কোনোভাবেই AI misuse করতে না পারে" — এর আসল প্রতিরক্ষা regex না, **architecture**। Defense-in-depth, ৯টা স্তর:

| # | স্তর | নিয়ম |
|---|------|------|
| 1 | **No-tools architecture** (সবচেয়ে গুরুত্বপূর্ণ) | AI-র কোনো direct DB write বা SQL access নেই। AI শুধু **text/JSON propose** করে। DB-তে কিছু যাওয়ার আগে server-side validation + (write হলে) owner approval লাগে। |
| 2 | **Server-side scoping** | প্রতি AI call-এ `tenantId` **server-side inject** — কখনো user input/client থেকে না। এক tenant অন্য tenant-এর data দেখবে না। |
| 3 | **Output validation** | AI structured JSON ফেরত দেয় → server zod schema দিয়ে validate → তবেই use। AI output **কখনো `eval`/execute না**। |
| 4 | **Input limits** | message length cap, session turn cap, per-IP-hash + per-tenant rate limit। |
| 5 | **Prompt injection (multi-layer)** | regex শুধু একটা দুর্বল স্তর (সহজে bypass হয়)। আসল প্রতিরক্ষা: scoped system prompt + no-tools + output filter। শুধু regex-এর উপর ভরসা না। |
| 6 | **Cost / financial-DoS guard** | per-tenant hard monthly token cap → limit ছুঁলে hard stop + owner alert। platform-key model-এ এটাই আসল "hacker" risk। |
| 7 | **Content safety** | AI-generated content **সবসময় draft** — কখনো auto-publish না। Save-এর আগে policy/profanity filter। |
| 8 | **Key security** | AES-256-GCM encrypt, কখনো log না, কখনো client-এ পাঠানো না। |
| 9 | **Audit trail** | `AiAbuse` (flagged input, trimmed) + `AiUsage` (token/query count) track। |

**মূল নীতি:** AI একটা **পরামর্শদাতা**, **নির্বাহক না**। সে suggest করে, owner সিদ্ধান্ত নেয়, system execute করে। তাই AI hijack হলেও সর্বোচ্চ ক্ষতি = একটা বাজে text suggestion — কোনো data মুছবে না, ভুয়া booking হবে না, দাম নিজে বদলাবে না।

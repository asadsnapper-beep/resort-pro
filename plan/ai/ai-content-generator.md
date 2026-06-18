# AI Content Generator + Onboarding (Priority: High)

## Overview

দুটো কাজ একসাথে:
1. **Content Generator** — owner brief দেয়, AI room descriptions / emails / social posts / offer copy তৈরি করে।
2. **Onboarding Accelerator** (নতুন, সবচেয়ে গুরুত্বপূর্ণ) — নতুন owner শুধু *"আমার resort-টা describe করো"* লিখবে → AI খালি dashboard-টা ভরে দেবে: room গুলোর description, website hero/about text, menu item descriptions, theme suggestion। **এটাই empty-state problem মেরে দেয় এবং demo-তে sale close করায়।**

> **কেন High priority:** নতুন customer-এর সবচেয়ে বড় friction হলো খালি dashboard সাজানো। AI সেই ১ ঘণ্টার boring setup-কে ১ মিনিটে নামিয়ে আনে — এটাই acquisition lever।

---

## Goals

- নতুন tenant-এর onboarding setup সময় কমানো (ঘণ্টা → মিনিট)
- Owner-এর manual copywriting সময় বাঁচানো
- Brand tone অনুযায়ী consistent content
- Multi-language content generation (EN, BN, etc.)
- SEO-optimized room descriptions
- **AI generated সব content সরাসরি system-এর ভেতরে insert করা যাবে** (room, website, offer, email) — copy-paste না, এক click-এ apply

---

## 🔒 Security & Abuse Rules (এই feature-এ critical)

AI দিয়ে content generate হবে, কিন্তু hacker/abuse ঠেকাতে:

| নিয়ম | কীভাবে |
|------|--------|
| **Draft-first, no auto-publish** | AI content সবসময় draft হিসেবে আসে। Owner review + approve না করলে কোথাও live হয় না (website/email/offer)। |
| **Insert = validated write** | "Apply to room" করলে server zod schema validate করে তবেই `Room.description` update করে। AI সরাসরি DB-তে লেখে না। |
| **Tenant-scoped** | AI prompt-এ শুধু calling tenant-এর data (server-side inject)। অন্য resort-এর তথ্য কখনো না। |
| **Per-tenant token cap** | monthly cap → financial-DoS বন্ধ। limit ছুঁলে hard stop + alert। |
| **Content policy filter** | save-এর আগে profanity/policy filter — bot generated হোক বা manual edit। |
| **Role gate** | শুধু OWNER/MANAGER generate ও apply করতে পারবে (staff না)। |

README-র "AI Abuse Hardening" section এখানে পুরোপুরি প্রযোজ্য।

---

## Content Types

| Type | Description | Where Used |
|------|-------------|------------|
| Room Description | SEO-friendly room/suite descriptions | Booking page, OTA listings |
| Promotional Email | Flash sale, seasonal offer emails | Email campaigns |
| Social Media Post | Instagram/Facebook captions | Social management |
| Special Offer Copy | Limited time offer text | Website, WhatsApp |
| Welcome Message | Personalized guest arrival email | Guest email automation |
| Review Response | Professional reply to guest reviews | Review management |

---

## How It Works

```
Manager Input (brief)
├── Content type
├── Key details (offer, dates, price, room type)
├── Target audience
├── Tone (luxurious / friendly / formal)
└── Language

         ↓

Claude API (with hotel brand context)
         ↓

Generated Content (multiple variants)
         ↓

Manager Reviews + Edits
         ↓

One-click: Use in Email / Copy to clipboard / Save draft
```

---

## Database Schema

```prisma
model GeneratedContent {
  id          String   @id @default(uuid())
  tenantId    String
  contentType String   // "room_desc" | "promo_email" | "social_post" | "offer_copy" | "review_response" | "onboarding"
  prompt      String   // owner-এর brief
  content     String   // generated content (draft)
  language    String   @default("en")
  status      String   @default("draft")  // "draft" | "applied" | "discarded"
  appliedTo   String?  // "room:<id>" | "website" | "offer:<id>" — কোথায় insert হয়েছে
  tokensUsed  Int?
  createdById String
  createdAt   DateTime @default(now())

  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdBy User   @relation(fields: [createdById], references: [id])

  @@index([tenantId])
}
```

> Naming: `tenantId` (Hotel/hotelId নয়) — README alignment table দেখো।

---

## System Prompt Per Hotel

```
You are a professional copywriter for {hotelName}, a {hotelType} located in {location}.

Brand voice: {hotelBrandTone}  ← set by hotel owner (luxury/boutique/budget/family)
Target guests: {targetAudience}

When generating content:
- Match the hotel's brand voice consistently
- Highlight unique selling points: {usp}
- Always include a clear call-to-action when appropriate
- Keep SEO in mind for descriptions (include location, key amenities naturally)
- Do not make false claims or exaggerate
```

---

## Content Generation Prompts

### Room Description
```
Write an SEO-optimized room description for:
Room Type: {roomType}
Size: {sqm} sqm
View: {view}
Key amenities: {amenities}
Max occupancy: {maxGuests}
Target length: 150–200 words
Language: {language}

Include: room highlights, view description, key amenities, ideal for what type of guest.
```

### Promotional Email
```
Write a promotional email for:
Offer: {offerName}
Discount: {discount}% off / starting from {price}
Valid dates: {startDate} to {endDate}
Booking deadline: {deadline}
Target: {audience}

Format: Subject line + email body (150–250 words)
Tone: {hotelTone}
```

### Social Media Post
```
Write {n} social media captions for {platform} about:
Topic: {topic}
Key message: {message}
Include: relevant hashtags
Length: {platform-appropriate}
```

---

## API Endpoints

```
POST /api/ai/content/generate              — generate content (draft)
GET  /api/ai/content/history               — past generated content
POST /api/ai/content/:id/apply             — draft → system-এ insert (validated write)
DELETE /api/ai/content/:id                 — discard draft
POST /api/ai/content/room-descriptions     — bulk generate for all rooms

# Onboarding (নতুন)
POST /api/ai/onboarding/describe           — owner resort describe করে → AI পুরো setup draft বানায়
POST /api/ai/onboarding/apply              — owner যেগুলো রাখতে চায় সেগুলো এক click-এ system-এ insert
```

### `/apply` flow (in-system insert — হ্যাকার-নিরাপদ)
```
Owner click "Apply to Room X"
        ↓
Server: GeneratedContent fetch (tenant-scoped)
        ↓
zod validate (length, no script/HTML injection)
        ↓
content policy filter
        ↓
db.room.update({ where: { id }, data: { description } })  ← validated write
        ↓
GeneratedContent.status = "applied", appliedTo = "room:X"
```
AI কখনো নিজে `room.update` ডাকে না — owner-এর click + server validation ছাড়া কিছু insert হয় না।

---

## Frontend UI

### Content Generator Page
```
┌─────────────────────────────────────────────────────┐
│  ✍️ AI Content Generator                            │
├─────────────────────────────────────────────────────┤
│  Content Type: [Room Description ▼]                 │
│  Language:     [English ▼]                          │
│  Tone:         [Luxury ▼]                           │
├─────────────────────────────────────────────────────┤
│  Room Type: [Deluxe Ocean Suite ▼]                  │
│  Size: [85] sqm  | View: [Ocean view]               │
│  Key features: [Private balcony, Jacuzzi, ...]      │
├─────────────────────────────────────────────────────┤
│                    [✨ Generate]                     │
├─────────────────────────────────────────────────────┤
│  Generated Content:                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │ "Indulge in the ultimate oceanfront escape... │  │
│  │  ..."                                         │  │
│  └───────────────────────────────────────────────┘  │
│  [📋 Copy]  [✏️ Edit]  [🔄 Regenerate]  [✅ Save]  │
└─────────────────────────────────────────────────────┘
```

### Integration Points
- **Room Management**: "Generate Description" button per room type
- **Review Management**: "Draft Response" button per review
- **Email Campaigns**: AI content generator in email composer
- **Offers/Promotions**: "Generate Copy" when creating an offer

---

## 🚀 Onboarding Accelerator (এই feature-এর killer অংশ)

নতুন owner sign up করার পর খালি dashboard-এর বদলে একটা box:

```
┌──────────────────────────────────────────────────────────┐
│  ✨ আপনার resort সম্পর্কে কয়েক লাইন লিখুন,               │
│     বাকিটা AI সাজিয়ে দেবে                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "Cox's Bazar-এ beach-front resort, ১২টা room,      │  │
│  │  family-friendly, sea view, restaurant আছে"         │  │
│  └────────────────────────────────────────────────────┘  │
│                    [✨ Generate My Setup]                  │
└──────────────────────────────────────────────────────────┘
        ↓ AI draft বানায় (কিছুই auto-save হয় না)
┌──────────────────────────────────────────────────────────┐
│  Review করুন — যেগুলো রাখতে চান টিক দিন:                  │
│  ☑ ১২টা room + description                                │
│  ☑ Website hero: "Where the Bay Meets Bliss"             │
│  ☑ About text                                            │
│  ☑ Menu starter items (১০টা)                             │
│  ☑ Theme: Coastal Breeze                                 │
│              [Apply Selected]   [Edit]   [Skip]           │
└──────────────────────────────────────────────────────────┘
```

- AI structured JSON ফেরত দেয় → server validate → owner যেগুলো টিক দেয় শুধু সেগুলো insert
- **কিছুই auto-publish না** — owner-এর approval-এই সব
- এটা signup-এর Tier-1 friction (খালি dashboard) সরাসরি মেরে দেয় — আগের "launch-এ কী লাগবে" আলোচনার onboarding অংশের সমাধান

---

## Implementation Phases

### Phase 1 — Onboarding Accelerator (1 week) ← আগে এটা
- [ ] DB migration (`GeneratedContent`, `tenantId`)
- [ ] `POST /ai/onboarding/describe` + `/apply` (validated insert)
- [ ] Signup-পরবর্তী onboarding wizard UI
- [ ] Draft review + selective apply UI

### Phase 2 — Content Generator (1 week)
- [ ] Generic content generation API (draft-first)
- [ ] Generator UI page
- [ ] "Generate" button — room management, offers, email composer
- [ ] "Draft Response" — review management
- [ ] Content history + library, `/apply` to insert

### Phase 3 — Multi-language (future)
- [ ] Language selection UI
- [ ] Translate existing content
- [ ] OTA listing format export

---

## Files to Create/Modify

```
apps/api/src/routes/ai/content.ts              — endpoints
apps/api/src/services/ai/contentGenerator.ts   — Claude integration
apps/web/src/pages/marketing/content/          — generator UI
packages/database/prisma/schema.prisma         — model
```

---

## Cost Estimate

- Room description: ~300 tokens → ~$0.001 per room
- Promo email: ~500 tokens → ~$0.002 per email
- Very low cost — safe to use liberally

# Theme Studio + Custom Design Service — Plan

> দুইটা আলাদা কিন্তু সম্পর্কিত জিনিস:
> **Part A** — সত্যিকারের unique design upload করার সিস্টেম (বর্তমান ceiling ভাঙা)
> **Part B** — "custom design চাই" button → lead → income

---

## আসল সমস্যাটা কী (কোড যাচাই করা)

বর্তমান `ThemeConfig` সিস্টেম ([config-types.ts](../apps/web/src/components/themes/config-renderer/config-types.ts)) যা control করতে দেয়:

| যা বদলানো যায় | কতগুলো option |
|---|---|
| Hero layout | ৩টা (`fullscreen`/`split`/`minimal`) |
| About layout | ৩টা (`image-right`/`image-left`/`centered`) |
| Gallery layout | ২টা (`masonry`/`grid`) |
| Navbar style | ৩টা |
| CTA style | ৩টা |
| Colors / fonts | যেকোনো |
| customCSS | সীমিত (sanitized) |

**যা বদলানো যায় না — আর এটাই মূল সমস্যা:** প্রতিটা section-এর আসল **markup/DOM structure** hardcoded আছে ৯টা React component-এ ([config-renderer/sections/](../apps/web/src/components/themes/config-renderer/sections/), মোট ৯৪৮ লাইন) — `ConfigHero`, `ConfigAbout`, `ConfigRooms`, `ConfigGallery`, `ConfigTestimonials`, `ConfigAvailability`, `ConfigBooking`, `ConfigContact`, `ConfigFooter`।

তাই যত theme-ই upload বা AI দিয়ে বানানো হোক — **সবগুলোর হাড়গোড় একই**, শুধু রং আর ফন্ট আলাদা। ১৬২টা combination সম্ভব, কিন্তু কোনোটাই "unique design" না। Awwwards-মানের design এভাবে কখনোই আসবে না।

---

# Part A — Theme Studio: ৩ Tier সিস্টেম

বর্তমান একটা রাস্তার বদলে তিনটা tier, প্রতিটার আলাদা কাজ:

| Tier | কী | Upload/Deploy | Design freedom | কার জন্য |
|---|---|---|---|---|
| **1. Config theme** | বর্তমান JSON সিস্টেম | Upload ✅ | সীমিত (রং/variant) | দ্রুত variant, AI-generated |
| **2. Template theme** 🆕 | HTML + CSS template | Upload ✅ | **প্রায় সম্পূর্ণ** | **মূল সমাধান** |
| **3. Code theme** | React component | Deploy লাগে | সম্পূর্ণ | Premium/complex, animation-heavy |

Tier 1 ও 3 আগে থেকেই আছে, শুধু থাকবে। **নতুন কাজ = Tier 2।**

## Tier 2 — Template Theme কীভাবে কাজ করবে

**মূল ধারণা:** designer (বা Claude) একটা সম্পূর্ণ standalone HTML + CSS লিখবে, যেখানে data-র জায়গায় placeholder token থাকবে, আর interactive অংশগুলোর জায়গায় "mount point" থাকবে।

```html
<!-- theme.html — designer/Claude যা লিখবে -->
<section class="hero">
  <h1>{{website.heroTitle}}</h1>
  <p>{{website.heroSubtitle}}</p>
  <a href="#booking" class="cta">{{website.heroCtaLabel}}</a>
</section>

<section id="rooms" class="rooms-masonry">
  {{#each rooms}}
    <article class="room-card">
      <img src="{{this.image}}" alt="{{this.name}}">
      <h3>{{this.name}}</h3>
      <span class="price">{{../tenant.currency}} {{this.basePrice}}</span>
    </article>
  {{/each}}
</section>

<!-- Interactive অংশ — React widget এখানে বসবে -->
<section id="booking">
  <div data-rp-widget="booking"></div>
</section>
```

**Render pipeline:**

```
Theme.templateHtml (DB)
        ↓
Handlebars compile  ←  tenant + website + rooms data (GET /site/:slug থেকে)
        ↓
Sanitize (script/on*/javascript: strip)
        ↓
Server-side render (RSC — SEO ঠিক থাকে)
        ↓
Client hydration: [data-rp-widget] খুঁজে বের করে React widget portal করে বসায়
```

### Widget mount points (interactive islands)

Design সম্পূর্ণ free রাখা যাবে, কিন্তু dynamic কাজগুলো আমাদের existing React component-ই করবে — তাই booking logic, payment, availability সব একই থাকবে, শুধু চেহারা আলাদা:

| Mount point | কোন component | আগে থেকে আছে? |
|---|---|---|
| `data-rp-widget="booking"` | BookingSection | ✅ |
| `data-rp-widget="availability"` | AvailabilitySection | ✅ |
| `data-rp-widget="menu"` | MenuWidget | ✅ |
| `data-rp-widget="venues"` | VenuesWidget | ✅ (আজকে বানানো) |
| `data-rp-widget="vehicles"` | VehiclesWidget | ✅ (আজকে বানানো) |
| `data-rp-widget="offers"` | OffersSection | ✅ |
| `data-rp-widget="gallery"` | GallerySection (lightbox) | ✅ |
| `data-rp-widget="contact"` | ContactSection (form) | ✅ |

সব widget আগে থেকেই self-fetching ([_widgets/](../apps/web/src/components/themes/_widgets/)) — শুধু `slug` + রং + currency লাগে। তাই এই কাজটা মূলত plumbing, নতুন logic না।

### Section id contract

Owner-এর show/hide + drag-reorder ([SITE_SECTIONS](../apps/web/src/app/(dashboard)/dashboard/website/page.tsx)) কাজ করতে হবে বলে template-এ প্রতিটা section-এ known `id` থাকা **বাধ্যতামূলক** (`hero`, `about`, `rooms`, `menu`, `venues`, `vehicles`, `gallery`, `testimonials`, `availability`, `offers`, `booking`, `contact`)। Renderer সেই id ধরে hidden section গুলো DOM থেকে বাদ দেবে ও order বদলাবে।

### Security — কেন "আমি নিজে review করব" যথেষ্ট না

Superadmin-only upload + review **অনেকটাই** ঝুঁকি কমায় (malicious designer-এর হুমকি প্রায় শেষ)। কিন্তু একটা architectural সমস্যা আছে যেটা review-এর গুণমানের উপর নির্ভর করে না:

**যাচাই করা তথ্য (curl দিয়ে confirmed):**

```
https://resortpro.site/auth/login  → 200
https://resortpro.site/dashboard   → 200
https://resortpro.site/demo        → 200   ← tenant-এর public site
```

তিনটাই **একই origin**। আর auth token localStorage-এ থাকে ([lib/api.ts:13](../apps/web/src/lib/api.ts), key `resort-pro-auth`; superadmin-এর `admin_token`)।

**মানে:** template theme-এ arbitrary JS চললে, `/demo` পেজের সেই JS এক লাইনে owner বা superadmin-এর JWT পড়ে নিতে পারবে —

```js
localStorage.getItem('resort-pro-auth')   // same origin, কোনো বাধা নেই
```

এটা hypothetical না, সবচেয়ে সহজ attack। **আজ exploitable না** (কারণ এখন কোনো JS allow করা হয় না), কিন্তু Tier 2-তে JS allow করলেই হয়ে যাবে।

**origin-নির্ভর নয় এমন দ্বিতীয় ঝুঁকি:** public site-এ booking form আছে যেখানে guest নাম/ইমেইল/ফোন লেখে। পেজে চলা যেকোনো JS ওই field পড়তে পারে — custom domain হলেও। মানে guest PII ঝুঁকিতে।

**Review কী ধরতে পারে, কী পারে না:**

| ধরা যায় ✅ | ধরা কঠিন ❌ |
|---|---|
| `<script>` tag, `on*=` handler | Minified/bundled library-র ভেতরের কোড |
| স্পষ্ট external URL | "analytics" নামে ছদ্মবেশী exfiltration |
| CSS (পুরোটাই পড়া সম্ভব) | CodePen থেকে copy করা snippet-এর ভেতরের tracking pixel |

মূল কথা: designer-কে অবিশ্বাস করার প্রশ্ন না — **CSS-only রাখলে এই পুরো সমস্যার শ্রেণীটাই অসম্ভব হয়ে যায়, তখন review-এর গুণমান আর গুরুত্বপূর্ণই থাকে না।**

### তাই যা করা হবে

- Template **শুধু superadmin upload করবে** — tenant না
- Ingest-এ sanitize: `<script>`, `on*=`, `javascript:` strip
- Handlebars logic-less — SSTI ঝুঁকি নেই
- Tenant data `{{ }}` দিয়ে auto-escaped
- **Automated validator + review দুইটাই** (নিচে)

### Animation দরকার হলে — ৩টা নিরাপদ রাস্তা

CSS-only মানে দুর্বল design না। ২০২৬-এর CSS-এ scroll-driven animation, view transitions, `@keyframes`, container query, `:has()`, sticky parallax — Awwwards-মানের বেশিরভাগ design CSS দিয়েই সম্ভব। তবু JS লাগলে:

| রাস্তা | কীভাবে | ঝুঁকি |
|---|---|---|
| **A. Allowlisted library** ⭐ | GSAP/AOS/Lenis আমরা নিজে bundle করে রাখব, template শুধু `data-rp-anim="fade-up"` দিয়ে opt-in করবে | নেই — arbitrary code নেই |
| **B. Sandboxed iframe** | শুধু decorative অংশ (hero canvas ইত্যাদি) `sandbox` iframe-এ — parent origin/localStorage-এ access নেই | খুব কম |
| **C. Tier 3 code theme** | সত্যিকারের custom JS — git-এ PR + review + deploy | নিয়ন্ত্রিত |

### Upload validator (automated, review-এর আগে)

`plan/theme-contract.md`-এর সাথে একটা validator script — প্রতিটা upload-এ চলবে:

```
✗ <script> tag
✗ on* attribute (onclick, onload…)
✗ javascript: / data:text/html URL
✗ fetch( / XMLHttpRequest / eval( / new Function(
✗ external host (allowlist ছাড়া) — CSS @import, url(), <img src>, <link>
✓ প্রতিটা section-এ known id আছে
✓ mobile responsive (viewport unit / media query আছে)
```

Automated চেকটাই যান্ত্রিক জিনিসগুলো নির্ভরযোগ্যভাবে ধরবে; তারপর তুমি/আমি design ও logic পড়ব।

### Schema পরিবর্তন

```prisma
enum ThemeType {
  HARDCODED
  UPLOADED       // Tier 1 — config JSON
  AI_GENERATED   // Tier 1 — config JSON
  TEMPLATE       // 🆕 Tier 2 — HTML + CSS
}

model Theme {
  // ... existing fields
  templateHtml        String?   // 🆕 Handlebars template
  templateCss         String?   // 🆕 theme CSS
  contractVersion     String?   // 🆕 কোন spec version মেনে বানানো
  exclusiveToTenantId String?   // 🆕 শুধু এই tenant দেখবে (bespoke theme)
}
```

**`exclusiveToTenantId` কেন জরুরি:** এখন `Theme` টেবিলে কোনো tenant scoping নেই — মানে কোনো theme upload করলেই **সব tenant** সেটা পেয়ে যায়। কেউ টাকা দিয়ে custom design করালে সেটা যেন প্রতিযোগীরা free-তে না পায় — এটা Part B-র business model-এর জন্য অপরিহার্য।

### নতুন/পরিবর্তিত ফাইল

| ফাইল | কাজ |
|---|---|
| `apps/web/src/components/themes/template-renderer/index.tsx` | 🆕 Template theme renderer + widget hydration |
| `apps/web/src/components/themes/template-renderer/compile.ts` | 🆕 Handlebars compile + sanitize |
| `apps/web/src/components/themes/template-renderer/widget-map.ts` | 🆕 mount point → component map |
| `apps/web/src/app/(public)/[slug]/page.tsx` | `themeType === TEMPLATE` হলে নতুন renderer |
| `apps/api/src/routes/admin.ts` | `POST /themes/upload` — `.html`/`.zip` support, validator |
| `apps/api/src/routes/website.ts` | `GET /site/:slug` — `templateHtml`/`templateCss` return |
| `apps/web/src/app/theme-preview/[key]/page.tsx` | Template theme preview support |
| `plan/theme-contract.md` | 🆕 **Claude/designer-এর জন্য spec** (নিচে) |

## Theme Contract doc (Claude/designer কী পড়ে design বানাবে)

আলাদা একটা doc — `plan/theme-contract.md` — যেটা যেকোনো designer বা Claude-কে দিলেই সে সঠিক format-এ theme বানাতে পারবে। এতে থাকবে:

1. **Available data tokens** — `tenant.*`, `website.*`, `rooms[]` — প্রতিটার exact নাম ও type
2. **Loop/conditional syntax** — `{{#each rooms}}`, `{{#if website.aboutTitle}}`
3. **Widget mount point list** — উপরের টেবিল
4. **Required section ids** — show/hide/reorder কাজ করার জন্য
5. **CSS rules** — scoping, external request নিষিদ্ধ, responsive বাধ্যতামূলক
6. **নিষিদ্ধ** — `<script>`, inline handler, external JS/font CDN
7. **Starter template** — copy করে শুরু করার জন্য একটা complete working example
8. **Validation checklist** — upload করার আগে নিজে চেক করার লিস্ট

এই doc-টাই মূল unlock: এরপর `/theme` skill (আগে থেকেই আছে) update করে দিলে Claude সরাসরি upload-ready template বানাতে পারবে।

---

# Part B — Custom Design Service (Income)

## Flow

```
Owner: Dashboard → Website → "Need a custom design?" button
   ↓
Modal form (business info, budget, reference sites, deadline, description)
   ↓
DesignRequest তৈরি → admin-কে email + in-app notification
   ↓
Admin: /admin/design-requests → pipeline manage করে quote পাঠায়
   ↓
Owner accept করলে → invoice (existing invoice/payment system reuse)
   ↓
Design বানানো হয় (Claude/designer) → Tier 2 template upload
   ↓
exclusiveToTenantId সেট করে দেওয়া → শুধু সেই tenant পাবে
   ↓
Status: DELIVERED
```

## Schema

```prisma
enum DesignRequestStatus {
  NEW
  CONTACTED
  QUOTED
  ACCEPTED
  IN_PROGRESS
  DELIVERED
  CANCELLED
}

model DesignRequest {
  id            String   @id @default(uuid())
  tenantId      String                    // tenantPrisma-র জন্য বাধ্যতামূলক
  contactName   String
  contactPhone  String
  contactEmail  String
  budgetRange   String?                   // "৳20k–50k" ইত্যাদি
  timeline      String?                   // "2 weeks", "no rush"
  description   String                    // কী চায়
  referenceUrls String[] @default([])     // পছন্দের সাইট
  status        DesignRequestStatus @default(NEW)
  quotedAmount  Float?
  currency      String?
  quotedAt      DateTime?
  adminNotes    String?
  deliveredThemeKey String?               // যে theme বানানো হলো
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([status])
  @@map("design_requests")
}
```

⚠️ `tenantId` অবশ্যই থাকবে — নাহলে `tenantPrisma` middleware-এ সমস্যা হবে ([lessons learned](./README.md))। Admin-এর cross-tenant view-এ bare `prisma` ব্যবহার হবে (established pattern)।

## Pricing tier (modal-এ দেখানো হবে, expectation set করতে)

| Tier | কী পাবে | দাম (প্রস্তাবিত) |
|---|---|---|
| **Branding polish** | Existing theme + তাদের রং/লোগো/ফন্ট/কপি tune করা | ৳১০,০০০ |
| **Custom design** | সম্পূর্ণ unique Tier 2 template theme, তাদের জন্যই | ৳৪০,০০০ |
| **Premium** | Tier 3 code theme — custom animation, unique interaction | ৳৮০,০০০+ |

দাম নির্ধারিত (২০২৬-০৭-২৫)। Modal-এ "starting from" হিসেবে দেখানো হবে, fixed quote না — আসল quote admin দেবে।

## নতুন/পরিবর্তিত ফাইল

| ফাইল | কাজ |
|---|---|
| `packages/database/prisma/schema.prisma` | `DesignRequest` model + enum + migration |
| `apps/api/src/routes/designRequests.ts` | 🆕 Owner: create/list নিজের request |
| `apps/api/src/routes/admin.ts` | Admin: list/update/quote (cross-tenant) |
| `apps/web/src/app/(dashboard)/dashboard/website/page.tsx` | "Need a custom design?" button + modal (ModalShell) |
| `apps/web/src/app/admin/(panel)/design-requests/page.tsx` | 🆕 Admin pipeline UI |
| `apps/web/src/components/dashboard/sidebar.tsx` | (দরকার হলে) nav entry |
| `apps/api/src/utils/` | Email notification (existing Resend reuse) |

---

# Phase ভাগ (implementation order)

| Phase | কী | কেন এই order | আকার |
|---|---|---|---|
| **1** | `DesignRequest` + owner button/modal + admin pipeline + notification | **Income path আগে চালু হোক** — ছোট, স্বাধীন, ঝুঁকি কম। আজ থেকেই lead আসতে পারবে | ছোট-মাঝারি |
| **2** | `Theme.exclusiveToTenantId` + theme picker-এ filter | Phase 1-এর বিক্রি করা design রক্ষা করতে দরকার। খুব ছোট কাজ | ছোট |
| **3** | `plan/theme-contract.md` লেখা + একটা starter template | Engine বানানোর আগে contract ঠিক করা — নাহলে দুইবার কাজ হবে | মাঝারি |
| **4** | Template theme engine (compile + sanitize + widget hydration + upload + preview) | মূল কাজ। Contract fix হওয়ার পরেই | **বড়** |
| **5** | `/theme` skill update — Claude যেন সরাসরি Tier 2 template বানায় | Engine live হওয়ার পর | ছোট |
| **6** | (Optional) Config theme-এ block/variant বাড়ানো | Tier 1-ও একটু ভালো হোক, কিন্তু জরুরি না | মাঝারি |

**সুপারিশ:** Phase 1 + 2 একসাথে করা (দুইটাই ছোট, একসাথে income path সম্পূর্ণ হয়), তারপর 3, তারপর 4।

---

# ঝুঁকি ও সিদ্ধান্ত দরকার

| বিষয় | নোট |
|---|---|
| **Animation/JS-heavy design** | Tier 2-তে CSS animation + allowlisted library (রাস্তা A) — arbitrary JS না। কারণ উপরের same-origin/localStorage সমস্যা |
| **🔴 আলাদা hardening (এই plan-এর বাইরে, কিন্তু জরুরি)** | Auth token localStorage-এ, আর `/auth/login` + `/dashboard` + `/[slug]` একই origin-এ। মানে ওই origin-এ **যেকোনো** XSS = account takeover — Tier 2 না করলেও এটা একটা latent ঝুঁকি। সঠিক সমাধান: token httpOnly cookie-তে সরানো, এবং/অথবা tenant-এর public site আলাদা origin-এ সার্ভ করা। আলাদা task হিসেবে করা উচিত |
| **Template সাইজ** | HTML+CSS DB-তে text হিসেবে থাকবে (~৫০–২০০KB সাধারণত)। Upload cap এখন 512KB, Tier 2-র জন্য 1MB করা যেতে পারে |
| **Handlebars dependency** | নতুন npm package লাগবে (`handlebars`) — mature, নিরাপদ, কোনো eval নেই |
| **Existing theme গুলো** | কিছুই ভাঙবে না — ৪টা hardcoded + config theme সব আগের মতোই চলবে। Tier 2 সম্পূর্ণ additive |
| **দাম নির্ধারণ** | তোমার সিদ্ধান্ত — plan-এ শুধু placeholder |

---

## Status

✅ **Phase 1–4 বানানো হয়ে গেছে ও live।** (শেষ verify: ২০২৬-০৮-১৩, কোড থেকে সরাসরি)

| Phase | কী | অবস্থা |
|---|---|---|
| 1+2 | `DesignRequest` + owner modal + admin pipeline + `Theme.exclusiveToTenantId` | ✅ Done |
| 3 | `plan/theme-contract.md` | ✅ Done |
| 4 | Tier 2 engine — upload → Handlebars compile → sanitize → widget hydration | ✅ Done, `/demo` public site-এ end-to-end verify করা |
| 5 | `/theme` skill → Tier 2 HTML বানাবে | ❌ বাকি (skill এখনো পুরনো Tier 1 JSON বানায়) |
| 6 | Config theme-এ আরও block/variant | ❌ বাকি (optional) |

---

# ২০২৬-০৮-১৩ — Tenant customization + theme বিক্রি (নতুন ধাপ)

## লক্ষ্য (owner-এর ভাষায়)

> সুপার অ্যাডমিন থেকে **সপ্তাহে ১টা** HTML template upload হবে। কোনটা free / কোনটা কেনা লাগবে / কোনটা offer-এ — সেটা অ্যাডমিন ঠিক করবে। Resort owner সেই template customize করবে: logo, লেখা, ছবি, section-এর background (রঙ/ছবি/ভিডিও), gallery, video section। আর dashboard-এর যেসব data গেস্টের দেখা দরকার — room, খাবার, conference room, bike — সেগুলো site-এ দেখাবে।

## যা ইতিমধ্যেই কাজ করে (নতুন কিছু লাগবে না)

| চাহিদা | কীভাবে |
|---|---|
| Logo | `{{tenant.logoUrl}}` |
| লেখা | `{{website.heroTitle}}`, `heroSubtitle`, `aboutTitle`, `aboutText` |
| ছবি | `{{website.heroImage}}`, `aboutImage` |
| Gallery | `{{website.galleryImages}}` (array) |
| Room | `{{#each rooms}}` — নাম, দাম, ছবি, amenities, videos |
| খাবার | `data-rp-widget="menu"` |
| Conference room | `data-rp-widget="venues"` |
| Bike / গাড়ি | `data-rp-widget="vehicles"` |
| Section on/off + order | `WebsiteContent.hiddenSections`, `sectionOrder` |
| free/premium চিহ্ন | `Theme.isPremium`, `Theme.requiredPlan` (schema-তে আছে) |

## যা নেই

1. **Section-ভিত্তিক background** (রঙ/ছবি/ভিডিও) — এখন শুধু global `primaryColor`/`accentColor`
2. **Video section** — room-এ `videos[]` আছে, আলাদা video section নেই
3. **Theme বিক্রির ব্যবস্থা** — দাম, কেনার record, offer, ownership check
4. **🔴 Premium enforce হয় না** — `website.ts:78`-এ শুধু bespoke-lock চেক হয়, `requiredPlan` চেক হয় **না**। আজ Solo tenant যেকোনো premium theme নিয়ে নিতে পারে।

## সিদ্ধান্ত ১ — Section vocabulary: **Fixed list** (manifest নয়)

Template-এর section id গুলো contract-এ fixed থাকবে (`SITE_SECTIONS`-এর ১১টা: about, amenities, rooms, menu, venues, vehicles, gallery, testimonials, availability, booking, contact)। Shopify-র মতো per-template JSON manifest **করা হবে না**।

**কারণ:** সপ্তাহে ১টা template = বছরে ~৫০টা।
- Fixed list → customization UI **১ বার** বানালেই template #1 আর #50 দুটোতেই চলে। প্রতি সপ্তাহে বাড়তি কাজ **শূন্য**।
- Manifest → প্রতিটা template-এর সাথে manifest লিখতে + validate করতে হবে। **প্রতি সপ্তাহের একটা কর।**

Designer-এর স্বাধীনতা কমে না — fixed শুধু *কোন ধরনের content আছে*, কিন্তু *দেখতে কেমন* (layout, grid, animation, রঙ, typography, order) সম্পূর্ণ মুক্ত। একটা resort site-এ content type ওই ১১টাই।

পরে দরকার হলে manifest **optional** হিসেবে যোগ করা যাবে (manifest না থাকলে fixed list) — তাই এটা dead-end নয়।

## সিদ্ধান্ত ২ — Monetization: **এককালীন কেনা** (one-time purchase)

Subscription plan-এর সাথে বাঁধা নয় — theme আলাদা করে কিনতে হবে।

আগে ভেবেছিলাম এটা "কয়েক সপ্তাহের নতুন subsystem" — **সেটা ভুল ছিল**, কারণ:
- bKash/SSLCommerz/Stripe payment rails **আগে থেকেই আছে** (`billing.ts`-এর subscription checkout)
- Ownership enforce করার **জায়গাটাও আছে** — `website.ts:78`, যেখানে bespoke-lock চেক হয়; ওখানেই "কেনা আছে কিনা" বসবে

তাই এটা ৩-৪টা focused step।

## দুটো design সতর্কতা (ভুলবেন না)

1. **White-on-white** — tenant ইচ্ছেমতো bg রঙ দিলে designer-এর সাদা লেখা অদৃশ্য হয়ে যাবে। সমাধান: auto-contrast — bg-এর brightness হিসাব করে লেখার রঙ নিজে থেকে উল্টানো (~২০ লাইন)। এটা প্রতিটা theme system-এর #১ support ticket।
2. **Video background** — auto-play ৫-১৫MB, বাংলাদেশে mobile data-তে site ভাঙা মনে হবে + Core Web Vitals/SEO-তে মার। তাই: video **section** = YouTube/Vimeo embed (storage খরচ শূন্য, quality auto)। Video **background** চাইলে দেওয়া যাবে কিন্তু poster ছবি বাধ্যতামূলক + muted + playsinline + size cap।

## ঝুঁকি — ৫০টা theme = চিরকালের maintenance

বিক্রি একবারের, দায়িত্ব চিরকালের। **সমাধান schema-তে আগে থেকেই আছে:** `Theme.contractVersion` — পুরনো theme পুরনো contract-এ চলবে, নতুন contract আসলেও ভাঙবে না। শুধু এটা ব্যবহার করা শুরু করতে হবে।

## ধাপ (প্রতিটা আলাদাভাবে shippable)

| # | কাজ | আকার | কেন এই order |
|---|---|---|---|
| ১ | ✅ **শেষ** — Theme-এর দাম + `ThemePurchase` + ownership enforce + offer + bKash checkout + admin grant + owner picker UI | ছোট-মাঝারি | আয়ের তালা খোলে — এরপর প্রতি সপ্তাহের কাজ বিক্রিযোগ্য |
| ৪ | ✅ **শেষ** — `/theme` skill → Tier 2 HTML | ছোট | সাপ্তাহিক template বানানো দ্রুত হবে |
| ২ | Section-ভিত্তিক bg (রঙ/ছবি) + auto-contrast — `WebsiteContent.sectionStyles Json` | ছোট | Tenant-এর আসল value, চোখে দেখা যায় |
| ৩ | Video section widget (YouTube/Vimeo embed) | ছোট | |
| ৫ | Live preview (customize করার সময় সাথে সাথে দেখা) | বড় | সবচেয়ে বড়, সবার শেষে |

**ধাপ ৪ কেন ২-এর আগে করা হলো:** owner সপ্তাহে ১টা template বানাবেন, অথচ
`/theme` skill তখনো পুরনো Tier 1 JSON বানাত — মানে সাপ্তাহিক কাজটাই আটকে ছিল।
ধাপ ২/৩ একবারের ফিচার, ধাপ ৪ প্রতি সপ্তাহে সময় বাঁচায়। তাছাড়া template না
থাকলে customize করার মতো কিছুই থাকে না।

**ধাপ ৪-এ যা হলো (২০২৬-০৮-১৩):** `.claude/commands/theme.md` এখন contract-মাফিক
এক-ফাইল `.html` বানায় — data token, required section id (`rooms`/`booking`),
`data-rp-widget` mount point, নিষিদ্ধ তালিকা (JS নেই, motion শুধু CSS), আর
filename→key নিয়ম সব skill-এ লেখা। ডিজাইন-মানের অংশ (৯টা প্রশ্ন, color theory,
typography, CSS signature) অপরিবর্তিত। নতুন `themes-out/` ফোল্ডার — generated
theme git-এ রাখা হয়, কারণ ওগুলোই বিক্রির পণ্য; DB-র কপি deployed state, backup নয়।
আসল uploader দিয়ে যাচাই করা: নিয়ম-মানা template 201 (key/CSS extraction/দাম ঠিক),
`<script>` ও required-id ছাড়া template 400।

## সিদ্ধান্ত ৩ — দাম: **$30 (৳3000)**, তবে সবসময় বদলানো যাবে

Owner-এর শর্ত: *"এখন $30, কিন্তু চাইলে যাতে আমি পরিবর্তন করতে পারি এই ব্যবস্থা রাইখো।"* তাই দাম **কোডে বসবে না**।

### কোথায় থাকবে

দাম প্রতিটা theme-এর **DB row-তে** থাকবে, `packages/types/src/plans.ts`-এ নয়।

**কেন plans.ts-এ নয়:** plan মাত্র ৩টা, বছরে একবার বদলায় — তাই কোডে থাকা ঠিক আছে। কিন্তু theme **সপ্তাহে ১টা করে বাড়বে (বছরে ~৫০টা)**, প্রতিটার দাম আলাদা হতে পারে। ৫০টা দাম কোডে রাখলে প্রতিবার দাম বদলাতে deploy লাগবে — যা owner-এর শর্তের সরাসরি বিপরীত।

```prisma
// Theme model-এ যোগ হবে
priceUsd      Decimal   @default(30)   @db.Decimal(10, 2)
priceBdt      Decimal   @default(3000) @db.Decimal(10, 2)
offerPriceUsd Decimal?  @db.Decimal(10, 2)   // null = কোনো offer নেই
offerPriceBdt Decimal?  @db.Decimal(10, 2)
offerEndsAt   DateTime?                       // null = অনির্দিষ্টকাল
```

- **Free theme** = `priceUsd 0` (অথবা `isPremium false`)
- **Offer** = `offerPrice*` সেট করা থাকলে সেটাই কার্যকর, `offerEndsAt` পার হলে আবার আসল দাম
- নতুন theme upload করলে default $30/৳3000 বসবে, কিন্তু admin UI থেকে প্রতিটা theme-এর দাম আলাদা করে বদলানো যাবে

### দাম কেন USD আর BDT **দুটোই** আলাদা করে রাখব

এটা এই project-এর নিজের প্রতিষ্ঠিত নিয়ম — `PLAN_PRICING`-এ `monthlyUsd: 10` আর `monthlyBdt: 1000` দুটোই আলাদা করে লেখা, live exchange rate ব্যবহার হয় না। ধরা হার **৳১০০ = $১**।

**কেন live FX নয়:** (ক) ডলারের হার ওঠানামা করলে বাংলাদেশি owner-এর দেখা দাম হঠাৎ বদলে যাবে — বিশ্বাস নষ্ট হয়; (খ) ৳3000-এর মতো গোল সংখ্যা রাখা যায়, ৳3247 নয়; (গ) টাকা ঠিক থাকে, FX API-এর উপর নির্ভরতা থাকে না।

### deploy ছাড়াই বদলানোর ব্যবস্থা

`billing.ts:64`-এর প্রমাণিত pattern অনুসরণ করা হবে — নতুন theme upload-এর **default** দামটা env দিয়ে override করা যাবে:

```ts
// env না থাকলে canonical default, কোনো স্বাধীন সংখ্যা নয়
const DEFAULT_THEME_PRICE_USD = Number(process.env.THEME_DEFAULT_PRICE_USD) || 30;
```

অর্থাৎ দাম বদলানোর **তিনটা** রাস্তা থাকবে: (১) admin UI থেকে প্রতিটা theme আলাদা করে, (২) env দিয়ে নতুন theme-এর default, (৩) offer দিয়ে সাময়িক ছাড়।

### টাকার Prisma type

`Decimal @db.Decimal(10, 2)` — `Float` নয়। Schema-তে দুটোই আছে (পুরনো কিছু field `Float`), কিন্তু নতুন/গুরুত্বপূর্ণ সবগুলো (`basePrice`, `totalAmount`, `paidAmount`, `Payment.amount`) Decimal ব্যবহার করে। টাকার হিসাবে Float কখনো নয় — rounding error হয়।

## সিদ্ধান্ত ৪ — মালিকানার নিয়ম (owner ২০২৬-০৮-১৩-এ নিশ্চিত করেছেন)

- **এককালীন, per-resort, চিরস্থায়ী** — একবার $30 দিলে ওই resort ওই theme চিরকাল ব্যবহার করবে। কোনো নবায়ন নেই।
- **Subscription শেষ হলেও কেনা theme থেকে যাবে** — তারা কিনেছে, কেড়ে নেওয়া হবে না। (subscription বন্ধ থাকলে সাইট এমনিতেই বন্ধ, তাই বাস্তবে প্রশ্নটা কম ওঠে — কিন্তু ফিরে এলে theme-টা ওখানেই পাবে।)

**কোডে এর মানে:** `ThemePurchase` row একবার তৈরি হলে কখনো মুছবে না, কোনো expiry থাকবে না। Ownership check = "এই tenant-এর জন্য এই theme-এর একটা purchase row আছে কি?" — তারিখ বা plan দেখা হবে না।

## ⚠️ Enforcement চালু করার আগে — পুরনো ব্যবহারকারীদের রক্ষা করতে হবে

আজ কোনো enforcement নেই, তাই কেউ যদি ইতিমধ্যেই একটা premium theme ব্যবহার করে থাকে, হঠাৎ তালা লাগালে **তার live সাইট ভেঙে যাবে**।

**তাই migration-এ grandfather করতে হবে:** enforcement চালু হওয়ার মুহূর্তে যে tenant যে premium theme ব্যবহার করছে, তাকে ওই theme-এর একটা **বিনামূল্যের `ThemePurchase` row** দিয়ে দিতে হবে (`amountPaid = 0`, `note = 'grandfathered'`)। আগে থেকে ব্যবহার করা জিনিস কেড়ে নেওয়া যায় না।

*(এখনকার অবস্থা: `seed-themes.ts`-এর সব theme `isPremium: false` — তাই সম্ভবত কেউ ক্ষতিগ্রস্ত হবে না। তবু migration-এ grandfather রাখতে হবে, কারণ admin UI থেকে কেউ কোনো theme premium করে থাকতে পারে।)*

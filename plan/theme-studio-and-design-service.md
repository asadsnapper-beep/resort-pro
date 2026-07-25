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
| **Branding polish** | Existing theme + তাদের রং/লোগো/ফন্ট/কপি tune করা | ৳৮,০০০ |
| **Custom design** | সম্পূর্ণ unique Tier 2 template theme, তাদের জন্যই | ৳৩৫,০০০ |
| **Premium** | Tier 3 code theme — custom animation, unique interaction | ৳৮০,০০০+ |

দাম তোমার সিদ্ধান্ত — এগুলো শুধু placeholder। Modal-এ "starting from" হিসেবে দেখানো ভালো, fixed না।

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

📋 **Plan only — কোনো code লেখা হয়নি।** অনুমোদনের অপেক্ষায়।

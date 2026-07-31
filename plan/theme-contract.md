# Theme Contract — Tier 2 (Template Theme) Spec

> এই doc-টা designer বা Claude-কে দেওয়ার জন্য — এটা পড়ে যে কেউ (বা যেকোনো AI) সরাসরি upload-ready একটা Tier 2 template theme বানাতে পারবে। [plan/theme-studio-and-design-service.md](./theme-studio-and-design-service.md)-এর Phase 3 deliverable এটা।
>
> **এই doc লেখার সময় কোনো renderer engine এখনো বানানো হয়নি** (সেটা Phase 4) — এটা শুধু spec। কিন্তু এখানে যা লেখা আছে, সব সত্যিকারের কোড থেকে verify করে লেখা (`apps/api/src/routes/website.ts`, `apps/web/src/components/themes/types.ts`, `apps/web/src/components/themes/_widgets/`) — অনুমান করে কিছু নেই।

---

## ১. একটা Template Theme আসলে কী

একটা সাধারণ `.html` ফাইল (+ ভিতরে বা আলাদা `<style>`/`.css`) — নিচের দুটো নিয়ম ছাড়া **সম্পূর্ণ মুক্ত**:

1. Data যেখানে বসবে, সেখানে `{{token}}` বসবে (Handlebars syntax)
2. Interactive অংশ (booking, availability ইত্যাদি) যেখানে বসবে, সেখানে `data-rp-widget="..."` mount point বসবে

বাকি সব — layout, grid, animation (CSS), color, spacing, typography — designer-এর সম্পূর্ণ স্বাধীনতা।

---

## ২. Available Data Tokens

Public site render হওয়ার সময় `GET /site/:slug` থেকে যা পাওয়া যায় ([website.ts:220](../apps/api/src/routes/website.ts), registered at `/site` prefix — [app.ts:265](../apps/api/src/app.ts)), ঠিক সেই shape-ই template-এ পাওয়া যাবে। তিনটা root object: `tenant`, `website`, `rooms`।

### `tenant.*`

| Token | Type | সবসময় থাকে? |
|---|---|---|
| `{{tenant.name}}` | string | ✅ |
| `{{tenant.slug}}` | string | ✅ |
| `{{tenant.phone}}` | string | ❌ optional |
| `{{tenant.email}}` | string | ❌ optional |
| `{{tenant.address}}` | string | ❌ optional |
| `{{tenant.currency}}` | string (e.g. `"BDT"`) | ✅ |
| `{{tenant.checkInTime}}` | string (`"14:00"`) | ✅ |
| `{{tenant.checkOutTime}}` | string (`"11:00"`) | ✅ |
| `{{tenant.logoUrl}}` | string (URL) | ❌ optional |

### `website.*`

| Token | Type | সবসময় থাকে? |
|---|---|---|
| `{{website.heroTitle}}` | string | ✅ |
| `{{website.heroSubtitle}}` | string | ❌ |
| `{{website.heroImage}}` | string (URL) | ❌ |
| `{{website.aboutTitle}}` | string | ❌ |
| `{{website.aboutText}}` | string | ❌ |
| `{{website.aboutImage}}` | string (URL) | ❌ |
| `{{website.galleryImages}}` | string[] (URLs) | ✅ (হতে পারে খালি array) |
| `{{website.testimonials}}` | `{name, text, rating, avatar?}[]` | ✅ (খালি হতে পারে) |
| `{{website.primaryColor}}` | string (hex) | ✅ |
| `{{website.accentColor}}` | string (hex) | ✅ |
| `{{website.facebookUrl}}` `{{website.instagramUrl}}` `{{website.twitterUrl}}` `{{website.tiktokUrl}}` `{{website.youtubeUrl}}` `{{website.whatsappNumber}}` `{{website.tripadvisorUrl}}` | string | ❌ সব optional — না থাকলে সেই আইকন না দেখানো |

`website` পুরো object-ই `null` হতে পারে তাত্ত্বিকভাবে (নতুন tenant, content সেট করেনি) — তাই `{{#if website.heroTitle}}` দিয়ে wrap করাই নিরাপদ যেকোনো optional field-এর জন্য।

### `rooms[]` (loop করতে হবে)

```html
{{#each rooms}}
  <div class="room-card">
    <img src="{{this.images.[0]}}" alt="{{this.name}}" />
    <h3>{{this.name}}</h3>
    <p>{{this.type}} · Floor {{this.floor}}</p>
    <span class="price">{{../tenant.currency}} {{this.basePrice}}</span>
    <p>Max {{this.maxOccupancy}} guests</p>
    {{#each this.amenities}}<span class="tag">{{this}}</span>{{/each}}
  </div>
{{/each}}
```

| Field | Type |
|---|---|
| `id`, `name`, `type`, `number` | string |
| `floor` | number (optional) |
| `basePrice` | number |
| `maxOccupancy` | number |
| `images` | string[] (URLs) |
| `videos` | string[] (URLs) |
| `amenities` | string[] |
| `description` | string (optional) |

---

## ৩. Loop / Conditional Syntax (Handlebars — logic-less)

```html
{{#if website.aboutText}}
  <section id="about">{{website.aboutText}}</section>
{{/if}}

{{#each rooms}}
  ...{{this.name}}...
{{/each}}

<!-- Parent context থেকে ডেটা লাগলে ../ ব্যবহার করো -->
{{#each rooms}}
  {{../tenant.currency}} {{this.basePrice}}
{{/each}}
```

**নিষিদ্ধ:** কাস্টম Handlebars helper, `{{{triple-brace}}}` (raw/unescaped HTML) — সব output auto-escape হবে, XSS ঠেকানোর জন্য এটা বাধ্যতামূলক।

---

## ৪. Widget Mount Points (Interactive অংশ)

Design-এর ভেতরে যেখানে সত্যিকারের interactivity লাগবে (booking submit, availability check, ইত্যাদি), সেখানে একটা empty `<div>` বসিয়ে `data-rp-widget` attribute দাও। ভিতরের logic/state/API call — সব আগে থেকেই বানানো React component সামলাবে, তোমাকে কিছু লিখতে হবে না।

| `data-rp-widget` value | কী করে | Section-এর সাথে সম্পর্ক |
|---|---|---|
| `booking` | Booking form (dates, room select, guest info, submit) | `id="booking"` section-এর ভিতরে বসাও |
| `availability` | Date-picker + room availability calendar | `id="availability"` |
| `menu` | Restaurant menu + cart + in-room order | `id="menu"` |
| `venues` | Venue list + enquiry form | `id="venues"` |
| `vehicles` | Vehicle fleet + rental enquiry form | `id="vehicles"` |
| `contact` | Contact/feedback form | `id="contact"` |
| `offers` | Active promo/offer cards | কোনো নির্দিষ্ট required section না, ঐচ্ছিক — চাইলে rooms বা hero-র কাছে বসাও |
| `social-links` | Footer social icon row | সাধারণত footer-এ |

```html
<section id="booking">
  <h2>Book Your Stay</h2>
  <div data-rp-widget="booking"></div>
</section>
```

**গুরুত্বপূর্ণ:** widget-এর ভিতরে নিজে কিছু লেখার দরকার নেই — খালি `<div data-rp-widget="booking"></div>` যথেষ্ট। CSS দিয়ে চারপাশ style করতে পারো (`[data-rp-widget="booking"] { max-width: 500px; }` টাইপ), কিন্তু widget নিজে যা render করবে তার internal markup তোমার নিয়ন্ত্রণে না — কারণ ওটা existing React component (booking logic, payment, availability সব থার্ড হাতে বানানো, security-reviewed)।

**Gallery-র জন্য কোনো widget লাগে না** — `{{#each website.galleryImages}}` দিয়ে সরাসরি `<img>` বসিয়ে দাও, কোনো interactivity দরকার নেই (lightbox চাইলে CSS `:target` বা `<dialog>` দিয়েই সম্ভব, JS লাগে না)।

---

## ৫. Required Section IDs

Owner dashboard-এ (Website → Templates) section show/hide + drag-reorder করতে পারে ([website/page.tsx `SITE_SECTIONS`](../apps/web/src/app/(dashboard)/dashboard/website/page.tsx))। Renderer এই `id` ধরেই hidden section DOM থেকে বাদ দেয় আর order বদলায় — **তাই প্রতিটা section-এর exact এই `id` থাকা বাধ্যতামূলক:**

| id | fixed (সবসময় দেখাতে হবে)? |
|---|---|
| `hero` | ✅ (toggle করা যায় না) |
| `about` | না |
| `amenities` | না |
| `rooms` | ✅ **fixed** — কখনো hide করা যাবে না |
| `menu` | না |
| `venues` | না |
| `vehicles` | না |
| `gallery` | না |
| `testimonials` | না |
| `availability` | না |
| `booking` | ✅ **fixed** — কখনো hide করা যাবে না |
| `contact` | না |

```html
<section id="rooms">...</section>
<section id="about">...</section>
```

`rooms` আর `booking` — এই দুইটা section design-এ থাকা **বাধ্যতামূলক**, বাকিগুলো ঐচ্ছিক (owner চাইলে hide করবে) কিন্তু `id` ঠিক থাকলে renderer নিজেই সামলাবে।

---

## ৬. CSS Rules

- সব CSS একটা `<style>` ব্লকে বা আলাদা `.css` — inline `style="..."` attribute চলবে (data দিয়ে dynamic না হলে), কিন্তু বড় style block-ই ভালো
- **Scoping:** class name-এ একটা unique prefix রাখা ভালো অভ্যাস (যেমন `.rp-t-<theme-key>-hero`), যাতে ভবিষ্যতে অন্য কিছুর সাথে collision না হয় — বাধ্যতামূলক না কিন্তু recommended
- **Responsive বাধ্যতামূলক** — অন্তত একটা `@media` query বা fluid unit (`clamp()`, `%`, `vw`) থাকতে হবে; শুধু fixed px দিয়ে ডেস্কটপ-only design reject হবে
- External font/image/CSS `@import`, `url()`, `<link>` — শুধু allowlisted host থেকে (Google Fonts এখন allowlisted; নতুন host লাগলে আগে জানাতে হবে)
- Color values dynamic রাখতে চাইলে `{{website.primaryColor}}` / `{{website.accentColor}}` inline style-এ ব্যবহার করা যায়: `<div style="background:{{website.primaryColor}}">`

---

## ৭. নিষিদ্ধ (Validator এগুলো automated ভাবে ধরবে, upload reject হবে)

| নিষিদ্ধ | কেন |
|---|---|
| `<script>` ট্যাগ | Arbitrary JS — same-origin localStorage-এ auth token চুরির ঝুঁকি |
| `on*=` attribute (`onclick`, `onload`, `onerror`...) | একই কারণ |
| `javascript:` বা `data:text/html` URL | একই কারণ |
| `fetch(`, `XMLHttpRequest`, `eval(`, `new Function(` | একই কারণ (থাকলেও `<script>` ছাড়া চলবে না, কিন্তু defense-in-depth হিসেবে string-level block) |
| Allowlist-বহির্ভূত external host (`@import`, `url()`, `<img src>`, `<link>`) | Data exfiltration / tracking pixel ঠেকাতে |
| `{{{triple-brace}}}` raw HTML output | XSS — Handlebars auto-escape বাইপাস করে |

Animation/interactivity সত্যিই দরকার হলে ৩টা নিরাপদ রাস্তা (arbitrary JS ছাড়া):
1. **Allowlisted animation attribute** — `data-rp-anim="fade-up"` টাইপ opt-in, আমরা নিজে GSAP/AOS bundle করে রাখব ভবিষ্যতে (এখনো বানানো হয়নি — v1-এ শুধু CSS animation ব্যবহার করো: `@keyframes`, `transition`, scroll-driven animation)
2. Sandboxed iframe (decorative-only অংশের জন্য, খুব বিশেষ ক্ষেত্রে)
3. একদম custom JS দরকার হলে সেটা Tier 2 না — Tier 3 (code theme) হিসেবে আলাদা করে করতে হবে, deploy-based

---

## ৮. Starter Template (কপি করে শুরু করার জন্য)

```html
<style>
  .rp-t-starter { font-family: system-ui, sans-serif; }
  .rp-t-starter .hero {
    min-height: 70vh; display: flex; flex-direction: column;
    justify-content: center; align-items: center; text-align: center;
    background: {{website.primaryColor}}; color: white; padding: 2rem;
  }
  .rp-t-starter .hero h1 { font-size: clamp(2rem, 5vw, 4rem); margin: 0 0 .5rem; }
  .rp-t-starter .rooms-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem; padding: 3rem 1.5rem; max-width: 1200px; margin: 0 auto;
  }
  .rp-t-starter .room-card { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
  .rp-t-starter .room-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; }
  .rp-t-starter .room-card .body { padding: 1rem; }
  .rp-t-starter .price { color: {{website.accentColor}}; font-weight: 700; }
</style>

<div class="rp-t-starter">

  <section id="hero" class="hero">
    <h1>{{website.heroTitle}}</h1>
    {{#if website.heroSubtitle}}<p>{{website.heroSubtitle}}</p>{{/if}}
  </section>

  {{#if website.aboutText}}
  <section id="about">
    <h2>About {{tenant.name}}</h2>
    <p>{{website.aboutText}}</p>
  </section>
  {{/if}}

  <section id="rooms">
    <h2>Rooms &amp; Villas</h2>
    <div class="rooms-grid">
      {{#each rooms}}
      <div class="room-card">
        <img src="{{this.images.[0]}}" alt="{{this.name}}" />
        <div class="body">
          <h3>{{this.name}}</h3>
          <p class="price">{{../tenant.currency}} {{this.basePrice}} / night</p>
        </div>
      </div>
      {{/each}}
    </div>
  </section>

  {{#if website.galleryImages}}
  <section id="gallery">
    <h2>Gallery</h2>
    {{#each website.galleryImages}}<img src="{{this}}" alt="" />{{/each}}
  </section>
  {{/if}}

  <section id="availability">
    <h2>Check Availability</h2>
    <div data-rp-widget="availability"></div>
  </section>

  <section id="booking">
    <h2>Book Your Stay</h2>
    <div data-rp-widget="booking"></div>
  </section>

  <section id="contact">
    <h2>Contact Us</h2>
    <div data-rp-widget="contact"></div>
  </section>

  <footer>
    <p>{{tenant.address}} · {{tenant.phone}}</p>
    <div data-rp-widget="social-links"></div>
  </footer>

</div>
```

---

## ৯. Validation Checklist (upload করার আগে নিজে চেক করো)

- [ ] `<script>` ট্যাগ নেই
- [ ] কোনো `on*=` attribute নেই
- [ ] `{{{triple-brace}}}` কোথাও ব্যবহার হয়নি
- [ ] `hero`, `rooms`, `booking` section-এর `id` আছে (rooms + booking বাধ্যতামূলক দেখানো)
- [ ] ব্যবহার করা প্রতিটা `data-rp-widget` value উপরের টেবিলের ৮টার একটা — বানানো/ভুল নাম নেই
- [ ] অন্তত একটা `@media` query বা fluid unit আছে (responsive)
- [ ] External font/image শুধু allowlisted host থেকে
- [ ] সব optional field (`website.aboutText`, `tenant.phone` ইত্যাদি) `{{#if}}` দিয়ে wrap করা — না থাকলে ভাঙা লেআউট না দেখায়
- [ ] `rooms` খালি array হলেও section ভাঙে না (empty-state ভাবা হয়েছে)
- [ ] Mobile-এ (375px width) দেখতে ভালো লাগে

---

## Status

📋 **Plan/spec only — এটাই Phase 3-এর deliverable, কোনো renderer engine এখনো নেই।** পরের ধাপ (Phase 4) এই contract অনুযায়ী compile pipeline বানানো: Handlebars compile → sanitize (§৭-এর নিষিদ্ধ লিস্ট enforce করা automated validator) → SSR → widget hydration। তারপর এই doc দিয়েই Claude/designer সরাসরি upload-ready theme বানাতে পারবে।

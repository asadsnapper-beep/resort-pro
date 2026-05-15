# ResortPro Embed SDK & WordPress Plugin Plan
### "যাদের নিজস্ব ওয়েবসাইট আছে, তারা সরাসরি সেখানে ResortPro features embed করতে পারবে"

**Status:** 📋 Planning  
**Priority:** 🔴 High  
**Est. সময়:** ~25–35 ঘন্টা  

---

## সমস্যাটা কী?

অনেক resort owner-এর ইতোমধ্যে:
- WordPress দিয়ে বানানো custom ওয়েবসাইট আছে
- Elementor / Divi / WPBakery দিয়ে ডিজাইন করা পেজ আছে
- তারা ResortPro-র পুরো website builder ব্যবহার করতে চায় না
- কিন্তু **booking form, room list, calendar, menu** — এগুলো নিজের সাইটেই চায়

**Solution:** ResortPro থেকে একটা embed snippet বা WordPress plugin দেওয়া যা তাদের existing site-এ কাজ করবে।

---

## Architecture Decision: কীভাবে কাজ করবে?

```
┌─────────────────────────────────────────────────────────┐
│                  3 Layer Architecture                    │
│                                                          │
│  Layer 1: Public API (already exists)                   │
│  GET /site/:slug/availability                           │
│  POST /site/:slug/book                                  │
│  GET /site/:slug/menu                                   │
│  POST /api/payments/bkash/initiate  etc.               │
│                                                          │
│  Layer 2: Embed SDK (NEW — JS snippet)                  │
│  <script src="cdn.resortpro.app/embed.js">             │
│  → Renders booking form, room list, menu etc.           │
│  → Works on ANY website (WP, Wix, Squarespace...)       │
│                                                          │
│  Layer 3: WordPress Plugin (NEW — wraps Layer 2)        │
│  → Admin panel to configure slug + features             │
│  → Shortcodes: [resortpro_booking] etc.                 │
│  → Gutenberg blocks                                      │
└─────────────────────────────────────────────────────────┘
```

### কেন iframe নয়, JS SDK?

| Method | Pros | Cons |
|--------|------|------|
| **iFrame** | Simple, isolated | Fixed height, no theme matching, SEO খারাপ |
| **JS SDK (Web Components)** | Theme-aware, responsive, full control | একটু জটিল |
| **WP Plugin (REST)** | Native WP feel | শুধু WordPress |

→ **JS SDK** বেছে নিচ্ছি। iFrame fallback option রাখব।

---

## Feature List — কী কী embed করা যাবে?

### Widget 1: Booking Form 🗓️
```html
<div data-resortpro="booking" data-slug="palm-paradise"></div>
```
- Date picker (check-in / check-out)
- Guest count selector
- Room availability list
- Guest details form
- Payment method selection (bKash / SSL / Stripe / Manual)
- Success confirmation
- **Full 4-step flow** (same as our website theme)

### Widget 2: Room List 🛏️
```html
<div data-resortpro="rooms" data-slug="palm-paradise" data-check-in="2026-06-01" data-check-out="2026-06-03"></div>
```
- Available rooms grid
- Room image, name, type, price, amenities
- "Book Now" button → opens booking widget

### Widget 3: Availability Calendar 📅
```html
<div data-resortpro="calendar" data-slug="palm-paradise"></div>
```
- Monthly calendar view
- Available / Booked / Blocked dates color-coded
- Click a date → opens booking form for that date

### Widget 4: Food Menu 🍽️
```html
<div data-resortpro="menu" data-slug="palm-paradise"></div>
```
- Menu items by category (Breakfast, Lunch, Dinner, etc.)
- Item image, name, price, description
- "Add to Order" button
- Cart summary
- Order submission (linked to booking ref or standalone)

### Widget 5: Floating Booking Button 📌
```html
<div data-resortpro="floating-cta" data-slug="palm-paradise"></div>
```
- Fixed bottom-right button "Book Now"
- Clicks → opens booking form in modal overlay
- Optional: WhatsApp button beside it

---

## Technical Architecture

### Embed SDK (`apps/embed/`)
New app in the monorepo — **vanilla JavaScript** (no React, no framework dependency for the host site).

```
apps/embed/
├── src/
│   ├── index.ts              ← entry point, scans DOM for data-resortpro attrs
│   ├── widgets/
│   │   ├── BookingWidget.ts  ← booking form (4-step)
│   │   ├── RoomsWidget.ts    ← room listing
│   │   ├── CalendarWidget.ts ← availability calendar
│   │   ├── MenuWidget.ts     ← restaurant menu + cart
│   │   └── FloatingCta.ts   ← floating book button
│   ├── api/
│   │   └── client.ts         ← fetch wrapper for /site/:slug/* endpoints
│   ├── styles/
│   │   └── embed.css         ← scoped CSS (BEM naming, no global pollution)
│   └── utils/
│       ├── stripe.ts         ← load stripe.js on demand
│       └── theme.ts          ← apply host site's primary color (via data-color)
├── package.json
├── vite.config.ts            ← builds to single embed.js + embed.css
└── README.md
```

**Build output:**
```
dist/
  embed.js          ← minified, ~80KB gzipped
  embed.css         ← scoped styles
```

**CDN delivery:**
```
https://cdn.resortpro.app/embed/v1/embed.js
https://cdn.resortpro.app/embed/v1/embed.css
```

---

### Installation — Any Website

**Method A: Script tag (easiest)**
```html
<!-- Paste in <head> -->
<link rel="stylesheet" href="https://cdn.resortpro.app/embed/v1/embed.css" />
<script defer src="https://cdn.resortpro.app/embed/v1/embed.js"></script>

<!-- Paste where you want the booking form -->
<div 
  data-resortpro="booking"
  data-slug="palm-paradise"
  data-color="#1a6b5e"
  data-currency="BDT"
></div>
```

**Method B: npm package (for developers)**
```bash
npm install @resort-pro/embed
```
```js
import { ResortProBooking } from '@resort-pro/embed'
ResortProBooking.mount('#my-container', { slug: 'palm-paradise' })
```

---

### Widget Data Attributes

| Attribute | Required | Description | Example |
|-----------|----------|-------------|---------|
| `data-resortpro` | ✅ | Widget type | `booking`, `rooms`, `calendar`, `menu`, `floating-cta` |
| `data-slug` | ✅ | Resort slug from ResortPro | `palm-paradise` |
| `data-color` | ❌ | Primary brand color | `#1a6b5e` |
| `data-currency` | ❌ | Currency code | `BDT`, `USD` |
| `data-lang` | ❌ | Language | `en`, `bn` (বাংলা!) |
| `data-theme` | ❌ | Light / dark | `light`, `dark` |
| `data-check-in` | ❌ | Pre-fill check-in | `2026-06-01` |
| `data-check-out` | ❌ | Pre-fill check-out | `2026-06-03` |
| `data-room-id` | ❌ | Show specific room | UUID |
| `data-modal` | ❌ | Open in modal overlay | `true` |

---

### WordPress Plugin (`apps/wordpress-plugin/`)

```
apps/wordpress-plugin/
├── resortpro.php                     ← main plugin file
├── includes/
│   ├── class-resortpro-admin.php     ← WP admin settings page
│   ├── class-resortpro-shortcodes.php ← register shortcodes
│   ├── class-resortpro-blocks.php    ← Gutenberg blocks
│   └── class-resortpro-enqueue.php  ← enqueue embed.js + embed.css
├── admin/
│   ├── settings-page.php             ← admin UI (slug, color, features)
│   └── admin.css
├── blocks/
│   ├── booking-form/                 ← Gutenberg block
│   ├── room-list/
│   ├── calendar/
│   └── menu/
├── readme.txt                        ← WP plugin directory format
└── resortpro.zip                     ← distributable
```

**Plugin Features:**
1. **WP Admin Panel** — Settings → ResortPro
   - Enter Resort Slug (e.g. `palm-paradise`)
   - Primary Color picker
   - Currency selector
   - Enable/disable individual widgets
   - "Test Connection" button → calls `/site/:slug` API

2. **Shortcodes:**
```
[resortpro_booking]
[resortpro_rooms]
[resortpro_calendar]
[resortpro_menu]
[resortpro_floating_cta]

# With options:
[resortpro_booking color="#d4a853" lang="bn"]
[resortpro_rooms check_in="2026-06-01" check_out="2026-06-03"]
```

3. **Gutenberg Blocks:**
   - ResortPro → Booking Form
   - ResortPro → Room List
   - ResortPro → Availability Calendar
   - ResortPro → Restaurant Menu
   - Each block has a sidebar panel with settings

4. **Elementor Widget (optional later):**
   - ResortPro Booking widget in Elementor panel

---

## API Changes Needed

### Existing endpoints that already work ✅
```
GET  /site/:slug                    ← resort info + rooms + website content
GET  /site/:slug/availability       ← room availability for dates
GET  /site/:slug/availability/calendar ← monthly calendar data
POST /site/:slug/book               ← create booking (returns id + confirmationNo)
GET  /site/:slug/menu               ← restaurant menu items
POST /api/payments/bkash/initiate   ← bKash payment
POST /api/payments/ssl/initiate     ← SSL payment
POST /api/payments/stripe/intent    ← Stripe PaymentIntent
GET  /api/payments/settings/active/:slug ← which gateways enabled
```

### New endpoints needed 🆕
```
POST /site/:slug/orders             ← guest places food order (no booking required)
GET  /site/:slug/menu/:category     ← filter menu by category
POST /site/:slug/contact            ← contact form submission (replaces email)
GET  /embed/config/:slug            ← single endpoint: slug → color, currency, enabled widgets
                                       (reduces multiple API calls on embed init)
```

### CORS update needed 🔧
```
# Currently CORS allows only:
CORS_ORIGIN=http://localhost:3000

# After plugin: must allow any origin (embed is loaded on customer domains)
# Solution: Public embed endpoints → CORS: *
# Dashboard endpoints → CORS: only ResortPro app domains
```

---

## Owner Dashboard — Embed Settings Page

New section in `/dashboard/settings` → "Embed & Integration" tab:

```
┌────────────────────────────────────────────┐
│  🔌 Embed & Integration                    │
│                                            │
│  Your Embed Snippet                        │
│  ┌──────────────────────────────────────┐  │
│  │ <script src="...embed.js"></script>  │  │
│  │ <link href="...embed.css">           │  │
│  └──────────────────────────────────────┘  │
│  [Copy Snippet]                            │
│                                            │
│  Widget Snippets:                          │
│  ● Booking Form    [Copy]                 │
│  ● Room List       [Copy]                 │
│  ● Calendar        [Copy]                 │
│  ● Menu            [Copy]                 │
│  ● Floating CTA    [Copy]                 │
│                                            │
│  WordPress Plugin                          │
│  [⬇ Download Plugin (.zip)]               │
│                                            │
│  Embed Settings                            │
│  Primary Color:  [#1a6b5e] 🎨             │
│  Language:       [English ▼]              │
│  Theme:          [Light ▼]                │
└────────────────────────────────────────────┘
```

---

## Security Considerations

| Risk | Solution |
|------|---------|
| Someone else uses your slug | Slug is public; bookings go to the right tenant |
| API key leakage | No API key needed — all embed endpoints are public (slug-based auth) |
| Spam bookings | Rate limit on `/site/:slug/book` (already: 100 req/min) |
| XSS from embed | Embed renders in Shadow DOM or scoped CSS — no host page pollution |
| Payment spoofing | Payment initiation returns redirect URL — no sensitive data in embed |
| CORS abuse | Public endpoints → `*`, auth endpoints → strict origin |

---

## Build & Distribution

### Embed JS Build (Vite)
```js
// vite.config.ts
export default {
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ResortPro',
      fileName: 'embed',
      formats: ['iife'],  // single self-contained file
    },
    rollupOptions: {
      external: [],  // bundle everything — no deps on host site
    },
  },
}
```

### CDN Hosting
- Build output → upload to S3 or Cloudflare R2
- Serve via Cloudflare CDN at `cdn.resortpro.app/embed/v1/`
- Cache: `Cache-Control: public, max-age=86400`
- Versioned URL: `embed/v1/embed.js` → breaking changes → `embed/v2/embed.js`

### WordPress Plugin Distribution
- Option A: **Manual download** from dashboard (`.zip` file)
- Option B: **WordPress.org directory** (longer approval process)
- Option C: **Direct install URL** in WP admin (from our CDN)

---

## Files তৈরি/পরিবর্তন হবে

```
monorepo/
├── apps/
│   ├── embed/                    ← NEW: standalone JS SDK
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── widgets/
│   │   │   │   ├── BookingWidget.ts
│   │   │   │   ├── RoomsWidget.ts
│   │   │   │   ├── CalendarWidget.ts
│   │   │   │   ├── MenuWidget.ts
│   │   │   │   └── FloatingCta.ts
│   │   │   ├── api/client.ts
│   │   │   ├── styles/embed.css
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── wordpress-plugin/         ← NEW: WP plugin
│       ├── resortpro.php
│       ├── includes/
│       ├── admin/
│       └── blocks/
│
├── apps/api/src/
│   ├── routes/website.ts         ← Add: POST /site/:slug/orders
│   │                                     GET /embed/config/:slug
│   └── app.ts                    ← CORS: * for public embed routes
│
└── apps/web/src/
    └── app/(dashboard)/dashboard/
        └── settings/page.tsx     ← Add: "Embed & Integration" tab
```

---

## Timeline

| Step | কাজ | সময় |
|------|-----|------|
| 1 | Embed SDK setup (Vite + project structure) | 1 hr |
| 2 | API client + /embed/config/:slug endpoint | 1 hr |
| 3 | BookingWidget (4-step, full payment) | 6 hr |
| 4 | RoomsWidget + CalendarWidget | 4 hr |
| 5 | MenuWidget + cart + order submission | 4 hr |
| 6 | FloatingCta widget | 1 hr |
| 7 | Scoped CSS + theming system | 2 hr |
| 8 | CORS config update | 0.5 hr |
| 9 | Dashboard Embed settings tab + copy snippets | 2 hr |
| 10 | WordPress plugin (PHP boilerplate + shortcodes) | 4 hr |
| 11 | Gutenberg blocks | 3 hr |
| 12 | Testing on real WP site | 2 hr |
| 13 | Build pipeline + CDN deploy | 1 hr |

**মোট: ~31.5 ঘন্টা**

---

## Example Usage — Real World

### A resort owner with WordPress site:

**Step 1:** ResortPro dashboard → Settings → Embed & Integration → "Download WordPress Plugin"

**Step 2:** WordPress Admin → Plugins → Add New → Upload → Install `resortpro.zip` → Activate

**Step 3:** WordPress Admin → Settings → ResortPro:
- Resort Slug: `cox-bazaar-resort`
- Primary Color: `#0a4a6b`
- [Save & Test Connection → ✅ Connected!]

**Step 4:** Edit any page → Insert shortcode:
```
[resortpro_booking]
```
Or in Gutenberg: Add Block → ResortPro → Booking Form

**Step 5:** Guest visits their WordPress site → sees the full booking form → pays via bKash → gets confirmation ✅

### A resort owner with a plain HTML site:

**Step 1:** Dashboard → Copy snippet:
```html
<link rel="stylesheet" href="https://cdn.resortpro.app/embed/v1/embed.css">
<script defer src="https://cdn.resortpro.app/embed/v1/embed.js"></script>
```

**Step 2:** Paste where they want the form:
```html
<div 
  data-resortpro="booking" 
  data-slug="cox-bazaar-resort"
  data-color="#0a4a6b"
  data-lang="bn"
></div>
```
Done. ✅

---

## Phase 2 (Future)

| Feature | Description |
|---------|-------------|
| **Elementor Widget** | Drag-drop widget in Elementor |
| **Wix App** | Wix marketplace app |
| **Webflow Integration** | Embed in Webflow sites |
| **Bangla Language Pack** | Full Bangla UI for all widgets |
| **Analytics** | Track embed views, booking conversions |
| **A/B Testing** | Test different widget colors/layouts |
| **Custom CSS** | Let owner override widget CSS |

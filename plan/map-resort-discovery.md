# ResortPro Discover — Public Resort Discovery Page
> SEO-first resort marketplace with map, blog, and regional pages

---

## Vision

ResortPro শুধু একটা hotel management SaaS নয় — এটা **South Asia-র eco-tourism/agro-tourism resorts-এর marketplace**।  
`map.resortpro.com` হবে সেই marketplace-এর মুখ — যেখানে যেকেউ map-এ দেখতে পাবে কোথায় কোন resort আছে, click করে সেখানে যেতে পারবে।

```
User visits map.resortpro.com
      ↓
IP → Bangladesh detected
      ↓
Map zooms to Bangladesh — resort dots appear
      ↓
User clicks a dot
      ↓
resort-pro.com/palm-paradise-resort opens (resort website)
```

---

## Target Audience

| User | কে | কেন আসবে |
|------|-----|----------|
| **Traveler** | Bangladesh/India/Nepal-এর tourist | Weekend trip খুঁজছে, eco-resort দেখতে চায় |
| **Corporate** | Team outing, offsite planner | Group-friendly resort খুঁজছে |
| **International** | Eco-tourist (Europe/US) | Bangladesh/Sri Lanka/Nepal-এর authentic experience |
| **Resort Owner** | New owner | "আমার resort কি map-এ আছে?" — onboarding incentive |

---

## Core Features

### 1. Interactive Map (Primary View)

```
┌─────────────────────────────────────────────────────┐
│  [🔍 Search resorts...]    [🌍 BD ▾] [Filter ▾]      │
│─────────────────────────────────────────────────────│
│                                                     │
│         🗺️  INTERACTIVE MAP                         │
│                                                     │
│    ● Sylhet (3)                                     │
│         ●● Cox's Bazar (12)                         │
│    ●  Sundarbans (2)      ● Rangamati (5)           │
│                                                     │
│  [Zoom: + -]  [📍 My Location]  [🛰️ Satellite]      │
└─────────────────────────────────────────────────────┘
```

**Map behaviors:**
- Default: user-এর IP country দেখায় (CF-IPCountry header)
- Bangladesh → Dhaka center, zoom 7
- India → India center, zoom 5
- Others → South Asia overview, zoom 4
- Resort dot এ hover → mini card (name, star rating, price from)
- Resort dot এ click → resort website খোলে নতুন tab-এ
- Clustering: কাছাকাছি resorts → numbered cluster dot (e.g. `●12`)
- Zoom in করলে cluster ভেঙে individual dots হয়

### 2. Resort List (Secondary View — নিচে বা পাশে)

```
┌──────────────────────────────────────────────────────┐
│  📍 Resorts near you  (47 found)    [Grid] [List]    │
│──────────────────────────────────────────────────────│
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │  [img]  │  │  [img]  │  │  [img]  │             │
│  │ Palm    │  │ Coral   │  │ Sundari │             │
│  │ Paradise│  │ Bay     │  │ Eco     │             │
│  │ ⭐4.8   │  │ ⭐4.6   │  │ ⭐4.9   │             │
│  │ Cox's   │  │ Sylhet  │  │ Khulna  │             │
│  │ ৳3,500/n│  │ ৳4,200/n│  │ ৳2,800/n│             │
│  │[Book Now]│  │[Book Now]│  │[Book Now]│            │
│  └─────────┘  └─────────┘  └─────────┘             │
└──────────────────────────────────────────────────────┘
```

**List behaviors:**
- Map scroll করলে list auto-filter হয় (map bounds এর মধ্যে যা আছে)
- List scroll করলে map pan হয় (active card highlight)
- Sort: Featured / Price Low-High / Rating / Newest
- Filter: Country, Category (eco/agro/beach/hill), Amenities, Price range, Rating

### 3. Resort Card Detail (Hover/Click)

```
┌────────────────────────────────────┐
│ [📸 Hero Image]                    │
│────────────────────────────────────│
│ 🏨 Palm Paradise Resort            │
│ 📍 Cox's Bazar, Bangladesh         │
│ ⭐ 4.8  (128 reviews)              │
│                                    │
│ 🌿 Eco-Friendly  🏊 Pool  🍽️ Restaurant │
│                                    │
│ From ৳3,500 / night                │
│                                    │
│ [View Resort →]  [📞 Contact]      │
└────────────────────────────────────┘
```

---

## URL & Subdomain Architecture

```
map.resortpro.com                    → default (IP-based country)
map.resortpro.com/bd                 → Bangladesh resorts
map.resortpro.com/in                 → India resorts
map.resortpro.com/lk                 → Sri Lanka resorts
map.resortpro.com/np                 → Nepal resorts

map.resortpro.com?lat=22.3&lng=91.8&zoom=10  → deep link to coordinates
map.resortpro.com/resort/palm-paradise-resort → direct resort popup
```

---

## Tech Stack

### Frontend — Next.js App (new sub-app or existing web)

**Option A:** `apps/web` এ নতুন route — `app/map/` (simpler)  
**Option B:** নতুন `apps/map/` app — `map.resortpro.com` (cleaner subdomain, recommended)

### Map Library Options

| Library | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| **Mapbox GL JS** | Beautiful, fast, custom styling | Paid ($0 এর পরে) | ✅ Best UX |
| **Leaflet + OpenStreetMap** | Free, open source | Less smooth | ✅ Free tier |
| **Google Maps** | Familiar | Expensive | ❌ Too costly |
| **Maplibre GL** | Mapbox fork, free | Less docs | ✅ Backup |

**Recommendation:** `react-map-gl` (Mapbox wrapper) + `Mapbox free tier` (50k loads/month free)  
Fallback: `react-leaflet` + OpenStreetMap (100% free)

### Backend Changes Needed

**New API endpoints in `apps/api`:**

```
GET /api/map/resorts
  ?country=BD           → filter by country
  ?bounds=lat1,lng1,lat2,lng2  → map bounds filter
  ?q=search             → search by name/location
  ?category=eco         → filter by category
  ?limit=100
  
Response: { resorts: [{ id, slug, name, lat, lng, thumbnail, rating, priceFrom, currency, country, category }] }

GET /api/map/stats
  → total resorts per country (for landing page)
```

**Tenant model additions:**
```prisma
model Tenant {
  // existing fields...
  
  // Map discovery fields (new)
  latitude      Float?          // resort GPS coordinates
  longitude     Float?
  mapVisible    Boolean @default(true)  // opt-out of map listing
  category      ResortCategory? // ECO, AGRO, BEACH, HILL, URBAN, HERITAGE
  priceFrom     Float?          // starting price for display
  starRating    Float?          // 1.0 - 5.0
  amenityTags   String[]        // ["pool", "restaurant", "wifi", "spa"]
  coverImage    String?         // map card hero image
  reviewCount   Int @default(0)
  avgRating     Float @default(0)
}

enum ResortCategory {
  ECO_TOURISM
  AGRO_TOURISM
  BEACH
  HILL_STATION
  HERITAGE
  URBAN_BOUTIQUE
}
```

---

## UI Design — Page Layout

### Desktop (1440px)

```
┌─────────────────────────────────────────────────────────────┐
│ resortpro          🔍 Search...    BD ▾    [List View] [Login]│
├────────────────────────────────┬────────────────────────────┤
│                                │                            │
│                                │  📍 47 resorts found       │
│     🗺️  MAP (60% width)         │                            │
│                                │  ┌──┐ Palm Paradise        │
│  ●  ●  ●12  ●                  │  │  │ Cox's Bazar ⭐4.8    │
│       ●  ●3  ●                 │  └──┘ From ৳3,500          │
│                                │                            │
│                                │  ┌──┐ Coral Bay Resort     │
│                                │  │  │ Sylhet ⭐4.6         │
│  [+][-]  [📍]  [🛰️]            │  └──┘ From ৳4,200          │
└────────────────────────────────┴────────────────────────────┘
```

### Mobile (375px) — Tabs

```
┌─────────────────────┐
│ resortpro  🔍  ⚙️    │
│─────────────────────│
│  [🗺️ Map] [📋 List] │  ← tab switch
│─────────────────────│
│                     │
│   🗺️  MAP VIEW       │
│                     │
│  ●●  ●  ●           │
│                     │
│[View 47 resorts ↑]  │  ← bottom sheet
└─────────────────────┘
```

---

## Resort Dot — Design System

```
State: Normal
  ● Green circle (#1a6b5e), size 12px
  
State: Hover
  ● Larger (20px), shadow, show mini card

State: Cluster (2-9)
  ⬤ Dark green circle with count inside

State: Cluster (10+)
  ⬤ Larger, gold (#d4a853) with count

State: Selected/Active
  ● Pulsing animation, white border

State: Premium/Featured
  ★ Gold star shape instead of circle
```

---

## Pages Structure

```
apps/web/src/app/
│
├── resorts/                              → /resorts/ (hub page — map + list)
│   ├── page.tsx                          → All resorts, IP-detected country
│   ├── loading.tsx
│   ├── sitemap.ts                        → Dynamic sitemap
│   └── [country]/                        → /resorts/bangladesh/
│       ├── page.tsx                      → Country page (SEO landing)
│       ├── [city]/
│       │   └── page.tsx                  → /resorts/bangladesh/sylhet/
│       └── [category]/
│           └── page.tsx                  → /resorts/bangladesh/eco-tourism/
│
├── blog/                                 → /blog/ (content hub)
│   ├── page.tsx                          → Blog listing
│   ├── sitemap.ts
│   └── [slug]/
│       └── page.tsx                      → Individual blog post
│
└── (existing dashboard, auth, etc.)

apps/web/src/components/
├── map/
│   ├── MapContainer.tsx                  → Map wrapper (Leaflet/Mapbox)
│   ├── ResortMarker.tsx                  → Single dot marker
│   ├── ResortCluster.tsx                 → Clustered dots
│   ├── ResortPopup.tsx                   → Hover card popup
│   ├── ResortList.tsx                    → Right panel resort list
│   ├── ResortCard.tsx                    → List item card
│   ├── MapFilters.tsx                    → Filter drawer
│   ├── CountrySelector.tsx               → Country dropdown
│   └── MapSearchBox.tsx                  → Search with autocomplete
│
└── blog/
    ├── BlogCard.tsx                      → Blog post card
    ├── BlogPost.tsx                      → Full post renderer (MDX)
    ├── BlogSidebar.tsx                   → Related posts, categories
    └── AutoResortPost.tsx               → Auto-generated resort review
```

### Blog Content Storage Options

| Option | How | Pros | Cons |
|--------|-----|------|------|
| **MDX files** (`/content/blog/*.mdx`) | Git-based | Simple, fast, free | No admin UI |
| **Database** (`Post` model in Prisma) | DB-stored | Admin can write in dashboard | More code |
| **Contentful/Sanity CMS** | Headless CMS | Best editor UX | Cost |

**Recommendation:** Start with **MDX files** (fast to implement) → later migrate to DB-based with admin editor.

---

## Subdomain Setup

### DNS
```
CNAME  map.resortpro.com  →  cname.vercel-dns.com
```

### Next.js middleware (existing `middleware.ts`)
```typescript
// Detect map.resortpro.com subdomain
if (hostname.startsWith('map.')) {
  return NextResponse.rewrite(new URL(`/map${pathname}`, req.url));
}
```

---

## Data Flow

```
1. User visits map.resortpro.com
2. Middleware detects CF-IPCountry: BD
3. Next.js renders /map?country=BD
4. Client fetches: GET /api/map/resorts?country=BD&limit=200
5. Map renders dots at lat/lng
6. User pans/zooms → client refetches with bounds
7. User clicks dot → opens resortpro.com/{slug}
```

---

## Admin Controls (for Tenant)

**Settings page-এ নতুন "Map Listing" section:**
- Resort location (lat/lng) — map picker বা address autocomplete
- Category selection
- Starting price display
- Map visibility toggle (on/off)
- Cover photo for map card

**Platform Admin Controls:**
- Featured resorts (gold star markers)
- Verified badge
- Boost/sponsored listings (future revenue)

---

## SEO Strategy

```
map.resortpro.com                    title: "Find Eco Resorts | ResortPro Map"
map.resortpro.com/bd                 title: "Eco Resorts in Bangladesh | ResortPro"
map.resortpro.com/in                 title: "Eco Resorts in India | ResortPro"

Schema.org markup:
- LocalBusiness for each resort
- ItemList for resort collections
- GeoCoordinates for map markers

Sitemap:
- /map/bd, /map/in, /map/lk, /map/np
- /map/resort/{slug} for each resort
```

---

## Implementation Phases

### Phase 1 — MVP (2-3 সপ্তাহ)
**Goal: Google-এ index হওয়া শুরু করা**

- [ ] Prisma: Tenant-এ `latitude`, `longitude`, `mapVisible`, `category`, `priceFrom`, `amenityTags` যোগ করা
- [ ] API: `GET /api/map/resorts` — bounds/country filter সহ
- [ ] Frontend: `resortpro.com/resorts/` — Leaflet map + list
- [ ] Country pages: `/resorts/bangladesh/`, `/resorts/india/` etc — static SEO landing pages
- [ ] IP-based country auto-detect
- [ ] Mobile responsive (map/list tab switch)
- [ ] Sitemap: `/resorts/*` pages auto-generated
- [ ] Schema.org markup: ItemList + LodgingBusiness
- [ ] Basic blog: `/blog/` — 4টা MDX article (Cox's Bazar, Sylhet, Rangamati, Dhaka guide)

### Phase 2 — SEO Polish (1-2 সপ্তাহ)
**Goal: প্রথম keywords rank করা**

- [ ] City-level pages: `/resorts/bangladesh/coxs-bazar/`, `/sylhet/` etc
- [ ] Auto-generated resort review pages: `/blog/{slug}-resort-review/`
- [ ] Clustering: `use-supercluster` — dots cluster করবে
- [ ] Hover popup cards with resort info
- [ ] Filter: category, price, rating, amenities
- [ ] Search with autocomplete (resort name + city)
- [ ] Open Graph images for resort cards (social sharing)
- [ ] `resortpro.com/resorts/` subdirectory confirm (or `discover.resortpro.com`)

### Phase 3 — Content & Growth (2 সপ্তাহ)
**Goal: Organic traffic build করা**

- [ ] Blog admin: platform team dashboard থেকে article লিখতে পারবে
- [ ] Resort owner: নিজের resort-এর blog post লিখতে পারবে (guest post)
- [ ] Map settings in owner dashboard (location picker, category, price)
- [ ] Reviews & star ratings display
- [ ] Wishlist / save resorts (localStorage → later account)
- [ ] Share resort link + embed widget
- [ ] hreflang tags: Bengali, Hindi, Sinhala, Nepali

### Phase 4 — Monetization (Future)
**Goal: Revenue channel তৈরি**

- [ ] Featured/sponsored resort listings (gold star, top of list)
- [ ] "Book Now" button → direct to resort checkout
- [ ] Commission tracking (affiliate model)
- [ ] Premium resort profile (extra photos, video, detailed description)
- [ ] API for travel aggregators

---

## Key Dependencies

```json
{
  "react-map-gl": "^7.x",          // Mapbox React wrapper
  "mapbox-gl": "^3.x",             // or
  "react-leaflet": "^4.x",         // Leaflet (free alternative)
  "leaflet": "^1.9.x",
  "supercluster": "^8.x",          // Clustering algorithm
  "use-supercluster": "^1.x",      // React hook for clustering
  "@radix-ui/react-slider": "^1.x" // Price range filter slider
}
```

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Monthly visitors | 10,000+ |
| Resorts listed | 100+ |
| Click-through to resort sites | 30%+ |
| Mobile usage | 60%+ |
| Countries covered | 4 (BD, IN, LK, NP) |
| Avg session duration | 3+ minutes |

---

## Notes

- Resort owner-রা যদি ResortPro ব্যবহার করে, automatically তাদের resort map-এ visible হবে (opt-out option আছে)
- এটা ResortPro-র **biggest acquisition channel** হতে পারে — resort owners দেখবে map-এ তাদের competitor আছে, তারাও join করবে
- সম্পূর্ণ free resorts এর জন্য (marketplace model — future paid boosts)

---

## Subdomain Analysis — SEO Friendliness

### ❌ `map.resortpro.com` — কেন ভালো না

| সমস্যা | কারণ |
|--------|------|
| **"map" keyword SEO value নেই** | Google "eco resort Bangladesh" search করলে "map" subdomain rank করে না |
| **Google subdomain কে আলাদা site ধরে** | resortpro.com এর domain authority share হয় না পুরোপুরি |
| **User confusing** | "map" মানে শুধু map — blog/list/directory বোঝায় না |
| **Brand extension নেই** | ভবিষ্যতে blog, guide, directory যোগ করলে নাম মেলে না |

---

### ✅ Subdomain Recommendations

#### Option 1: `resortpro.com/resorts/` (Subdirectory) — **সবচেয়ে SEO-friendly**
```
resortpro.com/resorts/                    → all resorts map + list
resortpro.com/resorts/bangladesh/         → Bangladesh resorts
resortpro.com/resorts/bangladesh/sylhet/  → Sylhet resorts
resortpro.com/resorts/india/
resortpro.com/blog/                       → resort travel blog
resortpro.com/blog/best-eco-resorts-bangladesh/
```
**কেন সেরা:**
- Main domain এর full SEO authority পায়
- Google একটাই site হিসেবে দেখে
- Blog + resorts একই domain-এ — authority build হয় একসাথে
- "resortpro.com/resorts/bangladesh" → Google এ সরাসরি rank করার সম্ভাবনা বেশি

---

#### Option 2: `discover.resortpro.com` — **ভালো subdomain choice**
```
discover.resortpro.com                    → homepage
discover.resortpro.com/bangladesh/        → Bangladesh page
discover.resortpro.com/blog/              → blog
discover.resortpro.com/guide/sylhet/      → destination guide
```
**কেন ভালো:**
- "discover" একটা strong branded word
- Travel industry-তে common: "discover Thailand", "discover Bangladesh"
- Map + blog + guide সব ধরনের content-এ fit করে
- আলাদা product identity তৈরি হয়

---

#### Option 3: `explore.resortpro.com` — **Alternative**
```
explore.resortpro.com
```
- "explore" travel context-এ খুব popular keyword
- Google Trends: "explore Bangladesh resorts" — উচ্চ search volume

---

#### Option 4: `resorts.resortpro.com` — **Most keyword-rich**
```
resorts.resortpro.com
resorts.resortpro.com/bangladesh/
resorts.resortpro.com/blog/
```
**কেন ভালো:**
- "resorts" keyword সরাসরি subdomain-এ → strong signal
- Google: "resorts.resortpro.com/bangladesh" → "resorts bangladesh" এ rank করার চান্স বেশি
- Direct, clear, professional

---

### 🏆 Final Recommendation

```
Primary URL:    resortpro.com/resorts/           (subdirectory — best SEO)
Blog URL:       resortpro.com/blog/
                  ↓
          যদি separate brand identity চাও:
                  ↓
Alternative:    discover.resortpro.com           (branded subdomain)
Blog:           discover.resortpro.com/blog/
```

**আমার সুপারিশ:** `resortpro.com/resorts/` + `resortpro.com/blog/`  
কারণ: এক domain-এ সব content থাকলে Google ranking এ সবচেয়ে দ্রুত উপরে আসবে।

---

## SEO Strategy — Full Plan

### Target Keywords (Phase 1)

#### Bangladesh 🇧🇩
| Keyword | Monthly Searches | Difficulty | Page |
|---------|-----------------|------------|------|
| eco resort bangladesh | 2,400 | Medium | /resorts/bangladesh |
| resort near dhaka | 5,400 | High | /resorts/bangladesh/dhaka |
| cox's bazar resort | 18,000 | High | /resorts/bangladesh/coxs-bazar |
| sylhet resort | 8,100 | Medium | /resorts/bangladesh/sylhet |
| rangamati resort | 3,600 | Low | /resorts/bangladesh/rangamati |
| agro tourism bangladesh | 1,200 | Low | /resorts/bangladesh/agro-tourism |
| weekend resort dhaka near | 4,400 | Medium | /resorts/bangladesh/dhaka |
| sundarban resort | 2,900 | Low | /resorts/bangladesh/sundarban |

#### India 🇮🇳
| Keyword | Monthly Searches | Difficulty |
|---------|-----------------|------------|
| eco resort india | 12,000 | High |
| jungle resort india | 6,600 | Medium |
| agro tourism resort | 3,200 | Low |

#### Nepal 🇳🇵 & Sri Lanka 🇱🇰
| Keyword | Monthly Searches | Difficulty |
|---------|-----------------|------------|
| eco resort nepal | 2,900 | Low |
| jungle resort sri lanka | 4,400 | Medium |

---

### Page Structure for SEO

```
resortpro.com/resorts/                         → Hub page (all resorts + map)
  ├── /bangladesh/                             → Country page
  │     ├── /dhaka/                            → City/Region page
  │     ├── /sylhet/                           → City page
  │     ├── /coxs-bazar/                       → City page
  │     ├── /rangamati/                        → City page
  │     ├── /sundarban/                        → Region page
  │     └── /eco-tourism/                      → Category page
  ├── /india/
  │     ├── /west-bengal/
  │     └── /eco-tourism/
  ├── /sri-lanka/
  └── /nepal/

resortpro.com/blog/                            → Blog hub
  ├── /best-eco-resorts-bangladesh-2025/       → List article (high traffic)
  ├── /cox-bazar-resort-guide/                 → Destination guide
  ├── /weekend-trip-from-dhaka/               → Intent article
  ├── /agro-tourism-bangladesh/               → Niche keyword
  └── /how-to-book-resort-online-bangladesh/  → Funnel article
```

---

### On-Page SEO per Resort Page

**`/resorts/bangladesh/` — এই রকম হবে:**

```html
<title>Best Eco Resorts in Bangladesh 2025 | ResortPro</title>
<meta name="description" content="Discover 47+ verified eco & agro tourism resorts 
in Bangladesh. Browse Cox's Bazar, Sylhet, Rangamati resorts on interactive map. 
Book directly — no commission.">

<!-- Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Eco Resorts in Bangladesh",
  "numberOfItems": 47,
  "itemListElement": [
    { "@type": "LodgingBusiness", "name": "Palm Paradise Resort", ... }
  ]
}
</script>
```

**প্রতিটি resort page:**
```html
<title>Palm Paradise Resort — Cox's Bazar | ResortPro</title>
<meta name="description" content="Palm Paradise Resort in Cox's Bazar, Bangladesh. 
3 nights from ৳3,500. Pool, restaurant, beachfront. Book directly online.">

<script type="application/ld+json">
{
  "@type": "LodgingBusiness",
  "name": "Palm Paradise Resort",
  "address": { "@type": "PostalAddress", "addressLocality": "Cox's Bazar" },
  "geo": { "@type": "GeoCoordinates", "latitude": 21.4272, "longitude": 92.0058 },
  "starRating": { "@type": "Rating", "ratingValue": "4.8" },
  "priceRange": "৳৳"
}
</script>
```

---

### Blog System — Content Engine

**কেন blog দরকার:**
- "Cox's Bazar resort guide" → Google search → blog article → resort list page → resort booking
- Blog article গুলো long-tail keyword rank করে, map page-এ traffic পাঠায়
- Resort owners নিজেরাও blog লিখতে পারবে (guest post) → backlink + content

**Blog Features:**

```
resortpro.com/blog/
├── Admin: Platform লেখে (destination guides, tips)
├── Owner: নিজের resort নিয়ে article লিখতে পারে
└── Auto-generated: Resort profile থেকে SEO article তৈরি
```

**Blog page types:**

| Type | Example | Traffic Intent |
|------|---------|----------------|
| **Destination Guide** | "Complete Guide to Sylhet Resorts" | Discovery |
| **List Article** | "10 Best Eco Resorts Near Dhaka 2025" | High traffic |
| **How-to** | "How to Book a Resort in Cox's Bazar" | Conversion |
| **Comparison** | "Beach Resort vs Hill Resort Bangladesh" | Decision |
| **Seasonal** | "Best Resorts for Monsoon Season" | Temporal |
| **Auto-generated** | "Palm Paradise Resort — Full Review" | Long-tail |

**Auto-generated resort review pages:**
```
resortpro.com/blog/palm-paradise-resort-review/
→ Auto-generated from resort data:
  - Name, location, category, amenities
  - Price range, check-in/out time
  - Map embed, photo gallery
  - "Book Now" button
  → This alone creates 100+ indexed pages (1 per resort)
```

---

### Technical SEO Checklist

```
✅ Sitemap: resortpro.com/sitemap.xml
   - /resorts/* pages
   - /blog/* pages
   - Updated daily (new resorts auto-added)

✅ Robots.txt:
   Allow: /resorts/, /blog/
   Disallow: /dashboard/, /api/, /auth/

✅ hreflang tags:
   <link rel="alternate" hreflang="bn" href="resortpro.com/bn/resorts/bangladesh/" />
   <link rel="alternate" hreflang="en" href="resortpro.com/resorts/bangladesh/" />
   <link rel="alternate" hreflang="hi" href="resortpro.com/hi/resorts/india/" />

✅ Open Graph / Twitter Cards:
   Resort card images for social sharing

✅ Core Web Vitals:
   - Map lazy load (don't block LCP)
   - Resort list: virtualized (react-window)
   - Images: next/image with WebP

✅ Internal Linking:
   Blog → Resort list page → Individual resort → Book now

✅ Canonical URLs:
   /resorts/bangladesh/?sort=price → canonical: /resorts/bangladesh/
```

---

### Content Calendar (First 3 Months)

| Month | Articles | Focus |
|-------|----------|-------|
| Month 1 | 4 articles | Bangladesh destination guides (Cox's Bazar, Sylhet, Rangamati, Dhaka near) |
| Month 2 | 4 articles | "Best of" lists (eco, beach, family, budget) + India intro |
| Month 3 | 4 articles | Seasonal content + Nepal/Sri Lanka + how-to guides |

**Automatic content (no writing needed):**
- Each new resort → auto-generates 1 SEO page (`/blog/{slug}-review/`)
- 50 resorts = 50 indexed pages automatically

---

### Backlink Strategy

| Source | How | Value |
|--------|-----|-------|
| **Resort owners** | They share their ResortPro page | Medium DA backlinks |
| **Travel bloggers** | Guest post offer | High DA |
| **Tourism boards** | BD Tourism, India Tourism directory listing | Gov backlinks |
| **Google My Business** | Each resort → GMB listing links to ResortPro page | Local SEO |
| **TripAdvisor** | Link from resort profile | High DA |
| **Wikipedia** | Eco-tourism Bangladesh article → reference | Very high DA |

---

### Expected SEO Timeline

```
Month 1-2:  Google indexes pages, domain authority builds
Month 3:    First long-tail keywords start ranking (position 20-50)
Month 4-5:  "eco resort [city]" keywords: position 10-20
Month 6:    "eco resort bangladesh" → position 5-15
Month 9-12: "resort bangladesh" competitive keywords → top 10
Year 2:     ResortPro = go-to directory for South Asia eco-tourism
```

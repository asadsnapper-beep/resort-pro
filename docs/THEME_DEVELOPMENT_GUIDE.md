# ResortPro — Theme Development Guide

> **Target audience:** Developers and Claude AI.  
> Follow this guide exactly to build a new public-website theme from scratch.  
> Every theme is a self-contained React component tree under `apps/web/src/components/themes/<key>/`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File / Folder Structure](#2-file--folder-structure)
3. [The `ResortData` Type (what your theme receives)](#3-the-resortdata-type)
4. [Step-by-Step: Build a New Theme](#4-step-by-step-build-a-new-theme)
5. [Shared Widgets (ready-to-use)](#5-shared-widgets)
6. [Section Patterns & Conventions](#6-section-patterns--conventions)
7. [Registering the Theme (code side)](#7-registering-the-theme-code-side)
8. [Registering the Theme (database side)](#8-registering-the-theme-database-side)
9. [Preview & Testing](#9-preview--testing)
10. [Checklist Before Committing](#10-checklist-before-committing)
11. [Full Minimal Example](#11-full-minimal-example)

---

## 1. Architecture Overview

```
Owner sets templateId in dashboard
        ↓
GET /site/:slug → ResortData (API)
        ↓
registry.ts → getTheme(templateId) → <ThemeComponent data={resortData} />
        ↓
/{slug} page renders the theme
/{slug}?preview=themeKey  → live preview without saving
```

Key files:

| File | Purpose |
|------|---------|
| `apps/web/src/components/themes/registry.ts` | Maps theme key → React component |
| `apps/web/src/components/themes/types.ts` | Shared TypeScript types (`ResortData`, `ThemeProps`, etc.) |
| `apps/web/src/components/themes/_widgets/` | Shared widgets (BookingForm, Menu, Availability, Contact) |
| `apps/web/src/app/(public)/[slug]/page.tsx` | Renders the theme based on slug or ?preview param |
| `packages/database/prisma/schema.prisma` | `Theme` model — DB metadata for each theme |

---

## 2. File / Folder Structure

Every theme lives in its own folder named after its key (lowercase, no spaces):

```
apps/web/src/components/themes/
├── <key>/
│   ├── index.tsx          ← Main theme component (default export: <KeyTheme />)
│   ├── config.ts          ← Theme metadata (id, name, colors, sections)
│   ├── sections/
│   │   ├── HeroSection.tsx
│   │   ├── AboutSection.tsx
│   │   ├── RoomsSection.tsx
│   │   ├── GallerySection.tsx
│   │   ├── TestimonialsSection.tsx
│   │   ├── FooterSection.tsx
│   │   └── index.ts       ← re-exports all sections
│   └── components/        ← (optional) theme-specific modals, cards, etc.
│       └── index.ts
├── _widgets/              ← Shared widgets (don't modify these)
├── registry.ts            ← Add your theme here
└── types.ts               ← Shared types (don't modify unless adding a field to API)
```

**Naming convention:** Key = `lowercase-kebab`, e.g. `luxe`, `minimal`, `coastal`, `urban-chic`, `tropical`.

---

## 3. The `ResortData` Type

Your theme receives exactly one prop: `data: ResortData`. Here is the full type:

```typescript
interface ResortData {
  tenant: {
    name: string;           // "Ocean View Resort"
    slug: string;           // "ocean-view" — used for API calls
    phone?: string;
    email?: string;
    address?: string;
    currency: string;       // "BDT", "USD", etc.
    checkInTime: string;    // "14:00"
    checkOutTime: string;   // "11:00"
    logoUrl?: string;
  };
  website: {
    heroTitle: string;
    heroSubtitle?: string;
    heroImage?: string;     // URL
    aboutTitle?: string;
    aboutText?: string;
    aboutImage?: string;
    galleryImages?: string[];
    testimonials?: { name: string; text: string; rating: number; avatar?: string }[];
    primaryColor?: string;  // hex, e.g. "#1a6b5e"
    accentColor?: string;   // hex, e.g. "#d4a853"
    templateId?: string;    // the active theme key
    seoTitle?: string;
    seoDescription?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
    whatsappNumber?: string;
    tripadvisorUrl?: string;
  } | null;
  rooms: {
    id: string;
    name: string;
    type: string;           // "Deluxe", "Suite", etc.
    number: string;         // room number
    basePrice: number;
    maxOccupancy: number;
    floor?: number;
    images: string[];
    videos: string[];
    amenities: string[];
    description?: string;
  }[];
}
```

**Always null-check `data.website`** before using its fields.

Extract colors at the top of your main component:
```typescript
const primary = data.website?.primaryColor || '#1a6b5e';  // resort green
const accent  = data.website?.accentColor  || '#d4a853';  // gold
```

---

## 4. Step-by-Step: Build a New Theme

### Step 1 — Create the folder structure

```bash
mkdir -p apps/web/src/components/themes/<key>/sections
mkdir -p apps/web/src/components/themes/<key>/components
```

### Step 2 — Write `config.ts`

```typescript
// apps/web/src/components/themes/<key>/config.ts
export const <key>Config = {
  id: '<key>',
  name: 'Theme Display Name',
  description: 'One-line description shown in theme picker',
  defaultColors: {
    primary: '#1a6b5e',
    accent:  '#d4a853',
  },
  sections: ['hero', 'about', 'rooms', 'gallery', 'testimonials', 'availability', 'booking', 'feedback'],
  fonts: {
    heading: 'serif',   // or 'sans-serif'
    body:    'sans-serif',
  },
}
```

### Step 3 — Write each Section component

Each section is a plain React component. Signature:

```typescript
// sections/HeroSection.tsx
'use client'
import type { ResortData } from '../../types'

interface HeroSectionProps {
  data: ResortData
  scrollTo: (id: string) => void   // for CTA buttons
}

export function HeroSection({ data, scrollTo }: HeroSectionProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'

  return (
    <section id="hero" className="...">
      {/* your design here */}
    </section>
  )
}
```

**Required section IDs** (used for scroll navigation):
- `hero` — full-screen landing
- `about` — about the property
- `rooms` — room listing
- `gallery` — photo gallery
- `testimonials` — guest reviews
- `availability` — date picker calendar
- `booking` — booking form
- `feedback` — contact / feedback form

Create `sections/index.ts` to re-export:
```typescript
export { HeroSection }    from './HeroSection'
export { AboutSection }   from './AboutSection'
export { RoomsSection }   from './RoomsSection'
export { GallerySection } from './GallerySection'
export { TestimonialsSection } from './TestimonialsSection'
export { FooterSection }  from './FooterSection'
```

### Step 4 — Write `index.tsx` (main theme component)

```typescript
// apps/web/src/components/themes/<key>/index.tsx
'use client'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import type { ThemeProps } from '../types'
import { AvailabilityCalendar, BookingForm, MenuWidget, ContactForm } from '../_widgets'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import {
  HeroSection, AboutSection, RoomsSection,
  GallerySection, TestimonialsSection, FooterSection,
} from './sections'

const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'availability', label: 'Availability' },
  { id: 'menu',         label: 'Menu' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'feedback',     label: 'Contact' },
]

export function <Key>Theme({ data }: ThemeProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#1a6b5e'
  const accent  = website?.accentColor  || '#d4a853'

  const [navOpen,  setNavOpen]  = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // For calendar → booking pre-fill
  const [calCheckIn,  setCalCheckIn]  = useState('')
  const [calCheckOut, setCalCheckOut] = useState('')
  const [calRoomId,   setCalRoomId]   = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="min-h-screen font-sans antialiased">

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        {/* ... nav content ... */}
      </nav>

      {/* Sections */}
      <HeroSection data={data} scrollTo={scrollTo} />
      <AboutSection data={data} />
      <RoomsSection data={data} onViewRoom={() => {}} onBookRoom={() => {}} />

      <MenuWidget
        slug={tenant.slug} primaryColor={primary}
        accentColor={accent} currency={tenant.currency}
      />

      <GallerySection data={data} />
      <TestimonialsSection data={data} />

      {/* Availability */}
      <section id="availability" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <AvailabilityCalendar
            slug={tenant.slug} primaryColor={primary}
            accentColor={accent} currency={tenant.currency}
            onRoomSelect={(room, checkIn, checkOut) => {
              setCalCheckIn(checkIn.toISOString().split('T')[0])
              setCalCheckOut(checkOut.toISOString().split('T')[0])
              setCalRoomId(room.id)
              document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </div>
      </section>

      {/* Booking Form */}
      <section id="booking" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <BookingForm
            slug={tenant.slug} primaryColor={primary}
            accentColor={accent} currency={tenant.currency}
            rooms={data.rooms}
            checkInTime={tenant.checkInTime} checkOutTime={tenant.checkOutTime}
            initialCheckIn={calCheckIn   || undefined}
            initialCheckOut={calCheckOut || undefined}
            initialRoomId={calRoomId     || undefined}
          />
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback" className="py-24 bg-gray-50">
        <div className="max-w-2xl mx-auto px-6">
          <ContactForm
            slug={tenant.slug} primaryColor={primary}
            accentColor={accent} currency={tenant.currency}
          />
        </div>
      </section>

      <FooterSection data={data} scrollTo={scrollTo} />
      <WhatsAppButton whatsappNumber={website?.whatsappNumber} />
    </div>
  )
}
```

---

## 5. Shared Widgets

These are **pre-built, fully functional** — import and drop in without any API work.

### `BookingForm`
```typescript
import { BookingForm } from '../_widgets'

<BookingForm
  slug={tenant.slug}
  primaryColor={primary}
  accentColor={accent}
  currency={tenant.currency}
  rooms={data.rooms}
  checkInTime={tenant.checkInTime}
  checkOutTime={tenant.checkOutTime}
  initialCheckIn={string | undefined}   // pre-fill from calendar
  initialCheckOut={string | undefined}
  initialRoomId={string | undefined}
/>
```

### `AvailabilityCalendar`
```typescript
import { AvailabilityCalendar } from '../_widgets'

<AvailabilityCalendar
  slug={tenant.slug}
  primaryColor={primary}
  accentColor={accent}
  currency={tenant.currency}
  onRoomSelect={(room, checkIn: Date, checkOut: Date) => void}
/>
```

### `MenuWidget`
```typescript
import { MenuWidget } from '../_widgets'

<MenuWidget
  slug={tenant.slug}
  primaryColor={primary}
  accentColor={accent}
  currency={tenant.currency}
/>
```
Renders the resort's food menu with categories and item cards. Shows nothing if no menu items exist.

### `ContactForm`
```typescript
import { ContactForm } from '../_widgets'

<ContactForm
  slug={tenant.slug}
  primaryColor={primary}
  accentColor={accent}
  currency={tenant.currency}
/>
```
Feedback / complaint submission form.

### `WhatsAppButton`
```typescript
import { WhatsAppButton } from '../_widgets/SocialLinks'

<WhatsAppButton whatsappNumber={website?.whatsappNumber} />
```
Floating WhatsApp CTA button. Renders nothing if `whatsappNumber` is falsy.

---

## 6. Section Patterns & Conventions

### Using `primaryColor` / `accentColor`
Always use `style={{ color: accent }}` or `style={{ backgroundColor: primary }}` for brand colors — not hardcoded Tailwind classes — so owner customization works:

```tsx
// ✅ correct — respects owner's chosen colors
<h2 style={{ color: primary }}>Welcome</h2>
<button style={{ backgroundColor: accent }}>Book Now</button>

// ❌ wrong — ignores owner customization
<h2 className="text-green-700">Welcome</h2>
```

### Section IDs
Every section needs `id="<name>"` matching the NAV_ITEMS so scroll navigation works:
```tsx
<section id="about" className="py-24">
```

### Image fallbacks
Always handle missing images gracefully:
```tsx
{website?.heroImage
  ? <img src={website.heroImage} alt="" className="w-full h-full object-cover" />
  : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }} />
}
```

### Null-safe data access
```tsx
// ✅ correct
const rooms = data.rooms || []
const testimonials = data.website?.testimonials || []
const gallery = data.website?.galleryImages || []

// Show section only if content exists
{gallery.length > 0 && <GallerySection data={data} />}
```

### `'use client'` directive
Add `'use client'` at the top of:
- `index.tsx` (uses useState, useEffect)
- Any section with interactive elements

Server-only sections (pure display) don't need it, but it's always safe to include.

---

## 7. Registering the Theme (code side)

Edit **`apps/web/src/components/themes/registry.ts`**:

```typescript
import { LuxeTheme }    from './luxe'
import { MinimalTheme } from './minimal'
import { CoastalTheme } from './coastal'
import { UrbanChicTheme } from './urban-chic'   // ← add import

export const THEME_REGISTRY: Record<string, React.ComponentType<ThemeProps>> = {
  luxe:       LuxeTheme,
  minimal:    MinimalTheme,
  coastal:    CoastalTheme,
  'urban-chic': UrbanChicTheme,                 // ← add entry
}
```

**The key in `THEME_REGISTRY` must exactly match the DB `Theme.key` field.**

---

## 8. Registering the Theme (database side)

### Option A — Run a seed script (recommended for development)

```javascript
// scripts/seed-theme.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

await prisma.theme.upsert({
  where: { key: 'urban-chic' },
  create: {
    key:          'urban-chic',
    name:         'Urban Chic',
    description:  'Modern city hotel aesthetic with bold typography',
    previewImage: 'https://your-cdn.com/themes/urban-chic-preview.jpg',
    author:       'ResortPro Team',
    version:      '1.0.0',
    tags:         ['Modern', 'Urban', 'Bold Typography'],
    isActive:     true,
    isDefault:    false,
    isPremium:    false,
    requiredPlan: 'STARTER',
    sortOrder:    4,
  },
  update: {},
})

await prisma.$disconnect()
console.log('Done!')
```

Run:
```bash
node scripts/seed-theme.mjs
```

### Option B — Through Super Admin UI

1. Go to `/admin/themes`
2. Click **+ Add Theme**
3. Fill in the key (must match registry), name, tags, etc.
4. Save

> ⚠️ **Important:** Adding through the Super Admin UI does NOT add the code. The theme key must exist in `registry.ts` before owners can use it. Otherwise `getTheme(key)` will fall back to `luxe`.

### Theme DB Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string (unique) | Matches `THEME_REGISTRY` key. e.g. `urban-chic` |
| `name` | string | Display name. e.g. `Urban Chic` |
| `description` | string? | One-line description for the theme picker |
| `previewImage` | string? | URL to 16:9 screenshot of the theme (800×450px recommended) |
| `author` | string | Default: `"ResortPro Team"` |
| `version` | string | Semver. Default: `"1.0.0"` |
| `tags` | string[] | e.g. `["Modern", "Dark", "Bold"]` |
| `isActive` | boolean | `false` = hidden from owners |
| `isDefault` | boolean | Only one theme can be default (fallback for new sites) |
| `isPremium` | boolean | Used for Premium badge display |
| `requiredPlan` | string | `STARTER` / `PROFESSIONAL` / `ENTERPRISE` |
| `sortOrder` | number | Lower = appears first in picker |

---

## 9. Preview & Testing

### Live preview without saving

Navigate to:
```
http://localhost:3000/<any-resort-slug>?preview=<theme-key>
```

Example:
```
http://localhost:3000/hotel-sunrise?preview=urban-chic
```

A floating banner appears: "Preview mode — urban-chic theme". This uses the exact same `ResortData` as production — fonts, colors, rooms, gallery — but renders your theme instead of the saved one.

> You need at least one resort with a published website. Use the test tenant slug from your local DB.

### ThemePicker preview (owner view)

1. Log in as a resort owner
2. Go to **Dashboard → Website → Theme**
3. Find your theme in the grid
4. Click **Preview** → full-screen iframe opens
5. If the theme key is in registry.ts but not in DB, it won't appear (fetch falls back to FALLBACK list with only luxe/minimal/coastal)

### Check for TypeScript errors

```bash
cd apps/web && npx tsc --noEmit
```

### Build check

```bash
pnpm --filter @resort-pro/web build
```

---

## 10. Checklist Before Committing

- [ ] `apps/web/src/components/themes/<key>/index.tsx` — exports `<Key>Theme`
- [ ] `apps/web/src/components/themes/<key>/config.ts` — has correct key/name/colors
- [ ] `apps/web/src/components/themes/<key>/sections/index.ts` — re-exports all sections
- [ ] All sections have correct `id="..."` attribute (hero, about, rooms, etc.)
- [ ] Colors use `style={{ color: primary }}` not hardcoded Tailwind
- [ ] Image fallbacks handled for missing `heroImage`, `galleryImages`, `aboutImage`
- [ ] `registry.ts` updated with import + entry
- [ ] DB entry added (seed script or admin UI)
- [ ] Preview tested at `/{slug}?preview=<key>`
- [ ] No TypeScript errors in new files (`npx tsc --noEmit`)
- [ ] Mobile-responsive (tested at 375px width)
- [ ] `BookingForm`, `AvailabilityCalendar`, `MenuWidget`, `ContactForm` all included
- [ ] `WhatsAppButton` included at end of component

---

## 11. Full Minimal Example

Here is the absolute minimum working theme (`tropical`):

**`apps/web/src/components/themes/tropical/config.ts`**
```typescript
export const tropicalConfig = {
  id: 'tropical',
  name: 'Tropical Paradise',
  description: 'Lush green design for beach and jungle resorts',
  defaultColors: { primary: '#2d6a4f', accent: '#f4a261' },
  sections: ['hero', 'about', 'rooms', 'gallery', 'availability', 'booking', 'feedback'],
  fonts: { heading: 'serif', body: 'sans-serif' },
}
```

**`apps/web/src/components/themes/tropical/sections/HeroSection.tsx`**
```typescript
'use client'
import type { ResortData } from '../../types'

export function HeroSection({ data, scrollTo }: { data: ResortData; scrollTo: (id: string) => void }) {
  const { website } = data
  const primary = website?.primaryColor || '#2d6a4f'
  const accent  = website?.accentColor  || '#f4a261'

  return (
    <section id="hero" className="relative h-screen flex items-center justify-center">
      {website?.heroImage
        ? <img src={website.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${primary} 0%, #1b4332 100%)` }} />
      }
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 text-center text-white px-6">
        <h1 className="text-6xl font-bold mb-4">{website?.heroTitle}</h1>
        {website?.heroSubtitle && <p className="text-xl mb-8 text-white/80">{website.heroSubtitle}</p>}
        <button onClick={() => scrollTo('booking')}
          className="px-8 py-4 rounded-full font-semibold text-gray-900"
          style={{ backgroundColor: accent }}>
          Book Now
        </button>
      </div>
    </section>
  )
}
```

**`apps/web/src/components/themes/tropical/sections/index.ts`**
```typescript
export { HeroSection } from './HeroSection'
// add other sections as you build them
```

**`apps/web/src/components/themes/tropical/index.tsx`**
```typescript
'use client'
import { useState, useEffect } from 'react'
import type { ThemeProps } from '../types'
import { AvailabilityCalendar, BookingForm, MenuWidget, ContactForm } from '../_widgets'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import { HeroSection } from './sections'

export function TropicalTheme({ data }: ThemeProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '#2d6a4f'
  const accent  = website?.accentColor  || '#f4a261'

  const [calCheckIn,  setCalCheckIn]  = useState('')
  const [calCheckOut, setCalCheckOut] = useState('')
  const [calRoomId,   setCalRoomId]   = useState('')

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen font-sans">
      <HeroSection data={data} scrollTo={scrollTo} />

      {/* About */}
      <section id="about" className="py-24 bg-white max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold mb-4" style={{ color: primary }}>
          {website?.aboutTitle || tenant.name}
        </h2>
        <p className="text-gray-600 leading-relaxed">{website?.aboutText}</p>
      </section>

      {/* Rooms — minimal list */}
      <section id="rooms" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12" style={{ color: primary }}>Our Rooms</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.rooms.map(room => (
              <div key={room.id} className="bg-white rounded-2xl shadow overflow-hidden">
                {room.images[0] && <img src={room.images[0]} alt={room.name} className="w-full h-48 object-cover" />}
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 mb-1">{room.name}</h3>
                  <p className="text-gray-500 text-sm mb-3">{room.type} · {room.maxOccupancy} guests</p>
                  <p className="font-semibold" style={{ color: accent }}>
                    {tenant.currency} {room.basePrice.toLocaleString()} / night
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MenuWidget slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency} />

      {/* Availability */}
      <section id="availability" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <AvailabilityCalendar
            slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency}
            onRoomSelect={(room, ci, co) => {
              setCalCheckIn(ci.toISOString().split('T')[0])
              setCalCheckOut(co.toISOString().split('T')[0])
              setCalRoomId(room.id)
              document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </div>
      </section>

      {/* Booking */}
      <section id="booking" className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <BookingForm
            slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency}
            rooms={data.rooms} checkInTime={tenant.checkInTime} checkOutTime={tenant.checkOutTime}
            initialCheckIn={calCheckIn || undefined} initialCheckOut={calCheckOut || undefined}
            initialRoomId={calRoomId || undefined}
          />
        </div>
      </section>

      {/* Contact */}
      <section id="feedback" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <ContactForm slug={tenant.slug} primaryColor={primary} accentColor={accent} currency={tenant.currency} />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500" style={{ backgroundColor: primary }}>
        <p className="text-white">{tenant.name} · {tenant.address}</p>
        <p className="text-white/60 mt-1">{tenant.phone} · {tenant.email}</p>
      </footer>

      <WhatsAppButton whatsappNumber={website?.whatsappNumber} />
    </div>
  )
}
```

**`apps/web/src/components/themes/registry.ts`** — add the entry:
```typescript
import { TropicalTheme } from './tropical'

export const THEME_REGISTRY = {
  // ... existing themes ...
  tropical: TropicalTheme,
}
```

That's a fully working theme. Add more sections and styling as needed.

---

*Last updated: 2026-05-18 | Feature 3 of Theme System*

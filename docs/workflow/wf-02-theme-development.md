# WF-02 — Theme Development Workflow

## Overview
ResortPro-তে নতুন resort theme বানানোর step-by-step instruction।
এই guide follow করলে theme বানানো সহজ হবে এবং সব dynamic part (booking, menu, form) automatically কাজ করবে।

---

## Core Concept — থিম কী করে, কী করে না

### Theme করে ✅
- Visual layout design (hero, sections, colors, fonts, spacing)
- Section ordering (কোন section কোথায় থাকবে)
- Section-specific styling (hero-র background কেমন, room card কেমন দেখাবে)
- Animation, hover effects, transitions

### Theme করে না ❌
- Booking logic (API call, form validation, payment)
- Menu fetch + cart management
- Contact form submit logic
- Availability check API call

> এই সব **Widgets** করে। Theme শুধু widget-কে সঠিক জায়গায় বসায়।

---

## File Structure (প্রতিটি theme-এর জন্য)

```
apps/web/src/components/themes/[theme-key]/
│
├── index.tsx          → Main theme export (required)
├── config.ts          → Theme metadata (required)
│
└── sections/          → Theme-specific visual sections
    ├── Hero.tsx       → Hero/banner section
    ├── Rooms.tsx      → Room listing
    ├── About.tsx      → About the resort
    ├── Gallery.tsx    → Photo gallery
    └── Footer.tsx     → Footer
```

---

## Step 1 — Theme-এর নাম ঠিক করো

### Naming Rules
- Lowercase, hyphen-separated
- Short এবং descriptive
- Theme key = folder name = registry key

**Examples:**
```
luxe        → Luxe Gold (existing)
minimal     → Clean Minimal
coastal     → Ocean Breeze
forest      → Forest Retreat
urban       → Urban Boutique
heritage    → Heritage Classic
```

---

## Step 2 — Branch তৈরি করো

```bash
git checkout main
git pull origin main
git checkout -b feature/theme-coastal
```

---

## Step 3 — Folder তৈরি করো

```bash
mkdir -p apps/web/src/components/themes/coastal/sections
```

---

## Step 4 — config.ts বানাও

```typescript
// apps/web/src/components/themes/coastal/config.ts

export const config = {
  key: 'coastal',
  name: 'Ocean Breeze',
  description: 'Light, airy design inspired by the sea. Perfect for beach resorts.',
  version: '1.0.0',
  author: 'ResortPro',
  previewImage: '/theme-previews/coastal.jpg',  // 1200x800px screenshot

  // Default colors — owner dashboard থেকে override করতে পারবে
  defaultColors: {
    primary: '#0e7490',     // Teal
    accent: '#f59e0b',      // Amber
    background: '#f0f9ff',
    text: '#0c4a6e',
  },

  // Default fonts
  fonts: {
    heading: 'Cormorant Garamond',
    body: 'DM Sans',
  },

  // Theme-এ কোন sections আছে (order অনুযায়ী)
  sections: [
    'hero',
    'availability',   // ✅ Always include — AvailabilityCalendar widget
    'rooms',
    'about',
    'gallery',
    'menu',           // ✅ Always include — MenuWidget
    'booking',        // ✅ Always include — BookingForm widget
    'contact',        // ✅ Always include — ContactForm widget
    'footer',
  ],
}
```

---

## Step 5 — Sections বানাও

### Hero Section Example

```tsx
// apps/web/src/components/themes/coastal/sections/Hero.tsx
'use client'

interface HeroProps {
  title: string
  subtitle?: string
  heroImage?: string
  primaryColor: string
  accentColor: string
  resortName: string
}

export function CoastalHero({ title, subtitle, heroImage, primaryColor, accentColor, resortName }: HeroProps) {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center"
      style={{ backgroundImage: heroImage ? `url(${heroImage})` : undefined }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />

      {/* Content */}
      <div className="relative z-10 text-center text-white px-6 max-w-3xl mx-auto">
        <p
          className="text-sm font-semibold tracking-[0.3em] uppercase mb-4"
          style={{ color: accentColor }}
        >
          {resortName}
        </p>
        <h1 className="text-5xl md:text-7xl font-serif mb-6">{title}</h1>
        {subtitle && (
          <p className="text-xl text-white/80 mb-10">{subtitle}</p>
        )}
        <a
          href="#availability"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold transition-all hover:scale-105"
          style={{ backgroundColor: primaryColor, color: '#fff' }}
        >
          Check Availability →
        </a>
      </div>
    </section>
  )
}
```

---

## Step 6 — Main index.tsx বানাও

এটাই সবচেয়ে গুরুত্বপূর্ণ ফাইল। এখানে সব section + widget একসাথে যুক্ত হয়।

```tsx
// apps/web/src/components/themes/coastal/index.tsx
'use client'

// Theme sections (নিজের design)
import { CoastalHero } from './sections/Hero'
import { CoastalRooms } from './sections/Rooms'
import { CoastalAbout } from './sections/About'
import { CoastalGallery } from './sections/Gallery'
import { CoastalFooter } from './sections/Footer'

// ✅ Dynamic widgets — এগুলো কখনো theme-এ লেখা হয় না
import { AvailabilityCalendar } from '../_widgets/AvailabilityCalendar'
import { BookingForm } from '../_widgets/BookingForm'
import { MenuWidget } from '../_widgets/MenuWidget'
import { ContactForm } from '../_widgets/ContactForm'

// Types — সব theme-এ একই ResortData type
import type { ResortData } from '../types'

export function CoastalTheme({ data }: { data: ResortData }) {
  // Widget props — একবার prepare করো, সব widget-এ pass করো
  const widgetProps = {
    slug: data.tenant.slug,
    primaryColor: data.website?.primaryColor ?? '#0e7490',
    accentColor: data.website?.accentColor ?? '#f59e0b',
    currency: data.tenant.currency,
  }

  return (
    <div className="coastal-theme font-dm-sans">

      {/* 1. Hero */}
      <CoastalHero
        title={data.website?.heroTitle ?? data.tenant.name}
        subtitle={data.website?.heroSubtitle}
        heroImage={data.website?.heroImage}
        primaryColor={widgetProps.primaryColor}
        accentColor={widgetProps.accentColor}
        resortName={data.tenant.name}
      />

      {/* 2. ✅ Availability Calendar Widget */}
      <section id="availability" className="py-20 bg-sky-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-serif text-center mb-10" style={{ color: widgetProps.primaryColor }}>
            Check Availability
          </h2>
          <AvailabilityCalendar {...widgetProps} />
        </div>
      </section>

      {/* 3. Rooms */}
      <CoastalRooms rooms={data.rooms} {...widgetProps} />

      {/* 4. About */}
      {data.website?.aboutText && (
        <CoastalAbout
          title={data.website.aboutTitle}
          text={data.website.aboutText}
          image={data.website.aboutImage}
        />
      )}

      {/* 5. Gallery */}
      {data.website?.galleryImages && data.website.galleryImages.length > 0 && (
        <CoastalGallery images={data.website.galleryImages} />
      )}

      {/* 6. ✅ Restaurant Menu Widget */}
      <section id="menu" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-serif text-center mb-10">Our Restaurant</h2>
          <MenuWidget {...widgetProps} />
        </div>
      </section>

      {/* 7. ✅ Booking Form Widget */}
      <section id="booking" className="py-20 bg-sky-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-serif text-center mb-10">Book Your Stay</h2>
          <BookingForm {...widgetProps} rooms={data.rooms} />
        </div>
      </section>

      {/* 8. ✅ Contact Form Widget */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <ContactForm {...widgetProps} tenant={data.tenant} />
        </div>
      </section>

      {/* 9. Footer */}
      <CoastalFooter tenant={data.tenant} primaryColor={widgetProps.primaryColor} />

    </div>
  )
}
```

---

## Step 7 — Registry-তে যোগ করো

```typescript
// apps/web/src/components/themes/registry.ts

import { LuxeTheme } from './luxe'
import { MinimalTheme } from './minimal'
import { CoastalTheme } from './coastal'   // ← নতুন theme add

export const THEME_REGISTRY = {
  luxe: LuxeTheme,
  minimal: MinimalTheme,
  coastal: CoastalTheme,    // ← এখানেও add করো
}

export type ThemeKey = keyof typeof THEME_REGISTRY

export function getTheme(key: string) {
  return THEME_REGISTRY[key as ThemeKey] ?? THEME_REGISTRY.luxe
}
```

---

## Step 8 — Preview image তৈরি করো

```
public/theme-previews/coastal.jpg
```
- Size: 1200×800px
- Theme-এর above-the-fold screenshot
- Admin panel-এ theme picker-এ দেখাবে

---

## Step 9 — Test করো

```bash
# Local dev server চালাও
pnpm --filter web dev

# Browser-এ খোলো
http://localhost:3000/your-test-resort-slug

# Dashboard-এ theme change করো
http://localhost:3000/dashboard/website → Theme tab → coastal select
```

---

## Step 10 — Commit করো

```bash
git add apps/web/src/components/themes/coastal/
git commit -m "feat: add coastal ocean breeze theme"

git add apps/web/src/components/themes/registry.ts
git commit -m "feat: register coastal theme in registry"

git checkout main
git merge feature/theme-coastal
git push origin main
```

---

## Widget Rules (গুরুত্বপূর্ণ!)

### ✅ Widget ব্যবহার করতে হবে এই সব কাজে:
| কাজ | Widget |
|-----|--------|
| Room availability check | `AvailabilityCalendar` |
| Booking form | `BookingForm` |
| Restaurant menu + order | `MenuWidget` |
| Contact/inquiry form | `ContactForm` |

### ❌ Theme-এর ভেতরে এগুলো লেখা যাবে না:
- `fetch('/site/:slug/booking', ...)` — Widget করবে
- `useState` for cart — Widget করবে
- Form submit logic — Widget করবে

---

## Common Mistakes

| ❌ ভুল | ✅ সঠিক |
|--------|---------|
| Theme-এ booking API call লেখা | `<BookingForm>` widget use করো |
| `primaryColor` hardcode করা | `data.website?.primaryColor` থেকে নাও |
| Section বাদ দেওয়া (booking/menu) | সব required widget রাখো |
| Registry-তে add না করা | `registry.ts` আপডেট করো |
| Preview image না দেওয়া | `public/theme-previews/` এ দাও |

---

## Checklist (Theme Submit করার আগে)

- [ ] `config.ts` — key, name, description, colors সব আছে
- [ ] `index.tsx` — সব required widget আছে (availability, booking, menu, contact)
- [ ] `sections/` — সব section component আছে
- [ ] `registry.ts` — নতুন theme add করা হয়েছে
- [ ] Preview image দেওয়া হয়েছে (`public/theme-previews/`)
- [ ] Local-এ test করা হয়েছে
- [ ] Dark text on light background (contrast check)
- [ ] Mobile responsive

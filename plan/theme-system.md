# ResortPro — Theme System Master Plan

> এই plan-এ দুটো জিনিস আছে:
> 1. **Super Admin Theme Section** — কী কী feature থাকবে, কীভাবে কাজ করবে
> 2. **Theme Development Guide** — Claude দিয়ে বারবার নতুন theme বানানোর instruction

---

## Part A — Super Admin Theme Section

### বর্তমান অবস্থা

Admin-এ `/admin/themes` page আছে। এখন যা করা যায়:
- Theme list দেখা
- Theme on/off toggle
- Theme metadata edit (name, description, preview image URL, tags, plan)
- Theme add (key দিয়ে — কিন্তু code আলাদা করতে হয়)
- Delete (soft — inactive করে)

**সমস্যা:**
- Theme "add" মানে শুধু DB-তে entry — code আলাদা করতে হয়
- কতজন resort কোন theme ব্যবহার করছে দেখা যায় না
- কোনো "New Theme Upload" workflow নেই
- Theme preview ঠিকমতো নেই

---

### প্রস্তাবিত Theme Section — পূর্ণ Design

```
/admin/themes
│
├── 📊 Stats Bar
│   ├── Total themes: 3
│   ├── Active: 3
│   ├── Premium: 1
│   └── Total installs: 47 (কতটা resort কোনো theme ব্যবহার করছে)
│
├── 🗂️ Tabs
│   ├── All Themes
│   ├── Active
│   ├── Premium
│   └── Inactive
│
├── 🃏 Theme Cards (grid layout)
│   প্রতিটা theme card-এ:
│   ├── Preview screenshot (full-width)
│   ├── Theme name + key badge
│   ├── Description
│   ├── Tags
│   ├── Plan badge (STARTER/PRO/ENTERPRISE)
│   ├── Install count (কতটা resort ব্যবহার করছে)
│   ├── Active/Inactive toggle
│   ├── Edit button
│   ├── Preview button (নতুন tab-এ demo খোলে)
│   └── Set as Default button
│
└── ➕ "Add New Theme" button
    └── Theme Creation Wizard (নিচে বিস্তারিত)
```

---

### Theme Card Layout

```
┌──────────────────────────────────────┐
│  [Preview Image — 16:9 ratio]        │
│                                       │
├──────────────────────────────────────┤
│  Luxe Gold           [luxe] v1.0     │
│  Elegant luxury design with gold     │
│  accents, perfect for 5-star...      │
│                                       │
│  🏷 Luxury  Gold  Dark Navy          │
│                                       │
│  ⭐ STARTER   👑 Premium             │
│  📊 18 resorts using this            │
│                                       │
│  [Preview ↗]  [Edit]  [● Active ▾]  │
└──────────────────────────────────────┘
```

---

### Theme Creation Workflow (Admin Panel)

"Upload" মানে এখানে theme code তৈরি করা, তারপর register করা।

**Step 1 — Admin form submit:**
```
Theme Name:        [ Mountain Escape        ]
Theme Key (slug):  [ mountain               ]  ← auto-generated
Description:       [ Nature-inspired...     ]
Preview Image:     [ 🖼 Upload or paste URL ]
Screenshots:       [ + Add screenshot       ]
Tags:              [ Nature, Earthy, Modern ]
Required Plan:     [ ● STARTER  ○ PRO  ○ ENT ]
Premium:           [ ○ Free  ● Premium       ]
Color Palette:
  Primary:         [ #2d5a3d  ]  (green)
  Accent:          [ #c8a96e  ]  (gold)
  Background:      [ #faf9f6  ]  (warm white)
Font Style:        [ ○ Serif  ● Sans  ○ Mixed ]
Layout Style:      [ ● Full-screen Hero
                     ○ Split Layout
                     ○ Minimal/Clean
                     ○ Bold/Magazine ]
Sections:          [✓ Hero  ✓ About  ✓ Rooms
                    ✓ Gallery  ✓ Testimonials
                    ○ Menu  ✓ Availability
                    ✓ Booking  ✓ Contact ]
Notes for dev:     [ Extra details for Claude ]

[ Generate Theme Brief ]
```

**Step 2 — System generates a "Theme Brief":**
```
Theme Brief — Mountain Escape (mountain)

Key: mountain
Colors: primary=#2d5a3d, accent=#c8a96e, bg=#faf9f6
Font: Sans-serif body, Serif headings
Layout: Full-screen hero
Sections: hero, about, rooms, gallery, testimonials,
          availability, booking, contact
Style notes: Nature-inspired, earthy, warm — think
             forest resort, hill station. No dark mode.

--- COPY THIS TO CLAUDE ---
এই theme brief দিয়ে Claude-কে theme code বানাতে বলো।
plan/theme-system.md এর "Theme Development Guide" follow করো।
```

**Step 3 — Claude theme code বানায়**
(নিচে Part B-তে guide আছে)

**Step 4 — Admin theme register করে:**
- Code যোগ করা হলে Admin panel থেকে "Mark as Ready" করে
- DB-তে entry auto-ready হয়

---

### API Changes দরকার

**নতুন endpoint:**
```
GET  /api/admin/themes/:key/stats
     → কতটা resort এই theme ব্যবহার করছে

GET  /api/admin/themes/usage
     → সব theme-এর usage count একসাথে
```

**Database — Tenant model-এ theme tracking:**
```prisma
// (ইতিমধ্যে website settings-এ templateId আছে)
// শুধু count query দরকার
```

---

### Implementation Priority

```
Priority 1 (UI upgrade — 1 day):
  ✦ Theme cards → grid layout (screenshot + install count)
  ✦ Tab filter (All/Active/Premium/Inactive)
  ✦ Install count দেখানো (theme usage API)

Priority 2 (Workflow — 1 day):
  ✦ Theme Brief generator form
  ✦ Screenshot upload (multiple images)
  ✦ Preview link (demo slug দিয়ে)

Priority 3 (Future):
  ✦ Theme version history
  ✦ A/B testing (কোন theme বেশি bookings আনে)
  ✦ Theme marketplace (third-party developers)
```

---

---

## Part B — Theme Development Guide for Claude

> এই section টা পড়ে Claude নতুন theme বানাবে।
> প্রতিবার নতুন theme বানাতে হলে এই guide + theme brief দিয়ে Claude-কে বলো।

---

### কীভাবে Claude-কে বলবে

```
এই project-এ একটা নতুন theme বানাতে হবে।
plan/theme-system.md এর "Part B — Theme Development Guide" পড়ো।
নিচের brief অনুযায়ী theme টা বানাও:

[Theme Brief paste করো]
```

---

### Theme Architecture — Core Structure

প্রতিটা theme এই structure follow করে:

```
apps/web/src/components/themes/<key>/
│
├── index.tsx          ← Main theme component (entry point)
├── config.ts          ← Theme metadata (colors, sections)
└── sections/
    ├── index.ts       ← Re-export সব section
    ├── HeroSection.tsx
    ├── AboutSection.tsx
    ├── RoomsSection.tsx
    ├── GallerySection.tsx
    ├── TestimonialsSection.tsx
    ├── FooterSection.tsx
    └── ContactSection.tsx  (optional)
```

**Optional sections (theme-এ না থাকলে skip):**
- `AmenitiesSection.tsx`
- `AvailabilitySection.tsx`
- `BookingSection.tsx`
- `MenuSection.tsx`

---

### Step 1 — config.ts বানাও

```typescript
// apps/web/src/components/themes/<key>/config.ts

export const <key>Config = {
  id: '<key>',
  name: '<Theme Name>',
  description: '<Short description>',
  defaultColors: {
    primary: '<hex>',   // main brand color
    accent:  '<hex>',   // button, highlight color
  },
  sections: [
    'hero', 'about', 'rooms', 'gallery',
    'testimonials', 'availability', 'booking', 'feedback',
    // add/remove as needed
  ],
  fonts: {
    heading: 'serif',   // or 'sans-serif'
    body:    'sans-serif',
  },
}
```

---

### Step 2 — Types (import করো, বানাবে না)

সব theme এই types import করে:

```typescript
import type { ThemeProps, ResortData, ResortRoom, ResortTenant, ResortWebsite } from '../types'
```

`ThemeProps` = `{ data: ResortData }`

`ResortData` = `{ tenant: ResortTenant, website: ResortWebsite | null, rooms: ResortRoom[] }`

---

### Step 3 — Shared Widgets (always use, never rebuild)

এই widgets সব theme-এ একই — নিজে বানাবে না:

```typescript
import { 
  AvailabilityCalendar,  // date picker + room availability
  BookingForm,           // reservation form
  MenuWidget,            // F&B menu display
  ContactForm,           // feedback/contact form
} from '../_widgets'
import { WhatsAppButton } from '../_widgets/SocialLinks'
```

**Widget props সব একই:**
```typescript
interface WidgetProps {
  slug: string          // tenant.slug
  primaryColor: string  // website?.primaryColor || config.defaultColors.primary
  accentColor: string   // website?.accentColor  || config.defaultColors.accent
  currency: string      // tenant.currency
}
```

---

### Step 4 — index.tsx (Main Theme Component)

```typescript
// apps/web/src/components/themes/<key>/index.tsx
'use client'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import type { ThemeProps, ResortRoom } from '../types'
import { AvailabilityCalendar, BookingForm, MenuWidget, ContactForm } from '../_widgets'
import { WhatsAppButton } from '../_widgets/SocialLinks'
import { HeroSection, AboutSection, RoomsSection, GallerySection, TestimonialsSection, FooterSection } from './sections'

// Nav items — theme-এর sections-এর সাথে match করবে
const NAV_ITEMS = [
  { id: 'about',        label: 'About' },
  { id: 'rooms',        label: 'Rooms' },
  { id: 'gallery',      label: 'Gallery' },
  { id: 'availability', label: 'Availability' },
  { id: 'booking',      label: 'Book Now' },
  { id: 'feedback',     label: 'Contact' },
]

export function <ThemeName>Theme({ data }: ThemeProps) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '<default_primary>'
  const accent  = website?.accentColor  || '<default_accent>'

  // State
  const [navOpen, setNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')
  const [selectedRoom, setSelectedRoom] = useState<ResortRoom | null>(null)
  const [bookingRoom, setBookingRoom]   = useState<ResortRoom | null>(null)
  const [calendarCheckIn, setCalendarCheckIn]   = useState('')
  const [calendarCheckOut, setCalendarCheckOut] = useState('')
  const [calendarRoomId, setCalendarRoomId]     = useState('')

  // Scroll tracking
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Section observer
  useEffect(() => {
    const ids = ['hero', 'about', 'rooms', 'gallery', 'availability', 'booking', 'feedback']
    const observers = ids.map(id => {
      const el = document.getElementById(id)
      if (!el) return null
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.3 }
      )
      obs.observe(el)
      return obs
    })
    return () => observers.forEach(o => o?.disconnect())
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="min-h-screen font-sans antialiased">

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        {/* Logo + nav items + mobile toggle */}
        {/* CUSTOMIZE: navbar background, text colors, active states */}
      </nav>

      {/* ── Sections ── */}
      <HeroSection data={data} scrollTo={scrollTo} />
      <AboutSection data={data} />
      <RoomsSection data={data} onViewRoom={setSelectedRoom} onBookRoom={setBookingRoom} />
      <GallerySection data={data} />
      <TestimonialsSection data={data} />

      {/* Availability (shared widget — don't modify) */}
      <section id="availability" className="py-20 bg-stone-50">
        <div className="max-w-4xl mx-auto px-6">
          <AvailabilityCalendar
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            currency={tenant.currency}
            onRoomSelect={(room, checkIn, checkOut) => {
              setCalendarCheckIn(checkIn.toISOString().split('T')[0])
              setCalendarCheckOut(checkOut.toISOString().split('T')[0])
              setCalendarRoomId(room.id)
              scrollTo('booking')
            }}
          />
        </div>
      </section>

      {/* Booking Form (shared widget — don't modify) */}
      <section id="booking" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <BookingForm
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            currency={tenant.currency}
            rooms={data.rooms}
            checkInTime={tenant.checkInTime}
            checkOutTime={tenant.checkOutTime}
            initialCheckIn={calendarCheckIn   || undefined}
            initialCheckOut={calendarCheckOut || undefined}
            initialRoomId={calendarRoomId     || undefined}
          />
        </div>
      </section>

      {/* Contact Form (shared widget — don't modify) */}
      <section id="feedback" className="py-24">
        <div className="max-w-2xl mx-auto px-6">
          <ContactForm
            slug={tenant.slug}
            primaryColor={primary}
            accentColor={accent}
            currency={tenant.currency}
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

### Step 5 — Section Components

প্রতিটা section এই pattern follow করে:

```typescript
// sections/HeroSection.tsx
import type { ThemeProps } from '../../types'

interface Props extends ThemeProps {
  scrollTo: (id: string) => void
}

export function HeroSection({ data, scrollTo }: Props) {
  const { tenant, website } = data
  const primary = website?.primaryColor || '<default>'
  const accent  = website?.accentColor  || '<default>'

  return (
    <section id="hero" className="relative min-h-screen ...">
      {/* Hero content */}
      {/* Background image: website?.heroImage */}
      {/* Title: website?.heroTitle || tenant.name */}
      {/* Subtitle: website?.heroSubtitle */}
      {/* CTA button: scrollTo('booking') */}
    </section>
  )
}
```

```typescript
// sections/RoomsSection.tsx
import type { ThemeProps, ResortRoom } from '../../types'

interface Props extends ThemeProps {
  onViewRoom: (room: ResortRoom) => void
  onBookRoom: (room: ResortRoom) => void
}

export function RoomsSection({ data, onViewRoom, onBookRoom }: Props) {
  const { rooms, website, tenant } = data
  const accent = website?.accentColor || '<default>'

  // Display: room.name, room.type, room.basePrice, room.images[0],
  //          room.amenities, room.maxOccupancy, room.description
  // Currency: tenant.currency
  
  return (
    <section id="rooms" className="py-24 ...">
      {rooms.map(room => (
        // Room card
        // [View Details] → onViewRoom(room)
        // [Book Now] → onBookRoom(room)
      ))}
    </section>
  )
}
```

```typescript
// sections/GallerySection.tsx — website.galleryImages[] ব্যবহার করো
// sections/TestimonialsSection.tsx — website.testimonials[] ব্যবহার করো
// sections/AboutSection.tsx — website.aboutTitle, website.aboutText, website.aboutImage
// sections/FooterSection.tsx — tenant.phone, tenant.email, tenant.address, social links
```

---

### Step 6 — sections/index.ts

```typescript
export { HeroSection }         from './HeroSection'
export { AboutSection }        from './AboutSection'
export { RoomsSection }        from './RoomsSection'
export { GallerySection }      from './GallerySection'
export { TestimonialsSection } from './TestimonialsSection'
export { FooterSection }       from './FooterSection'
// add others as needed
```

---

### Step 7 — Registry-তে Add করো

```typescript
// apps/web/src/components/themes/registry.ts

import { <ThemeName>Theme } from './<key>'

export const THEME_REGISTRY: Record<string, React.ComponentType<ThemeProps>> = {
  luxe:     LuxeTheme,
  minimal:  MinimalTheme,
  coastal:  CoastalTheme,
  <key>:    <ThemeName>Theme,   // ← এইটা add করো
}
```

---

### Step 8 — Admin Panel-এ Register করো

Admin-এ `/admin/themes` → "Add Theme" বোতাম:

```
Key:           mountain
Name:          Mountain Escape
Description:   ...
Preview Image: (URL paste করো)
Tags:          Nature, Earthy, Warm
Required Plan: STARTER
Premium:       No
```

---

### Data যা পাওয়া যায় — চিট শিট

```typescript
data.tenant.name           // Resort এর নাম
data.tenant.slug           // URL slug (widget props-এ দেওয়া হয়)
data.tenant.phone          // Footer-এ
data.tenant.email          // Footer-এ
data.tenant.address        // Footer-এ
data.tenant.currency       // "BDT" | "USD" etc
data.tenant.checkInTime    // "14:00"
data.tenant.checkOutTime   // "11:00"
data.tenant.logoUrl        // logo image URL (nullable)

data.website?.heroTitle         // Hero section heading
data.website?.heroSubtitle      // Hero subheading
data.website?.heroImage         // Hero background image URL
data.website?.aboutTitle        // About section title
data.website?.aboutText         // About section body text
data.website?.aboutImage        // About section image
data.website?.galleryImages     // string[] — gallery photos
data.website?.testimonials      // { name, text, rating, avatar? }[]
data.website?.primaryColor      // Custom primary color (user সেট করে)
data.website?.accentColor       // Custom accent color
data.website?.seoTitle          // <title> tag
data.website?.seoDescription    // <meta description>
data.website?.facebookUrl       // Social links
data.website?.instagramUrl
data.website?.whatsappNumber    // WhatsApp float button
data.website?.tripadvisorUrl

data.rooms[].id            // Room ID (widget-এ দিতে হয়)
data.rooms[].name          // "Deluxe Ocean View"
data.rooms[].type          // "DELUXE" | "SUITE" etc
data.rooms[].number        // "101"
data.rooms[].basePrice     // per night price (number)
data.rooms[].maxOccupancy  // max guests
data.rooms[].floor         // floor number
data.rooms[].images        // string[] — room photos
data.rooms[].amenities     // string[] — ["WiFi", "AC", "Mini Bar"]
data.rooms[].description   // room description text
```

---

### Tailwind Rules

```
✅ Tailwind utility classes ব্যবহার করো
✅ Inline style শুধু dynamic colors-এর জন্য:
   style={{ color: primary }}
   style={{ backgroundColor: accent }}

✅ className-এ CSS variable বা HSL না
✅ Dark mode না (theme-এ dark mode নেই)
✅ Mobile responsive: sm: md: lg: breakpoints ব্যবহার করো
✅ Image-এ object-cover দাও
✅ Smooth scroll: scrollTo() function ব্যবহার করো

❌ CSS modules না
❌ styled-components না
❌ New npm package install না
❌ _widgets ফোল্ডারের ভেতরে কিছু বদলাবে না
❌ types.ts বদলাবে না
❌ registry.ts-এর বাইরে অন্য কিছু export করবে না
```

---

### Naming Convention

```
Theme key:       lowercase, hyphen — mountain, coastal-dark, villa-white
Component:       PascalCase + "Theme" — MountainTheme, CoastalDarkTheme
Config export:   camelCase + "Config" — mountainConfig
Folder:          lowercase — /themes/mountain/
```

---

### Existing Themes — Reference

| Theme | Style | Primary | Accent |
|-------|-------|---------|--------|
| `luxe` | Dark luxury, gold accents, serif headings | `#1a6b5e` | `#d4a853` |
| `minimal` | Clean white, minimal, sans-serif | `#1a6b5e` | `#d4a853` |
| `coastal` | Ocean blue, light airy, photo-heavy | `#1e6b8a` | `#f0a500` |

নতুন theme বানাতে existing theme folder copy করে key+colors বদলানো fastest approach।

---

### Quick Start — নতুন Theme বানানোর সবচেয়ে দ্রুত পথ

```bash
# 1. Existing theme copy করো (luxe সবচেয়ে complete)
cp -r apps/web/src/components/themes/luxe apps/web/src/components/themes/<key>

# 2. সব ফাইলে "luxe" → "<key>", "Luxe" → "<ThemeName>" replace করো

# 3. Colors বদলাও (config.ts + index.tsx-এ default colors)

# 4. Section গুলো customize করো যেভাবে চাও

# 5. registry.ts-এ add করো

# 6. Admin panel-এ register করো
```

---

### Theme Brief Template (প্রতিবার নতুন theme-এর জন্য fill করো)

```
=== THEME BRIEF ===

Key:         <slug>
Name:        <Full Name>
Description: <1-2 sentences>

Colors:
  Primary:    <hex>  (main brand, nav active, buttons)
  Accent:     <hex>  (CTAs, highlights, section labels)
  Background: <hex>  (page background)

Typography:
  Headings:   Serif / Sans-serif
  Body:       Sans-serif

Layout Style:
  Hero:       Full-screen / Split / Centered card / Video bg
  Rooms:      Grid 3col / Grid 2col / Horizontal scroll / List

Mood/Feel:   [e.g. Tropical + Vibrant, Mountain + Earthy, Urban + Minimal]

Special requests:
  [e.g. "Hero-তে parallax effect চাই"]
  [e.g. "Room cards-এ hover করলে image zoom হবে"]
  [e.g. "Dark navbar সবসময়, scroll করলেও"]

Sections to include:
  [✓] Hero  [✓] About  [✓] Rooms  [✓] Gallery
  [✓] Testimonials  [✓] Availability  [✓] Booking
  [✓] Contact  [ ] Menu  [ ] Amenities

=== END BRIEF ===
```

---

## Quick Reference — Claude-কে দেওয়ার জন্য শর্ট Prompt

```
ResortPro project-এ নতুন theme বানাতে হবে।
`plan/theme-system.md` এর "Part B — Theme Development Guide" পড়ো।
নিচের brief অনুযায়ী theme তৈরি করো:

[BRIEF paste করো]

Note:
- Shared widgets (_widgets/) কখনো modify করবে না
- types.ts বদলাবে না
- registry.ts-এ শেষে add করবে
- Admin panel-এ add করার instruction দেবে
```

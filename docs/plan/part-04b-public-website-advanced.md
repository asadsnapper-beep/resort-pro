# Part 04B — Public Website: Advanced Features Plan

## Overview
Part 04-এর extension। Public resort website-এ ৩টি বড় feature add করা হবে:

1. **Availability Calendar** — Booking-এর আগে room availability দেখানো
2. **Theme System** — Multiple resort themes, admin থেকে নতুন theme add
3. **Dynamic Widget System** — Theme বদলালেও booking/menu/form নষ্ট হবে না

---

## Feature 1: Availability Calendar

### User Experience
```
Guest website-এ আসে
→ "Check Availability" section দেখে
→ Check-in + Check-out date select করে
→ Calendar-এ কোন দিনগুলো booked/available রঙে দেখায়
→ Available rooms-এর list নিচে আসে
→ Room select করে booking form-এ যায়
```

### Calendar Color Coding
| Color | Meaning |
|-------|---------|
| 🟢 Green | সব room available |
| 🟡 Yellow | কিছু room available (partial) |
| 🔴 Red | সব room booked (fully booked) |
| ⚫ Gray | Past date (select করা যাবে না) |

### Architecture

#### Frontend Component: `AvailabilityCalendar`
```
apps/web/src/components/website-widgets/AvailabilityCalendar.tsx

Props:
- slug: string          → resort slug
- primaryColor: string  → theme color
- onDatesSelected(checkIn, checkOut, availableRooms[]) → callback

State:
- selectedMonth: Date
- checkIn: Date | null
- checkOut: Date | null
- availabilityMap: Record<dateString, 'available' | 'partial' | 'full'>
- availableRooms: Room[]
- loading: boolean
```

#### API Endpoint (already exists — enhance করতে হবে)
```
GET /site/:slug/availability?checkIn=2026-01-01&checkOut=2026-01-05
→ Returns: available rooms list

GET /site/:slug/availability/calendar?month=2026-01&roomType=SUITE (NEW)
→ Returns: per-day availability summary for entire month
  {
    "2026-01-01": { available: 5, total: 8, status: "partial" },
    "2026-01-02": { available: 0, total: 8, status: "full" },
    "2026-01-03": { available: 8, total: 8, status: "available" }
  }
```

#### Flow Detail
```
1. Guest page load → current month availability fetch হয়
2. Guest previous/next month click → সেই month fetch হয়
3. Guest check-in date click → check-out date select mode on
4. Check-out select হলে → /site/:slug/availability call
5. Available rooms নিচে render হয়
6. "Book This Room" click → booking form scroll/open হয়
7. Room pre-selected থাকে booking form-এ
```

### Component Location in Theme
Theme-এর booking section-এ `<AvailabilityCalendar>` widget inject করা হবে।
Theme নিজে calendar logic জানে না — শুধু widget render করে।

---

## Feature 2: Theme System

### Concept
প্রতিটি resort আলাদা theme choose করতে পারবে। Theme = complete visual design।
কিন্তু booking form, menu, contact form — এগুলো সব theme-এ একই widget।

### Theme Registry (Database)

```prisma
model Theme {
  id          String   @id @default(uuid())
  key         String   @unique   // "luxe", "minimal", "coastal", "forest"
  name        String             // "Luxe Gold", "Clean Minimal", "Ocean Breeze"
  description String?
  previewImage String?           // Screenshot of the theme
  isActive    Boolean  @default(true)
  isPremium   Boolean  @default(false)  // Future: paid themes
  createdAt   DateTime @default(now())
}
```

`WebsiteContent` model-এ `templateId String?` ইতিমধ্যে আছে → এটাই theme key হিসেবে ব্যবহার হবে।

### Theme Folder Structure

```
apps/web/src/components/themes/
│
├── registry.ts                    → সব theme-এর list + import
│
├── luxe/                          → Theme 01: Luxe Gold (existing LuxeTemplate)
│   ├── index.tsx                  → Main theme component
│   ├── config.ts                  → Theme metadata
│   └── sections/                  → Theme-specific sections
│       ├── Hero.tsx
│       ├── Rooms.tsx
│       ├── About.tsx
│       └── Gallery.tsx
│
├── minimal/                       → Theme 02: Clean Minimal
│   ├── index.tsx
│   ├── config.ts
│   └── sections/
│
├── coastal/                       → Theme 03: Ocean Breeze
│   ├── index.tsx
│   ├── config.ts
│   └── sections/
│
└── _widgets/                      → Shared dynamic widgets (theme-agnostic)
    ├── AvailabilityCalendar.tsx   → Feature 1
    ├── BookingForm.tsx
    ├── MenuWidget.tsx
    ├── RestaurantOrderWidget.tsx
    └── ContactForm.tsx
```

### Theme Config File (`config.ts`)

প্রতিটি theme-এ একটি `config.ts` থাকবে:

```typescript
// apps/web/src/components/themes/minimal/config.ts

export const config = {
  key: 'minimal',
  name: 'Clean Minimal',
  description: 'Modern, clean design. Perfect for boutique hotels.',
  version: '1.0.0',
  author: 'ResortPro',
  previewImage: '/theme-previews/minimal.jpg',

  // Default colors (owner dashboard থেকে override করতে পারবে)
  defaultColors: {
    primary: '#2d3748',
    accent: '#ed8936',
    background: '#ffffff',
    text: '#1a202c',
  },

  // কোন sections আছে এই theme-এ
  sections: [
    'hero',
    'availability',   // Feature 1 — calendar
    'rooms',
    'about',
    'menu',           // Dynamic widget
    'gallery',
    'contact',        // Dynamic widget (form)
    'booking',        // Dynamic widget
  ],

  // Fonts
  fonts: {
    heading: 'Playfair Display',
    body: 'Inter',
  },
}
```

### Theme Registry (`registry.ts`)

```typescript
// apps/web/src/components/themes/registry.ts

import { LuxeTheme } from './luxe'
import { MinimalTheme } from './minimal'
import { CoastalTheme } from './coastal'

export const THEME_REGISTRY = {
  luxe: LuxeTheme,
  minimal: MinimalTheme,
  coastal: CoastalTheme,
} as const

export type ThemeKey = keyof typeof THEME_REGISTRY

export function getTheme(key: string) {
  return THEME_REGISTRY[key as ThemeKey] ?? THEME_REGISTRY.luxe // fallback
}
```

### Theme Selection in Page

```typescript
// apps/web/src/app/(public)/[slug]/page.tsx

const ThemeComponent = getTheme(data.website?.templateId ?? 'luxe')
return <ThemeComponent data={data} />
```

---

## Feature 3: Dynamic Widget System

### Problem (যা solve করতে হবে)
Theme বদলালে booking form, menu, contact form এর logic হারিয়ে যায়।

### Solution: Widget Slots
Theme-এ hardcoded logic থাকবে না।
Theme শুধু **layout** define করবে + **widget slots** রাখবে।

### Widget Interface (সব widget-এ একই props structure)

```typescript
// apps/web/src/components/themes/_widgets/types.ts

export interface WidgetProps {
  slug: string            // Resort slug (API call করতে)
  primaryColor: string    // Theme color (widget-ও themed দেখাবে)
  accentColor: string
  currency: string
  className?: string      // Theme-specific wrapper class
}
```

### Theme-এ Widget ব্যবহার

```tsx
// apps/web/src/components/themes/minimal/index.tsx

import { BookingForm } from '../_widgets/BookingForm'
import { MenuWidget } from '../_widgets/MenuWidget'
import { AvailabilityCalendar } from '../_widgets/AvailabilityCalendar'

export function MinimalTheme({ data }: { data: ResortData }) {
  const widgetProps = {
    slug: data.tenant.slug,
    primaryColor: data.website.primaryColor ?? '#2d3748',
    accentColor: data.website.accentColor ?? '#ed8936',
    currency: data.tenant.currency,
  }

  return (
    <main className="font-inter">
      <MinimalHero data={data} />

      {/* Feature 1: Availability Calendar — same widget, minimal theme wrapper */}
      <section className="py-20 bg-gray-50" id="availability">
        <AvailabilityCalendar {...widgetProps} />
      </section>

      <MinimalRooms rooms={data.rooms} />

      {/* Dynamic menu widget */}
      <section className="py-20" id="restaurant">
        <MenuWidget {...widgetProps} />
      </section>

      {/* Dynamic booking form widget */}
      <section className="py-20 bg-gray-100" id="booking">
        <BookingForm {...widgetProps} rooms={data.rooms} />
      </section>
    </main>
  )
}
```

### Widget List

| Widget | File | Purpose |
|--------|------|---------|
| `AvailabilityCalendar` | `_widgets/AvailabilityCalendar.tsx` | Month calendar + room availability |
| `BookingForm` | `_widgets/BookingForm.tsx` | Full booking form with payment |
| `MenuWidget` | `_widgets/MenuWidget.tsx` | Restaurant menu + food order |
| `RestaurantOrderWidget` | `_widgets/RestaurantOrderWidget.tsx` | Cart + order placement |
| `ContactForm` | `_widgets/ContactForm.tsx` | Guest contact/inquiry form |

---

## Super Admin: Theme Management

### Admin Theme Page (`/admin/themes`) — New page

Admin panel-এ নতুন "Themes" section:

**Features:**
- সব available theme-এর list
- Preview image
- Active/Inactive toggle
- "Add New Theme" button (future: upload custom theme)
- কতজন resort use করছে সেই theme (usage count)

### Database: Theme table

```sql
-- Admin /api/admin/themes endpoint:
GET  /api/admin/themes          → সব theme list
POST /api/admin/themes          → নতুন theme add
PATCH /api/admin/themes/:id     → Activate/deactivate
DELETE /api/admin/themes/:id    → Remove theme
```

### Resort Owner: Theme Selection (`/dashboard/website`)

Owner dashboard-এ website editor-এ theme picker add হবে:

```
[ Theme Gallery ]
┌──────────┐  ┌──────────┐  ┌──────────┐
│  LUXE    │  │ MINIMAL  │  │ COASTAL  │
│ [preview]│  │ [preview]│  │ [preview]│
│ ✓ Active │  │  Select  │  │  Select  │
└──────────┘  └──────────┘  └──────────┘
```

Click → `PATCH /api/website` with `{ templateId: 'minimal' }` → page reloads with new theme

---

## Implementation Order

### Phase 1 — Availability Calendar (Priority: HIGH)
1. New API endpoint: `GET /site/:slug/availability/calendar?month=YYYY-MM`
2. `AvailabilityCalendar` widget component
3. Inject widget into existing LuxeTemplate booking section

### Phase 2 — Theme Refactor (Priority: MEDIUM)
1. Move LuxeTemplate → `themes/luxe/`
2. Create `themes/registry.ts`
3. Update `[slug]/page.tsx` to use registry
4. Create widget interfaces in `themes/_widgets/`
5. Extract BookingForm, MenuWidget from LuxeTemplate → widgets

### Phase 3 — New Themes (Priority: LOW)
1. `themes/minimal/` — Clean Minimal theme
2. `themes/coastal/` — Ocean Breeze theme
3. Owner dashboard theme picker

### Phase 4 — Admin Theme Control (Priority: LOW)
1. `Theme` DB model + migration
2. Admin `/admin/themes` page
3. Admin theme management API

---

## Key Files (Current + Planned)

| File | Status | Purpose |
|------|--------|---------|
| `apps/web/src/app/(public)/[slug]/page.tsx` | ✅ Exists | Resort public page |
| `apps/web/src/components/templates/LuxeTemplate.tsx` | ✅ Exists | Current only theme (1875 lines) |
| `apps/api/src/routes/website.ts` | ✅ Exists | Public API (has /availability) |
| `apps/web/src/components/themes/registry.ts` | 🔲 Planned | Theme registry |
| `apps/web/src/components/themes/luxe/` | 🔲 Planned | LuxeTemplate refactored |
| `apps/web/src/components/themes/_widgets/` | 🔲 Planned | Shared dynamic widgets |
| `apps/web/src/components/themes/_widgets/AvailabilityCalendar.tsx` | 🔲 Planned | Feature 1 |
| `apps/api/src/routes/website.ts` | 🔲 Enhance | Add /calendar endpoint |
| `packages/database/prisma/schema.prisma` → Theme model | 🔲 Planned | Theme registry in DB |
| `apps/web/src/app/admin/(panel)/themes/` | 🔲 Planned | Admin theme management |

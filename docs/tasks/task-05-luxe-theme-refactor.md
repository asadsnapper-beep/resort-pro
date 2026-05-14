# Task 05 — LuxeTemplate Refactor → themes/luxe/ Structure

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/theme-system` (T-03 + T-04-এর same branch)
**Estimated session:** 1 session
**Dependencies:** Task 04 ✅

---

## Context

এখন পর্যন্ত:
- `apps/web/src/components/templates/LuxeTemplate.tsx` — single big file
- `apps/web/src/components/themes/luxe/index.tsx` — শুধু re-export করছে

এই task-এ LuxeTemplate কে পুরোপুরি `themes/luxe/` folder-এ move করা হবে এবং section-এ ভাগ করা হবে।

---

## Steps

### 🔲 Step 1 — Folder structure তৈরি করো

```bash
mkdir -p apps/web/src/components/themes/luxe/sections
```

### 🔲 Step 2 — config.ts বানাও

**File:** `apps/web/src/components/themes/luxe/config.ts`

```typescript
export const luxeConfig = {
  id: 'luxe',
  name: 'Luxe Gold',
  description: 'Elegant luxury design with gold accents',
  defaultColors: {
    primary: '#1a6b5e',
    accent: '#d4a853',
  },
  sections: ['hero', 'about', 'rooms', 'availability', 'booking', 'menu', 'gallery', 'testimonials', 'contact'],
  fonts: {
    heading: 'Playfair Display',
    body: 'Inter',
  },
}
```

### 🔲 Step 3 — Section components বানাও

প্রতিটি section আলাদা file-এ:

**`sections/HeroSection.tsx`**
```typescript
import { ResortData } from '../../types'

interface HeroSectionProps {
  data: ResortData
}

export function HeroSection({ data }: HeroSectionProps) {
  // LuxeTemplate-এর hero section move করো
}
```

একইভাবে এই sections গুলো বানাও:
- `sections/AboutSection.tsx`
- `sections/RoomsSection.tsx`
- `sections/AvailabilitySection.tsx` (AvailabilityCalendar widget use করবে)
- `sections/BookingSection.tsx` (BookingForm widget use করবে)
- `sections/MenuSection.tsx` (MenuWidget use করবে)
- `sections/GallerySection.tsx`
- `sections/TestimonialsSection.tsx`
- `sections/ContactSection.tsx` (ContactForm widget use করবে)
- `sections/FooterSection.tsx`

### 🔲 Step 4 — Main LuxeTheme component বানাও

**File:** `apps/web/src/components/themes/luxe/index.tsx`

```tsx
'use client'
import { ThemeProps } from '../types'
import { luxeConfig } from './config'
import { HeroSection } from './sections/HeroSection'
import { AboutSection } from './sections/AboutSection'
import { RoomsSection } from './sections/RoomsSection'
import { AvailabilitySection } from './sections/AvailabilitySection'
import { BookingSection } from './sections/BookingSection'
import { MenuSection } from './sections/MenuSection'
import { GallerySection } from './sections/GallerySection'
import { TestimonialsSection } from './sections/TestimonialsSection'
import { ContactSection } from './sections/ContactSection'
import { FooterSection } from './sections/FooterSection'

export function LuxeTheme({ data }: ThemeProps) {
  if (!data.website) return null

  return (
    <main>
      <HeroSection data={data} />
      <AboutSection data={data} />
      <RoomsSection data={data} />
      <AvailabilitySection data={data} />
      <BookingSection data={data} />
      {/* Menu শুধু দেখাবে যদি restaurant থাকে */}
      <MenuSection data={data} />
      <GallerySection data={data} />
      <TestimonialsSection data={data} />
      <ContactSection data={data} />
      <FooterSection data={data} />
    </main>
  )
}
```

### 🔲 Step 5 — পুরনো LuxeTemplate file update করো

`apps/web/src/components/templates/LuxeTemplate.tsx` এখন শুধু re-export করবে (backward compatibility-এর জন্য):

```typescript
// Deprecated: Use themes/luxe directly
export { LuxeTheme as LuxeTemplate } from '../themes/luxe'
```

### 🔲 Step 6 — Test করো

```bash
pnpm --filter web dev
# Resort website সব section দেখা যাচ্ছে কিনা check করো
# Booking, menu, contact সব কাজ করছে কিনা
```

### 🔲 Step 7 — Commit + Push করো

```bash
git add apps/web/src/components/themes/luxe/
git add apps/web/src/components/templates/LuxeTemplate.tsx
git commit -m "feat: refactor LuxeTemplate → themes/luxe/ with section components"
```

### 🔲 Step 8 — Main-এ merge করো

```bash
git checkout main
git pull origin main
git merge feature/theme-system
git push origin main
git branch -d feature/theme-system
git push origin --delete feature/theme-system
```

### 🔲 Step 9 — PROGRESS.md update করো

- T-03, T-04, T-05 → Completed
- Current Task → T-06
- Session Log update

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/web/src/components/themes/luxe/config.ts` | নতুন তৈরি |
| `apps/web/src/components/themes/luxe/index.tsx` | Re-export থেকে full component-এ পরিণত |
| `apps/web/src/components/themes/luxe/sections/*.tsx` | নতুন তৈরি (10টি section) |
| `apps/web/src/components/templates/LuxeTemplate.tsx` | Re-export stub-এ পরিণত |

---

## Test Checklist

- [ ] Resort website সব section render হচ্ছে
- [ ] Hero, About, Rooms দেখাচ্ছে
- [ ] Availability calendar কাজ করছে
- [ ] Booking form submit হচ্ছে
- [ ] Gallery, Testimonials দেখাচ্ছে
- [ ] Footer ঠিক আছে
- [ ] TypeScript error নেই
- [ ] পুরনো LuxeTemplate import এখনো কাজ করছে (backward compat)

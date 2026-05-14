# Task 07 — Coastal Theme Build

**Plan:** [WF-02](../workflow/wf-02-theme-development.md)
**Branch:** `feature/coastal-theme`
**Estimated session:** 1-2 sessions
**Dependencies:** Task 06 ✅

---

## Context

তৃতীয় theme। Coastal theme হবে beach/ocean resort-এর জন্য — soft blues, sandy tones, organic shapes, relaxed vibe। Tropical/beachside properties-এর জন্য perfect।

Theme ID: `coastal`
Design language: Ocean-inspired colors, rounded corners, wave-like transitions, airy feel

---

## Steps

### 🔲 Step 1 — Branch তৈরি করো

```bash
git checkout main
git pull origin main
git checkout -b feature/coastal-theme
```

### 🔲 Step 2 — Folder structure তৈরি করো

```bash
mkdir -p apps/web/src/components/themes/coastal/sections
```

### 🔲 Step 3 — config.ts বানাও

**File:** `apps/web/src/components/themes/coastal/config.ts`

```typescript
export const coastalConfig = {
  id: 'coastal',
  name: 'Coastal Breeze',
  description: 'Ocean-inspired design for beach and coastal properties',
  defaultColors: {
    primary: '#0891b2',   // cyan-600
    accent: '#d97706',    // amber-600 (sandy)
  },
  sections: ['hero', 'about', 'amenities', 'rooms', 'availability', 'booking', 'gallery', 'testimonials', 'contact'],
  fonts: {
    heading: 'Merriweather',
    body: 'Inter',
  },
}
```

### 🔲 Step 4 — Section components বানাও

**`sections/HeroSection.tsx`**
- Split screen: large beach image (left 60%), resort info (right 40%)
- Animated wave SVG divider at bottom
- Coral/teal gradient overlay on image

**`sections/AboutSection.tsx`**
- Soft blue bg (`bg-cyan-50`)
- Circular image with wave border treatment
- Bullet points with wave icon markers

**`sections/AmenitiesSection.tsx`** ← Coastal-specific section
- Icon grid: Beach Access, Ocean View, Pool, Water Sports, etc.
- Soft teal icon cards

**`sections/RoomsSection.tsx`**
- Masonry-style card grid (2-3 columns)
- Card: image top, rounded-2xl, teal accent badge for room type
- "From $X/night" price tag

**`sections/AvailabilitySection.tsx`**
- `bg-gradient-to-b from-cyan-50 to-white` background
- AvailabilityCalendar widget

**`sections/BookingSection.tsx`**
- Split: beach illustration left, BookingForm right
- `bg-cyan-900 text-white` dark section for contrast

**`sections/GallerySection.tsx`**
- Masonry image grid (CSS grid, various aspect ratios)
- Hover: slight scale up with caption overlay

**`sections/TestimonialsSection.tsx`**
- Horizontal scrollable cards on mobile, grid on desktop
- Wave/quote icon in teal

**`sections/ContactSection.tsx`**
- Map-placeholder left + ContactForm right
- Beach/resort vibe colors

**`sections/FooterSection.tsx`**
- Dark teal (`bg-cyan-900 text-white`)
- Wave SVG top border
- 3-column: logo+tagline, links, contact info

### 🔲 Step 5 — Main CoastalTheme component বানাও

**File:** `apps/web/src/components/themes/coastal/index.tsx`

```tsx
import { ThemeProps } from '../types'
// ... all section imports

export function CoastalTheme({ data }: ThemeProps) {
  if (!data.website) return null
  return (
    <main className="font-sans bg-white text-slate-800 overflow-hidden">
      <HeroSection data={data} />
      <AboutSection data={data} />
      <AmenitiesSection data={data} />
      <RoomsSection data={data} />
      <AvailabilitySection data={data} />
      <BookingSection data={data} />
      <GallerySection data={data} />
      <TestimonialsSection data={data} />
      <ContactSection data={data} />
      <FooterSection data={data} />
    </main>
  )
}
```

### 🔲 Step 6 — Registry-এ register করো

**File:** `apps/web/src/components/themes/registry.ts`

```typescript
import { CoastalTheme } from './coastal'

export const THEME_REGISTRY = {
  luxe: LuxeTheme,
  minimal: MinimalTheme,
  coastal: CoastalTheme,   // ← add
}
```

### 🔲 Step 7 — DB seed update করো

```typescript
await prisma.theme.upsert({
  where: { key: 'coastal' },
  update: {},
  create: {
    key: 'coastal',
    name: 'Coastal Breeze',
    description: 'Ocean-inspired design for beach and coastal properties',
    sortOrder: 3,
  },
})
```

### 🔲 Step 8 — Preview করো

Test resort-এর `templateId` → `'coastal'` set করো।

```bash
pnpm --filter web dev
# http://localhost:3000/your-slug
```

### 🔲 Step 9 — Commit + Push + Merge

```bash
git add apps/web/src/components/themes/coastal/
git add apps/web/src/components/themes/registry.ts
git add packages/database/prisma/seed.ts
git commit -m "feat: add Coastal Breeze theme"
git checkout main
git merge feature/coastal-theme
git push origin main
git branch -d feature/coastal-theme
git push origin --delete feature/coastal-theme
```

### 🔲 Step 10 — PROGRESS.md update করো

- T-07 → Completed
- Current Task → T-08

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/web/src/components/themes/coastal/config.ts` | নতুন তৈরি |
| `apps/web/src/components/themes/coastal/index.tsx` | নতুন তৈরি |
| `apps/web/src/components/themes/coastal/sections/*.tsx` | নতুন তৈরি (10টি section) |
| `apps/web/src/components/themes/registry.ts` | `coastal` add |
| `packages/database/prisma/seed.ts` | Coastal theme seed |

---

## Color Palette Reference

```
Primary:   #0891b2  (cyan-600)  — headers, buttons, icons
Accent:    #d97706  (amber-600) — price tags, highlights
Light bg:  #ecfeff  (cyan-50)   — section backgrounds
Dark:      #164e63  (cyan-900)  — footer, dark sections
Text:      #1e293b  (slate-800) — body text
Muted:     #64748b  (slate-500) — secondary text
```

## Test Checklist

- [ ] Coastal theme দেখতে beach/ocean-inspired
- [ ] `getTheme('coastal')` → CoastalTheme
- [ ] Wave divider SVG দেখা যাচ্ছে
- [ ] Amenities section unique to coastal
- [ ] সব shared widgets কাজ করছে
- [ ] Gallery masonry grid ঠিক আছে
- [ ] Mobile responsive
- [ ] Dark footer দেখাচ্ছে
- [ ] TypeScript error নেই

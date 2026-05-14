# Task 06 — Minimal Theme Build

**Plan:** [WF-02](../workflow/wf-02-theme-development.md)
**Branch:** `feature/minimal-theme`
**Estimated session:** 1-2 sessions
**Dependencies:** Task 05 ✅

---

## Context

Luxe theme-এর পর দ্বিতীয় theme। Minimal theme হবে clean, modern, এবং content-focused। কোনো heavy decoration নেই — typography এবং whitespace-এর উপর focus।

Theme ID: `minimal`
Design language: Clean lines, lots of white space, system fonts, subtle borders

---

## Steps

### 🔲 Step 1 — Branch তৈরি করো

```bash
git checkout main
git pull origin main
git checkout -b feature/minimal-theme
```

### 🔲 Step 2 — Folder structure তৈরি করো

```bash
mkdir -p apps/web/src/components/themes/minimal/sections
```

### 🔲 Step 3 — config.ts বানাও

**File:** `apps/web/src/components/themes/minimal/config.ts`

```typescript
export const minimalConfig = {
  id: 'minimal',
  name: 'Minimal Clean',
  description: 'Clean, modern design with focus on content and whitespace',
  defaultColors: {
    primary: '#2563eb',   // blue-600
    accent: '#0f172a',    // slate-900
  },
  sections: ['hero', 'about', 'rooms', 'availability', 'booking', 'contact'],
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
}
```

### 🔲 Step 4 — Section components বানাও

**`sections/HeroSection.tsx`** — Full-width image, centered text overlay, single CTA button

**`sections/AboutSection.tsx`** — Two-column: text left, image right. Clean typography.

**`sections/RoomsSection.tsx`** — Horizontal card list (not grid). Each card: image, name, price, amenities tags.

**`sections/AvailabilitySection.tsx`** — AvailabilityCalendar widget use করো, white bg

**`sections/BookingSection.tsx`** — BookingForm widget, minimal styling

**`sections/ContactSection.tsx`** — ContactForm + address/phone info side by side

**`sections/FooterSection.tsx`** — Simple 2-line footer: resort name + links

### 🔲 Step 5 — Main MinimalTheme component বানাও

**File:** `apps/web/src/components/themes/minimal/index.tsx`

```tsx
import { ThemeProps } from '../types'
import { HeroSection } from './sections/HeroSection'
// ... all sections

export function MinimalTheme({ data }: ThemeProps) {
  if (!data.website) return null
  return (
    <main className="font-sans bg-white text-slate-900">
      <HeroSection data={data} />
      <AboutSection data={data} />
      <RoomsSection data={data} />
      <AvailabilitySection data={data} />
      <BookingSection data={data} />
      <ContactSection data={data} />
      <FooterSection data={data} />
    </main>
  )
}
```

### 🔲 Step 6 — Registry-এ register করো

**File:** `apps/web/src/components/themes/registry.ts`

```typescript
import { MinimalTheme } from './minimal'

export const THEME_REGISTRY = {
  luxe: LuxeTheme,
  minimal: MinimalTheme,   // ← add
}
```

### 🔲 Step 7 — DB seed update করো

`packages/database/prisma/seed.ts`-এ add করো:

```typescript
await prisma.theme.upsert({
  where: { key: 'minimal' },
  update: {},
  create: {
    key: 'minimal',
    name: 'Minimal Clean',
    description: 'Clean modern design with focus on whitespace and content',
    sortOrder: 2,
  },
})
```

### 🔲 Step 8 — Preview করো

একটি test resort-এর `templateId` → `'minimal'` set করো এবং দেখো।

```bash
pnpm --filter web dev
# http://localhost:3000/your-slug
```

### 🔲 Step 9 — Commit + Push + Merge

```bash
git add apps/web/src/components/themes/minimal/
git add apps/web/src/components/themes/registry.ts
git add packages/database/prisma/seed.ts
git commit -m "feat: add Minimal Clean theme"
git checkout main
git merge feature/minimal-theme
git push origin main
git branch -d feature/minimal-theme
git push origin --delete feature/minimal-theme
```

### 🔲 Step 10 — PROGRESS.md update করো

- T-06 → Completed
- Current Task → T-07

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/web/src/components/themes/minimal/config.ts` | নতুন তৈরি |
| `apps/web/src/components/themes/minimal/index.tsx` | নতুন তৈরি |
| `apps/web/src/components/themes/minimal/sections/*.tsx` | নতুন তৈরি |
| `apps/web/src/components/themes/registry.ts` | `minimal` add |
| `packages/database/prisma/seed.ts` | Minimal theme seed |

---

## Design Reference

```
[HERO] Full-width image, dark overlay, white text centered
       Resort Name (text-5xl font-bold)
       Tagline (text-xl text-white/80)
       [Check Availability] button

[ABOUT] max-w-6xl mx-auto grid grid-cols-2 gap-16 py-24
        Left: text content
        Right: image (aspect-square, rounded-sm)

[ROOMS] max-w-5xl mx-auto py-20
        Each room: flex row, image left (w-48), details right

[AVAILABILITY] bg-gray-50 py-16
               Calendar widget centered

[BOOKING] white bg, py-20, form centered max-w-lg

[CONTACT] grid-cols-2, form + contact info

[FOOTER] border-t, py-8, flex between name and links
```

## Test Checklist

- [ ] Minimal theme দেখতে clean এবং modern
- [ ] `getTheme('minimal')` → MinimalTheme
- [ ] সব sections render হচ্ছে
- [ ] Availability calendar কাজ করছে
- [ ] Booking form submit হচ্ছে
- [ ] Mobile responsive
- [ ] TypeScript error নেই

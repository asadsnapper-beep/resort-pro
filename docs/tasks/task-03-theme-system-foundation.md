# Task 03 — Theme System: Foundation (Registry + Types)

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/theme-system`
**Estimated session:** 1 session
**Dependencies:** Task 01 ✅, Task 02 ✅

---

## Context

এই task-এ theme system-এর foundation তৈরি হবে:
- Shared types define করা
- Theme registry তৈরি করা
- `[slug]/page.tsx` কে registry use করতে update করা
- `Theme` DB model add করা (admin theme management-এর জন্য)

এই task-এ কোনো নতুন theme বানানো হবে না। শুধু infrastructure।

---

## Steps

### 🔲 Step 1 — Branch তৈরি করো

```bash
git checkout main
git pull origin main
git checkout -b feature/theme-system
```

### 🔲 Step 2 — Folder structure তৈরি করো

```bash
mkdir -p apps/web/src/components/themes/_widgets
mkdir -p apps/web/src/components/themes/luxe
```

### 🔲 Step 3 — Shared types file বানাও

**File:** `apps/web/src/components/themes/types.ts`

```typescript
export interface ResortTenant {
  name: string
  slug: string
  phone?: string
  email?: string
  address?: string
  currency: string
  checkInTime: string
  checkOutTime: string
  logoUrl?: string
}

export interface ResortWebsite {
  heroTitle: string
  heroSubtitle?: string
  heroImage?: string
  aboutTitle?: string
  aboutText?: string
  aboutImage?: string
  galleryImages?: string[]
  testimonials?: { name: string; text: string; rating: number; avatar?: string }[]
  primaryColor?: string
  accentColor?: string
  templateId?: string
  seoTitle?: string
  seoDescription?: string
}

export interface ResortRoom {
  id: string
  name: string
  type: string
  number: string
  basePrice: number
  maxOccupancy: number
  floor?: number
  images: string[]
  videos: string[]
  amenities: string[]
  description?: string
}

export interface ResortData {
  tenant: ResortTenant
  website: ResortWebsite | null
  rooms: ResortRoom[]
}

// সব widget-এ এই props থাকবে
export interface WidgetProps {
  slug: string
  primaryColor: string
  accentColor: string
  currency: string
  className?: string
}

// সব theme component-এ এই props থাকবে
export interface ThemeProps {
  data: ResortData
}
```

### 🔲 Step 4 — Theme registry বানাও

**File:** `apps/web/src/components/themes/registry.ts`

```typescript
import type { ThemeProps } from './types'
import { LuxeTheme } from './luxe'
// Future themes এখানে import হবে

export const THEME_REGISTRY: Record<string, React.ComponentType<ThemeProps>> = {
  luxe: LuxeTheme,
  // minimal: MinimalTheme,
  // coastal: CoastalTheme,
}

export type ThemeKey = keyof typeof THEME_REGISTRY

export function getTheme(key?: string | null): React.ComponentType<ThemeProps> {
  if (!key) return THEME_REGISTRY.luxe
  return THEME_REGISTRY[key] ?? THEME_REGISTRY.luxe
}
```

### 🔲 Step 5 — LuxeTheme wrapper তৈরি করো

**File:** `apps/web/src/components/themes/luxe/index.tsx`

```typescript
// Existing LuxeTemplate কে re-export করো
export { LuxeTemplate as LuxeTheme } from '../../templates/LuxeTemplate'
```

> Note: এই task-এ LuxeTemplate move করা হবে না। শুধু wrapper।
> LuxeTemplate actual move হবে Task 05-এ।

### 🔲 Step 6 — Page.tsx update করো

**File:** `apps/web/src/app/(public)/[slug]/page.tsx`

```typescript
import { getTheme } from '@/components/themes/registry'

// ...existing fetchResortData function...

export default async function ResortWebsitePage({ params }: { params: { slug: string } }) {
  const data = await fetchResortData(params.slug)
  if (!data || !data.website) notFound()

  const ThemeComponent = getTheme(data.website?.templateId)
  return <ThemeComponent data={data} />
}
```

### 🔲 Step 7 — DB: Theme model যোগ করো

**File:** `packages/database/prisma/schema.prisma`

```prisma
model Theme {
  id           String   @id @default(uuid())
  key          String   @unique   // "luxe", "minimal", "coastal"
  name         String             // "Luxe Gold"
  description  String?
  previewImage String?
  isActive     Boolean  @default(true)
  isPremium    Boolean  @default(false)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())

  @@map("themes")
}
```

### 🔲 Step 8 — DB push করো

```bash
cd packages/database
npx prisma db push
npx prisma generate
cd ../..
```

### 🔲 Step 9 — Default themes seed করো

`packages/database/prisma/seed.ts`-এ add করো:
```typescript
await prisma.theme.upsert({
  where: { key: 'luxe' },
  update: {},
  create: { key: 'luxe', name: 'Luxe Gold', description: 'Elegant luxury design with gold accents', sortOrder: 1 },
})
```

### 🔲 Step 10 — Test করো

```bash
pnpm --filter web dev
# Resort website এখনো LuxeTemplate-এ দেখাচ্ছে কিনা check করো
# http://localhost:3000/your-slug
```

### 🔲 Step 11 — Commit + Push

```bash
git add apps/web/src/components/themes/
git add apps/web/src/app/\(public\)/\[slug\]/page.tsx
git add packages/database/prisma/schema.prisma
git commit -m "feat: theme system foundation — registry, types, DB model"
git push origin feature/theme-system
```

### 🔲 Step 12 — PROGRESS.md update করো

- T-03 → Completed
- Current Task → T-04

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/web/src/components/themes/types.ts` | নতুন তৈরি |
| `apps/web/src/components/themes/registry.ts` | নতুন তৈরি |
| `apps/web/src/components/themes/luxe/index.tsx` | নতুন তৈরি (wrapper) |
| `apps/web/src/app/(public)/[slug]/page.tsx` | Registry use করতে update |
| `packages/database/prisma/schema.prisma` | Theme model add |
| `packages/database/prisma/seed.ts` | Default themes seed |

---

## Test Checklist

- [ ] Resort website এখনো ঠিকমতো দেখাচ্ছে (regression নেই)
- [ ] `getTheme('luxe')` → LuxeTemplate return করছে
- [ ] `getTheme(undefined)` → LuxeTemplate (fallback) return করছে
- [ ] `getTheme('nonexistent')` → LuxeTemplate (fallback) return করছে
- [ ] DB-তে themes table তৈরি হয়েছে
- [ ] TypeScript error নেই

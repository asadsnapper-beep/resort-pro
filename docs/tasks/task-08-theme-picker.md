# Task 08 — Owner Dashboard: Theme Picker UI

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/theme-picker`
**Estimated session:** 1 session
**Dependencies:** Task 07 ✅

---

## Context

Resort owner dashboard-এ website settings page-এ একটি theme picker add করা হবে। Owner সেখান থেকে তাদের resort-এর theme select করতে পারবে। Selection save হলে public website সেই theme-এ render হবে।

---

## Steps

### 🔲 Step 1 — Branch তৈরি করো

```bash
git checkout main
git pull origin main
git checkout -b feature/theme-picker
```

### 🔲 Step 2 — API endpoint যোগ করো (available themes list)

**File:** `apps/api/src/routes/website.ts`

```typescript
// GET /site/:slug/themes — available active themes list
router.get('/:slug/themes', async (req, reply) => {
  const themes = await prisma.theme.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { key: true, name: true, description: true, previewImage: true, isPremium: true },
  })
  return reply.send({ success: true, data: themes })
})
```

### 🔲 Step 3 — Frontend: ThemePicker component বানাও

**File:** `apps/web/src/components/dashboard/website/ThemePicker.tsx`

```typescript
'use client'
interface Theme {
  key: string
  name: string
  description: string
  previewImage?: string
  isPremium: boolean
}

interface ThemePickerProps {
  currentTheme: string
  onSelect: (key: string) => void
  slug: string
}

export function ThemePicker({ currentTheme, onSelect, slug }: ThemePickerProps) {
  // Fetch themes from /site/:slug/themes
  // Show theme cards in a grid (2-3 columns)
  // Each card: preview image (or placeholder), theme name, description, Premium badge
  // Selected card: ring-2 ring-primary
  // Click → onSelect(key)
}
```

**UI Layout:**
```
┌────────────────────────────────────────────────────┐
│  Choose Your Website Theme                          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ [preview]│  │ [preview]│  │ [preview]│         │
│  │          │  │          │  │          │         │
│  │ Luxe Gold│  │  Minimal │  │ Coastal  │         │
│  │ ✓ Active │  │          │  │  Breeze  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  💡 Your website updates immediately after saving.  │
└────────────────────────────────────────────────────┘
```

### 🔲 Step 4 — Website Settings page-এ inject করো

**File:** `apps/web/src/app/(dashboard)/dashboard/website/page.tsx`

ThemePicker add করো existing website settings form-এর উপরে:

```tsx
import { ThemePicker } from '@/components/dashboard/website/ThemePicker'

// Form-এর উপরে:
<div className="mb-8">
  <ThemePicker
    currentTheme={websiteData?.templateId ?? 'luxe'}
    slug={tenant.slug}
    onSelect={(key) => {
      setFormData(prev => ({ ...prev, templateId: key }))
    }}
  />
</div>
```

### 🔲 Step 5 — Save করলে templateId update হচ্ছে কিনা নিশ্চিত করো

Website settings save API (`PUT /dashboard/website`) যেন `templateId` field save করে। Existing implementation check করো।

### 🔲 Step 6 — Preview button যোগ করো

Theme card-এ "Preview" button যোগ করো যেটা click করলে নতুন tab-এ public website খুলবে:

```tsx
<a
  href={`/${slug}?preview_theme=${theme.key}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xs text-blue-600 hover:underline"
>
  Preview →
</a>
```

> Note: `?preview_theme` query param support পরে add করা যাবে। এখনকের জন্য শুধু site URL-এ নিয়ে যাবে।

### 🔲 Step 7 — Test করো

```bash
pnpm --filter web dev
# Dashboard: http://localhost:3000/dashboard/website
# Theme picker দেখা যাচ্ছে কিনা
# Theme select করে save করো
# Public site reload করলে নতুন theme দেখাচ্ছে কিনা
```

### 🔲 Step 8 — Commit + Push + Merge

```bash
git add apps/web/src/components/dashboard/website/ThemePicker.tsx
git add apps/web/src/app/\(dashboard\)/dashboard/website/page.tsx
git add apps/api/src/routes/website.ts
git commit -m "feat: theme picker UI in owner dashboard website settings"
git checkout main
git merge feature/theme-picker
git push origin main
git branch -d feature/theme-picker
git push origin --delete feature/theme-picker
```

### 🔲 Step 9 — PROGRESS.md update করো

- T-08 → Completed
- Current Task → T-09

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/api/src/routes/website.ts` | Available themes endpoint add |
| `apps/web/src/components/dashboard/website/ThemePicker.tsx` | নতুন তৈরি |
| `apps/web/src/app/(dashboard)/dashboard/website/page.tsx` | ThemePicker inject |

---

## Test Checklist

- [ ] Theme list API কাজ করছে
- [ ] Theme cards grid দেখা যাচ্ছে
- [ ] Current theme selected (ring) দেখাচ্ছে
- [ ] Theme click করলে selection change হচ্ছে
- [ ] Save করলে API-তে `templateId` যাচ্ছে
- [ ] Public site নতুন theme-এ দেখাচ্ছে
- [ ] Premium badge দেখাচ্ছে (যদি premium theme থাকে)
- [ ] Mobile-এ ঠিক দেখাচ্ছে

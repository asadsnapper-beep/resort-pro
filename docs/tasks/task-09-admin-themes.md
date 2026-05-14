# Task 09 — Admin Panel: Theme Management Page

**Plan:** [Part 04B](../plan/part-04b-public-website-advanced.md)
**Branch:** `feature/admin-themes`
**Estimated session:** 1 session
**Dependencies:** Task 08 ✅

---

## Context

Super admin dashboard-এ একটি theme management page তৈরি হবে। Admin এখান থেকে:
- Available themes দেখতে পাবে
- Theme activate/deactivate করতে পারবে
- Theme-এর name, description, previewImage, isPremium, sortOrder edit করতে পারবে
- নতুন theme key register করতে পারবে (code এ already implement করা থাকলে)

---

## Steps

### 🔲 Step 1 — Branch তৈরি করো

```bash
git checkout main
git pull origin main
git checkout -b feature/admin-themes
```

### 🔲 Step 2 — Admin API endpoints যোগ করো

**File:** `apps/api/src/routes/admin.ts`

```typescript
// GET /api/admin/themes
router.get('/themes', async (req, reply) => {
  const themes = await prisma.theme.findMany({ orderBy: { sortOrder: 'asc' } })
  return reply.send({ success: true, data: themes })
})

// PUT /api/admin/themes/:key
router.put('/themes/:key', async (req, reply) => {
  const { key } = req.params as { key: string }
  const { name, description, previewImage, isActive, isPremium, sortOrder } = req.body as any
  const theme = await prisma.theme.upsert({
    where: { key },
    update: { name, description, previewImage, isActive, isPremium, sortOrder },
    create: { key, name, description, previewImage, isActive: isActive ?? true, isPremium: isPremium ?? false, sortOrder: sortOrder ?? 99 },
  })
  return reply.send({ success: true, data: theme })
})

// DELETE /api/admin/themes/:key  (soft: isActive = false)
router.patch('/themes/:key/toggle', async (req, reply) => {
  const { key } = req.params as { key: string }
  const theme = await prisma.theme.findUnique({ where: { key } })
  if (!theme) return reply.status(404).send({ success: false, error: 'Theme not found' })
  const updated = await prisma.theme.update({
    where: { key },
    data: { isActive: !theme.isActive },
  })
  return reply.send({ success: true, data: updated })
})
```

### 🔲 Step 3 — Admin API lib update করো

**File:** `apps/web/src/lib/admin-api.ts`

```typescript
// Theme management
getThemes: () => adminAxios.get('/admin/themes'),
updateTheme: (key: string, data: Partial<Theme>) => adminAxios.put(`/admin/themes/${key}`, data),
toggleTheme: (key: string) => adminAxios.patch(`/admin/themes/${key}/toggle`),
```

### 🔲 Step 4 — Admin themes page বানাও

**File:** `apps/web/src/app/admin/(panel)/themes/page.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  🎨 Theme Management                    [+ Add Theme]    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Luxe Gold          [Active ✓] [Premium: No]       │   │
│  │ Elegant luxury design with gold accents           │   │
│  │ Sort: 1    [Edit] [Deactivate]                    │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Minimal Clean      [Active ✓] [Premium: No]       │   │
│  │ ...                                               │   │
│  │ Sort: 2    [Edit] [Deactivate]                    │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Coastal Breeze     [Active ✓] [Premium: No]       │   │
│  │ ...                                               │   │
│  │ Sort: 3    [Edit] [Deactivate]                    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Edit mode (inline):**
- Click [Edit] → row expands to show editable fields
- Fields: name, description, previewImage URL, isPremium toggle, sortOrder
- [Save] [Cancel] buttons

**Add Theme:**
- Modal/drawer: key (slug), name, description, previewImage URL, isPremium, sortOrder
- Note: key must match registry.ts entry

### 🔲 Step 5 — Admin nav-এ link যোগ করো

**File:** `apps/web/src/app/admin/(panel)/layout.tsx`

```typescript
import { Palette } from 'lucide-react'

// navItems-এ add করো:
{ href: '/admin/themes', label: 'Themes', icon: Palette },
```

### 🔲 Step 6 — Usage stats যোগ করো (optional enhancement)

Theme list-এ প্রতিটি theme কতটি resort ব্যবহার করছে দেখাও:

```typescript
// Admin themes API-এ add:
const themesWithCount = await prisma.$queryRaw`
  SELECT t.*, COUNT(w.id) as usage_count
  FROM themes t
  LEFT JOIN website_data w ON w."templateId" = t.key
  GROUP BY t.id
  ORDER BY t."sortOrder"
`
```

> Note: `website_data` table নাম confirm করো schema থেকে।

### 🔲 Step 7 — Test করো

```bash
pnpm --filter web dev
# Admin: http://localhost:3000/admin/themes
# Theme list দেখা যাচ্ছে কিনা
# Edit করে save হচ্ছে কিনা
# Toggle করলে active/inactive হচ্ছে কিনা
```

### 🔲 Step 8 — Commit + Push + Merge

```bash
git add apps/api/src/routes/admin.ts
git add apps/web/src/lib/admin-api.ts
git add apps/web/src/app/admin/\(panel\)/themes/
git add apps/web/src/app/admin/\(panel\)/layout.tsx
git commit -m "feat: admin theme management page with CRUD operations"
git checkout main
git merge feature/admin-themes
git push origin main
git branch -d feature/admin-themes
git push origin --delete feature/admin-themes
```

### 🔲 Step 9 — PROGRESS.md update করো

- T-09 → Completed
- Part 04B সম্পূর্ণ!
- Current Task → T-10 (বা নতুন planning)
- Session Log update

---

## Files to Touch

| File | Action |
|------|--------|
| `apps/api/src/routes/admin.ts` | Theme CRUD endpoints add |
| `apps/web/src/lib/admin-api.ts` | Theme API functions add |
| `apps/web/src/app/admin/(panel)/themes/page.tsx` | নতুন তৈরি |
| `apps/web/src/app/admin/(panel)/layout.tsx` | Themes nav link add |

---

## Test Checklist

- [ ] Admin themes page accessible (`/admin/themes`)
- [ ] All themes listed (luxe, minimal, coastal)
- [ ] Edit → form দেখা যাচ্ছে → save হচ্ছে
- [ ] Toggle activate/deactivate কাজ করছে
- [ ] Deactivated theme owner dashboard-এ দেখা যাচ্ছে না
- [ ] Palette icon nav-এ দেখা যাচ্ছে
- [ ] TypeScript error নেই

---

## 🎉 Part 04B Complete!

T-09 শেষ হলে Part 04B (Public Website Advanced) পুরোপুরি complete:
- ✅ Availability Calendar (API + Widget)
- ✅ Theme System Foundation (Registry + Types)
- ✅ Shared Widgets (BookingForm, MenuWidget, ContactForm)
- ✅ LuxeTemplate Refactor
- ✅ Minimal Theme
- ✅ Coastal Theme
- ✅ Owner Theme Picker
- ✅ Admin Theme Management

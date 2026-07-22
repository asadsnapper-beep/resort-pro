# ResortPro — Dashboard Design System Audit

> এই ডকটা একজন designer-কে দিলে সে বুঝতে পারবে কোন design elements আছে,
> কীভাবে কাজ করছে, এবং কোথায় inconsistency আছে।

**Stack:** Next.js 14 App Router · Tailwind CSS · shadcn/ui (partial) · Lucide icons

---

## 1. Color Tokens

### Brand Palette (tailwind.config.ts)

| Token | Hex | Usage |
|-------|-----|-------|
| `resort-50` | `#f0f9f7` | Active nav bg (light sidebar) |
| `resort-100` | `#d9f0ec` | Avatar bg, subtle fills |
| `resort-200` | `#b6e2da` | Hover fills |
| `resort-300` | `#84ccc0` | — |
| `resort-400` | `#50b09f` | — |
| `resort-500` | `#309485` | Focus rings |
| `resort-600` | `#23766a` | **Primary buttons, links, icons** |
| `resort-700` | `#1e5f57` | Hover state of buttons |
| `resort-800` | `#1a4d47` | — |
| `resort-900` | `#19403b` | **Sidebar bg, dark sections, headlines** |
| `gold-400` | `#f0c55a` | Logo accent, owner badge text |
| `gold-500` | `#d4a853` | **Active sidebar bar, landing accents** |
| `gold-600` | `#b8893f` | Hover gold |

### CSS Variables (globals.css)
shadcn/ui এর HSL variable system use করছে। Light mode + dark mode আলাদা আলাদা define করা।

| Variable | Light | Dark | Usage |
|----------|-------|------|-------|
| `--background` | white | near-black | Page bg |
| `--foreground` | dark | white | Text |
| `--primary` | resort-600 hsl | resort-400 hsl | Primary action |
| `--radius` | `0.75rem` | same | Border radius base |
| `--border` | light gray | dark gray | All borders |

> ⚠️ **Inconsistency:** Dashboard pages mix hardcoded hex (`#1a6b5e`) with tailwind tokens (`resort-600`) and CSS variables (`text-primary`). Designer should standardize to tokens only.

---

## 2. Typography

### Fonts (loaded via Google Fonts)
| Font | Weight | Usage |
|------|--------|-------|
| **Playfair Display** | 400, 500, 600, 700 | Headlines, hotel name in sidebar, landing page H1 |
| **Inter** | 300–700 | All body text, nav labels, UI elements |

### Class: `font-display` → Playfair Display
### Class: `font-sans` → Inter

### Scale in use (dashboard)
| Element | Size | Weight | Font |
|---------|------|--------|------|
| Sidebar hotel name | `text-[15px]` | 500 | Playfair |
| Nav group label | `text-[9px]` | 600 | Inter |
| Nav item label | `text-[13.5px]` | 500 | Inter |
| Page titles (e.g. "Bookings") | `text-2xl` / `text-3xl` | 600–700 | Inter |
| Stat card value | `text-3xl` / `text-4xl` | 700 | Inter |
| Table header | `text-xs uppercase tracking-wide` | 500 | Inter |
| Table cell | `text-sm` | 400 | Inter |
| Badge/chip | `text-xs` | 600 | Inter |

> ⚠️ **Gap:** Dashboard page titles use Inter bold, NOT Playfair. Landing page uses Playfair for headlines. Should standardize — page titles in Playfair would match the premium feel.

---

## 3. Layout Shell

### File: `app/(dashboard)/layout.tsx`

```
h-screen overflow-hidden bg-[#f5f4f1]
├── Sidebar (hidden on mobile, w-60 on md+)
└── Main column (flex-1)
    ├── TopNav (h-13, bg-white, border-b)
    ├── OfflineBar (conditional)
    └── Main content (flex-1 overflow-y-auto p-4 md:p-6)
        ├── ImpersonationBanner
        ├── DemoBanner
        ├── PlatformBanner
        └── {page content}

Mobile (< md):
└── Bottom tab bar (fixed h-16 bg-resort-900, 5 tabs)
```

### Content max-width
None set globally — each page defines its own. Most pages use full-width with `gap` grids.

---

## 4. Sidebar (`components/dashboard/sidebar.tsx`)

**Background:** `bg-resort-900` (dark green, `#19403b`)

### Structure
```
w-60 h-full flex-col bg-resort-900

Header (h-14, border-b border-white/8)
├── LogoMark: 32px circle (bg-resort-600) + 11px dot ring (border gold-500)
├── Hotel name: Playfair 15px font-medium text-white
└── Plan/role: 11px text-[#8fa8a1]

Nav (flex-1, overflow-y-auto scrollbar-hide, py-2)
├── Group label: 9px uppercase tracking-[0.18em] text-[#7f938e]
└── Nav item:
    ├── Inactive: text-[#c2d0cb], border-l-2 border-transparent
    ├── Active:   text-white bg-white/8, border-l-2 border-gold-500 (GOLD LEFT BAR)
    └── Hover:    bg-white/5

Help & Language switcher (px-2 pb-2)

User footer (border-t border-white/8, p-3)
├── Avatar: 32px circle bg-resort-600, white initials
├── Name: 13px text-white
├── Role badge OR plan label
└── Logout icon: text-[#8fa8a1]
```

### Nav Groups & Items (role-filtered)
| Group | Items |
|-------|-------|
| Overview | Dashboard · Analytics · Invoices · Expenses · Reports |
| Rooms & Bookings | Rooms · Rate Plans · Packages · Front Desk · Bookings · Calendar · Group Bookings · Channel Sync |
| Guests | Guests · Loyalty · Support |
| Operations | Staff · Housekeeping · Maintenance |
| Restaurant | Restaurant · F&B Orders · Tables · Inventory |
| Marketing | Offers · CRM & Email · SMS Marketing · Website · AI Content |
| Account | Billing · Referrals · Settings |

Groups are **collapsible** — click group label to collapse.

---

## 5. Top Nav (`components/dashboard/top-nav.tsx`)

```
h-13 bg-white border-b border-resort-900/10

Left:
└── Search bar (rounded-full, bg-[#f5f4f1], border-resort-900/10)
    ├── Search icon (text-[#8fa8a1] 14px)
    └── Input placeholder: "Search rooms, bookings, guests..."
    ⚠️ NOT FUNCTIONAL — UI only, no search results

Right:
├── ElectronStatusBadge (desktop app only)
├── Dark mode toggle (Moon/Sun icon, h-8 w-8)
└── Bell icon + unread count badge (red circle)

Conditional banner above nav:
└── TrialBanner — shown when trial expires in ≤7 days
    Red/amber/blue color based on urgency
```

> ⚠️ **Gap:** Search is currently non-functional. No user avatar/profile quick-access in top nav.

---

## 6. UI Components (`components/ui/`)

### Button (`button.tsx`)
Built with `cva` + radix Slot.

| Variant | Style |
|---------|-------|
| `default` | `bg-primary` (resort-600) white text |
| `destructive` | Red bg |
| `outline` | Border + white bg |
| `secondary` | Gray bg |
| `ghost` | Transparent, hover gray |
| `link` | Underline on hover |
| `gold` | `bg-gold-500 text-resort-900` — premium action |

| Size | Height |
|------|--------|
| `sm` | h-8 |
| `default` | h-9 |
| `lg` | h-10 |
| `xl` | h-12 |
| `icon` | h-9 w-9 square |

Button has built-in `loading` prop — shows spinner.

### Badge (`badge.tsx`)
`rounded-full` chips.

| Variant | Color |
|---------|-------|
| `default` | Primary (resort-600) |
| `secondary` | Gray |
| `destructive` | Red |
| `success` | Green |
| `warning` | Yellow |
| `info` | Blue |
| `outline` | Border only |

**StatusBadge** component maps DB enum values (AVAILABLE, CONFIRMED, CHECKED_IN etc.) to badge variants automatically.

### Card (`card.tsx`)
`rounded-xl border bg-card shadow-sm` — standard white card.
Sub-components: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

### Input (`input.tsx`)
Standard text input. No custom resort styling — uses `--border` CSS variable.

### Modal (`modal.tsx`)
Custom modal component. Fixed overlay + centered content box.

### Toast (`toast.tsx` + `toaster.tsx`)
Radix Toast. Used for success/error notifications. Positioned bottom-right.

---

## 7. Status Badge Color Map

Used across bookings, rooms, housekeeping, maintenance:

| Status | Color |
|--------|-------|
| AVAILABLE, CONFIRMED, CHECKED_IN, COMPLETED, RESOLVED, PAID | 🟢 Green |
| OCCUPIED, IN_PROGRESS | 🔵 Blue |
| PENDING, MAINTENANCE, PARTIAL | 🟡 Yellow |
| OPEN | 🔴 Red |
| CANCELLED, NO_SHOW, FAILED | 🔴 Red |
| CHECKED_OUT, CLOSED, SKIPPED, REFUNDED | ⚫ Gray |

---

## 8. Page Patterns (Common across dashboard pages)

### Page Header (no shared component — repeated manually)
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
    <p className="text-sm text-gray-500">Subtitle</p>
  </div>
  <Button>+ Action</Button>
</div>
```
> ⚠️ No shared `<PageHeader>` component — each page writes this manually. Should be extracted.

### Stat Cards (Dashboard overview page)
Colorful icon squares (48px, rounded-xl) + big number + label.
8 cards in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
> ⚠️ Icon bg colors are inconsistent — green, purple, blue, orange, red etc. without a system.

### Data Tables
Most pages (Bookings, Guests, Rooms etc.) use a custom table pattern:
```
bg-white rounded-xl border overflow-hidden
├── Table header: text-xs uppercase tracking-wide text-gray-500 bg-gray-50
├── Table rows: hover:bg-gray-50, border-b border-gray-100
└── Empty state: centered icon + message
```
No shared table component — each page builds its own.

### Filter Bar (above tables)
Search input + status dropdown + date picker (varies by page).
No consistent filter component shared between pages.

### Sheet / Slide-over
Used for: booking details, guest profiles.
Opens from the right, `w-[480px]` or `w-[600px]`.
Custom implementation (not radix Sheet).

### Loading States
Each page shows a spinner (manual) during initial data fetch.
Some pages use skeleton loaders, some don't — inconsistent.

---

## 9. Animations

| Name | Definition | Usage |
|------|-----------|-------|
| `animate-fade-in` | opacity 0→1 + translateY 8px→0, 0.3s ease-out | Page content on load |
| `animate-spin` | standard rotation | Loading spinners |
| `animate-pulse` | shadcn/tailwind pulse | Skeleton loaders (some pages) |
| `accordion-down/up` | height transition | Sidebar group collapse |

---

## 10. Dark Mode

Dark mode class-based (`class` strategy). Toggle button in TopNav.

Current state:
- Sidebar: already dark (`bg-resort-900`) — dark mode has no effect on it
- TopNav: `dark:border-white/8 dark:bg-resort-900/60`
- Page content: uses CSS variables that adapt (`bg-background`, `text-foreground`)
- Cards: `bg-card` adapts automatically
- Many hardcoded colors (e.g. `text-gray-900`, `bg-gray-50`) do NOT adapt to dark mode

> ⚠️ Dark mode is **partially broken** — pages with hardcoded gray colors will look wrong in dark mode.

---

## 11. Mobile (Responsive)

| Breakpoint | Behavior |
|------------|----------|
| `< md` (< 768px) | Sidebar hidden, bottom tab bar shown (5 tabs) |
| `md` (768px+) | Sidebar visible, no bottom tab bar |
| `lg` (1024px+) | Full layout |

Bottom tab bar tabs: Home · Bookings · Front Desk · F&B · More (links to Calendar)
> ⚠️ "More" tab links to `/dashboard/calendar` — not a proper "more menu". Should open a full nav slide-over.

Content padding: `p-4 md:p-6` — stacks on mobile but most pages' tables need horizontal scroll on small screens.

---

## 12. What's Missing / Needs Design Work

| Item | Priority | Notes |
|------|----------|-------|
| Global Search (Command Palette) | High | Brief written in `plan/global-search.md` |
| `<PageHeader>` shared component | Medium | Each page reinvents it |
| Dark mode fixes | Medium | Hardcoded grays break in dark |
| Stat card icon system | Low | Colors are random — need a system |
| Shared filter/table components | Medium | Too much duplication |
| Mobile "More" menu (slide-over) | Medium | Currently just links to Calendar |
| Notification panel | Medium | Bell icon has no panel — just a badge count |
| User profile quick-access | Low | No avatar/menu in top nav |
| Skeleton loading consistency | Low | Some pages have it, some don't |
| Focus rings / accessibility | Low | Not consistently visible |

---

## 13. Icon Library

**Lucide React** — used everywhere in dashboard.
All icons are `h-4 w-4` or `h-5 w-5`. Color inherited from parent text color.

Common icons in use:
`LayoutDashboard` · `BedDouble` · `CalendarDays` · `Users` · `UserCog` · `Sparkles` · `ClipboardList` · `UtensilsCrossed` · `ShoppingBag` · `Package` · `Ticket` · `Globe` · `Bell` · `Settings` · `LogOut` · `Search` · `Moon` · `Sun` · `Printer` · `ChevronDown` · `LifeBuoy`

---

## 14. File Map (Design-relevant files)

```
apps/web/src/
├── app/
│   ├── globals.css                    ← CSS variables, font import
│   └── (dashboard)/
│       ├── layout.tsx                 ← Shell: sidebar + topnav + mobile tab bar
│       └── dashboard/
│           ├── page.tsx               ← Overview: stat cards, arrivals, charts
│           ├── bookings/page.tsx      ← Table + BookingDetailSheet
│           ├── guests/page.tsx        ← Guest table + profile sheet
│           ├── rooms/page.tsx         ← Room grid/table
│           ├── calendar/page.tsx      ← Booking calendar (drag-drop)
│           ├── front-desk/page.tsx    ← Check-in/check-out workflow
│           ├── invoices/page.tsx      ← Invoice list + PDF view
│           ├── analytics/page.tsx     ← Charts (Recharts)
│           └── settings/page.tsx      ← Tenant settings form
├── components/
│   ├── dashboard/
│   │   ├── sidebar.tsx               ← Dark nav, gold accent bar
│   │   ├── top-nav.tsx               ← Search bar (UI only), bell, dark toggle
│   │   ├── DemoBanner.tsx            ← Yellow banner for demo mode
│   │   ├── ImpersonationBanner.tsx   ← Admin impersonation warning
│   │   ├── OfflineBar.tsx            ← Electron offline indicator
│   │   └── PlatformBanner.tsx        ← "You're on web" hint
│   ├── ui/
│   │   ├── button.tsx                ← 6 variants, 5 sizes, loading state
│   │   ├── badge.tsx + StatusBadge   ← 7 variants + auto status mapping
│   │   ├── card.tsx                  ← Standard white card
│   │   ├── input.tsx                 ← Basic text input
│   │   ├── modal.tsx                 ← Custom modal/dialog
│   │   └── toast.tsx + toaster.tsx   ← Notification toasts
│   └── bookings/
│       ├── BookingDetailSheet.tsx    ← Right slide-over (biggest component)
│       └── PrintReceiptButton.tsx    ← QZ Tray / browser print dropdown
└── tailwind.config.ts                ← All color tokens, fonts, animations
```

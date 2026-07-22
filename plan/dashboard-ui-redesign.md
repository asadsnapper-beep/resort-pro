# ResortPro — Dashboard UI Redesign Brief

**Goal:** A refined, elegant, mobile-first dashboard that feels like a premium SaaS product.
Same visual DNA as the redesigned landing page — calm, confident, resort-themed —
but optimised for daily operational use. Fast to navigate, easy on the eyes during long shifts.

**Design north star:** *"5-star hotel lobby meets power tool."*
Clean enough to feel luxury, functional enough for a busy front-desk team.

---

## 1. Visual System (mirror landing page tokens)

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Primary | `resort-600` | `#23766a` | Active nav, buttons, badges |
| Deep | `resort-900` | `#19403b` | Sidebar background |
| Accent | `gold-500` | `#d4a853` | Logo dot, owner badge, key highlights |
| Canvas | `#f5f4f1` | warm gray | Main content background (replaces `bg-gray-50`) |
| Surface | `white` | `#ffffff` | Cards, panels |
| Sidebar text | `#c2d0cb` | muted sage | Inactive nav labels |
| Sidebar active | `white` | — | Active nav label |
| Border | `resort-900/12` | — | Hairline dividers, card rings |

> **Key shift:** Sidebar goes **dark** (`bg-resort-900`) with white/sage text.
> This is the standard pattern for premium SaaS (Linear, Vercel, Notion).
> Content area stays light (warm canvas). The contrast anchors the layout.

### Typography (same rules as landing page)
- **Logo / Hotel name:** `font-display` (Playfair Display), `text-[17px]`
- **Nav group labels:** `text-[9px] uppercase tracking-[0.18em]`, `text-resort-900/40` (on dark: `#7f938e`)
- **Nav items:** `Inter text-[13.5px] font-medium`
- **Page titles:** `font-display text-2xl font-semibold text-resort-900`
- **Card headings:** `Inter text-sm font-semibold text-gray-900`
- **Body / labels:** `Inter text-sm text-gray-500`

---

## 2. Layout (Mobile-First)

### Mobile (`< md`, < 768px)
- **No sidebar** — hidden entirely
- **Bottom tab bar** (fixed, `h-16`, `bg-resort-900`) with 5 most-used icons:
  - Dashboard · Bookings · Front Desk · Restaurant · Menu (opens slide-over)
- **Top bar:** Logo left · Hotel name · Bell + Avatar right (no search bar — tap to open)
- **Content:** full-width, `px-4 pt-4 pb-24` (padding-bottom clears tab bar)
- **Slide-over menu** (full nav): swipes in from left, `w-[280px]`, same dark sidebar style

### Tablet (`md–lg`, 768px–1199px)
- **Icon-only sidebar**, `w-16`, dark `bg-resort-900`
- Icons at 20px, centered, `rounded-xl` active highlight in `resort-600`
- Hover: tooltip shows label on right
- Group dividers as thin hairlines
- Top nav: search + bell + avatar

### Desktop (`≥ lg`, 1200px+)
- **Full sidebar**, `w-[240px]`, dark `bg-resort-900`
- Logo + hotel name at top
- Nav groups with collapsible sections
- User card at bottom
- Top nav: search bar + dark mode toggle + bell + avatar

---

## 3. Component Specs

### Sidebar (dark, resort-900)

```
bg-resort-900
├── Header (h-16, px-5, border-b border-white/8)
│   ├── LogoMark (circle with gold dot, 32px)  — same as landing page
│   ├── Hotel name (Playfair, 17px, text-white)
│   └── Plan chip (xs, gold-500/20 bg, text-gold-400) — OWNER only
│
├── Nav (flex-1, overflow-y-auto, py-3)
│   ├── Group label (9px, uppercase, tracking, text-[#7f938e])
│   └── Nav item
│       ├── inactive: icon text-[#8fa8a1], label text-[#c2d0cb]
│       ├── active: bg-white/8, icon text-white, label text-white
│       │          left border-2 border-gold-500 (gold left accent bar)
│       └── hover:  bg-white/5
│
└── User footer (border-t border-white/8, p-4)
    ├── Avatar circle (resort-600 bg, white initials)
    ├── Name (text-white, 13px)
    ├── Role badge (colored, per-role)
    └── Logout icon (text-[#8fa8a1], hover:text-white)
```

**Gold left accent bar on active item** — this is the key visual signature.
`border-l-2 border-gold-500` on the active link, combined with `rounded-r-lg` on right side only.

### Top Nav

```
bg-white border-b border-resort-900/10 h-14
├── Left: [Mobile only] hamburger → opens slide-over
├── Center: Search bar (rounded-full, bg-[#f5f4f1], border-resort-900/10)
│           placeholder: "Search rooms, bookings, guests…"
└── Right: dark-mode toggle · bell (with badge) · avatar
```

- Search bar on mobile: icon-only button → expands to full overlay
- Avatar: `h-8 w-8 rounded-full bg-resort-100 text-resort-700` (initials)

### Page Header (inside `<main>`)

Replace current implicit headers with a consistent component:

```tsx
<PageHeader
  title="Bookings"           // font-display, text-2xl
  subtitle="Manage all reservations"  // text-sm text-gray-500, optional
  actions={<Button>+ New booking</Button>}
/>
```

`border-b border-resort-900/8 pb-5 mb-6`

### Stat Cards (Dashboard overview)

```
bg-white rounded-2xl border border-resort-900/8 p-5 shadow-sm
├── Label (text-xs uppercase tracking-wide text-gray-400)
├── Value (font-display text-3xl text-resort-900)
├── Delta (text-sm, green/red arrow + %)
└── Sparkline (optional, 40px tall, resort-600)
```

4-column grid on desktop, 2-col on tablet, 1-col on mobile.

### Cards

- `bg-white rounded-2xl border border-resort-900/8 shadow-sm`
- Header: `border-b border-resort-900/8 px-5 py-4`
- Body: `p-5`
- Hover (clickable cards): `hover:shadow-md hover:border-resort-600/20 transition-all`

---

## 4. Mobile Bottom Tab Bar

```
fixed bottom-0 left-0 right-0
h-16 bg-resort-900 border-t border-white/8
safe-area padding (pb-safe)

5 tabs: Dashboard · Bookings · Front Desk · Restaurant · More
- inactive: icon text-[#8fa8a1], label text-[10px] text-[#8fa8a1]
- active:   icon text-gold-400, label text-[10px] text-gold-400, dot above icon
```

**"More" tab** opens a bottom sheet / slide-over with the full nav tree.

---

## 5. Motion & Interaction

- **Page transitions:** `animate-fade-in` (already in system, keep it)
- **Sidebar hover:** `transition-colors duration-150`
- **Active item:** no jump/bounce — just instant color change + left bar
- **Mobile slide-over:** `transform translate-x transition-transform duration-200 ease-out`
- **Card hover:** `transition-shadow duration-200`
- **No skeleton loaders visible longer than 400ms** — use `suspense` boundaries tightly

---

## 6. Files to Change

| File | Change |
|------|--------|
| `components/dashboard/sidebar.tsx` | Full redesign — dark theme, gold accent bar, LogoMark, responsive |
| `components/dashboard/top-nav.tsx` | Slim to `h-14`, warm border, mobile hamburger, search pill |
| `app/(dashboard)/layout.tsx` | Add mobile bottom tab bar, slide-over nav state, responsive flex |
| `app/(dashboard)/dashboard/page.tsx` | Stat cards redesign, page header component |
| `components/dashboard/PageHeader.tsx` | NEW — consistent page header used across all dashboard pages |

> **Do NOT change** page content components (booking tables, calendar, etc.) in this pass.
> Only shell: sidebar, top nav, layout wrapper, and the overview dashboard page.

---

## 7. Build Order

1. **Sidebar** — dark theme, logo, nav items with gold accent bar, user footer
2. **Layout** — mobile bottom tab bar + slide-over, responsive sidebar visibility
3. **Top Nav** — h-14, slim, mobile hamburger button
4. **PageHeader component** — reusable, add to dashboard/page.tsx first
5. **Dashboard overview page** — stat cards in new card style
6. **Test all breakpoints:** 375px (iPhone SE) · 768px (iPad) · 1280px (desktop)

---

## 8. UX Rules

1. **Mobile first.** Design the 375px layout first, then scale up.
2. **Dark sidebar, light content.** Never reverse this — it's the anchor.
3. **One gold thing per area.** Active nav bar OR logo dot — not both visible at once.
4. **Touch targets ≥ 44px** on mobile for all nav items and buttons.
5. **No horizontal scroll** at any breakpoint.
6. **Sticky top nav** always. Bottom tab bar always visible on mobile.

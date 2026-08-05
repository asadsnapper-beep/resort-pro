# Super Admin Panel — Redesign Instructions

> Scope: `apps/web/src/app/admin/(panel)/*` only (internal ops tool, ResortPro
> staff use). Does **not** touch the resort-facing dashboard (`/dashboard/*`)
> or its design system — those stay exactly as documented in
> [design-system-audit.md](design-system-audit.md) /
> [design-system-migration.md](design-system-migration.md).

## 0. Why this is a separate track

The admin panel currently has **zero design system** — every one of its 18
pages hand-writes raw Tailwind (`bg-gray-950`, `text-indigo-400`, …) directly
in the page file. No tokens, no shared table/stat/form component, no
documented palette. This doc gives it one, and — because the composite
components it needs (`DataTable`, `StatCard`, `FilterBar`, `EmptyState`,
`FormField`, `TabBar`, `ConfirmDialog`) are things the resort dashboard's own
migration plan already listed as **missing** (see `design-system-migration.md`
§Phase B), building them here finishes that debt too. One build, two design
systems fixed.

## 1. Design direction — locked

| Decision | Choice | Why |
|---|---|---|
| Palette | Keep **slate/gray neutrals + indigo accent** (already in use, staff already recognize it) | No re-learning cost; internal tool doesn't need resort branding |
| Mode | **Light + dark, from the start** | Reuses the existing `next-themes` toggle the resort dashboard already has (`ThemeProvider` in `providers.tsx` wraps the whole app) — zero new plumbing, just token values for both modes |
| Density | **Dense, data-forward** — smaller row height, more columns visible, less whitespace than the resort dashboard | This is a staff tool used all day, not a guest-facing product; optimize for scanning speed over "premium feel" |
| Typography | **Inter only**, no display serif | Admin panel is not brand-facing — one workhorse font, size does the hierarchy |
| Motion | Minimal — fade/slide on modals and drawers only, no page-load animation | Reduces perceived latency on data-heavy pages |

### Reference feel
Closest existing products to match the target quality bar: **Linear**
(density + keyboard-first tables), **Stripe Dashboard** (stat cards + nested
detail drawers), **Vercel dashboard** (dark neutral palette + status badges).

## 2. Token layer — how to build it (no new Tailwind config needed)

The resort dashboard already proved the pattern: components read
`var(--rp-*)`, and dark mode "just works" because the variables are
redefined inside a `.dark` scope — components never hardcode a color.

Do the **same trick, scoped to admin**, instead of inventing a parallel
`admin-*` Tailwind namespace. Two blocks — light (default) and dark (inside
`.dark`, matching how `next-themes` already toggles the class on `<html>`):

```css
/* globals.css — new blocks, additive only */

/* Light — default */
.admin-shell {
  --rp-text: #1e293b;          /* slate-800 */
  --rp-text-muted: #64748b;    /* slate-500 */
  --rp-text-muted-2: #64748b;
  --rp-text-subtle: #94a3b8;
  --rp-text-faint: #cbd5e1;
  --rp-text-accent: #4f46e5;   /* indigo-600 */

  --rp-surface: #ffffff;
  --rp-surface-2: #f8fafc;     /* slate-50, page bg */
  --rp-surface-3: #f1f5f9;     /* slate-100, hover fills */
  --rp-surface-4: #e2e8f0;
  --rp-modal: #ffffff;

  --rp-border: rgba(15,23,42,0.08);
  --rp-border-md: rgba(15,23,42,0.12);

  --rp-brand: #4f46e5;         /* indigo-600 — primary actions */
  --rp-brand-hover: #4338ca;   /* indigo-700 */
  --rp-brand-deep: #3730a3;    /* indigo-800 */

  --rp-btn-accent: #4f46e5;
  --rp-btn-accent-text: #ffffff;

  --rp-danger: #dc2626;
  --rp-teal-bg: #e0f2fe;       /* info badge bg */
  --rp-amber-bg: #fef3c7;      /* warning badge bg */
  --rp-red-bg: #fee2e2;        /* danger badge bg */
}

/* Dark — inside the same .dark class next-themes already toggles */
.dark .admin-shell {
  --rp-text: #e2e8f0;
  --rp-text-muted: #94a3b8;
  --rp-text-muted-2: #94a3b8;
  --rp-text-subtle: #64748b;
  --rp-text-faint: #475569;
  --rp-text-accent: #a5b4fc;

  --rp-surface: #111827;      /* gray-900 */
  --rp-surface-2: #0b0f19;    /* gray-950, page bg */
  --rp-surface-3: #1f2937;    /* gray-800, hover fills */
  --rp-surface-4: #1e293b;
  --rp-modal: #111827;

  --rp-border: rgba(255,255,255,0.08);
  --rp-border-md: rgba(255,255,255,0.12);

  --rp-brand: #6366f1;        /* indigo-500 — primary actions */
  --rp-brand-hover: #4f46e5;  /* indigo-600 */
  --rp-brand-deep: #4338ca;   /* indigo-700 */

  --rp-btn-accent: #6366f1;
  --rp-btn-accent-text: #ffffff;

  --rp-danger: #ef4444;
  --rp-teal-bg: #164e63;      /* info badge bg, dark-safe */
  --rp-amber-bg: #78350f;     /* warning badge bg, dark-safe */
  --rp-red-bg: #7f1d1d;       /* danger badge bg, dark-safe */
}
```

**Consequence:** `Button`, `Badge`, `Card`, `Input`, `ModalShell`, `Toast`,
`PageShell`, `PageHeader`, `ActionButton` — every one already reads these
exact variable names — work **unmodified** the moment the admin layout's
outer `<div>` gets `className="admin-shell"`. No component forking, and
light/dark switching is free — it's the same `.dark` class `next-themes`
already flips on `<html>` for the resort dashboard's toggle.

**Admin currently has no dark/light toggle button at all** (it's hardcoded
dark via raw Tailwind, not via the `dark` class) — add one to the admin
topbar using the exact pattern `top-nav.tsx` already uses:

```tsx
import { useTheme } from 'next-themes';
const { theme, setTheme } = useTheme();
// <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
```

Since `ThemeProvider` wraps the whole app in `providers.tsx`, this needs no
new provider — just the button, in the admin header.

**Default:** `next-themes`' `defaultTheme="light"` in `providers.tsx` applies
here too, so a first-time visit to admin renders light unless the staff
member already toggled dark elsewhere in the app (preference is shared
site-wide via the same `theme` localStorage key).

**Do the token blocks + the toggle button first, verify both modes on one
page, before touching anything else.**

## 3. Component inventory

### Layer 2 (primitives) — reuse as-is, no changes
`Button`, `Badge` + `StatusBadge`, `Card`, `Input`, `ModalShell`, `Toast`,
`Portal`. Already generic, already token-driven.

### Layer 3 (composite patterns) — reuse as-is
`PageShell`, `PageHeader`, `ActionButton`. Token-driven, no resort-specific
values baked in.

### Layer 3 — **new, must be built** (shared location: `components/patterns/`, so the resort dashboard's own Phase B debt closes at the same time)

| Component | Used by (admin pages) | Minimum API |
|---|---|---|
| `DataTable` | Tenants, Users, Billing, Audit Log, Demo Leads, Referrals, Enterprise, Domains | columns, rows, loading, empty state, pagination, sort, row click → detail, row actions menu |
| `FilterBar` | Tenants, Users, Audit Log, Demo Leads | search input, 1–3 select filters, active-filter chips, reset |
| `StatCard` / `StatGrid` | Overview, Billing & MRR, Storage, Health | label, value, delta/trend arrow, icon, loading skeleton |
| `EmptyState` | every DataTable page | icon, title, one-line copy, optional primary action |
| `DetailDrawer` | Tenants (tenant detail), Users (user detail), Enterprise (account terms) | right-side slide-over, header + close, scrollable body, sticky footer actions — same shell `BookingDetailSheet` already uses on the resort side, generalized |
| `FormField` | Settings, Team (invite), Announcements (compose), GDPR | label, help text, error, required marker, input slot |
| `TabBar` | Design Requests (pipeline stages), Announcements (draft/scheduled/sent), Settings (General/Plans/Flags) | keyboard nav, active indicator, overflow on narrow width |
| `ConfirmDialog` | Tenants (suspend), Team (remove), GDPR (approve deletion) | built on `ModalShell`, danger/neutral tone, loading + disabled submit |

Build these once, generically (props only, no page-specific logic inside) —
same rule the resort dashboard migration plan already set.

## 4. Page-by-page redesign map

All 18 pages under `apps/web/src/app/admin/(panel)/`:

| Page | Primary pattern | Notes |
|---|---|---|
| **Overview** (`dashboard`) | `StatGrid` (MRR, active tenants, signups today, churn) + existing MRR chart (Recharts) + recent-activity list | Highest-traffic admin page — do this first as the pilot |
| **Tenants** | `FilterBar` + `DataTable` + `DetailDrawer` + `ConfirmDialog` (suspend/delete) | Second pilot — proves table + drawer + destructive-action pattern together |
| **Users** | `FilterBar` + `DataTable` + `DetailDrawer` | Same shape as Tenants, should be near-copy once that pattern exists |
| **Billing & MRR** | `StatGrid` + MRR chart + `DataTable` (transactions) | Reuses Overview's StatGrid |
| **Themes** | Card grid (not a table) + `ModalShell` (upload) | Keep gallery layout, just retoken the cards |
| **Design Requests** | `TabBar` (pipeline stages) + `DataTable` or kanban columns | Confirm with stakeholder whether kanban or table view is wanted before building |
| **Demo Leads** | `FilterBar` + `DataTable` + export button | Straightforward table page |
| **Audit Log** | `FilterBar` (date range + actor + action type) + `DataTable`, dense rows, virtualized/paginated | High-volume — pagination is not optional here |
| **Export** | `FormField`-based form (data type + date range) + history list | Low-traffic, simple |
| **Referrals** | `StatGrid` (totals) + `DataTable` | |
| **Team** | `DataTable` + `ModalShell` (invite) + `ConfirmDialog` (remove) | |
| **Announcements** | `TabBar` (draft/scheduled/sent) + `DataTable`/list + compose `ModalShell` with `FormField`s | |
| **GDPR** | `DataTable` (requests) + `ConfirmDialog` (approve/deny) | Compliance-sensitive — every action needs an audit-log write, verify this already happens |
| **Enterprise** | `DataTable` + `DetailDrawer` (negotiated terms) | |
| **Domains** | `DataTable` + status `Badge` + verify action | Pairs with the Cloudflare wildcard work already in flight |
| **Health** | `StatGrid` (uptime, DB, queue, error rate) + small sparkline charts | Read-only monitoring |
| **Storage** | `StatGrid` (usage) + `DataTable` (largest tenants) | |
| **Settings** | `TabBar` + `FormField`-heavy forms | Plan/flags editor — the most form-dense page |

**Also fix while in here (existing gap):** `NotificationBell` has no
dropdown panel — clicking it should open a small popover list, not just show
a count badge. Small, self-contained addition once `Portal` is used to mount
it.

## 5. Implementation phases

### Phase A — token + primitive proof (1 day)
1. Add both `.admin-shell` / `.dark .admin-shell` CSS blocks above.
2. Wrap `admin/(panel)/layout.tsx`'s outer div with `admin-shell` (no
   hardcoded `dark` — let `next-themes` control it).
3. Add the light/dark toggle button to the admin topbar (`useTheme`, same
   as `top-nav.tsx`).
4. Swap the sidebar/topbar's hardcoded classes for the shared primitives
   (`Button`, `Badge`) where they fit — sidebar nav items can stay bespoke,
   they're a one-off shape.
5. Verify: page renders correctly in **both** light and dark, toggle
   persists across reload, zero new TS errors.

### Phase B — build the missing shared composites (2–3 days)
Build `DataTable`, `StatCard`/`StatGrid`, `FilterBar`, `EmptyState`,
`DetailDrawer`, `FormField`, `TabBar`, `ConfirmDialog` in
`components/patterns/`, per the API table in §3. No page wiring yet —
ship with one throwaway usage each to prove the API.

### Phase C — pilot: Overview + Tenants (1 day)
Rebuild these two pages fully with the new patterns. These two exercise
every new component at least once (StatGrid, DataTable, FilterBar,
DetailDrawer, ConfirmDialog). Screenshot before/after. This is the checkpoint
to sanity-check the whole system before rolling out to the rest.

### Phase D — roll out to remaining 16 pages (staggered)
Order: Users → Billing → Audit Log → Demo Leads → Referrals → Team →
Domains → Enterprise → GDPR → Announcements → Design Requests → Health →
Storage → Export → Settings → Themes (Themes last — it's the one page that
isn't table/stat-shaped, needs its own card-grid pass).

### Phase E — polish
1. `NotificationBell` dropdown panel.
2. Delete now-dead raw-hex classes; add a lint/ratchet check for the admin
   folder mirroring `scripts/design-system-ratchet.mjs`.

## 6. File map (what gets touched)

```
apps/web/src/
├── app/globals.css                        ← +.admin-shell block
├── app/admin/(panel)/
│   ├── layout.tsx                         ← wrap in admin-shell, retoken sidebar/topbar
│   ├── dashboard/page.tsx                 ← pilot 1
│   ├── tenants/page.tsx                   ← pilot 2
│   └── ...15 more pages, Phase D order above
└── components/
    ├── patterns/
    │   ├── DataTable.tsx                  ← NEW
    │   ├── StatCard.tsx                   ← NEW
    │   ├── FilterBar.tsx                  ← NEW
    │   ├── EmptyState.tsx                 ← NEW
    │   ├── DetailDrawer.tsx               ← NEW
    │   ├── FormField.tsx                  ← NEW
    │   ├── TabBar.tsx                     ← NEW
    │   └── ConfirmDialog.tsx              ← NEW
    └── admin/
        └── NotificationBell.tsx           ← + dropdown panel
```

## 7. Done when

- All 18 admin pages use `admin-shell` tokens, zero raw hex/gray-9xx classes left.
- Every table page uses `DataTable`; every stat page uses `StatGrid`.
- `NotificationBell` has a working panel.
- New shared composites also available to (and eventually adopted by) the
  resort dashboard, closing its own Phase B gap.
- No visual regression on Overview/Tenants pilot vs. before screenshots.

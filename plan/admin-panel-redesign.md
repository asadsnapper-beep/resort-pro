# Super Admin Panel — Redesign Instructions

> Scope: `apps/web/src/app/admin/(panel)/*` only (internal ops tool, ResortPro
> staff use). Does **not** touch the resort-facing dashboard (`/dashboard/*`).

## 0. Status — this doc was rewritten 2026-08-05

**A previous version of this doc proposed an indigo/dark-mode direction.
That direction was wrong — a design system had already been produced and
partially wired into the live code before this doc's first draft was
written.** This version replaces it with the real, in-progress system.

**Source of truth:** `demo-page/ResortPro admin panel redesign/_ds/
modernist-6f892142-4e88-43c9-a161-eebdcf8995e2/` — a complete generated
design-system deliverable: `readme.md` (the rules), `theme.json` +
`styles.css` (the tokens), and reference HTML pages for every component
(`components/*.html`, `foundations/*.html`). Read `readme.md` there before
touching any admin page — this doc summarizes it but the folder is
authoritative.

**Name: "Modernist."** Flat, architectural, set entirely in Archivo: near-mono
red-on-white, a visible grid, **zero corner radius**, strong 2px rules.
Nothing floats, nothing is decorated. **Light-only by design** — see §5 for
the one open conflict this creates.

## 1. What's already done (verified against the actual repo, not memory)

| Layer | Status | Where |
|---|---|---|
| Tokens | ✅ Done | `.admin-shell` block in `apps/web/src/app/globals.css` (~line 161) redefines every `--rp-*` variable to Modernist's coral/off-white/zero-radius values, scoped to admin only |
| Legacy-class bridge | ✅ Done | Same file, ~line 195 on — `!important` overrides that catch old raw Tailwind (`bg-gray-900`, `text-indigo-400`, `rounded-*`, …) still sitting in unmigrated pages and force them onto the token values. Transitional — remove page-by-page as each page moves to direct `rp-*` classes. |
| Layout shell | ✅ Done | `admin/(panel)/layout.tsx` — wrapped in `admin-shell`, sidebar/topbar retokened |
| `ModalShell` | ✅ Done | Gained a `variant="admin"` prop |
| `DataTable` | ✅ Done | `components/patterns/DataTable.tsx` |
| `EmptyState` | ✅ Done | `components/patterns/EmptyState.tsx` |
| `FilterBar` | ✅ Done | `components/patterns/FilterBar.tsx` |
| `FormField` | ✅ Done | `components/patterns/FormField.tsx` |
| `StatCard` / `StatGrid` | ✅ Done | `components/patterns/StatCard.tsx` |
| `TabBar` | ✅ Done | `components/patterns/TabBar.tsx` |
| **Overview page** (`dashboard`) | ✅ Migrated | Uses `StatCard`/`StatGrid` |
| **Tenants page** | ✅ Migrated | Uses `DataTable`, `FilterBar`, `FormField`, `ModalShell variant="admin"` |
| `ConfirmDialog` | ❌ Not built | Tenants' suspend action still uses browser `confirm()`; edit uses a hand-composed `ModalShell` footer each time |
| Remaining ~15 pages | ❌ Not migrated | Still raw Tailwind, held visually consistent only by the legacy-class bridge (not using the composite components) |
| `NotificationBell` dropdown panel | ❌ Not built | Still just a count badge |

**In short: the foundation (tokens, primitives, most composites) and two full
pilot pages are already done and already prove the system works. What's left
is (1) one more composite, `ConfirmDialog`, and (2) rolling the existing
composites out to the other ~15 pages.**

## 2. Design system summary (full detail in the `_ds/modernist-…/` folder)

| Token role | Value | Notes |
|---|---|---|
| `--color-bg` / `--rp-surface-2` | `#f3f2f2` | Page background |
| `--color-surface` / `--rp-surface` | `#eae9e9` | Card/panel fill |
| `--color-text` / `--rp-text` | `#201e1d` | Ink |
| `--color-accent` / `--rp-brand` | `#ec3013` | The one accent — coral-red. Use sparingly: primary action + small emphasis, not decoration |
| `--font-heading` / `--font-body` | Archivo, weight 800 for headings | One font, everywhere |
| `--radius-*` | `0px` | Never round a corner |
| `--color-divider` | 2px, ink at 40% | Strong section rules, not soft hairlines |

Component classes exist in the reference kit as plain CSS (`.btn`, `.card`,
`.table`, `.field`, `.dialog`, `.tag`, `.nav`) — the React composites in
`components/patterns/` are this project's implementation of those same
ideas, built to consume the `--rp-*` tokens instead of duplicating raw values.
**When building `ConfirmDialog`, base its markup on `_ds/…/components/
dialog.html`'s `.dialog-backdrop`/`.dialog` structure**, the same way
`DataTable` should be checked against `components/table.html` for anything
it's missing (themed header, row rules).

## 3. Remaining composite: `ConfirmDialog`

| Component | Used by | Minimum API |
|---|---|---|
| `ConfirmDialog` | Tenants (suspend — replaces the raw `confirm()`), Team (remove), GDPR (approve deletion) | Built on `ModalShell variant="admin"`, danger/neutral tone, loading + disabled submit, matches `_ds/…/components/dialog.html` |

Optional, evaluate when the first page that needs it comes up rather than
building speculatively: `DetailDrawer` (right-side slide-over) — neither
pilot page needed one (Tenants uses an inline edit modal instead), so don't
build it until a page genuinely needs a drawer over a modal.

## 4. Page-by-page rollout — what's left

Already done: **Overview**, **Tenants**. Remaining, suggested order (highest
traffic / simplest first):

| Page | Primary pattern | Notes |
|---|---|---|
| **Users** | `FilterBar` + `DataTable` | Same shape as Tenants — should be closest to a copy |
| **Billing & MRR** | `StatGrid` (reuse Overview's) + `DataTable` (transactions) | |
| **Demo Leads** | `FilterBar` + `DataTable` | |
| **Audit Log** | `FilterBar` (date range + actor + action type) + `DataTable`, dense rows, paginated | High-volume — pagination matters here |
| **Referrals** | `StatGrid` + `DataTable` | |
| **Team** | `DataTable` + `ModalShell variant="admin"` (invite) + `ConfirmDialog` (remove) | First real use of the new `ConfirmDialog` |
| **Domains** | `DataTable` + `Badge` (status) | Pairs with the Cloudflare wildcard work already in flight |
| **Enterprise** | `DataTable` | |
| **GDPR** | `DataTable` + `ConfirmDialog` (approve/deny) | Compliance-sensitive — confirm every action still writes to the audit log |
| **Announcements** | `TabBar` (draft/scheduled/sent) + `DataTable`/list + compose `ModalShell` with `FormField`s | |
| **Design Requests** | `TabBar` (pipeline stages) + `DataTable` | Confirm kanban vs. table preference before building |
| **Health** | `StatGrid` + small sparkline charts | Read-only monitoring |
| **Storage** | `StatGrid` + `DataTable` (largest tenants) | |
| **Export** | `FormField`-based form + history list | Low-traffic, simple |
| **Settings** | `TabBar` + `FormField`-heavy forms | Most form-dense page |
| **Themes** | Card grid (not a table — keep the gallery layout) | Retoken only, don't force it into `DataTable` |

Also still open: `NotificationBell` dropdown panel (Portal-based popover,
currently just a badge).

## 5. Open conflict — light-only vs. the dark-mode ask

Modernist is **explicitly light-only** (`color-scheme: light` in the token
sheet; the readme describes a single mono-ink-on-white scheme with no dark
variant designed). This directly conflicts with wanting a light/dark toggle
option for admin — Modernist as authored has no dark half to toggle to.

Two ways forward:
1. **Ship Modernist as designed, light-only, for now.** It's the system
   that's already decided and half-built; a dark variant was never part of
   its spec. Revisit only if staff actually ask for it later.
2. **Design a dark variant of Modernist** (dark ink ground, same coral
   accent, same zero-radius/Archivo rules) before finishing the rollout —
   real design work, not a token find-and-replace, and it means asking
   whoever produced the `_ds/modernist-…/` kit to extend it, or extending it
   ourselves and accepting it won't be the same output as the generated kit.

**Recommendation: option 1.** Ship what's already decided and already
working; treat dark mode as a later, separately-scoped request if it turns
out to matter once staff are using it daily.

## 6. File map

```
apps/web/src/
├── app/globals.css                        ← .admin-shell tokens (done)
├── app/admin/(panel)/
│   ├── layout.tsx                         ← done
│   ├── dashboard/page.tsx                 ← done (Overview pilot)
│   ├── tenants/page.tsx                   ← done (Tenants pilot)
│   └── ...15 more pages, §4 order above
└── components/
    ├── patterns/
    │   ├── DataTable.tsx / EmptyState.tsx / FilterBar.tsx
    │   ├── FormField.tsx / StatCard.tsx / TabBar.tsx     ← all done
    │   └── ConfirmDialog.tsx                             ← NEW, build next
    ├── ui/modal-shell.tsx                 ← done (variant="admin")
    └── admin/NotificationBell.tsx         ← needs a dropdown panel

demo-page/ResortPro admin panel redesign/_ds/modernist-6f892142-…/
    ← source-of-truth design kit, read before building anything new
```

## 7. Done when

- All 18 admin pages use the Modernist tokens directly (no more legacy-class
  bridge needed — it can be deleted from `globals.css`).
- Every table page uses `DataTable`; every stat page uses `StatGrid`.
- `ConfirmDialog` exists and every destructive action uses it (no more raw
  `confirm()`).
- `NotificationBell` has a working panel.
- Light-vs-dark decision (§5) has been made deliberately, not left ambiguous.

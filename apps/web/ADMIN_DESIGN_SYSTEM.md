# ResortPro Super Admin — Modernist System

**Source of truth:** `demo-page/ResortPro admin panel redesign/` — especially
`ResortPro Admin.dc.html` and `_ds/modernist-*/styles.css`. Every page under
`/admin/(panel)` must follow this system; it is intentionally separate from
the resort-owner dashboard.

## Non-negotiable visual rules

- **Typography:** Archivo only. Heading weight is 800; body is Archivo 400/600.
- **Palette:** ink `#201e1d` on off-white `#f3f2f2`; surface `#eae9e9`; one
  coral-red accent `#ec3013`. Do not introduce blue, green, purple, or gold.
- **Geometry:** zero border radius. No pills, soft cards, or floating UI.
- **Structure:** strong, visible **2px** rules between major panels; table rows
  keep 1px rules.
- **Layout:** data-forward modular grids, flush-left labels, compact controls.
  Tables use horizontal overflow on small screens, never collapsed columns.
- **Theme:** light only. This reference does not have a dark variant, so the
  Super Admin must not add one.

## Admin token mapping

The `.admin-shell` scope maps the shared `rp-*` aliases to the Modernist
palette. New code uses semantic classes rather than raw values:

| Role | Classes |
| --- | --- |
| Ink / muted ink | `text-rp-text`, `text-rp-muted`, `text-rp-subtle` |
| Ground / panel / hover | `bg-rp-surface-2`, `bg-rp-surface`, `bg-rp-surface-3` |
| Structural rule | `border-rp-border` (use `border-2` for a panel edge) |
| Coral emphasis | `bg-rp-brand`, `text-rp-brand`, `bg-rp-teal-bg` |

## Shared patterns

- `StatCard` / `StatGrid`: square, compact metrics.
- `FilterBar`: labelled search/filter control group.
- `DataTable`: dense table with 2px header divider and 1px row rules.
- `EmptyState`, `FormField`, `TabBar`: square, ink-and-coral interface states.

All new Super Admin modals use `ModalShell`, then receive the Modernist token
scope; never add a hand-written fixed overlay.

## Page rollout

Overview is the visual pilot. Tenants is next and establishes the canonical
table + filter + detail action pattern; then Users, Billing, Audit Log and the
remaining admin pages migrate using the same tokens and primitives.

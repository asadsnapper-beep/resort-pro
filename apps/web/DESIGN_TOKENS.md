# ResortPro Design Tokens

Single source of truth for dashboard/app colours, radii, shadows, and type.
Defined in [`src/app/globals.css`](src/app/globals.css) (CSS vars) and exposed as
Tailwind classes in [`tailwind.config.ts`](tailwind.config.ts).

**The rule:** dashboard pages use these tokens — never a raw hex, never a raw
`px` font size, never an inline `boxShadow`. Change a token here and every page
using it follows. That is the whole point.

---

## Why this exists

An audit on 2026-07-25 found, across the 47 dashboard pages:

| | |
|---|---|
| Hardcoded hex colours | **93 distinct**, e.g. `#23766a` used 444× |
| Dark mode | handled by per-hex `!important` patches in globals.css |
| Radii | 8 different values (5/6/7/8/9/10/12/14px) |
| Font sizes | 12 values, including 10.5 / 11.5 / 12.5 / 13.5px half-steps |

Dark mode was the clearest symptom: because pages hardcode light-mode hex,
`globals.css` had to patch each specific hex for dark mode. Any hex not on that
list silently broke in dark mode.

---

## Colours

Use `text-rp-*`, `bg-rp-*`, `border-rp-*`. **Dark mode is automatic** — the
underlying CSS var already has a `.dark` value, so you write one class instead
of a `light dark:` pair.

```diff
- className="text-[#8aa29a] dark:text-[#94b8b0]"
+ className="text-rp-muted"
```

### Text
| Token | Light | Dark |
|---|---|---|
| `rp-text` | `#183153` | `#f8fafc` |
| `rp-muted` | `#64748b` | `#a9c1d0` |
| `rp-subtle` | `#64748b` | `#a9c1d0` |
| `rp-faint` | `#94a3b8` | `#7f99ab` |
| `rp-accent` | `#475569` | `#9db4c4` |

### Surfaces & borders
| Token | Light | Dark |
|---|---|---|
| `rp-surface` | `#ffffff` | `rgba(255,255,255,.07)` |
| `rp-surface-2` | `#faf9f7` | `rgba(255,255,255,.04)` |
| `rp-surface-3` | `#f4f1eb` | `rgba(255,255,255,.05)` |
| `rp-surface-4` | `#f0ede8` | `rgba(255,255,255,.06)` |
| `rp-modal` | `#ffffff` | `#1a2e2a` |
| `rp-border` | `rgba(0,0,0,.06)` | `rgba(255,255,255,.08)` |
| `rp-border-md` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.10)` |

### Brand & accents
Mode-invariant — pages use these with no `dark:` variant today, so the tokens
keep that exact behaviour.

| Token | Value | Note |
|---|---|---|
| `rp-brand` | `#183153` | = `resort-600`. Primary actions, links, active icons |
| `rp-brand-hover` | `#122846` | = `resort-700` |
| `rp-brand-deep` | `#0e223c` | = `resort-900`. Headings, dark sections |
| `rp-gold` | `#b89040` | ⚠️ tailwind `gold-600` is `#b8893f` — see Known drift |
| `rp-gold-bright` | `#d4a853` | = `gold-500` |
| `rp-danger` | `#c43c3c` | |
| `rp-coral` | `#b8724a` | |

### Status backgrounds
`rp-teal-bg`, `rp-amber-bg`, `rp-red-bg`, `rp-coral-bg`, `rp-teal-soft` — all
have dark variants.

> **Opacity modifiers don't work** on `rp-*` colours (`text-rp-muted/50`).
> They resolve to full colours, not HSL channels. Use a dedicated token.

---

## Radius — `rounded-rp-*`

| Token | Value | Role |
|---|---|---|
| `rp-card` | 14px | cards, panels, empty states |
| `rp-panel` | 12px | nested panels |
| `rp-btn` | 10px | buttons |
| `rp-ctrl` | 9px | inputs, chips, small controls |
| `rp-sm` | 8px | |
| `rp-xs` | 7px | |

## Shadow — `shadow-rp-*`

| Token | Value |
|---|---|
| `rp-card` | `0 1px 6px rgba(0,0,0,.04)` — the card elevation (was inlined 106×) |
| `rp-pop` | `0 4px 24px rgba(24,49,83,.12)` |
| `rp-sheet` | `-8px 0 40px rgba(24,49,83,.15)` |

## Type — `text-rp-*`

| Token | Size | Role |
|---|---|---|
| `rp-title` | 26px | page title |
| `rp-heading` | 22px | section heading |
| `rp-body` | 13px | default body text |
| `rp-meta` | 12px | secondary / meta |
| `rp-label` | 11.5px | field labels |
| `rp-micro` | 11px | badges, timestamps |

Tailwind's own scale (`text-sm` = 14px, `text-lg` = 18px, …) is untouched and
still available.

---

## Known drift — decide, don't copy

These are inconsistencies the audit surfaced. They are **preserved as-is** so
nothing shifts visually; fixing them is a deliberate design decision.

1. **Legacy green debt** — dashboard code historically used `#23766a` and
   `#1a6b5e`. The navy migration maps both to `rp-brand` / `#183153`; new code
   must use the semantic token rather than adding another direct colour.
2. **Two golds** — pages use `#b89040` (138×) but tailwind `gold-600` is
   `#b8893f`. One should win.
3. **Half-pixel type steps** — `rp-13-5`, `rp-12-5`, `rp-10-5` exist only to
   preserve current rendering. They are almost certainly drift from their
   neighbours and should collapse into `rp-body` / `rp-meta` / `rp-micro`.
4. **Dark-mode brand** — `rp-brand` stays navy on dark backgrounds for action
   consistency; use `rp-gold-bright` or a dedicated status token where a
   stronger dark-mode contrast is required.
5. **The `!important` dark patches** at the bottom of `globals.css` can be
   deleted once the pages they cover are migrated to tokens.

---

## Status

Phase 0 of [`plan/design-system-migration.md`](../../plan/design-system-migration.md).
Purely additive — verified that every new class resolves correctly in light and
dark, and that Tailwind's default scales are unaffected.

Next: Phase 1 — the composite component layer (`PageShell`, `PageHeader`,
`DataTable`, …) built on these tokens.

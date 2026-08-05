# ResortPro — project instructions

## Dashboard UI: use the design system, not raw values

The 47 dashboard pages were built by copy-paste, which is why a single design
fix used to mean editing 35 files. That is being migrated to a 3-tier system
(tokens → primitives → composite patterns). **Build on it; don't add to the
debt.**

Full reference: [apps/web/DESIGN_TOKENS.md](apps/web/DESIGN_TOKENS.md).
Plan and remaining phases: [plan/design-system-migration.md](plan/design-system-migration.md).

### When writing or editing a dashboard page

```tsx
import { PageShell, PageHeader, ActionButton } from '@/components/patterns';

<PageShell gap={6}>
  <PageHeader
    title="Expenses"
    subtitle="Track operational costs"
    align="end"                          // start | center | end | responsive
    actions={<ActionButton icon={<Plus className="h-4 w-4" />}>Add</ActionButton>}
  />
  {/* … */}
</PageShell>
```

### Don't

- ❌ Raw hex — `text-[#18231f]`, `style={{ color: '#23766a' }}`
  → ✅ `text-rp-text`, `text-rp-brand` (dark mode is automatic)
- ❌ Arbitrary sizes — `text-[13px]`, `rounded-[14px]`
  → ✅ `text-rp-body`, `rounded-rp-card`
- ❌ Inlined shadow — `style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}`
  → ✅ `shadow-rp-card`
- ❌ A hand-written `<h1 className="font-display text-[26px] …">` header
  → ✅ `<PageHeader>`

The dark-mode point matters: pages that hardcode light-mode hex only work in
dark mode because `globals.css` patches each specific hex with `!important`.
Any hex not on that list silently breaks in dark mode. Tokens avoid this
entirely, and let those patches eventually be deleted.

### CI enforces this

`scripts/design-system-ratchet.mjs` runs in CI and **fails the build if any
violation category grows** above `scripts/design-system-baseline.json`. Existing
debt is allowed to sit; it may not increase.

```bash
node scripts/design-system-ratchet.mjs            # check
node scripts/design-system-ratchet.mjs --update    # re-record after migrating
```

Lower a baseline number whenever you migrate something. Raising one needs a
reason in the commit message.

### Migrating an existing page

This is a **refactor, not a redesign** — the page must look identical
afterwards. Header shapes are not uniform across the app (five variants were
found), so pass the page's existing shape rather than normalising it:

- Match its `align` and its `PageShell gap`, and keep extra shell classes
  (`max-w-*`, `pb-*`) via `className`.
- Leave buttons alone unless they match `ActionButton` exactly — most use
  `gap-1.5`/`py-[9px]`/`hover:opacity-80` vs ActionButton's
  `gap-2`/`py-2`/`hover:opacity-90`, and swapping shifts padding by 1px.
- `tightSubtitle` exists only to preserve 6 pages whose subtitles omit
  `mt-[4px]`. Don't use it on new pages.
- Verify: page still returns 200, and the type-error count didn't rise.

Known drift (deliberately preserved, not bugs to "fix" silently) is listed at
the bottom of DESIGN_TOKENS.md.

## Modals: use ModalShell

See the global instructions — all new modals use `ModalShell` from
`@/components/ui/modal-shell` (handles createPortal, body overflow, and the
resort design). Don't use shadcn `<Modal>` in new code.

## Active project memory

Read [memory/projects/resortpro.md](memory/projects/resortpro.md) before
starting product, pricing, marketing, deployment, or design work. It records
the current source-of-truth decisions and flags older plans that are now stale.

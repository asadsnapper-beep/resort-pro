# ResortPro — project instructions

## Git: where to work, and what to leave behind

Read this before touching a file.

A real incident, not a hypothetical. On 30–31 October 2026 an agent run left
**166 uncommitted entries** in the main checkout — 183 files once the untracked
directories are expanded. `git reflog` showed no activity there between
5 September and 13 November — no commit, no branch switch — so the work had no
home and nobody knew it existed for two weeks. By the time it was found, `dev`
had moved 288 commits and `WalkInScreen.kt` had grown from 347 lines to 698, so
most of it was obsolete. Separating the roughly twenty files that still
mattered took hours.

It was parked on `park/agent-work-2026-10-30` rather than discarded; that
commit message lists which files are genuinely missing from `dev`, which are
byte-identical to it, and which are duplicates. Five rules prevent the next
one.

### 1. Never work on `dev` in the main checkout

That working tree is shared. Files left in it sit on top of whatever branch it
happens to be on, invisible to everyone. Branch first:

```bash
git switch -c fix/<short-description>
```

A separate worktree is better still.

### 2. Start from today's `dev`, not from whatever is checked out

```bash
git fetch origin && git log --oneline -1 origin/dev
```

If the checkout is behind, branch from `origin/dev` rather than from `HEAD`.
The October run was written against a 5 September base; that is the single
reason most of it had to be thrown away rather than reviewed.

### 3. Commit everything you touched, before you stop

Finished or not. An unfinished branch is an ordinary thing. An uncommitted
working tree is work waiting for a disk failure. If the task is incomplete, say
so in the commit message and leave it on the branch.

### 4. Never end a turn with a dirty tree

```bash
git status --porcelain
```

Empty, or you are not done. If you are deliberately leaving something
untracked, name it in your reply so nobody has to work it out later.

### 5. Say what you pushed and what you did not

"Committed on `fix/x`, not pushed" is a complete and useful answer. Silence is
what turns a branch into an archaeology problem.

### Do not commit binaries or generated files

Git keeps every version of a binary forever and this repository is public. The
same October pile contained 26 MB of marketing PNGs and MP4s; images committed
once before had to be removed again, and removing them does not shrink the
repository. Images, video, build output and caches belong in `.gitignore`.

Application assets that the build genuinely needs — logos, icons — are fine.
The test is whether the file is produced by a tool or is an input to one.

### This repository is public

No server addresses, tailnet names, owner e-mail addresses, API keys, tokens or
credentials in any file, commit message or pull-request description — including
in planning documents and code comments. Scan before you commit, not after.

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

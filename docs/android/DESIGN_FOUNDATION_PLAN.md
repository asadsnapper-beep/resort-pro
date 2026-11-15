# Android design foundation — the next step, and why it is this one

This is step **2** of [UI_UX_PLAN.md](UI_UX_PLAN.md) §৮: *Shared design
foundation*. It is written for whoever picks up the Android app next, and it is
deliberately narrow — one step, broken into slices that each stand on their own.

## Why this step and not another

The ladder in UI_UX_PLAN §৮ has nine steps. Most of the earlier ones cannot
start yet, and saying why matters more than the order itself:

| Step | Status |
| --- | --- |
| 1 — Photo privacy & walk-in completion | **Blocked.** §৯ questions 1, 2 and 3 are open product decisions (is a guest photo mandatory, front/back of ID, retention and who may delete). It also needs private storage verified on a deployed backend. |
| 2 — Shared design foundation | **Unblocked.** Needs no product decision, no new API, no approved asset. |
| 3 — Home & Rooms polish | **Blocked** on §৯ question 7: the final approved logo, resort image and room images. Also depends on step 2. |
| 6 — Analytics | **Partly blocked** on §৯ question 6 — each metric's business definition and time window. |
| 7 — Shareholder payouts | **Blocked.** Needs a personal payout endpoint that does not exist, plus its authorization. |
| 8 — Guest & stay details | **Done** (PR #47), pending the device and live-API checks listed there. |

So step 2 is the one piece of real work that nothing else is waiting on, and
everything described as "mockup polish" in steps 3, 4 and 5 depends on it
existing first.

## Why now, in numbers

Measured on `android/guest-booking`, across
`app/src/main/java/site/resortpro/android/ui/`:

```
Theme.kt            colors only — no Typography, no Shapes passed to MaterialTheme
MaterialTheme.typography.*    59 call sites, against a theme that defines none
FontFamily.Serif              6 inline uses, compensating for that
ui/components/                2 shared composables (LoadingScreen, NoticeCard)

dp literals                   141
  WalkInScreen         43        HousekeepingScreen   20
  GuestsScreen         25        RoomsScreen          17
  HomeScreen           15        LoginScreen          12
  BookingDetailsScreen  9

most used            20.dp ×19   16.dp ×19   24.dp ×18   8.dp ×17   12.dp ×14
near-duplicates      18 / 20 / 22 / 24 used interchangeably for the same job
```

The web app reached the same state and it cost 47 dashboard pages and a
three-tier migration to climb back out — a single design fix meant editing 35
files. See [apps/web/DESIGN_TOKENS.md](../../apps/web/DESIGN_TOKENS.md) and
[plan/design-system-migration.md](../../plan/design-system-migration.md). The
Android app is eight screens in. The same drift is visible and it is still
cheap to stop.

`18/20/22/24.dp` for the same padding is the Android spelling of
`text-[13px]` next to `text-rp-body`.

## What to build

Four things, in this order. Each slice is a separate commit and a separate PR.

### Slice 1 — tokens

One file, `ui/theme/Tokens.kt`: named spacing, radius and elevation values.
Nothing else changes. Derive the names from what the screens already use —
collapse 18/20/22 to one value only where the result is **visually identical**,
and where it is not, keep both and say in a comment that the difference is
deliberate.

### Slice 2 — Typography and Shapes reach MaterialTheme

`Theme.kt` passes a real `Typography` and `Shapes` to `MaterialTheme`. The
`FontFamily.Serif` currently applied inline at 6 call sites moves into the
display/headline styles where it belongs, and those 6 inline uses go.

This is the slice where a mistake is most visible, so verify it before the
others: every one of the 59 `MaterialTheme.typography.*` call sites is already
asking for a style that will now be defined rather than defaulted.

### Slice 3 — components for what is repeated

Grow `ui/components/` beyond its two composables, driven by what actually
repeats across screens — the surface-with-rounded-corner card, the status
chip, the section heading, the labelled row. Do not invent components nothing
uses yet.

### Slice 4 — screens adopt the tokens

One screen per PR, heaviest first (`WalkInScreen` at 43 literals). **This is a
refactor, not a redesign: the screen must look identical afterwards.** The same
rule the web app's CLAUDE.md states, for the same reason.

## What not to do

- **Do not redesign anything.** No new visual language, no new layout, no
  colour changes. The mockups are not final and §৯ question 7 is open.
- **Do not collapse a value just because it is close.** 18 vs 20 may be
  deliberate. If removing the difference changes what the screen looks like,
  keep it and write down why.
- **Do not do all four slices in one PR.** Slice 1 alone, reviewed, then the
  next. A 141-site change landing at once is unreviewable.
- **Do not touch the API, the web app, or anything outside `apps/android/`.**

## How "done" is proven

CI (`.github/workflows/android.yml`) compiles the app and runs the unit tests
on every PR that touches `apps/android/**`, and since #51 it prints the test
count and fails a run of zero. That covers compilation and logic.

It does **not** cover how anything looks. Be honest about the gap:

- A token or typography change that compiles and passes tests can still be
  visually wrong, and nothing in CI will say so.
- Light/dark and large-text verification needs a device or an emulator. The
  remote host has neither an emulator nor a way to run the instrumentation
  tests it can compile.
- So each slice's PR should say plainly which parts were verified by CI and
  which still need a look on a real screen. Do not describe a slice as
  finished because CI is green.

Screenshot tests would close this, and are worth proposing — but as their own
piece of work, not smuggled into slice 1.

## Related

- [UI_UX_PLAN.md](UI_UX_PLAN.md) — the nine-step ladder and the screen table
- [ARCHITECTURE.md](ARCHITECTURE.md), [BEST_PRACTICES.md](BEST_PRACTICES.md)
- [apps/web/DESIGN_TOKENS.md](../../apps/web/DESIGN_TOKENS.md) — what the same
  problem looked like once it was large

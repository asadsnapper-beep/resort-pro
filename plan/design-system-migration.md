# ResortPro Design System — implementation status and rollout plan

## লক্ষ্য

Dashboard-এর একটি design fix যেন এক জায়গায় করা যায় এবং একই pattern ব্যবহারকারী সব page-এ সেটি পৌঁছে যায়। নতুন dashboard code token ও reusable pattern ব্যবহার করবে; raw hex, arbitrary pixel size, এবং inline visual style ধীরে ধীরে বাদ যাবে।

এটি redesign নয়। Migration-এর সময় প্রত্যেক page-এর বর্তমান visual layout, spacing, এবং interaction বজায় রাখতে হবে।

## বর্তমান অবস্থা — 2026-08-03

Design system **আংশিকভাবে shipped এবং ব্যবহার হচ্ছে**। এটি আর plan-only নয়।

| Layer | বর্তমান অবস্থা | Source |
|---|---|---|
| Tokens | Shipped | `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts` |
| Primitives | Available | `components/ui` — Button, Input, Card, Badge, ModalShell, Toast, Portal |
| Composite patterns | Initial set shipped | `components/patterns` — PageShell, PageHeader, ActionButton |
| Dashboard adoption | In progress | 47 dashboard page-এর মধ্যে PageShell 36টিতে, PageHeader 35টিতে, ActionButton 3টিতে |
| Regression guard | Shipped | `scripts/design-system-ratchet.mjs` এবং `scripts/design-system-baseline.json` |

Token reference ও naming convention-এর single source of truth হলো [DESIGN_TOKENS.md](../apps/web/DESIGN_TOKENS.md)।

### যে debt এখনও আছে

- সব page এখনও token ও pattern-এ migrate হয়নি।
- `DataTable`, `FilterBar`, `EmptyState`, `StatCard`, `FormField`, `TabBar`, এবং confirmation pattern এখনও shared Layer 3 component হিসেবে নেই।
- পুরোনো page-এ raw hex, arbitrary Tailwind value, inline style, এবং hand-written table/header রয়েছে। Ratchet এগুলো নতুন করে বাড়তে দেয় না, কিন্তু পুরোনো debt নিজে থেকে কমায় না।
- Dark mode-এর compatibility patch `globals.css`-এ আছে। সব raw value migrate হলে এগুলো অপসারণ করা যাবে।

## System architecture

```text
Layer 3 — Composite patterns
PageShell · PageHeader · Toolbar/FilterBar · DataTable · StatCard/StatGrid
EmptyState · FormField · TabBar · ConfirmDialog
        ↑
Layer 2 — Primitives
Button · Input · Card · Badge · Select · ModalShell · Toast
        ↑
Layer 1 — Tokens
colour · type · radius · shadow · spacing · motion
```

Rules:

1. Dashboard page-এ raw hex, raw pixel type size, অথবা inline visual style লিখবে না।
2. নতুন modal সবসময় `ModalShell` ব্যবহার করবে।
3. Existing page migrate করা মানে refactor; visual redesign করা নয়।
4. New pattern বানানোর আগে token ও existing primitive দিয়ে সেটি compose করা যায় কি না দেখবে।
5. Pattern API documented না হলে সেটি shared system-এর অংশ হিসেবে ধরা হবে না।

## কীভাবে পুরো system implement হবে

### Phase A — foundation complete করা

**Goal:** token layer-এর ownership ও usage rules সম্পূর্ণ পরিষ্কার করা।

1. `DESIGN_TOKENS.md`-এ color, type, radius, shadow-এর পাশাপাশি spacing এবং motion token যোগ করো।
2. প্রতিটি `rp-*` token-এর semantic use লিখো। একই visual value-এর duplicate token তৈরি কোরো না।
3. `globals.css`-এর raw-color dark-mode patch-এর তালিকা রাখো; কোন page migrate হলে কোন patch আর দরকার নেই তা track করো।
4. `node scripts/design-system-ratchet.mjs` CI-তে চালাও। Migration-এর পর count কমলে `--update` দিয়ে শুধু lower baseline commit করো।

**Done when:** token naming documented, Tailwind class available, light/dark rendering verified, এবং CI-তে ratchet চলছে।

### Phase B — missing composite patterns তৈরি করা

**Goal:** যে markup/style সবচেয়ে বেশি copy-paste হয় সেটিকে reusable করা।

Priority order:

| Pattern | Covers | Minimum API/behaviour |
|---|---|---|
| `DataTable` | list/table pages | columns, rows, loading, empty state, pagination, sort, row action |
| `Toolbar` / `FilterBar` | list controls | search, filters, tabs, reset, responsive wrapping |
| `EmptyState` | empty list/result | icon, title, copy, primary action |
| `StatCard` / `StatGrid` | dashboard metrics | label, value, trend, icon, loading state |
| `FormField` | modal/forms | label, help text, error, required, input slot |
| `TabBar` | settings/module tabs | keyboard navigation, selected state, mobile overflow |
| `ConfirmDialog` | destructive action | `ModalShell`, focus management, loading/disabled submit |

For every pattern:

1. Keep a small, composable props API; page-specific business logic pattern-এর মধ্যে দিও না।
2. Use only `rp-*` tokens and shared primitives.
3. Document variants, loading/empty/error/disabled states, keyboard behaviour, এবং accessibility requirement.
4. Add at least one real page usage before declaring the pattern complete.

**Done when:** most repeated page structure pattern component থেকে আসে, এবং নতুন page-এ copy-paste layout দরকার হয় না।

### Phase C — pilot migration

**Goal:** component API বাস্তব page-এ যাচাই করা, বড় scale migration-এর আগে।

1. Simple list-and-modal page দিয়ে শুরু করো: `expenses` বা `vehicles`।
2. দ্বিতীয় page হিসেবে table-heavy page নাও: `rooms` বা `guests`।
3. তৃতীয় page হিসেবে dashboard shell/stat-heavy page নাও: main `dashboard` বা `front-desk`।
4. প্রতিটি page-এ PageShell, PageHeader, appropriate composite pattern, এবং token ব্যবহার করো।
5. Before/after desktop, mobile, এবং dark-mode screenshot compare করো।

**Done when:** pilot page visually identical, page HTTP 200, type error না বেড়ে, এবং ratchet count কমেছে।

### Phase D — incremental migration of all dashboard pages

**Goal:** 47টি dashboard page ধাপে ধাপে standardise করা।

Suggested order:

1. High-traffic: dashboard, front-desk, bookings, calendar, rooms, guests.
2. Repeated list CRUD: staff, inventory, housekeeping, maintenance, vehicles, venues, expenses, invoices.
3. Configuration/content: website, settings, profile, rate plans, packages, offers, channels.
4. Specialist/low-traffic: shareholders, referrals, AI content, my shares, suspended, upgrade.

Per-page checklist:

- বর্তমান layout-এর screenshot নাও।
- Existing header shape অনুযায়ী `PageShell` এবং `PageHeader` ব্যবহার করো। সব page-কে একই header shape-এ redesign কোরো না।
- Raw values token দিয়ে প্রতিস্থাপন করো; exact visual value preserve করা দরকার হলে existing approved token বেছে নাও।
- Repeated table/form/empty state হলে shared pattern ব্যবহার করো।
- Modal হলে `ModalShell` ব্যবহার করো।
- Light mode, dark mode, এবং 375px viewport check করো।
- `node scripts/design-system-ratchet.mjs` চালাও; improvement থাকলে baseline কমাও।
- এক page বা related pattern-এর ছোট, reversible commit রাখো।

### Phase E — enforce and retire legacy debt

**Goal:** migration শেষ হওয়ার পর পুরোনো path ফিরে না আসা।

1. Ratchet baseline শূন্যের দিকে নামাও।
2. Dashboard page-এ raw hex ও inline style-এর জন্য lint/custom static check কঠোর করো।
3. `globals.css` থেকে obsolete dark-mode `!important` patches remove করো—প্রতিটি removal light/dark screenshot দিয়ে verify করে।
4. Pattern docs ও examples আপডেট রাখো; নতুন team member-এর জন্য short “build a dashboard page” guide যোগ করো।
5. Component snapshot/visual regression test যোগ করা বিবেচনা করো, বিশেষ করে shared patterns-এর জন্য।

## New dashboard page template

```tsx
import { ActionButton, PageHeader, PageShell } from '@/components/patterns';

export default function ExamplePage() {
  return (
    <PageShell gap={6}>
      <PageHeader
        title="Example"
        subtitle="Manage your resort data"
        align="end"
        actions={<ActionButton>Create item</ActionButton>}
      />
      {/* Use shared table, empty-state, and form patterns here. */}
    </PageShell>
  );
}
```

## Success metrics

| Metric | Current | Target |
|---|---:|---:|
| Dashboard pages using `PageShell` | 36 / 47 | 47 / 47 |
| Dashboard pages using `PageHeader` | 35 / 47 | 47 / 47 where the page has a header |
| Composite patterns | 3 | 10+ documented patterns |
| New design-system violations | Prevented by ratchet | 0 |
| Legacy dark-mode patches | Present | Removed after migration |

## Commands

```bash
# Check that design-system debt did not increase
node scripts/design-system-ratchet.mjs

# Record a lower baseline after a verified migration
node scripts/design-system-ratchet.mjs --update
```

# Design System Migration — স্থায়ী সমাধান

> সমস্যা: "একটা design fix ১টা page-এ করলে বাকিগুলোতে হয় না, প্রতিটা page আলাদা বলতে হয়।"
> কারণ: design এক জায়গায় থাকে না — ৪৭টা page-এ **copy-paste করা**।
> এটা [design-system-audit.md](./design-system-audit.md)-এর (কী আছে তার documentation) পরের ধাপ — **কীভাবে সরানো হবে তার execution plan**।

---

## যাচাই করা বর্তমান অবস্থা (সব grep দিয়ে confirmed, ২০২৬-০৭-২৫)

| মেট্রিক | সংখ্যা | মানে |
|---|---|---|
| Dashboard page | ৪৭টা | |
| ঐ page-গুলোতে মোট লাইন | ২৫,৪১৪ | গড়ে ৫৪০ লাইন/page — বেশিরভাগই markup+style |
| Inline `style={{...}}` | **১,৪৭৫ বার** | shared component না, copy-paste |
| আলাদা hardcoded hex color | **৯৩টা** | কোনো enforced palette নেই |
| Brand green `#1a6b5e` hand-typed | **২৪ বার** | token থাকা সত্ত্বেও |
| `<thead>` নিজে হাতে বানানো table | ১৬ page | shared DataTable নেই |
| Empty-state inline | ১৬ page | shared EmptyState নেই |
| `--rp-*` token ব্যবহার করে | কিছু page | **partial adoption** |
| `components/ui` import করে | ৩৩/৪৭ page | primitive আছে, কিন্তু অসম্পূর্ণ |

**মূল রোগ নির্ণয়:** এটা "কিছুই নেই" সমস্যা না — token আছে, low-level primitive (button/input/card) আছে। সমস্যা দুটো:

1. **Adoption inconsistent** — কেউ token ব্যবহার করে, কেউ `#1a6b5e` hand-type করে। কোনো enforcement নেই।
2. **Composite layer অনুপস্থিত** — যেটা প্রতি page-এ বারবার লেখা হয় (page header, toolbar/filter bar, data table, stat card row, empty state, form field) — সেই **মাঝারি-স্তরের** component কোথাও নেই। ১৪৭৫টা inline style এখানেই।

---

## লক্ষ্য: ৩-স্তরের enforced design system

```
Layer 3 — COMPOSITE / PATTERNS   ← এটাই এখন নেই (মূল কাজ)
  PageShell, PageHeader, Toolbar, DataTable, StatCard,
  EmptyState, FormField, FilterBar, TabBar, ConfirmDialog
        ↑ ব্যবহার করে
Layer 2 — PRIMITIVES             ← আছে, কিন্তু বাড়াতে হবে
  Button, Input, Card, Badge, Select, Modal(Shell=✅)
        ↑ ব্যবহার করে
Layer 1 — TOKENS                ← আছে, কিন্তু enforce করতে হবে
  color / spacing / radius / typography / shadow
```

**নীতি:** page-এ কখনো raw hex, raw px, বা inline `style` থাকবে না — শুধু Layer 3 component + Layer 1 token। তখন "design fix" মানে এক জায়গায় (component/token) বদল = ৪৭ page-এ auto।

---

## Phase 0 — Token layer পাকা করা (ভিত্তি)

আগে single source of truth নিশ্চিত করা, নাহলে উপরের সব স্তর নড়বড়ে।

1. **Token audit + consolidate** — ৯৩টা hex-কে গুটিয়ে একটা canonical palette-এ আনা। বেশিরভাগই brand green/gold-এর সামান্য ভিন্ন shade — token-এ map করা যাবে।
2. **Token সম্পূর্ণ করা** — color আছে, কিন্তু **spacing/radius/typography/shadow scale** টোকেনও দরকার (নাহলে `padding: '28px 32px'` copy হতেই থাকবে)। tailwind theme + CSS var-এ define।
3. **Dark mode** ইতিমধ্যে token-driven ([DARK_MODE_PATTERN.md](../DARK_MODE_PATTERN.md)) — সেটার সাথে align রাখা।

**আকার:** ছোট-মাঝারি · **ঝুঁকি:** কম (শুধু যোগ, কিছু ভাঙে না)

---

## Phase 1 — Composite component layer বানানো (মূল কাজ)

`apps/web/src/components/dashboard/` (বা `components/patterns/`)-এ এই component গুলো — একবার, ভালো করে, dark-mode + responsive সহ:

| Component | কী replace করবে | কত page-এ লাগবে |
|---|---|---|
| `PageShell` | বাইরের `<div style={{padding...}}>` wrapper (max-width bug এখানেই ছিল) | ৪৭ |
| `PageHeader` | title + subtitle + action button pattern | ৪৭ |
| `Toolbar` / `FilterBar` | search + filter + tab row | ~30 |
| `DataTable` | হাতে বানানো `<thead>`/`<tbody>` (sort, pagination, empty সহ) | ১৬+ |
| `StatCard` + `StatGrid` | dashboard-এর stat box row | ~10 |
| `EmptyState` | "No X found" placeholder | ১৬+ |
| `FormField` | label + input + error pattern | বেশিরভাগ modal |
| `TabBar` | tab navigation (staff/housekeeping/etc.) | ~12 |

প্রতিটা component-এর সাথে: **props API doc + একটা usage example**। এগুলোই ভবিষ্যতে "design fix" করার একমাত্র জায়গা।

**আকার:** বড় · **ঝুঁকি:** কম (নতুন component, পুরনো কিছু ভাঙে না — যতক্ষণ না migrate করছি)

---

## Phase 2 — Page migration (incremental, big-bang নয়)

⚠️ **সবচেয়ে গুরুত্বপূর্ণ নীতি — একসাথে ৪৭ page rewrite করা যাবে না।** Lakhs of users, তাই এক page করে, verify করে, তারপর পরেরটা।

**Per-page "definition of done":**
1. পুরনো screenshot নেওয়া (browser tool দিয়ে) — baseline
2. Page-টা Layer 3 component + token দিয়ে rewrite
3. নতুন screenshot — **visually identical** হতে হবে (এটা refactor, redesign না)
4. Inline style count → 0, hardcoded hex → 0 (grep দিয়ে verify)
5. Dark mode + mobile চেক
6. Commit (এক page = এক commit, সহজ rollback)

**Migration order (সুপারিশ):**
1. **আগে ২-৩টা "template" page** — সবচেয়ে common pattern (যেমন expenses/vehicles — simple list+table+modal)। এগুলো migrate করে component API পাকা করা
2. তারপর **সবচেয়ে বেশি ব্যবহৃত** page (dashboard, front-desk, bookings, calendar) — যেখানে সবচেয়ে বেশি user
3. বাকিগুলো pattern ধরে ধরে (একবার template ঠিক হলে দ্রুত হবে)

**গতি বাড়ানোর কৌশল:** প্রথম ৩ page-এর পর pattern দাঁড়িয়ে গেলে, বাকিগুলো একই ছাঁচে অনেক দ্রুত — কারণ তখন শুধু content বসানো, structure না ভাবা।

**আকার:** খুব বড় (৪৭ page) কিন্তু **যেকোনো সময় থামানো যায়** — অর্ধেক migrate থাকলেও ক্ষতি নেই, দুই সিস্টেম পাশাপাশি চলে

---

## Phase 3 — Enforcement (regression আটকানো — এটা বাদ দিলে সব ফেরত আসবে)

Migration-এর মূল্য শূন্য যদি পরের সপ্তাহে কেউ আবার inline hex লেখে। তাই:

1. **ESLint rule** — page ফাইলে raw hex color (`/#[0-9a-f]{6}/`) ও `style={{}}` ব্যবহারে warn/error (component ফাইলে allowed)
2. **`react/forbid-dom-props`** বা custom rule — dashboard page-এ inline `style` নিষিদ্ধ
3. **CI check** — নতুন page-এ inline-style count বাড়লে fail (baseline ratchet)
4. **PR template / CLAUDE.md** — "নতুন page? PageShell + token ব্যবহার করো" — যাতে আমিও ভবিষ্যতে ভুল না করি
5. **Component Storybook** (optional, nice-to-have) — visual reference

**আকার:** ছোট · **ঝুঁকি:** নেই · **মূল্য:** সবচেয়ে বেশি (স্থায়িত্ব এখানেই)

---

## Regression safety (lakhs of users বলে অপরিহার্য)

| ঝুঁকি | প্রতিরোধ |
|---|---|
| Migrate করতে গিয়ে চেহারা বদলে যাওয়া | Per-page before/after screenshot — identical না হলে merge না |
| এক page ভাঙলে সব ভাঙা | এক page = এক commit, independent, সহজ revert |
| দুই সিস্টেম পাশাপাশি চলার সময় inconsistency | ঠিক আছে — ধীরে converge করবে, কোনো point-এ পুরো app কাজ করা বন্ধ হয় না |
| Dark mode ভাঙা | প্রতিটা component dark-mode-first বানানো, প্রতি page-এ চেক |
| Mobile ভাঙা | responsive প্রতি page-এ চেক (browser tool resize) |

---

## সময়/আকারের বাস্তব হিসাব

- Phase 0: ভিত্তি — ছোট, কিন্তু আগে করা বাধ্যতামূলক
- Phase 1: ~১০টা component ভালো করে — বড়, একবারের কাজ
- Phase 2: ৪৭ page — সবচেয়ে সময়সাপেক্ষ, কিন্তু **incremental, যেকোনো সময় pause করা যায়, প্রতিটা page নিজে থেকেই value দেয়**
- Phase 3: enforcement — ছোট, কিন্তু বাদ দিলে সব বৃথা

এটা এক sprint-এর কাজ না, কিন্তু Phase 0+1+3 আর প্রথম ৫টা page migrate করলেই "একবার fix = সব page" workflow চালু হয়ে যায় — বাকি migration তারপর ধীরে চলতে পারে।

---

## সিদ্ধান্ত দরকার

1. **শুরুর বিন্দু** — আমার সুপারিশ: Phase 0 (token) → Phase 1-এর প্রথম ৩টা core component (`PageShell`, `PageHeader`, `DataTable`) → ২টা pilot page migrate → দেখে বোঝা যাবে ছাঁচ কেমন দাঁড়ায়, তারপর বাকিটা
2. **এটা কি এখনই, নাকি security audit-এর fix গুলোর পরে?** — security (tenant isolation leak) ব্যবহারকারীর data-র ঝুঁকি, design system maintainability-র। আমার মত: **security-র CRITICAL/HIGH আগে**, তারপর এই design system — কারণ data leak এখন live, design debt বাড়ছে কিন্তু কাউকে ক্ষতি করছে না

---

## Status

📋 **Plan only — কোনো code লেখা হয়নি।** অনুমোদন + শুরুর বিন্দুর অপেক্ষায়।

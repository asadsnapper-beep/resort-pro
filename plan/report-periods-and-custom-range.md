# রিপোর্টিং: Daily, Weekly ও Custom Date Range

> **Status, 2026-09-12.** Phase 1 and Phase 2 are built.
> `GET /api/reports/period` takes `from`/`to` or `week=`, `/reports/daily` is
> the same builder with `from === to`, and the Reports page has the three-way
> selector, quick ranges, URL sync and Apply-gated custom dates.
>
> Deliberately not built yet, each for a stated reason rather than for lack of
> time:
>
> - **`chargesPosted.room`** — needs the room-night engine below, and the
>   planned-versus-actual-dates decision is still open. Returned as `null`.
> - **`outstandingAsOfEnd`** — hidden, as this plan asks, until it can be
>   computed from invoice provenance.
> - **`POST /reports/period/email`** — so emailing is offered for a single day
>   only, and the button says why. Sending a week's figures under a one-day
>   subject would be worse than not offering it.
> - **Export (CSV/PDF)** — Phase 2 of this plan's own ordering, after the
>   in-page and print totals have been checked against reality.
> - **Scheduled weekly dispatch** — still out of scope. And note the warning
>   under "Auto-dispatch": no scheduled report has ever been sent on
>   production, because the worker has never run there.

## কেন এই কাজ

Resort owner আজকের daily report-এর পাশাপাশি গত সপ্তাহ, চলতি মাস, বা নিজের
নির্বাচিত সময়ের report দেখতে চান—যেমন **20 সেপ্টেম্বর থেকে 25 সেপ্টেম্বর**।
বর্তমান Reports page একবারে শুধু এক দিনের `GET /api/reports/daily?date=`
report দেখায়। তার date picker দিয়ে আগের দিন দেখা যায়, কিন্তু দুই বা তার বেশি
দিনের data সঠিকভাবে aggregate করার কোনো API বা UI নেই।

এই কাজের লক্ষ্য হলো একই Report page-এ সহজ তিনটি choice দেওয়া:

1. **Daily** — একটি calendar day-এর operational report।
2. **Weekly** — Monday–Sunday একটি সম্পূর্ণ calendar week-এর summary।
3. **Custom range** — owner-এর দেওয়া inclusive start/end date; যেমন 20–25 হলে
   ছয়টি calendar day-এর report।

এটি accounting ledger বা invoice replacement নয়। এটি owner/manager-এর
operational এবং management reporting view। Final invoice, due amount ও
checkout billing-এর authoritative rule থাকবে
[`billing-contract.md`](./billing-contract.md)-এ।

---

## User experience

### Report period selector

`/dashboard/reports` header-এ বর্তমান single-date navigator-এর জায়গায় থাকবে:

| Control | Behaviour |
|---|---|
| **Daily** | একটি date picker; default আজ। Back/next arrow এক দিন করে যায়। |
| **Weekly** | selected date যে Monday–Sunday week-এ পড়ে, সেটি দেখায়। Back/next এক পূর্ণ week করে যায়। |
| **Custom** | `From` ও `To` date picker এবং **Apply** button। |
| Quick ranges | Today, Yesterday, This week, Last week, This month, Last 30 days। এগুলো convenience shortcut, আলাদা report type নয়। |

Screen-এ সবসময় human-readable period দেখাতে হবে, যেমন:

- `Daily report · 20 September 2026`
- `Weekly report · 14–20 September 2026`
- `Custom report · 20–25 September 2026 (6 days)`

### Custom range rules

- `from` এবং `to` দুটিই required।
- দুই date-ই resort-এর local timezone-এর calendar date; start এবং end **দুটিই
  inclusive**। তাই `20` থেকে `25` মানে 20, 21, 22, 23, 24, 25।
- `to` date `from`-এর আগে হলে Apply disabled এবং inline error দেখাবে:
  `End date must be the same as or after start date.`
- ভবিষ্যতের কোনো date range report করা যাবে না।
- initial release-এ সর্বোচ্চ **366 দিন**; বড় range চাইলে user-কে smaller
  range বা export ব্যবহার করতে বলা হবে। সীমাটি API-তেও enforce হবে।
- Apply না করা পর্যন্ত date field change-এ network request যাবে না।
- URL shareable হবে, উদাহরণ:
  `/dashboard/reports?period=custom&from=2026-09-20&to=2026-09-25`।
  Reload/back/forward-এ একই report ফিরবে।

### What owners see

সব period-এ একই ভাষা ও card pattern থাকবে, কিন্তু range-specific figures-এর
অর্থ header/subtitle-এ স্পষ্ট হবে:

- **Occupancy** — `room nights occupied / available room nights`, single
  দিনের live `Room.status` নয়।
- **Revenue collected** — নির্বাচিত range-এ successful payment-এর টাকা।
- **Charges posted** — food/extras সহ selected period-এ তৈরি হওয়া charge-এর
  value, যদি তা আলাদা দেখানো হয়। এটিকে `Revenue collected` বলা যাবে না।
- **Arrivals / departures / no-shows** — নির্বাচিত দিনগুলোর distinct booking
  event count। একই booking যেন দুইবার না আসে।
- **Operational activity** — housekeeping completed/pending এবং maintenance
  metrics। Pending is a clearly labelled **as-of end date** value, period sum নয়।

Range report-এ KPI-র নিচে ছোট explanatory label থাকবে, যেমন `Cash received
20–25 Sep`, যাতে owner ভুল করে outstanding invoice-কে collected money না ভাবেন।

---

## Reporting contract and calculations

### Canonical period type

API ও server code internal UTC timestamp নয়, tenant timezone-এ calendar
period নেবে:

```ts
type ReportPeriod = {
  from: 'YYYY-MM-DD'; // inclusive local calendar date
  to: 'YYYY-MM-DD';   // inclusive local calendar date
  timezone: string;
};
```

`from` local midnight থেকে `to + 1 day` local midnight পর্যন্ত half-open
interval (`>= start`, `< endExclusive`) বানাতে হবে। `23:59:59.999` ব্যবহার করা
যাবে না—DST এবং timestamp precision-এর কারণে এটি unsafe। Tenant-এ timezone
না থাকলে existing product default (`Asia/Dhaka`) explicitly use করতে হবে;
server machine timezone কখনো source of truth হবে না।

### Occupancy and room nights

Weekly/custom occupancy current room status count করে পাওয়া যাবে না। তা হলে
20–25 range-এ আজ occupied থাকা একটি room ছয় দিনই occupied বলে দেখাতে পারে।

প্রতিটি active room-এর জন্য range-এর প্রতিটি eligible night গণনা করতে হবে:

- **Available room nights:** active room × number of report nights, adjusted
  only for documented out-of-order/blocked policy.
- **Occupied room nights:** a qualifying checked-in/completed stay-এর সাথে
  overlap করা night count। Cancelled/no-show stays বাদ।
- **Occupancy rate:** `occupiedRoomNights / availableRoomNights × 100`.
- **Daily report:** একই engine ব্যবহার করবে, তবে এক-day period হওয়ায় familiar
  `occupied / total rooms` display রাখতে পারে।

Before implementation, product owner must approve whether a booking is
counted by planned dates, actual stay dates, or a documented fallback when
actual times are missing. Recommendation: actual check-in/check-out when
available; otherwise confirmed booking dates for forward operational reports.

### Revenue, charges, and payments

বর্তমান `buildDailyReport()` room payments, food orders এবং invoice extras-কে
এক total-এ যোগ করে। এই sources-এর dates এবং meanings এক নয়। New report must
never imply that these are the same thing.

The response will have separate blocks:

```ts
financial: {
  cashCollected: { roomPayments, ...byMethod, total },
  chargesPosted: { room, restaurant, extras, transfers, total },
  outstandingAsOfEnd: number | null,
}
```

- **Cash collected:** only successful, non-refunded payments whose
  `processedAt` falls inside the selected period. Payment method totals must
  equal the cash-collected total.

  > **Found while implementing, 2026-09-12.** This figure is structurally
  > incomplete, and the gap is in the data model rather than the report. A
  > restaurant order settled at the counter never creates a `Payment` row —
  > `POST /food-orders/:id/pay` only sets `FoodOrder.paymentStatus = 'PAID'`
  > and `paymentMethod`. There is also no column recording *when* it was paid;
  > `updatedAt` moves on any later edit, so it cannot stand in. Till money
  > taken at the restaurant is therefore invisible to cash-collected, for any
  > period.
  >
  > Closing it needs a `paidAt DateTime?` on `FoodOrder`, set where
  > `paymentStatus` is set, plus a decision about historical rows that have no
  > timestamp to backfill from. Until then the report says so in plain words
  > next to the figure rather than quietly under-reporting.
- **Charges posted:** only charge records whose business event occurred in the
  period; cancelled/voided food is excluded. This is not a substitute for an
  invoice total.
- **Outstanding as of end:** only expose after P0 billing contract can calculate
  it reliably. Until then hide it rather than returning a false number.
- **No double count:** room charge, food and extras must have a documented
  single source. When the P0 billing contract lands, report queries must use
  immutable invoice line/item provenance where appropriate.

The report page will temporarily retain existing “Revenue” UI only after its
label and API meaning are migrated to either **Cash collected** or **Charges
posted**. No mixed total is allowed.

### Events and operational metrics

| Metric | Range rule |
|---|---|
| Arrivals | actual check-in event in period; optionally scheduled arrivals shown in a separate `expected` list, never mixed. |
| Departures | actual check-out event in period; scheduled-but-not-out stay is a separate pending departure. |
| No-shows | booking’s scheduled check-in in period and final no-show condition, not merely still-confirmed at query time. |
| Housekeeping completed | task completion timestamp in period. |
| Housekeeping pending | tasks pending as of `to` end-of-day; do not sum the same unfinished task across days. |
| Maintenance resolved | `resolvedAt` within period. |
| Maintenance open | snapshot as of the selected end date, labelled accordingly. |

---

## API design

### New canonical endpoint

Add a period endpoint; keep current daily endpoint as a compatible wrapper
during rollout.

```
GET /api/reports/period?from=2026-09-20&to=2026-09-25
```

Rules:

- authenticated `OWNER` or `MANAGER` only, matching existing Reports access;
  no tenant ID is accepted from client input.
- validate strict `YYYY-MM-DD`, required fields, no future dates,
  `from <= to`, and a maximum 366-day inclusive range.
- resolve tenant timezone on server, build the period once, and pass that
  object to all report queries.
- return `400` with field-specific safe errors for invalid ranges; do not
  silently swap dates.
- return data even if there was no activity; all count/amount fields become
  zero and lists empty.

Suggested response shape:

```ts
{
  period: {
    kind: 'daily' | 'weekly' | 'custom',
    from: '2026-09-20',
    to: '2026-09-25',
    timezone: 'Asia/Dhaka',
    dayCount: 6,
  },
  tenant: { name, currency },
  occupancy: { availableRoomNights, occupiedRoomNights, rate },
  financial: { cashCollected, chargesPosted, outstandingAsOfEnd },
  arrivals: [], departures: [], noShows: [],
  housekeeping: {}, maintenance: {},
}
```

### Email, print, export, and auto-dispatch

- **Print:** print the selected report period and include `from → to`, tenant
  timezone, generation timestamp, and metric definitions in the footer.
- **Email:** `POST /api/reports/period/email` takes validated `from/to` and
  uses the same canonical builder. Subject example:
  `Report — Coral Bay Resort · 20–25 Sep 2026`.
- **Auto-dispatch:** stays daily-only in this release. It calls the daily
  period builder for the local report date. Weekly scheduled delivery is a
  later scoped feature, not an accidental side effect.

  > **Note added 2026-09-12.** The evening auto-dispatch does not currently run
  > on production at all. `startReportDispatchJob()` is called only from
  > `apps/api/src/worker.ts`, and the `worker` service has never existed in
  > Coolify's stored compose — so not one scheduled report has ever been sent.
  > Migrating the job to the canonical builder is still correct, but it will not
  > make dispatch start working. That needs the worker deployed, which is its
  > own decision: its first run acts on months of accumulated backlog. Do not
  > let this plan's completion be read as "scheduled reports now work".
- **Export:** Phase 2. Add CSV/PDF only after in-page/print totals are verified.
  Export must include period, timezone, generated time, and definitions.

---

## Implementation steps

### Phase 0 — metric decision and baseline tests

1. Confirm tenant timezone field/default and document business meanings for
   room nights, planned versus actual stay, cash collected and charges posted.
2. Capture existing daily API sample data and identify intentional changes in
   labels/totals. Do not call an old mixed number “revenue” after migration.
3. Add fixtures covering multi-day bookings, partial payments, cancelled food,
   late check-out, and an empty property.

### Phase 1 — backend period engine

1. Extract `dayBounds()` and `buildDailyReport()` from
   `apps/api/src/routes/reports.ts` into a tested reporting service, e.g.
   `apps/api/src/services/reporting/build-report.ts`.
2. Implement tenant-timezone local-date parsing and a half-open period helper.
3. Implement range queries, deduplication, room-night overlap calculation, and
   separate financial blocks.
4. Add `GET /reports/period`; make `/reports/daily` call the same builder with
   `from === to` until clients migrate.
5. Add precise query/schema indexes only after query-plan measurement for the
   tenant/date filters; do not add speculative indexes.

### Phase 2 — Reports UI

1. Update `apps/web/src/lib/api.ts` with typed period-report and period-email
   methods.
2. Replace only the current date navigation in
   `apps/web/src/app/(dashboard)/dashboard/reports/page.tsx` with the period
   selector, quick ranges, URL synchronization and validation states.
3. Keep the existing design-system patterns (`PageShell`, `PageHeader`, tokens,
   responsive layout). Do not introduce raw hard-coded design values.
4. Render range-aware headings, cards, tables and empty states. Clearly label
   snapshot-at-end metrics and financial metric meanings.
5. Update print and email actions to use the applied period, not unsaved form
   dates.

### Phase 3 — regression-safe rollout

1. Feature-flag `range_reports` by tenant or environment initially.
2. Compare one-day result from `/reports/daily` and `/reports/period` for a
   controlled fixture; differences require an explicit documented reason.
3. Release to internal/demo tenant first, then a small pilot group.
4. Monitor API latency, errors, report-generation duration, and owner support
   feedback. Roll back by hiding the new selector while keeping old daily API.

---

## Tests and acceptance criteria

### Automated API tests

- `20–25 Sep` returns `dayCount: 6` and uses inclusive dates.
- rejects invalid format, missing date, reversed range, future date and 367-day
  range with `400`.
- an event exactly at local start is included; event at next-day local midnight
  is excluded from the previous range.
- tenant isolation: one tenant cannot receive another tenant’s data.
- a booking spanning 20–25 contributes the correct number of room nights,
  rather than being multiplied by current room status.
- cancelled/voided food does not appear in charges; successful payment appears
  once in cash collected; refunded payment follows approved refund policy.
- no activity returns zero values and empty lists, not errors.
- same one-day fixture returns equivalent daily and period data after semantic
  migration.

### Manual QA

- Owner selects 20–25 and sees `Custom report · 20–25 … (6 days)`.
- Changing either custom date does not reload until **Apply**.
- Back/forward/reload retains applied range from the URL.
- This week, last week, this month and last 30 days return expected boundaries.
- Weekly navigation always moves whole Monday–Sunday weeks.
- Mobile layout keeps selector, print and email actions usable without overlap.
- Email and print show the exact selected range and timezone.
- Manager can view/send; receptionist cannot access report data.
- Light/dark modes remain legible and no design-system ratchet baseline grows.

---

## Files expected to change

| Area | Likely files |
|---|---|
| Reporting engine/API | `apps/api/src/routes/reports.ts`, new reporting service, API integration tests |
| Scheduled daily dispatch | `apps/api/src/jobs/daily-report-dispatch.ts` (switch to canonical daily-period builder) |
| Web API client | `apps/web/src/lib/api.ts` |
| Reports UI | `apps/web/src/app/(dashboard)/dashboard/reports/page.tsx` |
| Documentation | `plan/reports.md`, this plan, user docs for Reports |
| Schema/indexes | `packages/database/prisma/schema.prisma` only if benchmark proves a missing index |

## Out of scope for this release

- Replacing the P0 invoice/billing contract.
- Financial statements, accounting ledger, tax filings, or audited P&L.
- Scheduled weekly/monthly dispatch.
- Arbitrary unlimited historical range export.
- Cross-property consolidated reporting.

Those can be planned only after range definitions and the billing contract are
proven in production.

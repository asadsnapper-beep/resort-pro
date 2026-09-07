# Verify on production: the 28 commits released as `870605a`

Paste this whole file into a session that has access to production (Coolify at
the ResortPro deployment, `resortpro.site` / `api.resortpro.site`). It is a
verification task, not a fix task — report observations, and change nothing
unless a step says to.

---

## What was released

`main` was fast-forwarded from `dev`: `8d8540a..870605a`, 28 commits, 104
files. CI, Build & Push, and Deploy to Production all reported success.

**Four migrations** ship with it, all additive — new tables, columns and
indexes. Nothing is dropped and no monetary value is rewritten:

| Migration | What it adds |
|---|---|
| `20260906000000_food_order_settlement` | `food_orders.settlement` (enum, default `PAY_NOW`), `compReason`, `compBy`, `idempotencyKey`, unique `(tenantId, idempotencyKey)`; labels existing orders that carry a `bookingId` as `CHARGE_TO_ROOM` |
| `20260907000000_stay_time_policy` | tables `stay_time_policies`, `stay_time_grants` |
| `20260907010000_stay_time_grant_uniqueness` | `stay_time_grants.activeKey`, `invoiceExtraId`, unique `(bookingId, kind, activeKey)` |
| `20260907020000_housekeeping_not_before` | `housekeeping_tasks.notBefore` |

Both new features sit behind flags that are **off** for every tenant
(`restaurant_module` already existed; `stay_time_policy` is new and defaults to
off), so no resort's behaviour changes until someone turns them on.

---

## Already established — do not re-investigate

- All three production workflows passed on `870605a`.
- **The new image is genuinely serving.** Probed from outside, unauthenticated:
  `GET /health` → 200, and both routes that are new in this release —
  `/api/bookings/in-house` and `/api/bookings/:id/stay-time` — return **401**,
  not 404. A stale image would 404 them. So the "green deploy, old container"
  failure mode is already ruled out.
- What is **not** established is whether the four migrations ran. Migrations
  execute inside the API container at startup (Dockerfile CMD), never from the
  GitHub runner — the runner cannot reach the database. A route can exist while
  the table behind it does not, and the first real query then 500s.

---

## Checks, in order

Report what you observe at each step.

**1 — Did the migrations apply?**

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE migration_name IN (
  '20260906000000_food_order_settlement',
  '20260907000000_stay_time_policy',
  '20260907010000_stay_time_grant_uniqueness',
  '20260907020000_housekeeping_not_before'
)
ORDER BY migration_name;

SELECT migration_name, started_at
FROM _prisma_migrations
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;
```

Four rows with a `finished_at` and no `rolled_back_at`; the second query should
return zero rows. Anything in the second query is a failed migration blocking
every later one (P3009) — report it, do not try to resolve it.

**2 — Do the new tables and columns exist?**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('stay_time_policies', 'stay_time_grants');

SELECT column_name FROM information_schema.columns
WHERE (table_name = 'food_orders' AND column_name IN ('settlement','idempotencyKey'))
   OR (table_name = 'housekeeping_tasks' AND column_name = 'notBefore');
```

**3 — Did the food-order backfill label the right rows?**

```sql
SELECT settlement, count(*), count("bookingId") AS with_booking
FROM food_orders GROUP BY 1;
```

Every `CHARGE_TO_ROOM` row should have a booking. A `PAY_NOW` row **with** a
booking means the backfill did not run — report it with the row's `createdAt`,
because an order created after the migration is a different question from one
that existed before it.

**4 — Is anything erroring in the API container?**

```
docker logs --since 30m <api container> 2>&1 | grep -iE "error|P2021|P2022|does not exist" | tail -30
```

`P2021` (table does not exist) or `P2022` (column does not exist) would mean the
code is ahead of the database. Report what you see, including "nothing".

**5 — Is the site itself well?**

Open `https://resortpro.site` and sign in to a real tenant's dashboard. Confirm
the dashboard, Front Desk and Bookings pages load. Nothing about early check-in
or restaurant room-charging should appear anywhere, because both flags are off —
if a new panel or a "Who is this order for?" selector is visible, say so.

---

## Safety rules

- **Never** run `prisma db push`, `migrate reset`, or `--accept-data-loss`.
- **Never** run `migrate resolve` without reporting first and being told to.
- Do not touch the postgres volume. Do not delete containers or volumes.
- Read-only SQL only. No `UPDATE`, `DELETE` or `ALTER` at any step.
- If anything suggests data loss or a failed migration, **stop and report**.

---

## What counts as verified

Four migrations finished, the tables and columns exist, the backfill labelled
only booking-attached orders, the container log is clean of P2021/P2022, and the
dashboard loads with no new UI visible.

If step 1 shows the migrations missing while the routes answer 401, the
container is running new code against an old database — that is the one
combination that needs acting on quickly. Report it before doing anything.

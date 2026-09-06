# Verify on staging: restaurant charges to the room (commit `d738672`)

Paste this whole file into a session that has access to the Home Server
(Portainer at `docker.webcoronet.com`, staging at `resortpro.webcoronet.com`).
It is a verification task, not a fix task — report observations, change nothing
unless a step explicitly says to.

---

## What was shipped

Seven commits went to `dev`, ending at
`d7386727a8b16d61f1a3c9ac9d58dab87bb50c01`. They let a restaurant order be
charged to a staying guest's room and reach their bill at checkout.

**One migration** ships with them:
`packages/database/prisma/migrations/20260906000000_food_order_settlement/`

```sql
CREATE TYPE "FoodSettlement" AS ENUM ('PAY_NOW','CHARGE_TO_ROOM','COMPLIMENTARY','CORPORATE');
ALTER TABLE "food_orders" ADD COLUMN "settlement" "FoodSettlement" NOT NULL DEFAULT 'PAY_NOW',
  ADD COLUMN "compReason" TEXT, ADD COLUMN "compBy" TEXT, ADD COLUMN "idempotencyKey" TEXT;
UPDATE "food_orders" SET "settlement" = 'CHARGE_TO_ROOM' WHERE "bookingId" IS NOT NULL;
CREATE UNIQUE INDEX "food_orders_tenantId_idempotencyKey_key" ON "food_orders"("tenantId","idempotencyKey");
```

It is additive. It drops nothing and changes no monetary value — the `UPDATE`
only labels orders that were already attached to a booking.

---

## Already established — do not re-investigate

- CI passed on `d738672`.
- "Deploy to Staging (Portainer)" passed, and its own verification step read the
  stack back and printed
  `Portainer stack pins dev-d7386727a8b16d61f1a3c9ac9d58dab87bb50c01`.
  **So the stack definition is correct. The open question is whether the running
  containers and the database actually followed it.**
- A green Portainer deploy has previously coexisted with the old image still
  serving traffic. Health checks hit `/health`, which every version answers.
- Migrations run **inside the API container at startup** (Dockerfile CMD), not
  from the GitHub runner — the runner cannot reach the DB (docker-internal host
  `postgres`). So a container that never restarted is also a migration that
  never ran.
- The API image ships only `dist/` and has no `tsx`. Scripts run as
  `node dist/scripts/<name>.js`.
- Known unrelated host issue: containers sometimes stick in `Created` on this
  machine. If you see that, report it — the root cause is still unknown and is
  not this commit's doing.

---

## Checks, in order

Report what you observe at each step, not a conclusion.

**1 — Which image is actually running?**

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -i resort
```

Report the image tag and status for the API and web containers. The tag should
end `dev-d7386727a8b16d61f1a3c9ac9d58dab87bb50c01`. A container showing plain
`:dev`, an older SHA, `Created`, or a restart loop is the finding.

**2 — Did the migration apply?**

```bash
docker exec <postgres-container> psql -U <user> -d <db> -c \
  "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
   WHERE migration_name LIKE '%food_order_settlement%';"
docker exec <postgres-container> psql -U <user> -d <db> -c \
  "SELECT migration_name, started_at FROM _prisma_migrations
   WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;"
```

Report both. The second query should return zero rows; anything in it is a
failed migration blocking every later one (P3009) and is the finding.

**3 — Do the columns exist?**

```bash
docker exec <postgres-container> psql -U <user> -d <db> -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name='food_orders'
     AND column_name IN ('settlement','compReason','compBy','idempotencyKey');"
```

Expect four rows.

**4 — Did the backfill label the old orders?**

```bash
docker exec <postgres-container> psql -U <user> -d <db> -c \
  "SELECT settlement, count(*), count(\"bookingId\") AS with_booking
   FROM food_orders GROUP BY 1;"
```

Report the table. Every `CHARGE_TO_ROOM` row should have a booking; no
`PAY_NOW` row should have one. If a `PAY_NOW` row has a `bookingId`, say so —
that means the backfill did not run.

**5 — Is the new code actually serving?**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://resortpro-api.webcoronet.com/api/bookings/in-house
```

`GET /api/bookings/in-house` is **new in this commit**, so this probe is
meaningful here: `401` means the route exists and is asking for auth — the new
image is serving. `404` means the old image is still running, whatever
Portainer's stack file says.

**6 — Does the page load?**

Open `https://resortpro.webcoronet.com/dashboard/orders`, sign in, and click
"New Order". Report whether the form asks **"Who is this order for?"** with two
choices (*Restaurant guest* / *Staying with us*). If it still shows a "Guest
(optional)" dropdown and a free-text "Table Number", the web container is stale.

---

## Safety rules

- **Never** touch the postgres volume.
- **Never** run `prisma db push`, `migrate reset`, or `--accept-data-loss`.
- `docker system prune` only with `--volumes=false`, and only if asked.
- Do not touch production (Coolify). This is the staging Home Server only.
- If anything suggests data loss, stop and report before doing anything else.

---

## What counts as verified

All six checks pass: the containers run the `d738672` tag, the migration row has
a `finished_at`, the four columns exist, the backfill labelled only
booking-attached orders, `/api/bookings/in-house` returns `401`, and the order
form shows the two settlement choices.

If checks 1–4 pass but 5 or 6 fail, the database is ahead of the containers —
report it rather than redeploying, so the cause is visible.

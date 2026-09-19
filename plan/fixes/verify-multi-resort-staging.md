# Verify on staging: one owner, several resorts

Paste this whole file into a session that has access to the Home Server
(Portainer at `docker.webcoronet.com`, staging at `resortpro.webcoronet.com`).
**This is a verification task, not a fix task** — report what you observe and
change nothing except the test data these steps create.

Run it **after** the multi-resort commits are deployed to staging. Nothing here
touches production.

---

## What shipped

Thirteen commits, ending at `a2dc8bc`. They let one owner run several resorts
as separate ResortPro accounts, switch between them, and see all of them on one
page. Design: `plan/multi-resort.md`.

**Two migrations**, both additive:

```sql
-- 20260919000000_resort_groups
CREATE TYPE "ResortAccess" AS ENUM ('FULL','NUMBERS_ONLY');
CREATE TABLE "resort_groups" (…);
CREATE TABLE "resort_group_tenants" (…);
CREATE TABLE "resort_link_requests" (…);
CREATE TABLE "resort_group_events" (…);

-- 20260920000000_resort_link_created_user
ALTER TABLE "resort_group_tenants" ADD COLUMN "linkedUserCreated" BOOLEAN NOT NULL DEFAULT false;
```

They create four new tables and one new column. **No existing column is
altered, renamed or dropped**, and no existing row is written to.

---

## Already established — do not re-investigate

- The full API suite passes locally (636 of 637; the one failure is an
  unrelated env leak from `tests/unit/messaging.test.ts`, filed separately).
- The web suite passes (90/90) and `next build` compiles all new routes.
- Migrations run **inside the API container at startup**, not from the GitHub
  runner. A container that never restarted is a migration that never ran.
- A green Portainer deploy has before now coexisted with the old image still
  serving traffic; `/health` answers on every version, so it proves nothing.

---

## Step 1 — is the new code actually running?

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -E 'api-|web-'
```

Then, inside the API container:

```bash
docker exec $(docker ps -qf 'name=api-') sh -c 'ls /app/packages/database/prisma/migrations | tail -5'
```

**Expect** `20260919000000_resort_groups` and
`20260920000000_resort_link_created_user` in that listing. If they are missing,
the image is old — stop here and report that.

## Step 2 — did the migrations apply?

Read-only. Do not run `prisma db push`, `migrate reset`, or anything with
`--accept-data-loss`.

```bash
docker exec $(docker ps -qf 'name=postgres') psql -U resortpro -d resortpro -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_name LIKE 'resort_%' ORDER BY 1;"
```

**Expect** exactly four rows: `resort_group_events`, `resort_group_tenants`,
`resort_groups`, `resort_link_requests`.

```bash
docker exec $(docker ps -qf 'name=postgres') psql -U resortpro -d resortpro -c "
  SELECT column_name, data_type, column_default FROM information_schema.columns
  WHERE table_name = 'resort_group_tenants' ORDER BY ordinal_position;"
```

**Expect** `linkedUserCreated` present, `boolean`, default `false`.

## Step 3 — nothing changed for a resort that has no group

This is the regression that matters most: almost every account on staging is a
single resort and must be untouched.

Sign in to any existing staging resort in a browser and check:

1. The sidebar still shows the **resort name as plain text** — no dropdown.
2. There is **no "All Resorts"** entry in the sidebar.
3. Settings has a **"Your Resorts"** tab (owners only) whose only content is
   "Open another resort". No connection sections, no history.
4. `/dashboard` and `/dashboard/billing` load and look exactly as before.

Report anything that looks different from before this deploy.

## Step 4 — the journey, end to end

Do this in the browser, as a real owner would. Use throwaway names so the data
is easy to find and remove.

**4a. Open a second resort.** Settings → Your Resorts → *Open another resort*.
Name it `QA Second`, address `qa-second-<today>`.

- Expect: it is created, you land inside it, and it is unpaid (read-only, with
  the plan prompt).
- Expect: the sidebar resort name is now a **dropdown** with both resorts.
- Expect: an **All Resorts** entry appears in the sidebar.

**4b. The price.** Inside `QA Second`, open Billing.

- Expect: the monthly price shown is **10% below** the price the first resort
  sees. Note both numbers in your report.
- Go back to the first resort and check its price is **unchanged**.

**4c. The 360 page.** Open **All Resorts**.

- Expect: both resorts as cards, a totals row, and each card showing its own
  local date.
- Expect: clicking the second resort's card switches into it.

**4d. Ask for somebody else's resort.** Still in resort one, Settings → Your
Resorts. There is no "connect existing" control in the UI yet, so use the API
with your session token from devtools:

```bash
curl -s https://resortpro.webcoronet.com/api/resort-group/links \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"slug":"<some other staging resort slug>"}'
```

- Expect: `{"success":true,"data":{"status":"requested"}}`.
- Expect: **no** membership row for that resort:

```bash
docker exec $(docker ps -qf 'name=postgres') psql -U resortpro -d resortpro -c "
  SELECT t.slug, m.access FROM resort_group_tenants m
  JOIN tenants t ON t.id = m.\"tenantId\";"
```

**4e. Approve it.** Sign in as that other resort's owner. A banner should be
waiting at the top of the dashboard.

- Choose **Share the figures only**.
- Expect: back in resort one, **All Resorts** shows its numbers, and its card
  is **not clickable**.
- Expect: no new user row in that resort:

```bash
docker exec $(docker ps -qf 'name=postgres') psql -U resortpro -d resortpro -c "
  SELECT count(*) FROM users WHERE \"tenantId\" = '<that tenant id>';"
```
  Compare with the same count taken before approving.

**4f. Raise it, then take it away.** As that resort's owner: Settings → Your
Resorts → *Give full access*, then from resort one switch into it (expect it to
work), then as its owner *Reduce to figures only*.

- Expect: the session that was inside it is thrown out **on its next click**,
  not later.

## Step 5 — clean up

Remove only what these steps created:

- Disconnect the connections from Settings → Your Resorts on each side.
- Report the `QA Second` tenant's id and slug; **do not delete it yourself** —
  deleting a tenant cascades, and it should be done deliberately.

---

## Bring back

1. Whether both migrations are in the running image and applied (steps 1-2).
2. Step 3's four checks, each pass or fail — this is the regression gate.
3. For step 4: what happened at each of 4a-4f, with the two prices from 4b and
   the two user counts from 4e.
4. Anything that behaved differently from what is written above, quoted exactly
   rather than summarised.
5. The id and slug of every row these steps created that you did not remove.

## Do not

- Touch production (Coolify). This is the staging Home Server only.
- Run any write SQL. Every query above is a `SELECT`.
- Run `prisma db push`, `prisma migrate reset`, or anything with
  `--accept-data-loss`.
- Delete a tenant.

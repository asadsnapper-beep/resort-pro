# Prompt — staging Postgres unreachable (31 Aug 2026)

Paste the block below into a session that has access to the home server
(Portainer at `resortpro.webcoronet.com`). Everything above the block is
context for you, not for the agent.

---

## What is already known (do not re-establish)

- Web (Next.js) responds `200`.
- The API container is **running** — it answers requests and returns a Prisma
  error, so it did not fail to start.
- The error is `Can't reach database server at postgres:5432`.
- The last two `dev` deploys both reported success (CI and Portainer).
- Therefore: **the API is alive and Postgres is not reachable from it.** The
  fault is the `postgres` service or the network between them, not the
  application code.
- A migration failure would have prevented the API container from starting at
  all (`apps/api/Dockerfile` CMD chains `prisma migrate deploy && … && node
  dist/index.js`), so the migration is not the cause of *this* symptom.

---

## The prompt

```
The ResortPro staging site (https://resortpro.webcoronet.com, Portainer,
`dev` branch, stack `resortpro-staging`) is failing with:

  Can't reach database server at `postgres:5432`

Established already — do not spend time re-confirming:
- The web container serves 200.
- The API container is running; it answers and returns the Prisma error above.
- The last two dev deploys reported success.
- So the API is alive and Postgres is unreachable. This is infrastructure,
  not application code.

Diagnose and fix, in this order, reporting what you actually observe at each
step rather than what you expect:

1. State of the `postgres` container in the `resortpro-staging` stack:
   running / exited / restarting / unhealthy, and its exit code if any.
2. Last 100 lines of the postgres container log. Classify the cause:
   - "No space left on device"        → disk full
   - "out of memory" / OOM-killed     → RAM exhausted
   - "database system was not properly shut down" → unclean stop, usually
     self-healing on restart
   - nothing, container simply gone   → host reboot
3. Host capacity regardless of what the log says: `df -h` and `docker system df`.
   A disk that is full or nearly full explains most of the failures above and
   will recur immediately if it is not addressed first.
4. Whether the API and postgres containers are on the same docker network,
   and whether the hostname `postgres` resolves from inside the API container.
5. Apply the smallest fix that addresses the cause you identified, then confirm
   recovery by observation, not assumption:
   - `pg_isready` inside the postgres container
   - the site loading and a login succeeding
   - `prisma migrate status` inside the API container — the most recent
     migration should be `20260831000000_billing_provenance_and_finalisation`

HARD RULES — these protect real data:
- NEVER delete, recreate or prune the `postgres_staging_data` volume.
- If you run `docker system prune`, it MUST include `--volumes=false`.
- NEVER run `prisma db push`, `migrate reset`, or anything with
  `--accept-data-loss`. Migrations only.
- Do NOT "redeploy" or "recreate" the stack as a first move. If the disk is
  full, recreating fixes nothing and risks the volume. Find the cause first.
- Do not touch the production server (Coolify, app.resortpro.site). This is
  staging only.
- If the cause turns out to be data loss or corruption, STOP and report before
  attempting any repair.

Report back: the cause, what you changed, and the evidence that staging is
working again.
```

---

## After staging is back up

The reason this matters right now: a full P0 billing rework is deployed to
staging and has never been exercised there. Run this before anything is
merged to `main`.

```
Staging is running the new billing code. Verify it on real data before it goes
near production.

1. Front Desk → check out a guest who arrived through a NORMAL booking, not a
   walk-in. Normal bookings already carry a DRAFT invoice from booking time,
   and that path had a bug that would have failed every checkout — it is fixed
   and tested locally, but has never run against staging data.

   Expect: the Check Out box lists room, food and other charges separately;
   the balance due is higher than the room-only figure it used to show;
   confirming succeeds without an error.

2. Invoices page: the invoice for that booking should now be PAID (or PARTIAL),
   not DRAFT, and its total should match what the Check Out box showed.

3. Create an F&B order against an in-house guest, set it to DELIVERED, and
   check out. The food must appear on the bill. Repeat with the order left at
   PREPARING — it must NOT be billed, and an amber warning naming the amount
   must appear instead.

4. Optional, no hurry: in the API container,
   `node dist/scripts/backfill-finalized-invoices.js` (dry run — prints only),
   then `--apply` if the list looks right. It stamps historical invoices as
   finalized and deliberately changes no monetary value. (The container ships
   only `dist/` and has no `tsx`.)

If any step errors, stop and report it. Do not merge dev into main until 1–3
pass.
```

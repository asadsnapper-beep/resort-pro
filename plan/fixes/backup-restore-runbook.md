# Backup and restore runbook

## What exists

A `backup` service in every compose file runs [scripts/backup-db.sh](../../scripts/backup-db.sh)
once at start and then daily. Each run does a `pg_dump -Fc`, verifies the file
with `pg_restore --list`, and deletes dumps older than `BACKUP_RETENTION_DAYS`
(default 14).

The service runs the **API image**, which carries the scripts and
`postgresql16-client`. It does not bind-mount them from the host, because the
staging deploy hands Portainer the compose file as a *string* — the repo is not
on that machine and a bind mount would resolve to an empty directory.

Dumps land in the `backups_data` volume (`backups_staging_data` on staging), at
`/backups/<db>-<UTC timestamp>.dump`.

## What this protects against, and what it does not

Covered: a bad migration, a mistaken delete, operator error, a corrupted table
— the failures that actually happen.

**Not covered: losing the host.** The dumps sit on the same machine as the
database. Copying the volume off-box is the remaining step and has not been
done. Do not describe the system as backed up to anyone until it has.

## Check backups are running

```bash
docker compose logs backup --tail 20
docker compose exec backup ls -lh /backups
```

A healthy run logs `[backup] ok — <bytes> bytes, <n> tables with data`. If the
directory is empty more than a few minutes after start, the service is failing —
read the logs rather than assuming it is slow.

## Restore

`restore-db.sh` requires an explicit target database and never defaults to one.
The common reason to run it is a rehearsal, and the obvious default would be
production.

**Always restore into a scratch database first and check it**, even when you
intend to overwrite production. Confirming the dump is good costs a minute;
discovering it is not, after overwriting, costs the data.

```bash
# 1. pick a dump
docker compose exec backup ls /backups

# 2. restore it somewhere harmless
docker compose exec postgres psql -U resortpro -d postgres -c "CREATE DATABASE restore_check;"
docker compose exec backup sh /app/scripts/restore-db.sh /backups/<file>.dump restore_check

# 3. look at what came back before trusting it
docker compose exec postgres psql -U resortpro -d restore_check -c \
  "SELECT (SELECT count(*) FROM tenants) tenants, (SELECT count(*) FROM bookings) bookings;"
```

Only then, if the counts are right and you have decided to overwrite production,
run the same restore against the real database — and take a fresh dump first, so
the current state is recoverable if the restore turns out to be the wrong call.

## Rehearsal result — 18 August 2026

Run against a scratch Postgres 16 seeded with 2 tenants and 370 bookings:

| Step | Result |
|---|---|
| Backup + verify | ok, 2 tables with data |
| Drop both tables (simulated loss) | `bookings` gone |
| Restore into an isolated database | completed |
| Row counts | 2 tenants, 370 bookings, 250/120 tenant split — exact |
| Sum of `amount` | 528,635 — matches the computed value |
| Foreign key | survived |
| Truncated dump | rejected, exit 1 — refused to restore |
| Good dump | exit 0 |

## Before a migration on real data

Take a dump first and confirm it verified. The API container runs
`prisma migrate deploy` on start with no gate in front of it, so the backup is
the only thing standing between a bad migration and the data.


---

# Before the worker runs for the first time

`worker.ts` has never been deployed. Its first run acts on a backlog that has
been accumulating the whole time, so do these two things on the target database
*before* starting it.

## 1. Silence the stale trial-email backlog

The job mails every tenant currently inside a lifecycle window. Left alone, day
one sends win-backs about trials that ended weeks ago, and a 30-day notice that
tells people their data is scheduled for deletion — which nothing in this
codebase actually does.

```bash
docker compose exec api npx tsx src/scripts/suppress-trial-email-backlog.ts
```

Dry run first: it prints exactly who would be mailed, split into what it will
suppress and what it will let through. Then:

```bash
docker compose exec api npx tsx src/scripts/suppress-trial-email-backlog.ts --apply
```

It suppresses only the backward-looking stages. Forward warnings still go out —
a trial ending in three days should be warned today. `--all` silences those too.

## 2. Count what the pending-booking sweep will cancel

`expire-pending-bookings` cancels every unpaid PENDING booking older than 30
minutes, and has a backlog to work through.

```bash
docker compose exec postgres psql -U resortpro -d resortpro -c \
  "SELECT count(*) FROM bookings WHERE status='PENDING' AND \"paidAmount\" <= 0 AND \"createdAt\" < now() - interval '30 minutes';"
```

Dashboard-created bookings are `CONFIRMED` and walk-ins are `CHECKED_IN`, so
this only reaches abandoned public-website holds — rooms that have been falsely
blocked all along. Still worth knowing the number before it happens, rather than
explaining it afterwards.

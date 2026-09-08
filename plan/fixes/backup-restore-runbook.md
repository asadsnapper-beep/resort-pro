# Backup and restore runbook

## What exists

A `backup` service in every compose file runs [scripts/backup-db.sh](../../scripts/backup-db.sh)
once at start and then daily. Each run does a `pg_dump -Fc`, verifies the file
with `pg_restore --list`, and deletes dumps older than `BACKUP_RETENTION_DAYS`
(default 14).

It then chains [scripts/backup-uploads.sh](../../scripts/backup-uploads.sh),
which tars the uploads volume. That half is not optional: `guest_documents`
rows hold only a URL, and the passport and ID photos themselves live on disk.
A dump alone restores every row and no image — a database full of broken links,
which looks like a successful restore until someone opens a document.

The archive is a plain `tar`, not `tar.gz`: the contents are JPEG/PNG/WebP and
already compressed. It is verified with `tar -tf` before it is kept, and pruned
on the same retention as the dumps.

If the uploads volume is not mounted into the backup container, the run **fails
loudly and says so**. Silently archiving nothing is the exact bug this closes.

The service runs the **API image**, which carries the scripts and
`postgresql16-client`. It does not bind-mount them from the host, because the
staging deploy hands Portainer the compose file as a *string* — the repo is not
on that machine and a bind mount would resolve to an empty directory.

Both land in the `backups_data` volume (`backups_staging_data` on staging), at
`/backups/<db>-<UTC timestamp>.dump` and `/backups/uploads-<UTC timestamp>.tar`.
The uploads volume is mounted at `/app/uploads` **read-only** — this sidecar
archives guest documents, it must never be able to alter or delete them.

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

A healthy run logs two `[backup] ok` lines — `<n> tables with data` for the
dump, `<n> file(s)` for the uploads archive. **One without the other is a
failure**, and the log says which: `uploads dir ... is not mounted` means the
compose change adding `- uploads_data:/app/uploads:ro` never reached this
environment. On production that compose lives in Coolify's own database rather
than in git, so it has to be edited there by hand.

If the directory is empty more than a few minutes after start, the service is
failing — read the logs rather than assuming it is slow.

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

### Restoring the documents too

The dump does not carry them. Restore the matching archive — the one with the
same timestamp, so rows and files agree — into the API's uploads volume:

```bash
docker compose exec backup ls /backups/uploads-*.tar
docker compose exec api sh -c 'tar -xf /backups/uploads-<stamp>.tar -C /app/uploads'
```

That needs `/backups` visible to the `api` service, which it normally is not.
Either mount it for the restore, or copy the archive through the host with
`docker cp`. Then open one guest document in the dashboard: a restore that has
not had a single image opened has not been checked.

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

## 1. Stale trial-email backlog — handled automatically

**No action required.** This used to be a manual step here, and it was not a
workable one: the worker container starts seconds after the deploy, so there is
no window in which to run a script that is supposed to protect against what the
worker does on startup. A safeguard that has to win a race against the thing it
guards is not a safeguard.

The job now suppresses its own backlog on the first run in an environment,
detected by trial_email_logs being empty. Backward-looking stages (expired and
the win-backs) are marked as already sent; forward warnings still go out,
because a trial ending in three days should be warned today.

The script is still there for when you want to see the list or make the call
yourself, and it dry-runs by default:

```bash
docker compose exec api npx tsx src/scripts/suppress-trial-email-backlog.ts
docker compose exec api npx tsx src/scripts/suppress-trial-email-backlog.ts --apply
```

After the first deploy, check what it decided:

```bash
docker compose logs worker | grep "First run"
```

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

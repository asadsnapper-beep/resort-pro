# Verify the daily backup on staging (round 2)

Paste this whole file into a session that can reach the staging server.
Read-only apart from reading logs.

---

## What changed since the last check

The last check found two things. Both are now fixed and deployed to staging in
`46d7e7a`:

1. **`PGPASSWORD` was empty.** `docker-compose.staging.yml` spelled the password
   three times; the postgres service and `DATABASE_URL` both defaulted it to
   `resortpro_staging`, and the backup service alone read it bare. So the
   database had a password and the backup connected without one. `pg_dump` had
   been failing every night, unread. It now uses the same default as the other
   two.

2. **A failing dump cancelled the uploads backup.** The uploads archive was
   chained onto the end of the dump under `set -e`, so pg_dump failing stopped
   the script before it ran. `backup-db.sh` is now an orchestrator that runs
   `backup-postgres.sh` and `backup-uploads.sh` as separate processes and
   reports on both.

The manual run already proved the uploads logic works. What is unproven is the
**container's own scheduled run** — which is the only one that matters, and the
one that was broken.

## 1. Read the container's own startup run

The stack was just redeployed, so the backup container has run once on start.
Do not run anything by hand first — that would hide the thing being checked.

```bash
docker ps --format '{{.Names}}' | grep -i backup
docker logs <backup-container-name> 2>&1 | grep '\[backup\]'
```

Expect **two** `ok` lines from that one run:

```
[backup] dumping resortpro_staging from postgres → /backups/resortpro_staging-<stamp>.dump
[backup] ok — <bytes> bytes, <n> tables with data
[backup] pruned 0 dump(s) older than 14 days
[backup] archiving /app/uploads → /backups/uploads-<stamp>.tar
[backup] ok — <bytes> bytes, <n> file(s)
[backup] pruned 0 upload archive(s) older than 14 days
```

- `fe_sendauth: no password supplied` still present → the stack did not pick up
  the new compose. Say so.
- dump line fine, uploads line missing → say so; that is the coupling bug back.
- both `ok` → this is the result we are after.

## 2. Confirm both files exist from that run

```bash
docker exec <backup-container-name> ls -lh /backups
```

Expect a `.dump` and a `.tar` with timestamps within a second or two of each
other. **The `.dump` is the one that has never existed on staging before** — if
it is there, staging has a database backup for the first time.

## 3. Prove the dump is actually restorable

A dump that has never been read is not a backup. This is read-only against the
existing database — it restores into a **new scratch database**, never over
`resortpro_staging`:

```bash
docker exec <postgres-container> psql -U resortpro -d postgres -c "CREATE DATABASE restore_check;"
docker exec <backup-container-name> sh -c 'sh /app/scripts/restore-db.sh $(ls -t /backups/*.dump | head -1) restore_check'
docker exec <postgres-container> psql -U resortpro -d restore_check -c \
  "SELECT (SELECT count(*) FROM tenants) tenants, (SELECT count(*) FROM bookings) bookings, (SELECT count(*) FROM guest_documents) docs;"
```

Compare those three counts against the live database:

```bash
docker exec <postgres-container> psql -U resortpro -d resortpro_staging -c \
  "SELECT (SELECT count(*) FROM tenants) tenants, (SELECT count(*) FROM bookings) bookings, (SELECT count(*) FROM guest_documents) docs;"
```

They should match. Then clean up the scratch database:

```bash
docker exec <postgres-container> psql -U resortpro -d postgres -c "DROP DATABASE restore_check;"
```

## 4. Report back

- the full `[backup]` log block from step 1 — both `ok` lines or whichever is missing
- the `ls -lh /backups` listing
- the two count rows from step 3, side by side

Nothing here touches `resortpro_staging` except to read from it.

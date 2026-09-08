# Verify the guest-document backup on staging

Paste this whole file into a session that can reach the staging server.
Everything here is read-only apart from one backup run, which only writes into
the backups volume.

---

## What is being checked

Commit `757e791` (deployed to staging) makes the daily backup archive the
uploads volume as well as dumping the database. Until now `guest_documents`
rows were backed up and the passport and ID photographs they point at were not,
so a restore would have produced a database full of broken links.

Staging received the compose change automatically — its deploy workflow sends
the whole compose file as text. So no edit is needed here; this is purely
checking that it works before the same thing is turned on for production.

## 1. Did the mount arrive?

```bash
docker ps --format '{{.Names}}' | grep -i backup
docker inspect <backup-container-name> --format '{{range .Mounts}}{{.Name}} -> {{.Destination}} (rw={{.RW}}){{println}}{{end}}'
```

Expect two mounts: `backups_staging_data -> /backups` and
`uploads_staging_data -> /app/uploads (rw=false)`.

`rw=false` matters. This sidecar archives guest ID photographs; it must not be
able to alter or delete them.

If the uploads mount is absent, the deploy did not replace the stack — say so
and stop.

## 2. Run one backup and read what it says

```bash
docker exec <backup-container-name> sh /app/scripts/backup-uploads.sh
```

Expect:

```
[backup] archiving /app/uploads → /backups/uploads-<stamp>.tar
[backup] ok — <bytes> bytes, <n> file(s)
```

**If `<n>` is 0, stop and report it.** An empty archive reporting success is
the exact failure this change exists to prevent — it would mean the mount is
pointing somewhere empty.

## 3. Are the guest documents actually inside?

```bash
docker exec <backup-container-name> sh -c 'tar -tf $(ls -t /backups/uploads-*.tar | head -1) | grep guest-docs | head -5'
docker exec <backup-container-name> sh -c 'tar -tf $(ls -t /backups/uploads-*.tar | head -1) | grep -c guest-docs'
```

Paths look like `./<tenant-id>/guest-docs/<hex>.jpg`. The count is the number
that matters.

If the count is 0 but step 2 found files, that is not necessarily a failure —
it can simply mean no guest document has ever been uploaded on staging. Check:

```bash
docker exec <postgres-container> psql -U resortpro -d resortpro -t -c \
  "SELECT count(*) FROM guest_documents;"
```

If that count is also 0, upload one document from the dashboard (Guests → any
guest → Documents → Scan Document) and repeat step 2. A backup of nothing
proves nothing.

## 4. Does the daily loop do it on its own?

Step 2 ran the script by hand. Confirm the scheduled run does it too:

```bash
docker logs --tail 40 <backup-container-name> | grep '\[backup\]'
```

Expect **two** `[backup] ok` lines per run — one ending `tables with data`
(the dump), one ending `file(s)` (the uploads). One without the other is a
failure, and the log line above it says which.

## 5. Report back

- the two mounts from step 1, including `rw=false`
- both `[backup] ok` lines
- the `guest-docs` count from step 3
- whether step 4 shows both lines from the container's own daily run

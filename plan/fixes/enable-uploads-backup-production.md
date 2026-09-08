# Turn on the guest-document backup on production

Paste this whole file into a session that has access to the servers.

---

## Why

Until now the daily backup ran `pg_dump` and nothing else. `guest_documents`
rows carry only a URL; the passport and ID photographs those URLs point at live
on disk in the `uploads_data` volume, which the backup container could not see.
A restore would have brought back every row and no image.

The new code archives the uploads volume too. The script ships inside the image,
so it arrives with the deploy on its own. The **volume mount** cannot: production's
compose lives in Coolify's own database, not in git, and the deploy workflow only
rewrites image tags in it.

Staging needs nothing: its workflow sends the whole compose file as text.

**Do this BEFORE the new image reaches production.** The mount is inert to the
image running there today — the current `backup-db.sh` never looks at
`/app/uploads`, so adding the volume changes nothing until the new code arrives.
Adding it first means production works on its first run. Adding it after means
every backup run in between fails loudly with
`uploads dir /app/uploads is not mounted` — safe, since the database dump is
still taken and verified, but noisy for no reason.

---

## 1. Note what the backup does today

So you can tell afterwards that something changed.

```bash
docker ps --format '{{.Names}}' | grep -i backup
docker logs --tail 30 <backup-container-name> | grep '\[backup\]'
```

Expect one `[backup] ok — ... tables with data` line per run and nothing about
uploads. That is the current, correct behaviour of the old image.

If you already see `uploads dir ... is not mounted`, the new image has landed
ahead of this — no harm, just carry on to step 2.

## 2. Add the mount in Coolify

Coolify → the ResortPro resource → **Configuration → Docker Compose**.

Find the `backup:` service. It has:

```yaml
    volumes:
      - backups_data:/backups
```

Make it:

```yaml
    volumes:
      - backups_data:/backups
      # Read-only: this sidecar archives the guest ID/passport images, it must
      # never be able to alter or delete the originals.
      - uploads_data:/app/uploads:ro
```

Change nothing else. `uploads_data` is the same volume the `api` service already
mounts at `/app/uploads`, so no new volume declaration is needed.

Save, then redeploy.

## 3. Confirm the mount is there and read-only

```bash
docker inspect <backup-container-name> --format '{{range .Mounts}}{{.Name}} -> {{.Destination}} (rw={{.RW}}){{println}}{{end}}'
```

Expect `uploads_data -> /app/uploads (rw=false)` alongside the backups mount.
`rw=false` matters: this sidecar archives guest ID photographs and must not be
able to alter or delete them.

The script that uses it is not in the running image yet, so nothing more can be
checked here. Stop and report — step 4 is for after the new image is deployed.

## 4. After the new image is live on production

The backup container runs once at startup, so its log already holds a full run.
**Read that before running anything by hand** — a manual run passing while the
scheduled one is broken is exactly what happened on staging.

```bash
docker logs <backup-container-name> 2>&1 | grep '\[backup\]'
```

Expect **two** `ok` lines from one run:

```
[backup] ok — <bytes> bytes, <n> tables with data
[backup] ok — <bytes> bytes, <n> file(s)
```

`<n> file(s)` should be roughly the number of images on the system — room
photos, menu pictures and guest documents together. **If it is 0, stop and say
so**: an empty archive reporting success is the exact failure this change exists
to prevent.

Then confirm the guest documents specifically are inside it:

```bash
docker exec <backup-container-name> sh -c 'tar -tf $(ls -t /backups/uploads-*.tar | head -1) | grep -c guest-docs'
```

A number greater than 0 is the answer that matters.

## 5. Report back

- the mount line from step 3, including `rw=false`
- both `[backup] ok` lines from step 4, or whichever one is missing
- the `guest-docs` count
- the output of `docker exec <backup-container-name> ls -lh /backups | tail -5`

Nothing here writes to the database or deletes anything.

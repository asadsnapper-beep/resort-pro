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

Until that one line is added, every backup run on production will **deliberately
fail loudly** with `uploads dir /app/uploads is not mounted`. The database dump
is still taken and still verified — only the images are missing.

Staging needs nothing: its workflow sends the whole compose file as text.

---

## 1. Confirm the failure first (production)

Do this before changing anything, so you know the change is what fixed it.

```bash
docker ps --format '{{.Names}}' | grep -i backup
docker logs --tail 30 <backup-container-name>
```

Expect: `[backup] ok — ... tables with data` (the dump is fine), then
`[backup] uploads dir /app/uploads is not mounted — guest documents are NOT backed up`.

If you do **not** see the uploads line at all, the new image has not deployed
yet. Stop here and deploy first.

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

## 3. Prove it works

```bash
docker exec <backup-container-name> sh /app/scripts/backup-uploads.sh
```

Expect two lines:

```
[backup] archiving /app/uploads → /backups/uploads-<stamp>.tar
[backup] ok — <bytes> bytes, <n> file(s)
```

`<n>` should be roughly the number of images on the system — room photos, menu
pictures and guest documents together. **If it is 0, stop and say so**: an empty
archive means the mount points at the wrong place, and an empty backup that
reports success is the exact failure this change exists to prevent.

Then confirm the guest documents specifically are inside it:

```bash
docker exec <backup-container-name> sh -c 'tar -tf $(ls -t /backups/uploads-*.tar | head -1) | grep -c guest-docs'
```

A number greater than 0 is the answer that matters. Report it.

## 4. Report back

- the two `[backup] ok` lines from step 3
- the `guest-docs` count
- the output of `docker exec <backup-container-name> ls -lh /backups | tail -5`

Nothing here writes to the database or deletes anything.

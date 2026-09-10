# Production: uploaded files are not being kept

Paste this whole file into the session with Coolify access.

## The problem

The `api` service has no `volumes:` block, so `/app/uploads` lives inside the
container. Every redeploy replaces the container and the files go with it.

Confirmed: two guest documents uploaded in August now return 404, and
`/app/uploads` currently holds zero files. Room photos, menu pictures and
website images are stored in the same place.

This change stops further loss. It cannot bring back what is already gone.

## Do this

**1.** In Coolify → `resortpro` → Configuration → Docker Compose: copy the
current compose somewhere safe first. That copy is the undo.

**2.** Replace it with the file `production-compose-with-uploads.yml` supplied
alongside this prompt. It is the same compose with four added lines — an
`api` volume, `STORAGE_LOCAL_DIR`, and the volume declaration. It has already
been validated with `docker compose config`.

**3.** Save and redeploy.

## Then check it worked

Upload one guest document from the dashboard (Guests → any guest → Documents →
Scan Document). Count the files:

```bash
docker exec $(docker ps -q --filter 'name=api') sh -c 'find /app/uploads -type f | wc -l'
```

**Redeploy again from Coolify**, then run the same command.

- Same number → fixed.
- Back to zero → not fixed. Stop and report; do not retry.

That second count is the whole point. A mount that exists is not yet a mount
that survives a deploy, and nobody has checked that here before.

## Report back

The two counts, and whether the document opens in the dashboard.

Nothing here touches the database.

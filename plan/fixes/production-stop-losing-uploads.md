# Production: stop losing every uploaded image on each deploy

Paste this whole file into the session with Coolify access.

This is one change to one service. It is **additive** — no data is deleted, no
existing service is reconfigured, nothing is migrated.

---

## What was found, and what it means

Production's `api` service has **no `volumes:` block at all**, so `/app/uploads`
is the container's own filesystem. Every redeploy replaces the container and
takes the directory with it.

This is not a future risk. It has already happened: two `guest_documents` rows
uploaded on 11 and 14 August have `imageUrl`s that now return 404, and
`/app/uploads` holds zero files. The current container started on 8 September.

It is also not only guest documents. Room photos, menu pictures, resort website
images and vehicle photos all go to the same place. Every one of them uploaded
by a real tenant has been lost at each deploy, silently, and each new upload is
lost at the next one.

**Adding the volume does not bring back what is gone.** Those files no longer
exist anywhere. This stops the loss from here on.

## Why it happened — worth understanding, because it will recur

Coolify's stored compose is an old snapshot of
`docker-compose.coolify.yml` in git, and nothing reconciles the two. The deploy
workflow fetches the stored compose, rewrites only the two image tags, and
PATCHes it back. So every improvement made to the git file since that snapshot
has never reached production. Missing today: the uploads volume, the `backup`
and `worker` services, all the `STRIPE_*` variables, `BKASH_PRICE_FREE`, and
`NEXT_PUBLIC_CLARITY_ID`.

Only the uploads volume is being fixed here. The rest are separate decisions.

## 1. Save the current compose first

Before editing, copy the existing compose out of Coolify and keep it somewhere
you can find it. If anything goes wrong, pasting it back is the undo.

## 2. Replace the compose

In Coolify → the `resortpro` service → Configuration → Docker Compose, replace
the contents with the file `production-compose-with-uploads.yml` that came with
this prompt.

It is the compose you reported, unchanged except for **four added lines**:

```yaml
      STORAGE_LOCAL_DIR: /app/uploads      # under api > environment
    volumes:                                # new block on api
      - 'uploads_data:/app/uploads'
  uploads_data: null                        # under the top-level volumes:
```

The image tags in it are the ones currently deployed. The next deploy stamps
its own, so they do not need editing.

`STORAGE_LOCAL_DIR` pins the directory the app writes to, so the write path and
the mount path cannot drift apart. Without it the app derives the path from its
working directory, which is the same today and is not guaranteed to stay so.

This compose was validated with `docker compose config` before being written.

Save, then redeploy.

## 3. Check the mount is real

```bash
docker inspect $(docker ps -q --filter 'name=api') \
  --format '{{range .Mounts}}{{.Name}} -> {{.Destination}} (rw={{.RW}}){{println}}{{end}}'
```

Expect a line ending `-> /app/uploads (rw=true)`. Writable, unlike the backup
sidecar's read-only mount — this is the container that does the writing.

```bash
docker volume ls | grep -i upload
```

Expect a new volume with the `b48m2cix8odgfuvlyr8zr31p` prefix.

## 4. Prove it actually survives a redeploy

A mount that exists is not yet a mount that persists. This is the check that
matters, and it is the one that was never done before.

Upload one guest document through the dashboard (Guests → any guest →
Documents → Scan Document), then:

```bash
docker exec $(docker ps -q --filter 'name=api') sh -c 'find /app/uploads -type f | wc -l'
```

Expect `1` or more. **Then redeploy from Coolify** and run the same command
again. The count must be unchanged. If it drops to zero, the volume is not
doing its job — stop and report, do not retry.

Also open the document in the dashboard afterwards. A file that exists but
cannot be opened is a different bug, and it is better to find it now.

## 5. Report back

- the mount line from §3
- the file count before and after the redeploy in §4
- whether the document opened

Nothing here touches the database.

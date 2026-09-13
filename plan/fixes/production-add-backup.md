# Production has never had a backup

Paste this whole file into the session with Coolify access.

## The problem

There is no `backup` service on production. Not misconfigured — absent. The
database has never been dumped and nothing has ever archived the uploads.

The database is about 16 MB, so this costs almost nothing to fix.

## Do not replace the whole compose

An earlier version of this prompt shipped a complete replacement compose. Do
not use that file any more: its image tags are from an older release, and
pasting it would roll production back to that build.

Add the one service instead, leaving every existing line — especially the image
tags — exactly as it is.

## Do this

**1.** Coolify → `resortpro` → Configuration → Docker Compose. Copy the current
compose somewhere safe first. That copy is the undo.

**2.** Note what the `api` service's `image:` line says right now. It ends in a
long commit SHA. You will need that exact string in a moment.

**3.** Add this block to `services:`, at the same indentation as `api:` and
`web:`. Put it just before `web:` so the file stays readable:

```yaml
  backup:
    healthcheck:
      disable: true
    image: 'PUT-THE-API-IMAGE-LINE-HERE'
    pull_policy: always
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_USER: '${POSTGRES_USER:-resortpro}'
      PGPASSWORD: '${POSTGRES_PASSWORD}'
      POSTGRES_DB: '${POSTGRES_DB:-resortpro}'
      BACKUP_RETENTION_DAYS: '${BACKUP_RETENTION_DAYS:-14}'
    volumes:
      - 'backups_data:/backups'
      - 'uploads_data:/app/uploads:ro'
    networks: [coolify]
    depends_on: {postgres: {condition: service_healthy}}
    entrypoint: ['sh', '-c', 'while true; do sh /app/scripts/backup-db.sh || echo "[backup] run failed"; sleep 86400; done']
```

**4.** Replace `PUT-THE-API-IMAGE-LINE-HERE` with the exact image string from
step 2, quotes included. The backup sidecar runs the API image — that is where
the scripts and `postgresql16-client` live — so it has to be the same build.

**5.** At the bottom of the file, under `volumes:`, add one line beside
`postgres_data` and `uploads_data`:

```yaml
  backups_data: null
```

**6.** Save, then redeploy.

Three details that are easy to lose and each break it silently:

- `networks: [coolify]` — without it the container cannot resolve `postgres` at
  all, and fails with an error that reads exactly like a wrong password.
- `:ro` on the uploads mount — this sidecar archives guest ID photographs and
  must never be able to alter or delete them.
- `uploads_data` must match the volume name already in the file.

## Then check it worked

The container runs one backup as soon as it starts, so its log already holds a
full run. Read that before running anything by hand — on staging a manual run
passed while the scheduled one had been broken for a month.

```bash
docker logs $(docker ps -q --filter 'name=backup') 2>&1 | grep '\[backup\]'
```

Expect **two** `ok` lines from that single run:

```
[backup] ok — <bytes> bytes, <n> tables with data
[backup] ok — <bytes> bytes, <n> file(s)
```

- Two `ok` lines → working.
- `fe_sendauth: no password supplied` or `does not exist` → the credentials do
  not match the database. Report the line.
- Nothing about uploads → report it.

Then confirm the dump is real rather than trusting that a file exists:

```bash
docker exec $(docker ps -q --filter 'name=backup') ls -lh /backups
```

A `.dump` of a few MB and a `.tar`. **A 0-byte `.dump` is a failure, not a
backup** — staging accumulated fifty of those before anyone looked.

## Report back

The `[backup]` log lines and the `ls -lh` output.

Nothing here touches the database or the uploads. The backup mounts the uploads
volume read-only, so it cannot alter or delete a single guest document.

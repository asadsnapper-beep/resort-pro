# Put production's compose in git

**Status:** proposal. Needs the ops session to reconcile one file and change
four lines in `deploy.sh`. Nothing here is live.

## The problem, stated once

Production is a plain `docker compose` stack in `/opt/resortpro`, and that
compose exists only on the host. So:

- A new environment variable, volume, label or service is a hand edit on the
  server. Nothing reviews it, nothing records why, and nothing recreates it if
  the host is rebuilt.
- No file in this repository describes what production runs, so reading the
  repo tells you about staging and about two historical Coolify files.
- This is the same drift that Coolify had. The move fixed the deploy path; it
  did not fix where the truth lives.

A worked example of the cost: `BKASH_APP_KEY` and its three companions were
missing from production for weeks while being present in a git compose file,
because the git file was not what ran. That is the class of bug this removes.

## What changes

Production's compose becomes `deploy/production/docker-compose.yml`, reviewed
like code. `deploy.sh` stops editing a file in place and starts using the one
the release brought with it.

Secrets stay exactly where they are — `/opt/resortpro/.env`, on the host,
never in git. The committed file references them and contains none. **This
repository is public**, so the committed file also carries no server address,
no tailnet name and no owner e-mail; the hostnames in the Traefik labels are
the public ones the DNS already answers for.

## The file

`deploy/production/docker-compose.yml` is committed alongside this note. It is
**a draft, assembled from what the ops session described plus the structure of
`docker-compose.staging.yml`** — the authoring session has no server access and
has never seen the live file.

Reconcile it against `/opt/resortpro/docker-compose.yml` before anything uses
it. Taken from the handover and believed correct:

- services `postgres`, `redis`, `api`, `web`, `worker`, `backup`
- container names `rp-postgres`, `rp-redis`, `rp-api`, `rp-web`, `rp-worker`,
  `rp-backup`
- `postgres`, `redis`, `worker`, `backup` on `resortpro_net` only; `api` and
  `web` additionally on the external `coolify` network for Traefik
- volumes `resortpro_pgdata`, `resortpro_redis`, `resortpro_uploads`,
  `resortpro_backups`
- `api`, `worker`, `web` load `/opt/resortpro/.env` via `env_file`; `backup`
  does **not**
- the app reaches the database as `rp-postgres`
- Traefik routes `resortpro.site`, `www.`, `app.`, `api.`, plus the
  `*.resortpro.site` wildcard

Guessed, and most likely to be wrong — check each:

1. **Traefik label specifics.** Router names, entrypoint names, the
   certresolver, middleware, and which service gets the wildcard. Written from
   the convention Coolify uses; the live labels are authoritative.
2. **`backup`'s configuration.** It takes no `env_file`, so its variables are
   inline — the draft lists the ones `scripts/backup-db.sh` reads, with values
   left as `${…}` placeholders. The live file is authoritative on where those
   values come from.
3. **Healthcheck commands and timings** for api and web.
4. **`IMAGE_TAG`.** The draft expects `deploy.sh` to supply it as an
   environment variable rather than rewriting the file.
5. Whether `redis` has a password, and whether postgres pins any
   `command:` flags.

## What `deploy.sh` has to change

Today it switches `IMAGE_TAG` inside the on-host compose. Four changes:

1. **Use the repository's file.** The release already arrives as two images
   tagged with the SHA; it does not currently bring the compose. Either check
   the repo out on the host at that SHA, or have the workflow copy
   `deploy/production/docker-compose.yml` over as part of the deploy. Checking
   out is better — it makes "which compose is running" answerable as a SHA.
2. **Pass the tag instead of editing.** Keep `IMAGE_TAG` in
   `/opt/resortpro/.env` or export it before `docker compose up -d`, and let
   the committed file read `${IMAGE_TAG}`. The file then never changes on the
   host, which is the whole point.
3. **Keep the pre-deploy dump and the rollback exactly as they are.** Rolling
   back now means the previous tag *and* the previous compose. Since the
   compose is a git object, record the SHA it came from in the same place the
   tag is recorded.
4. **Fail if the file differs from the running stack in a way the tag cannot
   explain.** On the first run, print `docker compose config` for both the old
   and new file and stop — do not apply it. The first deploy under this scheme
   should be a diff a person reads, not a surprise.

## Order of work

1. Ops pastes the live compose, with secret *values* removed (keys and
   structure kept).
2. The authoring session reconciles the committed draft against it and opens a
   PR whose diff should be only the five guessed items above.
3. `scripts/check-backup-credentials.mjs` is extended to read the new file —
   it currently checks three templates, none of which is live, so this is the
   first time it would guard something real.
4. `deploy.sh` changes, with the first run in print-and-stop mode.
5. The Coolify-era files (`coolify.yml`, `docker-compose.coolify.yml`,
   `docker-compose.production.yml`) can then be deleted rather than merely
   marked historical — once nothing reads them, including that script.

## What this does not fix

Prisma migrations still run at api startup, so a rollback still cannot undo a
migration and the pre-deploy dump is still the only restore point. Putting the
compose in git changes nothing about that, and should not be described as
though it does.

# Did staging actually get `5d07643` and `c9abc6c`?

**Read-only.** Nothing here writes, restarts, or changes anything. It answers
three questions and stops.

## Why this exists

Both deploys reported `HTTP 524` and failed the job. 524 is Cloudflare giving up
after 100 seconds, not Portainer refusing — the request had been running about
two minutes when it arrived, so Portainer was still working. A 524 has been
proved before in this project to mean the deploy landed anyway (the container's
`StartedAt` was five seconds *before* Cloudflare gave up). It can also mean it
did not. The job cannot tell, so neither can anyone reading it.

Two things rest on the answer:

- `5d07643` makes every admin token name a session row. If it is live, the
  current admin sign-in stops working and needs one fresh login. If it is not,
  nothing has changed yet.
- It also carries two migrations. A half-deployed image with un-run migrations
  is the state worth catching early.

## Where to run this

**Paste this into the session that can reach the staging host** — the home
server one, not the session that wrote this file. If that session is not open,
open it first.

## What to run

```bash
echo "── 1. Which image is staging actually running ──────────────"
docker inspect resortpro-staging-api-1 \
  --format 'image:      {{.Config.Image}}
startedAt:  {{.State.StartedAt}}
status:     {{.State.Status}}
restarts:   {{.RestartCount}}'
```

```bash
echo "── 2. Did the two migrations run ───────────────────────────"
docker exec resortpro-staging-postgres-1 psql -U resortpro -d resortpro_staging -c \
"select migration_name, finished_at
   from _prisma_migrations
  where migration_name in ('20260930000000_admin_mfa','20260930010000_admin_sessions')
  order by migration_name;"
```

```bash
echo "── 3. Do the new tables and columns exist ──────────────────"
docker exec resortpro-staging-postgres-1 psql -U resortpro -d resortpro_staging -c \
"select table_name from information_schema.tables
  where table_name in ('admin_sessions','admin_recovery_codes')
  order by table_name;" -c \
"select column_name from information_schema.columns
  where table_name='admin_users' and column_name in ('mfaSecret','mfaEnabledAt')
  order by column_name;"
```

```bash
echo "── 4. Are the two secrets set (names only, never values) ───"
docker exec resortpro-staging-api-1 sh -c '
for v in CREDENTIALS_KEY SUPER_ADMIN_PASSWORD; do
  eval "val=\$$v"
  if [ -n "$val" ]; then echo "$v: set (${#val} chars)"; else echo "$v: MISSING"; fi
done'
```

**Do not paste the values of those two variables anywhere, including back into
the chat.** The length is all anyone needs to know.

```bash
echo "── 5. What the seeder said on the last start ───────────────"
docker logs resortpro-staging-api-1 2>&1 | grep -iE "super.admin|SUPER_ADMIN|Not creating" | tail -5
```

## What to bring back

Paste the output of all five. In particular:

- **Step 1** — does the image tag end in `dev-5d07643…` or `dev-c9abc6c…`? If it
  is an older SHA, the 524 meant the deploy really did not land, and the stack
  needs updating by hand from Portainer.
- **Step 2** — two rows with a `finished_at` means the migrations ran. No rows
  means the new image is not running, or it started before the migrate step
  finished.
- **Step 4** — `MISSING` for either is expected today and is not a fault. It is
  items 4 and 5 of [../handover-checklist.md](../handover-checklist.md), and
  knowing which are still missing is half the point of running this.
- **Step 5** — a "Not creating … super-admin account(s)" line is the new seeder
  refusing to invent a password, which is correct behaviour, not an error.

## One thing to expect either way

If step 1 shows the new image, **the admin panel will ask you to sign in again.**
That is `5d07643` working: the old token names no session, so it is refused. One
login and it is over.

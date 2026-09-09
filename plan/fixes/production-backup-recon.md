# Production backups — find out what is actually there

Paste this whole file into a session with access to the production server and
Coolify (Main Server, Hetzner).

**This prompt only reads and reports. Do not create, change, restart or deploy
anything.** A previous prompt assumed a `backup` service existed on production;
it does not, and that assumption is what this is replacing.

---

## What is already established — do not re-investigate

- Coolify's stored compose for the `resortpro` service has **four** services:
  `postgres`, `redis`, `api`, `web`.
- `docker-compose.coolify.yml` **in git** has six: those four plus `backup`
  and `worker`. Git is not what production runs.
- `.github/workflows/deploy.yml` fetches Coolify's stored `docker_compose_raw`,
  `sed`s only the two image tags, and PATCHes it back. It cannot add a service,
  so deploying will never create `backup` or `worker`.
- Conclusion: **production has never had a database backup**, and the worker
  has never run. Neither is a misconfiguration to repair; both are absent.

## Why more information is needed before anything is added

Writing a correct `backup` service needs the real names of things as Coolify
stores them — volumes, the postgres service block, networks — not the names in
the git file. Coolify rewrites and prefixes some of these. Guessing produces a
container that starts, reports success, and backs up nothing, which is the
exact failure already found on staging.

## 1. Does Coolify already back this up its own way?

Coolify has a built-in scheduled backup feature for database resources,
separate from anything in a compose file. If it is on, the database may already
be covered and only the uploads would be missing.

In the Coolify UI: open the `resortpro` service → the `postgres` container /
database → look for a **Backups** tab or scheduled backup settings. Also check
**Scheduled Tasks** on the service.

Report exactly one of:

- **On** — its schedule, destination (local or S3), retention, and the
  timestamp and size of the most recent successful backup.
- **Off / not available** — say which. (If postgres is defined inside the
  service's compose rather than being a standalone Coolify database resource,
  this feature may not be offered at all. That is a normal answer.)

## 2. The stored compose, exactly as Coolify holds it

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | sort
```

Then print Coolify's stored compose for `resortpro`. From the Coolify UI:
the service → Configuration → Docker Compose. Copy it **verbatim**, including
the `volumes:` and `networks:` blocks at the bottom.

If you would rather read it from the API, that is fine too — it is the
`docker_compose_raw` field of the service.

**Redact any secret values** (passwords, tokens, API keys) as `<redacted>`
before pasting, but keep the variable names and structure intact.

## 3. What the volumes are really called

```bash
docker volume ls | grep -i resort
```

And, for the volume the API writes uploads into:

```bash
docker inspect $(docker ps -q --filter 'name=api') \
  --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{println}}{{end}}'
```

## 4. How much data is at stake

Read-only, so the size of the problem is known before deciding:

```bash
docker exec $(docker ps -q --filter 'name=postgres') \
  psql -U resortpro -d resortpro -t -c \
  "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

```bash
docker exec $(docker ps -q --filter 'name=api') \
  sh -c 'du -sh /app/uploads 2>/dev/null; find /app/uploads -type f | wc -l'
```

## 5. Report back

1. The answer to §1 — Coolify's own backups, on or off.
2. The stored compose from §2, verbatim and secret-redacted.
3. The volume names from §3.
4. The two sizes from §4.

Then stop. The decision about what to add, and whether the worker is part of
it, is the founder's — and the worker is deliberately **not** part of this.
Starting it for the first time would act on months of accumulated backlog,
including a sweep that cancels unpaid `PENDING` bookings.

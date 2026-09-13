> **DONE — 2026-09-13.** Applied on production. Both the `backup` service's
> `POSTGRES_HOST` and the api's `DATABASE_URL` now use
> `postgres-b48m2cix8odgfuvlyr8zr31p`. Retention and a restore were verified,
> and a Coolify Scheduled Task now emails through Resend when a run fails —
> proven by making one fail. Kept for the reasoning, not as a task.

# Production backup: one line to change

Paste this whole file into the session that has Coolify access.

Nothing here writes to the database. The backup container only reads.

## What is wrong

Production already has a `backup:` service. It runs every night and every
night the database half fails:

```
pg_dump: error: connection to server ... failed:
FATAL: password authentication failed for user "resortpro"
```

The password is correct. It was checked three ways — stored format, the
pg_hba rules, and the byte length of both values. All fine.

The name is what is wrong. `coolify` is one external Docker network shared by
every project on the host, and **Coolify's own database container also answers
to `postgres`** on it. Two containers, one name:

```
coolify-db                          10.0.1.8   aliases: [coolify-db, postgres]
postgres-b48m2cix8odgfuvlyr8zr31p   10.0.1.6   ResortPro's own
```

Each lookup can land on either. The backup has been reaching Coolify's
database and offering it ResortPro's password.

So the fix is to stop using the ambiguous name.

## Step 1 — the backup service only

Coolify → `resortpro` → Configuration → Docker Compose.

On the **`backup:`** service, change this one line:

```yaml
      POSTGRES_HOST: postgres
```

to:

```yaml
      POSTGRES_HOST: postgres-b48m2cix8odgfuvlyr8zr31p
```

Change nothing else. In particular **do not touch the `api` service yet** —
that is step 2, and only after this works.

Save, then redeploy.

## Step 2 — check it

The container runs one backup as soon as it starts, so its log already holds a
complete run:

```bash
docker logs $(docker ps -qf 'name=backup-b48m2cix8odgfuvlyr8zr31p') 2>&1 | grep '\[backup\]' | tail -8
```

Expect **two** `ok` lines:

```
[backup] ok — <bytes> bytes, <n> tables with data
[backup] ok — <bytes> bytes, <n> file(s)
```

Two `ok` lines means production has its first database backup.

One `ok` and one failure, or a different error, means the hostname was not the
whole story — report the exact line rather than changing anything else.

Then confirm the file is real rather than trusting that one exists:

```bash
docker exec $(docker ps -qf 'name=backup-b48m2cix8odgfuvlyr8zr31p') ls -lh /backups
```

A `.dump` of a few MB and a `.tar`. **A 0-byte `.dump` is a failure, not a
backup** — staging collected fifty of those before anyone looked.

## Report back

- the `[backup]` log lines
- the `ls -lh /backups` output

## Step 3 — later, not now

Once step 2 shows two `ok` lines, the same hostname is proven, and the `api`
service's `DATABASE_URL` should change from

```
...@postgres:5432/...
```

to

```
...@postgres-b48m2cix8odgfuvlyr8zr31p:5432/...
```

That one restarts the application, so it is a separate decision on a separate
day. The API currently survives on a pool it opened at startup; every restart
is a coin flip between the two databases.

It has failed safely so far only because the two databases have different
passwords. Had they matched, `prisma migrate deploy` would have run ResortPro's
schema into Coolify's own database.

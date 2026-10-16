# Where did the first release through the new path stop?

**Read-only.** Nothing here deploys, restarts or changes anything. Four
questions and the evidence behind them.

## Where to paste this

**The ops session** — the one with server access that moved production out of
Coolify. Not the authoring session; that one has no server access, which is
why it is asking.

## Why this is being asked

The handover said the first release through the new path was running — dev →
main, ~130 commits, 10 additive migrations, being watched — and that the
authoring session must not push to main until told it was done.

From the git and Actions side, it does not look like it started:

| | |
|---|---|
| `origin/main` HEAD | `6a5090f` "fix: the workspace URL is read-only…" |
| `origin/main` last commit date | **2026-09-13** |
| Last `Deploy to Production` run | **2026-09-12**, on `6a5090f`, success |
| `Deploy to Production` runs since | **none** |
| `origin/dev` ahead of `origin/main` | **137 commits**, 225 files, 10 migrations |

So `main` has not moved in a month and the production workflow has not run
since September. One plausible reading is that it stalled exactly on the
base-image pull you flagged as blocking — the quota failure that fails the
build step before the deploy job can run. That is now fixed and proved:

- staging deploy green on `581091a` (build + push + Portainer)
- both production images build green on `79ed93d`
  (`verify-image-build.yml`, `push: false`, nothing written to the registry)

But the authoring session cannot tell the founder "the release is unblocked"
while the state of the release itself is unknown, and it will not push to main
on a guess.

## What to check

### 1. Did the merge to main ever happen?

```bash
git fetch origin
git log --oneline -1 origin/main
git rev-list --count origin/main..origin/dev
```

If `main` is still at `6a5090f`, the merge was never pushed — prepared
locally, or in a PR that was not merged, or abandoned when the build failed.

### 2. What is production actually running right now?

This is the question that matters most, because if the stack was updated by
hand then `main` does not describe production and "a month behind" is wrong:

```bash
docker ps --filter name=rp- --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
```

Report the image tags exactly. If they carry a SHA, say which.

### 3. Where did it stop, and saying what?

```bash
tail -n 120 /var/log/resortpro-deploy.log
```

If `deploy.sh` never ran, that log will not mention the attempt at all, which
is itself the answer.

### 4. Did the ten migrations run?

If the release got as far as starting the api container, they did — Prisma
runs them at startup, and a code rollback does not undo them.

```bash
docker exec rp-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations
      ORDER BY finished_at DESC NULLS FIRST LIMIT 15;"
```

Any of these present means production's schema is already ahead of its code:

```
20260914000000_messaging_usage_reset
20260914010000_whatsapp_notification_switches
20260914020000_guest_notifications
20260919000000_resort_groups
20260920000000_resort_link_created_user
20260926000000_keep_resort_group_events
20260930000000_admin_mfa
20260930010000_admin_sessions
20260930020000_admin_reauth
20261008000000_campaign_failed_states
```

A row with `finished_at` NULL is a migration that started and did not finish,
which is the one state worth knowing about immediately.

## Bring back

1. `main`'s HEAD and how far behind it is.
2. The exact image tags the six `rp-*` containers are running.
3. What the deploy log says about the attempt — including "nothing".
4. Which of the ten migrations are in `_prisma_migrations`, and whether any has
   a NULL `finished_at`.
5. **Is "do not push to main" still in force?** The authoring session will not
   push either way until this comes back.
6. Whether `CREDENTIALS_KEY` and `SUPER_ADMIN_PASSWORD` are in
   `/opt/resortpro/.env` yet — names and lengths only, never values:

   ```bash
   docker exec rp-api sh -c 'for v in CREDENTIALS_KEY SUPER_ADMIN_PASSWORD; do
     eval "x=\$$v"
     if [ -z "$x" ]; then echo "$v MISSING"; else echo "$v set (${#x} chars)"; fi
   done'
   ```

Exact container names throughout: `docker ps -qf name=api` is a substring
match and can hit another project's container on that shared host.

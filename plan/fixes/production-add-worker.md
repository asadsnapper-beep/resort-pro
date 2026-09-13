# Production has no worker

Paste this whole file into the session that has Coolify access.

## What is missing

Production runs `postgres`, `redis`, `api`, `web` and `backup`. There is no
`worker`, and there never has been. `worker.ts` is the only process that runs:

- pre-arrival reminders (daily 9am)
- iCal sync (every 15 min)
- scheduled daily reports (every minute, per tenant dispatch time)
- automation / email sequences (every 15 min)
- trial lifecycle emails (every 12 hours)
- expiry of abandoned public booking holds (every 5 min)

None of them have ever run on production.

## Is the first run safe? Yes — this was checked in the code

The worry was that switching it on would act on months of backlog. It does not:

- **Pre-arrival reminders** select `checkIn` between the start and end of
  *tomorrow* only. Past bookings are not in the query.
- **Trial emails** select `trialEndsAt` within the last 31 days, and a unique
  constraint makes a second send a no-op (`P2002` is caught and counted as
  "already sent").
- **Automation sequences** only touch `status: 'ACTIVE'` sequences and
  enrolments. If none are configured, nothing happens.
- **iCal sync** and **daily reports** send to the resort's own addresses, for
  today.

The one job that *will* act in bulk on the first run is **expiry of abandoned
booking holds**, and it sends no email at all. It cancels `PENDING` bookings
older than the hold window that have `paidAmount <= 0`, which frees rooms those
abandoned checkouts have been blocking — in the dashboard's conflict checks
there is no age limit, so they block indefinitely. It never touches a booking
with any recorded payment.

## Do this

**1.** Coolify → `resortpro` → Configuration → Docker Compose.

**2.** Copy two things from the existing `api:` service:

- its `image:` line, exactly — the long string ending in a commit SHA
- its entire `environment:` block

**3.** Add this service next to the others, at the same indentation:

```yaml
  worker:
    healthcheck:
      disable: true
    image: 'PUT-THE-API-IMAGE-LINE-HERE'
    pull_policy: always
    restart: unless-stopped
    command: ['node', 'dist/worker.js']
    environment:
      PUT-THE-API-ENVIRONMENT-BLOCK-HERE
    networks: [coolify]
    depends_on:
      api:
        condition: service_healthy
    deploy:
      replicas: 1
```

Three things that each break it quietly if missed:

- **The same image as the api.** The worker is the same build, a different
  command.
- **`command: ['node', 'dist/worker.js']`.** Without it the container runs the
  api's own command, which also runs `prisma migrate deploy` and the seeds —
  two containers doing that at once would race.
- **`replicas: 1`.** These are cron schedules, not queue consumers. A second
  instance sends every reminder twice.

The api's `DATABASE_URL` already uses `postgres-b48m2cix8odgfuvlyr8zr31p`, so
copying its environment block carries the correct hostname across. If the value
you copied says `@postgres:5432`, stop — that is the ambiguous name, and it
resolves to Coolify's own database as often as to this one.

**4.** Save, then redeploy.

## Then check it

```bash
docker logs $(docker ps -qf 'name=worker') 2>&1 | tail -20
```

Expect:

```
[worker] Starting ResortPro background worker...
[worker] All jobs scheduled. Worker is running.
```

And, if there were abandoned holds:

```
[expire-pending] Cancelled N stale unpaid booking(s): ...
```

That line is the job doing its work, not an error.

## Report back

- the `[worker]` lines
- any `[expire-pending]` line, including N
- anything containing `error` or `Fatal`

If it says `Fatal startup error`, report the message. Nothing else in the stack
depends on the worker, so a failing worker does not take the site down.

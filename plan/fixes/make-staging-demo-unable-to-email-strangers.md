# Staging's demo guests can still be emailed — fix the data

**This one writes.** Two reads first, then one command that changes guest rows
on the demo tenant. It deletes nothing, it is idempotent, and it reports
everything before it does it.

## Where to paste this

**The session that can reach the staging host** — the home server one.

## Why

`9410d62` is deployed to staging, so the *code* is fixed. A deploy ships code,
not data: the eighteen demo guests on that host still carry gmail.com,
yahoo.com, outlook.com and hotmail.com addresses. The seed writes no
EmailConsent rows, and a guest with no consent row counts as subscribed, so all
eighteen are in the audience of every demo campaign and every date trigger.
Nothing has ever been sent from staging — `email_sends` is empty, you confirmed
that — but the day `RESEND_API_KEY` is configured there, one press of "Send
Now" on a demo tenant mails a resort promotion to eighteen strangers.

**Do not fix this by rerunning `pnpm seed:demo`.** I suggested that earlier and
it was wrong. Seventeen entity types in that file use `create`, not `upsert` —
bookings, campaigns, expenses, menu items, maintenance tickets, housekeeping
tasks, support tickets, sequences. A second run roughly doubles the demo's
data: duplicate bookings on the same rooms, occupancy and revenue that mean
nothing. It would fix the addresses and wreck the demo.

Use the targeted script instead. It touches guests, adds one booking, and
nothing else.

## 1. Which build is running

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i resort
```

Expect `dev-9410d62…`. An older tag is fine for this job — the script does not
depend on the new code — but say which you saw.

## 2. See what it would do (changes nothing)

From the repo checkout on that host, on the `dev` branch:

```bash
cd packages/database
git pull
pnpm install --frozen-lockfile
DATABASE_URL="<staging db url>" pnpm fix:demo-guests
```

Without `--apply` it only reports. Expect something like:

```
Guests: 18. On a deliverable domain: 18
  ahmed.rahman@gmail.com
  … sixteen more …
Without a dateOfBirth: 18
Anniversary candidate (shireen.k@example.com): missing
Nothing was changed. Re-run with --apply to act on the above.
```

**Send that output back before running step 3** if anything looks unexpected —
a guest count that is not 18, an address whose local part you do not recognise,
or a tenant name that is not Palm Paradise Resort. Those would mean real guest
data is mixed into the demo tenant, and the script must not run until that is
understood.

## 3. Apply it

```bash
DATABASE_URL="<staging db url>" pnpm fix:demo-guests -- --apply
```

It does three things, each skipped if already done:

1. Re-points every guest not already on `@example.com`, keeping the local part
   (`ahmed.rahman@gmail.com` → `ahmed.rahman@example.com`). `example.com` is
   reserved by RFC 2606 and cannot receive mail.
2. Fills in `dateOfBirth` where it is null, so the birthday trigger has
   candidates. One guest's birthday is today. Dates already set are left alone.
3. Adds one guest, Shireen Kabir, with a single stay 365 days ago, because the
   anniversary trigger wants a first checkout 355–375 days back and nothing in
   the last 60 — and every original demo guest has a stay inside that 60-day
   window, so none of them can ever qualify.

Verified against a throwaway copy: from a simulated pre-fix state it re-pointed
4, filled in 18 birthdays, created the guest and her stay; a second run
reported 0, 0, "already present", "not needed".

## 4. Confirm (read-only)

```sql
SELECT split_part(email, '@', 2) AS domain,
       count(*) AS guests,
       count(*) FILTER (WHERE "dateOfBirth" IS NOT NULL) AS with_birthday
FROM guests g
JOIN tenants t ON t.id = g."tenantId"
WHERE t.slug = 'palm-paradise-resort'
GROUP BY 1 ORDER BY 2 DESC;
```

Want: one row, `example.com`, 19 guests, 19 with a birthday. Any other domain
still listed is a guest that can still be mailed.

## Bring back

1. The image tag from step 1.
2. The step 2 report.
3. The four counters the script printed in step 3.
4. The table from step 4.

If the script errors, send the whole error. It runs the guest-and-booking pair
in a transaction, so a failure there leaves neither — but a failure in step 1
or 2 of its own list may have applied partially, and re-running is safe and
resumes.

## Afterwards

Two things stay true and are not this script's job:

- **`RESEND_API_KEY` on staging.** Once the addresses are `@example.com`,
  configuring it is safe as far as the demo tenant goes. Before that, it is not.
- **The seed still duplicates on rerun.** Seventeen `create` calls. Worth
  fixing so `seed:demo` is safe to run twice, but it is a separate change and
  nobody should rerun that seed on a seeded host until it lands.

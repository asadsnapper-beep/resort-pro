# Did the CRM fixes actually work on staging? (`b01a9c7`)

**Read-only, with one exception that is called out in bold where it appears.**
Nothing here runs a migration, restarts a container, or changes a setting.
There are no migrations in this batch at all, so the database is not touched.

## Where to paste this

**Paste this into the session that can reach the staging host** — the home
server one. Not the session that wrote this file; that one has no server
access, which is why it is asking.

## Why this exists

Five CRM fixes went to staging between `0198614` and `b01a9c7`. None of them
could be checked in a browser from the authoring session: the local dev
database is behind `schema.prisma` (`tenants.waNotifBookingConfirm` does not
exist), so registration 500s there and the dashboard cannot be reached. The
API tests ran against a throwaway database instead. So the unit of work is
proved by tests and unproved by eye, and staging is the first place it can be
looked at.

What shipped:

| | what changed |
|---|---|
| 012 | a failed list load says so, with a retry, instead of drawing "No campaigns yet" |
| 017 | delete/update routes stop reporting success when nothing happened |
| 008 | Open Rate and Click Rate are gone — nothing recorded them |
| 011 | "Run Now" is now "See who is due" → a named recipient list → send |
| — | a FAILED send no longer suppresses the real one for 300 days |

## 1. Is `b01a9c7` the image that is actually running?

Green CI is not proof of a live deploy in this project — that has caught us
before. Check the running image's tag, not the job's colour:

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i resort
```

Both the API and web containers should carry `dev-b01a9c7…`. If either shows
an older SHA or a bare `:dev`, stop and report that — everything below would
be testing the wrong build.

## 2. Do the CRM tabs load at all?

Sign in to the staging dashboard and open `/dashboard/crm`. Click through all
five tabs: **Contacts, Campaigns, Sequences, Templates, Analytics**.

Templates and Analytics were both returning HTTP 500 in the QA run, and the
old code drew that as "No templates yet". So this is the check that matters:

- If a tab is genuinely empty, it should say so ("No templates yet").
- If it is broken, it should now say **"Could not load templates"** with a
  **Try again** button. That is the fix working, not a new bug — report which
  tab, and the browser console error if there is one.

Report what each of the five shows.

## 3. Is the Analytics tab free of the invented numbers?

On the Analytics tab, confirm:

- There is **no "Open Rate"** and **no "Click Rate"** card.
- The cards read **Total Contacts, Subscribed, Sent (last 5 campaigns),
  Failed to send**.
- The table below is headed **"Recent Campaign Delivery"** (not
  "…Performance"), with **Sent** and **Failed** columns only.
- On the Campaigns tab, a sent campaign shows **Sent** and **Failed** — no
  Opened, no Clicked, no percentages.

If any of the old labels are still there, the web container is stale — go back
to step 1.

## 4. The recipient preview — read this part before clicking

On the Analytics tab the top panel now has a button reading **"See who is
due"**, where "▶ Run Now" used to be.

**Click "See who is due". That is safe — it asks the API who is due and sends
nothing.** It should show either "Nothing to send today", or
"This will email N guests" with names and email addresses listed under
🎂 Birthday and 🏖️ Anniversary.

> **Do not click "Send to N".** That sends real email to whoever is listed,
> and every send suppresses that guest for 300 days — so a test send also
> cancels their real birthday email this year. Report the list instead.
>
> **Do not call the endpoint by hand with curl.** `POST
> /api/crm/automation/run-daily` **sends for real** unless the body is exactly
> `{"dryRun": true}`, and getting that wrong emails live guests. The button
> cannot get it wrong; curl can.

Then click **Cancel** and confirm the panel closes and the "See who is due"
button comes back.

Report: the counts, and whether the names shown look like real staging guests
whose birthday is today.

## 5. Does a failed send still block the real one? (read-only SQL)

This is the one fix with no visible surface. It needs one query, and it only
reads:

```sql
SELECT status, COUNT(*) AS rows
FROM email_sends
WHERE "createdAt" > NOW() - INTERVAL '300 days'
GROUP BY status
ORDER BY rows DESC;
```

What it tells us:

- **Any `FAILED` rows at all** → before this fix, every one of those guests
  was locked out of birthday/anniversary email for 300 days having received
  nothing. Worth knowing how many people that was.
- **Only `SENT`** → the bug never bit on staging, and the fix is insurance.

If there are FAILED rows, one more read to see whether any of them are people
the automation would now reach again:

```sql
SELECT COUNT(DISTINCT es."guestId") AS unblocked
FROM email_sends es
JOIN guests g ON g.id = es."guestId"
WHERE es.status = 'FAILED'
  AND es.subject ILIKE '%birthday%'
  AND es."createdAt" > NOW() - INTERVAL '300 days'
  AND g."dateOfBirth" IS NOT NULL;
```

## What to bring back

1. The two image tags from step 1.
2. For each of the five tabs: loaded / empty / "Could not load".
3. Whether Open Rate and Click Rate are gone (step 3).
4. What "See who is due" showed — counts, and whether the names look right.
5. The status counts from step 5, and the `unblocked` number if there were
   FAILED rows.
6. Anything in the API container logs that looks related:
   `docker logs --since 30m <api-container> 2>&1 | grep -iE "crm|automation" | tail -40`

Do not fix anything you find. Report it and let the authoring session make the
change, so it goes through tests and CI rather than straight onto the host.

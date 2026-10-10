# Staging verification, part 2 — the two fixes the first paste lost

The first prompt was truncated in transit: only 008, 012 and 017 arrived, and
those three are now confirmed present in the live container's bundles. This
covers what was cut. It is deliberately short so it does not truncate too.

Two corrections to what the server session inferred from the fragment:

- The missing fixes are **011** and the **suppression fix** — not 015. 015
  (Contacts pagination) shipped earlier, in `0198614`.
- The "one exception in bold" was **not** forcing an API failure. It was
  clicking one button that sends nothing. **Do not force the API to fail** —
  the bundle read already proved the code path, and both branches (empty vs
  failed) are covered by unit tests.

## 1. Confirm the tag, not just the bundle

Reading the live bundles proves you looked at a deployed build. It does not
prove it is this one:

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i resort
```

Both API and web should carry `dev-b01a9c7…`. An older SHA or a bare `:dev`
means the confirmations above describe an earlier build — say so.

## 2. Fix 011 — the recipient preview

On `/dashboard/crm` → **Analytics**, the top panel's button should read
**"See who is due"**. "▶ Run Now" means a stale web container.

**Click it. That is the exception, and it is safe — it asks the API who is due
and sends nothing.** Expect either "Nothing to send today", or "This will email
N guests" with names and addresses under 🎂 Birthday and 🏖️ Anniversary.

> **Do not click "Send to N".** That sends real email, and every send
> suppresses that guest for 300 days — so a test send also cancels their real
> birthday email this year.
>
> **Do not call the endpoint with curl.** `POST /api/crm/automation/run-daily`
> **sends for real** unless the body is exactly `{"dryRun": true}`. The button
> cannot get that wrong; curl can.

Then **Cancel**, and confirm the panel closes and the button comes back.

If logging in needs an account you do not have, skip this and say so — a
bundle grep for `See who is due` and `dryRun` is a weaker but real substitute.

## 3. The suppression fix — read-only SQL

No visible surface; this is the whole check.

```sql
SELECT status, COUNT(*) AS rows
FROM email_sends
WHERE "createdAt" > NOW() - INTERVAL '300 days'
GROUP BY status
ORDER BY rows DESC;
```

- Any `FAILED` rows → before this fix each of those guests was locked out of
  birthday/anniversary email for 300 days having received nothing.
- Only `SENT` → the bug never bit here, and the fix is insurance.

If there are FAILED rows, how many people it actually cost:

```sql
SELECT COUNT(DISTINCT es."guestId") AS unblocked
FROM email_sends es
JOIN guests g ON g.id = es."guestId"
WHERE es.status = 'FAILED'
  AND es.subject ILIKE '%birthday%'
  AND es."createdAt" > NOW() - INTERVAL '300 days'
  AND g."dateOfBirth" IS NOT NULL;
```

## Bring back

1. The two image tags.
2. What "See who is due" showed — counts, and whether the names look like real
   staging guests with a birthday today. Or that login was not possible.
3. The status counts, and `unblocked` if there were FAILED rows.

Do not fix anything you find. Report it, so the change goes through tests and
CI rather than onto the host by hand.

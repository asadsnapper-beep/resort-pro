# Can a customer actually pay on production?

Paste this whole file into a session with **production** access — the Coolify
server behind `manage.musafir.co.za`, not the Home Server that runs staging.

**Read-only.** Do not restart anything, do not redeploy, do not edit a variable,
and do not print the value of any secret. Report names and whether they are set,
never contents.

---

## Why this is being asked

A resort owner cannot pay a subscription unless the API can reach ResortPro's
own bKash merchant account. `getPlatformBkash()` in `apps/api/src/routes/billing.ts`
returns null unless **all four** of these are present in the API container's
environment:

```
BKASH_APP_KEY   BKASH_APP_SECRET   BKASH_USERNAME   BKASH_PASSWORD
```

When it returns null, `/api/billing/checkout/bkash` answers **503** and the
"Pay with bKash" button does not appear at all.

## What I already know, and what I do not

Reading the repo, `docker-compose.coolify.yml` passes `BKASH_PRICE_FREE` and
`BKASH_PRICE_FREE_ANNUAL` into the `api` service — and **no `BKASH_APP_*`,
`BKASH_USERNAME` or `BKASH_PASSWORD` line at all.** The staging compose has none
of them either, which matches staging answering 503 in testing.

What I cannot tell from here:

1. Whether Coolify's **stored** compose matches the one in git. It has drifted
   before — the `backup` and `worker` services and `uploads_data` were typed in
   by hand and exist only there.
2. Whether Coolify injects its own variables into a service even when the
   compose has an explicit `environment:` block that does not name them.

Only the running container settles both. **Start there.**

---

## Step 1 — ask the container itself

Coolify → the ResortPro service → the `api` container → Terminal (or SSH to the
host and `docker exec` into it). Then run exactly this. It prints names and a
verdict only — no values leave the container:

```bash
for v in BKASH_APP_KEY BKASH_APP_SECRET BKASH_USERNAME BKASH_PASSWORD; do
  eval "x=\$$v"
  if [ -z "$x" ]; then echo "$v MISSING"; else echo "$v set (${#x} chars)"; fi
done
```

- **All four "set"** → the platform bKash account is wired up. Go to step 3.
- **Any "MISSING"** → nobody can pay. Go to step 2.

While you are in there, the same check for the two that decide whether email
works, because a customer who cannot receive a receipt is nearly as stuck:

```bash
for v in RESEND_API_KEY EMAIL_FROM APP_URL WEB_URL; do
  eval "x=\$$v"
  if [ -z "$x" ]; then echo "$v MISSING"; else echo "$v set"; fi
done
```

## Step 2 — only if something is missing: where is the gap?

Two different problems need two different fixes, so find out which it is.

**2a. Are the values in Coolify at all?** Coolify → the service →
*Environment Variables*. Look for the four names. Report **only** whether each
name is present — never the value.

**2b. Does the stored compose pass them through?** Coolify → the service →
*Configuration* / the compose editor. Find the `api` service's `environment:`
block and report whether these four lines exist:

```yaml
      BKASH_APP_KEY: ${BKASH_APP_KEY:-}
      BKASH_APP_SECRET: ${BKASH_APP_SECRET:-}
      BKASH_USERNAME: ${BKASH_USERNAME:-}
      BKASH_PASSWORD: ${BKASH_PASSWORD:-}
```

That gives three possible answers, and they need different work:

| In the variable list | In the compose | What it means |
|---|---|---|
| No | No | The merchant credentials were never added. The founder needs them from bKash. |
| Yes | No | They exist but never reach the API. The compose needs those four lines. |
| Yes | Yes | They should be reaching it — if step 1 said MISSING, something else is wrong and I need the exact output. |

**Change nothing.** Adding a variable or editing the compose triggers a
redeploy, and that is a decision for the founder, not a side effect of a check.

## Step 3 — does the endpoint agree?

From anywhere, with no login needed, confirm the API is the build you think it
is and is answering:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.resortpro.site/health
```

(`https://resortpro.site/api/health` is a 404 — that path is not routed to the
API on production. Corrected after the first run of this file.)

Then, if you have an owner login on production, the honest end-to-end check is
simply whether the **"Pay with bKash" button appears** on
`/dashboard/billing`. It is rendered only when `/api/billing/status` reports
`bkashEnabled: true`, which is the same four variables seen from the outside.
Do not start a payment.

---

## Bring back

1. The exact output of step 1's two loops.
2. If anything was missing: which of the three rows in step 2's table applies.
3. Whether the "Pay with bKash" button appears on production's billing page.
4. Anything you changed. The expected answer is "nothing".

## Do not

- Restart, redeploy, or "Pull Latest Images & Restart".
- Print, paste, or echo the value of any secret — length and "set" are enough.
- Add or edit a Coolify variable or the compose.
- Run any write SQL, or any Prisma command at all.

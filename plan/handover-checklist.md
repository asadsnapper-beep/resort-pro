# Handing ResortPro to a resort owner

The one list. Everything else in `plan/` describes how something works or was
meant to work; this says what is left before a real resort owner is using the
product, and who has to do it.

Last checked: **2026-09-30.**

---

## Today, before anything else — **founder**

### 0. Change the super-admin password that is already out there

This does not block a payment, which is why it is not in the list below. It is
here because it is the only item where waiting makes things worse.

Until 2026-09-29 the admin seeder fell back to a hard-coded `Admin@123456`
whenever `SUPER_ADMIN_PASSWORD` was absent, no compose file passed that
variable, and the image runs the seeder on every container start.

`docker-compose.staging.yml` also defaults `SUPER_ADMIN_EMAILS` to the founder's
own address. Email defaulted, password defaulted, seeder run on boot — staging
has very likely been sitting on the internet with a guessable super-admin for as
long as it has existed. Production too, if an account was ever created there.

The code no longer does this. It cannot change a password that already exists:

1. Try `Admin@123456` against `/admin/login` on staging, and on production.
2. Wherever it works, change it — and assume everything that account can reach
   has been reachable by anyone who guessed.
3. Then set `SUPER_ADMIN_PASSWORD` (item 4) so the next deployment has one.

---

## Blocking — nobody can be a paying customer until these are done

### 1. bKash merchant credentials — **founder**

Four values from bKash Tokenized Checkout, **live not sandbox**:

```
BKASH_APP_KEY   BKASH_APP_SECRET   BKASH_USERNAME   BKASH_PASSWORD
```

Verified on 2026-09-27: they exist **nowhere** — not in the running production
container, not in Coolify's variable list, not in Coolify's stored compose.
Until they do, `getPlatformBkash()` is null, `/billing/checkout/bkash` answers
503, and the "Pay with bKash" button is not rendered at all.

### 2. Put them into Coolify — **founder**, two places

Both are needed. Either alone does nothing.

- **Environment Variables** → the four names and their values.
- **The stored compose**, `api` service `environment:` block → the four
  pass-through lines:

  ```yaml
        BKASH_APP_KEY: ${BKASH_APP_KEY:-}
        BKASH_APP_SECRET: ${BKASH_APP_SECRET:-}
        BKASH_USERNAME: ${BKASH_USERNAME:-}
        BKASH_PASSWORD: ${BKASH_PASSWORD:-}
  ```

`docker-compose.coolify.yml` in git already has these lines — **copy from
there, and do not expect git to apply them.** Coolify keeps its own copy of the
compose in its database; a deploy only rewrites the image tags in it.

### 3. Prove it worked — **either of us**

Re-run [fixes/does-production-have-bkash.md](fixes/does-production-have-bkash.md).
All four must read "set", and the button must appear on
`/dashboard/billing`.

### 4. Set `SUPER_ADMIN_PASSWORD` — **founder**, every deployment definition

The variable is in all four compose files now with no default. Nothing sets it,
so on an empty database the seeder refuses to create the account and says so —
which is the intended outcome, and the reason a fresh deployment currently comes
up with no way into the admin panel until this is set.

Twelve characters minimum, and the old default is rejected by name.

```bash
openssl rand -base64 24
```

### 5. Set `CREDENTIALS_KEY` — **founder**, three places

New as of 2026-09-29. The cipher exists now and every writer uses it, but it
needs a key, and there is none anywhere yet. Without one the API still runs and
still reads the credentials it already has — it simply cannot encrypt, so every
credential a resort pastes stays plain text exactly as before.

A different value in each of the three:

- Coolify (production) · Portainer (staging) · `apps/api/.env` (local)

```bash
openssl rand -base64 32
```

Keep the keys somewhere the database backups are **not**. A backup and the key
that opens it in the same place is the same as no encryption at all. If a key is
lost after the conversion below, every resort has to paste their credentials in
again — there is no recovery.

Then convert what is already stored, production last and only after a backup.
Inside the API container, which ships `dist/` and has no `tsx`:

```bash
docker exec -it <api-container> node dist/scripts/encrypt-credentials.js
docker exec -it <api-container> node dist/scripts/encrypt-credentials.js --apply
```

Locally, from `apps/api`, it is `pnpm encrypt:credentials` and
`pnpm encrypt:credentials -- --apply`.

The first form changes nothing and prints how many values it would convert —
read that before the second. It refuses to start without a key, skips anything
already encrypted so running it twice is safe, and prints counts and column
names only, never a value.

This does not block a payment, so it is not what stops a customer paying. It is
here because every resort onboarded before it is done adds more plain text to
the database, and the pilot resorts are about to be onboarded by hand.

### 6. Push `dev` → `main` — **founder decides, Claude runs it**

`dev` is 83 commits ahead of `main`, whose newest commit is from 13 September.
Everything since — multi-resort, guest SMS/WhatsApp, the embed widget, the group
bill, the review fixes, the privacy fix, credential encryption — is on staging
only.

A green deploy does not mean the new image is running. Check the running tag
afterwards; see `memory/projects/resortpro.md`, "Delivery and operations".

### 7. Hand-onboard the first resorts — **founder**

The agreed strategy is pilot-first: two or three resorts set up by hand, not
self-serve. The customer with three resorts is the obvious first.

---

## Not blocking this month — deliberately deferred

Written down so they stop taking up room.

| | Why it can wait |
|---|---|
| Stripe account and `STRIPE_COUPON_GROUP10` | bKash is the path in Bangladesh. Without the coupon a **card** payment charges full price for a discounted resort and logs that it did; bKash applies the 10% correctly. |
| Combined billing, card half | The bKash half works. The card half needs Stripe. |
| Four orphaned ID scans on staging | They predate the privacy fix. New deletions are clean. Sweep by hand when convenient. |
| Old guest documents with `localhost` URLs | Existing rows only; new uploads are correct. |
| Coolify compose drift | Nothing reconciles Coolify's stored compose with git. A real gap, and a bigger piece of work than this month allows. |
| `redis` on the shared `coolify` network under a generic name | The DNS-ambiguity class that the `resortpro-postgres` alias was added to fix. Server work. |
| Android sync gaps | A rejected change vanishes silently; an offline restart logs the housekeeper out. |
| Settings "not production-ready" QA verdict | From 2026-09-09 and never retested. Most of its findings are fixed; the verdict is not. |
| Review management, dynamic pricing, Booking.com / Airbnb | Never promised for this month. |
| The Shop / marketplace ([marketplace.md](marketplace.md)) | A new product, planned 2026-09-27 and not started. Its phase 9 needs the same Stripe account. It earns nothing until resorts are using the PMS. Its §14 precondition — a third-party shop's own gateway credentials being encrypted — is met now; the key in item 5 is the rest of it. |
| Admin MFA and revocable sessions (review M-03) | **A decision, not an oversight.** Admin login has rate limiting, hashed passwords, generic errors and an eight-hour token, but no second factor, no server-side revocation and no re-authentication before a delete or a GDPR erasure. A stolen browser token is full control until it expires. The mitigating fact is that there is exactly one admin — the founder — so the blast radius is one account that is not shared. It becomes urgent the day anyone else is given an admin login, which is also the day item 2 of the review's own plan applies. |
| Off-host backups (review M-06) | Daily dumps are verified, and they sit on the same host as the database they protect. Losing the host loses both. Needs a bucket, retention, credentials, monitoring and one documented restore drill — server work, not code, and it cannot be done from here. |
| ESLint | Not installed anywhere in this repo, and `next lint` used to hang on its interactive setup prompt. The script is `tsc --noEmit` now, which is what CI has meant by lint for months. Adding real linting means a dependency and several hundred existing warnings, so it needs a baseline the way the design system has one. Not this month. |
| An E2E test for the admin drawer | The phone drawer was verified by hand at 390×844. A spec needs an admin login, and `roles.spec.ts` only logs in tenant users. Worth adding when someone extends that helper. |
| Clearing the dead `bkash*` / `ssl*` columns on `Tenant` | Nothing in the API reads them; the live path is `TenantPaymentConfig.credentials`. They are encrypted rather than emptied, because "nothing reads them" is not "nothing is in them" and dropping a column cannot be undone. Worth a look when someone has time to see what is actually in them. |

---

## What is actually finished

So the size of what is left stays honest.

- Multi-resort: separate accounts, the switcher, the 360 page, connecting by
  the same email or by asking, changing access, opening a resort from inside,
  10% from the second resort, one bKash payment for all of them.
- Every finding from the 2026-09-25 code review except the redis one.
- Deleting a guest, erasing a resort under GDPR, the admin hard delete and the
  nightly demo refresh all remove the ID photographs, not just the rows.
- A captured bKash payment is never reported to the payer as a failure.
- A guest notification that failed is tried again.
- Signing in twice in one second no longer answers 500.
- Credentials are encrypted at rest: the AES-256-GCM cipher `schema.prisma` had
  been claiming for months, wired into every store — the gateway credential bag,
  the eleven secret columns on `Tenant`, and the platform's own AI key and
  object-storage pair — plus a script to convert the rows written before it.
  **Dormant until item 5 sets a key.**
- From the 2026-09-29 release-readiness review, seven of its nine findings:
  - the seeder no longer invents a super-admin password (C-01 — but see item 0,
    which is the part code cannot fix);
  - billing already enforced OWNER, and had tests for it, before the review ran
    (C-02 was written against a checkout that was behind `dev`);
  - the admin panel shows the role you actually have and offers only the pages
    that role can open, with a plain refusal instead of an empty dashboard (M-01);
  - privileged admin actions are audited, and a failed audit write is now loud
    instead of silent (M-02);
  - the platform's own credentials are encrypted (M-05);
  - the admin panel works on a phone (M-04);
  - the landing suite describes the page that exists and runs in CI again, and
    `lint` no longer hangs on a prompt (M-07).
- API suite 754 passing; web 117; E2E 44 across two browser projects with no
  retries; staging deployed `dev-60c6e38` on 2026-09-30 (the deploy job is
  green; the running tag on the host was not re-checked).

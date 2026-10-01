# Handing ResortPro to a resort owner

The one list. Everything else in `plan/` describes how something works or was
meant to work; this says what is left before a real resort owner is using the
product, and who has to do it.

Last checked: **2026-10-02** — bKash is still not in hand, so the list now says what that does and does not block.

---

## Today, before anything else — **founder**

### 0. Change the super-admin password that is already out there

It is first because it is the only item on this page where waiting makes things
worse rather than merely later.

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
4. Then turn on two-factor at `/admin/security`, and keep the ten recovery
   codes somewhere that is not the phone — they are shown once, and they are
   the only way back in if it is lost. Do it in this order: a second factor on
   top of a password that may already be known is worth much less.

---

## What bKash actually blocks

This section used to be headed "nobody can be a paying customer until these are
done", which was wrong in a way worth correcting: it reads as though the pilot
cannot start, and it can. As of 2026-10-02 the founder does not have the bKash
merchant credentials, and the application takes as long as it takes.

| | Needs bKash? |
|---|---|
| Hand-onboarding a pilot resort, billing them outside the product, and setting their plan in the admin panel | **No** |
| Self-serve signup: someone finds the product, pays, and starts without you | **Yes** |
| Automatic renewal, and the group combined bill actually collecting money | **Yes** |

The pilot path works today, and every piece of it was checked rather than
assumed:

- `PATCH /api/admin/tenants/:id` accepts `plan`, `planStatus` and `trialEndsAt`,
  so a plan can be set by hand from the admin panel.
- The billing gate only answers 402 for `past_due`, `canceled` and `incomplete`
  — a tenant set to `active` has full access with no Stripe or bKash record
  behind it, and the resort owner sees nothing unusual.

So: take the money by bank transfer or your own bKash, set the plan, move on.
What you lose is the ability to grow without being in the loop for every sale,
which is a scale problem rather than a pilot one.

**Start the merchant application now regardless.** It is not a same-day thing,
and until it is started the clock has not started either.

---

## Blocking self-serve payment — not the pilot

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

---

## Before the production push — **founder**, then Claude runs it

None of these wait for bKash.

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

It is here, rather than in the deferred table, because every resort onboarded
before it is done adds more plain text to the database — and the pilot resorts
are the next thing to happen.

### 6. Push `dev` → `main` — **founder decides, Claude runs it**

`dev` is 93 commits ahead of `main`, whose newest commit is from 13 September.
Everything since — multi-resort, guest SMS/WhatsApp, the embed widget, the group
bill, the review fixes, the privacy fix, credential encryption, the admin
control-plane work — is on staging only.

**This does not wait for bKash.** It waits only for items 4 and 5, because the
new code refuses to save a credential without a key — see
[fixes/set-production-secrets-before-main-push.md](fixes/set-production-secrets-before-main-push.md),
which is the whole procedure in one page.

Nine migrations go with it, including admin two-factor, sessions and
re-authentication. Two things change for whoever is signed in to production:
the admin session ends and needs one fresh login, and the first irreversible
action after that asks for the password.

The deploy job now verifies that Portainer stored the commit, so a green staging
deploy means the commit is deployed. Production's own deploy does not check that
yet — see the deferred table.

---

## The part that earns money this month

### 7. Hand-onboard the first resorts — **founder**

The agreed strategy is pilot-first: two or three resorts set up by hand, not
self-serve. The customer with three resorts is the obvious first.

**This is the item that can start now.** It does not wait for bKash, and it is
the only one on this list that produces a paying customer in the next few weeks.
Per resort: create the account, take the money however suits them, then set the
plan in the admin panel — Tenants → the resort → plan and status. Setting
`active` gives full access with no gateway record behind it.

Keep a note of who paid what and when, somewhere outside the product. When bKash
arrives those resorts move onto real subscriptions, and that note is what makes
the transition honest.

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
| Production's deploy job does not verify the commit | Staging's does now: a 52x from Cloudflare is treated as "unknown" and the job then checks what Portainer actually stored. Production exits on any non-2xx from Coolify, before its health checks run — and those checks ask "is something serving", not "is this commit serving", so simply letting the timeout through could turn a silent non-deploy into a green run. It needs its own SHA check first, which is a separate piece of work on the riskier of the two paths. |
| A QR code on the two-factor screen | Enrolment shows the setup key grouped for manual entry and an `otpauth://` link that opens the app when tapped on the phone, which is enough to enrol. A scannable QR needs a library this repo does not have; adding one is a small change and a dependency decision. |
| Off-host backups (review M-06) | Daily dumps are verified, and they sit on the same host as the database they protect. Losing the host loses both. Needs a bucket, retention, credentials, monitoring and one documented restore drill — server work, not code, and it cannot be done from here. |
| ESLint | Not installed anywhere in this repo, and `next lint` used to hang on its interactive setup prompt. The script is `tsc --noEmit` now, which is what CI has meant by lint for months. Adding real linting means a dependency and several hundred existing warnings, so it needs a baseline the way the design system has one. Not this month. |
| An E2E test for the admin drawer, and for two-factor | Both were verified by hand — the drawer at 390×840, the two-factor journey by signing in, enrolling, signing out and back in with a recovery code. Neither has a spec, because both need an admin login and `roles.spec.ts` only logs in tenant users. Worth adding when someone extends that helper. |
| `tests/unit/safe-url.test.ts` does real DNS | Two of its cases resolve real hostnames — one `.invalid`, one `calendar.google.com` — inside the *unit* suite. One timed out on a slow resolver and passed on two re-runs. Flaky by construction: it should stub the resolver, or move to the integration suite where a network dependency is expected. |
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
    `lint` no longer hangs on a prompt (M-07);
  - the admin control plane is no longer a password and an eight-hour token
    (M-03), in four parts: a TOTP second factor with recovery codes, checked
    against RFC 6238's own test vectors; sessions that can be revoked, so a
    stolen token can be ended instead of waited out; the password asked for
    again before the nine actions that cannot be undone or that write
    credentials; and an email when the account is signed in to from a new
    address, or two-factor is turned off. `/admin/security` is where a person
    does all of it.
- The staging deploy job tells the truth. A 52x from Cloudflare is the proxy
  giving up at 100 seconds, not Portainer refusing — three deploys in a row
  failed on it while the new image was in fact live. The job now checks what
  Portainer actually stored, so red means the commit is not deployed.
- API suite 824 passing; web 117; E2E 44 across two browser projects with no
  retries; staging deployed `dev-a3773cd` on 2026-09-30 — and that now means
  Portainer confirmed it stores this commit, rather than only that the request
  was accepted.

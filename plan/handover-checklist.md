# Handing ResortPro to a resort owner

The one list. Everything else in `plan/` describes how something works or was
meant to work; this says what is left before a real resort owner is using the
product, and who has to do it.

Last checked: **2026-09-29.**

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

### 4. Set `CREDENTIALS_KEY` — **founder**, three places

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

### 5. Push `dev` → `main` — **founder decides, Claude runs it**

`dev` is 76 commits ahead of `main`, whose newest commit is from 13 September.
Everything since — multi-resort, guest SMS/WhatsApp, the embed widget, the group
bill, the review fixes, the privacy fix, credential encryption — is on staging
only.

A green deploy does not mean the new image is running. Check the running tag
afterwards; see `memory/projects/resortpro.md`, "Delivery and operations".

### 6. Hand-onboard the first resorts — **founder**

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
| The Shop / marketplace ([marketplace.md](marketplace.md)) | A new product, planned 2026-09-27 and not started. Its phase 9 needs the same Stripe account. It earns nothing until resorts are using the PMS. Its §14 precondition — a third-party shop's own gateway credentials being encrypted — is met now; the key in item 4 is the rest of it. |
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
  been claiming for months, wired into both stores — the gateway credential bag
  and the eleven secret columns on `Tenant` — plus a script to convert the rows
  written before it. **Dormant until item 4 sets a key.**
- API suite 735 passing; web 107; staging deployed `dev-d676f81` on 2026-09-29
  (the deploy job is green; the running tag on the host was not re-checked).

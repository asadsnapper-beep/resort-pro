# Two secrets production needs before `dev` → `main`

**Who does this:** the founder, by hand in Coolify. Not a Claude session — these
are the production keys, and no session needs to see them.

**Why now:** the 93 commits waiting on `dev` change what happens when these are
missing. Today production is only *less protected* without them. After the push
it is *broken* without them:

- **`CREDENTIALS_KEY`** — every writer of a gateway, SMS, WhatsApp, Telegram or
  SSO credential now encrypts before storing, and refuses rather than storing
  plain text. With no key, a resort owner saving their bKash or SMS settings
  gets an error. The API still starts, still reads what is already stored, and
  warns at boot; only *saving* a credential stops.
- **`SUPER_ADMIN_PASSWORD`** — the seeder no longer invents `Admin@123456`. If
  production already has an admin account, nothing changes: it is skipped. If it
  does not, no account is created and the admin panel has no way in.

Neither can be fixed from a laptop afterwards, so both go in first.

---

## Step 1 — generate the two values

On your own machine:

```bash
echo "CREDENTIALS_KEY:      $(openssl rand -base64 32)"
echo "SUPER_ADMIN_PASSWORD: $(openssl rand -base64 24)"
```

`CREDENTIALS_KEY` must be **different from the staging and local ones**. A key
shared across environments means a staging database dump opens production's
credentials.

Keep both somewhere the **database backups are not**. A backup and the key that
opens it in the same place is the same as no encryption at all. If this key is
lost after the conversion in step 5, every resort has to paste their payment and
SMS credentials in again — there is no recovery, by design.

**Do not paste either value into a chat, including to me.**

## Step 2 — Coolify → the ResortPro service → *Environment Variables*

Add both names with their values.

## Step 3 — Coolify → *Configuration* → the stored compose

Find the `api` service's `environment:` block and add the two pass-through
lines:

```yaml
      CREDENTIALS_KEY: ${CREDENTIALS_KEY:-}
      SUPER_ADMIN_PASSWORD: ${SUPER_ADMIN_PASSWORD:-}
```

**Both steps are needed. Either alone does nothing** — the same trap as the
bKash variables in [does-production-have-bkash.md](does-production-have-bkash.md).
Coolify keeps its own copy of the compose in its database; a deploy rewrites the
image tags in it and nothing else, so the version of this file in git never
reaches production on its own.

## Step 4 — tell me, and I will push `dev` → `main`

Say "set" — nothing else. I will run the push, watch the deploy, and report the
migration and health-check results. Nine migrations are waiting, including the
three for admin two-factor, sessions and re-authentication.

Then, in the running container (Coolify → the `api` container → Terminal), this
prints names and lengths only:

```bash
for v in CREDENTIALS_KEY SUPER_ADMIN_PASSWORD; do
  eval "x=\$$v"
  if [ -z "$x" ]; then echo "$v MISSING"; else echo "$v set (${#x} chars)"; fi
done
```

Both should read "set". `CREDENTIALS_KEY` should be 44 characters, and
`SUPER_ADMIN_PASSWORD` 32 — that is what base64 of 32 and 24 bytes comes to, and
a different length means something was truncated on the way in.

## Step 5 — after the deploy: convert what is already stored

The key only encrypts new writes. Everything saved before it is still plain
text, and stays that way until converted. **Take a database backup first.**

In the `api` container:

```bash
node dist/scripts/encrypt-credentials.js            # counts, changes nothing
node dist/scripts/encrypt-credentials.js --apply    # converts
```

Read the dry run before the second one. It is safe to run twice, it refuses to
start without the key, and it prints counts and column names only — never a
value.

---

## What this does not cover

bKash is still missing in production, and nothing here changes that: items 1–3
of [../handover-checklist.md](../handover-checklist.md) are still the only thing
standing between the product and taking a payment.

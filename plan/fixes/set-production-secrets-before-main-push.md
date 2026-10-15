# Two secrets production needs before `dev` → `main`

**Who does this:** the founder, by hand on the server. Not a Claude session —
these are the production keys, and no session needs to see them.

> **Rewritten 2026-10-16.** Production left Coolify on 2026-10-15/16, so the
> original two-place Coolify edit this file described no longer exists — and
> doing it in Coolify now would change nothing, because the archived service
> there is not what runs. It is one file on the host instead.

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

## Step 2 — one edit, on the server

Add both lines to `/opt/resortpro/.env`:

```
CREDENTIALS_KEY=<the 44-character value>
SUPER_ADMIN_PASSWORD=<the 32-character value>
```

Then apply it:

```bash
cd /opt/resortpro && docker compose up -d
```

`api`, `worker` and `web` load that file with `env_file`, so this is the whole
change. **There is no second place to edit.** The old version of this file
asked for a Coolify variable *and* a pass-through line in Coolify's stored
compose, and warned that either alone did nothing. That trap is gone with the
platform that created it.

## Step 4 — tell me, and I will push `dev` → `main`

Say "set" — nothing else. I will run the push, watch the deploy, and report the
migration and health-check results. Nine migrations are waiting, including the
three for admin two-factor, sessions and re-authentication.

Then, in the running container, this prints names and lengths only — never
values:

```bash
docker exec rp-api sh -c 'for v in CREDENTIALS_KEY SUPER_ADMIN_PASSWORD; do
  eval "x=\$$v"
  if [ -z "$x" ]; then echo "$v MISSING"; else echo "$v set (${#x} chars)"; fi
done'
```

Exact container name on purpose: `docker exec $(docker ps -qf name=api)` is a
substring match and can hit another project's container on that shared host.

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

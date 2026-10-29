# Custom Domains — how a customer's own domain reaches ResortPro

> Status as of **2026-10-30**:
>
> | Piece | State |
> |---|---|
> | Cloudflare zone configuration | ✅ **done** — activated, fallback origin Active |
> | API integration | ✅ **written** — registers hostnames, reads cert state back |
> | HTTPS probe + honest "live" wording | ✅ **written** |
> | Traefik catch-all router | ❌ **not applied to the live server** |
> | `CLOUDFLARE_API_TOKEN` / `ZONE_ID` in the server `.env` | ❌ **not set** |
>
> Custom domains do not work until the last two are done. This document is the
> mechanism of record — if you change how custom domains work, change this
> file in the same commit.
>
> Decision date: 2026-10-30. Chosen approach: **Cloudflare for SaaS**, which is
> what [plan/custom-domain-strategy.md](../plan/custom-domain-strategy.md)
> already selected in Phase 1 ("SSL complexity → offload to Cloudflare for SaaS").

---

## The problem this solves

A resort owner points `www.theirresort.com` at us. Today that request dies
before it reaches any ResortPro code:

- The web container has exactly one Traefik router, and its rule matches only
  `resortpro.site`, `www.`, `app.`, and `*.resortpro.site`
  (`deploy/production/docker-compose.yml`). A request with
  `Host: www.theirresort.com` matches no router at all.
- The certificate on that router covers `resortpro.site` + `*.resortpro.site`.
  It cannot cover a domain we do not own.
- Nothing anywhere in this repository adds Traefik routers at runtime.

**The application half is already finished and is not the problem.**
`apps/web/src/middleware.ts` resolves an unknown host through
`GET /site/domain/:hostname` and rewrites to `/<slug>`. That resolver
(`apps/api/src/routes/website.ts`) already filters on
`domainVerified: true, isActive: true`. It has simply never been reachable.

---

## Why not issue certificates ourselves

The obvious-looking fix — a catch-all Traefik router with a `certResolver`,
issuing a Let's Encrypt certificate per hostname on demand — **does not work
with Traefik.** Traefik issues certificates for domains it can enumerate from
`Host()` rules or `tls.domains`. It has no per-SNI on-demand issuance (that is
a Caddy feature; Traefik v1's `onDemand` was removed). Using `HostRegexp` as a
catch-all is additionally known to interfere with ACME challenge routing.

The viable in-house alternative was a dynamic Traefik provider generated from
the tenants table. It was rejected because wiring a new provider means editing
Traefik's **static** configuration, and Traefik here belongs to Coolify —
config this project does not own has a history of being silently reverted.

Cloudflare for SaaS needs no Traefik static change. It needs one extra *router
label* on our own compose file, which is dynamic configuration we do own.

---

## How it works

```
        www.theirresort.com
                 │  CNAME → <fallback-origin-host>.resortpro.site
                 ▼
        ┌─────────────────────┐
        │     Cloudflare      │  terminates TLS for the customer's domain
        │  (custom hostname)  │  issues + renews that certificate
        └─────────────────────┘
                 │  proxies to the fallback origin
                 │  Host: www.theirresort.com   (preserved)
                 ▼
        ┌─────────────────────┐
        │  Traefik (Coolify)  │  catch-all router, lowest priority,
        │                     │  NO certresolver
        └─────────────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │   rp-web (Next.js)  │  middleware.ts → /site/domain/:hostname
        │                     │  → rewrite to /<slug>
        └─────────────────────┘
```

The important property: **we never request a certificate for a domain we do not
own.** Cloudflare does that, under its own agreement with the customer's
domain. Our origin only ever serves the `*.resortpro.site` wildcard it already
has.

---

## The three pieces

### 1. Cloudflare zone (one-time, manual)

**Verified in the dashboard on 2026-10-30** — most of this is already true:

| Prerequisite | State |
|---|---|
| `resortpro.site` is a Cloudflare zone | ✅ Active, **Free** plan |
| Apex, `api.`, `app.` and `*.resortpro.site` proxied | ✅ all already orange-clouded |
| SSL/TLS encryption mode | ✅ already **Full** — what this design needs |
| Custom Hostnames available on this plan | ✅ 100 included at no charge |
| Cloudflare for SaaS activated | ✅ done 2026-10-30 |
| Fallback origin designated | ✅ `fallback.resortpro.site` |
| Explicit `fallback` DNS record | ✅ created 2026-10-30 (A, proxied) |
| Fallback origin **status** | ✅ `Active` (2026-10-30) |

**The fallback origin needs its own DNS record — a wildcard is not enough.**
`fallback.resortpro.site` already resolved through the proxied
`*.resortpro.site` wildcard, and `dig` returned Cloudflare's addresses exactly
as it does for `app.resortpro.site`. Cloudflare still rejected it. An explicit
record is required:

| Field | Value |
|---|---|
| Type | `A` |
| Name | `fallback` |
| IPv4 | same origin IP as the existing `api` / `app` / `*` records |
| Proxy status | **Proxied** (orange cloud) |
| TTL | Auto |

That record now exists and the fallback origin reports **Active**.

Note for anyone repeating this: immediately after creating the record the
status read `Pending Deployment (Error)`, and it still did a minute later.
That was not a misconfiguration — deployment is asynchronous and the error
text was the stale state from before the record existed. It cleared to
`Active` on its own. Don't go chasing it; wait a few minutes and refresh.

Because the wildcard is already proxied and the mode is already Full, **no DNS
change and no SSL-mode change are required.** The earlier worry about flipping
the wildcard to proxied breaking live tenant subdomains does not apply — it has
been proxied all along.

- Enable Cloudflare for SaaS on the zone. ⚠ The dashboard button leads to a
  **billing checkout**: it asks you to accept the Terms of Service and to
  authorize the card on file for usage beyond the free allowance. Today's
  charge is $0/month; beyond 100 custom hostnames it bills per hostname. A
  human has to agree to that — it is not something automation should tick.
- Designate a **fallback origin**: a proxied A/CNAME record in the zone
  (for example `origin.resortpro.site`) pointing at the server. This is the
  default route for every custom hostname. If it is missing or not designated,
  custom hostnames return **Error 1016**.
- Set the origin encryption mode. Two workable combinations:
  - **Preferred** — enable SNI rewrite (custom origin) so Cloudflare presents
    the fallback-origin hostname in SNI, letting the origin serve its valid
    wildcard certificate under **Full (Strict)**.
  - **Fallback** — leave SNI as the customer hostname and use **Full**
    (non-strict), which tolerates the resulting certificate mismatch at the
    origin. Weaker; prefer the first.

### 2. Traefik catch-all router (this repo)

A second router on the `web` service in `deploy/production/docker-compose.yml`:
lowest priority, **no `certresolver`**, so it can never trigger an ACME request.
The existing `rp-web` and `rp-api` routers keep their higher implicit priority
and continue to win for our own hostnames.

Because there is no certificate resolver on this router, a stranger pointing
DNS at the server achieves nothing except reaching the Next.js middleware,
which will fail to resolve their hostname and fall through.

### 3. API integration (this repo)

On successful DNS verification, the API registers the hostname with Cloudflare
and records the result:

- `POST /zones/{zone_id}/custom_hostnames` with the verified hostname.
- Cloudflare performs domain control validation (HTTP, TXT, or delegated DCV)
  and issues the certificate.
- Status flows back into the existing `Tenant.sslStatus` field
  (`none | pending | provisioning | active | error`).

**Abuse control:** a hostname is only ever sent to Cloudflare if it is present
in `Tenant.customDomain` with `domainVerified = true`. The DNS verification in
`POST /api/tenant/domain/verify` is the gate, and it already exists.

---

## The A-record path (removed 2026-10-30)

`PUT /api/tenant/domain` used to offer the owner a choice:

```
Add a CNAME record: theirresort.com → <slug>.resortpro.site
Or an A record:     theirresort.com → <server IP>
```

**Only the CNAME works under Cloudflare for SaaS**, so the A-record line is no
longer handed out. The CNAME target
`<slug>.resortpro.site` is a proxied record in our zone, so the request reaches
Cloudflare, matches the custom hostname, and gets the certificate Cloudflare
issued. (This requires `*.resortpro.site` to be **proxied** — orange cloud —
not DNS-only.)

An A record points straight at the server and bypasses Cloudflare entirely.
The domain will verify, we will register it, Cloudflare will issue a
certificate — and the browser will still see a certificate error, because
traffic never goes through Cloudflare. Traefik answers with the
`*.resortpro.site` wildcard, which does not cover the customer's domain.

`POST /api/tenant/domain/verify` **still accepts** an A record as proof of
ownership. That is deliberate — owners who set one up before this changed must
not suddenly fail verification. Instead the verify response carries a
`warning` telling them to switch to a CNAME, and the status banner stays blue
rather than green because the HTTPS probe will not find a usable certificate.

So: no longer advertised, still honoured, and honestly labelled.

---

## What this replaces

`POST /api/tenant/domain/provision-ssl` currently advertises a webhook at
`/api/tenant/domain/ssl-webhook`. **That route does not exist** — it is a single
string in `apps/api/src/routes/tenants.ts` and nothing serves it.

Under Cloudflare for SaaS there is no ACME completion callback of ours to wait
on; certificate state lives in Cloudflare and is read back from the custom
hostname record. The advertised webhook is therefore removed rather than built.

`PATCH /api/admin/domains/:id/ssl` (super-admin) stays as the manual override —
today it is the only way `sslStatus` ever becomes `'active'`.

---

## Cost

Confirmed in the zone's own activation screen: **100 custom hostnames included
at no charge**, usage-based beyond that. At ResortPro's scale that is
comfortably inside the free allowance — 100 resorts on their own domains is
well past the point where the product pays for itself.

The activation does require authorizing the card on file for the overage, so
the commitment is "$0 today, billed only if we exceed 100".

---

## Confirm during rollout

Still unverified:

- The live `/opt/resortpro/docker-compose.yml`. The copy in this repository is
  explicitly a **draft** written without server access, so the router rule
  quoted above is believed-accurate, not verified. This also means the Traefik
  **major version** is unconfirmed, which decides whether the catch-all rule
  needs v2 or v3 `HostRegexp` syntax.
- Whether Coolify's Traefik honours added router labels on this stack without
  further configuration.
- Whether SNI rewrite is worth enabling. With the zone already on **Full**
  (not Strict), the origin may serve its wildcard certificate regardless of
  SNI, so the simpler path works — but Full is the weaker of the two.

# Dependency vulnerabilities — what was fixed, what was accepted

Written 18 August 2026, against the readiness audit's P0 "4 critical, 48 high".

The raw counts were accurate. The conclusion drawn from them — that these
represent a live authorization/JWT bypass — did not survive checking each one
against how this application is actually configured.

## Fixed

**`next` 14.2.14 → 14.2.35.** Closes the CVE-2025-29927 middleware
authorization bypass and 11 high advisories. Patch-level within 14.2.x; web
typecheck and production build both pass.

Worth noting the bypass was not exploitable here either:
[middleware.ts](../../apps/web/src/middleware.ts) does subdomain rewriting and
locale detection, and `/dashboard` and `/admin` are in its `SKIP_PREFIXES`.
Authorization happens API-side via `request.jwtVerify()`. There was no
middleware authorization to bypass. Upgraded regardless — it is cheap, and
"we happen not to use the vulnerable path" is a weaker position than not
shipping the vulnerable version.

**JWT algorithms pinned** in [app.ts](../../apps/api/src/app.ts):
`sign: { algorithm: 'HS256' }`, `verify: { algorithms: ['HS256'] }`.

## Accepted, with evidence

Three `fast-jwt@4.0.5` criticals remain, reached via `@fastify/jwt@8.0.1`.
Each was tested against this configuration rather than taken at face value:

| Advisory | Why it does not apply here |
|---|---|
| JWT auth bypass via empty HMAC secret accepted by **async key provider** | `secret` is a static string, not a key-provider function |
| Cache confusion via `cacheKeyBuilder` collisions | fast-jwt caching is not enabled |
| Algorithm confusion (incomplete fix for CVE-2023-48223) | Verified directly: `alg: none` is rejected ("The token signature is missing"), and RS256 cannot be verified because no public key is configured. Unpinned, the only latitude was choosing among HS256/HS384/HS512 — all of which still require the same secret, so it is not a bypass. Pinned anyway. |

**Why not upgrade.** Reaching a patched `fast-jwt` (≥6.2.4) requires
`@fastify/jwt@10`, which depends on `fastify-plugin@^5` and therefore
**Fastify 5**. This API runs Fastify `^4.28.1` with roughly a dozen `@fastify/*`
plugins, every one of which would need its own major bump. That is a
framework migration, not a patch, and it is the wrong trade for a single-resort
pilot against three advisories demonstrated not to be reachable.

**Revisit this if any of these change** — each one turns an accepted risk back
into a live one:

- `secret` becomes a function/async key provider, or a keypair rather than an
  HMAC string (the latter is what makes algorithm confusion a real forgery)
- fast-jwt caching is enabled
- Fastify 5 is adopted for other reasons — take the JWT upgrade with it

## Remaining highs

42 high advisories, largely transitive and not imported by application code —
`axios`, for instance, appears nowhere in `apps/api/src` or the workspace
packages. The audit's proposed gate ("no critical/high accepted for launch") is
not a realistic bar for a transitive dependency tree; triage by reachability is.
These have not been individually triaged yet, and that is the honest status.

# Verification prompt — everything shipped 16–18 August 2026

Paste the section below into a **fresh** Claude Code session (or hand it to a
tester) to independently re-verify this work. It is written to be adversarial:
the goal is to *disprove* the claims, not to confirm them.

---

## THE PROMPT

You are verifying work you did not do. Assume the claims below are wrong until
your own commands say otherwise.

### Ground rules

1. **Never accept a green signal as proof.** A passing CI run, a successful
   deploy, or a "✅" in a log says a process finished, not that the behaviour is
   right. Prove each claim with a command whose output would look *different* if
   the claim were false.
2. **For every bug that was supposedly fixed, first reproduce the bug.**
   `git stash` the fix, watch the test fail, restore it, watch it pass. A test
   that passes against both versions is testing nothing.
3. **Restart servers explicitly after editing API code.** `tsx watch` in this
   repo does not reliably reload; a stale process produced a false "the endpoint
   is broken" conclusion twice during the original work. If a route 404s, restart
   before concluding anything.
4. **Do not toggle dark mode by adding `.dark` from the console.** ModalShell
   reads the theme at mount. Use the app's own theme switch (or set
   `localStorage.theme` and reload). Toggling by hand produced a false contrast
   bug report during the original work.
5. **Report findings as: claim → command you ran → actual output → verdict.**
   If you cannot verify something, say so explicitly rather than assuming.

### Environment

```bash
cd "/Users/parthohore/Hotel management"
git log --oneline origin/main..dev          # the search work, unpushed
git log --oneline -25                       # everything else
```

Two dev servers are needed. Start them via the preview tooling, not bare Bash:
`api-main` (port 4000) and `web-main` (port 3000). Confirm both:

```bash
curl -s -o /dev/null -w "api %{http_code}\n" http://localhost:4000/health
curl -s -o /dev/null -w "web %{http_code}\n" http://localhost:3000/
```

Dashboard login: `demo@resortpro.site` / `Demo@ResortPro2026!`, slug `demo`.

---

## 1. Global search (commits 34c26bc, b08a2cd, 14a6be8)

**Claim:** `GET /api/search?q=` returns tenant-scoped, role-filtered results with
identifier-first ranking; the ⌘K palette works by keyboard; a result lands on the
record.

- Run `pnpm --filter @resort-pro/api exec vitest run tests/integration/global-search.test.ts`.
  16 tests. Then delete an assertion you think is load-bearing and confirm it
  fails — a test file that cannot fail is decoration.
- Hit the endpoint directly with an owner token. `Karim Hossain` must return
  results across Bookings/Guests/Invoices. A one-character query must return
  `[]` **without** querying the tables.
- **Try to break tenant isolation.** Create a second tenant with an
  identically-named guest, then search as tenant A. Anything from B is a
  critical failure.
- **Try to break the role gate.** Log in as a RECEPTIONIST and search an *exact*
  invoice number. Expected: empty. If a redacted invoice row comes back, the
  category was queried and filtered rather than skipped — report it.
- Phone: the demo stores `+8801211111117`-style values. Searching
  `1111117`, the full number, and a punctuated variant must all match. This path
  uses raw SQL with `regexp_replace`; confirm `tenantId` is actually bound in
  that query (`apps/api/src/routes/search.ts`) and try to reach another tenant's
  guest through it.
- In the browser: ⌘K opens and focuses; the shortcut is **ignored** while the
  caret is in a page input; Arrow keys move `aria-activedescendant`; Enter opens
  the active row; Escape closes and returns focus to the trigger; `document.body`
  regains its scroll. At 320 px nothing overflows horizontally.
- End to end: pick the *guest* result for "Karim Hossain". You must land on
  `/dashboard/guests?search=Karim%20Hossain` **with the list filtered to one
  row**. Landing on an unfiltered list is a failure — that exact bug existed and
  was fixed by two separate changes.

**Known gap to confirm, not fix:** twelve other modules (bookings, invoices,
inventory, staff, CRM…) still use single-`contains` search, so a full name still
returns 0 there. Verify this is still true and list which modules.

---

## 2. Inventory concurrency (f490de4)

**Claim:** concurrent stock movements can no longer be lost.

- `vitest run tests/integration/inventory-concurrency.test.ts` — 5 tests.
- `git stash push apps/api/src/routes/inventory.ts`, re-run, and confirm **4
  fail**. Expected old behaviour: 10 concurrent OUTs of 2 against a stock of 10
  are *all* accepted. Restore the file afterwards.
- Then design a case the tests do **not** cover — mixed IN and OUT concurrently,
  or ADJUSTMENT racing an OUT — and check stock still equals the ledger.

---

## 3. SSRF guard (022fa79)

**Claim:** tenant-supplied calendar URLs cannot reach internal hosts.

- `vitest run tests/unit/safe-url.test.ts` — 26 tests.
- Stand up a local HTTP server, point an `icalUrl` at it through the real
  route, and confirm **zero** requests arrive. Try: `http://` (scheme),
  `https://127.0.0.1`, `https://localhost`, `https://[::1]`,
  `https://169.254.169.254`, `https://postgres:5432`, a hostname that resolves to
  a private address, and embedded credentials.
- **Known residual:** DNS rebinding between check and fetch is not closed.
  Confirm that is still the only gap you can find.

---

## 4. Private uploads (161f383)

**Claim:** guest ID/passport scans need a signed URL; public site images do not.

- `vitest run tests/integration/private-uploads.test.ts` — 9 tests.
- Place a file under `$STORAGE_LOCAL_DIR/<tenant>/guest-docs/` and fetch it with
  no token. Expected **404**, and the same 404 as a file that does not exist —
  a distinguishable response would confirm the document exists.
- Fetch a file under `<tenant>/rooms/` with no token. Expected **200**; if this
  is refused, every customer's public website is broken.
- Take a valid signed URL and try: tampering one hex character, moving the
  signature to a different document, and waiting past expiry.
- Confirm the API hands out signed URLs on **both** the document list and the
  upload response — a stored URL alone must not work.

---

## 5. Backup and restore (2043b07)

**Claim:** backups are taken, verified, and a restore has been rehearsed.

Do not trust the rehearsal in the runbook. Run your own:

- Start a scratch Postgres, seed two tables with known row counts and a
  foreign key, run `scripts/backup-db.sh`.
- Drop the tables. Restore into a **different** database with
  `scripts/restore-db.sh`. Compare row counts, a summed numeric column, and the
  foreign key — compute the expected sum in code, not by hand.
- Truncate a dump and confirm the restore refuses it with a non-zero exit.
- Confirm `restore-db.sh` refuses to run without an explicit target database.

**Known gap:** dumps sit on the same host as the database. Confirm nothing
copies them off-box.

---

## 6. Worker, uploads volume, backup service (9bc190b, 654901e, 2043b07)

**Claim:** all three compose files define worker + backup + an uploads volume,
and production is not configured to wipe its demo tenant.

```bash
for f in docker-compose.production.yml docker-compose.staging.yml docker-compose.coolify.yml; do
  POSTGRES_PASSWORD=x JWT_SECRET=y WEB_URL=http://x docker compose -f "$f" config
done
```

- Services must include `worker` and `backup`. Worker `replicas: 1` — more than
  one would send every reminder twice.
- The worker's resolved environment must match the api's **key for key**. Diff
  them programmatically; a missing variable here fails silently at runtime.
- `SEED_DEMO_REFRESH` must be `1` on staging and **absent** on production and
  coolify. A refresh deletes the demo tenant, and production's holds invoice
  rows.
- Prove the uploads volume matters: with the real API image, write a file inside
  a container without the volume and confirm a fresh container cannot read it;
  repeat with the volume and confirm it can.

---

## 7. Trial emails (b7b6e1a, a312d9c, b608beb, 3a0dd06)

**Claim:** no duplicate sends, no first-run backlog burst, no false deletion
warning.

- `vitest run tests/integration/trial-email-dedupe.test.ts` and
  `trial-email-backlog.test.ts` and `trial-email-firstrun.test.ts`.
- Stash `apps/api/src/services/trial-emails.ts` and confirm the dedupe test
  shows **3 sends** for one tenant.
- Simulate a virgin environment: empty `trial_email_logs`, tenants at 7/3/1 days
  before expiry and 0/3/7/29.7 days after. On the first run, nobody past-due may
  be mailed and all three live trials must be. This must hold with **no manual
  script run first** — the worker starts seconds after a deploy.
- Grep the source (comments stripped) for `permanently deleted`,
  `deletion scheduled`, `data deletion`. Any hit outside a comment is a
  regression: nothing in this codebase deletes dormant tenant data.

---

## 8. Plan → module access (cc665fa)

**Claim:** cancelling a subscription revokes paid modules; a referral plan grant
unlocks them.

- `vitest run tests/integration/plan-flag-sync.test.ts` — 4 tests.
- Confirm all five `tenant.plan` write sites call `applyPlanFlagsToTenant`:
  admin plan change, referral FREE_PLAN, bKash paid, Stripe checkout, Stripe
  `customer.subscription.deleted`.
- **Do not repeat my mistake:** changing `tenant.plan` directly through Prisma
  bypasses the routes and proves nothing. Exercise the real handlers.

---

## 9. Demo data (f409c7f, 58ae44e, 31a0b6d)

- Every image slot filled: rooms, menu, packages, hero/about/gallery,
  testimonial avatars, staff avatars, tenant logo/cover, venues, vehicles.
- Fetch every Unsplash URL in `seed-demo.ts` and confirm each returns 200. Two
  were dead when this was written; assume more can rot.
- Load `http://localhost:3000/demo` and count broken images in the DOM
  (`naturalWidth === 0`). Expected 0.
- Confirm the nightly refresh cron is gated on `SEED_DEMO_REFRESH` and is a
  no-op without it, and that the refresh **refuses** to run when the `demo`
  tenant is not flagged `isDemo`.

---

## 10. Regression sweep

```bash
pnpm --filter @resort-pro/api test        # expect 141 passed
pnpm --filter @resort-pro/api exec tsc --noEmit
pnpm --filter @resort-pro/web exec tsc --noEmit
pnpm --filter @resort-pro/web build
node scripts/design-system-ratchet.mjs    # expect no regressions
pnpm audit --prod --audit-level=high      # expect 3 critical, all fast-jwt
```

The three remaining criticals are accepted with reasoning in
`plan/fixes/dependency-risk-acceptance.md`. **Re-test that reasoning** rather
than trusting it: confirm `alg: none` is rejected, that no async key provider is
configured, and that fast-jwt caching is off. If any has changed, the acceptance
is void.

---

## Highest-value targets — things nobody has verified

Spend your time here; the sections above are already covered by tests.

1. **Nothing has been verified on production.** All nine readiness fixes are
   deployed to `main` but only ever exercised locally and on staging.
2. **The worker has never been observed running in production.** Confirm the
   container exists, that exactly one runs, and that its first run logged the
   backlog suppression.
3. **The pending-booking sweep has never run against real data.** Count what it
   will cancel before it does:
   `SELECT count(*) FROM bookings WHERE status='PENDING' AND "paidAmount" <= 0 AND "createdAt" < now() - interval '30 minutes';`
4. **No backup has been confirmed on production.** `docker compose logs backup`
   should show `[backup] ok — <bytes> bytes, <n> tables with data`.
5. **No load testing at all.** The plan's own target is p95 < 300 ms at 10,000
   guests and 50,000 bookings. Search was measured at 23–35 ms on ~10 guests,
   which says nothing.
6. **Payment flows are untested end to end.** bKash theme checkout is live in
   production; if credentials are unset, a Buy click fails.
7. **Uploads are durable but the S3/R2 driver is unprotected** — the signed-URL
   gate covers the local driver only.

Report what you could not verify as loudly as what you could.

# ResortPro verification results — 23 August 2026

## Status

Verification is in progress. This report records only work independently
re-tested today. A previous green CI run or deployment is not treated as proof.

## Environment used

- Repository: /Users/parthohore/Hotel management
- Database: local Docker Postgres, healthy and accepting connections
- Browser: local API on port 4000 and local web app on port 3000
- Browser account: demo@resortpro.site, workspace demo
- Browser viewport: 1440 by 960

The supplied demo account redirects to onboarding because the local demo
tenant's onboardingCompletedAt is NULL. The dashboard search checks below use
a browser-only persisted-state override. No database record was changed.

## Passed with evidence

| Claim | Command or test | Actual result | Verdict |
| --- | --- | --- | --- |
| Global Search API works | pnpm --filter @resort-pro/api exec vitest run tests/integration/global-search.test.ts | 16 passed | Pass |
| Global Search test can fail | Temporarily changed the exact confirmation result expectation from booking to guest | 1 expected failure: received booking | Pass: assertion is load-bearing |
| Inventory concurrency | inventory-concurrency.test.ts | 5 passed | Pass |
| SSRF URL guard | safe-url.test.ts | 26 passed | Pass at unit-test level |
| Private uploads | private-uploads.test.ts | 9 passed | Pass |
| Trial email lifecycle | dedupe, backlog, and first-run test files | 13 passed | Pass |
| Plan flag sync | plan-flag-sync.test.ts | 4 passed | Pass |
| Combined high-risk safety suite | Seven listed files | 57 passed | Pass |
| API type safety | pnpm API TypeScript check | Exit 0 | Pass |
| Web type safety | pnpm web TypeScript check | Exit 0 | Pass |
| Design regression guard | node scripts/design-system-ratchet.mjs | No category exceeded baseline | Pass |

### Browser evidence: Global Search

1. Cmd + K opened the palette and focused the search combobox.
2. Searching Nadia Chowdhury returned four records: three bookings and one
   guest.
3. Arrow navigation updated aria-activedescendant.
4. Enter opened a booking detail route:
   /dashboard/bookings/74df894e-8ed3-4bd8-80ec-bf5af04ace6a
5. Selecting the guest result opened:
   /dashboard/guests?search=Nadia%20Chowdhury
6. The destination guest list showed exactly one Nadia Chowdhury row.
7. Escape closed the palette and document.body.style.overflow was reset to an
   empty value.

## Findings that need a fix

### P1 — Global Search palette has no semantic dialog

**Expected:** The palette is exposed as a dialog to assistive technology.

**Evidence:** After Cmd + K, the browser found zero elements matching
[role="dialog"], although the palette was visibly open and its input was
focused.

**Cause location:** apps/web/src/components/ui/modal-shell.tsx renders generic
div elements without dialog, aria-modal, aria-labelledby, or aria-describedby
semantics.

**Impact:** Screen-reader users do not receive the required modal context. This
also affects every feature that uses ModalShell, not only Global Search.

**Fix direction:** Add an accessible dialog contract to ModalShell, including
role="dialog", aria-modal="true", a stable title ID, and description ID when a
description exists. Re-test all ModalShell consumers after the shared change.

### P1 — Escape does not return focus to the Global Search trigger

**Expected:** After closing with Escape, focus returns to the header button
labelled “Search guests, bookings, rooms”.

**Evidence:** The browser reported no aria-label on document.activeElement after
Escape. The focused element was not the search trigger.

**Impact:** Keyboard users lose their place after closing search.

**Likely change area:** apps/web/src/components/dashboard/top-nav.tsx and
apps/web/src/components/dashboard/GlobalSearch.tsx. Preserve focus only after
the palette unmounts, rather than racing with the focused input's removal.

## Environment / test-fixture blockers

### Demo dashboard credentials do not reach the dashboard

The checklist specifies demo@resortpro.site with slug demo for dashboard testing.
Those credentials authenticate, but route to /onboarding because the local demo
tenant has no onboardingCompletedAt value.

This is a local fixture or seed-state problem unless the same tenant state exists
in staging or production. It prevents an unmodified end-to-end dashboard test.
Do not mark it fixed by adding a browser override. Instead, ensure the demo
seed finishes onboarding or provide a completed dashboard test account.

### Local email is disabled

The local environment reports that RESEND_API_KEY is not configured. Trial
email tests pass by using test doubles, but no real Resend delivery was tested.
Production delivery still needs a separate authorised production check.

## Not yet verified

- Production worker existence, one-replica behaviour, and first-run logs.
- Production backup completion and an independent restore rehearsal.
- Real-route SSRF attempts against a local HTTP listener.
- S3/R2 private-upload driver behaviour.
- Full API suite, web production build, and production dependency audit.
- Browser verification as receptionist and shareholder accounts.
- The keyboard-shortcut ignore behaviour while a page input has focus.
- Global Search at a 320-pixel viewport.

## Recommended next order

1. Fix the two P1 Global Search accessibility issues.
2. Make the demo tenant a completed onboarding fixture.
3. Re-run the browser test unmodified, then add receptionist, shareholder,
   mobile, and page-input-shortcut cases.
4. Continue with backup/restore and production-worker verification only with
   production access and explicit approval.


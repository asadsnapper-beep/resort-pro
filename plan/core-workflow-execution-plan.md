# Core Workflow — Execution Plan (sequenced, scoped, small-step)

**Status:** Active execution roadmap
**Created:** 2026-08-06
**Relation to other docs:**
- [core-workflow-completion-plan.md](./core-workflow-completion-plan.md) — the full 13-initiative audit. Good as a **reference/backlog**, not a sprint plan. Written before/parallel to this session's work, so several of its "Problem" statements are already outdated (see §1).
- [README.md](./README.md) — 22 Jul 2026 whole-codebase audit. Says core PMS/payments/CRM/admin are "✅ Built" and solid enough for the pilot-first strategy. That audit didn't test booking-lifecycle depth (modify/cancel/refund/rate-plan wiring) — this session did, by hand, and found real gaps that are now mostly closed.

**This document exists to answer one question: of everything in `core-workflow-completion-plan.md`, what should actually get built, in what order, and what should be skipped or postponed — for a pre-launch, pilot-first (2–3 hand-onboarded resorts) product, built by one person working in small verified steps.**

---

## 0. Ground rules for this roadmap

1. **One task at a time.** Pick the next unchecked item below, build it, verify it live (curl + real browser + DB check — the pattern already used all session), report back, then stop. Do not chain multiple items into one pass.
2. **Verify the "Problem" claim before building the "Solution."** `core-workflow-completion-plan.md` was partly stale — Initiative 2's cancellation claim was already wrong by the time it was read. Every remaining initiative (6–13 especially) needs the same 5-minute "is this actually still broken in current code" check before any work starts on it.
3. **Don't build shared service layers (`availability.ts`, `booking-pricing.ts`, `booking-lifecycle.ts`, `billing.ts`, outbox pattern) preemptively.** Extract a shared module only once the same logic has genuinely been duplicated 3+ times and a bug has repeated across those copies. Until then, the direct-fix pattern used this session (fix the route, reuse existing exported helpers like `resolveRate`/`calcDiscount`) is correct for this project's size.
4. **Pilot-scale priority test:** for 2–3 small resorts being hand-onboarded, does this bug (a) touch money, (b) touch a guest-facing flow, or (c) happen often? If none of the three, it's Tier 3/4 — real but not urgent.

---

## 1. Tier 0 — Already done this session (do not re-plan)

| Item | Verified how |
|---|---|
| Booking Modify (dates/room/guests/special requests) | Live browser test + DB check |
| Cancellation with reason, fee, manual refund record | Live browser test + DB check |
| Rate plan resolution wired into booking create + modify totals | curl + DB check |
| Package apply/remove on an existing booking | Live browser test + DB check |
| Offer/discount apply/remove on an existing booking | Live browser test + DB check |
| Public booking (`/site/:slug/book`) double-booking race — serializable transaction | 10 concurrent `curl` requests → exactly 1 succeeded, DB confirmed |
| Internal booking create (`POST /api/bookings`) double-booking race | Already safe — pre-existing `Serializable` transaction pattern, confirmed by reading the code |

These map to most of Initiative 1, most of Initiative 2 (manual/local refund only — gateway refund explicitly deferred, see Tier 4), the core of Initiative 3, and the core concurrency risk in Initiative 4.

---

## 2. Tier 1 — Next up (small, high real-risk, do one at a time)

Ordered by how soon a pilot owner would actually hit the problem.

### 1. Abandoned `PENDING` booking never expires — blocks rooms forever (new finding, verified in code)

Not from the completion-plan doc — found while reading `bookings.ts` this session. Both `POST /api/bookings` (internal create) and `PATCH /:id/modify` block a room if **any** `PENDING` booking exists for it, with **no age limit**:

```ts
status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },   // no createdAt filter
```

The public route (`website.ts`) only ignores `PENDING` older than 30 minutes — so internal and public availability already disagree, and neither ever actually *terminates* an old `PENDING` row. It just sits there. A guest who starts a public booking and abandons it (closes tab before paying) permanently blocks that room from being booked from the dashboard too, until a human notices and manually cancels it.

**Fix (small):** a scheduled job (reuse the existing job/worker pattern — check `apps/api/src/jobs/` for the convention already used by `ical-sync`) that finds `PENDING` bookings older than N minutes with no payment and flips them to `CANCELLED` (with a note like "Auto-expired — no payment received"), releasing the room. Then align the internal conflict-check queries to also ignore stale `PENDING` (or better: rely on the job so there's no stale `PENDING` left to special-case).

**Why #1:** real, live, affects both public guests and staff, silent (nobody gets an error telling them why a room won't book), small fix.

### 2. Restaurant order created = instantly `PAID`

From Initiative 7. **Needs a 2-minute verify first** (open `apps/api/src/routes/*food*` or `*restaurant*` and check the order-create handler's default `paymentStatus`) — if still true, this is a one-line-default + one "mark as paid" action fix, not the full inventory/recipe rebuild Initiative 7 describes. Money-adjacent (staff could hand over food thinking it's paid when it isn't), guest-facing, happens every order.

### 3. No-show as its own action

Right now a no-show guest can only be handled via "Cancel Booking" with a reason typed in free text — works, but the fee/refund defaults and the audit trail don't distinguish "guest never arrived" from "owner cancelled for guest." Small: reuse the existing cancel endpoint/UI, add a `isNoShow: boolean` flag and a distinct button/label rather than a new service.

---

## 3. Tier 2 — Do once Tier 1 is done and before onboarding paying pilot tenants

### 4. Lightweight invoice/balance consistency check (scoped-down Initiative 5)

Not the full ledger rewrite. A **read-only audit script** (`apps/api/src/scripts/audit-balances.ts` style, matching existing scripts folder) that, for every booking, compares `totalAmount`/`paidAmount` against the sum of payments + attached packages + offers + any extras, and prints a mismatch report. Run it once now to see if any drift already exists in real data; fix root causes it finds one at a time. This buys the trust-safety Initiative 5 is after without months of ledger-service work.

### 5. Group booking: reuse the single-booking conflict check on create

From Initiative 6, scoped down hard: **just** make group-booking creation call the same conflict-check logic (or literally the same query) that single bookings use, so a group can't double-book a room either. Skip the rest of Initiative 6 (MASTER/INDIVIDUAL billing modes, child-sync on date edit, bulk-checkout lifecycle rebuild) — only worth it once a pilot tenant actually runs group bookings regularly.

---

## 4. Tier 3 — Real, but can wait (polish on already-shipped features)

- **Rate plan nightly breakdown + explicit stacking rules** (rest of Initiative 3) — only matters once a tenant's stay actually crosses a weekend/seasonal boundary with multiple rate plans active. Wait for a real case.
- **Cancellation policy field** (so "non-refundable rate plan" is either real or removed from docs) — do alongside whichever docs pass touches this claim.
- **Formal `POST /:id/cancellation-preview` API endpoint** — the CancelBookingModal already computes a client-side preview; making the server the source of truth for that number is correctness polish, not a functional gap yet.
- **Housekeeping: group checkout should create cleaning tasks too** (Initiative 12, scoped to just this one bug, not the whole state-machine rebuild) — verify it's still true, then it's a small fix, not urgent for a 2–3 resort pilot.

---

## 5. Tier 4 — Explicitly deferred, do not start without a real trigger

| Item | Why deferred |
|---|---|
| Online gateway refund automation (rest of Initiative 2) | Blocked on bKash/Stripe live credentials, which per current launch status aren't set up yet. No user to serve until the gateway itself is live. |
| Full ledger/billing service rewrite (rest of Initiative 5) | Big, no new visible capability, high risk of breaking what's already verified working. Do only if the Tier 2 audit script finds real, frequent drift. |
| Group booking full rebuild (rest of Initiative 6) | `group-bookings.md` per README is already built; full MASTER/INDIVIDUAL billing rework is speculative until a tenant needs it. |
| Restaurant inventory/recipe stock deduction (rest of Initiative 7) | `restaurant.md` and `inventory.md` are already ✅ Built independently; wiring them together is real work but not blocking a small resort's daily use. |
| Marketing scheduler completion (Initiative 8) | README marks `sms-whatsapp-marketing.md` ✅ Built. Spot-check the specific "worker doesn't send" claim against current code before believing it — same lesson as Initiative 2. |
| Reports accuracy overhaul (Initiative 9) | README marks `reporting-analytics.md` ✅ Built. Same spot-check-first rule applies. |
| Payroll (Initiative 10) | Small resorts in a hand-onboarded pilot commonly still do payroll outside the system. Real feature, not urgent. |
| Loyalty redemption → invoice credit (Initiative 11) | README marks loyalty ✅ Built; verify the specific "redemption doesn't reduce the bill" claim first — may be a small fix once confirmed, not a redo. |
| Advanced modules (vehicle/venue/minibar/laundry/corporate) → unified ledger (Initiative 13) | Each module already works standalone and is marked ✅ Built. Ledger unification is nice-to-have accounting hygiene, not a pilot blocker. |
| Any new shared-service files (`availability.ts`, `booking-pricing.ts`, etc.) | Per Ground Rule 3 — extract when duplication actually hurts, not before. |

---

## 6. Recommended immediate next step

**Item #1 (Tier 1): the abandoned-`PENDING`-never-expires bug.** It's real (verified in code, not assumed from the plan doc), it's small, it affects both guests and staff today, and it's the natural continuation of the double-booking-concurrency fix just shipped — same area of the codebase, same verification pattern (curl → browser → DB check).

Say go and I'll build just that one piece.

# ResortPro — Early Check-in & Late Checkout (P1)

> Availability and room readiness come before price. A room that is not clean
> cannot be given at any price, and a policy engine that forgets this will
> quote a fee for a room the guest cannot have.

Status: ❌ Not built · **P1** · Implements [billing-contract.md](./billing-contract.md)
Depends on: [checkout-billing-completeness.md](./checkout-billing-completeness.md)

---

## 1. Current state

Only a display flag: `BookingDetailSheet.tsx:77` computes `isEarlyCheckIn` from
the date difference. No time-of-day policy, no availability check, no charge.

Already present and reusable:

- `Tenant.checkInTime` (`"14:00"`), `Tenant.checkOutTime` (`"11:00"`)
- `Tenant.timezone` (`"Asia/Dhaka"`) and the helpers in `utils/tenant-day.ts`
- `Room.status` (`AVAILABLE | OCCUPIED | CLEANING | MAINTENANCE | RESERVED`)
- `HousekeepingTask.status` (`PENDING | IN_PROGRESS | COMPLETED | SKIPPED`)

---

## 2. Availability gate — evaluated before any price

Early check-in is refused unless **all** hold:

1. No overlapping booking on the room in `CONFIRMED | CHECKED_IN | PENDING`
   covering the earlier arrival window.
2. `Room.status ∈ {AVAILABLE, RESERVED}` — not `CLEANING`, not `MAINTENANCE`,
   not `OCCUPIED`.
3. No open `HousekeepingTask` of type `CHECKOUT`/`CHECKIN` for that room in
   `PENDING | IN_PROGRESS`.
4. If yesterday's guest departs today, their booking is already `CHECKED_OUT`.

Late checkout is refused unless:

1. No arrival for that room today whose check-in time would be breached.
2. The requested release time leaves the housekeeping window intact (see §7).

The UI must distinguish **"not possible"** from **"possible, costs X"**. A
receptionist told only "৳3,187" will promise a room that is being cleaned.

---

## 3. Timezone rules

All comparisons happen in `Tenant.timezone`, never server-local time.

- "Now" for policy purposes: current instant rendered in the tenant timezone.
- `Tenant.checkInTime` / `checkOutTime` are wall-clock strings in that zone.
- `Booking.checkIn` / `checkOut` are `@db.Date` — use `startOfTenantDay()` from
  `utils/tenant-day.ts`, which already exists precisely because comparing a
  `@db.Date` against local midnight silently broke arrivals counts east of UTC.
- Store `requestedAt` / `approvedAt` as absolute UTC instants; render in tenant
  time.

---

## 4. Policy configuration (per tenant)

```prisma
model StayTimePolicy {
  id                    String  @id @default(cuid())
  tenantId              String  @unique
  enabled               Boolean @default(false)   // off = manual decisions only

  earlyFreeAfter        String  @default("11:00") // free from here to check-in
  earlyHalfAfter        String  @default("06:00") // half rate in this window
  // before earlyHalfAfter → full night

  lateFreeUntil         String  @default("14:00")
  lateHalfUntil         String  @default("18:00")
  // after lateHalfUntil → full night

  halfRatePercent       Float   @default(50)
  chargeBasis           String  @default("EFFECTIVE") // EFFECTIVE | BASE
  waiverRequiresManager Boolean @default(false)
}
```

The free window is not optional. A policy with no free tier pushes staff into
undocumented off-book discounts, and then the resort has neither the money nor
the record.

`enabled = false` keeps the whole feature advisory: the desk sees the time
context, no fee is proposed.

---

## 5. Fee basis

`chargeBasis = EFFECTIVE` (default) uses the booking's own nightly rate:

```
effectiveNightly = booking.totalAmount / nights
fee = round(effectiveNightly × rateFactor, 2)     rateFactor ∈ {0, 0.5, 1.0}
```

This is deliberately derived from `booking.totalAmount`, the same source the
contract mandates for the room line — so a guest on a promotional rate is
charged half of *their* rate, not half of the rack rate.

`chargeBasis = BASE` uses `room.basePrice` for resorts that price these as a
standard service. Tax and rounding follow the contract (§5): round once, at the
line total; tax applies to the invoice subtotal, not to the fee in isolation.

---

## 6. Charge creation

The fee becomes an `InvoiceExtra` and enters the bill through `bill()` — it
never computes its own total.

```
description = "Early check-in (08:30, policy: half-day)"
sourceType  = 'EXTRA'
sourceId    = stayTimeGrant.id      ← idempotent per grant
```

Comped grants record the full price plus an offsetting discount line, per
contract §3, so waived revenue is reportable.

```prisma
model StayTimeGrant {
  id           String   @id @default(cuid())
  tenantId     String
  bookingId    String
  kind         String   // EARLY_CHECKIN | LATE_CHECKOUT
  requestedFor DateTime // the time the guest asked for
  approvedFor  DateTime // the time actually granted
  policyBand   String   // FREE | HALF | FULL
  quotedFee    Float
  waivedAmount Float    @default(0)
  chargedFee   Float
  overrideReason String?
  approvedBy   String   // User.id
  createdAt    DateTime @default(now())
  @@index([tenantId, bookingId])
}
```

Every field in this model is an audit requirement, not a convenience: without
`policyBand`, `quotedFee` and `waivedAmount` there is no way to answer "how
much did we give away last month, and who authorised it".

A `BillingAudit` row is written alongside for `WAIVE` and `COMP` actions.

---

## 7. Interaction with housekeeping

Late checkout delays the room's `CHECKOUT` cleaning task. On approval, the
task's `scheduledDate` moves to the approved release time, and the housekeeping
board shows the room as "released at 17:00" rather than overdue. Without this
the cleaning queue shows a false backlog every time a late checkout is granted.

---

## 8. Permissions

| Action | OWNER | MANAGER | RECEPTIONIST |
|---|---|---|---|
| See availability + quote | ✓ | ✓ | ✓ |
| Grant within policy (charged) | ✓ | ✓ | ✓ |
| Waive the fee | ✓ | ✓ | only if `waiverRequiresManager = false` |
| Grant outside policy (override) | ✓ | ✓ | ✗ |
| Edit the policy | ✓ | ✓ | ✗ |

Overrides always require a reason string.

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Arrival at 02:00 | counts as the **previous night**, charged as a full night; stated explicitly in the policy UI so staff do not argue it |
| Room being cleaned | quote suppressed; UI shows "ready by ~HH:MM" from the housekeeping task |
| Next arrival same day | late checkout blocked regardless of price |
| Guest leaves earlier than the granted late checkout | fee stands unless waived; waiving writes an audit row |
| Checkout reversed / booking re-opened | grant remains; its charge remains; reversing the charge is an `ADJUSTMENT` |
| Booking cancelled | grants cascade to cancelled; unbilled fees dropped |
| Two grants of the same kind | second supersedes the first; the earlier grant is voided with an adjustment, never silently overwritten |
| Policy edited mid-stay | grants already issued keep their snapshotted `policyBand` and `quotedFee` |

---

## 10. UI states

The check-in and check-out modals show exactly one of:

```
⛔ Not available     Room 201 is being cleaned · ready ~11:30
⛔ Not available     Room 201 has an arrival today at 14:00
✓  Free             Within the free window — no charge
৳  Fee applies      Half day · ৳3,187   [Charge] [Waive] [Wait until 14:00]
🔒 Approval needed   Outside policy — needs a manager
✓  Granted          Early check-in 08:30 · ৳3,187 charged  ·  by Alex
```

`[Waive]` is deliberately equal in prominence to `[Charge]`; hospitality
requires the free option to be easy, and the audit row makes it accountable.

---

## 11. Tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Arrival 12:00, check-in 14:00, `earlyFreeAfter 11:00` | band FREE, fee 0 |
| 2 | Arrival 08:30 | band HALF, fee = 50% of effective nightly |
| 3 | Arrival 04:00 | band FULL, fee = one night |
| 4 | Room `CLEANING` | refused before any quote is produced |
| 5 | Overlapping booking on the room | refused |
| 6 | Departure 17:00, `lateHalfUntil 18:00` | band HALF |
| 7 | Departure 19:00 | band FULL |
| 8 | Arrival today for the same room | late checkout refused |
| 9 | Booking on a promo rate | fee derived from `totalAmount / nights`, not `basePrice` |
| 10 | `chargeBasis = BASE` | fee derived from `room.basePrice` |
| 11 | Grant → checkout | fee appears once on the bill |
| 12 | Grant issued twice (retry) | one `InvoiceExtra` (sourceId unique) |
| 13 | Waived grant | `chargedFee = 0`, `waivedAmount` set, audit row present |
| 14 | Receptionist waives with `waiverRequiresManager = true` | 403 |
| 15 | `enabled = false` | no fee proposed anywhere |
| 16 | Tenant in `Asia/Dhaka`, request at 01:00 UTC | evaluated as 07:00 local, band HALF |
| 17 | Booking cancelled after grant | grant cancelled, no orphan charge |

### Manual QA

- [ ] Early check-in on a dirty room offers a time, not a price
- [ ] Late checkout moves the housekeeping task rather than making it overdue
- [ ] Waiver requires a reason and shows who granted it
- [ ] Policy disabled → the desk sees context only

---

## 12. Rollout

Flag `stay_time_policy`, default off; a tenant that never enables it sees no
change. Rollback disables the flag; issued grants remain visible and billed.

---

## 13. Files to change

```
apps/api/src/services/stay-time-policy.ts      (new — availability + banding)
apps/api/src/services/billing.ts               (consumes the extra; no new totals)
apps/api/src/routes/bookings.ts                (check-in / check-out handlers)
apps/api/src/routes/tenants.ts                 (policy settings)
apps/web/src/app/(dashboard)/dashboard/front-desk/page.tsx
apps/web/src/app/(dashboard)/dashboard/settings/…  (policy editor)
packages/database/prisma/schema.prisma + migration
```

---

## 14. Out of scope

Hourly room rental · day-use bookings · automatic upsell emails ("stay till 4pm
for ৳500") · dynamic pricing of the fee by occupancy.

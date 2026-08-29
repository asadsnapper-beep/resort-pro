# ResortPro — The Billing Contract

> **The rule every billing module obeys:** a guest must never see or be charged
> a different total in two places. One calculation, one provenance standard,
> one immutable record once the stay is settled.

This document is the shared foundation for
[checkout-billing-completeness.md](./checkout-billing-completeness.md),
[restaurant-room-billing.md](./restaurant-room-billing.md),
[early-checkin-late-checkout.md](./early-checkin-late-checkout.md) and
[airport-transfers.md](./airport-transfers.md), and for every future charge
source (spa, laundry, minibar, vehicle rental, maintenance recharges).

Status: 📋 Contract — normative. Implemented by the P0 plan.

---

## 1. Why this exists

Today four independent calculations disagree about one stay:

| Where | Room price from | Food | Extras | Packages | Tax |
|---|---|---|---|---|---|
| `front-desk/page.tsx:131` | `booking.totalAmount` | ✗ | ✗ | ✗ | ✗ |
| `bookings.ts:605` (check-out) | `booking.totalAmount` | ✓ | ✗ | ✗ | ✗ |
| `guest-emails.ts:267` (guest email) | `room.basePrice × nights` | ✓ | ✓ | ✗ | ✓ |
| `bookings.ts:942` (invoice page) | `room.basePrice × nights` | ✓ | ✓ | ✗ | ✓ |
| `bookings.ts:25` (`autoCreateInvoice`) | `room.basePrice × nights` | ✗ | at-create only | ✓ | ✓ |

Every new charge source multiplies this. The contract stops it.

---

## 2. The five rules

### R1 — One authoritative calculation

`bill(bookingId, opts)` in `apps/api/src/services/billing.ts` is the **only**
code permitted to produce a payable total for a stay. Front desk, check-out,
guest email, invoice page, PDF and every future module read from it.

No module may sum charges itself. A pull request that adds a second
`reduce((s, x) => s + x.total)` over stay charges is rejected.

### R2 — Every line item carries its provenance

```prisma
model InvoiceItem {
  // … existing fields
  sourceType String?  // ROOM | PACKAGE | FOOD_ORDER | EXTRA | TRANSFER | ADJUSTMENT
  sourceId   String?  // the originating row's id
  @@unique([invoiceId, sourceType, sourceId])
}
```

The unique constraint is what makes charge creation idempotent: a retry writes
the same `(sourceType, sourceId)` and is rejected by the database rather than
silently doubling the guest's bill.

`sourceType = 'ROOM'` uses `sourceId = bookingId`. `ADJUSTMENT` rows carry no
source and are exempt (see R5) — enforce with a partial unique index.

### R3 — Charge creation is idempotent

Any operation that can be retried — checkout, a webhook, a double-clicked
button, a queued job — must be safe to run twice. Concretely:

- Finalisation is keyed on `Invoice.status`, not on "did we already run".
- Line items are written with `createMany({ skipDuplicates: true })` under R2's
  constraint, or upserted on `(invoiceId, sourceType, sourceId)`.
- Side effects (email, PDF, loyalty points) run **after** the transaction
  commits, and each is separately guarded by its own "already sent" marker.

### R4 — The final invoice is immutable

```
DRAFT      →  live, recomputed on every read. Nothing is guaranteed.
FINAL      →  frozen at checkout. Line items, prices and totals never change.
```

Once a booking reaches `CHECKED_OUT` its invoice is a historical record. No
code path may edit its items or totals. This is what makes yesterday's revenue
report still true tomorrow.

### R5 — Corrections after finalisation are adjustments, never edits

A mistake found after checkout is corrected by appending an `ADJUSTMENT` line
(positive or negative) with a reason and an actor, or by issuing a credit note.
The original line stays. Refunds are already modelled this way in
`bookings.ts:685` — a `Payment` row with a negative `amount` — and that pattern
is the precedent.

---

## 3. What counts toward a bill

`bill()` returns this shape. Anything not listed is **not** billable.

| Component | Source | Included when |
|---|---|---|
| Room | `booking.totalAmount` | always — never `room.basePrice` |
| Packages | `BookingPackage.price` | always (respect `priceType` PER_STAY / PER_NIGHT) |
| Food | `FoodOrder` where `bookingId` set | `status ∈ {DELIVERED}` **and** `paymentStatus ≠ PAID` |
| Extras | `InvoiceExtra` | always (minibar, laundry, vehicle, damage, transfer, early/late) |
| Discount | `Invoice.discountAmt` | when set |
| Tax | `Tenant.taxRate` | applied to subtotal after discount |
| Payments | `Payment` where `bookingId` set, `status = PAID` | always; negatives are refunds |
| Deposit | `Booking.deposit` | shown separately, **not** a payment until applied |

### Room price — the single most important line

`booking.totalAmount` is the only number that survived rate-plan resolution,
staff override and discount. `room.basePrice × nights` is the price list, not
the price charged. Four code paths currently use the latter; all four change.

### Food order eligibility

`OrderStatus` is `PENDING | PREPARING | READY | DELIVERED | CANCELLED`.

- **Billable:** `DELIVERED` only. Food that has not reached the guest must
  never appear on their bill.
- **Never billable:** `CANCELLED`.
- **Blocks checkout:** `PENDING | PREPARING | READY` on a booking being checked
  out raises a warning — the desk must void or deliver them first. Silently
  dropping them loses real money; silently charging them bills for food nobody
  ate.
- `paymentStatus = PAID` means the guest already paid at the restaurant. It is
  excluded to avoid charging twice.

### Complimentary charges

A comped item is recorded at its real price with a `DISCOUNT` counter-line of
the same amount, not omitted. The resort must be able to report what it gave
away.

---

## 4. The three bill states

| State | What it is | Recomputed? | Who sees it |
|---|---|---|---|
| **Preview** | `bill()` called live | every read | front desk, check-out modal, guest portal |
| **Draft invoice** | `Invoice.status = DRAFT` | on read, via `bill()` | proforma for the guest, folio in progress |
| **Final invoice** | `Invoice.status ∈ {SENT, PAID, PARTIAL, OVERDUE}` after checkout | **never** | guest email, PDF, accounts, reports |

**Schema constraint to resolve:** `Invoice.bookingId` is `String? @unique` —
one invoice per booking. The draft is therefore *promoted*, not replaced: at
checkout the same row has its items rewritten from `bill()` and is then frozen.
If the product later needs both a proforma and a final document, the unique
constraint must be dropped in favour of `@@unique([bookingId, kind])`.

---

## 5. Money handling rules

- **Currency** is `Tenant.currency`, single-currency per tenant. No conversion.
- **Rounding:** compute in minor units where possible; round **once**, at the
  line-item total, half-up to 2dp. Never round the subtotal after summing
  already-rounded lines — that is how a bill ends up 1 taka off.
- **Tax** applies to `subtotal − discountAmt`, matching `recalcTotals()` in
  `invoices.ts:30`. Per-line tax is out of scope.
- **Price snapshot:** every line stores the price at the moment of the charge.
  Changing a menu item's price tomorrow must not alter a bill from yesterday.
  `BookingPackage` already snapshots `packageName` and `price`; `InvoiceItem`
  must do the same for food and transfers.
- **Two payment ledgers exist today** — `Payment` (booking) and
  `InvoicePayment` (invoice) — and `withBookingPaymentTruth()` in
  `invoices.ts:81` already patches over the disagreement at read time. The
  contract's position: **`Payment` on the booking is the source of truth**, and
  `InvoicePayment` is retained only for invoices with no booking (corporate,
  manual). The P0 plan carries the consolidation task.

---

## 6. Permissions

| Action | OWNER | MANAGER | RECEPTIONIST | STAFF/CHEF |
|---|---|---|---|---|
| View bill preview | ✓ | ✓ | ✓ | ✗ |
| Add charge (extra) | ✓ | ✓ | ✓ | ✗ |
| Apply discount / comp | ✓ | ✓ | ✗ (needs approval) | ✗ |
| Finalise at checkout | ✓ | ✓ | ✓ | ✗ |
| Post-finalisation adjustment | ✓ | ✓ | ✗ | ✗ |
| Refund | ✓ | ✗ | ✗ | ✗ |

`MANAGER` is documented in the schema as "everything except billing" — that
comment predates this contract and must be reconciled during P0 rather than
assumed either way.

---

## 7. Audit requirements

`AuditLog` exists but is **super-admin scoped** (`adminEmail`, `targetType ∈
{tenant, user, theme, settings}`). It is not usable for tenant staff actions.

A tenant-scoped trail is required:

```prisma
model BillingAudit {
  id        String   @id @default(cuid())
  tenantId  String
  bookingId String?
  invoiceId String?
  action    String   // FINALISE | ADJUST | DISCOUNT | COMP | WAIVE | REFUND | VOID
  amount    Float?
  reason    String?
  actorId   String   // User.id
  metadata  Json?
  createdAt DateTime @default(now())
  @@index([tenantId, bookingId])
}
```

Every discount, waiver, comp, adjustment and refund writes one row. Without it
there is no answer to "who gave this away".

---

## 8. Conformance checklist for a new charge source

Any future module that charges a guest must show:

- [ ] Charges land in `InvoiceExtra` (or a dedicated table) with `sourceType` +
      `sourceId`
- [ ] `bill()` is extended once; the module does not total anything itself
- [ ] Creation is idempotent under retry
- [ ] Cancelling the underlying thing removes or reverses the charge
- [ ] Post-checkout attempts are refused, not silently dropped
- [ ] Comp path records the real price plus a discount line
- [ ] Permissions and audit rows are defined
- [ ] Acceptance tests cover: normal, cancelled, comped, retried, post-checkout

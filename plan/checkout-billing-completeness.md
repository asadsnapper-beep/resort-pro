# ResortPro — Checkout & Billing Completeness (P0)

> One stay, four different totals. Money is collected against the smallest of
> them, the guest is emailed a fifth number, and the `Invoice` record is frozen
> in the state it had on the day the booking was made.

Status: ❌ Not built · **P0 — this loses money today.**
Implements: [billing-contract.md](./billing-contract.md)

---

## 1. Evidence

Verified against the local database, 30 Aug 2026:

- Booking `RP-P22V-2F0A441E` is `CHECKED_OUT` and `PAID`; its invoice
  `INV-PALMPA-2026-0001` is still `DRAFT`.
- Across both tenants, `InvoiceItem` rows with `category = FOOD`: **0**. Food
  has never reached an invoice.
- One demo booking charged **13,500** whose invoice prices the room at
  **9,000** — `room.basePrice × nights` instead of `booking.totalAmount`.

Root causes, all in code:

| Fault | Location |
|---|---|
| `autoCreateInvoice` runs at booking creation, never again (`if (existing) return`) | `bookings.ts:25,477,1300` |
| Room priced from `basePrice`, not `totalAmount` | `bookings.ts:25,942,1057`, `guest-emails.ts:267` |
| Food never added to `Invoice` | `bookings.ts:25` |
| Checkout summary omits extras and tax | `bookings.ts:605` |
| Front-desk modal omits food, extras, tax | `front-desk/page.tsx:131` |
| Second, incompatible invoice numbering (`INV-${confirmationNo}`) | `bookings.ts:1066`, `guest-emails.ts:276` |
| `POST /invoices/from-booking` duplicates `autoCreateInvoice` with the same three faults | `invoices.ts:347` |
| Two payment ledgers reconciled only at read time | `invoices.ts:81` |

---

## 2. Business rules

1. `bill(bookingId)` is the only producer of a payable total (contract R1).
2. Room charge is always `booking.totalAmount`.
3. Food is billable only when `status = DELIVERED` **and** `paymentStatus ≠ PAID`.
4. Undelivered food (`PENDING|PREPARING|READY`) blocks checkout with a warning
   listing the orders; the desk delivers or voids them first.
5. Checkout **finalises**: line items are rewritten from `bill()`, then frozen.
6. Finalisation is idempotent — running it twice changes nothing.
7. Email and PDF are dispatched only after the finalising transaction commits.
8. After finalisation, corrections are `ADJUSTMENT` lines, never edits (R5).
9. Deposits are shown separately and only become a payment when applied.
10. Corporate-billed bookings (`Booking.corporateAccountId`) settle to
    `CorporateInvoice`, not to the guest; the guest folio shows
    `Billed to <company>` and a zero balance due.

---

## 3. Data model changes

```prisma
model InvoiceItem {
  // + provenance (contract R2)
  sourceType String?   // ROOM | PACKAGE | FOOD_ORDER | EXTRA | TRANSFER | ADJUSTMENT
  sourceId   String?
  @@unique([invoiceId, sourceType, sourceId])   // partial: WHERE sourceType <> 'ADJUSTMENT'
}

model Invoice {
  // + finalisation
  finalizedAt DateTime?
  finalizedBy String?
}

enum InvoiceItemCategory {
  // + TRANSFER          (airport-transfers.md needs it)
}

model BillingAudit { … }   // see billing-contract.md §7
```

Migration must be additive only — all new columns nullable, no data rewritten.

---

## 4. API changes

### New

```
GET  /api/bookings/:id/bill        → live preview from bill(); replaces the
                                     three ad-hoc calculations
POST /api/bookings/:id/adjustment  → append an ADJUSTMENT line (OWNER/MANAGER)
```

### Changed

| Endpoint | Change |
|---|---|
| `PATCH /bookings/:id/check-out` | calls `bill()`, finalises the invoice in-transaction, then queues email/PDF |
| `GET /bookings/:id/invoice` | reads the `Invoice` row when final, `bill()` when draft |
| `POST /bookings/:id/invoice/send-email` | sends the finalised document; stops minting `INV-${confirmationNo}` |
| `POST /invoices/from-booking/:bookingId` | delegates to the same builder as `autoCreateInvoice` |
| `POST /bookings/:id/invoice/extras` | refuses when the invoice is final; directs to the adjustment endpoint |

### Transaction boundary

```
BEGIN
  SELECT booking FOR UPDATE                    -- serialise concurrent checkouts
  IF booking.status <> 'CHECKED_IN' → 409      -- idempotency guard
  totals = bill(bookingId)
  upsert invoice (bookingId unique)
  createMany(items, skipDuplicates)            -- R2 constraint absorbs retries
  invoice.status = PAID|PARTIAL, finalizedAt = now
  booking.status = CHECKED_OUT
  room.status = CLEANING; housekeeping task
COMMIT
→ then: email, PDF, loyalty points (each separately guarded)
```

The existing check-out handler already builds a `Promise.all(ops)` array
(`bookings.ts:552`) but is **not** in a transaction — a failure halfway leaves
the room dirty and the guest checked out. That is fixed here.

---

## 5. UI changes

**`front-desk/page.tsx` — CheckOutModal**

- Replace `balance = totalAmount − paidAmount` with `GET /bookings/:id/bill`.
- Render the breakdown: room / packages / food / extras / discount / tax /
  total / paid / balance due, with food and extras expandable to line level.
- Add `[+ Add charge]` (description + amount, free-form; quick presets for
  damage, extra bed, lost key).
- Warn on undelivered food orders, with a link to void them.

**`bookings/[id]/invoice/page.tsx`** — read from `bill()`; hide the "add extra"
control once finalised and offer "Add adjustment" instead.

**`dashboard/invoices`** — show `finalizedAt`; block item editing on final rows.

---

## 6. Permissions

Per [billing-contract.md](./billing-contract.md) §6. Specific to checkout:

- `RECEPTIONIST` may finalise and add charges, but not discount or adjust.
- A discount attempted by a receptionist raises an approval prompt naming who
  can grant it, rather than being hidden.

---

## 7. Edge cases and failure handling

| Case | Behaviour |
|---|---|
| Double-clicked checkout | second request sees `status ≠ CHECKED_IN` → 409, no second invoice, no second payment |
| Retry after network timeout | idempotent; `skipDuplicates` absorbs the item writes |
| Email send fails | checkout still succeeds; `invoiceSentAt` stays null; retryable from the invoice page |
| PDF generation fails | never blocks checkout; generated on demand |
| Food order delivered *after* checkout | refused; surfaced to the desk as an unbilled order needing an adjustment |
| Food order cancelled after finalisation | negative `ADJUSTMENT`, original line retained |
| Concurrent "record payment" during checkout | row lock serialises; balance recomputed inside the transaction |
| Booking cancelled after invoice exists | invoice → `CANCELLED`; existing refund path (`bookings.ts:685`) unchanged |
| `taxRate > 0` tenant | checkout total **rises** once tax is included — see rollout note below |
| Zero-night / same-day booking | `nights = max(1, …)`, consistent with existing helpers |

---

## 8. Migration and backfill

1. **Additive migration** — new nullable columns, new enum value, new table.
2. **Backfill provenance** for existing invoice items where it can be inferred
   (room line → `sourceId = bookingId`); leave the rest null.
3. **Existing DRAFT invoices** (8 on palm-paradise, 3 on demo): a one-off script
   marks invoices whose booking is already `CHECKED_OUT` as `finalizedAt =
   booking.actualCheckOut`, and leaves their **totals untouched**. Historical
   bills must not change retroactively.
4. **Do not** recompute any settled booking. New behaviour applies only to
   checkouts from the release forward.

---

## 9. Tests

### Automated (`apps/api/tests/integration/checkout-billing.test.ts`)

| # | Scenario | Expected |
|---|---|---|
| 1 | Rate-planned room 13,500 (base 9,000), no extras | bill.roomTotal = 13,500 |
| 2 | + delivered food 1,200 | grandTotal 14,700 |
| 3 | + minibar extra 500 | grandTotal 15,200 |
| 4 | + `taxRate = 10` | tax 1,520, total 16,720 |
| 5 | Food order `PREPARING` at checkout | checkout warns, order excluded |
| 6 | Food order `CANCELLED` | excluded |
| 7 | Food order already `paymentStatus = PAID` | excluded (no double charge) |
| 8 | Checkout called twice | one invoice, one payment, second returns 409 |
| 9 | Item write retried | no duplicate line (unique constraint) |
| 10 | Email throws | checkout still 200; invoice final |
| 11 | Add extra after finalisation | 409 with pointer to adjustment endpoint |
| 12 | Adjustment −500 after finalisation | original line intact, total reduced, audit row written |
| 13 | Partial payment 10,000 of 15,200 | status PARTIAL, balance 5,200 |
| 14 | Refund via cancel | negative Payment, no invoice item edited |
| 15 | Corporate-billed booking | guest balance 0, charge on CorporateInvoice |
| 16 | Front desk, check-out API, invoice page, guest email | **all four report the identical grandTotal** |

Test 16 is the acceptance criterion for the whole plan.

### Manual QA

- [ ] Walk-in → order food → minibar charge → checkout; every screen agrees
- [ ] Checkout with the button double-clicked
- [ ] Checkout with `RESEND_API_KEY` unset (email disabled)
- [ ] Tenant with `taxRate = 0` and `taxRate = 15`
- [ ] Receptionist attempts a discount → approval prompt
- [ ] PDF matches the on-screen bill exactly

---

## 10. Rollout

- Feature flag `billing_v2` via the existing `TenantFeatureFlag` table; default
  off, enabled per tenant.
- **Warn owners before enabling on a `taxRate > 0` tenant** — the amount
  collected at checkout will rise, because tax was previously omitted there.
  This is a correction, not a bug, but it must not be a surprise.
- Rollback: disable the flag; old code paths remain until the flag is retired.

---

## 11. Files to change

```
apps/api/src/services/billing.ts                    (new — bill())
apps/api/src/routes/bookings.ts                     (check-out, invoice, extras, autoCreateInvoice)
apps/api/src/routes/invoices.ts                     (from-booking, syncTotals, withBookingPaymentTruth)
apps/api/src/utils/guest-emails.ts                  (sendCheckoutEmail reads bill())
apps/web/src/app/(dashboard)/dashboard/front-desk/page.tsx
apps/web/src/app/(dashboard)/dashboard/bookings/[id]/invoice/page.tsx
apps/web/src/app/(dashboard)/dashboard/invoices/page.tsx
packages/database/prisma/schema.prisma + migration
```

---

## 12. Out of scope

Security deposits held and returned · per-line tax rates · multi-currency ·
split billing between guests · damage photo evidence · guest signature capture.

---

## 13. Dependencies

None — this is the base. [restaurant-room-billing.md](./restaurant-room-billing.md),
[early-checkin-late-checkout.md](./early-checkin-late-checkout.md) and
[airport-transfers.md](./airport-transfers.md) Phase B all depend on it.

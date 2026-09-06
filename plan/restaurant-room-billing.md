# ResortPro — Restaurant Charges to the Room (P1)

> Walk-in restaurant customers are handled correctly today. Guests staying at
> the resort are not: they order, assume it goes on the room, and it never does.

Status: 🟡 Phase 1 built · **P1** · Implements [billing-contract.md](./billing-contract.md)

Built: the settlement model (§2, `PAY_NOW` and `CHARGE_TO_ROOM` only), the
server-side validation (§3), provenance and the one-line-per-order rule (§4),
cancellation after finalisation (§5), the order form and in-house picker (§6),
and idempotency (§8).

Not built: `COMPLIMENTARY` and `CORPORATE`, which the API refuses; QR
room-charging (§7), still `PAY_NOW` only; and the restaurant reporting
breakdown (§9).
Depends on: [checkout-billing-completeness.md](./checkout-billing-completeness.md)

---

## 1. Current state

The backend is already shaped for this and the intent is written down:

```
FoodOrder.bookingId  String?     ← exists
FoodOrder.guestId    String?     ← exists
bookings.ts:598      foodOrder.aggregate({ where: { bookingId: id } })
```

> *"A room-service order (bookingId set) rides on the booking's own
> invoice/payment at checkout"* — `foodOrders.ts:83`

**The wire was never connected.** `orders/page.tsx:138` sends `guestId` and a
free-text `tableNumber` whose placeholder is literally `"Table 4, Room 201…"`,
and never sends `bookingId`. Checkout queries by `bookingId` and finds nothing.

Three consequences:

1. In-house food never reaches the bill.
2. The room number is a **label, not a link** — a typo or a room move is
   invisible.
3. The guest dropdown lists every guest ever (`guestsApi.list({ limit: 100 })`),
   not who is in-house now — the only question the order-taker is asking.

`orders/page.tsx:275` already reads `needsPaymentAction = !order.bookingId && …`
— the "charge to room" concept exists in the UI and can never fire.

---

## 2. Settlement model

Every food order settles exactly one way, chosen explicitly at order time:

| Settlement | `bookingId` | `paymentStatus` | Reaches `bill()` |
|---|---|---|---|
| `PAY_NOW` | null | `PAID` on collection | no |
| `CHARGE_TO_ROOM` | set | `PENDING` until checkout | yes |
| `COMPLIMENTARY` | set | `PAID` (zero) | as price + offsetting discount line |
| `CORPORATE` | set | `PENDING` | via `CorporateInvoice`, not the guest folio |

```prisma
model FoodOrder {
  settlement  FoodSettlement @default(PAY_NOW)
  compReason  String?
  compBy      String?
}
enum FoodSettlement { PAY_NOW CHARGE_TO_ROOM COMPLIMENTARY CORPORATE }
```

`settlement` is stored rather than inferred from `bookingId` being non-null,
so a comped order and a room-charged order remain distinguishable in reporting.

---

## 3. Server-side validation — the frontend is not trusted

`POST /api/food-orders` with `settlement = CHARGE_TO_ROOM` must verify, on the
server, inside the same transaction that creates the order:

1. `bookingId` exists **and** belongs to the caller's tenant.
2. `booking.status = 'CHECKED_IN'`. Not `CONFIRMED` (not arrived), not
   `CHECKED_OUT` (already settled).
3. If `guestId` is supplied it matches `booking.guestId`.
4. The room derives from the booking; a client-supplied room is ignored.
5. The tenant's invoice for that booking is not already finalised.

Failure returns `400` naming the reason. A client that sends a stale
`bookingId` must never succeed.

**Order eligibility for billing** is separate from creation and is governed by
the contract: only `status = DELIVERED` and `paymentStatus ≠ PAID` enter
`bill()`.

---

## 4. Provenance and double-billing

Each billed food order produces exactly one invoice line:

```
sourceType = 'FOOD_ORDER'
sourceId   = foodOrder.id
```

The `@@unique([invoiceId, sourceType, sourceId])` constraint from the contract
makes it impossible to bill the same order twice, whatever the retry path.

Unit price is **snapshotted** onto the invoice line at finalisation.
`FoodOrderItem.unitPrice` is already snapshotted at order time
(`foodOrders.ts:98`) — that value is carried forward, so a later menu price
change cannot alter a settled bill.

---

## 5. Cancellation, void and refund

| When | Action |
|---|---|
| Before checkout | set `CANCELLED`; it drops out of `bill()` automatically |
| After finalisation | negative `ADJUSTMENT` line on the invoice + `BillingAudit` row; the food line stays |
| Already `PAY_NOW` paid | refund through the payment path, not through the bill |

Cancelling an order that is already `DELIVERED` requires MANAGER and a reason.

---

## 6. UI — taking the order

`orders/page.tsx`, New F&B Order:

```
Who is this order for?
  ( ) Restaurant guest — collect payment now      ← default
  ( ) Staying with us — charge to the room
  ( ) Complimentary                                (MANAGER+)

  [ Room 201 ▾ ]   ← searchable: room number, guest name, or confirmation no.
    → Room 201 · Karim Hossain · until 30 Aug
```

- **Search by room number first.** Waiters know the room; they do not know the
  spelling of the guest's name.
- The picker is backed by a new endpoint returning **only `CHECKED_IN`
  bookings**, not the full guest list.
- `PAY_NOW` stays the default. Putting one guest's food on another guest's bill
  is worse than the duplicate it would save.
- On selection the client sends `bookingId`; the server re-validates (§3).

`orders` list and detail show room, guest and settlement; `needsPaymentAction`
becomes truthful and stops nagging for room-charged orders.

---

## 7. QR table ordering — security

`(public)/[slug]/table/[tableNumber]/TableOrderingApp.tsx` is unauthenticated
and currently always "pay on delivery". Allowing it to charge a room needs:

- **A signed, expiring token bound to the stay.** Issued at check-in
  (`HMAC(bookingId, exp)`, reusing the pattern in
  `utils/signed-upload-url.ts`), delivered as a QR code or link in the room —
  never derived from the room number alone.
- **No guest data exposure.** The endpoint returns "Room 201 · K. H." at most.
  Never the full name, email, phone, or stay dates. Knowing a room number must
  not reveal who is in it.
- **Rate limiting** per token and per IP on both lookup and order creation.
- **Verification fallback** when no token is present: room number **plus** the
  guest's surname, checked server-side, with attempt throttling.
- Tokens are invalidated at checkout.

Without the token mechanism, QR ordering stays `PAY_NOW` only. That is an
acceptable Phase 1.

---

## 8. Offline and retry

Restaurant floors lose connectivity. The client:

- Assigns a client-side `idempotencyKey` (uuid) per order and replays it on
  retry; the server upserts on `(tenantId, idempotencyKey)`.
- Queues unsent orders locally and shows them as "not yet sent" — never as
  confirmed.
- Never assumes success from a timeout.

```prisma
model FoodOrder {
  idempotencyKey String?
  @@unique([tenantId, idempotencyKey])
}
```

---

## 9. Reporting

`/dashboard/reports` gains a restaurant breakdown:

- Total F&B revenue
- Split by settlement: paid now / charged to room / complimentary / corporate
- Complimentary total with who authorised it (from `BillingAudit`)
- Room-charged food still unsettled (guests currently in house)

---

## 10. Tests

### Automated (`apps/api/tests/integration/restaurant-room-billing.test.ts`)

| # | Scenario | Expected |
|---|---|---|
| 1 | `CHARGE_TO_ROOM` on a `CHECKED_IN` booking | 201, `bookingId` persisted |
| 2 | …on a `CONFIRMED` (not arrived) booking | 400 |
| 3 | …on a `CHECKED_OUT` booking | 400 |
| 4 | …with another tenant's `bookingId` | 400/404, no leak |
| 5 | …with `guestId` not matching the booking | 400 |
| 6 | Order `DELIVERED` → checkout | appears on the bill once |
| 7 | Order `PREPARING` at checkout | excluded, checkout warns |
| 8 | Order `CANCELLED` | excluded |
| 9 | `PAY_NOW` order marked paid | excluded from the room bill |
| 10 | Same order finalised twice | one invoice line (unique constraint) |
| 11 | `COMPLIMENTARY` | price line + equal discount line; guest pays 0 |
| 12 | Order cancelled after finalisation | negative adjustment, original line kept |
| 13 | Duplicate `idempotencyKey` | one order created |
| 14 | QR order without a valid token | 401; no guest data in the response body |
| 15 | QR lookup brute-forced | rate-limited after N attempts |

### Manual QA

- [ ] Waiter orders for Room 201; total appears in the check-out modal
- [ ] Room-charged order shows no "collect payment" prompt
- [ ] Search finds the stay by room number, by guest name, and by confirmation no.
- [ ] Restaurant walk-in flow is unchanged
- [ ] Aeroplane-mode order queues and replays exactly once

---

## 11. Rollout

Flag `restaurant_room_billing`. Phase 1 = staff-taken orders only; QR
room-charging ships only after the token mechanism (§7). Rollback disables the
settlement selector and reverts to `PAY_NOW`.

---

## 12. Files to change

```
apps/api/src/routes/foodOrders.ts            (settlement, validation, idempotency)
apps/api/src/routes/bookings.ts              (in-house booking lookup endpoint)
apps/api/src/services/billing.ts             (food eligibility — shared)
apps/web/src/app/(dashboard)/dashboard/orders/page.tsx
apps/web/src/app/(public)/[slug]/table/[tableNumber]/TableOrderingApp.tsx
packages/database/prisma/schema.prisma + migration
```

---

## 13. Out of scope

Splitting a bill between guests · tips and service charge · kitchen printers /
KOT · per-item course timing · guest signature on room charges.

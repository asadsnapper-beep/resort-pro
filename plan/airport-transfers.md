# ResortPro — Airport / Station Transfers

> Every other billing module fails by losing money. This one fails by leaving a
> guest alone at an airport at 2am. Operations ship first; billing follows.

Status: ❌ Not built · **Phase A = P2 (operational), Phase B = P3 (billing)**
Phase B implements [billing-contract.md](./billing-contract.md).
**Phase A must not be blocked by billing work.**

---

## 1. This is not the vehicle rental module

`vehicle-rental.md` is ✅ Built, and it is self-drive: `VehicleRental` carries
`odometerOut/In`, `fuelOut/In`, `depositCollected/Returned`,
`conditionNotesOut/In`.

| | Vehicle rental (built) | Transfer (this plan) |
|---|---|---|
| Driver | the guest | resort or hired driver |
| Duration | hours / days | one trip |
| Pricing | `hourlyRate` / `dailyRate` | fixed per route + vehicle class |
| Defining data | odometer, fuel, deposit | flight number, arrival time, pickup point |
| Failure mode | vehicle damage | **guest stranded** |

Reusing `VehicleRental` would hang meaningless fields on every pickup and mark
the car as rented out. The **`Vehicle` fleet is shared**, which is why §6
requires conflict detection across both modules.

---

# Phase A — Operational MVP (P2)

## 2. Data model

```prisma
model Transfer {
  id             String   @id @default(cuid())
  tenantId       String
  bookingId      String?
  guestId        String?
  guestName      String
  guestPhone     String?

  direction      TransferDirection      // ARRIVAL | DEPARTURE
  pickupPoint    String
  dropPoint      String
  scheduledAt    DateTime               // when the vehicle must be there
  expectedEndAt  DateTime?              // for fleet conflict windows
  flightNumber   String?
  arrivalTime    DateTime?              // the guest's own arrival — moves independently
  passengers     Int      @default(1)
  luggageNotes   String?

  vehicleId      String?
  driverId       String?                // User.id when staff
  driverName     String?                // hired driver — no staff record
  driverPhone    String?

  status         TransferStatus @default(REQUESTED)
  cancelReason   String?
  internalNotes  String?

  // Phase B
  quotedPrice    Float?
  priceSnapshot  Json?
  isComplimentary Boolean @default(false)
  billingStatus  TransferBillingStatus @default(NOT_BILLABLE)
  invoiceExtraId String?
  paymentId      String?
  collectedByDriver Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([tenantId, scheduledAt])
  @@index([vehicleId, scheduledAt])
}

enum TransferDirection { ARRIVAL DEPARTURE }
enum TransferStatus {
  REQUESTED CONFIRMED DRIVER_ASSIGNED EN_ROUTE
  ARRIVED_AT_PICKUP COMPLETED NO_SHOW CANCELLED
}
enum TransferBillingStatus { NOT_BILLABLE PENDING BILLED COLLECTED_BY_DRIVER WAIVED }

model TransferEvent {          // append-only audit
  id         String   @id @default(cuid())
  transferId String
  fromStatus String?
  toStatus   String
  actorId    String?
  note       String?
  createdAt  DateTime @default(now())
}
```

**`arrivalTime` and `scheduledAt` must stay separate.** Flights are late; the
guest's arrival moves and the vehicle's departure moves with it, but by a
different amount. One field cannot express a delay.

**`billingStatus` replaces a `billed: boolean`.** `VehicleRental.billed` is a
boolean today and cannot express "the driver took the cash" or "we comped it" —
this plan deliberately does not repeat that.

**Driver:** `StaffDepartment` has no `TRANSPORT` value (`FRONT_DESK,
HOUSEKEEPING, RESTAURANT, MAINTENANCE, SECURITY, MANAGEMENT`) — one must be
added. Small resorts mostly use hired drivers with no staff record at all,
hence `driverName` / `driverPhone`.

## 3. Status transitions

| From | To | Actor | Sets |
|---|---|---|---|
| — | `REQUESTED` | receptionist, guest (booking form) | `createdAt` |
| `REQUESTED` | `CONFIRMED` | receptionist, manager | — |
| `CONFIRMED` | `DRIVER_ASSIGNED` | receptionist, manager | `driverId`/`driverName`, `vehicleId` |
| `DRIVER_ASSIGNED` | `EN_ROUTE` | receptionist, driver-facing link | departure time |
| `EN_ROUTE` | `ARRIVED_AT_PICKUP` | receptionist | — |
| `ARRIVED_AT_PICKUP` | `COMPLETED` | receptionist | completion time |
| any pre-`COMPLETED` | `CANCELLED` | receptionist, manager | `cancelReason` |
| `ARRIVED_AT_PICKUP` | `NO_SHOW` | receptionist, manager | `cancelReason` |

Every transition writes a `TransferEvent`. `COMPLETED` and `CANCELLED` are
terminal; reopening requires MANAGER and writes an event.

## 4. Operational board — the point of Phase A

`/dashboard/front-desk`, alongside today's arrivals:

```
Today's transfers                                   Asia/Dhaka
 14:30  ⬅ BG-435   Karim Hossain (2)   Sedan · Rafiq    EN ROUTE
 17:00  ➡ Drop     Nadia Chowdhury     ⚠️ no vehicle assigned
 21:45  ⬅ BG-147   Tom Weller (1)      ⚠️ scheduled 40m ago, not started
```

Two alert classes, both surfaced without anyone going looking:

- **Unassigned** — `scheduledAt` within N hours and no vehicle or driver.
- **Late** — `scheduledAt` passed and status still below `EN_ROUTE`.

This board is the feature. Everything else supports it.

## 5. Guest confirmation — highest-value output

Sent once the driver is assigned, before the guest lands:

```
Your car is arranged
  Driver  Rafiq Uddin · 01712-345678
  Vehicle White Toyota Axio · DHA-GA-12-3456
  Where   Outside Gate 2, arrivals
```

A guest holding the driver's number does not need the front desk at all.

- Delivery: email now; SMS/WhatsApp when a provider exists.
- **Retry:** on failure, retry with backoff; after final failure raise a desk
  alert — a silent send failure is the exact scenario this feature exists to
  prevent.
- **Consent/privacy:** driver contact goes only to the guest on that booking.
  The driver's sheet carries the guest's name and phone and nothing else — no
  email, no room number, no stay dates, no payment information.

## 6. Vehicle conflict detection

Before assigning a vehicle, check overlaps in `[scheduledAt, expectedEndAt +
buffer]` against:

1. other `Transfer` rows on that vehicle not in `CANCELLED | NO_SHOW`, **and**
2. `VehicleRental` rows on that vehicle in `RESERVED | OUT`
   (`startAt`/`endAt`) — the two modules share `Vehicle`.

`expectedEndAt` defaults to `scheduledAt + route.durationMinutes`. Buffer is a
tenant setting, default 30 minutes. A conflict is a hard block for staff and
overridable by MANAGER with a reason.

## 7. Phase A permissions

| Action | OWNER | MANAGER | RECEPTIONIST |
|---|---|---|---|
| Create / edit transfer | ✓ | ✓ | ✓ |
| Assign driver + vehicle | ✓ | ✓ | ✓ |
| Override a vehicle conflict | ✓ | ✓ | ✗ |
| Cancel / mark no-show | ✓ | ✓ | ✓ (reason required) |
| Reopen a terminal transfer | ✓ | ✓ | ✗ |

## 8. Phase A tests

| # | Scenario | Expected |
|---|---|---|
| 1 | Create arrival transfer with flight + time | `REQUESTED`, appears on today's board |
| 2 | Assign vehicle already on another transfer in-window | conflict, blocked |
| 3 | Assign vehicle with an overlapping `VehicleRental` | conflict, blocked |
| 4 | Manager overrides a conflict | allowed, reason + event recorded |
| 5 | `scheduledAt` passes, status `CONFIRMED` | flagged late on the board |
| 6 | Transfer with no vehicle 2h out | flagged unassigned |
| 7 | Flight delayed; `arrivalTime` updated | `scheduledAt` independently editable, event written |
| 8 | Driver assigned | guest confirmation queued |
| 9 | Confirmation send fails twice | desk alert raised |
| 10 | Guest no-show | `NO_SHOW`, reason required, no auto-charge |
| 11 | Tenant in `Asia/Dhaka` | board groups by tenant-local day (`tenantToday()`) |
| 12 | Hired driver, no staff record | `driverName`/`driverPhone` accepted |
| 13 | Driver sheet payload | contains no email, room number or stay dates |

---

# Phase B — Billing integration (P3)

## 9. Pricing

```prisma
model TransferRoute {
  id              String @id @default(cuid())
  tenantId        String
  name            String        // "Cox's Bazar Airport → Resort"
  vehicleClass    String        // SEDAN | MICROBUS | …
  price           Float
  durationMinutes Int    @default(60)
  nightSurcharge  Float  @default(0)
  nightFrom       String @default("22:00")
  nightTo         String @default("06:00")
  isActive        Boolean @default(true)
}
```

`priceSnapshot` on the transfer stores the route, class and amounts used, so a
later price change cannot alter a settled bill (contract §5).

## 10. Charge creation

```
InvoiceExtra: "Airport transfer — Cox's Bazar Airport (BG-435)"
sourceType = 'TRANSFER'
sourceId   = transfer.id          ← idempotent; one charge per transfer
category   = TRANSFER              ← new InvoiceItemCategory value
```

Charged only on `COMPLETED`. Never on `REQUESTED`, `CANCELLED` or `NO_SHOW`.
No-show charging, if a resort wants it, is a manual extra with a reason — never
automatic.

| Case | `billingStatus` | Effect on the bill |
|---|---|---|
| Normal, charge to room | `PENDING` → `BILLED` | one extra line |
| Complimentary | `WAIVED` | price line + equal discount line |
| Driver collected cash | `COLLECTED_BY_DRIVER` | not on the folio; recorded as a `Payment` outside the stay |
| Booking-less transfer | `NOT_BILLABLE` | invoiced separately or free |

`isComplimentary` is first-class: a free airport pickup is a selling point, and
the resort still needs to report what it gave away.

## 11. Phase B tests

| # | Scenario | Expected |
|---|---|---|
| 1 | `COMPLETED` transfer, charge to room | one `InvoiceExtra`, appears once on the bill |
| 2 | Same transfer completed twice (retry) | one line only |
| 3 | `CANCELLED` transfer | no charge |
| 4 | `NO_SHOW` | no automatic charge |
| 5 | Complimentary | guest pays 0; comp reported |
| 6 | Driver-collected cash | not on the folio; payment recorded |
| 7 | Night surcharge window | surcharge applied and shown in `priceSnapshot` |
| 8 | Route price changed after completion | settled bill unchanged |
| 9 | Transfer completed after checkout | refused; requires an adjustment |
| 10 | Transfer with no booking | no folio impact |

---

## 12. Manual QA

- [ ] Today's board shows unassigned and late transfers without filtering
- [ ] Guest confirmation contains driver name, phone and vehicle registration
- [ ] Driver sheet is shareable and leaks no guest data beyond name and phone
- [ ] Assigning a car that is out on rental is blocked
- [ ] A complimentary transfer still appears in reports

## 13. Rollout

Flag `transfers`. Phase A ships alone and is useful alone. Phase B ships only
after [checkout-billing-completeness.md](./checkout-billing-completeness.md);
until then transfers are recorded with `billingStatus = NOT_BILLABLE` and
charged manually as an `InvoiceExtra` if needed.

## 14. Files to change

```
apps/api/src/routes/transfers.ts              (new)
apps/api/src/services/transfer-conflicts.ts   (new — shared with vehicles)
apps/api/src/services/billing.ts              (Phase B: consume the extra)
apps/api/src/utils/guest-emails.ts            (confirmation template)
apps/web/src/app/(dashboard)/dashboard/transfers/page.tsx      (new)
apps/web/src/app/(dashboard)/dashboard/front-desk/page.tsx     (today's board)
apps/web/src/components/bookings/NewBookingModal.tsx           (request at booking)
packages/database/prisma/schema.prisma + migration
```

## 15. Out of scope

Live flight-tracking APIs · GPS vehicle tracking · a driver mobile app ·
Uber/Pathao integration · multi-stop itineraries.

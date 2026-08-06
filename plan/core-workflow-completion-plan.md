# ResortPro Core Workflow Completion Plan

**Status:** Proposed implementation plan  
**Created:** 2026-08-06  
**Primary users:** Resort owner, manager, receptionist, operations staff, finance staff, guest  
**Purpose:** Existing modulesকে feature-presence থেকে reliable end-to-end workflow-এ নেওয়া।

## 1. কেন এই plan দরকার

ResortPro-তে booking, payment, rate plan, group booking, restaurant, marketing, reports, staff, loyalty এবং operations-এর জন্য অনেক module ইতিমধ্যে আছে। কিন্তু কয়েকটি জায়গায় UI, API, database state, background job এবং accounting একে অপরের সঙ্গে সম্পূর্ণভাবে যুক্ত নয়। এর ফলে owner feature দেখতে পেলেও বাস্তব কাজ শেষ করতে পারেন না, অথবা একই transaction ভিন্ন screen-এ ভিন্ন ফল দেখায়।

এই plan-এর লক্ষ্য:

- Resort owner-এর সবচেয়ে গুরুত্বপূর্ণ daily workflowগুলো complete ও predictable করা।
- Booking, room, payment, invoice এবং housekeeping state-এর জন্য একক business rule তৈরি করা।
- Public website ও dashboard যেন একই availability এবং pricing rule ব্যবহার করে।
- Documentation ও marketing claim যেন shipped capability-এর সঙ্গে মেলে।
- Production release-এর আগে build, tests, observability এবং migration discipline ঠিক করা।

## 2. Guiding principles

1. **একটি rule, একটি service:** Booking price, availability, invoice balance বা room transition একাধিক route-এ আলাদা করে calculate করা যাবে না।
2. **Financial mutation atomic হবে:** Payment, refund, cancellation fee, invoice balance এবং booking paid amount একই database transaction-এ update হবে।
3. **Historical data immutable থাকবে:** Rate plan বা room price বদলালেও পুরনো booking-এর price snapshot বদলাবে না।
4. **UI action-এর backend equivalent থাকতে হবে:** Documentation-এ কোনো action থাকলে dashboard/API-তেও তা থাকতে হবে।
5. **Owner-safe defaults:** Destructive action confirmation, clear balance, refund preview এবং error recovery থাকবে।
6. **Tenant isolation ও entitlement:** প্রত্যেক query tenant-scoped থাকবে এবং paid feature server-side flag দিয়ে protected থাকবে।
7. **Idempotent background jobs:** একই job retry বা একাধিক worker থেকে চললেও duplicate email, payment, refund বা report হবে না।
8. **Auditability:** Financial এবং lifecycle action-এ actor, timestamp, reason এবং before/after state সংরক্ষণ করতে হবে।
9. **Design system:** নতুন modal-এ `ModalShell`, dashboard page-এ tokens/patterns এবং existing design-system ratchet অনুসরণ করতে হবে।

## 3. Delivery order and dependencies

```text
Phase 0 — Build/test baseline
    ↓
Shared foundations — Availability + Pricing + Booking lifecycle + Billing ledger
    ↓
1 Booking modify ── 2 Cancellation/refund ── 3 Rate plans ── 4 Public availability
                                  ↓
                         5 Invoice/payment core
                                  ↓
               6 Group booking + 7 Restaurant/inventory
                                  ↓
       8 Marketing + 9 Reports + 10 Payroll + 11 Loyalty
                                  ↓
             12 Housekeeping consistency + 13 Advanced modules
```

Parallel কাজ কেবল তখনই নিরাপদ যখন shared contract আগে স্থির হয়েছে। বিশেষ করে ১–৭ নম্বর কাজ একই booking/billing foundation-এর উপর নির্ভরশীল।

## 4. Phase 0 — Release baseline ও safety net

Feature implementation শুরুর আগে current branch-কে measurable baseline-এ আনতে হবে। Audit snapshot-এ API TypeScript error, web TypeScript error, stale role tests এবং misconfigured web test command পাওয়া গেছে।

### কাজ

- Prisma schema-এর required `tenantId` পরিবর্তনের সঙ্গে tenant-scoped client typing reconcile করা।
- API type-check-এর সব error fix করা; `as any` বা broad `as never` দিয়ে error লুকানো যাবে না।
- Web TypeScript error fix করা।
- Vitest যেন Playwright `tests/e2e/*.spec.ts` collect না করে সেই configuration ঠিক করা।
- Role tests-এ appropriate plan entitlement fixture যোগ করা; role failure এবং plan failure আলাদা assertion হবে।
- Fire-and-forget invoice/email task test teardown-এর পরে deleted record access করছে কি না ঠিক করা।
- CI-তে minimum gates:
  - database generate/migration validation
  - API type-check
  - web type-check
  - API unit/integration tests
  - web unit tests
  - selected Playwright smoke tests
  - design-system ratchet

### Done when

- [ ] API এবং web type-check zero error।
- [ ] Existing tests green; expected entitlement 403 explicit test হিসেবে থাকে।
- [ ] Web unit test এবং Playwright E2E আলাদা command-এ চলে।
- [ ] CI ছাড়া merge করা যায় না।
- [ ] Test logs-এ unhandled Prisma/background-job error নেই।

---

## 5. Shared domain foundations

১৩টি initiative আলাদা route patch হিসেবে implement করলে inconsistency থাকবে। আগে নিচের shared services তৈরি করতে হবে।

### 5.1 Availability service

Suggested module: `apps/api/src/services/availability.ts`

Responsibilities:

- Room conflict query-এর একক definition।
- Blocking statuses এবং expired `PENDING` policy।
- Internal, public, walk-in, group booking এবং room-move—সব caller-এর জন্য একই API।
- External iCal block merge করা।
- Serializable transaction-এর মধ্যে re-check করার helper।

Suggested contract:

```ts
checkRoomAvailability({
  tenantId,
  roomId,
  checkIn,
  checkOut,
  excludeBookingId,
  tx,
}): Promise<AvailabilityResult>
```

### 5.2 Pricing service

Suggested module: `apps/api/src/services/booking-pricing.ts`

Responsibilities:

- Night-by-night rate resolution।
- Base rate, rate plan, package, promo, manual discount, tax এবং fee breakdown।
- Quote expiry/version।
- Booking-এর মধ্যে immutable pricing snapshot তৈরি।
- Modify/cancel preview calculation।

### 5.3 Booking lifecycle service

Suggested module: `apps/api/src/services/booking-lifecycle.ts`

Responsibilities:

- Allowed status transitions।
- Check-in, checkout, cancel, no-show, room move, group bulk action।
- Room status এবং housekeeping side-effect।
- Audit event এবং guest notification enqueue।
- Single booking ও group booking-এর একই rule reuse।

### 5.4 Billing ledger/service

Suggested modules:

- `apps/api/src/services/billing.ts`
- `apps/api/src/services/refunds.ts`

Responsibilities:

- Charge, payment, refund, discount, fee এবং credit আলাদা immutable entry হিসেবে রাখা।
- Invoice projection/summary তৈরি।
- Gateway transaction reference সংরক্ষণ।
- Idempotency key এবং retry safety।
- Booking `paidAmount`/`paymentStatus` derived বা transactionally synchronized রাখা।

### 5.5 Outbox/job service

Email, WhatsApp, SMS, report এবং automation সরাসরি request-এর ভেতর fire-and-forget না করে persistent outbox/job table-এ enqueue করতে হবে। Worker retry, deduplication এবং delivery status পরিচালনা করবে।

---

# Initiative 1 — Booking Modify / Reschedule

## Problem

Confirmed booking-এর dates, room, guest count, rate বা request dashboard থেকে পরিবর্তনের complete workflow নেই। Documentation-এ `Edit Booking` claim থাকলেও UI/API তা support করে না।

## Goal

Owner/manager/receptionist যেন safely booking পরিবর্তন করতে পারেন, আগে impact preview দেখেন এবং conflict বা price change বুঝে confirm করেন।

## Scope

### P0 fields

- Check-in/check-out date
- Room
- Adults/children
- Special requests
- Selected rate plan বা manual rate override, permission অনুযায়ী
- Modification reason
- Guest notification toggle

### Status policy

- `PENDING` ও `CONFIRMED`: full modification।
- `CHECKED_IN`: manager/owner-only room move বা checkout extension; past check-in পরিবর্তন নয়।
- `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`: immutable। Correction প্রয়োজন হলে audited adjustment workflow।

## Data changes

- `BookingModification` audit model অথবা generic lifecycle event:
  - bookingId, tenantId, actorId
  - reason
  - beforeSnapshot, afterSnapshot
  - priceDifference
  - createdAt
- Booking-এ pricing snapshot/version নিশ্চিত করা।
- Optional `modifiedAt`, `modifiedBy` denormalized fields।

## API

- `POST /api/bookings/:id/modification-preview`
  - availability, new pricing, balance/refund impact, warnings ফেরত দেবে।
- `PATCH /api/bookings/:id`
  - preview/version token বা expected `updatedAt` নেবে।
  - serializable transaction-এর মধ্যে availability re-check করবে।
  - booking, invoice projection এবং audit event atomically update করবে।
- Stale preview হলে `409 BOOKING_CHANGED`। Room conflict হলে `409 ROOM_UNAVAILABLE`।

## UI

- Booking detail sheet-এ `Edit Booking` action।
- `ModalShell`-ভিত্তিক edit modal, current values prefilled।
- Step 1: dates/room/guest details।
- Step 2: price and balance preview—old total, new total, difference, amount due/credit।
- Step 3: reason, guest notification, confirm।
- Checked-in room move হলে old/new room এবং housekeeping impact স্পষ্ট দেখাতে হবে।

## Edge cases

- Same room/date রেখে অন্য field edit করলে false conflict হবে না (`excludeBookingId`)।
- Stay shorten করলে already-paid amount বেশি হয়ে গেলে automatic refund নয়; credit/refund decision চাইবে।
- Stay extend করলে extra balance due দেখাবে।
- Room move করলে old room cleaning/inspection policy এবং new room status এক transaction-এ চলবে।
- Concurrent edit optimistic locking দিয়ে আটকাতে হবে।

## Acceptance criteria

- [ ] Confirmed booking-এর dates ও room conflict-free অবস্থায় পরিবর্তন করা যায়।
- [ ] Conflicting room/date save হয় না এবং alternative available rooms দেখা যায়।
- [ ] Total এবং invoice balance সঠিকভাবে update হয়।
- [ ] Modification history actor ও reasonসহ দেখা যায়।
- [ ] Checked-in room move শুধু authorized role করতে পারে।
- [ ] Guest notification opt-in করলে একবারই যায়।

---

# Initiative 2 — Complete Cancellation and Refund

## Current state

Current working tree-তে backend cancellation body-তে reason, fee এবং manual refund record-এর কাজ আছে, কিন্তু dashboard API/UI body পাঠায় না। Gateway refund call নেই এবং booking/refund writes atomic transaction-এ নেই। এই code committed/migrated হয়েছে ধরে implementation শুরু করা যাবে না; branch ও migration state আগে verify করতে হবে।

## Goal

Owner যেন cancellation policy অনুযায়ী fee/credit/refund ঠিক করতে পারেন এবং manual বা online payment-এর টাকা traceableভাবে ফেরত দিতে পারেন।

## Data model

- Booking cancellation fields:
  - cancellationReason
  - cancellationFee
  - cancelledAt
  - cancelledBy
  - cancellationPolicySnapshot
- Payment transaction fields নিশ্চিত করা:
  - parentPaymentId
  - transactionType: `PAYMENT | REFUND | CHARGEBACK | ADJUSTMENT`
  - gatewayTransactionId/refundId
  - idempotencyKey
  - status এবং failure reason
- Refund amount positive value হিসেবে store করে type দিয়ে direction বোঝানো preferable; negative amount convention সর্বত্র consistent না হলে ব্যবহার করা যাবে না।

## Cancellation preview

`POST /api/bookings/:id/cancellation-preview`

Return করবে:

- Paid amount
- Policy-based suggested fee
- Maximum refundable amount
- Non-refundable components
- Refundable components
- Available refund methods
- Gateway capability
- Resulting balance/credit

## Cancellation execute

`POST /api/bookings/:id/cancel`

- Required reason।
- Fee/refund validation।
- Unique idempotency key।
- Booking status, fee charge, refund record এবং room release transactionally handle।
- Online gateway refund external call হওয়ায় two-phase state ব্যবহার করতে হবে:
  1. refund `PROCESSING`
  2. gateway call
  3. `SUCCEEDED` বা `FAILED`, retryable job
- Gateway failure হলে booking cancellation rollback করা হবে নাকি cancellation রেখে refund pending হবে—product rule হবে: **booking cancelled থাকবে, refund pending/failed স্পষ্ট দেখাবে**।

## UI

- One-click destructive cancellation বাদ দিয়ে confirmation wizard।
- Reason preset + free text।
- Cancellation fee input/policy suggestion।
- Refund: none/full/partial।
- Refund method এবং gateway/manual indicator।
- Guest email/SMS/WhatsApp notification toggle।
- Final confirmation-এ exact financial outcome।
- Booking detail-এ refund timeline এবং retry/escalate action।

## No-show

- Dedicated `POST /api/bookings/:id/no-show`।
- Only due/past confirmed bookings।
- No-show fee এবং refund policy।
- Room availability release।
- Audit trail এবং optional guest notification।

## Guest self-service future-ready design

P0-তে guest direct cancel নয়। কিন্তু signed booking-management token design রাখতে হবে, যাতে P1-এ guest modify/cancel request করতে পারে; owner approval policy configurable হবে।

## Acceptance criteria

- [ ] Owner cancellation-এর আগে exact refund/fee preview পান।
- [ ] Refund paid amount-এর বেশি হতে পারে না।
- [ ] Duplicate request duplicate refund তৈরি করে না।
- [ ] Stripe-supported payment gateway থেকে real refund হয় এবং refund ID সংরক্ষিত থাকে।
- [ ] Cash/bank/mobile-wallet manual refund audit record থাকে।
- [ ] Failed gateway refund visible ও retryable।
- [ ] Cancellation financial writes partial state-এ আটকে থাকে না।
- [ ] No-show room release ও fee policy correctly apply করে।

---

# Initiative 3 — Rate Plan Applied to Real Booking Price

## Problem

Rate resolution UI-তে দেখা গেলেও booking creation stored total-এ base price ব্যবহার হতে পারে। Public booking এবং internal booking একই pricing engine ব্যবহার করে না। Documentation-এ unsupported cancellation policy claim আছে।

## Goal

Quote, checkout, stored booking, invoice এবং report—সব জায়গায় একই resolved nightly pricing ব্যবহার করা।

## Pricing design

Single total price নয়; nightly breakdown সংরক্ষণ করতে হবে:

```text
Night 1 — base 5,000 → Weekend Rate 6,000
Night 2 — base 5,000 → Weekend Rate 6,000
Discount — Early booking -1,000
Package — Breakfast +1,200
Tax — 5%
Total — ...
```

## Rate rules

- Date range overlap night-by-night evaluate হবে; শুধু check-in day নয়।
- `daysOfWeek` প্রত্যেক night-এ apply হবে।
- Priority এবং stacking policy explicit করতে হবে:
  - exclusive price plan বনাম additive discount
  - promo code stacking allowed কি না
  - room-specific plan global plan-এর উপর priority
- Early bird-এর জন্য advance-days condition এবং last-minute-এর জন্য days-before-arrival condition model-এ যোগ করতে হবে। শুধু type label যথেষ্ট নয়।
- Cancellation policy support করতে চাইলে model/UI/API-তে explicit policy field যোগ করতে হবে; না হলে documentation থেকে claim সরাতে হবে।

## Data changes

- Booking pricing snapshot JSON অথবা normalized booking-rate rows।
- Selected/applied rate plan IDs।
- Quote ID/version এবং expiry।
- Manual override actor/reason।

## API integration

- Internal create, public create, walk-in, modify এবং group booking pricing service call করবে।
- Client total authoritative হবে না; server quote পুনরায় validate করবে।
- Public quote endpoint room availability এবং final price একসঙ্গে দিতে পারে।

## UI

- Booking form-এ applied plan name ও nightly price breakdown।
- Owner manual override permission-gated; reason required।
- Public site-এ “tax/fees included or excluded” স্পষ্ট।
- Rate-plan editor-এ real condition fields এবং conflict preview।

## Acceptance criteria

- [ ] Displayed quote এবং stored booking total একই।
- [ ] Weekend/season boundary-crossing stay nightly rates correctly split হয়।
- [ ] Rate plan edit পুরনো booking price বদলায় না।
- [ ] Public, dashboard, walk-in এবং group booking একই fixture-এ একই total দেয়।
- [ ] Invoice pricing snapshot থেকে তৈরি হয়, current room base price থেকে নয়।

---

# Initiative 4 — Public Booking Availability, Holds and Concurrency

## Problem

Public booking read-then-create atomic নয়। Abandoned `PENDING` booking dashboard availability indefinitely block করতে পারে, এবং public/internal availability rules আলাদা।

## Goal

একই room/date-এর জন্য একটির বেশি confirmed booking না হওয়া এবং unpaid checkout hold predictableভাবে expire হওয়া।

## Booking hold model

- `PENDING` booking-এর সঙ্গে:
  - `holdExpiresAt`
  - checkoutSessionId
  - paymentAttemptId
  - source
- Hold duration tenant-configurable future option; P0 default 15–30 minutes।
- Expired hold সব availability query-তে non-blocking।
- Worker expired holds `EXPIRED` বা cancelled status-এ transition করবে; enum যোগ করলে reporting/docs update করতে হবে।

## Concurrency

- Public creation serializable transaction বা database-level exclusion strategy ব্যবহার করবে।
- Transaction-এর মধ্যে final availability re-check।
- Prisma `P2034` retry policy সীমিতভাবে প্রয়োগ।
- Payment success expired hold-এর পরে এলে:
  - room still available হলে confirm
  - unavailable হলে payment exception queue এবং immediate refund/manual review

## Public checkout state machine

```text
QUOTE → HOLD_CREATED → PAYMENT_PROCESSING → CONFIRMED
                   ↘ EXPIRED
                   ↘ PAYMENT_FAILED
```

## Cleanup job

- Every few minutes expired holds process।
- Idempotent batch with indexes on status/holdExpiresAt।
- Metrics: active holds, expired count, late payment exceptions।

## Privacy

- Public booking summary শুধু raw booking UUID জানলেই sensitive guest email/name না দেখায়।
- Signed short-lived checkout/manage token ব্যবহার।
- Response-এ masked PII।

## Acceptance criteria

- [ ] পাঁচটি concurrent public attempts-এ একই room/date-এ সর্বোচ্চ একটি success।
- [ ] Expired hold internal/public availability block করে না।
- [ ] Public ও dashboard availability একই blocking rules ব্যবহার করে।
- [ ] Late payment deterministicভাবে handled হয়; money হারায় না।
- [ ] Booking ID alone দিয়ে unmasked guest PII পাওয়া যায় না।

---

# Initiative 5 — Unified Invoice, Payment and Refund Accounting

## Problem

Booking folio, persisted Invoice, food/extras/packages এবং payments-এর calculation আলাদা। Cancelled items, current room base price এবং stale invoice line-এর কারণে balance mismatch বা double counting হতে পারে।

## Goal

একটি authoritative folio/ledger থেকে invoice, balance, receipt, refund এবং reports তৈরি করা।

## Ledger categories

- Charge: room night, food, minibar, laundry, package, venue, vehicle, custom extra, tax, cancellation fee
- Credit: discount, loyalty redemption, goodwill credit
- Payment: cash, card, bank, bKash, Nagad, Stripe, other
- Refund: full/partial, gateway/manual
- Reversal: cancelled/voided charge

Entries delete না করে reverse করতে হবে। Financial audit-এর জন্য immutable entries preferable।

## Invoice policy

- One booking folio is source of truth।
- Persisted invoice একটি numbered snapshot/projection।
- Draft invoice folio changes-এর সঙ্গে regenerate/sync হতে পারে।
- Sent/paid invoice পরিবর্তন হলে credit note বা revised invoice policy ব্যবহার।
- Package change, cancelled food order, minibar/laundry posting—সব event ledger entry তৈরি বা reverse করবে।

## Payment validation

- Zod schema: positive amount, supported method, reference constraints।
- Overpayment explicit policy ছাড়া blocked।
- Currency booking/tenant currency-এর সঙ্গে match করবে।
- Client supplied payment status trusted হবে না।
- Gateway webhook signature, idempotency এবং amount verification।

## Existing secrets

- Payment gateway credentials application-level encryption বা managed secret storage-এ রাখা।
- Masking শুধু UI concern নয়; key rotation এবং access audit দরকার।
- Production guest email-এ test card note কখনো যাবে না।

## Migration

- Existing bookings/invoices/payments audit script।
- Mismatch report তৈরি; silent auto-correction নয়।
- Safe backfill ledger entries with migration marker।
- Rollout সময়ে old/new calculation shadow compare করা।

## Acceptance criteria

- [ ] Booking detail, invoice PDF/email, checkout এবং report একই balance দেখায়।
- [ ] Cancelled food/package/extras total থেকে reverse হয়, history থাকে।
- [ ] Negative payment বা unauthorized overpayment rejected।
- [ ] Refund এবং cancellation fee invoice/ledger-এ visible।
- [ ] Sent invoice correction audit trail ছাড়া overwrite হয় না।
- [ ] Reconciliation job gateway amount ও local amount mismatch report করে।

---

# Initiative 6 — Group Booking Lifecycle Rebuild

## Problem

Group creation conflict check করে না, future rooms তাৎক্ষণিক reserved করতে পারে, date edit child bookings update করে না এবং bulk checkout standard housekeeping/billing lifecycle bypass করে।

## Goal

Group booking-কে individual booking-এর orchestration layer বানানো; আলাদা, কম-নিরাপদ booking engine নয়।

## Architecture

- Group record: contact, event, billing preference, aggregate summary।
- Child booking: room/date/status/pricing-এর authoritative unit।
- Group operations shared booking lifecycle service দিয়ে প্রতিটি child-এ apply হবে।
- Aggregate status derived হবে; manually inconsistent status রাখা যাবে না।

## Create flow

1. Dates ও room list select।
2. Availability service সব room check।
3. Group pricing preview এবং discount policy।
4. Single serializable transaction-এ group + child bookings create।
5. Future rooms physical status `RESERVED` করা হবে না; calendar booking conflict-ই reservation বোঝাবে।

## Modify flow

- Group dates change preview সব child booking-এ conflict/price impact দেখাবে।
- Partial update allowed: selected rooms move/remove/add।
- Existing checked-in child bulk date change করা যাবে না।
- Atomic update বা per-room result policy আগে define; P0-তে atomic safer।

## Delete/cancel

- Group “delete” hard delete নয়।
- Cancel whole group অথবা selected child bookings।
- Fee/refund Initiative 2 reuse।
- Audit reason required।

## Check-in/out

- Bulk action preview eligible/ineligible bookings।
- Each checkout standard ledger finalization, room `CLEANING`, housekeeping task, loyalty award এবং notification rules চালাবে।
- Partial failures visible; retry idempotent।

## Billing

- `MASTER` bill: group invoice aggregates child folios without duplicating charges।
- `INDIVIDUAL` bill: each child own invoice।
- Billing mode switch restrictions after invoice sent/payment received।

## Acceptance criteria

- [ ] Conflicting roomসহ group create হয় না।
- [ ] Group date edit child bookings, prices ও calendar update করে।
- [ ] Group cancellation child status/refund correctly handles।
- [ ] Bulk checkout প্রতিটি room cleaning task তৈরি করে।
- [ ] Master bill total child folio sum-এর সমান এবং double count নেই।

---

# Initiative 7 — Restaurant Payments and Inventory Integration

## Problem

Food order create হলেই `PAID` হয়; room charge ও table order payment state আলাদা করা যায় না। Order edit/refund নেই এবং menu sale inventory কমায় না।

## Goal

Kitchen workflow, guest billing, payment collection এবং stock consumption একসঙ্গে reliable করা।

## Order state separation

Operational status:

`PENDING → ACCEPTED/PREPARING → READY → DELIVERED`, সঙ্গে `CANCELLED`।

Financial status:

`UNPAID | POSTED_TO_ROOM | PARTIAL | PAID | REFUNDED | VOIDED`।

Operational status দিয়ে payment infer করা যাবে না।

## Order types

- Room service linked to active booking
- Restaurant table order
- Walk-in takeaway/dine-in
- Public QR table order

প্রতিটি type-এর allowed payment method ও posting rule নির্ধারণ করতে হবে।

## Editing

- Preparation শুরুর আগে item add/remove/edit।
- Preparation-এর পরে void/adjustment reason এবং manager permission।
- Price snapshot order item-এ থাকবে।
- Cancelled item ledger reversal করবে।

## Inventory recipes

- `MenuItemIngredient`:
  - menuItemId
  - inventoryItemId
  - quantityPerServing
  - unit/conversion
- Deduction policy configurable milestone; P0-তে `PREPARING` বা `DELIVERED`-এর একটি বেছে document করতে হবে।
- Cancellation হলে stage অনুযায়ী stock restore বা waste movement।
- Insufficient stock warning; hard block configurable future option।

## Billing

- Room service `POSTED_TO_ROOM` হলে booking ledger charge।
- Direct pay হলে payment record restaurant folio/receipt-এর সঙ্গে linked।
- একই order room folio এবং restaurant revenue-তে duplicate payment হিসেবে গণনা হবে না।

## Acceptance criteria

- [ ] Unpaid order paid হিসেবে তৈরি হয় না।
- [ ] Room service charge booking folio-তে একবার যায়।
- [ ] Cancelled order invoice/revenue থেকে বাদ পড়ে কিন্তু audit history থাকে।
- [ ] Menu item sale recipe অনুযায়ী stock movement তৈরি করে।
- [ ] Kitchen status এবং financial status independentভাবে correct থাকে।

---

# Initiative 8 — Marketing Scheduler and CRM Automation Completion

## Problem

Future SMS/WhatsApp/email campaign schedule করা গেলেও due campaign auto-send worker অসম্পূর্ণ। Test endpoints false success দিতে পারে। Booking-confirmed automation hooked নয়, birthday logic inconsistent এবং generated promo code corresponding offer ছাড়া পাঠানো হতে পারে।

## Goal

Owner campaign schedule করলে নির্ধারিত সময়ে, consent-respecting, measurable delivery হবে এবং automation trigger বাস্তব event থেকে চলবে।

## Scheduler

- Worker due campaigns claim করবে database lock/atomic status change দিয়ে।
- State:
  - `DRAFT → SCHEDULED → PROCESSING → SENT/PARTIAL/FAILED/CANCELLED`
- Per-recipient delivery record।
- Retry transient failure; permanent opt-out/invalid destination retry নয়।
- Idempotency campaign + guest + channel।
- Tenant timezone অনুযায়ী scheduled time।

## Test endpoints

- Provider call ছাড়া success নয়।
- Response-এ provider message ID বা actionable error।
- Platform gateway unavailable হলে `skipped` নয়, explicit configuration error।

## Automation events

- Booking lifecycle service domain event publish করবে:
  - booking confirmed
  - check-in
  - checkout
  - cancellation
- `enrollOnBookingConfirmed` সরাসরি বিচ্ছিন্ন helper না থেকে event consumer হবে।
- Duplicate event duplicate enrollment করবে না।

## Birthday/anniversary

- `Guest.dateOfBirth` একমাত্র birthday source। Notes parsing remove/backfill।
- Anniversary source স্পষ্ট করতে হবে: first stay/check-in date বা custom date।
- CRM enum/API/UI একই trigger set support করবে।

## Offers

- Template fixed promo code invent করবে না।
- Owner existing Offer select করবেন অথবা automation setup-এর সময় valid Offer তৈরি করবেন।
- Expiry, usage limit এবং public redeemability validate হবে।

## Compliance

- Channel-specific consent/opt-out।
- Quiet hours এবং timezone।
- Suppression list send-এর ঠিক আগে re-check।
- Campaign content ও consent evidence audit log।

## Acceptance criteria

- [ ] Scheduled campaign নির্ধারিত সময়ের acceptable window-তে auto-send হয়।
- [ ] Worker restart/duplicate run duplicate message পাঠায় না।
- [ ] Test send real delivery result দেখায়।
- [ ] Confirmed booking eligible sequence-এ auto-enroll হয়।
- [ ] Birthday automation `dateOfBirth` ব্যবহার করে।
- [ ] পাঠানো promo code বাস্তব active Offer-এর সঙ্গে linked।

---

# Initiative 9 — Accurate Historical Reports and Dispatch

## Problem

Selected date-এর occupancy current room status থেকে আসে। Revenue cash collection ও accrued restaurant/extras একসঙ্গে যোগ করে double-count করতে পারে। Worker server timezone ব্যবহার করে এবং delivery failure হলেও dispatched mark করতে পারে। Route ও worker report logic duplicate।

## Goal

Owner selected period-এর historically correct operational এবং financial report পাবেন; metric definition স্পষ্ট থাকবে।

## Metric definitions

- **Occupancy:** available room-nights-এর মধ্যে occupied room-nights, stay overlap থেকে।
- **ADR:** room revenue / rooms sold।
- **RevPAR:** room revenue / available room-nights।
- **Cash collected:** period-এ succeeded payment minus refunds।
- **Revenue earned:** ledger charge recognition policy অনুযায়ী।
- Cash basis ও accrual basis একই total-এ mix করা যাবে না; আলাদা section।
- Restaurant revenue order created time নয়, posted/delivered/paid policy অনুযায়ী।

## Architecture

- Single report query/service route এবং worker দুজন reuse করবে।
- Date boundaries tenant timezone থেকে UTC range-এ convert।
- Historical occupancy booking overlap থেকে calculate।
- Cancelled/no-show/refunded policy documented।
- Large date range-এর জন্য appropriate indexes/materialized daily snapshot future-ready।

## Dispatch

- Tenant timezone-aware scheduler।
- Per-channel attempt record।
- অন্তত একটি enabled channel success না হলে `lastDispatchDate` success হিসেবে set নয়।
- Partial delivery status এবং retry।
- Telegram/WhatsApp secrets encrypted/masked।

## UI

- Metric tooltip-এ definition।
- Cash vs earned revenue পৃথক cards।
- Date/timezone indicator।
- Export CSV/PDF একই backend dataset ব্যবহার করবে।
- Dispatch history: sent/failed/channel/error/retry।

## Acceptance criteria

- [ ] Historical report current room status বদলালেও বদলায় না।
- [ ] Cross-midnight stays correct room-night count দেয়।
- [ ] Payment, refund এবং restaurant charge double-count হয় না।
- [ ] Tenant timezone অনুযায়ী daily cutoff ও dispatch হয়।
- [ ] Failed delivery success হিসেবে marked নয় এবং retry করা যায়।

---

# Initiative 10 — Staff Payroll Completion

## Problem

Base salary এবং raise/bonus/deduction history আছে, কিন্তু monthly payroll, attendance/leave calculation, payment status এবং payslip নেই। বর্তমান feature-কে complete payroll বলা যায় না।

## Goal

Owner মাসিক salary calculate, review, approve, pay এবং payslip generate করতে পারবেন।

## Data model

- `PayrollPeriod`: tenant, month/start/end, status।
- `PayrollRun`: generation/approval/payment summary।
- `PayrollItem` per staff:
  - base salary snapshot
  - payable days
  - present/late/absent/leave/overtime
  - bonus/deduction
  - gross/net
  - status, payment method/reference/date
- Adjustment-এর recurrence এবং applicable period explicit।

## Workflow

1. Period create।
2. Attendance ও approved leave snapshot।
3. Draft calculation।
4. Owner review/manual adjustment with reason।
5. Approve/lock।
6. Record payment।
7. Payslip এবং expense/ledger posting।

## Rules

- Salary proration, unpaid leave, late penalty, overtime এবং rounding tenant-configurable; safe defaults।
- Historical payroll staff base salary change-এর পরে বদলাবে না।
- Approved run edit করতে reopen permission ও audit reason লাগবে।
- Staff deactivated হলেও historical payslip থাকবে।

## UI

- Payroll periods list এবং summary।
- Review table with exception flags: missing attendance, negative net, unapproved leave।
- Bulk approve/pay, কিন্তু per-row failure clear।
- Download/email payslip।

## Acceptance criteria

- [ ] Monthly run attendance/leave snapshot থেকে reproducible calculation দেয়।
- [ ] Raise effective date সঠিক period-এ apply হয়।
- [ ] Approved payroll later salary edit-এ বদলায় না।
- [ ] Paid/unpaid/partial state ও reference দেখা যায়।
- [ ] Payroll expense/report-এ একবার post হয়।

---

# Initiative 11 — Loyalty Redemption Applied to Billing

## Problem

Points earn ও redemption ledger আছে, কিন্তু returned discount booking/invoice/checkout-এ apply হয় না। Guest points হারাতে পারেন কিন্তু bill না-ও কমতে পারে।

## Goal

Redemption একটি atomic billing credit হবে; ব্যর্থ হলে points deduct হবে না।

## Rules

- Configurable conversion rate snapshot।
- Minimum redemption, maximum bill percentage, expiry এবং eligible charge categories।
- Cancellation/refund-এর পরে earned/redeemed points reversal policy।
- Points balance negative হবে না।
- Same booking-এ duplicate redemption idempotency।

## Transaction

এক transaction-এ:

1. Account lock/check balance।
2. Redemption transaction create।
3. Booking folio loyalty credit create।
4. Invoice/balance projection update।

কোনো step fail হলে সব rollback।

## UI

- Booking/checkout-এ available points এবং maximum usable value।
- Apply/remove redemption preview।
- Invoice-এ loyalty credit আলাদা line।
- Guest profile-এ earn/redeem/reversal history।

## Acceptance criteria

- [ ] Redeemed amount invoice balance কমায়।
- [ ] Duplicate request points দুইবার কাটে না।
- [ ] Redemption remove/cancel করলে configured policy অনুযায়ী points ফেরে।
- [ ] Refund-এর পরে incorrectly earned points reverse হয়।
- [ ] Ledger balance ও account balance reconcile করা যায়।

---

# Initiative 12 — Housekeeping and Room-State Consistency

## Problem

Normal checkout cleaning task তৈরি করলেও group checkout তা bypass করে। Manual room status এবং unvalidated task transition active booking-এর সঙ্গে inconsistent state তৈরি করতে পারে। Task edit/reschedule workflowও অসম্পূর্ণ।

## Goal

Room physical readiness, booking occupancy এবং housekeeping workflow আলাদা কিন্তু coordinated state machine দিয়ে পরিচালনা করা।

## State design

Booking state এবং room operational state এক জিনিস নয়। Suggested room states:

- `AVAILABLE_CLEAN`
- `OCCUPIED`
- `DIRTY/CLEANING`
- `INSPECTING`
- `OUT_OF_SERVICE`

Existing enum রাখতে হলে equivalent transition map document করতে হবে। Future reservation room-এর physical status বদলাবে না।

## Transition rules

- Check-in: only available/ready room → occupied।
- Checkout: occupied → cleaning + checkout task।
- Cleaning complete: cleaning → available অথবা inspection।
- Maintenance out-of-service: booking conflict warning/relocation required।
- Manual override owner/manager-only, reason required।
- Group checkout একই lifecycle function call করবে।

## Housekeeping task workflow

- Create, assign, edit schedule, start, complete, cancel/reopen।
- Allowed transition enum validation।
- Completion checklist/notes/photos optional P1।
- Duplicate checkout task prevention।
- Room move old room task policy।

## UI

- Room detail-এ “কেন unavailable” reason।
- Invalid transition action disabled এবং explanation।
- Task edit/reschedule modal via `ModalShell`।
- Override confirmation with downstream booking warning।

## Acceptance criteria

- [ ] Single/group checkout উভয়ই cleaning task তৈরি করে।
- [ ] Future reservation room-কে আজ unavailable operational state করে না।
- [ ] Invalid task/room transition API reject করে।
- [ ] Manual override actor/reason audit হয়।
- [ ] Cleaning completion only eligible room available করে।

---

# Initiative 13 — Advanced Modules Connected to Accounting

## Problem

Vehicle, venue, minibar, laundry এবং corporate account module operational record রাখতে পারে, কিন্তু deposit, cancellation, payment, refund, booking invoice এবং revenue reporting একই financial foundation ব্যবহার করে না।

## Goal

প্রতিটি sellable service একই ledger/payment/refund contract ব্যবহার করবে, module-specific rule রেখেও।

## Common sellable-service contract

প্রতিটি module provide করবে:

- Service/order ID এবং tenant
- Guest/booking/corporate account link
- Price snapshot এবং tax category
- Fulfilment status
- Financial status
- Ledger charge/reversal function
- Cancellation/refund policy
- Revenue recognition date

## 13.1 Vehicle rental

- Availability overlap check transactionally।
- Deposit collected/held/returned/forfeited ledger entries।
- Damage/late fee।
- Cancellation refund।
- Vehicle return physical status এবং maintenance alert।

## 13.2 Venue booking

- Date/time overlap protection।
- Advance/deposit schedule।
- Package/add-on charges।
- Reschedule/cancel preview ও refund।
- Booking/customer/corporate invoice posting।

## 13.3 Minibar

- Consumption active booking validation।
- Posting মানেই booking ledger charge; আলাদা manual “billed” boolean drift এড়ানো।
- Catalog price snapshot।
- Inventory integration/reversal।

## 13.4 Laundry

- Item/service price snapshot, quantity, status।
- Delivery হলে বা configured stage-এ booking charge।
- Cancel/rework/discount adjustment।
- Staff operational queue এবং promised time।

## 13.5 Corporate accounts

- Credit limit enforcement।
- Payment terms/due date।
- Corporate invoice payment/refund ledger।
- Partial payment, overdue ageing এবং account statement।
- Child booking payment corporate invoice-এ duplicate না হওয়া।

## Rollout strategy

Common adapter contract তৈরি করে একসঙ্গে সব module rewrite নয়। Suggested order:

1. Minibar—smallest booking-charge integration।
2. Laundry।
3. Vehicle deposit/refund।
4. Venue deposit/reschedule।
5. Corporate account reconciliation।

## Acceptance criteria

- [ ] প্রতিটি completed service invoice/folio-তে একবার post হয়।
- [ ] Cancellation reversal/refund traceable।
- [ ] Deposit income হিসেবে ভুলভাবে count হয় না; return/forfeit visible।
- [ ] Module revenue unified reports-এ correct categoryতে আসে।
- [ ] Corporate invoice ও child booking payment double-count হয় না।

---

## 6. Cross-cutting UX requirements

- Resort owner technical expert ধরে নেওয়া যাবে না। প্রতিটি complex flow-এ plain Bangla/English-friendly copy, amount preview এবং recovery guidance থাকতে হবে।
- First-use guided video/onboarding link রাখা যাবে, কিন্তু core UI self-explanatory হতে হবে।
- Error message provider/Prisma wording দেখাবে না; কী হয়েছে এবং owner কী করবেন তা বলবে।
- Empty state-এ next action থাকবে।
- Destructive/financial action confirmation ছাড়া execute হবে না।
- Loading অবস্থায় submit disabled; retry duplicate mutation তৈরি করবে না।
- Mobile এবং 375px viewport support।
- Keyboard/focus management এবং WCAG-friendly labels।

## 7. Documentation and marketing truth gate

প্রতিটি initiative release-এর সঙ্গে docs update বাধ্যতামূলক। Current misleading claims বিশেষভাবে audit করতে হবে:

- `Edit Booking` এবং room move।
- Cancellation reason/fee/refund selection।
- Non-refundable rate-plan cancellation policy।
- Scheduled campaign auto-send।
- Payroll বনাম salary adjustment।
- Loyalty redemption applied to bill।
- Group booking master/individual bill completeness।
- Report ADR/RevPAR এবং historical accuracy।

### Rule

- Shipped নয়: documentation/landing page-এ future capability হিসেবে label বা remove।
- Backend-only: owner-facing feature হিসেবে claim নয়।
- UI আছে কিন্তু financial side-effect নেই: complete feature হিসেবে claim নয়।
- Release checklist-এ product owner + engineering sign-off।

## 8. Testing strategy

### Unit tests

- Availability overlap and hold expiry।
- Nightly pricing/rate priority।
- Cancellation/refund arithmetic।
- Ledger balance projection।
- Status transition maps।
- Payroll calculation।
- Loyalty conversion/reversal।

### Integration tests

- Tenant isolation এবং entitlement।
- Booking create/modify/cancel/refund।
- Public concurrent booking।
- Gateway webhook/refund idempotency।
- Group bulk lifecycle।
- Restaurant order → inventory → folio।
- Scheduled campaign worker retry/dedup।
- Historical report fixtures across timezone boundaries।

### E2E owner journeys

1. Create confirmed booking → modify date/room → collect balance।
2. Paid booking → cancel → partial gateway refund → guest notified।
3. Public guest quote → hold → pay → owner sees correct rate/invoice।
4. Group create → partial check-in → bulk checkout → housekeeping।
5. Room-service order → kitchen → room folio → checkout।
6. Schedule campaign → worker sends → delivery stats।
7. Generate payroll → approve → pay → payslip।
8. Redeem points → invoice balance reduced।

### Non-functional tests

- Five or more concurrent booking attempts।
- Duplicate webhook/job delivery।
- Worker restart during processing।
- Large tenant dataset query performance।
- Permission matrix per action।
- Dark mode, mobile and accessibility smoke checks।

## 9. Observability and audit

Minimum metrics/events:

- Booking modification success/conflict rate।
- Active/expired holds এবং late-payment exceptions।
- Refund requested/succeeded/failed and processing time।
- Invoice/ledger mismatch count।
- Scheduled campaign delay/failure/dedup count।
- Report dispatch success by channel।
- Payroll exception count।
- Invalid room-state transition attempts।

Financial এবং lifecycle audit event-এ tenantId, actorId, entity, action, timestamp, correlation/idempotency ID এবং safe before/after summary থাকবে। Secrets বা full card/payment credentials log করা যাবে না।

## 10. Migration and rollout controls

- Schema migration আগে staging copy-তে test।
- Financial backfill dry-run report ছাড়া production write নয়।
- New pricing/ledger service প্রথমে shadow mode-এ old calculation-এর সঙ্গে compare করা।
- Feature flag দিয়ে tenant-by-tenant rollout।
- Pilot tenants-এর real workflows observe করা।
- Rollback plan data loss করবে না; immutable ledger entries delete নয়।
- Worker feature deploy করার সময় singleton/idempotent execution নিশ্চিত করা।

## 11. Suggested milestones

### Milestone A — Stable foundation

- Phase 0 green builds/tests
- Availability, pricing, lifecycle এবং billing service contracts
- Migration/backfill design approved

### Milestone B — Trustworthy booking core

- Initiatives 1–5
- Owner modify/cancel/refund এবং public booking safe
- Invoice/payment single source of truth

### Milestone C — Operational completeness

- Initiatives 6, 7 এবং 12
- Group, restaurant/inventory এবং housekeeping shared lifecycle-এ

### Milestone D — Growth and insight

- Initiatives 8, 9 এবং 11
- Marketing automation, accurate reports এবং loyalty billing

### Milestone E — Workforce and ancillary revenue

- Initiatives 10 এবং 13
- Payroll এবং advanced service accounting

## 12. Definition of done for every initiative

কোনো initiative “done” হবে না যতক্ষণ না:

- [ ] UI, API, database এবং background side-effect end-to-end complete।
- [ ] Role এবং plan entitlement enforced ও tested।
- [ ] Tenant isolation tested।
- [ ] Happy path, validation, concurrency এবং retry tests আছে।
- [ ] Audit trail এবং operational metrics আছে।
- [ ] Mobile/dark-mode/accessibility checked।
- [ ] Documentation actual behavior অনুযায়ী update।
- [ ] Existing design-system violation বাড়েনি।
- [ ] Type-check, unit/integration tests এবং selected E2E green।
- [ ] Migration, rollout এবং rollback notes written।

## 13. Explicit non-goals for this program

- AI pricing/forecasting আগে নয়; deterministic rate এবং report correctness আগে।
- Full OTA API integration এই plan-এর অংশ নয়; availability foundation সেটির prerequisite।
- Full general-ledger accounting suite নয়; ResortPro operational folio/payment/refund accuracy পর্যন্ত।
- Guest mobile app নয়; signed web self-service future consideration।
- সব advanced module এক release-এ rewrite নয়; common adapter দিয়ে incremental rollout।

## 14. Success metrics

### Release quality

- TypeScript errors: 0
- Required CI checks: 100% green before merge
- Core E2E completion rate: 100%
- Duplicate confirmed booking from concurrency test: 0

### Owner outcomes

- Booking modify/cancel workflow completion: ≥ 95%
- Refund requiring manual engineering intervention: < 1%
- Invoice mismatch reports: 0 critical mismatch
- Scheduled campaign on-time processing: ≥ 99%
- Daily report successful dispatch among configured channels: ≥ 99%
- Invalid room-state incidents: declining toward 0

### Business trust

- Financial discrepancy support tickets: reduce by at least 80% after rollout
- Booking-management support tickets: reduce by at least 50%
- Pilot owner core-task success without support: ≥ 90%

## 15. Decisions required before implementation

Blocking product decisions:

1. Cancellation fee এবং refund policy tenant-configurable হবে, নাকি booking-time snapshot template থেকে আসবে?
2. Refund gateway failure হলে booking cancelled রেখে refund pending রাখার policy অনুমোদিত কি না?
3. Rate plan stacking rules কী হবে?
4. Revenue reports cash basis, accrual basis—দুটিই দেখাবে কি না?
5. Payroll-এর default proration/leave/overtime rules কোন market-এর জন্য হবে?
6. Loyalty points cash-equivalent maximum কত শতাংশ bill-এ ব্যবহারযোগ্য?
7. Restaurant stock কোন operational stage-এ deduct হবে?
8. Checked-in room move-এর পরে old room সরাসরি cleaning-এ যাবে কি না?

এই decisionগুলো Milestone A-তে record করতে হবে। সিদ্ধান্ত না থাকলে engineer routeভেদে আলাদা assumption করতে পারবেন না।


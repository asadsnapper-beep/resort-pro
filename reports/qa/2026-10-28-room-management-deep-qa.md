# ResortPro Room Management — Deep QA Audit

**Date:** 2026-10-28  
**Perspectives:** resort owner, manager, receptionist, housekeeping/maintenance operator, guest, business owner, security reviewer, accessibility reviewer, and senior web/QA engineer  
**Scope:** room create/edit/delete, property assignment, status lifecycle, availability, booking consistency, maintenance/housekeeping dependencies, pricing/media, roles, tenant isolation, concurrency, desktop and mobile UI  
**Verdict:** **NO-GO for customer handoff until RM-001 through RM-004 are fixed and retested.** The room catalogue is real and tenant isolation is strong, but two visible workflows can persist false or contradictory business state: an occupied room can be made saleable, and a selected property is silently discarded.

## Executive summary

Room Management is not a decorative UI. The room list, statistics, filters, detail sheet, CRUD endpoints, plan limit, soft deletion, booking references, maintenance and housekeeping connections all have real implementations. The normal create → list → book → check-in → checkout path works, active bookings protect deletion, and the focused tenant/RBAC/concurrency regression suite passed.

The release risk is that the room status is being used as both an operational workflow and an editable label, without one authoritative state machine. An Owner, Manager or Receptionist can set any status directly, regardless of checked-in guests, bookings, cleaning work or maintenance tickets. The isolated adversarial tenant reproduced a checked-in booking whose room was changed from Occupied to Available. Separately, the Add/Edit Room UI exposes a Property selector, submits `propertyId`, reports success, and then the API silently strips that field; the room is saved under no property.

These are customer-trust failures, not polish issues. Front desk can sell an occupied or unclean room, and multi-property customers can spend time organising inventory that never persists.

## Test methodology

The audit applied:

- state-transition and business-invariant review;
- positive, negative, boundary and adversarial API tests;
- database-persistence verification in an isolated tenant;
- booking/room/maintenance/housekeeping cross-module consistency review;
- concurrent duplicate-number testing;
- authorization, role and tenant-isolation regression tests;
- Owner and Receptionist browser journeys;
- iPhone 14 responsive overflow inspection;
- accessible-name, dialog and keyboard-structure inspection;
- TypeScript and dashboard design-system release checks.

## Automated evidence

| Check | Result |
|---|---:|
| Focused API regression suite | **51/51 passed** |
| Isolated room adversarial probes | **6/6 reproduced current unsafe outcomes** |
| Owner desktop room workspace/modal | Pass; accessibility defects reproduced |
| Receptionist desktop permission journey | API correctly returned 403, but dead UI workflow reproduced |
| iPhone 14 Add Room layout | Fixed five-column row overflow/clipping reproduced |
| API TypeScript (`tsc --noEmit`) | Pass |
| Web TypeScript (`tsc --noEmit`) | Pass |
| Dashboard design-system ratchet | Pass; no category regressed |

The 51 regression tests covered booking lifecycle, five-way booking concurrency, room CRUD tenant attacks, broad role permissions and tenant isolation. All mutation probes used a disposable tenant that was deleted after the run.

## Functional coverage matrix

| Area | Expected | Actual | Result |
|---|---|---|---|
| Create/edit/list/search/filter/stats | Real persistence and usable catalogue | Implemented | Pass |
| Property assignment | Selected property persists | UI accepts it; API strips it | **Critical** |
| Status lifecycle | Booking/work state protects transitions | Any allowed role can force any status | **Critical** |
| Availability | Only operationally saleable rooms | Excludes maintenance/bookings, but includes Cleaning/Reserved/manual Occupied | **Major** |
| Maintenance integration | Status and tickets stay synchronized | Direct status can create either side without the other | **Major** |
| Housekeeping integration | Completion respects occupancy/maintenance | Completion can unconditionally set Available | **Major dependency risk** |
| Active-booking delete guard | Cannot remove committed inventory | Returns 409 | Pass |
| Duplicate room number | Stable conflict response | Sequential 409; concurrent race can return 500 | **Major** |
| Roles | UI matches API authority | Receptionist sees forbidden Add/Edit/Delete controls | **Major** |
| Tenant isolation | Cross-tenant access blocked | Focused suite passed | Pass |
| Mobile form | All fields usable | First row clips outside viewport | **Major** |
| Accessibility | Named modal and fields | Missing dialog, label and icon-button semantics | **Minor** |

## Critical findings

### RM-001 — Critical — Checked-in rooms can be manually changed to Available

`PATCH /api/rooms/:id/status` accepts any of Available, Occupied, Cleaning, Maintenance or Reserved for Owner, Manager and Receptionist. It does not inspect active bookings, current room status, housekeeping tasks, maintenance tickets or permitted transitions.

The adversarial test created and auto-checked-in a booking. The booking remained `CHECKED_IN`, but a second request changed its room to `AVAILABLE` and received 200.

**Business impact:** the same room can be sold or assigned while a guest is inside; front desk counts, occupancy, website availability and staff decisions become unsafe.

**Required fix:** replace free status editing with a server-owned room state machine. Derive Occupied/Reserved from bookings; derive Cleaning/Maintenance from work records; require explicit, audited override permission and reason for exceptional transitions. Use a transaction and compare-and-set conditions. Permanently test every valid/invalid transition and concurrent update.

### RM-002 — Critical — Property selector reports success but does not persist

The Add/Edit Room modal loads real properties and submits `propertyId`. The room database model supports `propertyId`. However, the API's Zod room schema does not include the field, so Zod strips it before create/update. The request returns 201/200 and the UI closes as if successful.

The persistence probe selected a real property, received 201, and verified both the response and database row had `propertyId: null`.

**Business impact:** a core multi-property feature is false-success UI. Rooms cannot be reliably organised per resort/building, and property-specific inventory views remain empty or wrong.

**Required fix:** accept `propertyId` explicitly; verify the property is active and belongs to the same tenant; support null for unassignment; return the persisted value; invalidate property room counts; add create/edit/cross-tenant/deleted-property tests and a browser persistence test.

## Major findings

### RM-003 — Major — Availability exposes operationally unavailable rooms

The availability query excludes overlapping Pending/Confirmed/Checked-in bookings and rooms in Maintenance. It does not require `status === AVAILABLE`. A room manually marked Cleaning, Reserved or Occupied with no overlapping booking is returned.

The test marked a room `CLEANING`, queried immediate availability and found that room in the 200 response.

**Impact:** walk-in, booking and other consumers can offer an unclean, held or manually occupied room.

**Required fix:** define one saleability service. At minimum require Available plus no overlapping inventory hold; model future reservations through booking dates rather than a global Reserved label. Make every booking channel use the same service.

### RM-004 — Major — Maintenance and housekeeping can contradict room status

Directly setting Maintenance does not create a maintenance ticket; the probe confirmed zero work items. Conversely, direct status editing can mark a room Available while open maintenance remains. Housekeeping completion also sets a room Available without checking checked-in bookings, open maintenance tickets or another active cleaning task.

**Impact:** the dashboard can claim a room is ready while no one fixed it, or hide a room from sale with no actionable work order.

**Required fix:** route operational transitions through canonical services. Maintenance status must be derived from open tickets; cleaning status from active tasks; completion must recompute state from all blockers in one transaction.

### RM-005 — Major — Receptionist sees mutation controls the API forbids

The room page and detail sheet render Add Room, Edit Room and Delete controls without role gating. API policy permits Receptionist status updates, but create/edit require Owner/Manager and delete requires Owner.

The real Receptionist browser journey opened and completed Add Room, then received HTTP 403. This is secure at the API layer but broken as a product workflow.

**Impact:** staff waste time entering data only to see a generic error; Delete/Edit create the same trust problem.

**Required fix:** expose capabilities from the authenticated role and hide or disable forbidden controls with an explanation. Keep the API checks. Add role-specific browser tests for every control.

### RM-006 — Major — Availability date contract accepts impossible ranges

The endpoint constructs JavaScript dates directly and does not validate format, validity or `checkOut > checkIn`. A reversed range (`2027-12-10` → `2027-12-01`) returned HTTP 200 with `success: true`. Missing dates also return an error body with HTTP 200 rather than a 4xx contract.

**Impact:** clients can display meaningless availability, cache invalid results and treat failed validation as success.

**Required fix:** validate ISO dates with Zod, reject invalid/past/reversed ranges using 400/422 and a stable machine-readable error code, and centralize the same stay rules used by booking creation.

### RM-007 — Major — Concurrent duplicate room creation leaks a 500

Room number uniqueness is checked with a read followed by create. The database constraint protects the data, but four simultaneous creates produced one 201 and at least one unhandled Prisma unique-constraint 500 rather than deterministic 409 responses.

**Impact:** double-clicks, retries or parallel staff actions look like a server outage and can trigger unnecessary retries.

**Required fix:** catch the database unique violation and map it to 409; retain the unique constraint; add retry/idempotency handling and a maintained concurrency test. Apply the same pattern to plan-limit races.

### RM-008 — Major — Overdue checked-in guests disappear from room detail

Room detail labels a booking “Currently Occupied,” but its lookup requires `checkOut >= now`. A guest who remains checked in after the scheduled checkout therefore disappears from the room detail even though the canonical booking status is still Checked In.

**Impact:** staff can see an Occupied room with no guest context, or be encouraged to force its status while an overstaying guest is still present.

**Required fix:** always show a `CHECKED_IN` booking regardless of scheduled checkout; treat it as overdue and visibly warn staff. Apply date-window filtering only to upcoming Confirmed/Pending bookings.

### RM-009 — Major — Add Room is not usable on mobile

The first form row uses fixed columns of `100px 1fr 80px 90px 110px` plus gaps inside a narrow modal whose body hides horizontal overflow. iPhone 14 testing measured row content wider than its client area and the final Price field beyond the viewport.

**Impact:** mobile owners cannot reliably see or edit Floor, Guests and Price while adding inventory.

**Required fix:** use a responsive one/two-column layout below tablet width; never hide required form fields with `overflow-x: hidden`; add narrow-width screenshots and field-visibility assertions.

## Minor, security-hardening and accessibility findings

### RM-010 — Minor — Modal and detail sheet lack accessible dialog behavior

The Add Room overlay has no dialog role, accessible title, focus trap, initial focus or Escape/focus-restoration contract. Visible labels are not connected to inputs, and icon-only close/add/remove/delete controls lack accessible names. Browser role queries confirmed the dialog and “Room #” label were not programmatically discoverable.

**Required fix:** migrate to the project's `ModalShell` contract or provide equivalent dialog semantics; connect every label with `htmlFor`/`id`; name icon controls; add keyboard and axe/WCAG regression tests.

### RM-011 — Minor — Price input hardcodes US dollars

Room cards format the tenant's currency, but Add/Edit Room always prefixes the price with `$`.

**Impact:** BDT and other currency tenants may enter or interpret the wrong amount.

**Required fix:** render the tenant currency symbol/code consistently and keep storage as a decimal amount in the configured currency.

### RM-012 — Minor — Media policy exists only partly in the client

The UI limits eight images and four videos, but the server has no array limits; image strings are not URL-validated. External media also creates privacy, broken-content and payload-size concerns.

**Required fix:** enforce server limits, schemes, normalized URLs and upload ownership; apply CSP/privacy controls; return field-level validation errors.

### RM-013 — Minor — No dedicated maintained Room Management regression suite

Existing broad tests protect CRUD isolation and booking lifecycle, but the adversarial status/property/availability/mobile/RBAC cases were not maintained tests before this audit.

**Required fix:** convert the release blockers into permanent integration and Playwright tests after fixing behavior.

## What passed strongly

- Room list, pagination, search, type/status filters and statistics call real APIs.
- Create/edit validation enforces required name/number/type, positive price and occupancy 1–20.
- Database uniqueness prevents two persisted rooms with the same number inside one tenant.
- Room numbers may repeat across different tenants.
- Owner/Manager API mutation roles and Receptionist read/status roles are enforced server-side.
- Cross-tenant room read/update/delete attacks passed the tenant-isolation suite.
- Active Pending/Confirmed/Checked-in bookings block room deletion.
- Deletion is soft and inactive rooms are removed from normal inventory queries.
- Normal booking create, check-in, checkout and post-checkout availability passed.
- Five simultaneous booking requests still produce exactly one successful overlapping booking.
- Desktop room workspace, filters and Add Room modal render from the real application.
- API and web TypeScript checks passed.
- Dashboard design-system ratchet reported no regression.

## Release recommendation

The catalogue is suitable for an internal demonstration, but Room Management is not ready for customer operations next week while staff can create contradictory occupancy state and multi-property assignment reports false success.

### Minimum customer-handoff gate

1. Implement and test one authoritative room state machine (RM-001, RM-003, RM-004, RM-008).
2. Fix Property create/edit persistence and tenant validation (RM-002).
3. Align every visible mutation control with role capabilities (RM-005).
4. Validate availability dates and return proper 4xx errors (RM-006).
5. Map duplicate races to 409 and make retry behavior deterministic (RM-007).
6. Rebuild and verify the Add/Edit modal for mobile and accessibility (RM-009, RM-010).
7. Convert all adversarial scenarios into permanent regression tests.
8. Retest Room → Booking → Check-in → Early/Normal checkout → Cleaning → Maintenance → Available across Owner, Manager and Receptionist on desktop and a physical mobile device.

## Safety, cleanup and limitations

- All mutation tests used an isolated QA tenant; cleanup completed.
- No real customer room, booking, property, payment, email or file was changed.
- Browser roles used the local demo environment; external identity-provider behavior was not in scope.
- Media upload storage/CDN delivery and malware scanning were code-reviewed but not exercised against production infrastructure.
- Email was disabled locally and no external notifications were sent.
- Mobile used iPhone 14 emulation, not a physical iOS Safari device.
- Temporary QA test files were removed after execution; the permanent evidence is this report.

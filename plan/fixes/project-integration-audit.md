# ResortPro Project Integration Audit & Fix Tracker

## Purpose

ResortPro has many working screens. A screen is not a finished feature until
the data it creates appears in every place where staff and guests need it.

Use this file to test and fix the project one connection at a time. Do not
mark a feature complete because a page loads or a form submits. Mark it
complete only after its full input → result → downstream update path works.

## How to use this tracker

For each row below:

1. Create the item using the first module.
2. Follow every arrow in **Must update / appear in**.
3. Test with the correct user role and a second tenant where relevant.
4. Record the result in the **Result** column: `PASS`, `FAIL`, or `BLOCKED`.
5. Fix one end-to-end flow before beginning another unrelated feature.

Priority labels:

- **P0** — money, bookings, access, data isolation, or a guest-facing flow.
- **P1** — daily staff operation or a visible management outcome.
- **P2** — valuable module, automation, or reporting enhancement.

## The core resort lifecycle

This is the minimum chain that must work before expanding features:

```text
Tenant setup
  → rooms and rates
  → availability
  → booking / walk-in
  → guest + document + payment
  → check-in
  → housekeeping / restaurant / expenses
  → checkout + invoice
  → revenue, occupancy, reports, CRM and loyalty
```

If any arrow is broken, the later dashboard number may look correct while the
real operation is not.

---

## A. Account, tenant and access

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | Register | Verify-email page → login → onboarding → tenant dashboard | Unverified user cannot use the dashboard; verification link works once; expired/invalid link gives a useful error. | [ ] |
| P0 | Onboarding | Tenant settings, plan status, first room, public site | Completing or skipping onboarding sends the owner to the right place and does not block an existing resort. | [ ] |
| P0 | Login / logout / reset password | Auth store, refresh token, dashboard role, invite acceptance | Correct tenant opens; logout removes session; password reset and invitation links preserve the intended tenant. | [ ] |
| P0 | Roles and staff invitations | Sidebar visibility, API permission, staff profile, audit log | A hidden menu must also be blocked by the API. Invitee receives the correct role and cannot access owner-only data. | [ ] |
| P0 | Multi-tenant accounts | Every list, file URL, search result, admin impersonation | Tenant A never sees tenant B rooms, guests, documents, bookings, payments, or upload URLs. | [ ] |
| P1 | Profile, language and theme | All dashboard pages | Avatar, display name, language and dark mode stay after refresh and do not break any page. | [ ] |
| P1 | Billing, trial and plan limits | Feature flags, seat/room limits, upgrade screen, invoices | Plan changes update menu visibility and backend limits together; no stale “free” or legacy plan labels remain. | [ ] |

## B. Rooms, properties, pricing and availability

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | Properties | Room list, booking widgets, public website | Property switch or create selects the correct room inventory and booking context. | [ ] |
| P0 | Rooms & Villas | Availability, calendar, New Booking, Walk-in, housekeeping, maintenance, website | Create, edit, disable, and delete a room. Disabled rooms cannot be booked publicly or internally. | [ ] |
| P0 | Room availability | Booking page, calendar, public availability, Walk-in | A confirmed booking blocks the exact date overlap everywhere. Cancel, checkout, and failed payment have the correct availability result. | [ ] |
| P0 | Rate plans | New Booking, Walk-in, public checkout, invoices, revenue | A qualifying rate plan changes the actual saved booking total, invoice amount, and report revenue—not just preview text. | [ ] |
| P1 | Packages / offers | Public website, checkout, bookings, CRM | Package eligibility, price, availability and redemption match in all three surfaces. | [ ] |
| P1 | External calendars / channels | Room availability, booking calendar, conflict handling | Import an external busy date; it prevents an internal/public booking. Failed sync is visible and retryable. | [ ] |
| P1 | Group bookings | Rooms, guests, payments, invoices, reports | Group room allocation cannot overbook; group total matches its individual stays and payment. | [ ] |
| P1 | Corporate accounts | Guests, bookings, invoices, CRM, reports | Booking under a company records the account and billing terms. Invoices and account balance reflect it. | [ ] |

## C. Booking, Walk-in, calendar and documents

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | New Booking | Booking detail, guest profile, room calendar, payment, invoice, dashboard stats | Create a booking. Confirmation number, guest, room, dates, amount, payment status, calendar block, and dashboard count all agree. | [ ] |
| P0 | Bookings page Walk-in | Guest, booking detail, room status, payment, front desk, housekeeping | Walk-in creates a guest and checked-in stay, marks room occupied, creates the selected payment state, and appears in Front Desk. | [ ] |
| P0 | Front Desk Walk-in | Same destinations as Bookings Walk-in | The two walk-in entry points must produce equivalent bookings and document behaviour. They currently need consolidation. | [ ] |
| P0 | Booking detail | Guest profile, document list, payment list, invoice, audit trail | Every attachment, ID document, payment, status change and note can be reviewed later from the stay. | [ ] |
| P0 | Guest documents | New Booking, both Walk-ins, guest profile, booking detail | Document upload stores one record with guest ID and booking ID. It is viewable in the relevant booking and guest profile. | [ ] |
| P0 | Check-in / checkout | Room status, front desk, payment balance, housekeeping, invoice, dashboard | Check-in makes room occupied. Checkout makes it dirty/vacant as designed, creates housekeeping work, finalises balance and enables invoice. | [ ] |
| P0 | Cancellation / no-show | Availability, payment/refund, invoice, calendar, reports, notifications | Correct statuses free or retain dates according to policy. Refund cannot exceed paid amount. | [ ] |
| P1 | Booking calendar | Every booking source, room availability, drag/change action | Calendar uses the same dates as booking list and public site. Moving a stay validates conflicts before save. | [ ] |
| P1 | Guest search and duplicates | New Booking, Walk-in, CRM, loyalty | Search finds existing guests. A second stay does not silently make a duplicate guest when email/phone matches. | [ ] |

### Known document-flow issue

See [booking-document-visibility.md](booking-document-visibility.md).

- Front Desk Walk-in already has **+ Add Document**.
- New Booking has document upload at its confirmation step.
- Booking Detail does not show the uploaded document afterward.
- The Walk-in button on `/dashboard/bookings` uses a separate, older modal and
  does not yet match the Front Desk document flow.

## D. Guest relationship, loyalty, CRM and marketing

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P1 | Guest profile | Bookings, documents, payments, loyalty, CRM history | A guest’s stay history, documents, contact data and notes are complete and tenant-scoped. | [ ] |
| P1 | Loyalty | Eligible bookings/payments, guest balance, checkout, public/member communication | Points are awarded once, reversed on cancellation/refund when required, and redeemed value affects the final amount. | [ ] |
| P1 | CRM / guest segments | Guest fields, bookings, loyalty, offers, email/SMS logs | Segment count matches actual qualifying guests. Campaign sends do not include opt-outs or another tenant’s guests. | [ ] |
| P1 | Offers / promotions | Public site, checkout, booking total, CRM | An offer has a real eligibility rule and applied discount trace; expired offers disappear everywhere. | [ ] |
| P2 | AI Content | Marketing drafts, usage cap, plan entitlement, audit | AI drafts are saved as drafts only, usage limits work, and disabled AI does not make failing background calls. | [ ] |
| P2 | Referrals | Registration, referred tenant, account credit, billing/admin approval | Referral link opens registration, code is retained, and the benefit is applied only after the defined qualification. | [ ] |

## E. Front desk and operations

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | Front Desk arrivals/departures | Bookings, rooms, guest details, payments, housekeeping | Today’s list matches booking data. Check-in/out actions change the same booking—not a duplicate record. | [ ] |
| P1 | Housekeeping | Checkout, room status, staff assignment, dashboard, room availability | Checkout creates the expected task. Completing task changes the room to available only when policy allows. | [ ] |
| P1 | Maintenance | Room availability, asset history, task assignment, reports | A blocking maintenance ticket removes room availability. Closing it restores availability intentionally. | [ ] |
| P1 | Staff / attendance / salary | Role permissions, shifts, payroll/reporting | Staff removal/deactivation removes access. Attendance feeds the correct staff record and salary view. | [ ] |
| P1 | Assets, laundry, minibar, lost & found | Room/guest/booking/expense where applicable | Operations records must show their related room or guest and appear in costs or checkout flow where promised. | [ ] |
| P1 | Support tickets | Guest/staff, notification, admin support view | New ticket appears for the reporter and admin/support team; status changes notify the correct person. | [ ] |

## F. Restaurant, inventory and procurement

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P1 | Menu items and tables | Restaurant order form, public table QR, kitchen orders | Active menu items appear in every allowed ordering surface; disabled items do not. | [ ] |
| P1 | Food / table orders | Table status, booking room charge, payment, inventory, invoice | Order status reaches kitchen and billing. A room charge appears in the correct guest folio/invoice. | [ ] |
| P1 | Inventory | Orders, minibar, purchase orders, low-stock dashboard | Consuming or receiving stock changes quantities once. Low stock alert matches the real threshold. | [ ] |
| P2 | Vendors and purchase orders | Inventory receipt, expenses, payable reporting | Receiving a purchase order increases stock and records cost without double counting. | [ ] |

## G. Finance, invoices, reports and shareholders

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | Payments | Booking payment status, invoice, balance due, revenue, refunds | Cash/card/bank payment updates paid amount exactly once. Duplicate webhook or retry cannot duplicate revenue. | [ ] |
| P0 | Invoice | Booking/folio, guest, payment, email, PDF/print, report | Invoice total equals booked services, tax, discounts and paid/balance values. Sending/printing uses the correct tenant identity. | [ ] |
| P1 | Expenses | Dashboard revenue/profit, reports, shareholder estimate | Expense category/date/amount is reflected in the correct reporting period and net profit. | [ ] |
| P1 | Reports / analytics | Bookings, payments, expenses, occupancy, visitors | Each dashboard metric has a drill-down or testable source. Cross-check sample totals manually. | [ ] |
| P1 | Billing subscription | Plan entitlement, invoices, payment provider, email, Super Admin billing | Successful subscription updates plan once. Failed/cancelled subscription removes access only at the intended time. | [ ] |
| P1 | Shareholders | Ownership allocation, invite, profile, payout history, net-profit estimate | Total accepted + pending ownership never exceeds 100%. Payouts are owner-only and shareholder sees only their own data. | [ ] |

## H. Public website, discovery and direct booking

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | Website editor / theme | Tenant public page, custom domain/subdomain, SEO preview | Published changes appear on the correct tenant site and never leak another tenant’s branding. | [ ] |
| P0 | Public availability and checkout | Rooms, rates, offers, payment, booking, guest email | A public guest can search, select dates, pay, receive confirmation, and see the booking in the owner dashboard. | [ ] |
| P0 | Public payment callbacks | Booking status, payment, invoice, email, retry/cancel pages | Success, cancel and verification routes do not leave an ambiguous or duplicate booking. | [ ] |
| P1 | Custom domain | DNS verification, SSL status, public site, admin domain view | Domain status is accurate; wrong/unverified domain does not show another resort’s content. | [ ] |
| P1 | Resort discovery | Featured settings, search, map, public resort page, analytics | Toggle featured/discovery data in admin; confirm it appears or disappears in public discovery accurately. | [ ] |
| P2 | Embed booking widget / public table QR | Website/embed host, availability, booking/order creation | Embedded action creates data in the same tenant and retains source attribution. | [ ] |

## I. Super Admin control plane

| Priority | Start here | Must update / appear in | What to verify | Result |
| --- | --- | --- | --- | --- |
| P0 | Tenants | User access, plan, feature flags, billing, custom domain, login-as | Admin changes take effect in tenant app without exposing control to non-admins. Test plan changes and suspend/reactivate. | [ ] |
| P0 | Admin login-as | Target tenant, audit log, exit back to admin | Impersonation is visibly labelled, writes an audit event, and cannot cross into a different tenant unexpectedly. | [ ] |
| P1 | Billing & MRR | Tenant subscriptions, payment events, invoices, revenue summary | Admin totals equal the sum of tenant subscriptions and recorded provider events. | [ ] |
| P1 | Theme management | Tenant theme selector, public site, preview, stored configuration | Every theme thumbnail/preview matches the applied theme. Publishing persists after refresh. | [ ] |
| P1 | Domains, health, storage | Tenant settings, upload files, SSL, system metrics | Admin status is generated from real data and action buttons produce observable results. | [ ] |
| P1 | Referrals, demo leads, design requests | Public forms, tenant records, admin workflow | Each public submission appears once with correct source and follow-up status. | [ ] |
| P1 | GDPR, audit log, export | Tenant data, authorization, download, delete/restore policies | Export contains only target tenant data. GDPR request is auditable and confirmation prevents accidental deletion. | [ ] |
| P2 | Announcements and team | Owner dashboard notifications, admin roles | Announcement targeting, read status and admin team permissions behave as configured. | [ ] |

## J. Shared reliability checks

Run these while testing every P0/P1 flow.

| Check | Expected result | Result |
| --- | --- | --- |
| Refresh after save | Persisted data reloads correctly; no optimistic-only UI state. | [ ] |
| Duplicate click / slow network | One booking, payment, invite or order is created. | [ ] |
| Browser console / failed API response | No silent 4xx/5xx background requests for the signed-in role. | [ ] |
| Role test | UI and API give the same permission decision. | [ ] |
| Tenant isolation test | Different tenant cannot read or mutate the record by guessed ID/URL. | [ ] |
| Mobile viewport | Core action, modal footer and file upload stay reachable. | [ ] |
| Dark mode | Text, charts, inputs and modals remain readable. | [ ] |
| Error copy | User sees what failed, whether data was saved, and the next action. | [ ] |
| Audit/notification | Material actions are logged/notified where the product promises it. | [ ] |

## Recommended fixing order

### Phase 1 — Make reservations trustworthy

1. Complete the booking-document visibility fix.
2. Consolidate the two Walk-in flows.
3. Test booking → payment → check-in → checkout → housekeeping → invoice.
4. Test cancellation, refund, no-show and conflict prevention.

### Phase 2 — Make money and reporting trustworthy

1. Reconcile booking totals, payment totals, invoices and revenue.
2. Reconcile expenses, profit, analytics and shareholder estimates.
3. Verify plan limits and subscription changes at the API and UI levels.

### Phase 3 — Make direct sales trustworthy

1. Test public availability through payment confirmation.
2. Test tenant website, custom domain and email/SMS notifications.
3. Test offers, CRM, loyalty and referrals against a real completed booking.

### Phase 4 — Make operations and administration trustworthy

1. Housekeeping, maintenance, restaurant and inventory chains.
2. Super Admin tenant controls, audit log, exports, domains and GDPR.
3. Role, tenant-isolation, mobile and error-path regression pass.

## Definition of done for each item

An item can be marked done only when:

- Its screen and API both enforce the same permission.
- Its created data appears in every required downstream screen.
- It remains correct after refresh.
- Failure and retry do not create duplicate data.
- Another tenant cannot access it.
- The documented test path is recorded as `PASS`.

# Dashboard Overview Deep QA

**Date:** 2026-09-09  
**Batch:** Sidebar 1 of 7 — Overview  
**Routes:** `/dashboard`, `/dashboard/analytics`, `/dashboard/invoices`, `/dashboard/expenses`, `/dashboard/reports`  
**Verdict:** Passed core read workflows; major reliability and false-success risks remain.

## Coverage

- Loaded every Overview route as Resort Owner.
- Captured API failures, browser console failures, request failures, headings, controls, blank states, accessibility names, and page-level overflow.
- Tested the Dashboard New Booking modal without submitting.
- Tested invoice search, status filters, and New Invoice navigation.
- Tested Add Expense modal validation without creating data.
- Tested Daily Report date navigation, email form visibility, and Print control without sending a message.
- Captured sidebar visibility for Owner, Manager, Shareholder, Receptionist, Marketer, Developer, Staff, and Chef.

## Results

| Page | HTTP/API | Responsive | Interaction result | Verdict |
|---|---|---|---|---|
| Dashboard | 200; 12 API calls, no API errors | No desktop overflow | New Booking dialog opened; daily quick links present | Passed |
| Analytics | 200; 11 API calls, no API errors | No desktop overflow | KPI and chart datasets rendered | Passed with data-presentation caveat |
| Invoices | 200; filter requests succeeded | No desktop overflow | Search empty state and status filters worked | Retest New Invoice navigation |
| Expenses | 200; 10 API calls, no API errors | No desktop overflow | Add modal opened; blank submission showed required-field error | Passed with accessibility gaps |
| Daily Reports | 200; 9 API calls, no API errors | No desktop overflow | Previous date, Today, Email form, and Print controls worked | Passed with delivery caveat |

## Findings

### Major — report email can claim success when email is disabled

The Daily Report email endpoint awaits the shared email helper but ignores its returned delivery error. In an environment without a configured Resend key, the helper returns `email_disabled`; the route can still return `{sent: true}` and the UI displays “Report emailed.” This matches the false-success pattern found in Settings Test Email.

**Evidence:** `apps/api/src/routes/reports.ts`, daily email handler; `apps/api/src/services/email.ts`, `sendEmail` disabled result.

### Resolved retest — New Invoice navigation works

An isolated retest with an explicit URL wait confirmed that the button reaches `/dashboard/invoices/new` and renders the New Invoice, Guest Information, Invoice Settings, and Notes sections. The earlier aborted RSC request was caused by the first audit moving to the next route before navigation completed; it is not a confirmed product defect.

### Minor — five missing navigation translations generate repeated console errors

Every Overview page logged missing English translations for:

- `common.nav.venues`
- `common.nav.corporateAccounts`
- `common.nav.vehicles`
- `common.nav.assets`
- `common.nav.shareholders`

The English fallback labels render, so navigation remains usable, but the repeated errors pollute monitoring and conceal new client failures.

### Minor — Overview accessibility gaps

- Invoice search has no programmatically associated label.
- Expenses exposed two unnamed icon buttons and one unlabelled filter field.
- Daily Reports exposed three unnamed icon/toggle buttons and two unlabelled fields.

### Observation — analytics occupancy axis rendered a `110%` tick

The Analytics occupancy chart body exposed a `110%` axis label even though the configured Y-axis domain is `[0, 100]`. Confirm visually at multiple data ranges before classifying severity.

## Sidebar inventory baseline

The Owner demo currently exposes **36 dashboard destinations** across seven collapsible groups plus the daily tier.

| Role | Visible destinations |
|---|---:|
| Owner | 36 |
| Manager | 32 |
| Shareholder | 3 |
| Receptionist | 14 |
| Marketer | 10 |
| Developer | 4 |
| Staff | 2 |
| Chef | 2 |

Visibility is influenced by both role and plan/feature entitlement. This baseline will be compared with each route's API authorization during later batches.

## Safe-test statement

No booking, invoice, expense, message, or dispatch setting was created, changed, or deleted.

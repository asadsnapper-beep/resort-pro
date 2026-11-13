# ResortPro CRM Deep Functional QA

**Date:** 2026-10-07  
**Perspective:** Super Admin, resort owner/manager, marketer, operator, guest, QA, engineering, and business handoff  
**Decision:** **NO-GO for customer handoff**  
**Scope:** `/dashboard/crm`, CRM APIs, persistence, roles, campaign delivery state, consent, templates, sequences, automation, analytics, unsubscribe, and regression coverage

## Executive summary

The CRM is not merely unfinished UI; several core workflows are currently broken at runtime.

- Campaign draft creation and deletion work.
- Contact listing/detail, score recalculation, sequence creation, campaign scheduling storage, and CRM role restrictions work at API level.
- Templates and Analytics return HTTP 500.
- A sequence can be created but a step cannot be added, so a newly created automation cannot deliver anything.
- Tags can be created but cannot be assigned to a guest.
- The UI offers an Anniversary trigger that the API rejects, with no visible error.
- The demo has 10 contacts that the UI logic labels “Subscribed,” but zero have explicit subscribed consent; the campaign sender selects only explicit consent, so the apparent audience and actual recipients disagree.
- Campaigns are marked `SENT` even when every delivery fails. Open/click/bounce tracking fields exist, but no tracking/webhook route updates them.
- Scheduled campaigns can be stored as `SCHEDULED`, but the CRM worker contains no scheduled-campaign dispatcher.

These are customer-visible false-success and primary-workflow failures. CRM should not be presented as production-ready next week until the Critical and Major gates below are fixed and re-tested.

## Environment and safety controls

- Local demo tenant (`slug: demo`), local API and Next.js app on isolated ports.
- Real outbound email was disabled (`RESEND_API_KEY` not configured).
- No Campaign “Send Now” or Daily Automation action was executed.
- Test records used the `QA-CRM-*` prefix.
- Cleanup verified: `0` QA sequences, campaigns, templates, and tags remain.
- No customer data, credentials, access tokens, or secrets are included in this report.

## What was exercised

| Area | Checks | Result |
|---|---|---|
| Roles | OWNER, MANAGER, MARKETER allowed; RECEPTIONIST and STAFF denied | Pass |
| Contacts | List, detail, search/filter contract, score recalculation, consent state, pagination | Partial |
| Tags | Create, assign, verify, remove, delete | Fail at assignment |
| Campaigns | List, UI draft create, persistence, UI delete, scheduled record creation, delivery-state code review | Partial |
| Templates | List, UI create request, API update/delete contract | List fails (500) |
| Sequences | List, create, trigger validation, add step, pause/resume contract, worker wiring | Core configuration fails |
| Analytics | API, KPI rendering, campaign performance source | Fails (500) |
| Automation | Worker schedules, trigger enrollment, manual runner, consent, delivery handling | Major gaps |
| Guest compliance | Unsubscribe behavior and consent consistency | Risk found |
| Regression | API tests, web tests, TypeScript, CRM-specific test inventory | Coverage gap |

## Release-blocking findings

### CRM-001 — Critical — Templates tab is runtime-broken

`GET /api/crm/templates` returns HTTP 500. Prisma requires a list for the two-field ordering, but the route supplies one object:

- Route: `apps/api/src/routes/crm.ts:386`
- Runtime error: `Expected EmailTemplateOrderByWithRelationInput[], provided Object.`

Creating a template returns HTTP 200, then the tab cannot reload the list. To a customer this looks like Save succeeded and the template disappeared.

**Required gate:** list/create/edit/delete/default-template initialization must all pass through UI and API, with visible failure feedback.

### CRM-002 — Critical — Analytics tab always fails for tenant-scoped requests

`GET /api/crm/analytics` returns HTTP 500. The generic tenant wrapper injects `tenantId` into `CampaignStats`, but that model has no `tenantId` column.

- Faulting query: `apps/api/src/routes/crm.ts:818`
- Tenant injection: `packages/database/src/index.ts:50-127`
- Model without `tenantId`: `packages/database/prisma/schema.prisma:2258-2271`
- Runtime error: `Unknown argument tenantId`.

This blocks all KPI cards, campaign performance, top guests, and the Daily Automation control because the tab stops at “Failed to load analytics.”

**Required gate:** analytics returns 200 with tenant-isolated data, including empty-state and populated-state tests.

### CRM-003 — Critical — Newly created sequences cannot have steps

Sequence creation returns 200, but `POST /api/crm/sequences/:id/steps` returns 500. The tenant wrapper injects `tenantId` into `SequenceStep`, which has no such column.

- Faulting code: `apps/api/src/routes/crm.ts:584-587`
- Model: `packages/database/prisma/schema.prisma:2390-2406`
- Runtime error: `Unknown argument tenantId`.

A sequence without a step cannot send an email. The UI therefore advertises an automation builder whose essential operation is broken.

**Required gate:** create sequence → add multiple steps → pause/resume → enroll QA guest → worker records each due send exactly once.

### CRM-004 — Critical — Visible “Subscribed” audience and actual campaign audience disagree

Live demo evidence:

- Total contacts: `10`
- Explicitly subscribed consent rows: `0`
- Contacts without a consent row: `10`

The UI treats missing consent as subscribed (`consent?.subscribed !== false`), while Campaign Send selects only `consent: { subscribed: true }`.

- UI logic: `apps/web/src/app/(dashboard)/dashboard/crm/page.tsx:206`
- Send filter: `apps/api/src/routes/crm.ts:480-487`

An owner can see ten “Subscribed” contacts, send to “all subscribed guests,” and reach zero recipients. This is a business-critical false audience.

**Required gate:** define one consent policy, backfill/initialize consent deterministically, and use the same rule in Contacts, Analytics, sequences, daily automation, and campaigns.

### CRM-005 — Critical — Campaign status can report success when delivery failed

The sender records individual failures, but then unconditionally changes the campaign to `SENT` and sets `sentAt`, even when `sent === 0`.

- Per-recipient failure: `apps/api/src/routes/crm.ts:510-521`
- Unconditional `SENT`: `apps/api/src/routes/crm.ts:524-527`

There is no `FAILED`/`PARTIAL` campaign outcome or retry workflow. This can make a marketer believe a campaign went out when no guest received it.

**Required gate:** use accurate terminal states, expose failures, prevent misleading success alerts, and add retry/idempotency tests.

## Major findings

### CRM-006 — Tags are partially fake from an operator perspective

Tag creation works, but assigning a tag returns 500 because tenant scoping injects `tenantId` into `GuestTagRelation`, which has no tenant column.

- Route: `apps/api/src/routes/crm.ts:360-378`
- Runtime error: `Unknown argument tenantId`.
- The CRM page has no tag management or assignment UI despite exposing tag chips.

### CRM-007 — Anniversary automation is offered by UI but rejected by API

The UI selector includes `ANNIVERSARY`; the Prisma enum also includes it. The API validator omits it and returns 400. The UI catches and ignores that failure, showing no actionable message.

- UI option: `apps/web/src/app/(dashboard)/dashboard/crm/page.tsx:61-70`
- API enum missing Anniversary: `apps/api/src/routes/crm.ts:549-553`
- Silent catch: `apps/web/src/app/(dashboard)/dashboard/crm/page.tsx:466-472`

### CRM-008 — Open/click/delivery/bounce analytics are not wired to real events

The schema contains `openedAt`, delivery/bounce fields, `EmailClick`, and campaign aggregate counters, but application search found no open pixel route, click redirect route, or Resend webhook handler updating these CRM records. The campaign sender only updates `stats.sent`.

Existing non-zero demo metrics are seeded data, not proof that live tracking works.

### CRM-009 — Scheduled CRM campaigns have no dispatcher

The API accepts `scheduledAt` and stores `SCHEDULED`, but the CRM automation worker only processes sequence enrollments and PRE_ARRIVAL, POST_STAY, BIRTHDAY, and WIN_BACK triggers. No job queries and sends due `Campaign` rows.

- Schedule storage: `apps/api/src/routes/crm.ts:442-465`
- Worker jobs: `apps/api/src/services/automation.ts:255-278`

The CRM UI also provides no scheduling control, segment builder, preview, recipient count, or test-send flow.

### CRM-010 — BOOKING_CONFIRMED and CHECK_IN triggers are not wired end-to-end

`enrollOnBookingConfirmed` exists but has no caller in the API codebase. `CHECK_IN` is selectable and accepted but has no enrollment processor. Therefore, activating these sequences does not make the named business event enroll guests.

- Uncalled helper: `apps/api/src/services/automation.ts:281-303`
- Worker trigger list: `apps/api/src/services/automation.ts:265-273`

### CRM-011 — Daily Automation is risky and not operationally controlled

After Analytics is fixed, “Run Now” can immediately send birthday and anniversary email without a recipient preview or confirmation dialog. Birthday logic is split across two incompatible sources:

- Daily runner uses `Guest.dateOfBirth` and sends on the birthday.
- Sequence worker searches guest notes for `birthday:MM-DD` and enrolls three days ahead.

This creates inconsistent eligibility and potential duplicate outreach.

### CRM-012 — Error handling makes backend failures look like empty data

Contacts, Campaigns, Sequences, and Templates commonly use empty `catch {}` blocks. Backend failures can render an empty list or leave a form open without explaining what happened. This was reproduced for the Anniversary trigger.

Customer handoff requires inline error states, retry actions, and success confirmation based on persisted reload—not only HTTP 200 from a create request.

### CRM-013 — Unsubscribe mutates state through an unsigned GET link

`GET /crm/unsubscribe/:guestId` immediately opts out a guest and cancels active enrollments. Email security scanners and link preview bots often visit links automatically; a state-changing GET can therefore unsubscribe guests without deliberate confirmation. The URL also uses a raw guest ID rather than a signed, expiring token.

- Route: `apps/api/src/routes/crm.ts:841-866`

### CRM-014 — No maintained CRM regression tests

Repository search found no CRM/campaign/sequence/tag/template unit, integration, or E2E tests. The current failures therefore pass CI unnoticed.

## Minor/product-completeness gaps

### CRM-015 — Contacts stop at 20 with no pagination UI

The API supports pages, but the UI hardcodes `limit=20` and renders no Next/Previous/page control. Resorts with more than 20 guests cannot browse the rest from CRM.

### CRM-016 — Important implemented APIs are unreachable from the UI

The API has contact detail/history, tag CRUD, template edit, segment filters, scheduled campaigns, and manual sequence enrollment. The CRM UI exposes none of these. Template defaults can also be deleted; there is no protection or restore control.

### CRM-017 — Destructive/no-op endpoints return false success

Several `deleteMany`/`updateMany` routes do not inspect `count`. A nonexistent template/tag, a non-draft campaign, or a nonexistent sequence update can return a success message even though nothing changed.

## Passed evidence

- OWNER, MANAGER, and MARKETER received CRM API access.
- RECEPTIONIST and STAFF correctly received HTTP 403.
- Contact list and contact detail returned 200.
- Score recalculation persisted deterministically (`79 → 79` for the tested guest).
- Campaign list returned 200.
- Campaign UI draft create, persisted reload, and delete passed.
- Scheduled campaign creation stored `SCHEDULED` and a future timestamp.
- Sequence list and base sequence creation returned 200.
- TypeScript check: pass.
- Web unit command: pass only because no test files exist.

## Regression suite result

| Command | Result |
|---|---|
| `pnpm --filter @resort-pro/api lint` | Pass |
| `pnpm --filter @resort-pro/api test` | **Fail:** 211 passed, 2 timed out, 213 total |
| `pnpm --filter @resort-pro/web test` | Exit 0, but no test files found |
| CRM-specific test inventory | None found |

The two API failures were checkout-finalisation timeouts, not CRM assertions. They still mean the release-candidate regression gate is not green.

## Minimum release gate for next-week handoff

1. Fix CRM-001 through CRM-005 and re-run with a real test email provider/sandbox inbox.
2. Fix the tenant-scoping architecture for relation models without `tenantId`; add cross-tenant tests rather than bypassing isolation ad hoc.
3. Make sequence step creation, actual enrollment, worker delivery, dedupe, pause, resume, unsubscribe, and completion pass end-to-end.
4. Implement real campaign scheduling and delivery/open/click/bounce/unsubscribe event ingestion, or remove those claims/KPIs for launch.
5. Add recipient preview, test send, confirmation, partial/failed states, and retry/idempotency.
6. Unify consent semantics and backfill existing guests safely.
7. Add pagination and visible error/retry states.
8. Add maintained CRM API + browser regression tests and require them in CI.
9. Re-run the full release-candidate suite; all Critical/Major CRM findings and unrelated regression failures must be green.

## Final verdict

**NO-GO.** The CRM navigation and cards look substantial, and campaign draft CRUD works, but Templates, Analytics, tag assignment, and sequence-step configuration are broken; delivery states and audience counts can be misleading; scheduling and engagement tracking are not operational. This should not be handed to customers as a working CRM until the release gates above pass.

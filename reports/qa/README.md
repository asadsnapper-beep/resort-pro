# ResortPro QA Reports

This directory is the permanent archive for quality-assurance reports produced for ResortPro.

## Reports

| Date | Report | Scope | Overall result |
|---|---|---|---|
| 2026-09-08 | [Full project QA audit](./2026-09-08-full-project-qa.md) | API, build, routes, E2E, UI, accessibility, SEO, security | Core system healthy; release blockers remain |
| 2026-09-09 | [Settings deep QA audit](./2026-09-09-settings-deep-qa.md) | Every Settings tab, persistence, roles, integrations, desktop/mobile | Not production-ready |
| 2026-09-09 | [Dashboard Overview deep QA](./2026-09-09-dashboard-overview-deep-qa.md) | Sidebar inventory plus Dashboard, Analytics, Invoices, Expenses, Reports | Passed with major gaps |
| 2026-09-09 | [Dashboard sidebar comprehensive QA](./2026-09-09-dashboard-sidebar-comprehensive-qa.md) | All desktop/mobile sidebar destinations, groups, roles, authorization, core interactions | Navigation passed; critical authorization issue found |
| 2026-09-29 | [Super Admin release-readiness review](./2026-09-29-super-admin-release-readiness.md) | Admin control plane, RBAC, security, auditability, deployment, mobile, automated checks, next-week handoff | **NO-GO:** two Critical blockers plus Major control gaps |
| 2026-09-30 | [Full release-candidate QA audit](./2026-09-30-full-release-candidate-qa.md) | Super Admin, resort roles, guest flow, business integrity, security, accessibility, performance, build and operations | **NO-GO:** core works, but Critical security and production-readiness gates remain |
| 2026-10-07 | [CRM deep functional QA](./2026-10-07-crm-deep-functional-qa.md) | Contacts, tags, campaigns, templates, sequences, automation, analytics, consent, roles, and persistence | **NO-GO:** multiple core workflows return 500 or report false success |
| 2026-10-08 | [CRM remediation verification](./2026-10-08-crm-remediation-verification.md) | First blocker-fix batch, CRM API integration, booking events, browser and persistence retest | Core runtime failures fixed; **NO-GO remains** for delivery/tracking/compliance gaps |
| 2026-10-28 | [Website Builder deep functional QA](./2026-10-28-website-builder-deep-functional-qa.md) | All builder controls, themes, preview, publish/persistence, public site, roles, uploads, domain/SSL, mobile, and conversion paths | **NO-GO as a complete builder:** core works, but visible no-effect controls and preview/publish/domain gaps remain |
| ongoing | [Website Builder remediation progress](./website-builder-remediation-progress.md) | Live record of which builder findings are fixed, with files, tests and verification | 3 of 8 P0 gates closed; **NO-GO remains** |
| 2026-10-28 | [Room Management deep QA](./2026-10-28-room-management-deep-qa.md) | Room CRUD, property assignment, status lifecycle, availability, maintenance/housekeeping consistency, roles, concurrency, tenant isolation, mobile | **NO-GO for customer handoff:** an occupied room can be made saleable, and a selected property was silently discarded |

## What has been fixed since

The reports themselves are never edited — they are a record of what was true on
their date. So the only way to know whether a finding still stands is this list
and the git history.

| Finding | Report | Fixed |
|---|---|---|
| Billing APIs accepted any authenticated role | Sidebar comprehensive QA, Critical | ✅ 2026-09-12 — owner-only on invoices/portal/checkout; `/status` left open on purpose, because the dashboard's suspension gate depends on it |
| C-03 / M-02 and the Overview report-email finding — SMS, WhatsApp, email and report-email reported sends that never happened; the six notification switches were stored and nothing read them | Settings deep QA, Critical/Major | ✅ 2026-09-14. Test buttons send for real and pass the provider's refusal through (`services/messaging.ts`). Booking confirmation now reaches the guest by SMS/WhatsApp per the resort's switches, once per booking even when two payment callbacks fire, with a delivery log (`guest_notifications`). The platform allowance is enforced at send time and actually resets monthly. Still open: the other five events (payment received, reminders, cancellation, invoice), and WhatsApp templates — Meta refuses free text outside its 24-hour window |
| C-05 — update responses could expose tenant secrets | Settings deep QA, Critical | ✅ 2026-09-12 — safe selects on the tenant and Discovery PATCHes; the guard test derives forbidden names from schema.prisma so a new secret is covered automatically |
| C-01 — an unrelated save could erase city and country | Settings deep QA, Critical | ✅ 2026-09-12, and the finding was **understated**. There is no `city` column anywhere in the datamodel, and the update schema accepted one — so General/Contact/Operations returned **500 on every save**, rather than succeeding and erasing data as the report inferred from reading the code. `city` is gone from the schema and the form; `country` is real, is now returned by the read, and is covered by a regression test |
| C-02 — URL Slug reported success but never changed | Settings deep QA, Critical | ✅ 2026-09-13 — read-only was the founder's call. The field displays the URL and is no longer submitted; the API refuses a *different* slug with `SLUG_IMMUTABLE` while accepting an identical one, so an older cached bundle does not lose the ability to save |
| M-01 — SMS and WhatsApp trigger checkboxes were the same field | Settings deep QA, Major | ✅ 2026-09-14 — WhatsApp has its own six fields; the migration copied each tenant's visible values across |
| C-04 — embed script and WordPress plugin returned 404 | Settings deep QA, Critical | ✅ 2026-09-14, and the finding was **understated**: publishing the files alone would not have made the widget work. CORS refused every resort's own domain; the stylesheet was never injected; food orders posted to a route that does not exist; bKash, SSL and Stripe called endpoints that do not exist, and Stripe showed success without charging; "Pay at Hotel" announced a confirmed booking the worker would cancel. All fixed; payment now hands over to the hosted checkout. The web build writes `embed.js` and the plugin zip into `public/`, verified live on staging (200, new bundle, cross-origin preflight answered, private routes still refused) |

| CRM-001/002/003/006 — Templates, Analytics, sequence steps and tag assignment returned 500 | CRM deep QA, Critical | ✅ 2026-10-08 — three broken screens had one cause: relation tables reached without validating their tenant-owned parent |
| CRM-004/005 — a campaign reported SENT when nobody received it, and missing consent was drawn as subscribed | CRM deep QA, Critical | ✅ 2026-10-08 — `PARTIAL` and `FAILED` states, zero-recipient sends refused, `No consent` shown honestly |
| CRM-009 — scheduled campaigns were stored and never dispatched | CRM deep QA, Major | ✅ 2026-10-08 — `dispatchScheduledCampaigns()` runs on the automation cadence |
| CRM-013 — unsubscribe was an unsigned state-changing GET | CRM deep QA, Major | ✅ 2026-10-08 — signed token, confirmation on GET, the change on POST |
| CRM-016 — tags, contact detail, template editing, campaign audience and manual enrolment had no UI | CRM deep QA, Major | ✅ 2026-10-17 |
| CRM-008 — the Open Rate and Click Rate were arithmetic on columns nothing writes | CRM deep QA, Critical | ◐ Partly. The claim is gone from the page and the demo no longer seeds 87 opens on 142 sends. Tracking itself — open pixel, click redirect, provider webhook — still does not exist |
| CRM-014 — no CRM regression tests | CRM deep QA, Major | ✅ 2026-10-28 — ten API integration suites, plus `crm.spec.ts` in CI on Desktop Chrome and Mobile Safari |

| WB-001 — the builder offered sections the chosen theme does not render | Website Builder QA, Critical | ✅ 2026-10-28 — one capability list per theme, living with the theme; what a theme cannot draw is named rather than hidden |
| WB-005 — an unknown theme key could be stored, and the site silently fell back | Website Builder QA, Major | ✅ 2026-10-28 — refused when it is a change; a tenant already on a stale key can still save everything else |
| WB-006 — section arrays took unknown and duplicated ids | Website Builder QA, Major | ✅ 2026-10-28 — cleaned on the way in, and the renderer dedupes as a second line |
| WB-009 — required fields, complete testimonials, the gallery cap and the WhatsApp number were enforced only by the form | Website Builder QA, Major | ✅ 2026-10-28 — all four hold on the server now |
| WB-002 — "live immediately" was false; the site cached for a minute and its analytics for an hour | Website Builder QA, Critical | ✅ 2026-10-28 — the content is no longer cached, so a publish is live on the next page view; the public read is counted per resort so the fleet does not share one ceiling |
| WB-003 — the live preview could miss the editor's update entirely | Website Builder QA, Major | ✅ 2026-10-28 — the frame announces itself and the editor answers, so neither has to load first; it also stopped applying updates from senders that are not the editor |
| An unreleased theme's full config was readable by anyone with the key | Found 2026-10-29 while reproducing WB-004, Major | ✅ 2026-10-29 — unpublished themes need a short-lived signature the API mints; the admin's own Preview link carries one, so nothing an admin does was taken away |
| WB-007 — the builder showed controls the role may not use | Website Builder QA, Major | ✅ 2026-10-29 — the builder offers what the signed-in role can actually do |
| WB-004 — `?preview=` set the theme key and threw the config away, so every uploaded, AI-generated or Tier 2 theme previewed as luxe | Website Builder QA, Major | ✅ 2026-10-30 — the previewed theme is looked up and rendered; two preview URLs were byte-for-byte identical before |
| WB-001, the other half — the fix covered the four hardcoded themes only, so every uploaded and AI-generated theme still offered Amenities, which no `ConfigAmenities` component exists to draw | Website Builder QA, Critical | ✅ 2026-10-30 — the capability list comes from the theme's *kind* for config themes, exported by the renderer that draws them |
| WB-008 — no customer domain was routed in production, the advertised `/api/tenant/domain/ssl-webhook` never existed as a route, and `sslStatus` was only ever what an administrator last asserted | Website Builder QA, Major | ◐ Code complete 2026-10-30 — Cloudflare for SaaS issues the certificate, a Traefik catch-all router accepts a foreign Host, the phantom webhook is gone, and "live" now means a real TLS handshake. Two server-side steps remain and are not in git: the router labels in `/opt/resortpro`'s compose, and the Cloudflare credentials. Untested end to end against a domain somebody owns |
| A verified custom domain could be repointed at a private address and the status page would report what answered on 443 | Found 2026-10-30 while reviewing WB-008's fix, Major | ✅ 2026-10-30 — the probe reuses `isPrivateAddress` from the calendar-feed guard and connects to the address it checked |
| RM-002 — the Add/Edit Room property selector reported success and saved nothing | Room Management QA, Critical | ✅ 2026-10-31 — `propertyId` is declared, validated against the tenant's own active properties, and returned; the selector only ever appeared for multi-property customers, so they were the only ones it failed for |
| RM-001 — a room with a guest inside it could be marked Available and sold again | Room Management QA, Critical | ✅ 2026-10-31 — while a booking on the room is `CHECKED_IN` the status endpoint accepts only `OCCUPIED`, and the refusal names the guest and the booking rather than failing blankly. The same work found a second defect the report had not: check-in wrote the booking, the room and the deposit as three unordered statements, so a status change landing between them left a room Available with a guest in it. Two of the race defences are reasoned, not measured — see the test file |
| RM-003 — availability offered rooms the resort could not hand over | Room Management QA, Major | ✅ 2026-11-01 — one rule in `utils/room-saleability.ts`, shared by the dashboard and the public site: **status decides today, bookings decide the calendar.** A `CLEANING` / `OCCUPIED` / `RESERVED` room is withheld from a stay starting today and offered from tomorrow. Requiring `AVAILABLE` outright would have been worse than the bug: a group booking stamps `RESERVED` *and* writes real booking rows, so a blanket rule would have taken that room off sale on every other date too |
| RM-006 — the availability date contract accepted impossible ranges | Room Management QA, Major | ✅ 2026-11-01 — one validator, `utils/stay-dates.ts`, behind both availability endpoints and both booking-creation routes; refusals carry `STAY_DATES_REQUIRED` / `STAY_DATE_INVALID` / `STAY_DATES_REVERSED`. The finding was **understated**: text that is not a date reached Prisma as an `Invalid Date` and came back a **500**, and the booking routes' `YYYY-MM-DD` regex checks only the shape — `new Date("2026-02-31")` is the 3rd of March, so a guest asking for the 31st of February was written a real booking on a date nobody chose. Past dates are still accepted on purpose; the desk registers guests who arrived last night |
| RM-007 — concurrent duplicate room creation leaked a 500 | Room Management QA, Major | ◐ 2026-11-01 — the uniqueness race is closed: `@@unique([tenantId, number])` stays, and both create *and* rename now translate its P2002 into the same 409 with `ROOM_NUMBER_TAKEN`, so which of the two checks caught a request is no longer visible to the caller. Four simultaneous creates answered `201, 500, 500, 500` and now answer `201, 409, 409, 409`. **Still open:** the plan-limit race the report also asks about — two creates can pass the room-ceiling check together, and no database constraint exists to catch that one, so it needs a counted transaction rather than this pattern. Idempotency keys were not added |

Everything else below is, as far as anyone has checked, still open. In
particular the Settings audit's "not production-ready" verdict has not been
retested.

## Shipped since the last report, and never QA'd

No report in this directory has looked at any of these. They have unit and
integration tests and mutation-tested guards, which is not the same thing as
somebody using them.

| Surface | Where |
|---|---|
| Resort dropdown in the sidebar and the phone's More sheet | `ResortSwitcher` |
| 360 view of every connected resort | `/dashboard/resorts` |
| Answering a request to connect this resort | `/resort-link/[token]`, and the dashboard banner |
| Connections: change the level, end it, read the history | Settings → Your Resorts |
| Opening another resort, and the 10% group price | Settings → Your Resorts → Open another resort |
| Who else can see a resort | Admin → Tenants → (one tenant) |

Staging walkthrough to run first:
[../../plan/fixes/verify-multi-resort-staging.md](../../plan/fixes/verify-multi-resort-staging.md).

## Severity scale

| Severity | Meaning |
|---|---|
| Critical | Data loss, false-success behavior, security exposure, or a primary feature that cannot work |
| Major | Important workflow, authorization, persistence, or customer-experience failure |
| Minor | Accessibility, content, warning, or polish issue with a workaround |
| Passed | Tested behavior worked as expected |

## Archive rules

- Use `YYYY-MM-DD-short-scope.md` for new reports.
- Record the environment, commands, coverage, findings, evidence, and limitations.
- Never include passwords, API keys, access tokens, or unmasked customer information.
- Keep temporary automation scripts outside this directory unless they become maintained regression tests.
- When a finding is fixed, retain the original report and add the verification result to a newer report.

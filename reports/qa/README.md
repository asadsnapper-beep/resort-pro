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

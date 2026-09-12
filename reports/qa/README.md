# ResortPro QA Reports

This directory is the permanent archive for quality-assurance reports produced for ResortPro.

## Reports

| Date | Report | Scope | Overall result |
|---|---|---|---|
| 2026-09-08 | [Full project QA audit](./2026-09-08-full-project-qa.md) | API, build, routes, E2E, UI, accessibility, SEO, security | Core system healthy; release blockers remain |
| 2026-09-09 | [Settings deep QA audit](./2026-09-09-settings-deep-qa.md) | Every Settings tab, persistence, roles, integrations, desktop/mobile | Not production-ready |
| 2026-09-09 | [Dashboard Overview deep QA](./2026-09-09-dashboard-overview-deep-qa.md) | Sidebar inventory plus Dashboard, Analytics, Invoices, Expenses, Reports | Passed with major gaps |
| 2026-09-09 | [Dashboard sidebar comprehensive QA](./2026-09-09-dashboard-sidebar-comprehensive-qa.md) | All desktop/mobile sidebar destinations, groups, roles, authorization, core interactions | Navigation passed; critical authorization issue found |

## What has been fixed since

The reports themselves are never edited — they are a record of what was true on
their date. So the only way to know whether a finding still stands is this list
and the git history.

| Finding | Report | Fixed |
|---|---|---|
| Billing APIs accepted any authenticated role | Sidebar comprehensive QA, Critical | ✅ 2026-09-12 — owner-only on invoices/portal/checkout; `/status` left open on purpose, because the dashboard's suspension gate depends on it |
| C-03 / M-02 and the Overview report-email finding — SMS, WhatsApp, email and report-email reported sends that never happened | Settings deep QA, Critical/Major | 🟡 2026-09-12 — the four endpoints are honest now (503 unconfigured, 502 rejected, 501 unbuilt). The other half of C-03 is untouched: the six notification trigger fields are still stored with nothing reading them, so guests receive nothing |
| C-05 — update responses could expose tenant secrets | Settings deep QA, Critical | ✅ 2026-09-12 — safe selects on the tenant and Discovery PATCHes; the guard test derives forbidden names from schema.prisma so a new secret is covered automatically |
| C-01 — an unrelated save could erase city and country | Settings deep QA, Critical | ✅ 2026-09-12 — both fields are returned by the read, so the form stops hydrating them blank; regression test covers the exact load-then-submit sequence |

Everything else below is, as far as anyone has checked, still open. In
particular the Settings audit's "not production-ready" verdict has not been
retested.

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

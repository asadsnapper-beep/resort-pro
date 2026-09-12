# ResortPro Settings Deep QA Audit

**Date:** 2026-09-09  
**Audience:** Engineering, QA, product, operations, marketing, and resort owners  
**Scope:** All 12 Settings tabs, API wiring, persistence, validation, role behavior, public integrations, accessibility, and desktop/mobile layout  
**Overall verdict:** **Not production-ready**

## Executive summary

All Settings tabs render, the owner can read the expected APIs, several configuration endpoints persist successfully, and the mobile layout does not introduce horizontal overflow. However, the audit found critical data-integrity, false-success, broken-integration, and secret-handling problems. Several controls appear functional but either do nothing, are placeholders, or cannot be used by roles that can see them.

## Coverage and evidence

| Check | Result |
|---|---|
| Desktop Settings tabs opened | **12 / 12** |
| Mobile Settings options opened at 390×844 | **12 / 12** |
| Mobile horizontal overflow | **None on all 12 tabs** |
| Owner Settings GET endpoints | **10 / 10 returned HTTP 200** |
| Safe idempotent saves | Email, notification configuration, room-type labels, and Discovery passed |
| Invalid custom domain | Correctly rejected with HTTP 400 |
| Clipboard copy | Copied the configured embed snippet |
| Public Discovery site | HTTP 200 |
| Public embed script | **HTTP 404** |
| Public WordPress plugin download | **HTTP 404** |
| Browser console | Repeated missing `common.nav.assets` translation error |

No real guest messages, real-money transactions, DNS changes, certificate requests, erasure requests, or account-deletion requests were performed.

## Critical findings

### C-01 — General/Contact/Operations save can erase location data

The Settings form expects `city` and `country`, but `GET /api/tenant` does not select or return them. After a reload, both fields become empty. The shared Save action sends the complete form, so saving an unrelated General, Contact, or Operations change can overwrite stored location values with empty strings.

The test tenant retained country `BD` in the payment configuration while the tenant Settings response omitted the country completely.

**Impact:** incorrect resort location, wrong regional payment-gateway selection, and silent data loss.

**Evidence:**

- `apps/api/src/routes/tenants.ts`, tenant select near line 43
- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, form hydration near line 142
- Shared update mutation near line 162

**Required fix:** return `city` and `country`, send only changed fields, and add a regression test proving an unrelated save preserves stored location.

### C-02 — URL Slug reports success but never changes

The UI presents URL Slug as editable, but the backend update schema does not accept `slug`. A safe API test requested `demo-qa-should-not-save`; the response returned HTTP 200 with “Settings updated,” while a subsequent GET still returned `demo`.

**Impact:** owners believe their public URL changed when it did not.

**Evidence:**

- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, slug form field near line 147
- `apps/api/src/routes/tenants.ts`, `updateTenantSchema` near line 10

**Required fix:** either implement validated, unique, audited slug changes or make the slug explicitly read-only.

### C-03 — SMS and WhatsApp test actions return false success

The SMS and WhatsApp test endpoints are placeholders. They return a successful `sent: true`/queued response for a supplied number without calling a delivery provider. The UI converts that response into “Test SMS sent” or “Test WhatsApp sent.”

The six automatic notification trigger fields are stored, but no booking, payment, check-in, checkout, cancellation, or invoice delivery code was found consuming them.

**Impact:** a resort may rely on guest notifications that are never delivered.

**Evidence:**

- `apps/api/src/routes/tenants.ts`, test endpoints near lines 662–681
- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, success toasts near line 2189

**Required fix:** return an honest unavailable status until providers are implemented, then add provider delivery IDs, failure states, logs, and end-to-end delivery tests.

### C-04 — Embed and WordPress installation links are broken

The Settings page generates these production URLs:

- `https://cdn.resortpro.site/embed.js` — HTTP 404
- `https://cdn.resortpro.site/resortpro-wp-plugin.zip` — HTTP 404

Clipboard copy itself works, but it copies a script that cannot load.

**Impact:** booking widgets shown as a monetisation feature cannot be installed; this directly harms conversion and customer trust.

**Evidence:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, embed constants near lines 1811–1863.

**Required fix:** publish versioned assets with correct content types and caching, then add a production URL smoke test.

### C-05 — API responses can expose tenant secrets

The main tenant PATCH and Discovery PATCH return the complete updated tenant record. The returned shape can contain SSO secrets, SMS keys, WhatsApp tokens, and legacy payment credentials. Dedicated read endpoints mask some of these values, but these update responses do not use a safe select.

**Impact:** secrets can appear in browser network logs, monitoring, proxies, or client-side error telemetry.

**Evidence:**

- `apps/api/src/routes/tenants.ts`, update response near line 241
- `apps/api/src/routes/discovery.ts`, update response near line 293

**Required fix:** use explicit safe response DTOs/selects everywhere and add tests asserting forbidden secret keys are absent.

## Major findings

### M-01 — SMS and WhatsApp trigger columns are not independent

The table visually provides separate SMS and WhatsApp checkboxes, but both columns read and write the same property. Browser verification started with `[true, true]`; clicking only the SMS checkbox produced `[false, false]`.

**Evidence:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, trigger checkboxes near lines 2469–2478.

### M-02 — Test Email can also show false success

In the tested environment, `RESEND_API_KEY` was not configured and outgoing mail was disabled. The email service returns `{id: null, error: 'email_disabled'}`, but the test-email caller does not inspect that result and returns `sent: true`.

**Evidence:**

- `apps/api/src/services/email.ts`, disabled result near line 86
- `apps/api/src/routes/tenants.ts`, test-email response near line 517

Automatic email toggle persistence and lifecycle call sites exist, but delivery health must be surfaced honestly.

### M-03 — Payment credential encryption claim is inaccurate

The UI says secrets are encrypted. The server currently stores credential data in the payment configuration and contains a production TODO for decryption rather than an implemented encryption/decryption flow.

**Impact:** security expectation and marketing language do not match the implementation.

**Evidence:**

- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, payment information banner near line 1188
- `apps/api/src/routes/payments.ts`, credential helper near line 47

### M-04 — “Enable Live” is not persisted immediately

Clicking the standalone Enable Live button changes local state and shows a warning toast, but it does not save. Unless the owner subsequently saves manual instructions or a gateway, reload restores the earlier server state.

**Required fix:** make it an explicit save flow or clearly show unsaved state with confirmation.

### M-05 — SSL provisioning is a status placeholder

The owner action sets `sslStatus` to `provisioning`, but does not call ACME, cert-manager, Caddy, or another certificate service. No automatic completion webhook/background implementation was found; an administrator must set the status manually.

**Impact:** the UI promises certificates are usually issued within five minutes although issuance has not started.

**Evidence:** `apps/api/src/routes/tenants.ts`, SSL provisioning route near lines 165–199.

### M-06 — Role visibility and API authorization are inconsistent

Settings navigation is visible to Owner, Manager, and Developer. The page does not adapt individual tabs/actions to the current role:

- Manager can load most Settings data but sees owner-only General save, module toggle, payment save, domain mutation, and GDPR actions.
- Developer sees Settings navigation, but the core tenant, notification, module, domain, GDPR, and enterprise reads return HTTP 403.
- Several hidden-page read APIs use generic authentication and are readable by roles that do not receive Settings navigation, including email settings, payment configuration, room-type labels, and Discovery configuration.

**Evidence:** `apps/web/src/components/dashboard/sidebar.tsx`, Settings role list near line 150.

**Required fix:** define a capability matrix, enforce it consistently in UI and API, and test each role.

### M-07 — GDPR erasure and account deletion are confusing and risky

The page exposes two deletion mechanisms:

1. GDPR erasure with a stated 30-day grace period.
2. Permanent account deletion after administrator approval.

GDPR requested state is local-only and is not loaded on page refresh. Submitting erasure immediately sets the tenant inactive, which can take the public resort site offline and prevent a later login, despite the grace-period wording. Cancellation requires contacting support.

**Evidence:**

- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`, GDPR state near line 1323
- `apps/api/src/routes/tenants.ts`, erasure route near line 335

## Accessibility and UI findings

Across the default visible state of all tabs, the DOM inspection found approximately:

- **22 visible fields without a programmatically associated label**
- **19 icon-only buttons without an accessible name**

The most affected areas were General, Modules, Email, Payment Gateways, Embed, and Custom Domain.

The browser also logged `MISSING_MESSAGE: common.nav.assets` repeatedly for the English locale.

## Tab-by-tab verdict

| Settings area | Verdict | Summary |
|---|---|---|
| General | Critical | Slug no-op; city/country data-loss risk |
| Contact | Major | Fields exist, but shared save carries the location-loss risk |
| Operations | Major | API fields work, but shared save carries the same risk |
| Modules | Major | Owner persistence works; Manager sees an owner-only toggle |
| Room Type Names | Passed with accessibility issues | Safe idempotent save passed |
| Email | Major | Settings persist; delivery can report false success |
| SMS & WhatsApp | Critical | Delivery placeholders and coupled trigger columns |
| Payment Gateways | Major | Config reads work; encryption claim and Live-mode persistence are wrong |
| Embed & Widget | Critical | Production assets return 404 |
| Discovery Map | Major | Save works; authorization and secret-response concerns |
| Custom Domain | Major | Validation works; SSL provisioning is not implemented |
| Privacy & GDPR | Major | Export works; destructive flows are inconsistent and poorly hydrated |
| Enterprise | Passed with caveat | Read-only display works; request errors are silently treated as non-enterprise |

## What passed

- All 12 desktop tabs opened.
- All 12 mobile options rendered without page-level horizontal overflow at 390 px.
- Owner read endpoints returned HTTP 200.
- Email-setting persistence passed.
- Notification configuration persistence passed.
- Room-type label persistence passed.
- Discovery persistence passed.
- Custom-domain format validation rejected an invalid domain.
- Embed snippet clipboard copy worked.
- `https://stay.resortpro.site` returned HTTP 200.

## Recommended remediation order

1. Prevent city/country loss and resolve slug false-success behavior.
2. Remove false-success messaging for SMS, WhatsApp, and disabled email delivery.
3. Publish the embed assets or remove the unavailable installation UI.
4. Remove secrets from update responses and implement real credential encryption.
5. Make the role/capability model consistent across navigation, controls, and APIs.
6. Redesign the GDPR/deletion state machine and persist requested status visibly.
7. Implement real SSL provisioning or label it as administrator-assisted.
8. Repair accessible names, field labels, and missing translations.
9. Add Settings regression tests covering persistence, reload, authorization, and public assets.

## Test-data safety

- Only read operations and same-value/idempotent configuration writes were used.
- The slug test used an unsupported field and verified that it did not persist.
- Trigger coupling was tested in local UI state and restored without saving.
- No credentials were entered or modified.
- No module, payment, domain, notification enablement, erasure, or deletion state was changed.

## Related report

- [Full project QA audit — 2026-09-08](./2026-09-08-full-project-qa.md)


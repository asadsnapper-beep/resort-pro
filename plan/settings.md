# ResortPro — Settings System

## Overview

Settings page (`/dashboard/settings`) manages all resort-level configuration across 13 tabs grouped into 4 sections: Resort, Communications, Monetisation, and Advanced.

---

## Tab Overview

| Tab | What it controls |
|-----|-----------------|
| General | Resort name, slug, website URL, address/city/country |
| Contact | Email, phone |
| Operations | Check-in/out times, currency, timezone |
| Modules | Feature flags — enable/disable sidebar modules |
| Email | Confirmation, pre-arrival, checkout invoice, cancellation emails |
| SMS & WhatsApp | Gateway setup (platform vs BYOC), usage quota, notification triggers |
| Payment Gateways | bKash, Nagad, SSLCommerz, Stripe, Razorpay, manual payment |
| Embed & Widget | Script tags + HTML snippets for external website embedding |
| Discovery Map | stay.resortpro.site public listing configuration |
| Custom Domain | CNAME setup, DNS verification, SSL provisioning |
| Privacy & GDPR | Data export (Article 20), erasure request (Article 17) |
| Enterprise | SLA, SSO, white-label branding (ENTERPRISE plan only) |

---

## API Endpoints (`/api/tenant/...`)

```
GET  /                      → tenant settings
PATCH /                     → update general settings
PUT  /domain                → set/clear custom domain
POST /domain/verify         → DNS CNAME verification
POST /domain/provision-ssl  → request SSL certificate
GET  /domain/status         → domain + SSL status
GET  /flags                 → enabled feature flags
PATCH /flags/module         → owner toggles module flag
GET  /flags/modules         → list owner-controllable modules
GET  /email-settings        → email notification preferences
PATCH /email-settings       → update email preferences
POST /email-settings/test   → send test email
GET  /sms-settings          → SMS + WA config (keys masked)
PATCH /sms-settings         → toggle enable, notification triggers, language
PATCH /sms-credentials      → update SMS gateway credentials
PATCH /wa-credentials       → update WhatsApp gateway credentials
POST /sms-settings/test-sms → send test SMS
POST /sms-settings/test-whatsapp → send test WhatsApp
GET  /gdpr/export           → download JSON data export
POST /gdpr/request-erasure  → submit deletion request
GET  /enterprise            → enterprise profile
GET  /sla                   → SLA agreement
GET  /referrals             → referral stats + link
GET  /announcements         → active platform announcements
```

---

## Bug Fixes (June 2026)

### 1. ✅ `PATCH /api/tenant` — `email` and `website` empty string caused 400 validation error
**Problem:** `z.string().email().optional()` and `z.string().url().optional()` reject empty strings. When a user cleared their email or website field and hit Save, the API returned 400 (`Invalid email`). The fields could never be cleared via the UI.  
**Fix:** Changed both to `z.union([z.string().email()/url(), z.literal('')]).transform(v => v === '' ? undefined : v)`. Empty string is accepted and transformed to `undefined` (Prisma skips the field).

### 2. ✅ `PATCH /api/tenant` — `city` and `country` fields silently ignored
**Problem:** The frontend sends `city` and `country` in the PATCH body (from the location card), but `updateTenantSchema` didn't include these fields — they were stripped by Zod and never saved. The city/country never persisted.  
**Fix:** Added `city: z.string().optional()` and `country: z.string().optional()` to `updateTenantSchema`.

### 3. ✅ SMS/WA enable toggle — stale closure, old state sent to API
**Problem:** Both the SMS and WhatsApp enable/disable toggles did:
```tsx
setTriggers(p => ({ ...p, smsEnabled: v }));
triggerMut.mutate();
```
`setTriggers` is async — React queues the update but doesn't apply it synchronously. `triggerMut.mutate()` immediately calls `mutationFn: () => tenantApi.updateSmsSettings(triggers)` where `triggers` is the **old value** from the current render's closure. So toggling SMS on would visually check the switch but send `smsEnabled: false` to the API.  
**Fix:** Changed `mutationFn` to accept an explicit payload: `(payload?: typeof triggers) => tenantApi.updateSmsSettings(payload ?? triggers)`. All toggle calls now compute `newTriggers` first and pass it directly: `triggerMut.mutate(newTriggers)`.

### 4. ✅ SMS/WA usage quota — division by zero if `quotaMonthly` is 0
**Problem:** `Math.round((smsUsedThisMonth / smsQuotaMonthly) * 100)` — if `smsQuotaMonthly` is 0 (new tenant before quota is assigned), the result is `NaN`, causing the progress bar to render at 0% silently and `NaN%` to appear in the badge.  
**Fix:** Added guard: `d.smsQuotaMonthly > 0 ? ... : 0` (same for WA).

### 5. ✅ `removeDomain` used `window.confirm()` dialog
**Problem:** Inconsistent with the rest of the app — all other destructive actions use toast feedback without browser native dialogs.  
**Fix:** Removed `confirm()`, domain removal fires directly. User gets a toast confirmation after success.

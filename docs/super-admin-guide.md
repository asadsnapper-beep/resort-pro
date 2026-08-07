# ResortPro Super Admin Panel — Operator Guide

> **Who is this for?**
> The person or team who **runs the ResortPro platform itself** — managing hotel/resort clients (tenants), billing, subscriptions, support, and system health. This is not the resort owner's guide; this is the guide for the company behind ResortPro.

---

## Table of Contents

1. [Accessing the Admin Panel](#1-accessing-the-admin-panel)
2. [Admin Roles and Permissions](#2-admin-roles-and-permissions)
3. [Dashboard — Platform Overview](#3-dashboard--platform-overview)
4. [Tenant Management](#4-tenant-management)
   - [View all tenants](#41-view-all-tenants)
   - [Tenant detail page](#42-tenant-detail-page)
   - [Suspend or reactivate a tenant](#43-suspend-or-reactivate-a-tenant)
   - [Change a tenant's plan](#44-change-a-tenants-plan)
   - [Extend a trial](#45-extend-a-trial)
   - [Impersonate a tenant](#46-impersonate-a-tenant)
   - [Delete a tenant](#47-delete-a-tenant)
5. [Billing & Revenue](#5-billing--revenue)
   - [MRR and revenue overview](#51-mrr-and-revenue-overview)
   - [Revenue CSV export](#52-revenue-csv-export)
   - [Tenant billing detail](#53-tenant-billing-detail)
6. [User Management](#6-user-management)
7. [Admin Team](#7-admin-team)
8. [Themes Management](#8-themes-management)
9. [Platform Settings](#9-platform-settings)
10. [Announcements](#10-announcements)
11. [Referral Program](#11-referral-program)
12. [Custom Domains](#12-custom-domains)
13. [Enterprise Tenants](#13-enterprise-tenants)
14. [Feature Flags](#14-feature-flags)
15. [GDPR & Data Requests](#15-gdpr--data-requests)
16. [System Health](#16-system-health)
17. [Audit Log](#17-audit-log)
18. [Data Export](#18-data-export)
19. [Churn Risk](#19-churn-risk)
20. [Quick Reference — Who can do what](#20-quick-reference--who-can-do-what)

---

## 1. Accessing the Admin Panel

The admin panel is completely separate from the resort owner dashboard.

**URL:** `https://app.resortpro.app/admin`  
**Login:** Use your admin credentials (email + password)

> ⚠️ Admin accounts are **not** the same as tenant accounts. A tenant owner cannot log in to the admin panel, and admin accounts cannot log in to the tenant dashboard.

**After login**, you land on the **Admin Dashboard** at `/admin/dashboard`.

The sidebar shows all available sections. What you see depends on your role — see [Section 2](#2-admin-roles-and-permissions).

---

## 2. Admin Roles and Permissions

There are 4 admin roles. Every admin team member is assigned exactly one role.

| Role | Level | What they can do |
|------|-------|-----------------|
| **SUPER_ADMIN** | 4 — Highest | Everything — all sections, all actions, all destructive operations |
| **SUPPORT** | 3 | Read all tenant data, extend trials, view audit log, send announcements |
| **FINANCE** | 2 | Read all data, billing & revenue, CSV exports |
| **VIEWER** | 1 — Lowest | Read-only access to dashboard stats and tenant list |

**Permission breakdown by action:**

| Action | SUPER_ADMIN | SUPPORT | FINANCE | VIEWER |
|--------|:-----------:|:-------:|:-------:|:------:|
| View dashboard stats | ✅ | ✅ | ✅ | ✅ |
| View tenant list | ✅ | ✅ | ✅ | ✅ |
| View tenant detail | ✅ | ✅ | ✅ | ✅ |
| Extend tenant trial | ✅ | ✅ | ❌ | ❌ |
| View billing & revenue | ✅ | ❌ | ✅ | ❌ |
| Export CSV (tenants/revenue) | ✅ | ❌ | ✅ | ❌ |
| Suspend / Reactivate tenant | ✅ | ❌ | ❌ | ❌ |
| Change tenant plan | ✅ | ❌ | ❌ | ❌ |
| Impersonate tenant | ✅ | ❌ | ❌ | ❌ |
| Delete tenant | ✅ | ❌ | ❌ | ❌ |
| Manage admin team | ✅ | ❌ | ❌ | ❌ |
| Change platform settings | ✅ | ❌ | ❌ | ❌ |
| Manage themes | ✅ | ❌ | ❌ | ❌ |
| GDPR erasure / export | ✅ | ❌ | ❌ | ❌ |
| Feature flags | ✅ | ✅ | ❌ | ❌ |

> **First admin account:** The very first SUPER_ADMIN account is created by running the seed script on the server: `npm run seed:admin` inside `apps/api/`. After that, additional admins are created from within the panel.

---

## 3. Dashboard — Platform Overview

**URL:** `/admin/dashboard`

The dashboard gives a real-time snapshot of the entire platform.

### KPI Cards (top row)

| Card | What it shows |
|------|--------------|
| **Total Tenants** | All registered resorts/hotels, with % change vs last month |
| **Active Tenants** | Currently active (not suspended, not trial-expired) |
| **MRR** | Monthly Recurring Revenue — calculated from each tenant's plan price |
| **Trialing** | Tenants currently on a free trial |

### Charts

- **MRR Growth** — line chart of monthly revenue over the past 12 months
- **New Signups** — bar chart of new tenant registrations per month
- **Plan Distribution** — pie chart showing how many tenants are on each plan (FREE / STARTER / PROFESSIONAL / ENTERPRISE)

### Recent signups table

Shows the 10 most recently registered tenants with their name, plan, trial end date, and status badge.

### Churn Risk alert

If any tenants are flagged as high churn risk (inactive, overdue payment, trial expiring soon), a warning section appears at the bottom. Click through to the [Churn Risk](#19-churn-risk) page for the full list.

---

## 4. Tenant Management

### 4.1 View all tenants

**URL:** `/admin/tenants`

The tenant list shows every resort/hotel registered on the platform.

**Filters available:**
- **Search** — by name, email, or slug
- **Plan** — filter by FREE / STARTER / PROFESSIONAL / ENTERPRISE
- **Status** — All / Active / Trialing / Suspended / Trial Expired

**Columns:**
- Name + slug
- Plan badge
- Status badge (Active / Trialing / Suspended / Expired)
- Trial ends / Subscription renews date
- MRR contribution
- Registered date
- Actions: View detail, Quick actions dropdown

**Export:** Click **"Export CSV"** to download the full tenant list (SUPER_ADMIN or FINANCE only).

---

### 4.2 Tenant detail page

**URL:** `/admin/tenants/[id]`

Click any tenant to open their full detail page. This is the most powerful view in the admin panel.

**Sections on the detail page:**

**Overview tab:**
- Basic info (name, slug, email, phone, address)
- Plan + status + trial dates
- Subscription ID (Stripe)
- Feature flags for this specific tenant
- Quick actions bar (suspend, impersonate, extend trial, etc.)

**Bookings tab:**
- All bookings this tenant has ever had
- Revenue per booking
- Guest names

**Billing tab:**
- Payment history
- Invoice list
- Failed payment alerts

**Staff tab:**
- All users who can log in to this tenant's dashboard
- Their roles (OWNER / MANAGER / STAFF / VIEWER)

**Enterprise tab:**
- White-label settings
- SSO configuration
- Custom branding

---

### 4.3 Suspend or reactivate a tenant

**Who can do this:** SUPER_ADMIN only

**To suspend a tenant:**
1. Open the tenant detail page
2. Click **"Suspend Tenant"** in the quick actions bar
3. Confirm the dialog

When suspended:
- The tenant's dashboard login is blocked
- Their public website still shows (no blackout for guests)
- All data is preserved
- Status badge changes to 🔴 **Suspended**

**To reactivate:**
1. Open the same tenant detail page
2. Click **"Reactivate Tenant"**
3. Access is restored immediately

> **When to suspend:** Non-payment after grace period, terms of service violation, or owner request. Always send an email warning first.

---

### 4.4 Change a tenant's plan

**Who can do this:** SUPER_ADMIN only

1. Open the tenant detail page
2. Click **"Change Plan"** in the quick actions dropdown
3. Select the new plan (FREE / STARTER / PROFESSIONAL / ENTERPRISE)
4. Confirm

**What changes immediately:**
- The tenant's plan badge in the admin panel
- Their feature limits (number of rooms, staff accounts, etc.)
- Their MRR contribution in platform revenue

> **Note:** This does not automatically update Stripe billing. For paid plan changes, coordinate with Stripe directly or use the Stripe dashboard to update the subscription.

---

### 4.5 Extend a trial

**Who can do this:** SUPER_ADMIN, SUPPORT

Use this when a prospect needs more time to evaluate the platform.

1. Open the tenant detail page
2. Click **"Extend Trial"**
3. Enter the number of additional days (e.g. 14)
4. Confirm

The tenant's trial end date updates immediately and they receive a notification.

> **Best practice:** Always log a note in the audit log when extending trials, especially if it's the second extension for the same tenant.

---

### 4.6 Impersonate a tenant

**Who can do this:** SUPER_ADMIN only

Impersonation lets you log in to a tenant's dashboard **as them** without knowing their password. Use this for:
- Debugging a specific issue a tenant is reporting
- Onboarding setup on behalf of the tenant (with their consent)
- QA testing in production data

**How to impersonate:**
1. Open the tenant detail page
2. Click **"Impersonate"** in the quick actions bar
3. A new tab opens with the tenant's dashboard fully loaded
4. A yellow banner at the top says **"You are impersonating [Tenant Name]"** at all times
5. Click **"Exit Impersonation"** in the banner to return to your admin session

> ⚠️ **Important rules:**
> - Always get verbal or written consent from the tenant before impersonating
> - Never impersonate to access financial or guest PII without a support ticket reason
> - All actions taken during impersonation are logged in the audit log under your admin account

---

### 4.7 Delete a tenant

**Who can do this:** SUPER_ADMIN only

**This is irreversible.** Deleting a tenant permanently removes:
- All their bookings, guests, rooms, staff accounts
- All their settings, website content, food orders
- All payment records

1. Open the tenant detail page
2. Click **"Delete Tenant"** (red button, usually in a danger zone at the bottom)
3. Type the tenant's slug to confirm
4. Click **"Permanently Delete"**

> ⛔ Only delete tenants when they have formally requested account deletion (GDPR erasure) or after an extended period of non-payment with no response. Export their data first using the CSV export.

---

## 5. Billing & Revenue

### 5.1 MRR and revenue overview

**URL:** `/admin/billing`  
**Who can access:** SUPER_ADMIN, FINANCE

This page shows the platform's financial health:

| Metric | Description |
|--------|-------------|
| **Total MRR** | Sum of all active tenants' monthly subscription fees |
| **Annual Run Rate (ARR)** | MRR × 12 |
| **Active Paying Tenants** | Tenants on a paid plan (not FREE, not trialing) |
| **Average Revenue Per Account (ARPA)** | MRR ÷ paying tenant count |
| **Trial to Paid Conversion** | % of trials that converted to any paid plan |

**Revenue breakdown table:** Shows each active tenant, their plan, monthly amount, and next billing date.

**MRR Growth chart:** 12-month trend of monthly revenue.

---

### 5.2 Revenue CSV export

**URL:** `/admin/export/revenue-csv` (also accessible from the Billing page)

Downloads a CSV with columns:
- Tenant name, slug, plan
- Monthly amount
- Total lifetime revenue
- First payment date, last payment date
- Payment status

Use this for:
- Monthly financial reporting
- Accountant/bookkeeper handoff
- Investor updates

---

### 5.3 Tenant billing detail

From any tenant's detail page → **Billing tab**, you can see:
- Their Stripe subscription ID
- Payment history (successful payments + failed attempts)
- Invoice list with download links
- Next billing date
- Payment method on file (card last 4 digits)

> You cannot change their payment method from here. Direct the tenant to their own Settings → Billing page, or use the Stripe dashboard.

---

## 6. User Management

**URL:** `/admin/users`

Lists all individual user accounts across all tenants. Useful for:
- Finding a specific person's account across tenants
- Checking which tenant a user belongs to
- Identifying accounts with suspicious login patterns

**Filters:**
- Search by name or email
- Filter by role (OWNER / MANAGER / STAFF / VIEWER)

**Columns:** Name, email, role, tenant name, last login, account created date.

> You cannot reset passwords from here — direct the user to the "Forgot Password" flow on the login page.

---

## 7. Admin Team

**URL:** `/admin/team`  
**Who can access:** SUPER_ADMIN only

Manage who has access to the ResortPro admin panel.

### Add a team member

1. Click **"Invite Admin"**
2. Enter their name, email, and select their role (SUPPORT / FINANCE / VIEWER — you cannot create another SUPER_ADMIN from the UI; use the seed script or the database directly)
3. Click **"Send Invite"**

The person receives an email with a secure link to set their password.

### Change a team member's role

1. Find the person in the team list
2. Click the role dropdown next to their name
3. Select the new role
4. Saves automatically

### Remove a team member

1. Click the **"Remove"** button next to their name
2. Confirm the dialog

Their access is revoked immediately. Any active sessions are invalidated within 15 minutes (JWT expiry).

---

## 8. Themes Management

**URL:** `/admin/themes`  
**Who can access:** SUPER_ADMIN only

ResortPro tenants can choose from multiple website themes (Coastal, Luxe, Minimal, etc.). This page lets you manage the theme library.

### Theme list

Each theme shows:
- Theme key (e.g. `coastal`, `luxe`, `minimal`)
- Display name and description
- Preview image
- Status: Active / Inactive
- Premium: Yes / No
- Sort order (determines display order in tenant picker)

### Edit a theme

1. Click **"Edit"** on any theme
2. Update the name, description, preview image URL, or sort order
3. Toggle **Active** to show/hide from the tenant theme picker
4. Toggle **Premium** to restrict to higher-tier plans
5. Save

### Enable/disable a theme

Click the **toggle** next to any theme to instantly enable or disable it for all tenants. If a tenant is already using a disabled theme, their existing site continues to work — but they cannot re-select it if they switch away.

> **Adding new themes:** New themes require a code deployment. The theme key must match a folder under `apps/web/src/components/themes/`. After deployment, add it here to make it visible to tenants.

---

## 9. Platform Settings

**URL:** `/admin/settings`  
**Who can access:** SUPER_ADMIN only

Global settings that apply to the entire platform.

### Plan pricing

Set the monthly price for each plan tier:

| Plan | Default price |
|------|--------------|
| FREE | $0 |
| STARTER | $49/month |
| PROFESSIONAL | $99/month |
| ENTERPRISE | $199/month |

> Changing prices here updates the MRR calculations in the dashboard. It does **not** automatically change what Stripe charges existing subscribers — update Stripe separately.

### Trial settings

- **Trial duration (days):** How many days new signups get before they must upgrade (default: 14)
- **Grace period (days):** Days after trial expiry before the account is locked (default: 3)

### Platform branding

- Platform name (shown in emails)
- Support email address
- Logo URL

### Stripe webhook secret

The secret used to verify Stripe webhook events. Update this if you roll the Stripe webhook secret.

---

## 10. Announcements

**URL:** `/admin/announcements`

Send platform-wide messages that appear as banners in all tenant dashboards.

### Create an announcement

1. Click **"New Announcement"**
2. Fill in:
   - **Title** — short headline (e.g. "Scheduled maintenance — May 20")
   - **Body** — full message (supports plain text)
   - **Type** — INFO (blue) / WARNING (yellow) / CRITICAL (red)
   - **Target** — All tenants / Specific plan / Specific tenant
   - **Expires at** — when the banner automatically disappears
3. Click **"Publish"**

The banner appears immediately in all targeted tenant dashboards.

### Announcement types

| Type | Color | Use case |
|------|-------|---------|
| INFO | 🔵 Blue | New feature releases, tips, non-urgent news |
| WARNING | 🟡 Yellow | Upcoming maintenance, policy changes, deprecations |
| CRITICAL | 🔴 Red | Active outages, urgent security notices |

### Manage existing announcements

- **Edit:** Update the text or expiry date
- **Delete:** Removes immediately from all dashboards
- Expired announcements are automatically hidden but not deleted

---

## 11. Referral Program

**URL:** `/admin/referrals`

Track the platform's referral program — tenants who refer other resorts get rewards.

**What you can see:**

| Column | Description |
|--------|-------------|
| Referrer | The tenant who made the referral |
| Referred tenant | The new signup who came through the referral |
| Status | Pending / Qualified / Rewarded |
| Reward | What the referrer earns (e.g. 1 month free) |
| Date | When the referral was registered |

**Marking a referral as rewarded:**
1. Find the referral in the list
2. Click **"Mark Rewarded"**
3. Choose the reward in the panel. ResortPro applies the account credit or free-plan period to the referrer automatically.

> A Super Admin must approve the reward, but once approved ResortPro applies the selected credit or free-plan period automatically.

---

## 12. Custom Domains

**URL:** `/admin/domains`

Tenants on the PROFESSIONAL and ENTERPRISE plan can use a custom domain (e.g. `book.palmsresort.com`) for their public website instead of the default `palmsresort.resortpro.app`.

**Domain status values:**

| Status | Meaning |
|--------|---------|
| `none` | No custom domain configured |
| `pending` | Tenant submitted a domain, waiting for DNS verification |
| `provisioning` | DNS verified, SSL certificate being issued |
| `active` | Domain fully working with SSL |
| `error` | Something failed — hover for the error message |

### What you do here

- **View all custom domains** across all tenants with their status
- **Verify a domain manually** if automatic DNS check missed it
- **Trigger SSL re-provisioning** if a certificate expired or failed
- **Remove a domain** if the tenant made an error

### Manual domain verification steps

When a tenant reports their domain is "stuck in pending":
1. Ask them to confirm the DNS records are set:
   - `CNAME book.palmsresort.com → palmsresort.resortpro.app`
2. Use a DNS checker (e.g. [dnschecker.org](https://dnschecker.org)) to confirm propagation
3. Click **"Force Verify"** in the admin panel
4. If still failing, check the error log in the System Health page

---

## 13. Enterprise Tenants

**URL:** `/admin/enterprise` and `/admin/tenants/[id]/enterprise`

Enterprise tenants (on the ENTERPRISE plan) get additional features managed from here:

### White-label branding

The tenant can replace ResortPro branding with their own:
- Custom logo in the dashboard header
- Custom primary and accent colors
- Custom company name in emails
- Removes "Powered by ResortPro" from their public website

**To enable white-label:**
1. Open the tenant's enterprise settings page
2. Toggle **"Enable White-label"**
3. Enter their brand assets (logo URL, colors, company name)
4. Save

### SSO (Single Sign-On)

Enterprise tenants can authenticate their staff via their corporate identity provider (Google Workspace, Okta, Azure AD, etc.) using SAML 2.0.

**To configure SSO for a tenant:**
1. Go to `/admin/tenants/[id]/enterprise`
2. Toggle **"Enable SSO"**
3. Select the SSO provider
4. Enter the **Client ID** and **Client Secret** (provided by the tenant's IT team)
5. Give the tenant the **Callback URL** they need to register in their IdP: `https://app.resortpro.app/api/auth/sso/callback`
6. Save and ask the tenant to test login

### Onboarding checklist

Each enterprise tenant has a tracked onboarding checklist:
1. Contract signed
2. Account created
3. Initial setup done
4. White-label configured
5. SLA agreement signed
6. Training & onboarding done
7. Go-live ✓

Update the checklist step as you progress through onboarding with the tenant.

---

## 14. Feature Flags

**URL:** `/admin/tenants/[id]` → Feature Flags section

Feature flags let you enable or disable specific features for individual tenants — useful for:
- Beta testing a new feature with select tenants
- Granting early access to a premium feature
- Disabling a broken feature for a specific tenant while you fix it

### Available flags (examples)

| Flag | What it enables |
|------|----------------|
| `loyalty_program` | Guest loyalty points system |
| `group_bookings` | Group booking management |
| `rate_plans` | Advanced rate plan configuration |
| `external_calendars` | Airbnb/Booking.com iCal sync |
| `advanced_reports` | Extended analytics and revenue reports |
| `custom_domain` | Custom domain for public website |
| `whitelabel` | White-label branding (Enterprise) |
| `sso` | Single Sign-On (Enterprise) |

### How to toggle a flag

1. Open any tenant's detail page
2. Scroll to the **Feature Flags** section
3. Toggle any flag on/off
4. Changes take effect immediately — the tenant's dashboard updates on next page load

> **VIEWER and below cannot see Feature Flags.** SUPPORT can view and toggle. SUPER_ADMIN has full access.

---

## 15. GDPR & Data Requests

**URL:** `/admin/gdpr`  
**Who can access:** SUPER_ADMIN only

Under GDPR (and similar laws), guests and resort owners have the right to request their personal data or ask for it to be deleted.

### Types of requests

| Type | What it means | Your action |
|------|--------------|-------------|
| **Data Export** | Person wants a copy of all their data | Generate and send a data export |
| **Erasure Request** | Person wants all their data deleted | Run the GDPR purge script |

### Handling a Data Export request

1. The request appears in the GDPR queue
2. Click **"Generate Export"**
3. The system compiles all data for that tenant/guest into a downloadable ZIP
4. Click **"Download"** and send it to the requester via secure email
5. Mark the request as **Fulfilled**

You have **30 days** from receipt of the request to fulfill it (GDPR requirement).

### Handling an Erasure Request

1. The request appears in the GDPR queue
2. Review what will be deleted (a summary is shown)
3. Click **"Run Erasure"** — this triggers the purge script
4. All personal data for that tenant is permanently deleted:
   - Guest names, emails, phone numbers
   - Booking history (anonymized — revenue totals kept for accounting)
   - Staff accounts and their profiles
5. Mark as **Fulfilled**

> ⛔ **This cannot be undone.** Export the tenant's data first if there's any chance you'll need it. Running erasure on the wrong tenant is a critical error.

---

## 16. System Health

**URL:** `/admin/health`

Real-time view of the platform's technical status.

### Services monitored

| Service | What it checks |
|---------|---------------|
| **API Server** | Response time and error rate |
| **Database** | Connection pool, query latency, active connections |
| **Stripe Webhooks** | Last successful webhook received |
| **bKash** | Last successful API call |
| **SSL Commerce** | Last successful API call |
| **Background Jobs** | Pre-arrival reminders, iCal sync — last run time |
| **Email (SMTP)** | Last successful email sent |

### Status colors

- 🟢 **Green** — Healthy, all checks passing
- 🟡 **Yellow** — Degraded, elevated latency or some failed checks
- 🔴 **Red** — Down or critical errors

### What to do when something is red

| Service down | First action |
|-------------|-------------|
| API | Check server logs — `apps/api/` deployment |
| Database | Check PostgreSQL connection string in `.env` |
| Stripe webhooks | Verify webhook secret in Platform Settings matches Stripe dashboard |
| bKash / SSL | Check API credentials in the affected tenant's Payment Gateway settings |
| Background jobs | Check if the cron service is running on the server |
| Email | Check SMTP credentials and email provider status |

---

## 17. Audit Log

**URL:** `/admin/audit-log`

Every significant action taken by any admin is recorded here.

### What is logged

- Admin login / logout
- Tenant suspended / reactivated / deleted
- Plan changed
- Trial extended
- Impersonation started / ended
- Feature flag toggled
- Platform settings changed
- Team member added / removed
- Announcement published / deleted
- GDPR erasure executed
- Data export generated

### Reading the log

| Column | Description |
|--------|-------------|
| Timestamp | When the action happened (UTC) |
| Admin | Which admin account performed the action |
| Action | What was done (e.g. `tenant.suspend`) |
| Target | Which tenant or user was affected |
| Details | Additional context (e.g. old plan → new plan) |
| IP Address | The IP address of the admin at the time |

### Filtering

- Filter by **admin name** — see everything one person did
- Filter by **action type** — see all impersonations, all plan changes, etc.
- Filter by **date range**

> The audit log is **append-only** — no one can delete or modify entries, including SUPER_ADMIN. This ensures an honest record of all platform operations.

---

## 18. Data Export

**URL:** `/admin/export`  
**Who can access:** SUPER_ADMIN, FINANCE

### Tenant CSV export

Downloads all tenants with:
- Name, slug, email, phone
- Plan, plan status
- Trial start/end dates
- Subscription ID
- MRR contribution
- Registered date

### Revenue CSV export

Downloads all successful payments with:
- Tenant name and plan
- Payment date
- Amount
- Stripe payment intent ID
- Invoice number

**Use cases:**
- Monthly bookkeeping
- Tax reporting
- Investor reporting
- Churn analysis in Excel/Google Sheets

---

## 19. Churn Risk

**URL:** `/admin/churn-risk`

The platform automatically flags tenants who are likely to cancel or go inactive, based on:

| Risk Signal | What it means |
|-------------|--------------|
| Trial expiring in 3 days, no upgrade | Likely to churn at end of trial |
| No login in 30+ days | Tenant may have abandoned the product |
| Failed payment (last 7 days) | Payment issue — could churn if not resolved |
| Low bookings vs 3 months ago | Usage declining |
| Only 1 staff user, no rooms added | Incomplete setup — may not have launched |

### Risk levels

- 🔴 **High** — Multiple signals, immediate follow-up needed
- 🟡 **Medium** — 1–2 signals, monitor and reach out
- 🟢 **Low** — Minor signals, no action needed

### What to do

For **High risk** tenants:
1. Reach out by email or phone — offer help with setup or a trial extension
2. Check if there's a billing issue and resolve it
3. Consider a brief check-in call to understand their pain points

For **Payment failed** specifically:
1. Email the tenant immediately with a payment update link
2. Give a 3–5 day grace period
3. If not resolved, mark for suspension

---

## 20. Quick Reference — Who can do what

### Full permissions matrix

| Section / Action | SUPER_ADMIN | SUPPORT | FINANCE | VIEWER |
|-----------------|:-----------:|:-------:|:-------:|:------:|
| Dashboard stats | ✅ | ✅ | ✅ | ✅ |
| Tenant list (view) | ✅ | ✅ | ✅ | ✅ |
| Tenant detail (view) | ✅ | ✅ | ✅ | ✅ |
| Extend trial | ✅ | ✅ | ❌ | ❌ |
| Suspend tenant | ✅ | ❌ | ❌ | ❌ |
| Reactivate tenant | ✅ | ❌ | ❌ | ❌ |
| Change plan | ✅ | ❌ | ❌ | ❌ |
| Impersonate | ✅ | ❌ | ❌ | ❌ |
| Delete tenant | ✅ | ❌ | ❌ | ❌ |
| User list | ✅ | ✅ | ✅ | ✅ |
| Billing & MRR | ✅ | ❌ | ✅ | ❌ |
| Revenue CSV | ✅ | ❌ | ✅ | ❌ |
| Tenant CSV | ✅ | ❌ | ✅ | ❌ |
| Admin team manage | ✅ | ❌ | ❌ | ❌ |
| Themes manage | ✅ | ❌ | ❌ | ❌ |
| Platform settings | ✅ | ❌ | ❌ | ❌ |
| Announcements | ✅ | ✅ | ❌ | ❌ |
| Referrals | ✅ | ✅ | ✅ | ✅ |
| Custom domains | ✅ | ✅ | ❌ | ❌ |
| Enterprise settings | ✅ | ❌ | ❌ | ❌ |
| Feature flags | ✅ | ✅ | ❌ | ❌ |
| GDPR requests | ✅ | ❌ | ❌ | ❌ |
| System health | ✅ | ✅ | ✅ | ✅ |
| Audit log | ✅ | ✅ | ✅ | ✅ |
| Churn risk | ✅ | ✅ | ✅ | ✅ |

---

### Emergency contacts

| Situation | Contact |
|-----------|---------|
| Database down | Your DevOps / server provider |
| Stripe issue | [Stripe Support](https://support.stripe.com) |
| bKash API issue | bKash merchant support hotline |
| SSL Commerce issue | SSL Commerce merchant portal |
| Security breach | Immediately revoke all admin sessions, rotate JWT secret in `.env`, notify affected tenants |

---

> **Questions or missing features?** Contact the ResortPro engineering team or open an internal issue in the project repository.

# ResortPro — Master Progress Tracker

> **নতুন session শুরু করার আগে এই file পড়ো।**
> তারপর Current Task-এর link follow করো।

---

## 🟢 Current Status

**T-34 — Maintenance Tracking সম্পূর্ণ ✅**

Schema: 3 নতুন enum (MaintenancePriority: URGENT/HIGH/NORMAL/LOW, MaintenanceStatus: OPEN/IN_PROGRESS/RESOLVED, MaintenanceIssueType: AC/PLUMBING/ELECTRICAL/FURNITURE/DOOR/WIFI/TV/OTHER), নতুন `MaintenanceTicket` model (roomId, issueType, description, priority, status, assignedTo, resolvedAt, notes, createdBy) → db push। API (5 routes): `GET /api/maintenance` (filter by status/room/priority, URGENT first), `GET /api/maintenance/summary` (open/inProgress/resolvedToday/urgent counts), `POST /api/maintenance` (create → room status=MAINTENANCE), `PATCH /api/maintenance/:id` (update status/assign/notes/priority), `PATCH /api/maintenance/:id/resolve` (resolve → restoreRoomIfClear() → AVAILABLE if no open tickets remain), `DELETE /api/maintenance/:id` (MANAGER+ only, also restores room)। Dashboard stats: `openMaintenance` count added to `GET /api/dashboard` Promise.all। Frontend `/dashboard/maintenance`: 4-card summary strip (open/in-progress/resolved-today/urgent), status + priority filter pills, 3-col ticket grid। `TicketCard`: issue emoji, priority badge, status badge, room+floor, description, resolution notes (if resolved), "Start Work" → IN_PROGRESS, "Resolve" → ResolveModal (resolution notes input)। `CreateTicketModal`: room picker, 8-issue icon grid (❄️🔧⚡🪑🚪📶📺🔩), description, 4-priority buttons, staff dropdown। Dashboard homepage: "Maintenance" stat card (orange) added (9th card)। Sidebar: Wrench icon + "Maintenance" link after Housekeeping। 0 new TS errors। পরবর্তী: **T-35 (Daily Report)**।

---

**T-33 — Walk-in Booking (Front Desk Quick Add) সম্পূর্ণ ✅**

API: `createBookingSchema` extended — `source` (DIRECT/WALK_IN/PHONE/OTA/ONLINE), `skipEmail` bool, `autoCheckIn` bool, `paymentMethod` (CASH/CARD/PENDING), walk-in guest fields (guestFirstName, guestLastName, guestEmail, guestPhone) — guestId এখন optional। Create handler: guestId না থাকলে guest auto-create (email exist হলে existing guest reuse), `source` field saved, `autoCheckIn=true` হলে status=CHECKED_IN + actualCheckIn=now + room→OCCUPIED, paymentMethod থাকলে Payment record create + booking.paidAmount/paymentStatus=PAID update, `skipEmail=true` হলে confirmation email skip। `WalkInModal` component: dates (today/tomorrow default), available rooms grid (৩০ second-এ book করা যায়), guest name+phone+email fields, guests count, payment method selector (Cash/Card/Pay Later), Auto check-in checkbox (default: on), Skip email checkbox (default: on), summary bar (room + nights + payment method + total), "Book & Check In" CTA। Bookings page: prominent green "⚡ Walk-in" button (header, beside New Booking), confirmation column-এ Walk-in badge (emerald), `WalkInModal` conditional render। 0 new TS errors। পরবর্তী: **T-34 (Maintenance Tracking)**।

---

**T-32 — Guest Communication (Auto Emails) সম্পূর্ণ ✅**

Schema: নতুন `EmailSettings` model (sendConfirmation/sendPreArrival/sendCheckoutInvoice/sendCancellation toggles, replyToEmail, footerText) → db push। `apps/api/src/utils/guest-emails.ts`: `sendBookingConfirmation()`, `sendPreArrivalReminder()`, `sendCheckoutEmail()` (invoice summary with balance due alert), `sendCancellationEmail()`, `sendTestEmail()` — সব branded HTML (resort logo, primary color from tenant.brandPrimaryColor, bookingTable shared component, wrapGuest() wrapper)। EmailSettings upsert lazy (auto-create on first use)। Booking routes hooked: create → `sendBookingConfirmation()`, check-out → `sendCheckoutEmail()`, cancel → `sendCancellationEmail()` — সব fire-and-forget (catch silent)। Old inline HTML email block replaced। Pre-arrival cron: `apps/api/src/jobs/pre-arrival-reminder.ts` — `node-cron` 9AM daily, finds checkIn=tomorrow + CONFIRMED bookings, calls `sendPreArrivalReminder()` per booking। Registered in `app.ts`। Tenant API: `GET/PATCH /api/tenant/email-settings`, `POST /api/tenant/email-settings/test`। Settings page: নতুন "Email" tab — 4 toggle rows (ToggleLeft/ToggleRight), reply-to email, footer text, Save button, "Send Test Email" section (input + button → toast)। 0 new TS errors। পরবর্তী: **T-33 (Walk-in Booking)**।

---

**T-31 — Rate Plans & Seasonal Pricing সম্পূর্ণ ✅**

Schema: নতুন `RatePlanType` enum (STANDARD/SEASONAL/WEEKEND/PROMO/EARLY_BIRD/LAST_MINUTE), নতুন `RatePlan` model (roomId nullable = all rooms, price, startDate, endDate, daysOfWeek Int[], minNights, isActive) → db push। `resolveRate()` util: priority ranking PROMO(6)>SEASONAL(5)>WEEKEND(4)>EARLY_BIRD(3)>LAST_MINUTE(2)>STANDARD(1), room-specific beats global same-type, date range + daysOfWeek + minNights filter। API: `GET /api/rate-plans` (list with room), `POST` (create), `PATCH /:id` (update), `DELETE /:id`, `GET /rate-plans/resolve?roomId&checkIn&checkOut` (effective price lookup)। Public endpoint: `GET /site/:slug/rate?roomId&checkIn&checkOut` (no auth — for booking form)। Frontend `/dashboard/rate-plans`: priority legend, 4 stat cards, full CRUD table (type badge, room, date range, days-of-week, min nights, price, toggle active/inactive, edit, delete), `PlanModal` (type selector grid, conditional date range / days-of-week fields, min nights, room selector, active toggle)। `NewBookingModal`: rate plan resolution query on room+date select, effective price shown in step 4 confirm, amber banner "Rate plan applied: ..." when plan overrides base price। Sidebar: `Tags` icon + "Rate Plans" link (below Rooms). 0 new TS errors। পরবর্তী: **T-32 (Guest Communication)**।

---

**T-30 — Guest Invoice / Folio সম্পূর্ণ ✅**

Schema: `taxRate Float @default(0)` → Tenant, `invoiceNumber String? @unique` + `invoiceSentAt DateTime?` → Booking, নতুন `InvoiceExtra` model (description, amount, quantity, bookingId, tenantId) → db push। API: `GET /api/bookings/:id/invoice` (room×nights + food orders + extras + tax → subtotal, taxAmount, grandTotal, paidAmount, balanceDue), `POST /api/bookings/:id/invoice/extras` (manual charge add), `DELETE /api/bookings/:id/invoice/extras/:extraId` (charge remove), `POST /api/bookings/:id/invoice/send-email` (invoice number generate + Resend email with full styled HTML table)। Frontend `/dashboard/bookings/[id]/invoice`: full printable invoice page — resort header (gradient), guest info / stay details grid, line items table (room, food rows grouped, extras rows with delete btn), totals section (subtotal → tax → grand total → paid → balance due, green/red highlighted), payment history, "Add Extra Charge" modal, "Email Invoice" button (toast on success), print button (`@media print` CSS), 0 TS errors। `BookingDetailSheet`: "View Invoice" button (teal) for CHECKED_IN + CHECKED_OUT states → routes to invoice page। পরবর্তী: **T-31 (Rate Plans)**।

---

**T-29 — Check-in / Check-out Flow সম্পূর্ণ ✅**

Schema: `actualCheckIn DateTime?` + `actualCheckOut DateTime?` on Booking model → db push। API check-in enhanced: sets `actualCheckIn = now()`, room → `OCCUPIED`। API check-out enhanced: sets `actualCheckOut = now()`, room → `CLEANING` (was AVAILABLE), housekeeping CHECKOUT task auto-created, food order total computed for checkout summary। `GET /api/dashboard/today` — arrivals (checkIn=today, CONFIRMED/PENDING/CHECKED_IN), departures (checkOut=today, CONFIRMED/CHECKED_IN), inHouseCount। `BookingDetailSheet` rebuilt: status timeline (Booked→Confirmed→Checked In→Checked Out), actual timestamps shown when set, confirmation modal for check-in (guest/room/dates/outstanding warning), checkout modal with cost summary (room charges, paid, balance due, red warning if unpaid), toast with context। Dashboard homepage: "Today's Arrivals" + "Today's Departures" cards (guest avatar, room, nights, due/in/out badge, in-house count), `getToday` query with 60s refetch। 0 new TS errors।

---

**T-28 — Visual Booking Calendar (Gantt View) সম্পূর্ণ ✅**

`GET /api/bookings/gantt?from&to` — rooms with bookings in date range, grouped by roomId। Frontend: `/dashboard/calendar` Gantt page — 30-day sliding window, room rows with absolute-positioned booking blocks, color-coded by status (confirmed=indigo, checked_in=green, checked_out=gray, pending=amber), today column highlighted amber, maintenance rooms orange+blocked, click booking block → detail panel (right side), click empty cell → new booking pre-filled, Prev/Next 14-day navigation, 4 stat cards (total/occupied/maintenance/bookings), legend। Sidebar: `Booking Calendar` link (LayoutGrid icon) added between Bookings and Guests। 0 new TS errors।

---

**T-27 — Custom Domain per Resort সম্পূর্ণ ✅**

Schema-তে 4টা নতুন field: `domainVerificationToken`, `sslStatus` (none/pending/provisioning/active/error), `sslProvisionedAt`, `sslExpiresAt`, `sslError`। Tenant API: `POST /tenant/domain/provision-ssl` (domain verified হলে SSL provisioning trigger), `GET /tenant/domain/status` (full domain+SSL status, daysUntilExpiry সহ)। Admin API: `GET /admin/domains` (stats + all custom domain tenants), `POST /admin/domains/:id/force-verify` (SUPER_ADMIN DNS override), `DELETE /admin/domains/:id` (domain removal + SSL reset), `PATCH /admin/domains/:id/ssl` (cert-manager webhook — status/expiry/error update)। Next.js middleware (`src/middleware.ts`) ইতিমধ্যে বিদ্যমান ও সম্পূর্ণ — hostname → `/site/domain/:hostname` → slug lookup → URL rewrite। `/site/domain/:hostname` endpoint ইতিমধ্যে verified+active tenants filter করে। Admin `/admin/domains` page: 4 stat cards (total/verified/SSL active/pending), domain table (tenant, domain link, DNS verified+force-verify, SSL badge+expiry+activate, plan, remove), DNS setup instructions। Tenant settings Domain tab: SSL status card (color-coded — active/provisioning/error/none), cert expiry countdown, "Provision SSL Certificate" button (only after DNS verified)। Admin nav: Globe + Domains link। 0 new TS errors। পরবর্তী: **T-24/T-25/T-26**।

---

**T-22 — Owner Analytics Dashboard সম্পূর্ণ ✅**

`GET /api/dashboard/analytics` — single comprehensive endpoint: KPIs (YTD revenue, MTD revenue, revenue growth, occupancy rate, ADR, RevPAR, bookings 30d with growth, total/new guests, avg stay days), revenue by month (12m), room type breakdown (bookings+revenue), booking sources (groupBy 90d), top nationalities (top 8, groupBy). `dashboardApi.getAnalytics()` added. Sidebar: `BarChart2` + Analytics link (2nd position). `/dashboard/analytics` page: 8 KPI cards (YTD rev/occupancy/ADR/RevPAR/30d bookings/total guests/avg stay/nationalities count), AreaChart revenue 12 months, LineChart occupancy 30 days, BarChart revenue by room type, horizontal BarChart booking sources + legend, nationality horizontal bars (custom colored progress bars), room type count grid cards. All Recharts — dark tooltip, color palette (indigo/green/amber/pink/teal/purple). 0 new TS errors। পরবর্তী: **T-23 (Mobile App — Expo)**।

---

**T-21 — SLA & Enterprise Onboarding সম্পূর্ণ ✅**

`SlaTier` enum (BASIC/PROFESSIONAL/ENTERPRISE) + `SlaAgreement` Prisma model (uptimePercent, responseTimeH, contractStart/End, autoRenew, signedBy/At, createdBy)। Tenant-এ নতুন fields: white-label (whitelabelEnabled, brandLogoUrl, brandPrimaryColor, brandAccentColor, companyDisplayName), SSO (ssoEnabled, ssoProvider, ssoClientId, ssoClientSecret, ssoConfig JSON), enterprise onboarding (onboardingStep 0-6, onboardingCompletedAt, enterpriseNotes)। `DB push` সম্পূর্ণ। Admin API: `GET /admin/enterprise` (summary + list), `GET /admin/tenants/:id/enterprise`, `PUT /admin/tenants/:id/sla` (upsert), `DELETE /admin/tenants/:id/sla`, `PUT /admin/tenants/:id/whitelabel`, `PUT /admin/tenants/:id/sso`, `PATCH /admin/tenants/:id/onboarding`। Tenant API: `GET /tenant/sla`, `GET /tenant/enterprise`। Admin `/admin/enterprise` page: 5 stat cards (enterprise count, active SLAs, SSO, white-label, onboarding complete), tenant table (SLA tier, SSO badge, white-label, onboarding bar, status, manage link)। Admin `/admin/tenants/:id/enterprise` page: 4 panels — SLA form (tier picker/uptime/response/dates/notes/signed), white-label (toggle/display name/logo URL/color pickers with preview), SSO (provider selector/client ID/secret/Azure tenant ID/callback URL info), onboarding checklist (7-step progress, internal notes, mark-done per step)। Tenant settings: "Enterprise" tab — plan gate (non-enterprise → upgrade prompt), onboarding progress bar, SLA summary cards, white-label status, SSO status। Admin nav: Star + Enterprise link। Flags page → Enterprise link (Star icon)। 0 new TS errors। পরবর্তী: **T-22 (Owner Analytics Dashboard)**।

---

**T-20 — Platform Health Dashboard সম্পূর্ণ ✅**

`metrics.ts` ring buffer (2000 entries, method/path/status/duration/ts)। `normalizePath()` — cuid/uuid/numeric ID → `:id`। Fastify `onResponse` global hook — সব `/api/` + `/site/` request track। DB stats via `$queryRaw` (pg_database_size, pg_statio_user_tables, pg_stat_activity)। `GET /api/admin/health` — process (memory/uptime/Node version), DB (size/connections/top-10 tables), platform counts (tenants/users/bookings/paid), request metrics (rpm/error rate/p50/p95/p99/slow endpoints/5-min bucket breakdown)। Auto-refresh every 30s। `/admin/health` page: status indicator (Healthy/Warning/Degraded), 4 top metric cards, AreaChart (requests + errors last 60min), memory bars, latency BarChart (p50/avg/p95/p99), DB table list, slow endpoints table, 5 platform count cards। Admin nav: Activity icon। 0 TS errors। পরবর্তী: **T-21 (SLA & Enterprise Onboarding)**।

---

**T-19 — GDPR Compliance Suite সম্পূর্ণ ✅**

`gdprErasureRequestedAt/By`, `gdprAnonymizedAt`, `deletedAt` fields on Tenant। `anonymizeTenant()` — Tenant/User/Guest PII → hashed placeholders (sha256 email, null phone/passport/address), idempotent। `collectTenantExport()` — Article 20 full JSON। `getPendingErasures()` — 30d grace logic। `gdpr-purge.ts` script — cron-ready। Admin API: 5 endpoints (requests list, request-erasure, anonymize-now, cancel-erasure, export JSON). Tenant API: `POST /gdpr/request-erasure` + `GET /gdpr/export`. Admin `/admin/gdpr` page: 3-card summary, pending/done rows, Export/Cancel/Anonymize Now actions, how-it-works info box. Tenant settings: "Privacy & GDPR" tab — Export Data + Request Erasure. Admin nav: ShieldCheck + GDPR link. 0 TS errors। পরবর্তী: **T-20 (Platform Health Dashboard)**।

---

**T-18 — Platform Communication Center সম্পূর্ণ ✅**

`PlatformAnnouncement` Prisma model (type/targetPlans/startsAt/endsAt/isDismissible)। Admin CRUD: GET/POST/PATCH/DELETE `/announcements`। Broadcast endpoint: email to all matching tenants via Resend (plan-filtered, allSettled for resilience)। Tenant endpoint: `GET /api/tenant/announcements` — active + plan-filtered। `PlatformBanner` component — stacked banners, localStorage dismiss, type-colored (info/warning/maintenance/feature)। Injected into `(dashboard)/layout.tsx` — auto-shows on every page। Admin page `/admin/announcements`: type picker, target plan chips, date range, dismissible toggle, live/inactive sections, Broadcast Email button। Admin nav: Megaphone + Announcements link। 0 TS errors। পরবর্তী: **T-19 (GDPR Compliance Suite)**।

---

**T-17 — Feature Flags per Tenant সম্পূর্ণ ✅**

`TenantFeatureFlag` Prisma model (tenantId+flag unique, updatedBy audit)। 10-flag registry (`FLAG_REGISTRY`) — Analytics/AI/Reporting/UX/Beta categories। Admin endpoints: `GET /feature-flags` (registry), `GET /tenants/:id/flags` (merged state), `PATCH /tenants/:id/flags/:flag` (toggle + audit log), `PATCH /tenants/:id/flags` (bulk)। Tenant endpoint: `GET /api/tenant/flags` (returns enabled flag keys)। `useFeatureFlag(flag)` hook (in-memory cache, SSR-safe)। `useFeatureFlags()` multi-flag hook। `/admin/tenants/:id` page — flag toggles grouped by category, permission-gated, audit trail, flag key chip। Tenants list: Flag icon → detail page। পরবর্তী: **T-18 (Platform Communication Center)**।

---

**T-16 — Admin Role Granularity সম্পূর্ণ ✅**

`AdminRole` enum (SUPER_ADMIN/SUPPORT/FINANCE/VIEWER) + `AdminUser` Prisma model (DB push done)। `seed-admin.ts` script (SUPER_ADMIN_EMAILS থেকে seed)। Login route পুরো পরিবর্তন → `AdminUser` table query + `adminRole` JWT claim। `requireAdminRole(roles[])` middleware — role hierarchy enforcement। 25+ route-এ role gate apply (read = all, billing/export = FINANCE+, audit/extend-trial = SUPPORT+, write = SUPER_ADMIN only)। `GET /api/admin/me` → fresh DB lookup। 4 new team CRUD endpoints। `/admin/team` page: role reference cards, members table, Add/Edit modal (role picker with permission list), activate/deactivate toggle। Admin nav-এ UserCog + Team link। Zustand store-এ `adminRole` + `hasRole()` helper। পরবর্তী: **T-17 (Feature Flags)**।

---

**T-15 — Referral Tracking সম্পূর্ণ ✅**

Prisma: `referralCode` (unique), `referredById` self-relation on Tenant। `generateReferralCode()` utility। Auth register: `?ref=CODE` param → lookup referrer → set `referredById` + generate new code for registrant। GET /api/admin/referrals: summary (totalReferred, converted, conversionRate, attributedMrr, activeReferrers) + per-referrer stats with nested referrals + recent 20 signups। /admin/referrals page: 5 stat cards, referral link explainer banner, expandable referrer table (copy code button, conversion rate bar, MRR), Recent Signups sidebar। Register page: amber referral banner when `?ref=` present। Admin nav-এ Gift icon + Referrals link। পরবর্তী: **T-16 (Admin Role Granularity)**।

---

**T-14 — CSV/PDF Export সম্পূর্ণ ✅**

3টা CSV endpoint (tenants summary, revenue 12mo, per-tenant bookings), /admin/export page (Revenue card, All Tenants card, per-tenant search+download list), browser print-to-PDF (branded report with MRR table + KPIs)।

---

## ✅ Completed

| Task | Branch | Completed |
|------|--------|-----------|
| Project foundation (monorepo, API, web setup) | main | ✅ |
| Auth system (register, login, JWT, refresh, reset, invite) | main | ✅ |
| Resort owner dashboard (rooms, bookings, guests, staff, housekeeping, restaurant, inventory, support, website, notifications) | main | ✅ |
| Public resort website — LuxeTemplate (basic) | main | ✅ |
| Stripe payment integration (subscription billing + guest payment links + webhooks) | main | ✅ |
| Super admin dashboard (login, stats, tenants, users, billing, impersonation, export) | main | ✅ |
| Business control system (trial enforcement, upgrade wall, suspended page, trial emails, win-back) | main | ✅ |
| Admin platform settings (plan editor, trial duration, dynamic config) | main | ✅ |
| Documentation (docs/plan/, docs/workflow/) | main | ✅ |

---

## 📋 Backlog (Priority Order)

### 🟡 High Priority

| # | Task | Plan | Task File |
|---|------|------|-----------|
| T-01 | Availability Calendar — API endpoint | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-01](./tasks/task-01-availability-calendar-api.md) |
| T-02 | Availability Calendar — Frontend widget | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-02](./tasks/task-02-availability-calendar-widget.md) |
| T-03 | Theme system — registry + types refactor | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-03](./tasks/task-03-theme-system-foundation.md) |
| T-04 | Theme system — extract widgets (BookingForm, MenuWidget, ContactForm) | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-04](./tasks/task-04-extract-widgets.md) |
| T-05 | LuxeTemplate refactor → themes/luxe/ structure | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-05](./tasks/task-05-luxe-theme-refactor.md) |

### 🟠 Medium Priority

| # | Task | Plan | Task File |
|---|------|------|-----------|
| T-06 | Minimal theme build | [WF-02](./workflow/wf-02-theme-development.md) | [task-06](./tasks/task-06-minimal-theme.md) |
| T-07 | Coastal theme build | [WF-02](./workflow/wf-02-theme-development.md) | [task-07](./tasks/task-07-coastal-theme.md) |
| T-08 | Owner dashboard — theme picker UI | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-08](./tasks/task-08-theme-picker.md) |
| T-09 | Admin panel — theme management page | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-09](./tasks/task-09-admin-themes.md) |

### 🔴 Critical (Phase 1 — Legal/Safety)

| # | Task | Plan | Notes |
|---|------|------|-------|
| T-10 | Audit Log System | [Part 11](./plan/part-11-future-roadmap.md) | Admin action log — legal risk ছাড়া implement করা unsafe |
| T-11 | Admin Notification Center | [Part 11](./plan/part-11-future-roadmap.md) | Signup/payment fail/cancel alerts |
| T-12 | Churn Risk Indicators | [Part 11](./plan/part-11-future-roadmap.md) | lastLoginAt, booking activity, at-risk badge |

### 🟡 High Priority (Phase 2 — $1k MRR-এর আগে)

| # | Task | Plan | Notes |
|---|------|------|-------|
| T-13 | MRR Growth Analytics | [Part 11](./plan/part-11-future-roadmap.md) | Month-over-month chart, NRR, LTV |
| T-14 | CSV / PDF Export | [Part 11](./plan/part-11-future-roadmap.md) | Finance-friendly export formats |
| T-15 | Referral Tracking | [Part 11](./plan/part-11-future-roadmap.md) | ?ref= param, affiliate dashboard |

### 🟠 Medium Priority (Phase 3 — Team Scale)

| # | Task | Plan | Notes |
|---|------|------|-------|
| T-16 | Admin Role Granularity | [Part 11](./plan/part-11-future-roadmap.md) | SUPPORT / FINANCE / VIEWER roles |
| T-17 | Feature Flags per Tenant | [Part 11](./plan/part-11-future-roadmap.md) | Beta feature rollout control |
| T-18 | Platform Communication Center | [Part 11](./plan/part-11-future-roadmap.md) | Announcements + broadcast email |

### 🔵 Low Priority / Future (Phase 4–5)

| # | Task | Notes |
|---|------|-------|
| T-19 | GDPR Compliance Suite | EU market + enterprise গেলে mandatory |
| T-20 | Platform Health Dashboard | Uptime, error rate, DB metrics |
| T-21 | SLA & Enterprise Onboarding | Custom contracts, SSO, white-label |
| T-22 | Owner Analytics Dashboard | Charts, revenue trends, occupancy |
| T-23 | Mobile app (Expo) | Guest-facing booking app |
| T-24 | AI Features | Room descriptions, smart pricing, chatbot |
| T-25 | Theme Marketplace | Third-party themes, revenue share |
| T-26 | Multi-language support | i18n — EN/BN/AR/FR |
| T-27 | Custom domain per resort | DNS + Let's Encrypt SSL |

---

### 🏨 Owner Dashboard — Operations Phase (Phase 6)

> Resort owner হিসেবে daily operation-এ যা লাগে — core operational gaps।

#### 🔴 Critical (Daily Use — করা না হলে product incomplete)

| # | Task | Notes |
|---|------|-------|
| T-28 | **Visual Booking Calendar (Gantt View)** | Room × Date grid। কোন room কোন দিন booked/vacant — front desk-এর #1 tool। Color-coded status (booked/check-in today/checkout today/blocked)। Click → booking detail। |
| T-29 | **Check-in / Check-out Flow** | Guest arrival → check-in করো, room assign করো, key note। Departure → checkout trigger, room → housekeeping queue। Booking status: confirmed → checked_in → checked_out। |
| T-30 | **Guest Invoice / Folio** | Room charges + restaurant orders + extras = itemized bill। Printable PDF। Tax calculation (VAT/GST)। Send via email। Checkout-এ auto-generate। |

#### 🟡 Important (Weekly Use)

| # | Task | Notes |
|---|------|-------|
| T-31 | **Rate Plans & Seasonal Pricing** | Multiple rate plans per room (Standard, Weekend, Peak, Early Bird, Last-minute)। Date range + % or fixed price। Override per booking। |
| T-32 | **Guest Communication (Auto Emails)** | Booking confirmation → guest email। Check-in reminder (1 day before)। Checkout invoice email। Cancellation notice। Resend integration। |
| T-33 | **Walk-in Booking (Front Desk Quick Add)** | Guest directly এসে গেছে — quick booking form। Room availability instant check। Cash/card payment mark। No online flow needed। |
| T-34 | **Maintenance Tracking** | Room out-of-order, AC broken, plumbing — maintenance ticket তৈরি। Staff assign। Priority (urgent/normal)। Room status → maintenance (blocked from booking)। Resolved mark। |
| T-35 | **Daily / Shift Report** | দিনের summary: check-ins, check-outs, occupancy %, revenue, pending payments। Printable। Owner/manager daily এইটা দেখে। |

#### 🟢 Nice to Have (Future Enhancement)

| # | Task | Notes |
|---|------|-------|
| T-36 | **Package Deals** | Room + Breakfast, Honeymoon Package (room + flowers + dinner), Adventure Package। Custom bundle pricing। Public website-এ show। |
| T-37 | **Group Booking** | Wedding/event — একসাথে multiple rooms। Single booking reference। Group discount। Contact person + billing to one account। |
| T-38 | **Guest Loyalty Program** | Repeat guest tracking। Visit count, total spend। Loyalty tier (Silver/Gold/Platinum)। Auto-discount for returning guests। |
| T-39 | **Expense & Cost Tracking** | Operating expenses — utilities, vendor payments, supplies। Category-wise। Monthly P&L view (revenue vs expenses)। |

---

## 📌 How to Start Next Task

1. Backlog থেকে সবচেয়ে উপরের task নাও
2. Task file খোলো (link above)
3. Branch তৈরি করো (task file-এ branch name আছে)
4. কাজ শুরু করো — task file-এর steps follow করো
5. এই file-এ "Current Task" section update করো

---

## 📝 Session Log

| Date | Task | কী হয়েছে |
|------|------|----------|
| 2026-05-14 | Setup + Auth + Dashboard + Stripe + Admin + Business Control + Docs | Initial build complete |
| 2026-05-14 | Task files T-01 to T-09 | docs/tasks/ folder-এ সব task files তৈরি। T-01 to T-09 ready for implementation. |
| 2026-05-14 | T-01 | Availability Calendar API endpoint সম্পূর্ণ। GET /site/:slug/availability/calendar implemented + tested. |
| 2026-05-14 | T-02 | AvailabilityCalendar widget তৈরি + LuxeTemplate-এ inject। Calendar → Booking pre-fill কাজ করছে। main-এ merge। |
| 2026-05-14 | T-03 | Theme system foundation। types.ts, registry.ts, luxe/index.tsx, page.tsx update, Theme DB model + seed। |
| 2026-05-14 | T-04 | BookingForm, MenuWidget, ContactForm extracted। LuxeTemplate 756 lines reduced। Widget-based architecture। |
| 2026-05-14 | T-05 | LuxeTemplate refactored → themes/luxe/ (sections/ + components/ + utils.tsx + config.ts). LuxeTheme fully assembled. feature/theme-system → main merged। |
| 2026-05-14 | T-06 | Minimal Clean theme built। 7 sections, horizontal room cards, blue-600 palette, registered in THEME_REGISTRY। main-এ merge। |
| 2026-05-14 | T-07 | Coastal Breeze theme built। 10 sections, wave SVG dividers, AmenitiesSection, split booking panel, dark cyan footer। main-এ merge। |
| 2026-05-14 | T-08 | Theme picker UI। GET /site/:slug/themes API + ThemePicker component (DB-driven, fallback list, color hints, active ring)। website/page.tsx updated। |
| 2026-05-14 | T-09 | Admin theme management। GET/PUT/PATCH theme CRUD API + /admin/themes page (inline edit, toggle, usage count, Add modal)। Part 04B ✅ |
| 2026-05-14 | Business Planning | Part 06 Super Admin future-proof analysis। 7 critical gaps চিহ্নিত। Part 11 roadmap তৈরি (T-10 to T-27, 5 phases)। part-06 updated + part-11-future-roadmap.md created। |
| 2026-05-14 | T-10 | Audit Log System সম্পূর্ণ। AuditLog Prisma model + db push। logAdminAction() helper। 7 routes-এ logging (impersonate, suspend, plan_change, extend_trial, export, theme_update, theme_toggle, settings_change)। GET /api/admin/audit-log API (pagination + 5 filters)। /admin/audit-log page (action badge, target, metadata detail, IP, timeAgo, pagination)। Admin nav-এ Audit Log link। |
| 2026-05-14 | T-11 | Admin Notification Center সম্পূর্ণ। AdminNotification Prisma model। createAdminNotification() helper (utils/notifications.ts)। Triggers: new_signup (auth.ts), payment_failed + subscription_canceled (billing.ts webhook), account_suspended (admin.ts)। GET/PATCH /api/admin/notifications API। NotificationBell component (Bell icon, unread badge, dropdown, mark-one/mark-all read, 30s auto-poll, click→navigate)। Admin layout header-এ integrated। |
| 2026-05-14 | T-12 | Churn Risk Indicators সম্পূর্ণ। computeChurnRisk() utility (score 0-100, HIGH/MEDIUM/LOW/NONE, reasons array, login + booking signals)। Admin tenants API: owner lastLoginAt + last30/prev30 bookings inject → churnRisk per tenant। GET /api/admin/churn-risk endpoint (top 10 sorted by score + summary)। Dashboard page: ChurnRisk widget (summary strip 3-col, top 6 tenant rows with score bar + reasons)। Tenant table: Risk badge column (emoji label + days-no-login)। |
| 2026-05-15 | T-13 | MRR Growth Analytics সম্পূর্ণ। GET /api/admin/mrr-growth: 12-month DB-derived timeline (trialEndsAt as conversion proxy), NRR, LTV per plan, ARPU, MoM growth rate। Billing page full rebuild: 4 MetricCards (MRR, paying customers, ARPU, NRR), Recharts ComposedChart with Total MRR / Breakdown toggle, LTV by plan, Revenue by plan progress bars, Trials expiring + Active subscriptions। |
| 2026-05-15 | T-14 | CSV/PDF Export সম্পূর্ণ। 3 API endpoints: GET /export/tenants-csv (21 columns, BOM for Excel), GET /export/revenue-csv (12mo MRR), GET /tenants/:id/export-csv (bookings flat CSV + audit log)। /admin/export page: Revenue card (CSV + PDF), All Tenants card, per-tenant search + download list। Browser print-to-PDF: branded HTML report (KPIs + MRR table + platform summary + revenue metrics)। Admin nav-এ Download icon। |
| 2026-05-15 | T-20 | Platform Health Dashboard সম্পূর্ণ। metrics.ts ring buffer (2000 entries). normalizePath(). onResponse Fastify hook. GET /api/admin/health: process+DB+platform+requests. Auto-refresh 30s. /admin/health: status indicator, 4 metric cards, AreaChart (req+errors 60min 5-min buckets), memory bars, latency BarChart, DB table list, slow endpoints, platform counts. Admin nav: Activity link. 0 TS errors. |
| 2026-05-15 | T-19 | GDPR Compliance Suite সম্পূর্ণ। Schema: gdprErasureRequestedAt/By + gdprAnonymizedAt + deletedAt on Tenant. anonymizeTenant() (sha256 hash, null PII, idempotent). collectTenantExport() Article 20. getPendingErasures() 30d grace. gdpr-purge.ts cron script. Admin: 5 GDPR endpoints. Tenant: request-erasure + data export. /admin/gdpr page (summary cards, pending/done rows, 3-action buttons). Tenant settings: Privacy & GDPR tab. Admin nav: ShieldCheck link. 0 TS errors. |
| 2026-05-15 | T-18 | Platform Communication Center সম্পূর্ণ। PlatformAnnouncement Prisma model. Admin CRUD + broadcast email (Resend, plan-filtered, allSettled). GET /api/tenant/announcements (active+plan-filtered). PlatformBanner component (stacked, localStorage dismiss, type-colored). Injected in (dashboard)/layout.tsx. Admin page: type picker, plan chips, date range, dismissible toggle, Live/Inactive sections, Broadcast button. Admin nav: Megaphone link. 0 TS errors. |
| 2026-05-15 | T-17 | Feature Flags per Tenant সম্পূর্ণ। TenantFeatureFlag Prisma model (unique tenantId+flag, updatedBy). FLAG_REGISTRY: 10 flags across Analytics/AI/Reporting/UX/Beta. Admin: GET /feature-flags registry, GET+PATCH /tenants/:id/flags (single + bulk). Tenant: GET /api/tenant/flags (enabled keys). useFeatureFlag + useFeatureFlags hooks (in-memory cache). /admin/tenants/:id — grouped toggle UI with audit trail + role gate (SUPPORT+). Flag icon in tenants list. 0 TS errors. |
| 2026-05-15 | T-16 | Admin Role Granularity সম্পূর্ণ। AdminRole enum + AdminUser Prisma model। seed-admin.ts script (seeded asadsnapper@gmail.com as SUPER_ADMIN)। Login → AdminUser table (not tenant user). JWT: adminRole claim + backward-compat isSuperAdmin। requireAdminRole(roles[]) middleware। 25+ routes role-gated (VIEWER=read, SUPPORT=extend-trial+audit, FINANCE=billing+export, SUPER_ADMIN=all writes). /api/admin/team CRUD (GET/POST/PATCH/DELETE). /admin/team page: role cards, member table, Add/Edit modal, activate toggle. Zustand store: adminRole + hasRole(). Admin nav: UserCog + Team link. 0 new TS errors. |
| 2026-05-15 | T-15 | Referral Tracking সম্পূর্ণ। Prisma: referralCode (unique) + referredById self-relation। generateReferralCode() util। Auth register: ?ref= capture + referrer lookup + new code generation (collision retry)। GET /api/admin/referrals: summary stats + referrer leaderboard + recent signups। /admin/referrals page: 5 stat cards + expandable table (copy button, conversion bar, MRR) + Recent Signups sidebar। Register page: amber banner for ?ref= param। Admin nav: Gift icon + Referrals link। TypeScript clean (web: 0 new errors, pre-existing login.tsx error not ours)। |

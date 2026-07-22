# Part 11 — Future Roadmap & Business Planning

> **Business planning analysis থেকে তৈরি।** এই document টি product এবং business direction guide করবে।
> প্রতিটি phase-এ milestone আছে — milestone hit করলে পরের phase শুরু করো।

---

## 🗺️ Phase Overview

| Phase | Trigger | Focus |
|-------|---------|-------|
| **Phase 1** — Foundation Hardening | এখনই | Security, audit, compliance basics |
| **Phase 2** — Revenue Optimization | $1k MRR | Churn prevention, revenue analytics |
| **Phase 3** — Team Scale | 2nd team member | Role management, feature flags |
| **Phase 4** — Enterprise / EU | First enterprise lead | GDPR, SLA, DPA, health monitoring |
| **Phase 5** — Platform Expansion | $10k MRR | Mobile app, marketplace, AI features |

---

## Phase 1 — Foundation Hardening
**Milestone:** করো এখনই। Legal এবং safety risk।

### T-10: Audit Log System
**Why:** Admin কোনো action করলে কোনো record নেই। Legal dispute, internal accountability, GDPR compliance-এ এটা mandatory।

**Tasks:**
- [ ] `AuditLog` Prisma model add (see part-06 for schema)
- [ ] `logAdminAction()` helper function তৈরি
- [ ] সব admin route-এ log call add (impersonate, suspend, plan_change, export, settings)
- [ ] `/admin/audit-log` page — searchable/filterable table
- [ ] Admin API: `GET /api/admin/audit-log` with pagination + filters

**Estimated effort:** 1 session

---

### T-11: Admin Notification Center
**Why:** কেউ signup করলে, payment fail হলে, trial expire হলে — কোনো alert নেই। Blind spot।

**Tasks:**
- [ ] `AdminNotification` Prisma model (type, message, isRead, metadata, createdAt)
- [ ] Stripe webhook handlers:
  - `invoice.payment_failed` → notification
  - `customer.subscription.deleted` → notification
- [ ] Tenant create → notification
- [ ] Bell icon in admin layout header (unread count badge)
- [ ] Dropdown panel — mark as read, link to relevant page

**Estimated effort:** 1 session

---

### T-12: Churn Risk Indicators
**Why:** তুমি জানতে পারবে না কে cancel করতে যাচ্ছে।

**Tasks:**
- [ ] `lastLoginAt` field — Owner login হলে tenant record update
- [ ] Booking activity score — last 30 days booking count
- [ ] Churn risk calculation:
  - 🔴 HIGH: 30+ দিন কোনো owner login নেই OR 0 bookings this month
  - 🟡 MEDIUM: 14–29 দিন inactive OR bookings 50% drop
  - 🟢 LOW: Active within 7 days
- [ ] Tenant table-এ risk badge column
- [ ] Dashboard "At Risk Tenants" widget (top 5)

**Estimated effort:** 1 session

---

## Phase 2 — Revenue Optimization
**Milestone:** $1k MRR hit করার আগে।

### T-13: MRR Growth Analytics
**Why:** MRR number আছে কিন্তু trend নেই। Investors / self-tracking-এর জন্য দরকার।

**Tasks:**
- [ ] Stripe API integration — fetch historical subscription data
- [ ] Monthly MRR breakdown:
  - New MRR (new customers)
  - Expansion MRR (upgrades)
  - Churned MRR (cancellations)
  - Net MRR = New + Expansion - Churned
- [ ] Recharts line chart — 12 months rolling
- [ ] Net Revenue Retention (NRR) calculation
- [ ] LTV per plan (ARPU × avg subscription length)
- [ ] Billing page-এ add

**Estimated effort:** 1–2 sessions

---

### T-14: CSV / PDF Export
**Why:** Finance team Excel চায়। JSON কেউ manually open করে না।

**Tasks:**
- [ ] Tenant data → CSV (all fields, flat structure)
- [ ] All tenants → ZIP of CSVs
- [ ] Monthly revenue summary → PDF (branded)
- [ ] Per-tenant invoice PDF
- [ ] Admin export page: `/admin/export`

**Libraries:** `papaparse` (CSV), `@react-pdf/renderer` (PDF)

**Estimated effort:** 1 session

---

### T-15: Referral & Affiliate Tracking
**Why:** Organic growth চাইলে referral program দরকার। Cost-effective acquisition।

**Tasks:**
- [ ] `referralCode` field on Tenant
- [ ] Signup page-এ `?ref=CODE` param capture
- [ ] Referral dashboard (admin): who referred whom, conversion rate
- [ ] Affiliate payout tracking (manual initially)

**Estimated effort:** 1 session

---

## Phase 3 — Team Scale
**Milestone:** দ্বিতীয় team member (support/finance) যোগ হলে।

### T-16: Admin Role Granularity
**Why:** এখন সবাই full super admin। Support person-কে full access দেওয়া unsafe।

**New roles:**

| Role | Permissions |
|------|-------------|
| `SUPER_ADMIN` | Everything |
| `SUPPORT` | View tenants, impersonate, extend trial, view audit log |
| `FINANCE` | Billing page, export, MRR analytics |
| `VIEWER` | Read-only — all pages, no actions |

**Tasks:**
- [ ] `AdminUser` Prisma model (email, role, passwordHash, createdAt)
- [ ] Replace `SUPER_ADMIN_EMAILS` env var with DB-based auth
- [ ] Role-based middleware: `requireAdminRole(['SUPER_ADMIN', 'SUPPORT'])`
- [ ] Admin user management page: `/admin/team`
- [ ] Invite admin via email (role selection)

**Estimated effort:** 2 sessions

---

### T-17: Feature Flags per Tenant
**Why:** Beta feature নতুন tenant-এ test করতে চাইলে এখন সবার জন্য deploy করতে হয়।

**Tasks:**
- [ ] `TenantFeatureFlag` Prisma model (tenantId, flag, enabled)
- [ ] `useFeatureFlag(flag)` hook in tenant dashboard
- [ ] Admin UI: tenant detail-এ flag toggle list
- [ ] Predefined flags: `beta_analytics`, `ai_suggestions`, `advanced_reports`

**Estimated effort:** 1 session

---

### T-18: Platform Communication Center
**Why:** Maintenance announcement, new feature rollout — tenant-কে notify করার কোনো way নেই।

**Tasks:**
- [ ] `PlatformAnnouncement` model (title, body, type: info/warning/maintenance, targetPlan, startsAt, endsAt)
- [ ] Admin: create/edit/delete announcements
- [ ] Tenant dashboard: in-app banner for active announcements
- [ ] Email broadcast (via Resend) to selected tenant segments

**Estimated effort:** 1 session

---

## Phase 4 — Enterprise / EU Market
**Milestone:** First enterprise lead অথবা EU customer।

### T-19: GDPR Compliance Suite
**Tasks:**
- [ ] **Right to Erasure:** Tenant delete → PII anonymize (name/email/phone hash করা)
- [ ] **Data retention:** `deletedAt` + 30-day grace → scheduled purge job
- [ ] **Data export (GDPR format):** Machine-readable JSON (already ✅) + human-readable PDF
- [ ] **DPA auto-generation:** Data Processing Agreement PDF per tenant
- [ ] **Cookie consent:** Public website-এ per-resort configurable banner
- [ ] **Privacy policy:** Admin-settable URL per tenant

**Estimated effort:** 2–3 sessions

---

### T-20: Platform Health Dashboard
**Why:** API down হলে কীভাবে জানবে? DB slow হলে কীভাবে জানবে?

**Tasks:**
- [ ] `/admin/health` page:
  - API uptime (last 24h)
  - Response time p50/p95 (track in Redis)
  - Error rate (5xx/hour)
  - DB connection pool status
  - Email delivery rate (Resend webhook stats)
  - Stripe webhook success rate
- [ ] Simple alert: email to super admin if error rate > 5%
- [ ] Status page (public): `status.resortpro.com` — for customer trust

**Estimated effort:** 2 sessions

---

### T-21: SLA & Enterprise Onboarding
**Tasks:**
- [ ] Enterprise plan: custom limits, dedicated support SLA
- [ ] White-label option: custom domain for admin panel
- [ ] SSO / SAML support for enterprise tenant login
- [ ] Custom contract / invoice generation
- [ ] Enterprise trial: manual activation (no credit card)

**Estimated effort:** 3–4 sessions

---

## Phase 5 — Platform Expansion
**Milestone:** $10k MRR।

### T-22: Analytics Dashboard (Owner)
Revenue trends, occupancy rate, guest demographics, booking source analysis.
> See backlog T-11 in PROGRESS.md

### T-23: Mobile App (Expo)
Guest-facing mobile app — booking, room service, chat with hotel.
> See backlog T-10 in PROGRESS.md

### T-24: AI Features
- AI room description generator (OpenAI API)
- Smart pricing suggestions (based on occupancy)
- Guest review sentiment analysis
- Chatbot for public website (per resort)

### T-25: Theme Marketplace
- Third-party theme developers can submit themes
- Paid themes (revenue share model)
- Theme review/approval workflow in admin

### T-26: Multi-language (i18n)
- Dashboard: EN / BN (Bangla) / AR / FR
- Public website: per-resort language config
> See backlog T-12 in PROGRESS.md

### T-27: Custom Domain per Resort
- Tenant sets their own domain (e.g., `booking.grandresort.com`)
- Automatic SSL via Let's Encrypt
- DNS verification flow
> See backlog T-13 in PROGRESS.md

---

## 📋 Updated Backlog (Merged with PROGRESS.md)

Add these to `PROGRESS.md` backlog in order:

| # | Task | Phase | Priority |
|---|------|-------|----------|
| T-10 | Audit Log System | Phase 1 | 🔴 Critical |
| T-11 | Admin Notification Center | Phase 1 | 🔴 Critical |
| T-12 | Churn Risk Indicators | Phase 1 | 🔴 Critical |
| T-13 | MRR Growth Analytics | Phase 2 | 🟡 High |
| T-14 | CSV / PDF Export | Phase 2 | 🟡 High |
| T-15 | Referral Tracking | Phase 2 | 🟡 High |
| T-16 | Admin Role Granularity | Phase 3 | 🟠 Medium |
| T-17 | Feature Flags per Tenant | Phase 3 | 🟠 Medium |
| T-18 | Platform Communication Center | Phase 3 | 🟠 Medium |
| T-19 | GDPR Compliance Suite | Phase 4 | 🔵 Future |
| T-20 | Platform Health Dashboard | Phase 4 | 🔵 Future |
| T-21 | SLA & Enterprise Onboarding | Phase 4 | 🔵 Future |
| T-22 | Owner Analytics Dashboard | Phase 5 | 🔵 Future |
| T-23 | Mobile App (Expo) | Phase 5 | 🔵 Future |
| T-24 | AI Features | Phase 5 | 🔵 Future |
| T-25 | Theme Marketplace | Phase 5 | 🔵 Future |
| T-26 | Multi-language (i18n) | Phase 5 | 🔵 Future |
| T-27 | Custom Domain per Resort | Phase 5 | 🔵 Future |

---

## 💡 Key Business Principles

1. **Audit before scale** — Log everything before adding more admins
2. **Churn visibility before growth** — Know who's leaving before acquiring more
3. **Revenue depth before width** — Understand existing MRR before chasing new customers
4. **Compliance before enterprise** — GDPR is the gate to EU/enterprise market
5. **Health monitoring before reliability promises** — SLA requires knowing uptime

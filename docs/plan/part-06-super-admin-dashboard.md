# Part 06 — Super Admin Dashboard

## Overview
ResortPro-র owner (আমি) সব tenant, revenue, user control করতে পারি। এটি একটি আলাদা login সহ completely separate panel।

---

## Access Control
- `/admin/login` — আলাদা login page (slug লাগে না)
- `SUPER_ADMIN_EMAILS` env var-এ যাদের email আছে শুধু তারাই login করতে পারেন
- JWT-এ `isSuperAdmin: true` claim থাকে
- সব admin route `requireSuperAdmin` middleware দিয়ে protect করা

---

## Admin Pages

### 1. Overview (`/admin/dashboard`)
**Stats Cards:**
- MRR, ARR, Max Potential MRR
- Conversion rate (trial → paid %)
- Total Tenants (active count)
- On Trial count
- Total Users
- Suspended accounts
- Total Rooms, Total Bookings, Avg Rooms/Tenant

**Plan Distribution Chart:**
- Color-coded bars per plan
- Percentage of total tenants

**Recent Signups:**
- Last 8 signups
- Status badge + trial days remaining
- Hover → Login as / View tenant buttons

**Quick Actions:**
- Manage Tenants, Billing & MRR, All Users, Platform Settings

---

### 2. Tenants (`/admin/tenants`)
**Table columns:** Name/Slug, Plan badge, Status + suspension badge, Stats (users/rooms/bookings), Join date, Actions

**Filters:** Search (name/slug/email), Status filter, Plan filter

**Per-tenant Actions:**
- **Edit** — Change plan, extend trial
- **Export** — Download full tenant data as JSON
- **Login as →** — Impersonate tenant owner (2-hour session)
- **Suspend / Reactivate** — Toggle account access

**Edit Modal:**
- Change plan (FREE / STARTER / PROFESSIONAL / ENTERPRISE)
- Extend trial by N days (uses `/extend-trial` endpoint — calculates from current end date)

---

### 3. Users (`/admin/users`)
- All users across all tenants
- Search by name / email
- Filter by role (OWNER, MANAGER, STAFF)
- Shows which tenant each user belongs to

---

### 4. Billing & MRR (`/admin/billing`)
- MRR + ARR totals
- Paying customers count
- Trialing count + potential MRR
- Revenue breakdown by plan (progress bars)
- **Trials expiring in 7 days** — days remaining badge
- Active subscriptions table (plan, MRR, renewal date, Stripe customer ID)

---

### 5. Settings (`/admin/settings`)
**Trial Duration:**
- Drag slider (1–90 days)
- Quick buttons: 7 / 14 / 21 / 30 days
- Custom number input
- Applies to all new signups immediately

**Plan Editor:**
- Edit any plan's: key, display name, monthly price (USD), room limit
- Add / remove feature bullets per plan
- Add completely new plans
- Delete existing plans
- Collapse / expand each plan card
- Live preview — exactly what customers see on upgrade page

---

## Admin API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/admin/login` | Admin login (no slug) |
| GET | `/api/admin/me` | Current admin info |
| GET | `/api/admin/stats` | Overview statistics |
| GET | `/api/admin/tenants` | Paginated tenant list |
| PATCH | `/api/admin/tenants/:id` | Update plan/status |
| DELETE | `/api/admin/tenants/:id` | Suspend tenant |
| POST | `/api/admin/tenants/:id/impersonate` | Login as tenant owner |
| GET | `/api/admin/tenants/:id/export` | Export tenant data (JSON) |
| POST | `/api/admin/tenants/:id/extend-trial` | Extend trial by N days |
| GET | `/api/admin/users` | All users (paginated) |
| GET | `/api/admin/billing` | MRR + billing data |
| GET | `/api/admin/settings` | Platform settings |
| PUT | `/api/admin/settings` | Update platform settings |

---

## Tenant Impersonation
```
POST /api/admin/tenants/:id/impersonate
→ 2-hour JWT issued as tenant's OWNER user
→ Refresh token DB-তে store হয়
→ Admin সেই tenant-এর dashboard-এ login করেন
→ সব feature কাজ করে (bookings, rooms, etc.)
```

---

## Data Export (per tenant)
```json
{
  "exportedAt": "2026-01-01T00:00:00Z",
  "tenant": { ... },
  "summary": { totalRooms, totalBookings, totalGuests, totalUsers },
  "rooms": [...],
  "bookings": [...],  // with guest + room info
  "guests": [...],
  "users": [...]
}
```
File download: `resortpro-export-{slug}-{date}.json`

---

## Key Files
| File | Purpose |
|------|---------|
| `apps/api/src/routes/admin.ts` | সব admin API endpoints |
| `apps/web/src/lib/admin-api.ts` | Admin Axios instance + endpoints |
| `apps/web/src/store/admin.ts` | Admin Zustand store |
| `apps/web/src/app/admin/login/` | Admin login page |
| `apps/web/src/app/admin/(panel)/` | Admin panel layout + all pages |

---

## ⚠️ Known Gaps (Future Work)

> Business planning analysis থেকে চিহ্নিত। Phase অনুযায়ী implement করতে হবে।

### 🔴 Phase 1 — Critical (legal/safety risk — এখনই করা উচিত)

#### Audit Log
Admin-এর প্রতিটি action log করতে হবে।

**DB Model:**
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  adminEmail String
  action     String   // impersonate | suspend | plan_change | export | settings_change | toggle_theme
  targetType String   // tenant | user | theme | settings
  targetId   String?
  metadata   Json?    // before/after values
  createdAt  DateTime @default(now())
}
```

**কোথায় log করতে হবে:**
- `POST /tenants/:id/impersonate` → `action: impersonate`
- `PATCH /tenants/:id` → `action: plan_change` (metadata: `{ from, to }`)
- `DELETE /tenants/:id` → `action: suspend`
- `GET /tenants/:id/export` → `action: export`
- `PUT /settings` → `action: settings_change`
- `PUT|PATCH /themes/:key` → `action: toggle_theme | update_theme`

**Admin page:** `/admin/audit-log` — searchable table, filter by action/admin/date range

---

#### Soft Delete / Data Retention Policy
- Suspend = `isActive: false` (already done ✅)
- Hard delete = আলাদা endpoint, 30-day grace period, then purge PII
- `deletedAt` field add করতে হবে `Tenant` model-এ
- Purge job: scheduled cron — `deletedAt` + 30 days পার হলে PII anonymize

---

### 🟡 Phase 2 — Important ($1k MRR-এর আগে)

#### Churn Indicators
Tenant table + dashboard-এ risk signals দেখাতে হবে।

**Data points needed:**
- `lastLoginAt` — Owner-এর শেষ login timestamp
- Booking activity (last 30 days vs previous 30 days)
- "At Risk" badge: 30+ দিন কোনো booking নেই = 🔴, 14 দিন = 🟡

**Admin tenant row-এ add:**
```
[🔴 At Risk] [Last login: 23 days ago] [0 bookings this month]
```

#### MRR Growth Chart
- Month-over-month MRR bar/line chart (Recharts)
- Data source: Stripe `subscriptions` API — group by month
- Show: New MRR | Expansion MRR | Churned MRR | Net MRR
- Billing page-এ add করতে হবে

#### Admin Notification Center
Real-time alerts for key events:

| Event | Trigger |
|-------|---------|
| New signup | Tenant created |
| Trial expiring | 3 days before end |
| Payment failed | Stripe webhook `invoice.payment_failed` |
| Cancellation | Stripe webhook `customer.subscription.deleted` |
| Account suspended | Admin action |

**UI:** Bell icon in admin header — unread count badge — dropdown list

---

### 🔵 Phase 3 — Scale (team বড় হলে)

#### Admin Role Granularity
এখন `SUPER_ADMIN_EMAILS` = full access। Team বড় হলে granular roles দরকার।

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | Everything |
| `SUPPORT` | View tenants, impersonate, extend trial |
| `FINANCE` | Billing page, export only |
| `VIEWER` | Read-only dashboard |

**DB:** `AdminUser` model (email, role, createdAt) — replace env-var approach

#### Feature Flags per Tenant
Beta features specific tenant-এ test করার জন্য।

```prisma
model TenantFeatureFlag {
  id       String  @id @default(cuid())
  tenantId String
  flag     String  // e.g. "beta_analytics", "ai_room_suggestions"
  enabled  Boolean @default(false)
  tenant   Tenant  @relation(...)
}
```

**Admin UI:** Tenant detail page-এ feature flag toggle list

---

### ⚪ Phase 4 — Enterprise / EU Market

#### GDPR Compliance Tools
- **Right to Erasure:** Tenant delete করলে সব PII anonymize (name → "Deleted User", email → hash)
- **Data Export (GDPR):** Machine-readable format (JSON ✅ already) — add CSV option
- **Data Processing Agreement:** Auto-generate DPA PDF per tenant
- **Cookie consent:** Public website-এ consent banner (per-resort config)

#### Platform Health Dashboard
- API response time (p50, p95, p99)
- Error rate (5xx per hour)
- DB connection pool status
- Email delivery rate (Resend webhook stats)
- Stripe webhook success rate
- Active sessions count

**Tool:** Prometheus metrics → Grafana, অথবা simple custom `/admin/health` page

#### CSV / PDF Export
- Tenant data → CSV (Finance team-এর জন্য Excel-friendly)
- Monthly invoice PDF per tenant
- Bulk export (all tenants → ZIP of CSVs)

---

## 📊 Future-Proof Scorecard

| Category | Current | Target |
|----------|---------|--------|
| Core CRUD ops | ✅ 9/10 | — |
| Revenue visibility | 🟡 6/10 | Phase 2: 9/10 |
| Security & Audit | 🔴 3/10 | Phase 1: 9/10 |
| Churn prevention | 🔴 2/10 | Phase 2: 8/10 |
| Team scalability | 🔴 2/10 | Phase 3: 8/10 |
| Platform observability | 🔴 1/10 | Phase 4: 8/10 |
| GDPR / Compliance | 🔴 1/10 | Phase 4: 8/10 |

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

# Dashboard System — Plan & Status

## Overview

The dashboard is the home screen for every logged-in hotel/resort user. It provides a live snapshot of operations: room stats, revenue, today's arrivals/departures, occupancy chart, recent bookings, and low-stock alerts.

## Architecture

```
apps/web/src/app/(dashboard)/layout.tsx          ← Auth guard + billing check
apps/web/src/app/(dashboard)/dashboard/page.tsx  ← Main dashboard UI
apps/api/src/routes/dashboard.ts                 ← Four API endpoints
```

## API Endpoints (`/api/dashboard`)

| Route | Description |
|-------|-------------|
| `GET /` | Stats, recent bookings, low-stock alerts |
| `GET /revenue` | Monthly revenue chart (last 12 months) |
| `GET /occupancy` | Daily occupancy rate (last 30 days) |
| `GET /today` | Today's arrivals, departures, in-house count |
| `GET /analytics` | Full owner analytics (KPIs, ADR, RevPAR, etc.) |

## Frontend Data Access Pattern

All dashboard queries use `ok()` — single-item response:

```typescript
// Stats
const stats = statsRes?.data?.data?.stats;
const recentBookings = statsRes?.data?.data?.recentBookings || [];
const lowStock = statsRes?.data?.data?.lowStockAlerts || [];

// Revenue / Occupancy
const revenueData = revenueRes?.data?.data || [];
const occupancyData = occupancyRes?.data?.data || [];

// Today
const todayData = todayRes?.data?.data;
const arrivals  = todayData?.arrivals || [];
const departures = todayData?.departures || [];
const inHouseCount = todayData?.summary?.inHouseCount || 0;
```

## Layout — Auth & Billing Guard

`layout.tsx` handles:
1. Redirect to `/auth/login` if not authenticated
2. Skip billing check for demo tenants
3. Skip billing check for exempt paths (`/dashboard/upgrade`, `/dashboard/suspended`, `/dashboard/billing`)
4. Fetch live billing status with 5 s timeout — if API is slow/offline, allows access
5. Redirects to `/dashboard/suspended` if `tenantIsActive === false`
6. Redirects to `/dashboard/upgrade` if trial expired or plan is `canceled`/`past_due`

## Bug Fixes

### 1. Low-stock alerts only checked first 5 inventory items

**File:** `apps/api/src/routes/dashboard.ts`

**Root cause:** The `lowInventory` query used `take: 5` to fetch only the first 5 inventory items (ordered by `createdAt`), then applied a client-side filter for low stock. If none of the 5 happened to be low, no alerts would appear even with genuinely low-stock items in the database.

**Fix:** Removed `take: 5` from the DB query so all items are fetched, then filter client-side for low stock, and `.slice(0, 5)` to cap at 5 alerts.

```typescript
// Before
prisma.inventoryItem.findMany({ where: { tenantId }, take: 5 })
// ...
const lowStockItems = lowInventory.filter(item => ...)

// After
prisma.inventoryItem.findMany({ where: { tenantId } })
// ...
const lowStockItems = lowInventory
  .filter(item => Number(item.currentStock) <= Number(item.minimumStock))
  .slice(0, 5);
```

### 2. Occupancy Rate card showed wrong "change" metric

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Root cause:** The `<StatCard>` for "Occupancy Rate" had `change={stats?.revenueGrowth}` — showing the revenue growth percentage as if it were an occupancy change, misleading users.

**Fix:** Removed `change` prop from Occupancy Rate card (API does not return occupancy growth, so no value to show).

```tsx
// Before
<StatCard title="Occupancy Rate" value={stats?.occupancyRate || 0} icon={TrendingUp} suffix="%" change={stats?.revenueGrowth} color="bg-blue-500" />

// After
<StatCard title="Occupancy Rate" value={stats?.occupancyRate || 0} icon={TrendingUp} suffix="%" color="bg-blue-500" />
```

### 3. Unused `Metadata` import in `'use client'` file

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Root cause:** `import type { Metadata } from 'next'` was left in — but `Metadata` can't be exported from a client component, and it was never used. TypeScript would warn about this.

**Fix:** Removed the unused import.

### 4. Hardcoded "Good morning" greeting

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

**Root cause:** The greeting was always "Good morning, {name}" regardless of the time of day.

**Fix:** Made greeting time-aware — "Good morning" before noon, "Good afternoon" 12–17, "Good evening" after 17.

```tsx
// Before
Good morning, {user?.firstName} 👋

// After
{(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}, {user?.firstName} 👋
```

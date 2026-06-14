# Analytics System — Plan & Status

## Overview

The Analytics page provides full owner-level insight into hotel/resort performance: revenue KPIs, occupancy trends, ADR/RevPAR, booking sources, guest nationalities, room type breakdown, and expense profitability.

## Architecture

```
apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx   ← Full analytics UI
apps/api/src/routes/dashboard.ts                            ← GET /api/dashboard/analytics
                                                              GET /api/dashboard/occupancy (reused)
```

## API Endpoints Used

| Endpoint | Data |
|----------|------|
| `GET /api/dashboard/analytics` | KPIs, revenue by month, room type breakdown, booking sources, guest nationalities, expense by category |
| `GET /api/dashboard/occupancy` | Daily occupancy rate for the last 30 days (reused from dashboard) |

## Frontend Data Access Pattern

Analytics uses raw `useEffect` + `useState` (not react-query):

```typescript
Promise.all([
  dashboardApi.getAnalytics(),
  dashboardApi.getOccupancy(),
]).then(([a, o]) => {
  setData(a.data.data);       // ok() → response.data.data
  setOccupancy(o.data.data);  // ok([]) → response.data.data
})
```

## Key Calculations (API)

- **ADR** (Average Daily Rate): `totalRevenue90d / totalNights90d`
- **RevPAR**: `totalRevenue90d / (totalRooms * 90)`
- **Revenue Growth**: `(mtdRevenue - lastMoRevenue) / lastMoRevenue * 100`
- **Profit Margin**: `(mtdRevenue - mtdExpenses) / mtdRevenue * 100`
- **Net Profit**: `mtdRevenue - mtdExpenses` (can be negative — loss scenario)

## Bug Fixes

### 1. Two dead DB queries in analytics endpoint

**File:** `apps/api/src/routes/dashboard.ts`

**Root cause:**
- `returningGuests` — queried with `prisma.guest.count({ where: { bookings: { some: {} } } })` which counts ANY guest with ≥1 booking (i.e. almost all guests), not returning guests (>1 booking). The result was never included in the `ok()` response — completely wasted.
- `allPaidPayments90` — fetched all paid payments for the last 90 days, but ADR/RevPAR calculations were already using `allBookings90.totalAmount` instead. The variable was dead.

**Fix:** Removed both dead queries from the `Promise.all` array. This removes two unnecessary DB round-trips on every analytics load.

### 2. No error handling on analytics data fetch

**File:** `apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx`

**Root cause:** The `Promise.all` had `.then(...)` and `.finally(...)` but no `.catch()`. If either API call fails (network error, 500, etc.), the promise rejects silently — `loading` becomes `false`, `data` stays `null`, and the page renders nothing with no feedback to the user.

**Fix:** Added `.catch()` to set an `error` state, and added a visible error message UI:

```typescript
.catch(() => {
  setError('Failed to load analytics. Please refresh the page.');
})
```

### 3. Net Profit card hid losses with `Math.max(0, ...)`

**File:** `apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx`

**Root cause:** The Net Profit KPI card used `Math.max(0, mtdRevenue - mtdExpenses)`. When expenses exceed revenue (a real-world loss scenario), this clamps to `$0` instead of showing the actual negative figure, giving the hotel owner false financial data.

**Fix:** Removed `Math.max(0, ...)` — if the hotel is running at a loss, the card now shows the negative value (e.g. `-$5,200`). The card's icon already dynamically switches to `TrendingDown` when `profitMarginMTD < 0`, so the loss state is visually signaled.

```tsx
// Before
value={formatCurrency(Math.max(0, (kpis.mtdRevenue ?? 0) - (kpis.mtdExpenses ?? 0)), currency)}

// After
value={formatCurrency((kpis.mtdRevenue ?? 0) - (kpis.mtdExpenses ?? 0), currency)}
```

### 4. Expense growth indicator color was inverted

**File:** `apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx`

**Root cause:** The `KpiCard` component treats positive `change` as green (good) and negative as red (bad). For revenue this is correct. But for expenses, a positive change (+20% month-over-month) is bad — costs are rising. Passing `change={kpis.expenseGrowth}` directly showed +20% expenses as a green badge, which is financially misleading.

**Fix:** Negate the expense growth value so the color logic is inverted for this card — rising expenses show red, falling expenses show green:

```tsx
// Before
change={kpis.expenseGrowth}

// After
change={kpis.expenseGrowth !== undefined ? -(kpis.expenseGrowth) : undefined}
```

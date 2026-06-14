# Expenses System — Plan & Status

## Overview

The Expenses system lets hotel/resort owners track operational costs (salaries, utilities, maintenance, etc.), view monthly summaries against revenue, and see 12-month profit/loss trends.

## Architecture

```
apps/web/src/app/(dashboard)/dashboard/expenses/page.tsx   ← Full expenses UI
apps/api/src/routes/expenses.ts                            ← REST API
```

## API Endpoints (`/api/expenses`)

| Route | Description |
|-------|-------------|
| `GET /` | List expenses with filters (month, category, pagination) |
| `POST /` | Create a new expense |
| `PATCH /:id` | Update an expense |
| `DELETE /:id` | Delete an expense |
| `GET /summary` | Monthly totals by category + revenue comparison + profit |
| `GET /trends` | 12-month expense + revenue + profit trend |

## Frontend Data Access Pattern

All expense endpoints return a custom shape (not `ok()` / `paginated()`):

```typescript
// List
expensesApi.list().then(r => r.data.data)
// → { expenses: [...], total, page, pages }

// Summary
expensesApi.summary(month).then(r => r.data.data)
// → { totalExpenses, totalRevenue, profit, profitMargin, expenseGrowth, byCategory }

// Trends
expensesApi.trends().then(r => r.data.data)
// → [{ month, expenses, revenue, profit }, ...]
```

## Categories

`SALARIES` | `UTILITIES` | `MAINTENANCE` | `CLEANING` | `FOOD_BEVERAGE` | `SUPPLIES` | `MARKETING` | `INSURANCE` | `RENT` | `EQUIPMENT` | `TRANSPORTATION` | `OTHER`

## Payment Modes

`CASH` | `BANK` | `CARD` | `OTHER`

## Bug Fixes

### 1. All expense routes were open to all authenticated users (security)

**File:** `apps/api/src/routes/expenses.ts`

**Root cause:** Every expense route used `preHandler: requireAuth` instead of `requireRole`. This meant any logged-in user — including staff, housekeeping, and front desk — could view all financial expense records, add expenses, edit them, or delete them.

**Fix:** Replaced `import { requireAuth }` with `import { requireRole }` and changed every `preHandler: requireAuth` to `preHandler: requireRole('OWNER', 'MANAGER')` across all 6 routes (list, create, update, delete, summary, trends).

```typescript
// Before (on every route)
preHandler: requireAuth,

// After
preHandler: requireRole('OWNER', 'MANAGER'),
```

### 2. `editingExpense` state had wrong initial value with unsafe cast

**File:** `apps/web/src/app/(dashboard)/dashboard/expenses/page.tsx`

**Root cause:**
```typescript
const [editingExpense, setEditingExpense] = useState<Expense | null | 'new'>('new' as any);
```
The state was initialized to the string `'new'` cast with `as any`. The modal received it as:
```typescript
expense={editingExpense === null ? null : (editingExpense as Expense)}
```
If the modal somehow opened before the user clicked a button, it would receive `'new'` cast to `Expense`, then crash accessing `expense.date`, `expense.category`, etc.

The `'new'` initial value was dead code — both open paths (`"Add Expense"` button and "Edit" button) properly set state before opening the modal — but the `as any` cast and the ternary were hiding a potential crash.

**Fix:** Simplified to the correct type and proper null initialization:
```typescript
const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
// ...
expense={editingExpense}
```

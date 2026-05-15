# Task 39 — Expense & Cost Tracking

**Branch:** `feature/expense-tracking`
**Priority:** 🟢 Nice to Have
**Estimate:** 1 day

---

## Goal
Resort-এর operating expenses track করা — revenue vs cost P&L view।

---

## Prisma

```prisma
enum ExpenseCategory { UTILITIES SALARY SUPPLIES MAINTENANCE MARKETING RENT FOOD_BEVERAGE OTHER }

model Expense {
  id          String          @id @default(cuid())
  tenantId    String
  category    ExpenseCategory
  amount      Float
  date        DateTime
  vendor      String?
  description String?
  receipt     String?         // URL to receipt image
  createdBy   String
  createdAt   DateTime        @default(now())

  tenant      Tenant          @relation(fields: [tenantId], references: [id])
  @@index([tenantId, date])
  @@map("expenses")
}
```

---

## API
- `GET /api/expenses?month=2026-05` — list with totals by category
- `POST /api/expenses` — add expense
- `PATCH /api/expenses/:id` — edit
- `DELETE /api/expenses/:id` — remove

## UI
`/dashboard/expenses`

- **Month picker** (default: current month)
- **Add Expense button** → modal (category, amount, date, vendor, description)
- **Category breakdown** — donut chart or bar: Utilities / Salary / Supplies / etc.
- **Expense list** — sortable table
- **P&L summary** at bottom:
  - Total Revenue (from reports API)
  - Total Expenses
  - Net Profit / Loss
  - Profit Margin %

## Acceptance Criteria
- [ ] Add/edit/delete expenses
- [ ] Category totals correct
- [ ] Monthly filter works
- [ ] P&L summary shows revenue vs expenses
- [ ] Profit margin calculated

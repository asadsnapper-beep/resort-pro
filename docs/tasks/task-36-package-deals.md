# Task 36 — Package Deals

**Branch:** `feature/packages`
**Priority:** 🟢 Nice to Have
**Estimate:** 1 day

---

## Goal
Bundle pricing — Room + Services = একটা package price। Public website-এ showcase।

---

## Examples
- **Honeymoon Package:** Deluxe Room × 2 nights + Candlelight Dinner + Flower decoration = ৳25,000
- **Family Fun:** Family Suite × 3 nights + Daily Breakfast + Pool access = ৳35,000
- **Corporate Stay:** Standard Room × 5 nights + Meeting Room (2h/day) + Lunch = ৳40,000

---

## Prisma

```prisma
model Package {
  id           String        @id @default(cuid())
  tenantId     String
  name         String
  description  String
  price        Float
  originalPrice Float?       // for "save X%" display
  image        String?
  isActive     Boolean       @default(true)
  sortOrder    Int           @default(0)
  items        PackageItem[]
  createdAt    DateTime      @default(now())
  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  @@map("packages")
}

model PackageItem {
  id          String  @id @default(cuid())
  packageId   String
  description String
  package     Package @relation(fields: [packageId], references: [id])
  @@map("package_items")
}
```

---

## API
- `GET/POST/PATCH/DELETE /api/packages`
- `GET /site/:slug/packages` — public endpoint for website

## UI
- `/dashboard/packages` — create/edit/toggle packages
- Public website: Packages section (card grid with price + "Book This Package" button → booking form pre-filled)

## Acceptance Criteria
- [ ] Package CRUD
- [ ] Shows on public website
- [ ] "Book Package" pre-fills booking form
- [ ] Original price + discount display (optional)

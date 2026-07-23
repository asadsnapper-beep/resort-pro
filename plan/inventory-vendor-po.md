# Inventory — Vendors, Purchase Orders, Demand Tracking, Low-Stock Alerts, CSV

> Extends the existing Inventory system (`plan/inventory.md`). Current system already has:
> items, categories, stock movements (IN/OUT/ADJUSTMENT), movement history, low-stock filter, stats.
> This plan adds everything from the "উন্নতির সুযোগ" list the user actually asked for:
> vendor management, purchase orders, low-stock alerts, demand tracking, bulk CSV.

---

## ১. Vendor Management

Right now `supplier` is a free-text field on each item — no phone, no email, no reuse across items.

**New `Vendor` model:**
- name, contactName, phone, email, address, notes, isActive
- `InventoryItem.vendorId` (optional FK) — old `supplier` string kept as fallback display for items never migrated
- New **"Vendors" tab** inside `/dashboard/inventory` (like Venues page's tab pattern) — list, Add/Edit/Deactivate

---

## ২. Purchase Orders (reorder workflow)

```
Low Stock filter-e item dekhle → "Create PO" button
  → Vendor select (or pick vendor already linked to the item)
  → Items + quantity (pre-filled with suggested reorder qty, editable)
  → Save as DRAFT
Owner "Mark as Sent" → PO status SENT (vendor-ke jokhon call/email kore order dise)
Vendor maal deliver korle → "Receive PO"
  → quantity received per line (defaults to ordered qty, editable — partial delivery hole kom likha jay)
  → System: automatically InventoryMovement (IN) create kore, currentStock update hoy
  → PO status RECEIVED
```

**New tab: "Purchase Orders"** inside `/dashboard/inventory` — list with PO number (auto `PO-2026-0001`), vendor, item count, status (DRAFT/SENT/RECEIVED/CANCELLED), created date.

---

## ৩. Demand Tracking (usage-based, not just min-stock threshold)

Min-stock is a static line — doesn't account for *how fast* an item is actually being used.

- From last 30 days of `OUT` movements, compute **avg daily usage** per item
- Show on item row: `~8 days left` (small text) when usage data exists — computed as `currentStock / avgDailyUsage`
- On "Create PO", suggested reorder quantity = enough to cover 30 days of usage (or falls back to `minimumStock × 2 − currentStock` if no usage history yet)

No new model needed — computed on the fly from existing `InventoryMovement` rows.

---

## ৪. Low-Stock Alerts (via existing notification bell)

The `Notification` model + bell icon in top-nav already exist and are wired to `GET /api/notifications` — just never actually produced in production code (only demo-seed uses it). This plan makes it real:

- When a stock movement causes an item to **cross into low-stock** (was above minimum, now at/below) → create a `Notification` for every OWNER/MANAGER of the tenant
- Does **not** fire again on every subsequent OUT movement while already low (dedupe by "crossing the line", not by "being low") — avoids spam
- Clicking the notification links to `/dashboard/inventory?lowStock=true`

---

## ৫. Bulk CSV Import / Export

- **Export**: `GET /api/inventory/export` → CSV of all items (name, category, unit, currentStock, minimumStock, unitCost, supplier) — "Export CSV" button, direct browser download
- **Import**: "Import CSV" button → file picker → client-side parse → preview table (new items in green, updated existing items in amber, matched by case-insensitive name) → confirm → `POST /api/inventory/import` → upserts, returns `{created, updated, errors}` summary toast

---

## Schema Additions

```prisma
model Vendor {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  contactName String?
  phone       String?
  email       String?
  address     String?
  notes       String?
  isActive    Boolean  @default(true)
  items       InventoryItem[]
  purchaseOrders PurchaseOrder[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([tenantId])
  @@map("vendors")
}

model PurchaseOrder {
  id           String   @id @default(uuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  vendorId     String
  vendor       Vendor   @relation(fields: [vendorId], references: [id])
  poNumber     String   @unique
  status       String   @default("DRAFT") // DRAFT | SENT | RECEIVED | CANCELLED
  notes        String?
  items        PurchaseOrderItem[]
  sentAt       DateTime?
  receivedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([tenantId])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id               String   @id @default(uuid())
  purchaseOrderId  String
  purchaseOrder    PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  inventoryItemId  String
  inventoryItem    InventoryItem  @relation(fields: [inventoryItemId], references: [id])
  quantityOrdered  Float
  quantityReceived Float    @default(0)
  unitCost         Float
  @@map("purchase_order_items")
}

// InventoryItem gets: vendorId String? + vendor Vendor? relation
```

## API Endpoints (new)

```
GET    /api/vendors                     List vendors
POST   /api/vendors                     Create vendor
PATCH  /api/vendors/:id                 Update / deactivate

GET    /api/purchase-orders             List POs (status filter)
POST   /api/purchase-orders             Create PO (DRAFT)
PATCH  /api/purchase-orders/:id/send    DRAFT → SENT
POST   /api/purchase-orders/:id/receive Record received qty → creates IN movements, status → RECEIVED

GET    /api/inventory/export            CSV download
POST   /api/inventory/import            Bulk upsert from parsed CSV rows

GET    /api/inventory  (existing, extended) → adds avgDailyUsage + daysUntilStockout per item
```

## File Structure

```
apps/api/src/routes/vendors.ts               (new)
apps/api/src/routes/purchaseOrders.ts        (new)
apps/api/src/routes/inventory.ts             (extended: export/import, demand calc)
apps/web/src/app/(dashboard)/dashboard/inventory/page.tsx  (extended: tabs — Items / Vendors / Purchase Orders)
apps/web/src/lib/api.ts                      (vendorsApi, purchaseOrdersApi added)
```

## Roles

- Vendors, POs: `OWNER`, `MANAGER` (same as existing inventory item management)
- CSV export: `OWNER`, `MANAGER`, `RECEPTIONIST` (read-only, matches item list access)
- CSV import: `OWNER`, `MANAGER`

# Inventory System — ResortPro

> Track hotel inventory (linen, toiletries, cleaning supplies, F&B stock, etc.) with stock movements and low-stock alerts.

---

## Features

- **Item list** — name, category, unit, current stock, minimum stock, unit cost, supplier
- **Categories** — LINEN / TOILETRIES / CLEANING / FOOD_BEVERAGE / MAINTENANCE / OFFICE / OTHER
- **Stats** — Total Items, Low Stock count, Total Stock Value (accurate, server-side)
- **Add / Edit** — modal form for item details
- **Stock movements** — Stock In / Stock Out / Adjustment with reason
- **Low stock alerts** — badge on item row; "Low Stock Only" filter toggle
- **Category filter** — filter by any category
- **Search** — server-side search by item name or supplier
- **Pagination** — 30 items per page

---

## API Endpoints

```
GET    /api/inventory           List items (category, search, lowStock, paginated)
GET    /api/inventory/stats     Total count, low stock count, total value (all items)
POST   /api/inventory           Add item            (OWNER/MANAGER/STAFF)
PATCH  /api/inventory/:id       Update item details (OWNER/MANAGER/STAFF)
POST   /api/inventory/:id/movement  Record stock movement (IN / OUT / ADJUSTMENT)
```

---

## Stock Movement Logic

```
IN:         newStock = currentStock + quantity
OUT:        newStock = currentStock - quantity  (400 if newStock < 0)
ADJUSTMENT: newStock = quantity                 (set absolute value, can be 0)
```

---

## File Structure

```
apps/api/src/routes/inventory.ts
apps/web/src/app/(dashboard)/dashboard/inventory/page.tsx
apps/web/src/lib/api.ts  ← inventoryApi.stats() added
```

---

## Bug Fixes Applied (June 2026)

### 1. ✅ `GET /` — `total` ignored category filter → wrong pagination count
**Problem:** `prisma.inventoryItem.count({ where: { tenantId } })` — category filter not included. Filtering by LINEN (20 items) showed "of 100" total.  
**Fix:** Count now uses the same `baseWhere` (tenantId + category + search) as `findMany`.

### 2. ✅ `GET /` — `lowStock` filter applied AFTER pagination → broken paging
**Problem:** `lowStock` was filtered in JavaScript after fetching a DB-paginated page. Page 1: fetch items 1–30, then keep only low-stock ones → might return 3 items. Page 2: fetch items 31–60, filter → 0 items. Low-stock items on DB page 2 were invisible.  
**Fix:** When `lowStock=true`, fetch all items matching other filters, filter in JS, then paginate the result. Inventory datasets are bounded (< 1000 items for a hotel), so this is safe.

### 3. ✅ `GET /` — no server-side `search` → search only scanned current page
**Problem:** Search was done client-side on `allItems` (max 30 on current page). Items on pages 2+ were invisible in search results.  
**Fix:** Added `search` param to `GET /` query; Prisma OR filter: `{ name: { contains, insensitive } }` OR `{ supplier: { contains, insensitive } }`.

### 4. ✅ `movementSchema` — `quantity: z.number().positive()` blocked ADJUSTMENT to 0
**Problem:** `z.number().positive()` requires `> 0`. Can't use ADJUSTMENT to set stock to 0 (e.g. "we ran out completely").  
**Fix:** Changed to `z.number().min(0)`.

### 5. ✅ Stats cards showed current-page data only
**Problem:** `lowStockCount` and `totalValue` computed from `allItems` (current page, max 30). 100 items across 4 pages → stats only reflect page 1.  
**Fix:** Added `GET /api/inventory/stats` endpoint — fetches all items' `currentStock`, `minimumStock`, `unitCost` in one query, computes totals server-side.

### 6. ✅ `ItemModal` form didn't reset on edit
**Problem:** `useState({ name: item?.name, ... })` initializer runs only once on mount. Clicking "Edit Towels" after editing "Toiletries" still showed Toiletries data.  
**Fix:** Replaced with blank `useState({})` + `useEffect(() => { if (open) setForm({...item}); }, [open, item])`.

### 7. ✅ `MovementModal` state persisted between opens
**Problem:** `quantity` and `reason` were only cleared on submit — cancelling left stale values. Reopening for a different item showed the previous item's half-entered quantity.  
**Fix:** `useEffect(() => { if (open) { setType('IN'); setQuantity(''); setReason(''); } }, [open])`.

### 8. ✅ Filter/search changes didn't reset page to 1
**Problem:** Clicking a category filter while on page 3 kept `page = 3` — which might be empty for the new filter. Same for low-stock toggle and search input.  
**Fix:** All filter changes now call `setPage(1)`.

---

## উন্নতির সুযোগ (Future)

- [x] Movement history per item (log of all IN/OUT/ADJUSTMENT entries)
- [x] Purchase order workflow (reorder when low stock) — see [inventory-vendor-po.md](./inventory-vendor-po.md)
- [x] Supplier contact management (Vendor model) — see [inventory-vendor-po.md](./inventory-vendor-po.md)
- [x] Bulk import via CSV — see [inventory-vendor-po.md](./inventory-vendor-po.md)
- [x] Low-stock notification to manager (bell icon) — see [inventory-vendor-po.md](./inventory-vendor-po.md)
- [ ] Delete / archive inventory items
- [ ] Auto-deduct stock on food order placement (F&B items)
- [ ] Auto-deduct on housekeeping task completion (linen, toiletries)

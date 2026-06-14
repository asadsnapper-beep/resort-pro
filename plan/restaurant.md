# Restaurant & F&B System — ResortPro

> Menu management + food & beverage order tracking for the resort restaurant.

---

## Features

### Menu Management (`/dashboard/restaurant`)
- **Menu items** — name, description, category, price, image, availability toggle
- **Categories** — BREAKFAST / LUNCH / DINNER / APPETIZER / DESSERT / BEVERAGE / SPECIAL
- **Grouped display** — items grouped by category with count badges
- **Add / Edit / Delete** — modal form with image upload
- **Availability toggle** — click to enable/disable without opening modal

### F&B Orders (`/dashboard/orders`)
- **Order list** — status filter, paginated (20/page), expandable item details
- **Stats** — Total / Pending / Preparing / Ready (from `/stats` endpoint — accurate)
- **New Order** — cart-style modal: pick items from available menu, set guest/table/notes
- **Order flow** — PENDING → PREPARING → READY → DELIVERED (one-click progress)
- **Cancel** — available for PENDING and PREPARING orders
- **Per-order loading** — each order card has its own mutation, other buttons stay enabled

---

## API Endpoints

```
GET    /api/menu                     List menu items (category filter, paginated)
POST   /api/menu                     Create menu item  (OWNER/MANAGER)
PATCH  /api/menu/:id                 Update menu item  (OWNER/MANAGER)
DELETE /api/menu/:id                 Delete menu item  (OWNER/MANAGER)

GET    /api/food-orders              List orders (status filter, paginated)
GET    /api/food-orders/stats        Count by status (total/pending/preparing/ready/delivered/cancelled)
POST   /api/food-orders             Place order (validates availability, locks prices)
PATCH  /api/food-orders/:id/status  Update order status (validated enum)
```

---

## Order Status Flow

```
PENDING → PREPARING → READY → DELIVERED
    ↘ CANCELLED (from PENDING or PREPARING only)
```

---

## File Structure

```
apps/api/src/routes/
  menu.ts           ← Menu CRUD
  foodOrders.ts     ← Order placement, status update, stats endpoint

apps/web/src/app/(dashboard)/dashboard/
  restaurant/page.tsx   ← Menu management UI
  orders/page.tsx       ← F&B order management UI

apps/web/src/lib/api.ts  ← foodOrdersApi.stats() added
```

---

## Bug Fixes Applied (June 2026)

### 1. ✅ `MenuItemModal` form never reset on edit
**Problem:** `useState(() => { setForm({...}) })` — this is the initializer form of `useState`, it runs **only once** on component mount, not on re-renders. Clicking "Edit" on Pizza after editing Sandwich still showed Sandwich's data.  
**Fix:** `useEffect(() => { if (open) setForm({...}); }, [open, item])` — re-syncs form every time the modal opens or the target item changes.

### 2. ✅ `toggleMutation` silent failure
**Problem:** Clicking the availability toggle button had no `onError` handler — if the request failed, nothing happened visually.  
**Fix:** Added `onError: () => toast({ title: 'Error', description: 'Failed to update availability', variant: 'destructive' })`.

### 3. ✅ `POST /food-orders` — unavailable items could be ordered
**Problem:** `findMany` fetched menu items without checking `isAvailable`. A BEVERAGE marked "Unavailable" could still be ordered via API.  
**Fix:** After fetching items, check `menuItems.filter(m => !m.isAvailable)` — return 400 with item names: `"Not available: Mango Lassi, Orange Juice"`.

### 4. ✅ `POST /food-orders` — duplicate `menuItemId` gave wrong count error
**Problem:** If a request had the same `menuItemId` twice (e.g., from a bug), `findMany` deduplicates — `menuItems.length < body.items.length` → "One or more menu items not found" — misleading error.  
**Fix:** Deduplicate IDs before query: `const uniqueIds = [...new Set(body.items.map(i => i.menuItemId))]`, compare against `uniqueIds.length`.

### 5. ✅ `PATCH /food-orders/:id/status` — no validation
**Problem:** `const { status } = request.body as { status: string }` — any string accepted, e.g. `status: "HACKED"` would be written to DB.  
**Fix:** `z.object({ status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']) }).parse(request.body)`.

### 6. ✅ Order stats cards showed current-page counts only
**Problem:** `pendingCount`, `preparingCount`, `readyCount` computed from `orders` (current page, max 20). Showing page 3 while filtering by PENDING could show "Pending: 0" even with 50 total pending orders.  
**Fix:** Added `GET /api/food-orders/stats` endpoint with 6 parallel `count()` queries. Frontend queries `['food-orders-stats']` separately with 30s refetch interval.

### 7. ✅ `NewOrderModal` cart persisted between opens
**Problem:** `guestId`, `tableNumber`, `notes`, `cart` state not reset when modal is closed. Reopening showed old cart items.  
**Fix:** `useEffect(() => { if (open) { setCart([]); setGuestId(''); ... } }, [open])`.

### 8. ✅ Page-level `statusMutation` blocked all order buttons
**Problem:** `statusMutation` was defined once in `OrdersPage`. `loading={statusMutation.isPending}` — when updating Order #1, ALL orders' action buttons showed loading/disabled.  
**Fix:** Extracted `OrderCard` component. Each card defines its own `useMutation` — only that card's buttons show loading while its request is in flight.

---

## উন্নতির সুযোগ (Future)

- [ ] Kitchen display screen (real-time order board for kitchen staff)
- [ ] Order auto-refresh (WebSocket or polling for kitchen view)
- [ ] Estimated prep time per item + order ETA
- [ ] Soft-delete menu items (mark as archived, preserve historical order data)
- [ ] Menu item popularity stats (most ordered items)
- [ ] Table management (visual floor plan, seat assignment)
- [ ] Split billing (multiple guests on one table)
- [ ] In-room dining integration (guest QR code → order from room)
- [ ] Inventory deduction on order placement
- [ ] Daily specials / time-based availability (breakfast items hidden after 11am)

# Group Bookings System — ResortPro

> Multi-room event bookings — weddings, corporate retreats, conferences, sports tours. একটা group এ অনেক rooms + guests থাকতে পারে, সবাইকে একসাথে check-in/check-out করা যায়।

---

## Features

- **Group creation** — name, organization, contact person, event type, date range, discount
- **Inline room booking** — create modal এ সরাসরি rooms + guests add করা যায়
- **Bulk check-in / checkout** — সব CONFIRMED rooms একসাথে CHECKED_IN, সব CHECKED_IN একসাথে CHECKED_OUT
- **Group discount** — NONE / PERCENTAGE / FLAT, সব room bookings এ apply হয়
- **Group summary** — room count, nights, total revenue, paid amount, outstanding balance, payment progress bar
- **Link/unlink bookings** — existing standalone booking কে group এ add বা remove করা যায়
- **Status tracking** — TENTATIVE → CONFIRMED → CHECKED_IN → CHECKED_OUT / CANCELLED
- **Search + filter** — name, org, contact by text; status filter buttons
- **Summary stats** — Active Groups, Total Rooms Booked, Group Revenue cards

---

## Event Types

`WEDDING` 💍 | `CORPORATE` 🏢 | `CONFERENCE` 🎤 | `SPORTS` ⚽ | `TOUR` ✈️ | `FAMILY` 👨‍👩‍👧 | `OTHER` 📋

## Group Status Flow

```
TENTATIVE → CONFIRMED → CHECKED_IN → CHECKED_OUT
                    ↘ CANCELLED
```

---

## API Endpoints

```
GET    /api/group-bookings                         List all (with bookings + count)
GET    /api/group-bookings/:id                     Get one (full bookings detail)
POST   /api/group-bookings                         Create group + optional room bookings
PATCH  /api/group-bookings/:id                     Update group details
DELETE /api/group-bookings/:id                     Delete group (unlinks bookings, doesn't delete them)
POST   /api/group-bookings/:id/add-booking         Link existing booking to group
DELETE /api/group-bookings/:id/remove-booking/:bid Unlink booking from group
POST   /api/group-bookings/:id/bulk-checkin        CONFIRMED → CHECKED_IN (all rooms)
POST   /api/group-bookings/:id/bulk-checkout       CHECKED_IN → CHECKED_OUT (all rooms)
GET    /api/group-bookings/:id/summary             Stats + contact + bookings detail
```

---

## Transaction Logic (POST / — Create)

```
prisma.$transaction:
  1. Create GroupBooking record
  2. For each bookingInput (with guestEmail):
     a. upsert Guest (tenantId_email unique key)
     b. find room → compute totalAmount (basePrice × nights)
     c. apply group discount (PERCENTAGE or FLAT)
     d. create Booking (status: CONFIRMED, source: GROUP)
     e. room.status → RESERVED
  3. Return group with all bookings
```

---

## Discount Calculation

```typescript
let totalAmount = room.basePrice * nights;
if (discountType === 'PERCENTAGE') totalAmount *= (1 - discountValue / 100);
if (discountType === 'FLAT')       totalAmount = Math.max(0, totalAmount - discountValue);
```

---

## File Structure

```
apps/web/src/app/(dashboard)/dashboard/group-bookings/
  page.tsx          ← GroupCard + GroupModal (create/edit) + GroupDetailDrawer

apps/api/src/routes/
  groupBookings.ts  ← All group booking endpoints
```

---

## UI Components

| Component | Description |
|-----------|-------------|
| `GroupCard` | Grid card — event icon, name, org, dates, rooms/revenue/balance stats, progress bar, contact |
| `GroupModal` | Create / Edit modal — group info + contact + dates + discount + inline room entries |
| `GroupDetailDrawer` | Right-side drawer — stats strip, payment progress, contact, booking details, bulk actions |

---

## উন্নতির সুযোগ (Future)

- [ ] Rooming list export (PDF / Excel) — সব guest details একসাথে
- [ ] Group invoice PDF generation
- [ ] Deposit / installment payment tracking per group
- [ ] Room change within group (swap room without unlink)
- [ ] Group email blast (send confirmation to contact email)
- [ ] Calendar view integration — group bookings Gantt এ হাইলাইট

---

## Status

সব core feature ✅ live — June 2026

### Bug fixes applied (June 2026)

1. ✅ **`ok(reply, x)` → `ok(x)`** — সব 10টা endpoint এ `ok()` utility ভুলভাবে call হচ্ছিল। `reply` object টা data হিসেবে return হচ্ছিল। Fixed: GET list, GET :id, POST (create), PATCH, DELETE, add-booking, remove-booking, bulk-checkin, bulk-checkout, summary — সব ঠিক করা হয়েছে।

2. ✅ **POST create → 201 status** — `ok(reply, group, 201)` ছিল — `ok()` এ 3rd argument নেই। Fixed: `reply.status(201).send(ok(group))`।

3. ✅ **PaymentStatus `COMPLETED` → `PAID`** — API summary endpoint এ `p.status === 'COMPLETED'` ছিল যেটা Prisma schema তে নেই (`PaymentStatus` enum: `PENDING | PROCESSING | PARTIAL | PAID | REFUNDED | FAILED | CANCELLED`)। paidAmount সবসময় 0 আসছিল। Fixed in both API and frontend.

4. ✅ **`availableRooms` RESERVED filter সরানো** — Create modal এ `RESERVED` rooms দেখাচ্ছিল, যেগুলো already অন্য booking এর জন্য reserved। Double-booking risk। Fixed: শুধু `AVAILABLE` rooms দেখায়।

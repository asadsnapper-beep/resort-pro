# Package Deals System — ResortPro

> Room + Experience bundle — Breakfast, Spa, Transfer সব একসাথে।

---

## Overview

Package system দিয়ে hotel operator রুমের সাথে extra services bundle করতে পারে। Booking এ package apply করলে automatically total amount update হয়। Honeymoon Package, Adventure Bundle, Business Package — যেকোনো ধরনের deal তৈরি করা যায়।

---

## Features

### ১. Packages List Page (`/dashboard/packages`)
- Card grid — cover image / gradient placeholder
- Active/Inactive badge
- Price + pricing type (per stay / per night)
- Inclusions (max 4 preview + "+X more")
- Times applied count
- Filter: All / Active / Inactive

### ২. Create / Edit Package Modal
- Package name (required)
- Description
- Price + Pricing type toggle (Per Stay / Per Night)
- **Inclusions** — type + enter বা quick-add suggestions থেকে click
- Cover image URL (optional)
- Active / Inactive toggle

### ৩. Toggle Active/Inactive
- Inactive packages booking এ apply করা যায় না

### ৪. Delete Package
- **Booking থাকলে delete block** — error: "it has been applied to X booking(s). Deactivate it instead."
- কোনো booking নেই → hard delete

### ৫. Apply / Remove Package (Booking এ)
Booking detail page থেকে:
- `POST /api/packages/apply` — package booking এ যোগ করে + totalAmount update
- `DELETE /api/packages/remove` — package সরায় + totalAmount update (decrement)
- Duplicate protection — same package twice apply করা যায় না

---

## Pricing Logic

| priceType | Package cost calculation |
|-----------|--------------------------|
| `PER_STAY` | `pkg.price × 1` (flat) |
| `PER_NIGHT` | `pkg.price × nights` |

`nights = ceil((checkOut - checkIn) / 86400000)`, minimum 1।

---

## API Endpoints

```
GET    /api/packages                          List all packages (with _count.bookings)
POST   /api/packages                          Create package (OWNER/MANAGER/RECEPTIONIST) → 201
PATCH  /api/packages/:id                      Update package fields
DELETE /api/packages/:id                      Delete (blocked if bookings exist)
GET    /api/packages/:id/bookings             Bookings that use this package
POST   /api/packages/apply                    Apply package to a booking
DELETE /api/packages/remove                   Remove package from a booking
GET    /api/packages/booking/:bookingId       All packages on a specific booking
```

### `POST /api/packages/apply` body
```json
{ "bookingId": "...", "packageId": "..." }
```

### `DELETE /api/packages/remove` body
```json
{ "bookingId": "...", "packageId": "..." }
```

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/packages/
    page.tsx          ← PackagesPage + PackageModal + PackageCard

apps/api/src/routes/
  packages.ts         ← Full CRUD + apply/remove endpoints
```

---

## Prisma Models

```prisma
model Package {
  id          String           @id @default(uuid())
  tenantId    String
  name        String
  description String?
  price       Decimal          @db.Decimal(10, 2)
  priceType   PackagePriceType @default(PER_STAY)  // PER_STAY | PER_NIGHT
  inclusions  String[]
  imageUrl    String?
  isActive    Boolean          @default(true)
  sortOrder   Int              @default(0)
  bookings    BookingPackage[]
}

model BookingPackage {
  bookingId   String
  packageId   String
  packageName String           // snapshot at time of apply
  price       Decimal
  priceType   PackagePriceType
  nights      Int
  createdAt   DateTime         @default(now())
  @@unique([bookingId, packageId])
}
```

---

## Data Flow

```
Apply Package to Booking:
  POST /api/packages/apply
    → booking + package existence check
    → duplicate check (bookingId_packageId unique)
    → packageCost = PER_NIGHT ? price×nights : price
    → $transaction:
        bookingPackage.create (snapshot: name, price, priceType, nights)
        booking.totalAmount += packageCost

Remove Package from Booking:
  DELETE /api/packages/remove
    → booking + bookingPackage existence check
    → packageCost = bp.priceType × bp.nights (uses snapshot)
    → $transaction:
        bookingPackage.delete
        booking.totalAmount -= packageCost
```

---

## উন্নতির সুযোগ (Future)

- [ ] Drag-to-reorder packages (sortOrder field আছে কিন্তু UI নেই)
- [ ] Package preview on booking/website — guest দেখতে পাবে
- [ ] Package bundles with minimum nights requirement
- [ ] Revenue from packages analytics — separate breakdown
- [ ] Auto-suggest package when booking meets criteria (e.g. 3+ nights → suggest breakfast)

---

## Status

সব core feature ✅ live:
- Package CRUD, apply/remove to booking, totalAmount auto-update
- active/inactive toggle, booking usage count — June 2026

### Bug fixes applied (June 2026)
1. ✅ `ok(reply, data)` → `ok(data)` — সব 8টা endpoint response fix (list, create, update, delete, bookings, apply, remove, booking packages)
2. ✅ POST create এখন 201 status return করে (`reply.status(201).send(ok(pkg))`)
3. ✅ Delete blocked if bookings exist — `bookingPackage.count` check → 409 error with message
4. ✅ Price input এ hardcoded `$` সরানো হয়েছে
5. ✅ Unused imports পরিষ্কার (`GripVertical`, `Tag`, `Calendar`, `Infinity`)

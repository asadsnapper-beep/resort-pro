# ResortPro — Housekeeping Extras: Lost & Found, Minibar, Laundry

> Extends `plan/housekeeping.md`. Current Housekeeping only has cleaning tasks
> (DAILY/DEEP_CLEAN/TURNDOWN/CHECKOUT/CHECKIN). This adds three guest-service
> trackers housekeeping staff handle day to day — as new tabs on the same
> `/dashboard/housekeeping` page (Tasks / Lost & Found / Minibar / Laundry).

---

## ১. Lost & Found

```
Staff room clean korte gie kichu pele:
  Room, description ("Black wallet", "Phone charger"), category,
  found date, kothay rakha ache (storage location)
  → status: Unclaimed

Guest call kore/phone kore chaile:
  "Mark Claimed" → guest name + contact + date save hoy
Onek din dhore keu na nile:
  "Mark Disposed"
```

No billing involved — pure tracking + status.

---

## ২. Minibar

```
Owner ekbar minibar price list banabe:
  Coke - ৳150, Water - ৳50, Chocolate - ৳300, etc. (reusable catalog)

Housekeeping/staff room-e giye dekhe ki consume hoise:
  Room select → item + quantity select (multiple items ekbare)
  → cost auto-calculate (item price × qty), total dekhায়

Booking-er invoice already thakle:
  "Add to Invoice" button — MINIBAR category হিসেবে সরাসরি bill-e jog hoy
  (InvoiceItemCategory-e MINIBAR already ache, just kono UI/flow chilo na)
Invoice na thakle:
  charge "pending" hisebe track hoy, pore manually add kora jabe
```

---

## ৩. Laundry

```
Guest laundry dite chaile:
  Room, item count + description ("3 shirts, 2 pants"),
  service type: Wash / Dry Clean / Iron / Wash & Iron
  → status: Requested

Flow: Requested → In Progress → Ready → Delivered
Cost enter kora jabe jekono step-e
Minibar-er moto — invoice thakle "Add to Invoice" (LAUNDRY category)
```

---

## Schema

```prisma
enum LostFoundStatus { UNCLAIMED CLAIMED DISPOSED }

model LostFoundItem {
  id              String   @id @default(uuid())
  tenantId        String
  roomId          String?
  description     String
  category        String?
  foundDate       DateTime @default(now())
  foundBy         String?
  storageLocation String?
  status          LostFoundStatus @default(UNCLAIMED)
  claimedBy       String?
  claimedContact  String?
  claimedDate     DateTime?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  room   Room?  @relation(fields: [roomId], references: [id], onDelete: SetNull)
  @@index([tenantId])
  @@map("lost_found_items")
}

model MinibarItem {
  id        String   @id @default(uuid())
  tenantId  String
  name      String
  price     Float
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@map("minibar_items")
}

model MinibarConsumption {
  id            String   @id @default(uuid())
  tenantId      String
  roomId        String
  bookingId     String?
  minibarItemId String
  itemName      String   // snapshot
  quantity      Int
  unitPrice     Float    // snapshot
  billed        Boolean  @default(false)
  recordedBy    String?
  createdAt     DateTime @default(now())
  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  room    Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  booking Booking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  @@index([tenantId])
  @@index([roomId])
  @@map("minibar_consumptions")
}

enum LaundryStatus { REQUESTED IN_PROGRESS READY DELIVERED }
enum LaundryServiceType { WASH DRY_CLEAN IRON WASH_AND_IRON }

model LaundryOrder {
  id          String   @id @default(uuid())
  tenantId    String
  roomId      String
  bookingId   String?
  itemCount   Int
  description String?
  serviceType LaundryServiceType @default(WASH)
  status      LaundryStatus @default(REQUESTED)
  cost        Float?
  billed      Boolean  @default(false)
  readyAt     DateTime?
  deliveredAt DateTime?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  room    Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  booking Booking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  @@index([tenantId])
  @@index([roomId])
  @@map("laundry_orders")
}
```

## API Endpoints

```
GET/POST/PATCH   /api/lost-found                 CRUD + mark claimed/disposed

GET/POST/PATCH   /api/minibar/catalog             Price list CRUD
GET/POST         /api/minibar/consumption         Log + list consumption
POST             /api/minibar/consumption/:id/bill  Add to booking's invoice (MINIBAR)

GET/POST/PATCH   /api/laundry                     Order CRUD + status update
POST             /api/laundry/:id/bill             Add to booking's invoice (LAUNDRY)
```

## File Structure

```
apps/api/src/routes/lostFound.ts        (new)
apps/api/src/routes/minibar.ts          (new)
apps/api/src/routes/laundry.ts          (new)
apps/web/src/app/(dashboard)/dashboard/housekeeping/page.tsx  (extended: tabs)
apps/web/src/lib/api.ts                 (lostFoundApi, minibarApi, laundryApi)
```

## Roles

Same as existing Housekeeping: `OWNER`, `MANAGER`, `RECEPTIONIST`, `STAFF` for logging; `OWNER`/`MANAGER` for catalog management and "Add to Invoice".

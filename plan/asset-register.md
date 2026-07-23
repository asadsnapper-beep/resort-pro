# ResortPro — Asset Register (মালপত্র / Fixed Assets)

## Why this is a different thing from Inventory

The Inventory system (`plan/inventory.md`, `plan/inventory-vendor-po.md`) tracks **consumables** — towels, soap, cleaner: items that get *used up* and restocked. It has no way to represent something that is bought once and used for years: an AC unit, a generator, a sofa, a delivery van.

The Maintenance module (`plan/maintenance.md`) tracks **room issues** — but `MaintenanceTicket.roomId` is required, so it can't represent "the lobby generator broke" or "kitchen freezer #2 needs servicing" — those aren't tied to a guest room at all.

**Asset Register** fills this gap: a list of the resort's durable property — with a tag number, purchase info, warranty, assigned location, and a repair/service history — separate from both.

---

## ১. Full Flow

```
Owner adds an asset:
  Name, category, purchase date + price, vendor (optional — reuses
  the Vendor list from Inventory), location (a room, or a free-text
  place like "Lobby" / "Kitchen" / "Admin Office"), warranty expiry

Asset ta use hocche — status: In Use
Kono somoy break down hole:
  Owner/Manager status "In Repair" e switch kore
  "Log Maintenance" — kon technician/vendor, koto cost lagse, ki thik korlo
Thik hoye gele:
  status back to "In Use"
Purano/broken hoye disposed hole:
  status "Retired"

Warranty expire hoye jacche (30 din-er moddhe)?
  → list-e chhoto badge dekhায়, jate renewal/insurance decision nite pare
```

---

## ২. Dashboard — `/dashboard/assets`

```
┌────────────────────────────────────────────────────────────┐
│  Assets                                    [+ Add Asset]   │
│                                                              │
│  Total Assets: 42   In Repair: 2   Total Value: ৳18,50,000  │
│                                                              │
│  Filter: [All] [Furniture] [Electronics] [Appliance]        │
│          [Kitchen Equipment] [Vehicle] [IT] [Other]         │
│  ─────────────────────────────────────────────────────────  │
│  AST-0001  Split AC 1.5 Ton          Room 204               │
│  Electronics · ৳45,000 · Vendor: Rahim Electronics           │
│  🟢 In Use   ⚠ Warranty expires in 12 days   [Log] [Edit]   │
│  ─────────────────────────────────────────────────────────  │
│  AST-0002  Backup Generator 10kVA    Utility Room            │
│  Appliance · ৳3,20,000                                       │
│  🟠 In Repair                        [Log] [History] [Edit] │
└────────────────────────────────────────────────────────────┘
```

---

## Schema

```prisma
enum AssetCategory {
  FURNITURE
  ELECTRONICS
  APPLIANCE
  KITCHEN_EQUIPMENT
  VEHICLE
  IT_EQUIPMENT
  OTHER
}

enum AssetStatus {
  IN_USE
  IN_REPAIR
  IN_STORAGE
  RETIRED
}

model Asset {
  id                String        @id @default(uuid())
  tenantId          String
  tenant            Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assetTag          String        @unique // AST-2026-0001
  name              String
  category          AssetCategory @default(OTHER)
  status            AssetStatus   @default(IN_USE)
  condition         String        @default("GOOD") // GOOD | FAIR | POOR
  locationRoomId    String?
  locationRoom      Room?         @relation(fields: [locationRoomId], references: [id], onDelete: SetNull)
  locationLabel     String?       // free text when not tied to a room: "Lobby", "Kitchen"
  purchaseDate      DateTime?
  purchasePrice     Float?
  warrantyExpiresAt DateTime?
  vendorId          String?
  vendor            Vendor?       @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  notes             String?
  maintenanceLogs   AssetMaintenanceLog[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([tenantId])
  @@map("assets")
}

model AssetMaintenanceLog {
  id          String   @id @default(uuid())
  assetId     String
  asset       Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  type        String   // SERVICE | REPAIR | INSPECTION
  cost        Float?
  performedBy String?  // technician / vendor name, free text
  notes       String?
  createdAt   DateTime @default(now())

  @@index([assetId])
  @@map("asset_maintenance_logs")
}
```

`Vendor.assets Asset[]` relation added (assets can reuse the same vendor list Inventory already has).

## API Endpoints

```
GET    /api/assets                      List (category/status filter, search)
GET    /api/assets/stats                Total count, in-repair count, total value
POST   /api/assets                      Add asset
PATCH  /api/assets/:id                  Update (incl. status change)
GET    /api/assets/:id/logs             Maintenance history
POST   /api/assets/:id/logs             Log a maintenance/repair/inspection entry
```

## File Structure

```
apps/api/src/routes/assets.ts                              (new)
apps/web/src/app/(dashboard)/dashboard/assets/page.tsx      (new)
apps/web/src/lib/api.ts                                     (assetsApi added)
apps/web/src/components/dashboard/sidebar.tsx                (new nav item, Operations group)
```

## Roles

- Full CRUD + logging: `OWNER`, `MANAGER` (matches Vendor/Purchase Order gating — this is asset/financial data, not front-desk-relevant like Inventory items)

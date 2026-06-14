# Room System — ResortPro

> Main product — resort accommodation management। Room CRUD, availability, status, images, videos, current guest।

---

## Overview

Room system হলো ResortPro এর core। সব bookings, housekeeping, rate plans, maintenance এই room এর উপর ভিত্তি করে চলে।

---

## Features

### ১. Room List Page (`/dashboard/rooms`)
- **Stats bar** — Total, Available, Occupied, Maintenance, Reserved (clickable — filter হিসেবে কাজ করে)
- **Stats সবসময় correct** — `/api/rooms/stats` আলাদা endpoint থেকে আসে, filter এর সাথে পরিবর্তন হয় না
- **Server-side search** — name বা room number দিয়ে (debounced 350ms)
- **Status filter** — All / Available / Occupied / Maintenance / Reserved
- **Type filter** — All / Standard / Deluxe / Suite / Villa / Cottage / Bungalow
- **Card grid** — image, status badge, type badge, amenities preview, video indicator
- **Pagination** — 20 per page

### ২. Add / Edit Room Modal
- Fields: Room #, Name, Type, Floor, Max Guests, Price/Night, Description
- **Amenities** — suggestion chips (AC, WiFi, TV...) + custom add + remove
- **Photos** — ImageUpload component, max 8, grid preview, hover to delete
- **Videos** — URL only (YouTube, Vimeo, direct MP4)
  - Validate করে (valid URL হতে হবে)
  - Max 4 videos
  - List view with delete button
- Edit করলে room number uniqueness check হয় (duplicate check)

### ৩. Room Detail Sheet (Right sidebar)
- Image gallery (main + thumbnails)
- Name, description, status badge
- Stats: Price/night, Max guests, Floor
- **Current/Upcoming Booking** — occupied বা আসছে 7 দিনের মধ্যে booking থাকলে দেখায়:
  - Guest নাম, email
  - Check-in / check-out dates
  - Adults + children
  - Confirmation number
  - External link → booking detail
- **Amenities** list
- **Videos** — YouTube/Vimeo embed, direct MP4 player, tab navigation for multiple videos
- **Change Status** — Available, Maintenance, Reserved (current status টা দেখায় না)
- Footer: Edit, Delete

### ৪. Delete Safety
- Active booking (PENDING, CONFIRMED, CHECKED_IN) থাকলে delete block করে
- Error message: "Cannot delete room with active bookings. Cancel or complete them first."

---

## Room Types

| Type | রঙ |
|------|-----|
| `STANDARD` | Gray |
| `DELUXE`   | Blue |
| `SUITE`    | Purple |
| `VILLA`    | Resort green |
| `COTTAGE`  | Green |
| `BUNGALOW` | Orange |

## Room Statuses

| Status | মানে | কখন set হয় |
|--------|------|-------------|
| `AVAILABLE`   | ফাঁকা, booking নেওয়া যাবে | Check-out এর পরে housekeeping complete হলে |
| `OCCUPIED`    | Guest আছে | Check-in এর সময় auto-set |
| `MAINTENANCE` | Repair/cleaning | Staff manually set করে |
| `RESERVED`    | Hold করা আছে | Staff manually set করে |

---

## API Endpoints

```
GET    /api/rooms                    List rooms (filter: status, type, search, page, limit)
GET    /api/rooms/stats              Status counts: total, available, occupied, maintenance, reserved
GET    /api/rooms/availability       Available rooms for a date range (checkIn, checkOut)
GET    /api/rooms/:id                Get room + currentBooking (within 7 days)
POST   /api/rooms                    Create room (OWNER/MANAGER only)
PATCH  /api/rooms/:id                Update room fields incl. videos (OWNER/MANAGER only)
PATCH  /api/rooms/:id/status         Update status: AVAILABLE | OCCUPIED | MAINTENANCE | RESERVED
DELETE /api/rooms/:id                Soft delete (isActive: false) — blocks if active bookings exist
```

### `GET /api/rooms/availability` query params
```
checkIn  = "2026-07-01"   (required)
checkOut = "2026-07-05"   (required)
```
Returns rooms not booked during this period AND not in MAINTENANCE.

### `GET /api/rooms/:id` response shape
```json
{
  "id": "...",
  "name": "Ocean View Suite",
  "videos": ["https://youtube.com/watch?v=abc123"],
  "currentBooking": {
    "id": "...",
    "confirmationNo": "RES-2026-001",
    "status": "CHECKED_IN",
    "checkIn": "2026-06-13",
    "checkOut": "2026-06-15",
    "adults": 2,
    "children": 0,
    "guest": { "firstName": "Karim", "lastName": "Hossain", "email": "..." }
  }
}
```

---

## Video Support

Videos are **URL-only** — no file upload. Supported formats:

| Source | Format | How it embeds |
|--------|--------|---------------|
| YouTube | `youtube.com/watch?v=` or `youtu.be/` | `<iframe>` via embed URL |
| Vimeo   | `vimeo.com/{id}` | `<iframe>` via embed URL |
| Direct  | Any `.mp4` or direct video URL | `<video>` HTML5 player |

---

## File Structure

```
apps/web/src/
  app/(dashboard)/dashboard/rooms/
    page.tsx                  ← Room list, stats, filters, pagination

  components/rooms/
    RoomModal.tsx             ← Add/Edit form (photos + videos URL input)
    RoomDetailSheet.tsx       ← Right-slide detail (video player, current booking)

  lib/api.ts                  ← roomsApi: list, get, stats, create, update, updateStatus, delete, availability

apps/api/src/routes/
  rooms.ts                    ← All room routes

packages/types/src/index.ts   ← Room interface (includes videos: string[])
packages/database/prisma/schema.prisma  ← Room model
```

---

## Prisma Model

```prisma
model Room {
  id           String     @id @default(uuid())
  tenantId     String
  number       String                        // unique per tenant
  name         String
  type         RoomType   @default(STANDARD) // STANDARD | DELUXE | SUITE | VILLA | COTTAGE | BUNGALOW
  status       RoomStatus @default(AVAILABLE)// AVAILABLE | OCCUPIED | MAINTENANCE | RESERVED
  floor        Int?
  maxOccupancy Int        @default(2)
  basePrice    Decimal    @db.Decimal(10, 2)
  description  String?
  amenities    String[]
  images       String[]
  videos       String[]                      // URL only — YouTube/Vimeo/MP4
  isActive     Boolean    @default(true)     // soft delete
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  bookings           Booking[]
  housekeepingTasks  HousekeepingTask[]
  ratePlans          RatePlan[]
  maintenanceTickets MaintenanceTicket[]
  externalCalendars  ExternalCalendar[]

  @@unique([tenantId, number])
}
```

---

## Data Flow

```
Create Room:
Manager → Add Room modal → POST /api/rooms
  → duplicate number check → room create
  → status: AVAILABLE, isActive: true

Check-in:
booking check-in → PATCH /api/bookings/:id/check-in
  → booking.status: CHECKED_IN
  → room.status: OCCUPIED (auto)

Check-out:
booking check-out → PATCH /api/bookings/:id/check-out
  → booking.status: CHECKED_OUT
  → room.status: DIRTY → housekeeping task created
  → after cleaning: room.status: AVAILABLE

Delete Room:
Manager → DELETE /api/rooms/:id
  → active booking check (PENDING/CONFIRMED/CHECKED_IN)
  → if active → 409 error
  → if none → isActive: false (soft delete)
```

---

## উন্নতির সুযোগ (Future)

- [ ] Room category / floor plan image
- [ ] Bulk status update (e.g. all AVAILABLE → MAINTENANCE for renovation)
- [ ] Room compare view side-by-side
- [ ] Revenue per room analytics (total earned, occupancy %)
- [ ] Drag-and-drop image reorder
- [ ] QR code per room (for guest self check-in or housekeeping)
- [ ] Seasonal price override per room (beyond rate plans)

---

## Status

সব core feature ✅ live:
- Room CRUD, status management, image gallery, video URL support
- Server-side search, type filter, clickable stats, pagination
- Current booking shown in detail sheet
- Delete blocked if active bookings — June 2026

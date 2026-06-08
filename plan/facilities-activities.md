# ResortPro — Facilities & Activities Section

## Overview

Resort owner dashboard থেকে facilities (Pool, Spa, Gym) এবং activities (Boat ride, Hiking, Cooking class) যোগ করবে। Public website-এ আলাদা section-এ দেখাবে। Guest চাইলে activity book করতে পারবে।

---

## ১. Public Website-এ কেমন দেখাবে

### Facilities Section
```
┌──────────────────────────────────────────────┐
│          Our Facilities                       │
│                                               │
│  🏊 Swimming Pool    🧖 Spa & Wellness        │
│  Open 6am–10pm      Open 9am–8pm             │
│  Heated infinity    Full body treatments,    │
│  pool, ocean view   massage, facials         │
│                                               │
│  🏋 Fitness Center  🎾 Tennis Court          │
│  Open 24 hours      Book in advance          │
│  Modern equipment   Outdoor clay court       │
└──────────────────────────────────────────────┘
```

### Activities Section
```
┌──────────────────────────────────────────────┐
│          Activities & Experiences             │
│                                               │
│  [Boat Trip]   [Snorkeling]   [Cooking Class]│
│  ৳1,500/person  ৳800/person   ৳2,000/person │
│  Daily 9am      Daily         Sat & Sun      │
│  Max 10 people  Max 6 people  Max 8 people   │
│  [Book Now]     [Book Now]    [Book Now]     │
└──────────────────────────────────────────────┘
```

---

## ২. Dashboard (Owner Side)

### `/dashboard/facilities`

```
Tabs: [Facilities] [Activities]

Facilities Tab:
  [+ Add Facility]
  ─────────────────────────────
  🏊 Swimming Pool
  Open: 6:00 AM – 10:00 PM
  [Edit] [Hide] [Delete]
  ─────────────────────────────
  🧖 Spa & Wellness
  Open: 9:00 AM – 8:00 PM
  [Edit] [Hide] [Delete]

Activities Tab:
  [+ Add Activity]
  ─────────────────────────────
  🚣 Boat Trip — ৳1,500/person
  Daily 9am | Max 10 guests
  [Edit] [Hide] [Delete]
```

### Add Facility Form
```
Name:         [ Swimming Pool                ]
Icon:         [ 🏊 ] (emoji picker)
Description:  [ Heated infinity pool with... ]
Opening Hours: From [06:00] To [22:00]
Photo:        [ Upload image ]
Show on website: [✓]
Sort order:   [ 1 ]
```

### Add Activity Form
```
Name:         [ Boat Trip                    ]
Category:     [ Water  ▾ ] (Water/Land/Cultural/Wellness)
Icon/Photo:   [ Upload image ]
Description:  [ Explore the coastline...    ]
Price:        [ ৳1,500 ] per [ Person ▾ ]
Duration:     [ 3 ] hours
Schedule:     [ Daily ] at [ 09:00 ]
Max Guests:   [ 10 ]
Min Advance:  [ 24 ] hours notice needed
Available days: [✓Mon ✓Tue ✓Wed ✓Thu ✓Fri ✓Sat ✓Sun]
Bookable online: [✓]
Show on website: [✓]
```

---

## ৩. Activity Booking Flow

Guest website থেকে activity book করতে পারবে:
```
1. Activity card → "Book Now" click
2. Date select + guest count
3. Name + phone + room number (if checked-in)
4. Confirm → Email/WhatsApp confirmation
5. Resort dashboard-এ notification আসবে
```

---

## ৪. Database Schema

```prisma
model Facility {
  id          String  @id @default(cuid())
  tenantId    String
  tenant      Tenant  @relation(fields: [tenantId], references: [id])
  name        String
  icon        String?    // emoji or icon name
  description String?
  imageUrl    String?
  opensAt     String?    // "06:00"
  closesAt    String?    // "22:00"
  isVisible   Boolean @default(true)
  sortOrder   Int     @default(0)
  createdAt   DateTime @default(now())
}

model Activity {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  name         String
  category     String   // WATER | LAND | CULTURAL | WELLNESS
  description  String?
  imageUrl     String?
  pricePerUnit Float
  priceUnit    String   @default("person") // person | group | session
  durationHrs  Float?
  schedule     String?  // "Daily 9am" free text or cron-like
  availableDays Int[]   // [1,2,3,4,5,6,0] day of week
  scheduledTime String? // "09:00"
  maxGuests    Int?
  minAdvanceHrs Int     @default(0)
  isBookable   Boolean  @default(true)
  isVisible    Boolean  @default(true)
  sortOrder    Int      @default(0)
  bookings     ActivityBooking[]
  createdAt    DateTime @default(now())
}

model ActivityBooking {
  id         String   @id @default(cuid())
  activityId String
  activity   Activity @relation(fields: [activityId], references: [id])
  tenantId   String
  guestName  String
  guestPhone String?
  guestEmail String?
  roomNumber String?   // if checked-in guest
  date       DateTime
  guestCount Int
  totalPrice Float
  status     String   @default("PENDING") // PENDING | CONFIRMED | CANCELLED
  notes      String?
  createdAt  DateTime @default(now())
}
```

---

## ৫. API Endpoints

```
// Owner (authenticated)
GET    /api/tenant/facilities              → list
POST   /api/tenant/facilities              → create
PATCH  /api/tenant/facilities/:id          → update
DELETE /api/tenant/facilities/:id          → delete

GET    /api/tenant/activities              → list
POST   /api/tenant/activities              → create
PATCH  /api/tenant/activities/:id          → update
DELETE /api/tenant/activities/:id          → delete
GET    /api/tenant/activities/bookings     → list activity bookings

// Public (no auth)
GET    /api/public/:slug/facilities        → website display
GET    /api/public/:slug/activities        → website display
POST   /api/public/:slug/activities/:id/book → book an activity
```

---

## ৬. Theme Integration

সব theme-এ দুটো নতুন section:

```typescript
// sections/FacilitiesSection.tsx
// data.facilities[] → grid of facility cards with icon, name, hours

// sections/ActivitiesSection.tsx  
// data.activities[] → cards with photo, price, "Book Now" button
// "Book Now" → ActivityBookingModal (shared widget)
```

`ThemeProps` / `ResortData`-এ যোগ হবে:
```typescript
interface ResortData {
  // existing...
  facilities: Facility[]
  activities: Activity[]
}
```

---

## ৭. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ Facility + Activity + ActivityBooking models
  ✦ Migrate

Step 2 — API (2 days)
  ✦ Owner CRUD for facilities & activities
  ✦ Public endpoints
  ✦ Activity booking endpoint (with email/WhatsApp notification)

Step 3 — Dashboard UI (2 days)
  ✦ /dashboard/facilities page
  ✦ Add/Edit forms
  ✦ Activity bookings list

Step 4 — Public Website (2 days)
  ✦ FacilitiesSection + ActivitiesSection components
  ✦ ActivityBookingModal (shared widget)
  ✦ Add to all themes + ResortData type
  ✦ Public API call to fetch facilities & activities

Total: ~6.5 days
```

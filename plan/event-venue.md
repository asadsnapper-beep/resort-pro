# ResortPro — Event & Venue Management

## Overview

Resort-এ conference room, banquet hall, lawn, pool deck — এই ধরনের venues book করার system। Corporate event, wedding, birthday, team outing। Venue availability check + booking + billing।

---

## ১. Venue Types

```
Venues (resort add করবে):
  ├── Conference Room A (30 pax, projector, AC)
  ├── Banquet Hall (200 pax, stage, dance floor)
  ├── Garden Lawn (500 pax, outdoor)
  ├── Pool Deck (50 pax, evening only)
  └── Private Dining Room (12 pax)
```

---

## ২. Dashboard `/dashboard/venues`

```
┌──────────────────────────────────────────────────┐
│  Venues & Events               [+ Add Venue]    │
│                                                  │
│  Tabs: [Venues] [Bookings] [Calendar]           │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ 🏛 Banquet Hall                           │ │
│  │ Capacity: 200 pax                          │ │
│  │ Rate: ৳25,000/half-day | ৳45,000/full-day │ │
│  │ This week: 2 bookings                      │ │
│  │ [Edit] [View Calendar] [Bookings]         │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Add Venue Form
```
Venue Name:     [ Banquet Hall                   ]
Type:           [ Indoor ▾ ] (Indoor/Outdoor/Both)
Capacity:       [ 200 ] pax max
Description:    [ Elegant banquet hall with...   ]
Photos:         [+ Upload]
Amenities:      [✓] AC  [✓] Projector  [✓] WiFi
                [✓] Stage  [✓] Catering setup
                [ ] Swimming pool access

Pricing:
  Half day (4hr): ৳[ 25,000 ]
  Full day (8hr): ৳[ 45,000 ]
  Per hour:       ৳[ 8,000  ] (optional)
  Extra hours:    ৳[ 5,000  ]/hr (overtime)

Operating Hours:
  From: [ 08:00 ]  To: [ 22:00 ]
  Available days: [✓All days]

Advance notice: [ 48 ] hours minimum

Show on website: [✓]
```

---

## ৩. Venue Booking

### Calendar View
```
Month view — বুকড dates blocked দেখাবে:

June 2026:
  Jun 6 (Sat): Banquet Hall — Wedding (FULL DAY) ████
  Jun 8 (Mon): Conference A — Corporate (AM) ████░░
  Jun 13 (Sat): Garden Lawn — Birthday Party ████
```

### New Venue Booking
```
Client Name:    [ ABC Corporation             ]
Contact:        [ 01712-345678               ]
Email:          [ hr@abccorp.com             ]
Event Type:     [ Corporate Event ▾ ]
                (Wedding/Birthday/Corporate/Social/Other)

Venue:          [ Conference Room A ▾ ]
Date:           [ Jun 15, 2026 ]
Time:           From [09:00] To [17:00]  (Full day)
Guests:         [ 25 ]

Add-ons:
  [✓] Catering: [ Lunch + tea breaks ]  ৳[ 8,000 ]
  [✓] AV/Projector: included
  [ ] Accommodation: [ ] rooms for [ ] nights
  [ ] Decoration: ৳[ ]

Pricing:
  Conference Room A full day:  ৳20,000
  Catering:                    ৳8,000
  ─────────────────────────────────
  Total:                       ৳28,000
  Advance (50%):               ৳14,000

Payment Status:  [ Advance paid ▾ ]
Notes:           [ Client needs projector by 9am ]

[Create Booking]
```

---

## ৪. Public Website Integration

```
Venues Section on resort website:
  ├── Venue cards (photo, capacity, rate, amenities)
  └── "Enquire Now" button → Contact form with
      pre-filled: "Interested in Banquet Hall"

(Full online venue booking optional — can be enquiry-only)
```

---

## ৫. Database Schema

```prisma
model Venue {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])

  name         String
  type         String   // INDOOR | OUTDOOR | BOTH
  capacity     Int
  description  String?
  photos       String[]
  amenities    String[]

  halfDayRate  Float?
  fullDayRate  Float?
  hourlyRate   Float?
  overtimeRate Float?

  opensAt      String   // "08:00"
  closesAt     String   // "22:00"
  minAdvanceHrs Int     @default(24)
  isVisible    Boolean  @default(true)
  isActive     Boolean  @default(true)

  bookings     VenueBooking[]
  createdAt    DateTime @default(now())
}

model VenueBooking {
  id           String   @id @default(cuid())
  tenantId     String
  venueId      String
  venue        Venue    @relation(fields: [venueId], references: [id])

  clientName   String
  clientPhone  String
  clientEmail  String?
  eventType    String   // WEDDING | BIRTHDAY | CORPORATE | SOCIAL | OTHER

  date         DateTime
  startTime    String   // "09:00"
  endTime      String   // "17:00"
  guestCount   Int

  baseAmount   Float
  addonsAmount Float    @default(0)
  totalAmount  Float
  paidAmount   Float    @default(0)
  addons       Json?    // { catering: 8000, decoration: 5000 }
  notes        String?

  status       String   @default("CONFIRMED")  // TENTATIVE|CONFIRMED|CANCELLED
  createdAt    DateTime @default(now())
}
```

---

## ৬. API Endpoints

```
// Owner
GET    /api/tenant/venues              → list venues
POST   /api/tenant/venues              → create venue
PATCH  /api/tenant/venues/:id          → update
DELETE /api/tenant/venues/:id          → delete

GET    /api/tenant/venue-bookings      → list bookings (filter by venue/date)
POST   /api/tenant/venue-bookings      → create booking
PATCH  /api/tenant/venue-bookings/:id  → update/cancel

GET    /api/tenant/venues/:id/availability?date=2026-06-15
  → { available: true/false, slots: [...] }

// Public
GET    /api/public/:slug/venues        → for website display
POST   /api/public/:slug/venue-enquiry → send enquiry (no direct booking)
```

---

## ৭. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ Venue + VenueBooking models
  ✦ Migrate

Step 2 — API (2 days)
  ✦ Venue CRUD
  ✦ Booking CRUD
  ✦ Availability check

Step 3 — Dashboard UI (2.5 days)
  ✦ /dashboard/venues page
  ✦ Venue cards + add/edit
  ✦ Booking form (with pricing calculator)
  ✦ Calendar view (booked dates)

Step 4 — Website (0.5 day)
  ✦ Venues section in themes
  ✦ Enquiry form

Total: ~5.5 days
```

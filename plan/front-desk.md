# ResortPro — Front Desk & PMS Operations

## Overview

হোটেলের front desk এর daily operation — check-in, check-out, walk-in booking, room assignment, guest messaging, daily occupancy view। এটা হলো property management system (PMS) এর core।

---

## ১. Front Desk Dashboard `/dashboard/front-desk`

```
┌──────────────────────────────────────────────────────────┐
│  Front Desk                          Today: Jun 6, 2026  │
│                                                          │
│  🏨 24 rooms total  ✅ 14 occupied  🔴 6 dirty  🟢 4 available │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐      │
│  │ Arrivals    │ │ Departures  │ │ In-House     │      │
│  │ Today: 5    │ │ Today: 3    │ │ Guests: 28   │      │
│  │ Pending: 3  │ │ Checked: 2  │ │              │      │
│  └─────────────┘ └─────────────┘ └──────────────┘      │
└──────────────────────────────────────────────────────────┘
```

---

## ২. Arrivals List (আজকের check-in)

```
┌──────────────────────────────────────────────────────┐
│  Today's Arrivals                                    │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Rahman Ahmed                   Room: 201     │   │
│  │ 📞 01712-345678                Deluxe Ocean  │   │
│  │ 2 Adults, 1 Child              2 nights      │   │
│  │ Booking #BK-2345  |  Paid ✅                 │   │
│  │                                               │   │
│  │ [Assign Room ▾]  [Check In]  [Message Guest] │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Fatima Khan                    Room: TBD     │   │
│  │ 📞 01812-567890                Suite         │   │
│  │ 2 Adults                       3 nights      │   │
│  │ Booking #BK-2346  |  Pay at hotel 💰         │   │
│  │                                               │   │
│  │ [Assign Room ▾]  [Check In]  [Message Guest] │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## ৩. Check-In Flow

```
1. Booking select → "Check In" click

2. Check-In Modal:
   ┌──────────────────────────────────┐
   │  Check In — Rahman Ahmed         │
   │                                   │
   │  Room Assigned: 201 ✅            │
   │  (Room 201 is Clean & Ready)     │
   │                                   │
   │  Guest ID verified: [✓]          │
   │  Deposit collected: [✓] ৳5,000  │
   │                                   │
   │  Key card issued: [✓]            │
   │  Welcome kit given: [✓]          │
   │                                   │
   │  Notes: [Guest requested extra   │
   │          pillow]                 │
   │                                   │
   │  [Confirm Check-In]              │
   └──────────────────────────────────┘

3. On confirm:
   - Booking status → CHECKED_IN
   - Room status → OCCUPIED
   - Check-in time recorded
   - WhatsApp welcome message sent (optional)
```

---

## ৪. Check-Out Flow

```
1. In-house guest → "Check Out" click

2. Check-Out Modal:
   ┌──────────────────────────────────┐
   │  Check Out — Rahman Ahmed        │
   │  Room 201 | 2 nights             │
   │                                   │
   │  Room Charges:                   │
   │  ─────────────────────────────   │
   │  Room (2 nights × ৳8,000)       │
   │  = ৳16,000                       │
   │  Restaurant charges: ৳2,350     │
   │  Mini-bar: ৳450                 │
   │  ─────────────────────────────   │
   │  Total: ৳18,800                  │
   │  Paid: ৳16,000 (online)         │
   │  Due: ৳2,800 💰                  │
   │                                   │
   │  Payment method: [Cash ▾]        │
   │                                   │
   │  [Print Invoice]  [Check Out]    │
   └──────────────────────────────────┘

3. On confirm:
   - Booking status → CHECKED_OUT
   - Room status → DIRTY
   - HousekeepingTask auto-created
   - Invoice emailed to guest
```

---

## ৫. Walk-In Booking

```
Walk-in guest এলে front desk সরাসরি book করতে পারবে।

[+ New Walk-In] button:
  ┌──────────────────────────────────┐
  │  Walk-In Booking                 │
  │                                   │
  │  Guest Name:  [               ]  │
  │  Phone:       [               ]  │
  │  Adults: [2]  Children: [0]      │
  │                                   │
  │  Room Type: [Deluxe ▾]          │
  │  Available rooms: 101, 203, 205  │
  │  Select: [203 ▾]                │
  │                                   │
  │  Check-In:  [Today ✓]           │
  │  Check-Out: [Jun 8]             │
  │  Nights: 2                        │
  │                                   │
  │  Rate: ৳8,000/night              │
  │  Total: ৳16,000                  │
  │  Discount: [0] %                 │
  │  Final: ৳16,000                  │
  │                                   │
  │  Payment: ● Cash  ○ Card  ○ Later│
  │  Advance: [৳8,000]               │
  │                                   │
  │  [Create & Check In]             │
  └──────────────────────────────────┘
```

---

## ৬. Room Map View

```
Visual floor plan — drag-and-drop room assignment:

Floor 1:
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ 101  │ │ 102  │ │ 103  │ │ 104  │
│ ✅   │ │ 🔴   │ │ 👤   │ │ 👤   │
│Clean │ │Dirty │ │Rahman│ │Fatima│
└──────┘ └──────┘ └──────┘ └──────┘

Color coding:
🟢 Available & Clean
🔴 Dirty (needs cleaning)
🟡 Cleaning in progress
👤 Occupied
⚠️ Out of order
🚫 Do Not Disturb
```

---

## ৭. In-House Guest List

```
Currently staying guests:

Guest           Room   Checked In   Check Out   Balance
Rahman Ahmed    201    Jun 4        Jun 6       ৳0
Fatima Khan     305    Jun 5        Jun 8       ৳2,800 due
Karim Hossain   102    Jun 6        Jun 7       ৳0

[Message All]  [Export]
```

---

## ৮. Database Changes

```prisma
// Booking model-এ add হবে:
model Booking {
  // existing fields...
  checkedInAt    DateTime?
  checkedOutAt   DateTime?
  checkedInBy    String?    // staff user ID
  checkedOutBy   String?
  roomNotes      String?    // front desk notes
  deposit        Float?     // deposit collected at check-in
  walkIn         Boolean    @default(false)
}
```

---

## ৯. API Endpoints

```
POST   /api/tenant/bookings/:id/check-in     → check in guest
POST   /api/tenant/bookings/:id/check-out    → check out + settle bill
POST   /api/tenant/bookings/walk-in          → create walk-in + check-in
GET    /api/tenant/front-desk/today          → today's arrivals, departures, in-house
GET    /api/tenant/front-desk/room-map       → all rooms with status for map view
```

---

## ১০. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ Booking model check-in/out fields
  ✦ Migrate

Step 2 — API (2 days)
  ✦ Check-in endpoint (validates room is CLEAN)
  ✦ Check-out endpoint (calculates total bill)
  ✦ Walk-in booking endpoint
  ✦ Today's summary endpoint
  ✦ Room map endpoint

Step 3 — Dashboard UI (3 days)
  ✦ /dashboard/front-desk page
  ✦ Arrivals / Departures / In-house tabs
  ✦ Check-in modal
  ✦ Check-out modal (with bill summary)
  ✦ Walk-in booking modal
  ✦ Room map visual

Total: ~5.5 days
```

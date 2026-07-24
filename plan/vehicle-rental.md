# ResortPro — Vehicle Rental (গাড়ি/বাইক/স্কুটি/সাইকেল ভাড়া)

## Overview

অনেক resort-এর নিজস্ব গাড়ি, বাইক, স্কুটি, সাইকেল থাকে যা guest-দের ভাড়া দেওয়া হয় — এটা resort-এর নিজের সম্পত্তি track করা (Asset Register) থেকে আলাদা একটা ব্যাপার: এখানে **কে কখন কোন vehicle ভাড়া নিলো, কতক্ষণের জন্য, কত টাকা, deposit কত, ফেরত দেওয়ার সময় গাড়ির অবস্থা কেমন ছিল** — এই পুরো rental cycle track করতে হবে। Room booking-এর মতোই একটা booking system, শুধু asset room-এর বদলে vehicle।

---

## ১. Full Flow

```
Owner প্রথমে fleet যোগ করবে:
  Type (Car/Bike/Scooty/Bicycle/Van), Name ("Toyota Axio", "Honda CB Shine"),
  Registration Number, Hourly Rate, Daily Rate, Security Deposit amount

Guest ভাড়া নিতে চাইলে:
  Front Desk → vehicle select → guest (আর চাইলে তার room booking-এর সাথে link)
  → start time, end time → conflict check (একই vehicle একই সময়ে দুইজনকে দেওয়া যাবে না)
  → Reserved status-এ create হয়

Guest যখন আসল গাড়ি নিতে (Pickup):
  "Mark Out" — odometer reading, fuel level, condition notes লিখে রাখা,
  security deposit collect করা (cash/card, আলাদা track)
  → status: Out

Guest ফেরত দিলে (Return):
  "Mark Returned" — odometer in, fuel in, damage থাকলে note করা
  → total amount auto-calculate (hourly/daily rate × duration)
  → deposit ফেরত দেওয়া (ক্ষতি থাকলে কেটে রাখা যাবে)
  → guest-এর room booking-এর সাথে link করা থাকলে "Bill to Room" (Minibar/Laundry-র
    মতো একই InvoiceExtra mechanism দিয়ে)
```

---

## ২. Dashboard — `/dashboard/vehicles`

```
Tabs: Fleet | Rentals

Fleet tab:
┌────────────────────────────────────────────────────────────┐
│  Vehicles                                  [+ Add Vehicle] │
│  ─────────────────────────────────────────────────────────  │
│  Toyota Axio (Car)              DHK-GA-1234                │
│  ৳500/hr · ৳3,500/day · Deposit ৳5,000    🟢 Available     │
│  ─────────────────────────────────────────────────────────  │
│  Honda CB Shine (Bike)          DHK-MOT-5678                │
│  ৳100/hr · ৳600/day · Deposit ৳2,000       🔴 Rented        │
└────────────────────────────────────────────────────────────┘

Rentals tab:
┌────────────────────────────────────────────────────────────┐
│  Rentals                                  [+ New Rental]   │
│  ─────────────────────────────────────────────────────────  │
│  Honda CB Shine — Rahim Uddin                                │
│  Jul 24, 2pm → Jul 24, 6pm   ৳400   🟡 Out                  │
│  [Mark Returned]                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Schema

```prisma
enum VehicleType { CAR BIKE SCOOTY BICYCLE VAN OTHER }
enum VehicleAvailability { AVAILABLE RENTED MAINTENANCE }
enum RentalStatus { RESERVED OUT RETURNED CANCELLED }

model Vehicle {
  id                 String   @id @default(uuid())
  tenantId           String
  type               VehicleType @default(CAR)
  name               String
  registrationNumber String?
  capacity           Int?
  hourlyRate         Float?
  dailyRate          Float?
  depositAmount      Float?
  availability       VehicleAvailability @default(AVAILABLE)
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  tenant  Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  rentals VehicleRental[]
  @@index([tenantId])
  @@map("vehicles")
}

model VehicleRental {
  id                String   @id @default(uuid())
  tenantId          String
  vehicleId         String
  guestId           String?
  bookingId         String?          // guest's room booking, for "Bill to Room"
  guestName         String           // snapshot — works even without a Guest record
  guestPhone        String?
  startAt           DateTime
  endAt             DateTime
  actualReturnAt    DateTime?
  status            RentalStatus @default(RESERVED)
  rate              Float            // hourly or daily rate snapshot
  totalAmount       Float?
  depositCollected  Float?
  depositReturned   Float?
  odometerOut       Int?
  odometerIn        Int?
  fuelOut           String?
  fuelIn            String?
  conditionNotesOut String?
  conditionNotesIn  String?
  billed            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  vehicle Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  guest   Guest?  @relation(fields: [guestId], references: [id], onDelete: SetNull)
  booking Booking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  @@index([tenantId])
  @@index([vehicleId])
  @@map("vehicle_rentals")
}
```

## API Endpoints

```
GET/POST/PATCH  /api/vehicles                    Fleet CRUD
GET             /api/vehicles/availability        Check conflict for a date range

GET/POST        /api/vehicle-rentals              List + create (conflict-checked)
PATCH           /api/vehicle-rentals/:id/out       Mark picked up (odometer/fuel/condition + deposit)
PATCH           /api/vehicle-rentals/:id/return     Mark returned (odometer/fuel/damage, computes totalAmount)
POST            /api/vehicle-rentals/:id/bill       Bill to guest's room (InvoiceExtra, like Minibar/Laundry)
```

## File Structure

```
apps/api/src/routes/vehicles.ts                                (new)
apps/web/src/app/(dashboard)/dashboard/vehicles/page.tsx        (new)
apps/web/src/lib/api.ts                                         (vehiclesApi added)
apps/web/src/components/dashboard/sidebar.tsx                    (new nav item)
```

## Roles

Same pattern as Venues: `OWNER`, `MANAGER` full access; `RECEPTIONIST` can create rentals and mark out/return (front-desk operational task) but not manage the fleet catalog.

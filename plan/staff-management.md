# ResortPro — Staff Management Module

## Overview

Resort staff-দের manage করা — roles/departments, shift scheduling, task assignment, attendance। Housekeeping, front desk, restaurant, maintenance — সব department-এর staff এক জায়গায়।

> Note: Tech details (user roles/permissions) আলাদা plan-এ আছে: `roles-permissions.md`
> এই plan টা operational/HR side এর।

---

## ১. Staff Directory `/dashboard/staff`

```
┌──────────────────────────────────────────────────────┐
│  Staff                    [+ Add Staff]  [Export]   │
│                                                      │
│  Department: [All ▾]  Status: [Active ▾]            │
│                                                      │
│  Sarah Rahman        Housekeeping Supervisor         │
│  📞 01712-xxxxx      Active since: Mar 2025         │
│  Shifts: Mon–Fri     Today: 8am–4pm                │
│  [View] [Edit] [Schedule]                           │
│  ─────────────────────────────────────────────────  │
│  Karim Hossain       Maintenance Technician          │
│  📞 01812-xxxxx      Active since: Jan 2025         │
│  [View] [Edit] [Schedule]                           │
└──────────────────────────────────────────────────────┘
```

---

## ২. Staff Profile

```
Name:          Sarah Rahman
Role:          Housekeeping Supervisor
Department:    Housekeeping
Phone:         01712-345678
Email:         sarah@resort.com (login email)
Join Date:     March 1, 2025
Status:        Active

System Access:
  Dashboard Role: HOUSEKEEPING  (limited access)

Performance (auto-tracked):
  Rooms cleaned this month: 124
  Avg time per room: 28 min
  Tasks completed: 95%
  Open issues: 2

Attendance this week:
  Mon ✅  Tue ✅  Wed ✅  Thu 🔴  Fri —
```

---

## ৩. Shift Scheduling

### Weekly Schedule View
```
          Mon    Tue    Wed    Thu    Fri    Sat    Sun
Sarah     8–4    8–4    8–4    OFF    8–4    OFF    OFF
Karim     9–5    9–5    9–5    9–5    9–5    OFF    OFF
Rahim     OFF    2–10   2–10   2–10   2–10   2–10   2–10
Front1    6–2    6–2    6–2    6–2    6–2    6–2    OFF
```

### Add/Edit Shift
```
Staff:     [Sarah Rahman ▾]
Week:      [Jun 9–15, 2026]
Mon:  [✓] From [08:00] To [16:00]
Tue:  [✓] From [08:00] To [16:00]
Wed:  [✓] From [08:00] To [16:00]
Thu:  [ ] OFF
Fri:  [✓] From [08:00] To [16:00]
Sat:  [ ] OFF
Sun:  [ ] OFF
Notes: [Regular week]
[Save Schedule]
```

---

## ৪. Daily Task Assignment

```
Manager প্রতিদিন tasks assign করবে:

Housekeeping tasks: (auto-generated from checkouts)
  Room 102 → Sarah (Priority: HIGH - checkout today, next guest 3pm)
  Room 205 → Rahim
  Room 301 → Sarah (stayover clean)

Custom tasks:
  [+ Add Task]
  Task: "Deep clean pool area"
  Assign to: [Facilities team ▾]
  Due by: [2pm today]
  Priority: [MEDIUM ▾]
```

---

## ৫. Department Structure

```
Departments:
  HOUSEKEEPING     → housekeeping tasks
  FRONT_DESK       → check-in/out, walk-ins
  MAINTENANCE      → maintenance requests
  RESTAURANT       → F&B orders (future)
  MANAGEMENT       → owner/manager
  SECURITY         → (optional)
  ACTIVITIES       → activity guide/instructor
```

---

## ৬. Database Schema

```prisma
// Staff are Users with a Tenant association
// Existing User model covers login, role
// Add Staff-specific HR fields:

model StaffProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])

  department   String   // HOUSEKEEPING|FRONT_DESK|MAINTENANCE|etc.
  jobTitle     String?
  phone        String?
  joinDate     DateTime?
  status       String   @default("ACTIVE")  // ACTIVE|INACTIVE|ON_LEAVE
  notes        String?

  schedules    StaffSchedule[]
  createdAt    DateTime @default(now())
}

model StaffSchedule {
  id           String   @id @default(cuid())
  staffId      String
  staff        StaffProfile @relation(fields: [staffId], references: [id])
  tenantId     String

  weekStart    DateTime  // Monday of the week
  mon          Json?     // { from: "08:00", to: "16:00" } or null
  tue          Json?
  wed          Json?
  thu          Json?
  fri          Json?
  sat          Json?
  sun          Json?

  notes        String?
  createdAt    DateTime @default(now())
}
```

---

## ৭. API Endpoints

```
GET    /api/tenant/staff              → list staff
POST   /api/tenant/staff              → invite/add staff (sends email invite)
PATCH  /api/tenant/staff/:id          → update profile
DELETE /api/tenant/staff/:id          → deactivate

GET    /api/tenant/staff/:id/schedule → get weekly schedule
PUT    /api/tenant/staff/:id/schedule → set weekly schedule
GET    /api/tenant/schedule/week      → all staff schedule for a week
  ?weekStart=2026-06-09

GET    /api/tenant/staff/:id/tasks    → tasks assigned to this staff
GET    /api/tenant/staff/:id/performance → performance metrics
```

---

## ৮. Implementation Steps

```
Step 1 — Database (0.5 day)
  ✦ StaffProfile + StaffSchedule models
  ✦ Migrate

Step 2 — API (1.5 days)
  ✦ Staff CRUD (extend existing user invite flow)
  ✦ Schedule management
  ✦ Performance metrics query

Step 3 — Dashboard UI (2 days)
  ✦ /dashboard/staff page
  ✦ Staff profile view/edit
  ✦ Weekly schedule builder
  ✦ Department filter

Total: ~4 days
```

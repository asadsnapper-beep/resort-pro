# AI Staff Scheduling

## Overview

Hotel-এর staff roster AI দিয়ে optimize করবে — occupancy forecast, past demand patterns, এবং labor cost-এর ভিত্তিতে কোন shift-এ কতজন staff দরকার তা automatically suggest করবে।

---

## Goals

- Overstaffing (cost waste) এবং understaffing (poor service) উভয়ই avoid করা
- Fair shift distribution — কেউ সবসময় night shift না পায়
- Leave requests + skill requirements বিবেচনা করে scheduling
- Labor cost forecasting

---

## How It Works

```
Inputs
├── Upcoming occupancy forecast (from AI Demand Forecasting)
├── Historical staffing patterns (what worked before)
├── Staff availability (leave requests, contracted hours)
├── Skill requirements per shift (1 supervisor, 2 front desk, etc.)
└── Labor cost targets

         ↓

AI Optimization
├── Calculate required headcount per shift per department
├── Assign available staff respecting skills + fairness
├── Flag conflicts (overtime, back-to-back shifts, leave clash)
└── Show labor cost estimate

         ↓

Output: Weekly Schedule Draft
├── Manager reviews + approves
├── Staff notified via push notification
└── iCal/export for personal calendars
```

---

## Staffing Formula

```
Required Front Desk Staff:
- 1 person per 40 expected check-ins/day
- Minimum 1 per shift always

Required Housekeeping:
- 1 staff per 12 rooms to clean (checkout + stayover)
- Scale with occupancy forecast

Required Restaurant Staff:
- Based on covers forecast (meals expected)
- Minimum 2 per meal period
```

---

## Database Schema

```prisma
model StaffShift {
  id           String   @id @default(cuid())
  hotelId      String
  staffId      String
  department   String   // "front_desk" | "housekeeping" | "restaurant" | "maintenance"
  shiftDate    DateTime
  shiftStart   DateTime
  shiftEnd     DateTime
  role         String   // "supervisor" | "staff" | "trainee"
  status       String   @default("scheduled") // "scheduled" | "confirmed" | "completed" | "absent"
  notes        String?
  isAiGenerated Boolean @default(false)

  hotel Hotel @relation(fields: [hotelId], references: [id])
  staff User  @relation(fields: [staffId], references: [id])
}

model LeaveRequest {
  id          String   @id @default(cuid())
  hotelId     String
  staffId     String
  startDate   DateTime
  endDate     DateTime
  leaveType   String   // "annual" | "sick" | "emergency"
  reason      String?
  status      String   @default("pending") // "pending" | "approved" | "rejected"
  approvedById String?
  createdAt   DateTime @default(now())

  hotel      Hotel @relation(fields: [hotelId], references: [id])
  staff      User  @relation("LeaveStaff", fields: [staffId], references: [id])
  approvedBy User? @relation("LeaveApprover", fields: [approvedById], references: [id])
}

model StaffingRequirement {
  id         String @id @default(cuid())
  hotelId    String
  department String
  dayOfWeek  Int    // 0=Sunday … 6=Saturday
  shift      String // "morning" | "afternoon" | "night"
  minStaff   Int
  maxStaff   Int
  requiredSkills Json? // ["supervisor_required": true]

  hotel Hotel @relation(fields: [hotelId], references: [id])
}
```

---

## API Endpoints

```
POST /api/staff/schedule/generate             — AI schedule for next week
GET  /api/staff/schedule?week=2024-W42        — get week schedule
PUT  /api/staff/schedule/:id/publish          — notify staff
GET  /api/staff/schedule/my                   — my upcoming shifts (staff view)
POST /api/staff/leave                         — submit leave request
GET  /api/staff/leave                         — leave requests (manager view)
PUT  /api/staff/leave/:id/approve             — approve/reject
GET  /api/staff/requirements                  — staffing requirements config
PUT  /api/staff/requirements/:id              — update requirements
GET  /api/staff/analytics/labor-cost          — labor cost report
```

---

## Frontend UI

### Manager — Weekly Schedule View
- Grid: days of week × staff members
- Color-coded by department
- Click to swap shifts
- Conflict highlights (overtime, leave clash)
- Labor cost counter (live update as shifts change)
- "AI Generate" button → draft → review → publish

### Staff — My Schedule View
- Monthly calendar with my shifts
- Shift details: start/end, role, location
- Leave request button
- Notification when schedule changes

---

## Implementation Phases

### Phase 1 — Manual Scheduling (1 week)
- [ ] DB migration
- [ ] Shift CRUD
- [ ] Weekly schedule grid UI
- [ ] Leave request flow
- [ ] Staff notifications

### Phase 2 — AI Optimization (1 week)
- [ ] Staffing requirements configuration
- [ ] AI schedule generation (Claude + algorithm)
- [ ] Labor cost calculation
- [ ] Conflict detection

### Phase 3 — Advanced (future)
- [ ] Integration with occupancy forecast
- [ ] iCal export
- [ ] Mobile app for staff
- [ ] Shift swap requests between staff

---

## Files to Create/Modify

```
apps/api/src/routes/staff/scheduling.ts         — endpoints
apps/api/src/services/ai/scheduleOptimizer.ts   — AI logic
apps/web/src/pages/staff/schedule/              — manager + staff UI
packages/database/prisma/schema.prisma          — models
```

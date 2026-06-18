# AI Housekeeping Optimizer

## Overview

Housekeeping team-এর daily schedule AI দিয়ে optimize করবে — checkout times, room priority, staff availability, এবং guest preferences বিবেচনা করে সবচেয়ে efficient cleaning route তৈরি করবে।

---

## Goals

- Housekeeping staff-এর কাজ fair ও efficiently distribute করা
- Early check-in requests prioritize করা (যে rooms আগে দরকার)
- Guest special requests track করা (hypoallergenic, no feather pillows, etc.)
- Supervisor-কে real-time progress দেখাতে পারা

---

## How It Works

```
Morning (6 AM) — Auto Schedule Generation
├── Today's checkouts (by time)
├── Today's check-ins (by expected arrival)
├── Early check-in requests flagged
├── Stayover rooms (scheduled cleaning time)
├── Maintenance flags
└── Staff roster (who's working, their zone)
         ↓
AI Optimization
├── Priority scoring per room
├── Route optimization per staff member
├── Balanced workload distribution
└── Buffer time calculation
         ↓
Output: Daily Schedule per Staff Member
         ↓
Staff Mobile View — Task list with priority order
Supervisor View — Full floor map with status
```

---

## Priority Scoring Algorithm

```
Priority Score (0–100) per room:

Base:
- Checkout room: 70 pts
- Stayover: 40 pts
- Inspection only: 20 pts

Modifiers:
+ 30 pts if early check-in request exists for this room
+ 20 pts if VIP guest checking in
+ 15 pts if guest complaint pending
+ 10 pts if room hasn't been cleaned in >24h
- 10 pts if checkout is late (after 2PM)

Final: clamp(score, 0, 100)
```

---

## Database Schema

```prisma
model HousekeepingSchedule {
  id          String   @id @default(cuid())
  hotelId     String
  scheduleDate DateTime
  generatedAt DateTime @default(now())
  generatedBy String   @default("ai") // "ai" | "manual"
  status      String   @default("draft") // "draft" | "published" | "in_progress" | "completed"
  tasks       HousekeepingTask[]

  hotel Hotel @relation(fields: [hotelId], references: [id])

  @@unique([hotelId, scheduleDate])
}

model HousekeepingTask {
  id           String   @id @default(cuid())
  scheduleId   String
  hotelId      String
  roomId       String
  assignedToId String?  // Staff userId
  taskType     String   // "checkout_clean" | "stayover" | "inspection" | "deep_clean" | "turndown"
  priority     Int      // 0–100
  orderInRoute Int      // staff's task sequence number
  estimatedMinutes Int  @default(30)

  specialNotes     String?  // "Guest allergic to feathers"
  guestRequests    Json?    // specific requests from guest profile
  earlyCheckIn     Boolean  @default(false)
  targetReadyTime  DateTime?

  status      String   @default("pending") // "pending" | "in_progress" | "done" | "skipped"
  startedAt   DateTime?
  completedAt DateTime?
  notes       String?  // staff notes after completion
  photos      Json?    // photo proof URLs

  schedule  HousekeepingSchedule @relation(fields: [scheduleId], references: [id])
  room      Room                 @relation(fields: [roomId], references: [id])
  assignedTo User?               @relation(fields: [assignedToId], references: [id])
}

model RoomStatus {
  id          String   @id @default(cuid())
  hotelId     String
  roomId      String   @unique
  status      String   // "clean" | "dirty" | "in_progress" | "inspected" | "out_of_order"
  updatedAt   DateTime @updatedAt
  updatedById String?

  room  Room  @relation(fields: [roomId], references: [id])
  hotel Hotel @relation(fields: [hotelId], references: [id])
}
```

---

## API Endpoints

```
POST /api/housekeeping/schedule/generate       — AI schedule generation
GET  /api/housekeeping/schedule/:date          — get day's schedule
PUT  /api/housekeeping/schedule/:id/publish    — publish to staff
POST /api/housekeeping/schedule/:id/reassign   — reassign task to different staff

GET  /api/housekeeping/tasks/my                — staff: my tasks for today
PUT  /api/housekeeping/tasks/:id/start         — mark task started
PUT  /api/housekeeping/tasks/:id/complete      — mark task done (with notes/photo)
PUT  /api/housekeeping/tasks/:id/skip          — skip with reason

GET  /api/housekeeping/room-status             — floor map status
PUT  /api/housekeeping/room-status/:roomId     — update room status
GET  /api/housekeeping/analytics               — performance metrics
```

---

## Frontend UI

### Supervisor View
- **Floor map** with room status colors:
  - 🔴 Dirty / checkout pending
  - 🟡 In progress
  - 🟢 Clean / ready
  - ⚫ Out of order
- Staff progress: "Ahmed: 3/8 rooms done"
- Priority rooms highlighted (early check-in)
- Drag-to-reassign tasks

### Staff Mobile View (phone-optimized)
- My task list for today (ordered by priority/route)
- Each task: room number, type, estimated time, special notes
- One-tap: Start → Done
- Photo upload option
- Notes field

### Schedule Generation Panel
- "Generate Today's Schedule" button
- Preview before publishing
- Manual override: drag-drop task order
- Publish to all staff button

---

## AI Optimization Prompt (Claude)

```
Generate an optimized housekeeping schedule for {date} at {hotelName}.

Staff available today: {staffList with zones}
Rooms to clean:
{roomList with: roomNumber, floor, taskType, priority, targetTime, specialNotes}

Goals:
1. Prioritize rooms where early check-in requested
2. Keep each staff member on same floor when possible (minimize travel)
3. Balance workload (each staff gets similar estimated cleaning time)
4. Schedule high-priority rooms first

Return JSON:
{
  assignments: [
    {
      staffId: string,
      tasks: [{ roomId, taskType, orderInRoute, estimatedMinutes, notes }]
    }
  ],
  unassigned: [{ roomId, reason }],
  summary: "Human-readable schedule summary"
}
```

---

## Implementation Phases

### Phase 1 — Manual Schedule + Room Status (1.5 weeks)
- [ ] DB schema migration
- [ ] Room status tracking API
- [ ] Manual task creation and assignment
- [ ] Staff mobile view (task list)
- [ ] Supervisor floor map view
- [ ] Task start/complete flow

### Phase 2 — AI Schedule Generation (1 week)
- [ ] Priority scoring algorithm
- [ ] Claude optimization call
- [ ] Generate → Preview → Publish flow
- [ ] Performance analytics

### Phase 3 — Advanced Features (future)
- [ ] Photo proof upload per task
- [ ] Housekeeping quality inspection workflow
- [ ] Deep clean scheduling (weekly rotation)
- [ ] Integration with maintenance requests

---

## Files to Create/Modify

```
apps/api/src/routes/housekeeping/            — all endpoints
apps/api/src/services/ai/scheduleOptimizer.ts — AI logic
apps/web/src/pages/housekeeping/supervisor/  — supervisor UI
apps/web/src/pages/housekeeping/staff/       — staff mobile UI
packages/database/prisma/schema.prisma       — models
```

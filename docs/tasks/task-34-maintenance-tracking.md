# Task 34 — Maintenance Tracking

**Branch:** `feature/maintenance`
**Priority:** 🟡 Important
**Estimate:** 1 day

---

## Goal
Room maintenance request system — AC broken, plumbing issue, electrical fault। Housekeeping-এর বাইরে technical issues track করা।

---

## Prisma

```prisma
enum MaintenancePriority { URGENT HIGH NORMAL LOW }
enum MaintenanceStatus   { OPEN IN_PROGRESS RESOLVED }
enum MaintenanceIssueType { AC PLUMBING ELECTRICAL FURNITURE DOOR WIFI TV OTHER }

model MaintenanceTicket {
  id          String               @id @default(cuid())
  tenantId    String
  roomId      String
  issueType   MaintenanceIssueType
  description String
  priority    MaintenancePriority  @default(NORMAL)
  status      MaintenanceStatus    @default(OPEN)
  assignedTo  String?              // staff user id
  resolvedAt  DateTime?
  notes       String?              // resolution notes
  createdBy   String               // staff user id
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  room        Room    @relation(fields: [roomId], references: [id])
  tenant      Tenant  @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status])
  @@map("maintenance_tickets")
}
```

---

## Steps

### Step 1 — API
`apps/api/src/routes/maintenance.ts` (new file)

- `GET /api/maintenance` — list (filter by status, room, priority)
- `POST /api/maintenance` — create ticket → set room status to `MAINTENANCE`
- `PATCH /api/maintenance/:id` — update (assign, status change, add notes)
- `PATCH /api/maintenance/:id/resolve` — resolve → restore room status

**Room status logic:**
- When ticket created → set `room.status = MAINTENANCE` (blocks booking)
- When ticket resolved → set `room.status = AVAILABLE` (or CLEANING if needed)
- If multiple open tickets for same room → restore only when all resolved

### Step 2 — UI page
`apps/web/src/app/(dashboard)/dashboard/maintenance/page.tsx`

Sections:
- **Summary strip:** Open (red count), In Progress (amber), Resolved today (green)
- **Ticket list:** priority badge, room number, issue type, description truncated, assigned to, created time, status
- **Create ticket button** → modal:
  - Room picker (dropdown)
  - Issue type (icon grid: AC ❄️, Plumbing 🔧, Electrical ⚡, etc.)
  - Description textarea
  - Priority selector
  - Assign to (staff dropdown)
- **Per ticket:** status update dropdown, add resolution note, resolve button

### Step 3 — Room status display
In room list and booking calendar — `MAINTENANCE` rooms show orange lock icon।

### Step 4 — Sidebar link
Add `Maintenance` link (Wrench icon) to dashboard sidebar।

### Step 5 — Dashboard widget
Homepage dashboard: "Open Maintenance" count card — click → goes to maintenance page।

---

## Acceptance Criteria
- [ ] Create ticket sets room to MAINTENANCE
- [ ] MAINTENANCE rooms blocked from new bookings
- [ ] Assign ticket to staff member
- [ ] Status progression: OPEN → IN_PROGRESS → RESOLVED
- [ ] Resolve restores room status
- [ ] Priority levels work and visible
- [ ] Dashboard shows open ticket count

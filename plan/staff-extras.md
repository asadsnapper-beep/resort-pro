# ResortPro — Staff Extras: Attendance, Salary Adjustments, Training

> Extends `plan/staff-management.md`. Current Staff module is directory-only —
> department, position, hire date, invite/deactivate. No attendance, no salary
> field at all, no training tracking. Adds three new tabs on `/dashboard/staff`
> (Directory / Attendance / Salary / Training).

---

## ১. Auto Attendance (fingerprint device support)

Real fingerprint machines (ZKTeco, eSSL, etc.) live on-premise and I can't test
against actual hardware from here — so this plan covers the two integration
paths that work with virtually any such device, plus a manual fallback:

```
Prottek staff-er Staff record-e ekta "Device User ID" thakbe
  (fingerprint machine-e configure kora shei staff-er internal ID/code — jemon "1024")

Path A — CSV Import (universal, shob device support kore):
  Prottek device-er nijer software theke attendance log CSV/Excel export kora jay
  (DeviceUserId, DateTime, In/Out — এই ৩টা column shob device-e-i thake)
  Owner/Manager "Attendance" tab-e "Import CSV" — device user ID diye
  amader Staff record-er shathe match kore, punches theke clockIn/clockOut/
  hoursWorked/LATE-PRESENT status auto-calculate kore bulk create hoy

Path B — Webhook (jei device/bridge software push korte pare):
  Kichu modern device (cloud-enabled ZKTeco, ba ekta chhoto local bridge script
  jeta device-er SDK die punch poll kore) shorashori push korte pare:
  POST /api/attendance/device-webhook (tenant-er nijer secret key die protected)
  → {deviceUserId, timestamp, type: IN|OUT}
  Same auto status/hours calculation hoy

Fallback — Manual/self clock-in (fingerprint device na thakle):
  Staff nijei "Clock In"/"Clock Out" button click korte pare dashboard theke
  Shift start time-r shathe compare kore status set hoy

Owner/Manager "Attendance" tab-e shobar din-er attendance dekhe:
  staff list — status, clock in/out time, hours; keu miss korle manually
  mark kora jay (Present/Absent/On Leave)
```

Note: A live SDK connection straight into a physical fingerprint machine needs
an on-premise bridge/agent running next to the device — that's a separate piece
of software the resort would run locally (outside this web app), pointed at the
webhook above. I'm building the CSV import + webhook + manual fallback here;
that bridge script itself isn't something I can write and verify without the
actual hardware in front of me.

---

## ২. Salary Adjustment

```
Staff-er ekta Base Salary field thakbe (ekhon kichu nai)

Owner/Manager "Salary" tab-e kono staff select kore:
  "Record Adjustment":
    Type: Raise / Bonus / Deduction
    Amount, Reason, Effective Date
  Raise hole → base salary update hoy
  Bonus/Deduction → ekbar-er entry hisebe log hoy (payroll na, just tracking)

Prottek staff-er nijer "Salary History" dekha jay — ki ki adjustment hoise, kobe
```

Not a full payroll run system — just base salary + a change/bonus/deduction log,
matching the level of the rest of the app (tracking, not accounting automation).

---

## ৩. Training Schedule

```
Owner/Manager "Training" tab-e ekta session create kore:
  Title ("Fire Safety Training"), description, date, location, trainer,
  optional department filter (shudhu Housekeeping-ke, etc.)
  → Staff invite kore (individually ba pura department)

Session-er niche attendee list — each-er status: Invited / Attended / Missed
Training-er din pore Owner/Manager attendance mark kore dey
```

---

## Schema

```prisma
model StaffAttendance {
  id          String   @id @default(uuid())
  tenantId    String
  staffId     String
  date        DateTime @db.Date
  clockIn     DateTime?
  clockOut    DateTime?
  status      String   @default("PRESENT") // PRESENT | LATE | ABSENT | ON_LEAVE
  hoursWorked Float?
  source      String   @default("MANUAL") // MANUAL | DEVICE_IMPORT | DEVICE_WEBHOOK
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  staff  Staff  @relation(fields: [staffId], references: [id], onDelete: Cascade)
  @@unique([staffId, date])
  @@index([tenantId])
  @@map("staff_attendance")
}

model SalaryAdjustment {
  id            String   @id @default(uuid())
  tenantId      String
  staffId       String
  type          String   // RAISE | BONUS | DEDUCTION
  amount        Float
  reason        String?
  effectiveDate DateTime @db.Date
  createdAt     DateTime @default(now())
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  staff  Staff  @relation(fields: [staffId], references: [id], onDelete: Cascade)
  @@index([tenantId])
  @@index([staffId])
  @@map("salary_adjustments")
}

model TrainingSession {
  id          String   @id @default(uuid())
  tenantId    String
  title       String
  description String?
  scheduledDate DateTime
  location    String?
  trainer     String?
  department  String?  // optional target filter
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant    Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  attendees TrainingAttendee[]
  @@index([tenantId])
  @@map("training_sessions")
}

model TrainingAttendee {
  id                String   @id @default(uuid())
  trainingSessionId String
  staffId           String
  status            String   @default("INVITED") // INVITED | ATTENDED | MISSED
  trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
  staff           Staff           @relation(fields: [staffId], references: [id], onDelete: Cascade)
  @@unique([trainingSessionId, staffId])
  @@map("training_attendees")
}

// Staff model gets: shiftStartTime String? ("09:00"), baseSalary Float?, deviceUserId String?
// Tenant model gets: attendanceDeviceKey String? (secret for the device-webhook endpoint)
```

## API Endpoints

```
POST /api/attendance/clock-in         Self-service (any staff)
POST /api/attendance/clock-out
GET  /api/attendance                  List (date/staff filter) — OWNER/MANAGER
PATCH /api/attendance/:id             Manual correction — OWNER/MANAGER
POST /api/attendance/import           CSV import from device export — OWNER/MANAGER
POST /api/attendance/device-webhook   Device/bridge push, secured by tenant device key

GET/POST  /api/salary/:staffId/adjustments   History + record — OWNER/MANAGER

GET/POST/PATCH /api/training                 Session CRUD — OWNER/MANAGER
POST /api/training/:id/invite                Add attendees (staff ids or department)
PATCH /api/training/:id/attendees/:staffId   Mark Attended/Missed
```

## File Structure

```
apps/api/src/routes/attendance.ts      (new)
apps/api/src/routes/salary.ts          (new)
apps/api/src/routes/training.ts        (new)
apps/web/src/app/(dashboard)/dashboard/staff/page.tsx  (extended: tabs)
apps/web/src/lib/api.ts                (attendanceApi, salaryApi, trainingApi)
```

## Roles

- Clock in/out: any authenticated staff user (self only)
- Attendance view/correction, Salary, Training management: `OWNER`, `MANAGER`

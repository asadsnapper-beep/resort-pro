# Offline-First Desktop App — ResortPro

## Core Philosophy

CAP Theorem অনুযায়ী offline + online একসাথে থাকলে ১০০% conflict-free সম্ভব না।
তাই এই plan তিনটা strategy-র combination:

```
┌─────────────────────────────────────────────────────────┐
│  Strategy 1: CRDT                                       │
│  → Inventory, Status, Notes                             │
│  → Mathematically 0% conflict                          │
├─────────────────────────────────────────────────────────┤
│  Strategy 2: Prevent Before It Happens                  │
│  → Booking = Draft until server confirms                │
│  → Financial = Read-only offline                        │
│  → Conflict হওয়ার সুযোগই নেই                           │
├─────────────────────────────────────────────────────────┤
│  Strategy 3: Graceful Human Handoff                     │
│  → বাকি ~5% edge case                                   │
│  → Clear UI + audit log + Manager decides               │
└─────────────────────────────────────────────────────────┘
```

**Target: 95% auto-handled, 5% human decision — এটাই theoretical maximum।**

---

## Feature Tiers

### Tier A — Full Offline (Read + Write, 0% Conflict by Design)

CRDT বা ownership model দিয়ে conflict mathematically impossible:

| Feature | Strategy | কেন Conflict হবে না |
|---|---|---|
| Guest Search / View | Read-only | শুধু পড়া, কোনো write নেই |
| Existing Booking View | Read-only | শুধু পড়া |
| Room Status Update | Priority Enum CRDT | MAINTENANCE > OCCUPIED > AVAILABLE — rule deterministic |
| Housekeeping Task Status | Ownership + LWW | Staff নিজের task update করে, অন্যরা পারে না |
| F&B Order তৈরি / Status | Ownership + Append | Waiter নিজের order owns করে |
| Maintenance Log | Append-only | নতুন row যোগ হয়, পুরনো বদলায় না |
| Support Ticket Note | Append-only | Comments merge হয়, overwrite হয় না |
| Booking Calendar View | Read-only cache | শুধু পড়া |
| Staff Roster View | Read-only cache | শুধু পড়া |
| Menu Items View | Read-only cache | শুধু পড়া |

### Tier B — Offline Draft (Provisional, Server Confirms on Sync)

Offline-এ কাজ করা যাবে কিন্তু server confirm না করা পর্যন্ত "pending":

| Feature | Draft Behavior | Sync হলে কী হয় |
|---|---|---|
| Walk-in Booking Create | DRAFT status, room not blocked | Server validates availability → CONFIRMED বা CONFLICT |
| Check-in (existing booking) | Locally CHECKED_IN | Server confirms → final |
| Check-out | Locally CHECKED_OUT, invoice draft | Server confirms, invoice finalized |
| Guest Profile Create | Local UUID, syncs up | Server UPSERT, no conflict (UUID unique) |
| Support Ticket Create | Local, queued | Server receives, assigns ID |
| Cash Payment Record | Queued, not applied to invoice | Server applies to invoice |

### Tier C — Read-Only Offline

Offline-এ দেখা যাবে, কোনো edit নেই:

| Feature | কারণ |
|---|---|
| Invoice / Amount | Financial conflict resolve করা অনেক কঠিন |
| Expense Records | Accountant বিষয়, Manager-এর সিদ্ধান্ত দরকার |
| Rate Plans | Pricing বদলালে booking amount গড়বড় হবে |
| Offers / Promo Codes | Expired offer offline-এ apply হওয়া dangerous |
| Analytics / Reports | Cached data দেখাবে, real-time দরকার নেই |

### Tier D — Online Only (Lock করা থাকবে)

Offline-এ এই features-এ click করলে friendly message দেখাবে:

| Feature | কারণ |
|---|---|
| SMS / WhatsApp পাঠানো | External API (Twilio/Meta) |
| Email পাঠানো | SMTP / SendGrid |
| Online Payment | Payment gateway |
| Channel Sync (OTA) | Airbnb/Booking.com real-time |
| Custom Domain | Cloudflare DNS |
| Billing / Subscription | Stripe |
| Website Publish | CDN deploy |
| Staff Invite | Email verification দরকার |

---

## Data Design — CRDT Implementation

### Inventory: Delta Counter (not absolute)

```sql
-- পুরনো approach (conflict-prone) ❌
UPDATE inventory SET currentStock = 45 WHERE id = '...';

-- নতুন approach (CRDT) ✅
CREATE TABLE inventory_movements (
  id          TEXT PRIMARY KEY,
  itemId      TEXT NOT NULL,
  delta       INTEGER NOT NULL,  -- +10 বা -5, never absolute
  reason      TEXT,              -- 'USED' | 'RESTOCK' | 'ADJUSTMENT'
  deviceId    TEXT,              -- কোন device থেকে
  createdAt   DATETIME,
  syncedAt    DATETIME NULL      -- NULL = pending sync
);

-- currentStock = SUM(delta) from all movements
```

Server-এ `currentStock` = সব movement-এর delta-র sum। দুটো device একসাথে কমালেও দুটোই apply হবে।

### Room Status: Priority Enum (LWW with rules)

```typescript
const STATUS_PRIORITY = {
  MAINTENANCE: 4,  // সবচেয়ে বেশি priority
  OCCUPIED:    3,
  RESERVED:    2,
  AVAILABLE:   1,
};

function resolveRoomStatus(local: RoomStatus, cloud: RoomStatus): RoomStatus {
  return STATUS_PRIORITY[local] >= STATUS_PRIORITY[cloud] ? local : cloud;
}
```

### Notes / Comments: Append-Only Log

```sql
CREATE TABLE ticket_notes (
  id         TEXT PRIMARY KEY,
  ticketId   TEXT NOT NULL,
  authorId   TEXT NOT NULL,
  body       TEXT NOT NULL,
  createdAt  DATETIME,
  -- কোনো updatedAt নেই — notes কখনো edit হয় না
  syncedAt   DATETIME NULL
);
```

দুটো device দুটো note দিলে → দুটোই থাকবে, কেউ কাউকে overwrite করবে না।

### Booking: Draft Pattern

```sql
CREATE TABLE bookings (
  id            TEXT PRIMARY KEY,  -- client UUID
  ...
  syncStatus    TEXT DEFAULT 'DRAFT',
  -- 'DRAFT'     = offline-এ তৈরি, server confirm করেনি
  -- 'CONFIRMED' = server accept করেছে
  -- 'CONFLICT'  = server reject করেছে (double booking)
  -- 'SYNCED'    = cloud-এ আছে, locally cached
  conflictNote  TEXT NULL          -- conflict হলে কারণ
);
```

### Soft Delete: সর্বত্র

```sql
-- সব critical table-এ এই column:
deletedAt DATETIME NULL  -- NULL = active, timestamp = soft deleted

-- Hard DELETE query কখনো করব না
-- সব query-তে: WHERE deletedAt IS NULL
```

### Logical Clock: Lamport Timestamp

Device clock বিশ্বাস না করে logical sequence:

```sql
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- key='lamportClock', value='1547'  ← increment on every write
-- key='deviceId',     value='uuid'
-- key='lastPullAt',   value='ISO timestamp'
```

প্রতিটা write-এ `lamportClock` বাড়বে। Conflict detect করতে timestamp নয়, এই clock ব্যবহার হবে।

---

## Sync Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
│                                                         │
│  ┌──────────────┐  IPC   ┌──────────────────────────┐  │
│  │  React UI    │◀──────▶│  Main Process            │  │
│  │  (same as    │        │                          │  │
│  │  web app)    │        │  ┌────────────────────┐  │  │
│  └──────────────┘        │  │  SQLite Local DB   │  │  │
│                          │  │  (better-sqlite3)  │  │  │
│                          │  └────────────────────┘  │  │
│                          │                          │  │
│                          │  ┌────────────────────┐  │  │
│                          │  │   Sync Manager     │  │  │
│                          │  │  Pull / Push / CRDTs│  │  │
│                          │  └────────────────────┘  │  │
│                          └──────────┬───────────────┘  │
└─────────────────────────────────────┼───────────────────┘
                                      │ HTTPS (when online)
                              ┌───────▼──────────┐
                              │  ResortPro API   │
                              │  (Cloud)         │
                              │  PostgreSQL      │
                              └──────────────────┘
```

### Pull (Cloud → Local)

```
GET /api/sync/pull?since=<lastPullAt>&deviceId=<uuid>

Response:
{
  guests:             [...upsert],
  rooms:              [...upsert],
  bookings:           [...upsert],
  housekeeping_tasks: [...upsert],
  food_orders:        [...upsert],
  menu_items:         [...upsert],
  inventory_movements:[...append],
  deleted:            { guests: ['id1'], bookings: ['id2'] }  ← soft deletes
}
```

Local-এ সব UPSERT হবে। `deleted` array দেখে local-এ `deletedAt` set হবে।

### Push (Local → Cloud)

```
POST /api/sync/push

Body:
{
  deviceId: "uuid",
  lamportClock: 1547,
  changes: [
    {
      table:     "bookings",
      operation: "INSERT",
      data:      { id: "client-uuid", roomId: "...", syncStatus: "DRAFT", ... }
    },
    {
      table:     "inventory_movements",
      operation: "INSERT",
      data:      { itemId: "...", delta: -5, reason: "USED" }
    },
    {
      table:     "housekeeping_tasks",
      operation: "UPDATE",
      data:      { id: "...", status: "COMPLETED", completedAt: "..." }
    }
  ]
}

Response:
{
  accepted: ["uuid1", "uuid2"],
  conflicts: [
    {
      id:     "booking-uuid",
      reason: "ROOM_UNAVAILABLE",
      detail: "Room 101 already booked Dec 10-12"
    }
  ]
}
```

### Sync Triggers

| কখন | কী হয় |
|---|---|
| App open | Full pull → তারপর pending push |
| Internet reconnect | Pending push → তারপর incremental pull |
| Background | প্রতি ৫ মিনিটে একবার try |
| Manual | Toolbar "Sync Now" button |
| Booking confirm | Immediate push (user waiting) |

---

## Conflict Resolution Matrix

| Conflict | Detection | Resolution | Human দরকার? |
|---|---|---|---|
| Room double booking | Server availability check on push | Offline booking → CONFLICT status | ✅ Receptionist |
| Booking cancel + checked-in | Server returns conflict | Alert, keep CHECKED_IN, Manager reviews | ✅ Manager |
| Invoice amount clash | Financial = read-only offline | Prevented — can't happen | ❌ |
| Guest same-field edit | Server compares lamport clocks | Side-by-side UI, user chooses | ✅ Any user |
| Guest different-field edit | Field-level merge | Auto-merge | ❌ |
| Room status clash | Priority enum rule | Higher priority wins automatically | ❌ |
| Inventory count | Delta counter CRDT | Both deltas applied, sum correct | ❌ |
| Task status (complete vs reassign) | COMPLETED priority rule | COMPLETED wins | ❌ |
| Order (delivered vs cancelled) | DELIVERED priority rule | DELIVERED wins | ❌ |
| Notes / comments | Append-only log | Both kept | ❌ |
| Soft-deleted record updated offline | `deletedAt` check on push | Alert: "This record was deleted" | ✅ Manager |

**Auto-resolved: ~10 out of 12 = ~83%**
**Human needed: ~2-3 edge cases = ~17% — এটাই realistic minimum**

---

## UI Design

### Status Bar (সবসময় দেখা যাবে)

```
🔴 Offline · Last synced 2h ago               [Sync Now]
🟡 Syncing... 12 changes uploading
🟢 Synced · just now
⚠️  2 conflicts need review                   [Review →]
```

### Draft Booking Visual

```
┌────────────────────────────────────────────────────┐
│ ⏳  DRAFT — Awaiting Confirmation                   │
│  Room 101 · Dec 10-12 · Karim Hossain              │
│  Internet নেই — sync হলে automatically confirm হবে │
│                                       [Cancel Draft]│
└────────────────────────────────────────────────────┘
```

### Conflict Review Screen

```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Conflict: Booking — Room 101, Dec 10-12          │
│                                                      │
│  Your draft (offline)      Cloud (confirmed)         │
│  ─────────────────────     ─────────────────         │
│  Guest: Karim Hossain      Guest: Rahim Ahmed        │
│  Created: 2:34 PM          Created: 2:31 PM          │
│  Status: DRAFT             Status: CONFIRMED         │
│                                                      │
│  ℹ️  Cloud booking was created 3 minutes earlier.    │
│                                                      │
│  [Assign different room]   [Cancel this draft]       │
└──────────────────────────────────────────────────────┘
```

### Offline Feature Lock

```
┌────────────────────────────────┐
│  📵  Internet দরকার             │
│                                │
│  SMS পাঠাতে active internet    │
│  connection প্রয়োজন।           │
│                                │
│  [OK]   [Check connection]     │
└────────────────────────────────┘
```

---

## Local Database Schema

```sql
-- ── Core ──────────────────────────────────────────────

CREATE TABLE guests (
  id          TEXT PRIMARY KEY,
  tenantId    TEXT NOT NULL,
  firstName   TEXT,
  lastName    TEXT,
  email       TEXT,
  phone       TEXT,
  idType      TEXT,
  idNumber    TEXT,
  updatedAt   DATETIME,
  deletedAt   DATETIME NULL,
  syncedAt    DATETIME NULL
);

CREATE TABLE rooms (
  id           TEXT PRIMARY KEY,
  tenantId     TEXT NOT NULL,
  number       TEXT,
  name         TEXT,
  type         TEXT,
  status       TEXT,  -- AVAILABLE | OCCUPIED | MAINTENANCE | RESERVED
  basePrice    REAL,
  updatedAt    DATETIME,
  deletedAt    DATETIME NULL,
  syncedAt     DATETIME NULL
);

CREATE TABLE bookings (
  id            TEXT PRIMARY KEY,  -- client UUID
  tenantId      TEXT NOT NULL,
  roomId        TEXT NOT NULL,
  guestId       TEXT NOT NULL,
  checkIn       DATE,
  checkOut      DATE,
  status        TEXT,
  totalAmount   REAL,
  syncStatus    TEXT DEFAULT 'DRAFT',  -- DRAFT | CONFIRMED | CONFLICT | SYNCED
  conflictNote  TEXT NULL,
  updatedAt     DATETIME,
  deletedAt     DATETIME NULL,
  syncedAt      DATETIME NULL
);

-- ── CRDT Tables ───────────────────────────────────────

CREATE TABLE inventory_movements (
  id        TEXT PRIMARY KEY,
  itemId    TEXT NOT NULL,
  delta     INTEGER NOT NULL,   -- +/- only, never absolute
  reason    TEXT,
  deviceId  TEXT,
  createdAt DATETIME,
  syncedAt  DATETIME NULL       -- NULL = pending push
);

CREATE TABLE ticket_notes (
  id        TEXT PRIMARY KEY,
  ticketId  TEXT NOT NULL,
  authorId  TEXT NOT NULL,
  body      TEXT NOT NULL,
  createdAt DATETIME,
  syncedAt  DATETIME NULL
);

-- ── Operational ───────────────────────────────────────

CREATE TABLE housekeeping_tasks (
  id           TEXT PRIMARY KEY,
  tenantId     TEXT NOT NULL,
  roomId       TEXT NOT NULL,
  assignedToId TEXT,
  type         TEXT,
  status       TEXT,
  scheduledDate DATE,
  completedAt  DATETIME NULL,
  updatedAt    DATETIME,
  deletedAt    DATETIME NULL,
  syncedAt     DATETIME NULL
);

CREATE TABLE food_orders (
  id          TEXT PRIMARY KEY,
  tenantId    TEXT NOT NULL,
  bookingId   TEXT,
  status      TEXT,
  totalAmount REAL,
  createdBy   TEXT,             -- ownership: waiter id
  updatedAt   DATETIME,
  deletedAt   DATETIME NULL,
  syncedAt    DATETIME NULL
);

-- ── Sync Metadata ─────────────────────────────────────

CREATE TABLE sync_queue (
  id          TEXT PRIMARY KEY,
  tableName   TEXT NOT NULL,
  recordId    TEXT NOT NULL,
  operation   TEXT NOT NULL,   -- INSERT | UPDATE | DELETE
  payload     TEXT NOT NULL,   -- JSON
  lamport     INTEGER,
  createdAt   DATETIME,
  attempts    INTEGER DEFAULT 0,
  lastError   TEXT NULL
);

CREATE TABLE conflict_log (
  id          TEXT PRIMARY KEY,
  tableName   TEXT NOT NULL,
  recordId    TEXT NOT NULL,
  localValue  TEXT,            -- JSON snapshot
  cloudValue  TEXT,            -- JSON snapshot
  resolution  TEXT DEFAULT 'PENDING',  -- PENDING | LOCAL_WIN | CLOUD_WIN | MANUAL
  resolvedBy  TEXT NULL,
  createdAt   DATETIME,
  resolvedAt  DATETIME NULL
);

CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT
  -- 'deviceId'      → UUID
  -- 'lamportClock'  → integer (increment on every write)
  -- 'lastPullAt'    → ISO timestamp
  -- 'tenantId'      → current tenant
);
```

---

## API Changes (Server Side)

### New: `apps/api/src/routes/sync.ts`

```typescript
// GET /api/sync/pull?since=ISO&deviceId=UUID
// → Returns changed records since 'since'
// → Tenant-scoped, auth required

// POST /api/sync/push
// → Receives array of changes from desktop
// → Per-change: validate, apply CRDT rules, check booking conflicts
// → Returns: { accepted: [...ids], conflicts: [...] }
```

### Schema Changes: `updatedAt` + `deletedAt` সব critical tables-এ

Already exists in most Prisma models. Need to verify:
- `deletedAt DateTime?` — add where missing
- All sync routes include `updatedAt` in response

---

## Implementation Phases

### Phase 1 — Electron Shell (Week 1-2)
- `apps/desktop/` folder, Electron + Vite
- `apps/web` renderer হিসেবে load
- IPC bridge setup
- SQLite schema create + migration runner

### Phase 2 — Read-Only Offline (Week 3)
- Pull endpoint (server)
- Initial full sync on login
- Offline: guests, rooms, bookings, calendar সব read করা যাবে
- Status bar (🔴/🟢)

### Phase 3 — CRDT Writes (Week 4-5)
- Housekeeping task status update
- F&B order create + status update
- Maintenance log append
- Ticket note append
- Inventory delta movements
- Push endpoint (server) — CRDT tables only

### Phase 4 — Draft Booking (Week 6)
- Walk-in booking → DRAFT
- Check-in/Check-out → provisional
- Push endpoint — booking conflict detection
- Conflict Review UI

### Phase 5 — Polish + Package (Week 7-8)
- Offline feature locks (Tier D)
- Conflict review screen
- Auto-updater
- Windows .exe + Mac .dmg installer
- Background sync (5 min interval)

---

## Files to Create

```
apps/desktop/
├── electron/
│   ├── main.ts              — Electron entry, window management
│   ├── preload.ts           — IPC context bridge
│   └── sync/
│       ├── manager.ts       — Sync orchestrator
│       ├── pull.ts          — GET /api/sync/pull
│       ├── push.ts          — POST /api/sync/push
│       ├── crdt.ts          — Delta counter, LWW, append-log helpers
│       └── conflicts.ts     — Conflict detection + resolution rules
├── db/
│   ├── schema.sql           — SQLite schema
│   ├── migrations/          — Versioned schema changes
│   ├── local-db.ts          — DB access layer (guests, rooms, bookings...)
│   └── sync-queue.ts        — Push queue management
├── package.json
└── vite.config.ts

apps/api/src/routes/
└── sync.ts                  — Pull + Push endpoints

apps/web/src/lib/
└── data-source.ts           — if online: cloud API | if offline: IPC → SQLite
```

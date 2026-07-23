-- ResortPro Desktop — SQLite Local Database Schema
-- Version: 1
-- This is the offline-first local cache & sync queue.
-- All tables mirror the server, but are lightweight (no FK enforcement).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = OFF; -- offline cache, no strict FK

-- ─── Sync state ───────────────────────────────────────────────────────────────
-- Tracks the last successful sync cursor per entity type.
CREATE TABLE IF NOT EXISTS sync_state (
  entity      TEXT PRIMARY KEY,   -- e.g. 'guests', 'rooms', 'bookings'
  last_synced TEXT NOT NULL,       -- ISO-8601 timestamp of last pull
  server_seq  INTEGER DEFAULT 0    -- server sequence / cursor if supported
);

-- ─── Guests ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  nationality  TEXT,
  id_type      TEXT,
  id_number    TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  synced_at    TEXT              -- when this row was last pulled from server
);

-- ─── Rooms ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id           TEXT PRIMARY KEY,
  number       TEXT NOT NULL,
  type         TEXT NOT NULL,
  floor        INTEGER,
  capacity     INTEGER DEFAULT 2,
  price        REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'available',  -- available | occupied | maintenance | cleaning
  amenities    TEXT,             -- JSON array stored as text
  notes        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  synced_at    TEXT
);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  guest_id       TEXT NOT NULL,
  room_id        TEXT NOT NULL,
  check_in       TEXT NOT NULL,   -- ISO date
  check_out      TEXT NOT NULL,   -- ISO date
  status         TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | checked_in | checked_out | cancelled
  total_amount   REAL,
  paid_amount    REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',  -- pending | partial | paid
  source         TEXT DEFAULT 'direct',   -- direct | booking.com | agoda | walk-in
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  synced_at      TEXT
);

-- ─── Draft bookings (offline-created, not yet pushed to server) ───────────────
CREATE TABLE IF NOT EXISTS draft_bookings (
  id             TEXT PRIMARY KEY,  -- local UUID (prefix: 'draft_')
  guest_id       TEXT,              -- may be null if guest also draft
  guest_name     TEXT,              -- denormalized fallback
  room_id        TEXT,
  room_number    TEXT,              -- denormalized fallback
  check_in       TEXT NOT NULL,
  check_out      TEXT NOT NULL,
  total_amount   REAL,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  sync_status    TEXT DEFAULT 'pending'  -- pending | syncing | failed
);

-- ─── Sync queue (offline writes waiting to be sent to server) ─────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,
  entity      TEXT NOT NULL,   -- 'booking', 'guest', 'room_status', etc.
  operation   TEXT NOT NULL,   -- 'create' | 'update' | 'delete'
  payload     TEXT NOT NULL,   -- JSON
  attempts    INTEGER DEFAULT 0,
  last_error  TEXT,
  status      TEXT DEFAULT 'pending'  -- pending | syncing | done | failed
);

-- ─── Conflict log (CRDT conflicts that need manual resolution) ────────────────
CREATE TABLE IF NOT EXISTS conflict_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  detected_at   TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  field         TEXT NOT NULL,
  local_value   TEXT,
  server_value  TEXT,
  resolved      INTEGER DEFAULT 0,  -- 0 = pending, 1 = resolved
  resolved_at   TEXT,
  resolution    TEXT    -- 'kept_local' | 'kept_server' | 'merged'
);

-- ─── Inventory movements (offline log of stock changes) ───────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL,
  item_name   TEXT NOT NULL,   -- denormalized for offline display
  type        TEXT NOT NULL,   -- 'in' | 'out' | 'adjustment'
  quantity    REAL NOT NULL,
  reason      TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  synced_at   TEXT
);

-- ─── Housekeeping tasks (offline cache) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  room_number TEXT NOT NULL,   -- denormalized
  type        TEXT NOT NULL,   -- 'checkout_clean' | 'stayover' | 'deep_clean' | 'inspection'
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | done
  assigned_to TEXT,
  notes       TEXT,
  due_date    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  synced_at   TEXT
);

-- ─── Ticket notes (offline cache) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_notes (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  author      TEXT,
  created_at  TEXT NOT NULL,
  synced_at   TEXT
);

-- ─── Food/beverage orders (offline cache) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_orders (
  id          TEXT PRIMARY KEY,
  booking_id  TEXT,
  room_number TEXT,
  items       TEXT NOT NULL,   -- JSON array
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | preparing | delivered
  total       REAL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  synced_at   TEXT
);

-- ─── Fingerprint attendance device ─────────────────────────────────────────────
-- Single-row config for the on-premise fingerprint machine (ZKTeco/eSSL protocol).
-- Set from Settings in the desktop app UI; polling only runs if ip is non-null.
CREATE TABLE IF NOT EXISTS attendance_device_config (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  ip               TEXT,
  port             INTEGER DEFAULT 4370,
  device_key       TEXT,             -- tenant's X-Attendance-Key (from /api/attendance/device-key)
  api_base         TEXT DEFAULT 'http://localhost:4000',
  poll_interval_ms INTEGER DEFAULT 60000,
  last_synced_at   TEXT,             -- ISO timestamp of the latest punch already pushed
  updated_at       TEXT
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_check_in      ON bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id      ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id       ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status      ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_conflict_log_resolved  ON conflict_log(resolved);
CREATE INDEX IF NOT EXISTS idx_housekeeping_status    ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_food_orders_booking    ON food_orders(booking_id);

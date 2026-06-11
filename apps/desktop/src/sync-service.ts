/**
 * sync-service.ts
 * Pulls data from the server's /api/sync/pull endpoint
 * and saves it into the local SQLite database.
 *
 * Called from main.ts:
 *   - On app start (after login detected)
 *   - When network comes back online
 */

import { net } from 'electron';
import { getDb } from '../db/local-db';

const API_BASE = 'http://localhost:4000';

// ─── Types (mirror what the API returns) ─────────────────────────────────────

interface SyncPullResponse {
  success: boolean;
  syncedAt: string;
  since: string | null;
  counts: Record<string, number>;
  data: {
    guests:            SyncGuest[];
    rooms:             SyncRoom[];
    bookings:          SyncBooking[];
    housekeepingTasks: SyncHousekeepingTask[];
    foodOrders:        SyncFoodOrder[];
  };
}

interface SyncGuest {
  id: string; firstName: string; lastName: string;
  email: string; phone?: string; nationality?: string;
  idType?: string; idNumber?: string; notes?: string;
  createdAt: string; updatedAt: string;
}

interface SyncRoom {
  id: string; name: string; number: string; type: string;
  floor?: number; maxOccupancy: number; basePrice: number | string;
  status: string; amenities: string[];
  createdAt: string; updatedAt: string;
}

interface SyncBooking {
  id: string; guestId: string; roomId: string;
  checkIn: string; checkOut: string; status: string;
  totalAmount: number | string; paidAmount: number | string;
  paymentStatus: string; source: string; notes?: string;
  createdAt: string; updatedAt: string;
  guest?: { firstName: string; lastName: string };
  room?:  { number: string; name: string };
}

interface SyncHousekeepingTask {
  id: string; roomId: string; type: string; status: string;
  assignedToId?: string; notes?: string; scheduledDate: string;
  createdAt: string; updatedAt: string;
  room?: { number: string };
}

interface SyncFoodOrder {
  id: string; bookingId?: string; tableNumber?: string;
  status: string; totalAmount: number | string; notes?: string;
  createdAt: string; updatedAt: string;
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  syncedAt?: string;
  counts?: Record<string, number>;
  error?: string;
}

/**
 * Performs a full or incremental sync pull from the server.
 * @param token  JWT auth token from the user's session
 * @param since  ISO timestamp — if provided, only pulls records updated after this
 */
export async function syncPull(token: string, since?: string): Promise<SyncResult> {
  if (!net.isOnline()) {
    return { success: false, error: 'offline' };
  }

  try {
    const url = since
      ? `${API_BASE}/api/sync/pull?since=${encodeURIComponent(since)}`
      : `${API_BASE}/api/sync/pull`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${body}` };
    }

    const payload: SyncPullResponse = await response.json();
    if (!payload.success) {
      return { success: false, error: 'API returned success:false' };
    }

    // Write everything into SQLite in one transaction
    saveToLocal(payload);

    // Update sync_state cursors
    updateSyncState(payload.syncedAt);

    console.log('[sync] Pull complete:', payload.counts);
    return { success: true, syncedAt: payload.syncedAt, counts: payload.counts };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync] Pull failed:', msg);
    return { success: false, error: msg };
  }
}

// ─── Save to SQLite ───────────────────────────────────────────────────────────

function saveToLocal(payload: SyncPullResponse): void {
  const db = getDb();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    saveGuests(db, payload.data.guests, now);
    saveRooms(db, payload.data.rooms, now);
    saveBookings(db, payload.data.bookings, now);
    saveHousekeepingTasks(db, payload.data.housekeepingTasks, now);
    saveFoodOrders(db, payload.data.foodOrders, now);
  });

  tx();
}

function saveGuests(db: ReturnType<typeof getDb>, guests: SyncGuest[], now: string): void {
  const upsert = db.prepare(`
    INSERT INTO guests (id, name, email, phone, nationality, id_type, id_number, notes, created_at, updated_at, synced_at)
    VALUES (@id, @name, @email, @phone, @nationality, @idType, @idNumber, @notes, @createdAt, @updatedAt, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, email=excluded.email, phone=excluded.phone,
      nationality=excluded.nationality, id_type=excluded.id_type, id_number=excluded.id_number,
      notes=excluded.notes, updated_at=excluded.updated_at, synced_at=excluded.synced_at
  `);

  for (const g of guests) {
    upsert.run({
      id: g.id,
      name: `${g.firstName} ${g.lastName}`.trim(),
      email: g.email ?? null,
      phone: g.phone ?? null,
      nationality: g.nationality ?? null,
      idType: g.idType ?? null,
      idNumber: g.idNumber ?? null,
      notes: g.notes ?? null,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      syncedAt: now,
    });
  }
}

function saveRooms(db: ReturnType<typeof getDb>, rooms: SyncRoom[], now: string): void {
  const upsert = db.prepare(`
    INSERT INTO rooms (id, number, type, floor, capacity, price, status, amenities, created_at, updated_at, synced_at)
    VALUES (@id, @number, @type, @floor, @capacity, @price, @status, @amenities, @createdAt, @updatedAt, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      number=excluded.number, type=excluded.type, floor=excluded.floor,
      capacity=excluded.capacity, price=excluded.price, status=excluded.status,
      amenities=excluded.amenities, updated_at=excluded.updated_at, synced_at=excluded.synced_at
  `);

  for (const r of rooms) {
    upsert.run({
      id: r.id,
      number: r.number,
      type: r.type,
      floor: r.floor ?? null,
      capacity: r.maxOccupancy,
      price: Number(r.basePrice),
      status: r.status,
      amenities: JSON.stringify(r.amenities ?? []),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      syncedAt: now,
    });
  }
}

function saveBookings(db: ReturnType<typeof getDb>, bookings: SyncBooking[], now: string): void {
  const upsert = db.prepare(`
    INSERT INTO bookings (id, guest_id, room_id, check_in, check_out, status, total_amount, paid_amount,
      payment_status, source, notes, created_at, updated_at, synced_at)
    VALUES (@id, @guestId, @roomId, @checkIn, @checkOut, @status, @totalAmount, @paidAmount,
      @paymentStatus, @source, @notes, @createdAt, @updatedAt, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status, total_amount=excluded.total_amount, paid_amount=excluded.paid_amount,
      payment_status=excluded.payment_status, notes=excluded.notes,
      updated_at=excluded.updated_at, synced_at=excluded.synced_at
  `);

  for (const b of bookings) {
    upsert.run({
      id: b.id,
      guestId: b.guestId,
      roomId: b.roomId,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      totalAmount: Number(b.totalAmount),
      paidAmount: Number(b.paidAmount),
      paymentStatus: b.paymentStatus,
      source: b.source,
      notes: b.notes ?? null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      syncedAt: now,
    });
  }
}

function saveHousekeepingTasks(db: ReturnType<typeof getDb>, tasks: SyncHousekeepingTask[], now: string): void {
  const upsert = db.prepare(`
    INSERT INTO housekeeping_tasks (id, room_id, room_number, type, status, assigned_to, notes, due_date, created_at, updated_at, synced_at)
    VALUES (@id, @roomId, @roomNumber, @type, @status, @assignedTo, @notes, @dueDate, @createdAt, @updatedAt, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status, assigned_to=excluded.assigned_to, notes=excluded.notes,
      updated_at=excluded.updated_at, synced_at=excluded.synced_at
  `);

  for (const t of tasks) {
    upsert.run({
      id: t.id,
      roomId: t.roomId,
      roomNumber: t.room?.number ?? '',
      type: t.type,
      status: t.status,
      assignedTo: t.assignedToId ?? null,
      notes: t.notes ?? null,
      dueDate: t.scheduledDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      syncedAt: now,
    });
  }
}

function saveFoodOrders(db: ReturnType<typeof getDb>, orders: SyncFoodOrder[], now: string): void {
  const upsert = db.prepare(`
    INSERT INTO food_orders (id, booking_id, room_number, items, status, total, created_at, updated_at, synced_at)
    VALUES (@id, @bookingId, @roomNumber, @items, @status, @total, @createdAt, @updatedAt, @syncedAt)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status, total=excluded.total, updated_at=excluded.updated_at, synced_at=excluded.synced_at
  `);

  for (const o of orders) {
    upsert.run({
      id: o.id,
      bookingId: o.bookingId ?? null,
      roomNumber: o.tableNumber ?? null,
      items: '[]',   // items relation loaded separately if needed
      status: o.status,
      total: Number(o.totalAmount),
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      syncedAt: now,
    });
  }
}

// ─── Update sync cursors ──────────────────────────────────────────────────────

function updateSyncState(syncedAt: string): void {
  const db = getDb();
  const entities = ['guests', 'rooms', 'bookings', 'housekeepingTasks', 'foodOrders'];

  const upsert = db.prepare(`
    INSERT INTO sync_state (entity, last_synced)
    VALUES (@entity, @lastSynced)
    ON CONFLICT(entity) DO UPDATE SET last_synced=excluded.last_synced
  `);

  const tx = db.transaction(() => {
    for (const entity of entities) {
      upsert.run({ entity, lastSynced: syncedAt });
    }
  });
  tx();
}

/**
 * Returns the last synced timestamp for a given entity.
 * Used to do incremental (delta) pulls.
 */
export function getLastSynced(entity: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT last_synced FROM sync_state WHERE entity = ?').get(entity) as { last_synced: string } | undefined;
  return row?.last_synced ?? null;
}

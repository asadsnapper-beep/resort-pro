/**
 * sync-queue.ts
 * Manages the offline write queue.
 *
 * When the app is offline, any write (booking status, room status, etc.)
 * is stored in the `sync_queue` SQLite table.
 *
 * When the app comes back online, `flushQueue()` sends each queued
 * operation to the server API, marks it done, and removes it.
 *
 * Usage:
 *   enqueue('booking', 'update', { id: '...', status: 'CHECKED_IN' })
 *   flushQueue(token)  — called automatically on network reconnect
 */

import { net } from 'electron';
import { getDb } from '../db/local-db';

const API_BASE = 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueEntity = 'booking' | 'room' | 'guest' | 'housekeeping_task' | 'food_order';
export type QueueOperation = 'create' | 'update' | 'delete';

interface QueueRow {
  id: number;
  created_at: string;
  entity: QueueEntity;
  operation: QueueOperation;
  payload: string;   // JSON
  attempts: number;
  last_error: string | null;
  status: 'pending' | 'syncing' | 'done' | 'failed';
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

/**
 * Add an offline operation to the queue.
 * Call this whenever a write happens while offline.
 */
export function enqueue(
  entity: QueueEntity,
  operation: QueueOperation,
  payload: Record<string, unknown>,
): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sync_queue (created_at, entity, operation, payload, status)
    VALUES (datetime('now'), ?, ?, ?, 'pending')
  `).run(entity, operation, JSON.stringify(payload));

  const id = result.lastInsertRowid as number;
  console.log(`[sync-queue] Enqueued #${id}: ${operation} ${entity}`);
  return id;
}

// ─── Flush queue ──────────────────────────────────────────────────────────────

export interface FlushResult {
  flushed: number;
  failed: number;
  skipped: number;
}

/**
 * Send all pending queue items to the server.
 * Called when network comes back online.
 * Processes items in order (oldest first).
 */
export async function flushQueue(token: string): Promise<FlushResult> {
  if (!net.isOnline()) {
    return { flushed: 0, failed: 0, skipped: 0 };
  }

  const db = getDb();
  const pending = db.prepare(`
    SELECT * FROM sync_queue
    WHERE status = 'pending'
    ORDER BY id ASC
    LIMIT 50
  `).all() as QueueRow[];

  if (pending.length === 0) {
    return { flushed: 0, failed: 0, skipped: 0 };
  }

  console.log(`[sync-queue] Flushing ${pending.length} items...`);

  let flushed = 0, failed = 0, skipped = 0;

  for (const row of pending) {
    // Mark as syncing
    db.prepare(`UPDATE sync_queue SET status='syncing', attempts=attempts+1 WHERE id=?`).run(row.id);

    try {
      const payload = JSON.parse(row.payload);
      const ok = await sendToServer(token, row.entity, row.operation, payload);

      if (ok) {
        db.prepare(`UPDATE sync_queue SET status='done' WHERE id=?`).run(row.id);
        flushed++;
        console.log(`[sync-queue] ✓ #${row.id} ${row.operation} ${row.entity}`);
      } else {
        throw new Error('Server returned failure');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;

      // After 5 attempts, mark as permanently failed
      const newStatus = attempts >= 5 ? 'failed' : 'pending';
      db.prepare(`
        UPDATE sync_queue SET status=?, last_error=?, attempts=? WHERE id=?
      `).run(newStatus, msg, attempts, row.id);

      if (newStatus === 'failed') {
        failed++;
        console.error(`[sync-queue] ✗ #${row.id} permanently failed: ${msg}`);
      } else {
        skipped++;
        console.warn(`[sync-queue] ↩ #${row.id} will retry (attempt ${attempts}): ${msg}`);
      }
    }
  }

  console.log(`[sync-queue] Flush done — flushed:${flushed} failed:${failed} skipped:${skipped}`);
  return { flushed, failed, skipped };
}

// ─── Send to server ───────────────────────────────────────────────────────────

/**
 * Routes a queued operation to the correct API endpoint.
 * Returns true if server accepted it.
 */
async function sendToServer(
  token: string,
  entity: QueueEntity,
  operation: QueueOperation,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const { url, method, body } = buildRequest(entity, operation, payload);

  const response = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  return true;
}

// ─── Request builder ─────────────────────────────────────────────────────────

interface RequestSpec {
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
}

function buildRequest(
  entity: QueueEntity,
  operation: QueueOperation,
  payload: Record<string, unknown>,
): RequestSpec {
  const id = payload.id as string;

  switch (entity) {
    case 'booking':
      if (operation === 'create')  return { url: '/api/bookings',    method: 'POST',   body: payload };
      if (operation === 'update')  return { url: `/api/bookings/${id}`, method: 'PATCH', body: payload };
      if (operation === 'delete')  return { url: `/api/bookings/${id}`, method: 'DELETE' };
      break;

    case 'room':
      if (operation === 'update')  return { url: `/api/rooms/${id}`, method: 'PATCH', body: payload };
      break;

    case 'guest':
      if (operation === 'create')  return { url: '/api/guests',      method: 'POST',   body: payload };
      if (operation === 'update')  return { url: `/api/guests/${id}`, method: 'PATCH', body: payload };
      break;

    case 'housekeeping_task':
      if (operation === 'update')  return { url: `/api/housekeeping/${id}`, method: 'PATCH', body: payload };
      break;

    case 'food_order':
      if (operation === 'update')  return { url: `/api/food-orders/${id}`, method: 'PATCH', body: payload };
      break;
  }

  throw new Error(`No route for ${operation} ${entity}`);
}

// ─── Queue stats ──────────────────────────────────────────────────────────────

export interface QueueStats {
  pending: number;
  failed: number;
  total: number;
}

export function getQueueStats(): QueueStats {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  const map = Object.fromEntries(rows.map(r => [r.status, r.count]));
  return {
    pending: (map['pending'] ?? 0) + (map['syncing'] ?? 0),
    failed:  map['failed'] ?? 0,
    total:   rows.reduce((s, r) => s + r.count, 0),
  };
}

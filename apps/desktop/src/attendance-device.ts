/**
 * attendance-device.ts
 *
 * Polls an on-premise fingerprint machine (ZKTeco / eSSL — both speak the
 * same "ZK protocol") over the local network using node-zklib, and pushes
 * new punches to ResortPro's cloud API via the attendance device-webhook.
 *
 * This machine sits on the resort's LAN — the cloud web app can't reach it
 * directly, which is exactly why this lives in the desktop app: it's the
 * only piece of ResortPro that runs natively on a PC on that same network.
 *
 * NOTE: written against node-zklib's documented API (github.com/coding-libs/
 * node-zklib). I don't have physical device access to verify the exact
 * field names node-zklib returns for every ZK-protocol clone — deviceUserId
 * and recordTime are what the library's own README and most real-world
 * usage show, but confirm against your actual device's log output before
 * relying on this in production, and adjust RECORD_USER_FIELD /
 * RECORD_TIME_FIELD below if your firmware reports differently.
 *
 * Most ZK-protocol devices don't reliably tag a punch as IN vs OUT in the
 * raw log — this treats a staff member's first unsent punch of a given day
 * as IN and their next one as OUT, alternating from there. That matches how
 * the attendance backend (apps/api/src/routes/attendance.ts) already
 * expects punches to arrive.
 */

import { getDb } from '../db/local-db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ZKLib = require('node-zklib');

const RECORD_USER_FIELD = 'deviceUserId';
const RECORD_TIME_FIELD = 'recordTime';

interface DeviceConfig {
  ip: string;
  port: number;
  device_key: string;
  api_base: string;
  poll_interval_ms: number;
  last_synced_at: string | null;
}

interface RawAttendanceRecord {
  [key: string]: unknown;
}

let pollTimer: NodeJS.Timeout | null = null;
let polling = false;

export function getDeviceConfig(): DeviceConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM attendance_device_config WHERE id = 1').get() as
    | { ip: string | null; port: number; device_key: string | null; api_base: string; poll_interval_ms: number; last_synced_at: string | null }
    | undefined;
  if (!row || !row.ip || !row.device_key) return null;
  return {
    ip: row.ip,
    port: row.port,
    device_key: row.device_key,
    api_base: row.api_base,
    poll_interval_ms: row.poll_interval_ms,
    last_synced_at: row.last_synced_at,
  };
}

export function saveDeviceConfig(config: { ip: string; port: number; deviceKey: string; apiBase: string; pollIntervalMs?: number }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO attendance_device_config (id, ip, port, device_key, api_base, poll_interval_ms, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      ip = excluded.ip, port = excluded.port, device_key = excluded.device_key,
      api_base = excluded.api_base, poll_interval_ms = excluded.poll_interval_ms, updated_at = excluded.updated_at
  `).run(config.ip, config.port, config.deviceKey, config.apiBase, config.pollIntervalMs ?? 60000);
}

function setLastSyncedAt(iso: string) {
  const db = getDb();
  db.prepare(`UPDATE attendance_device_config SET last_synced_at = ? WHERE id = 1`).run(iso);
}

async function pushPunch(apiBase: string, deviceKey: string, deviceUserId: string, timestamp: Date, type: 'IN' | 'OUT'): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/api/attendance/device-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Attendance-Key': deviceKey },
      body: JSON.stringify({ deviceUserId, timestamp: timestamp.toISOString(), type }),
    });
    return res.ok;
  } catch (err) {
    console.error('[attendance-device] push failed:', err);
    return false;
  }
}

/**
 * Connects to the device, pulls the attendance log, and pushes any punch
 * newer than the last synced timestamp. Safe to call repeatedly — it's a
 * no-op if no device is configured, and network/device errors are caught
 * and logged rather than thrown (the next poll tick will just retry).
 */
export async function pollAttendanceDevice(): Promise<{ pushed: number; skipped: boolean }> {
  if (polling) return { pushed: 0, skipped: true }; // avoid overlapping polls
  const config = getDeviceConfig();
  if (!config) return { pushed: 0, skipped: true };

  polling = true;
  try {
    const zkInstance = new ZKLib(config.ip, config.port, 10000, 4000);
    await zkInstance.createSocket();

    let logs: { data: RawAttendanceRecord[] };
    try {
      logs = await zkInstance.getAttendances();
    } finally {
      await zkInstance.disconnect().catch(() => {});
    }

    const since = config.last_synced_at ? new Date(config.last_synced_at) : new Date(0);
    const records = (logs?.data ?? [])
      .map((r) => ({ deviceUserId: String(r[RECORD_USER_FIELD]), time: new Date(r[RECORD_TIME_FIELD] as string) }))
      .filter((r) => r.deviceUserId && !isNaN(r.time.getTime()) && r.time > since)
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    if (records.length === 0) return { pushed: 0, skipped: false };

    // Alternate IN/OUT per staff member per day, seeded by whether they already
    // have an IN punch pushed earlier today (best-effort — see file header note).
    const dayState = new Map<string, 'IN' | 'OUT'>(); // key: `${deviceUserId}:${YYYY-MM-DD}` -> next expected type

    let pushed = 0;
    let latestPushed = since;
    for (const rec of records) {
      const dayKey = `${rec.deviceUserId}:${rec.time.toISOString().slice(0, 10)}`;
      const nextType = dayState.get(dayKey) ?? 'IN';
      const ok = await pushPunch(config.api_base, config.device_key, rec.deviceUserId, rec.time, nextType);
      if (ok) {
        pushed++;
        latestPushed = rec.time;
        dayState.set(dayKey, nextType === 'IN' ? 'OUT' : 'IN');
      } else {
        // Stop at first failure (likely offline) — leave last_synced_at where it
        // was so this and later records are retried on the next successful poll.
        break;
      }
    }

    if (pushed > 0) setLastSyncedAt(latestPushed.toISOString());
    return { pushed, skipped: false };
  } catch (err) {
    console.error('[attendance-device] poll failed:', err);
    return { pushed: 0, skipped: false };
  } finally {
    polling = false;
  }
}

export function startAttendanceDevicePolling() {
  stopAttendanceDevicePolling();
  const config = getDeviceConfig();
  const intervalMs = config?.poll_interval_ms ?? 60000;
  pollTimer = setInterval(() => { pollAttendanceDevice(); }, intervalMs);
  pollAttendanceDevice(); // immediate first poll
}

export function stopAttendanceDevicePolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

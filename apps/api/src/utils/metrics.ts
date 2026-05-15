/**
 * Lightweight in-process request metrics collector.
 *
 * Stores the last MAX_ENTRIES requests in a ring buffer.
 * No external deps — all in memory, resets on restart.
 *
 * Usage:
 *   metrics.record({ method, path, status, durationMs });
 *   const snapshot = metrics.snapshot();
 */

interface RequestEntry {
  method: string;
  path: string;       // normalized (no query string, :id replaced)
  status: number;
  durationMs: number;
  ts: number;         // Date.now()
}

const MAX_ENTRIES = 2_000;   // ~2k most recent requests kept in RAM
const entries: RequestEntry[] = [];
let head = 0;                // ring buffer write pointer
let totalRequests = 0;
const startedAt = Date.now();

/** Normalize a URL path — collapse IDs to :id, strip query string */
export function normalizePath(url: string): string {
  // Strip query string
  const path = url.split('?')[0];
  // Replace cuid/uuid/numeric segments with :id
  return path
    .replace(/\/[0-9a-f]{20,}/gi, '/:id')          // cuid / long hex
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // uuid
    .replace(/\/\d+/g, '/:id');                      // numeric IDs
}

export const metrics = {
  record(entry: Omit<RequestEntry, 'ts'>) {
    const e: RequestEntry = { ...entry, ts: Date.now() };
    if (entries.length < MAX_ENTRIES) {
      entries.push(e);
    } else {
      entries[head] = e;
      head = (head + 1) % MAX_ENTRIES;
    }
    totalRequests++;
  },

  snapshot(windowMs = 60_000) {
    const now = Date.now();
    const window = entries.filter((e) => now - e.ts <= windowMs);

    const total = window.length;
    const errors = window.filter((e) => e.status >= 500).length;
    const clientErrors = window.filter((e) => e.status >= 400 && e.status < 500).length;
    const durations = window.map((e) => e.durationMs).sort((a, b) => a - b);

    const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;
    const avgMs = total ? Math.round(durations.reduce((s, d) => s + d, 0) / total) : 0;

    // Requests per minute
    const rpm = Math.round((total / windowMs) * 60_000);

    // Top slow endpoints (by avg duration)
    const byPath: Record<string, { count: number; totalMs: number; errors: number }> = {};
    for (const e of window) {
      const key = `${e.method} ${e.path}`;
      if (!byPath[key]) byPath[key] = { count: 0, totalMs: 0, errors: 0 };
      byPath[key].count++;
      byPath[key].totalMs += e.durationMs;
      if (e.status >= 500) byPath[key].errors++;
    }
    const slowEndpoints = Object.entries(byPath)
      .map(([endpoint, s]) => ({ endpoint, count: s.count, avgMs: Math.round(s.totalMs / s.count), errors: s.errors }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);

    // Status code breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const e of window) {
      const bucket = `${Math.floor(e.status / 100)}xx`;
      statusBreakdown[bucket] = (statusBreakdown[bucket] ?? 0) + 1;
    }

    // Requests over time — last 60 min in 5-min buckets
    const bucketMs = 5 * 60_000;
    const buckets: { time: string; count: number; errors: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketMs;
      const bucketEnd = now - i * bucketMs;
      const b = entries.filter((e) => e.ts >= bucketStart && e.ts < bucketEnd);
      buckets.push({
        time: new Date(bucketStart).toISOString().slice(11, 16),
        count: b.length,
        errors: b.filter((e) => e.status >= 500).length,
      });
    }

    return {
      window: `${windowMs / 60_000}min`,
      rpm,
      total,
      totalAllTime: totalRequests,
      errors,
      clientErrors,
      errorRate: total ? Math.round((errors / total) * 100 * 10) / 10 : 0,
      latency: { p50, p95, p99, avg: avgMs },
      slowEndpoints,
      statusBreakdown,
      buckets,
      uptimeMs: now - startedAt,
    };
  },
};

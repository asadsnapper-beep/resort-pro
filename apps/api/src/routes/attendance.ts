import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma, tenantPrisma, type TenantScopedPrisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const GRACE_MINUTES = 10;

function computeStatus(shiftStartTime: string | null, clockIn: Date): 'PRESENT' | 'LATE' {
  if (!shiftStartTime) return 'PRESENT';
  const [h, m] = shiftStartTime.split(':').map(Number);
  const expected = new Date(clockIn);
  expected.setHours(h, m + GRACE_MINUTES, 0, 0);
  return clockIn > expected ? 'LATE' : 'PRESENT';
}

// Buckets by the server's LOCAL calendar day (not UTC) — must stay consistent with
// computeStatus(), which compares clock-in time-of-day using local getters/setHours.
// Mixing UTC-day-bucketing with local-time-of-day comparison silently misfires for
// any tenant timezone that isn't UTC (e.g. a clock-in at 01:20 local in Asia/Dhaka
// is still "yesterday" in UTC, landing the record on the wrong day and comparing
// against the wrong day's shift-start time).
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// For "YYYY-MM-DD" strings already meant to name a specific local calendar day
// (e.g. a date-picker value) — bucket directly from the components instead of
// going through `new Date(str)` (which parses as UTC midnight) and re-reading
// local getters, which can shift the day backward for negative-UTC-offset zones.
function dateOnlyFromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Shared punch handler used by CSV import + device webhook (both operate per-punch, not per-session)
async function applyPunch(
  db: TenantScopedPrisma,
  staffId: string,
  timestamp: Date,
  type: 'IN' | 'OUT',
  source: 'DEVICE_IMPORT' | 'DEVICE_WEBHOOK',
) {
  const date = dateOnly(timestamp);
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) return null;

  const existing = await db.staffAttendance.findUnique({ where: { staffId_date: { staffId, date } } });

  if (type === 'IN') {
    const status = computeStatus(staff.shiftStartTime, timestamp);
    if (!existing) {
      return db.staffAttendance.create({ data: { staffId, date, clockIn: timestamp, status, source } });
    }
    // Keep the earliest IN punch of the day
    if (!existing.clockIn || timestamp < existing.clockIn) {
      return db.staffAttendance.update({ where: { id: existing.id }, data: { clockIn: timestamp, status, source } });
    }
    return existing;
  }

  // OUT
  if (!existing) {
    return db.staffAttendance.create({ data: { staffId, date, clockOut: timestamp, status: 'PRESENT', source } });
  }
  // Keep the latest OUT punch of the day
  if (!existing.clockOut || timestamp > existing.clockOut) {
    const hoursWorked = existing.clockIn ? (timestamp.getTime() - existing.clockIn.getTime()) / 3600000 : undefined;
    return db.staffAttendance.update({ where: { id: existing.id }, data: { clockOut: timestamp, ...(hoursWorked !== undefined && { hoursWorked }), source } });
  }
  return existing;
}

export async function attendanceRoutes(app: FastifyInstance) {
  // ── Self-service clock in/out ───────────────────────────────────────────
  app.post('/clock-in', {
    schema: { tags: ['attendance'], summary: 'Self clock-in', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const staff = await db.staff.findFirst({ where: { userId } });
      if (!staff) return reply.status(404).send({ success: false, error: 'No staff record for this user' });

      const now = new Date();
      const date = dateOnly(now);
      const existing = await db.staffAttendance.findUnique({ where: { staffId_date: { staffId: staff.id, date } } });
      if (existing?.clockIn) return reply.status(400).send({ success: false, error: 'Already clocked in today' });

      const status = computeStatus(staff.shiftStartTime, now);
      const attendance = existing
        ? await db.staffAttendance.update({ where: { id: existing.id }, data: { clockIn: now, status, source: 'MANUAL' } })
        : await db.staffAttendance.create({ data: { staffId: staff.id, date, clockIn: now, status, source: 'MANUAL' } });
      return ok(attendance, status === 'LATE' ? 'Clocked in (late)' : 'Clocked in');
    },
  });

  app.post('/clock-out', {
    schema: { tags: ['attendance'], summary: 'Self clock-out', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const staff = await db.staff.findFirst({ where: { userId } });
      if (!staff) return reply.status(404).send({ success: false, error: 'No staff record for this user' });

      const now = new Date();
      const date = dateOnly(now);
      const existing = await db.staffAttendance.findUnique({ where: { staffId_date: { staffId: staff.id, date } } });
      if (!existing?.clockIn) return reply.status(400).send({ success: false, error: 'Not clocked in yet today' });
      if (existing.clockOut) return reply.status(400).send({ success: false, error: 'Already clocked out today' });

      const hoursWorked = (now.getTime() - existing.clockIn.getTime()) / 3600000;
      const attendance = await db.staffAttendance.update({ where: { id: existing.id }, data: { clockOut: now, hoursWorked } });
      return ok(attendance, 'Clocked out');
    },
  });

  app.get('/me/today', {
    schema: { tags: ['attendance'], summary: "Get current user's attendance for today", security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const staff = await db.staff.findFirst({ where: { userId } });
      if (!staff) return ok(null);
      const date = dateOnly(new Date());
      const attendance = await db.staffAttendance.findUnique({ where: { staffId_date: { staffId: staff.id, date } } });
      return ok(attendance);
    },
  });

  // ── Owner/Manager views ─────────────────────────────────────────────────
  app.get('/', {
    schema: { tags: ['attendance'], summary: 'List attendance records', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; date?: string; staffId?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = {
        ...(query.date && { date: dateOnlyFromYMD(query.date) }),
        ...(query.staffId && { staffId: query.staffId }),
      };
      const [items, total] = await Promise.all([
        db.staffAttendance.findMany({
          where, skip, take: limit, orderBy: { date: 'desc' },
          include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
        db.staffAttendance.count({ where }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  // Mark a staff member's day (Absent/On Leave/Present) even when no punch exists yet — upsert by staffId+date.
  app.post('/mark', {
    schema: { tags: ['attendance'], summary: 'Mark a staff member Absent/On Leave for a date', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = z.object({
        staffId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE']),
        notes: z.string().optional(),
      }).parse(request.body);

      const staff = await db.staff.findUnique({ where: { id: body.staffId } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      const date = dateOnlyFromYMD(body.date);
      const existing = await db.staffAttendance.findUnique({ where: { staffId_date: { staffId: body.staffId, date } } });
      const attendance = existing
        ? await db.staffAttendance.update({ where: { id: existing.id }, data: { status: body.status, notes: body.notes } })
        : await db.staffAttendance.create({ data: { staffId: body.staffId, date, status: body.status, notes: body.notes } });
      return reply.status(201).send(ok(attendance, 'Attendance marked'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['attendance'], summary: 'Manually correct an attendance record', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE']).optional(),
        clockIn: z.string().datetime().optional().nullable(),
        clockOut: z.string().datetime().optional().nullable(),
        notes: z.string().optional(),
      }).parse(request.body);

      const existing = await db.staffAttendance.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Attendance record not found' });

      const clockIn = body.clockIn !== undefined ? (body.clockIn ? new Date(body.clockIn) : null) : existing.clockIn;
      const clockOut = body.clockOut !== undefined ? (body.clockOut ? new Date(body.clockOut) : null) : existing.clockOut;
      const hoursWorked = clockIn && clockOut ? (clockOut.getTime() - clockIn.getTime()) / 3600000 : existing.hoursWorked;

      const attendance = await db.staffAttendance.update({
        where: { id },
        data: { ...body, clockIn, clockOut, hoursWorked },
      });
      return ok(attendance, 'Attendance updated');
    },
  });

  // ── CSV import from device export ───────────────────────────────────────
  app.post('/import', {
    schema: { tags: ['attendance'], summary: 'Bulk import punches from a device CSV export', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = z.object({
        punches: z.array(z.object({
          deviceUserId: z.string().min(1),
          timestamp: z.string(),
          type: z.enum(['IN', 'OUT']),
        })).min(1),
      }).parse(request.body);

      const deviceUserIds = [...new Set(body.punches.map((p) => p.deviceUserId))];
      const staffList = await db.staff.findMany({ where: { deviceUserId: { in: deviceUserIds } } });
      const staffMap = new Map(staffList.map((s) => [s.deviceUserId, s.id]));

      const sorted = [...body.punches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let applied = 0;
      const unmatched = new Set<string>();
      for (const punch of sorted) {
        const staffId = staffMap.get(punch.deviceUserId);
        if (!staffId) { unmatched.add(punch.deviceUserId); continue; }
        const ts = new Date(punch.timestamp);
        if (isNaN(ts.getTime())) continue;
        await applyPunch(db, staffId, ts, punch.type, 'DEVICE_IMPORT');
        applied++;
      }

      return reply.status(201).send(ok({ applied, unmatchedDeviceIds: [...unmatched] }, 'Import complete'));
    },
  });

  // ── Device webhook (no user JWT — tenant identified by device key) ──────
  app.post('/device-webhook', {
    schema: { tags: ['attendance'], summary: 'Fingerprint device / bridge push (tenant device key auth)' },
    handler: async (request, reply) => {
      const key = request.headers['x-attendance-key'] as string | undefined;
      if (!key) return reply.status(401).send({ success: false, error: 'Missing X-Attendance-Key header' });

      const tenant = await prisma.tenant.findUnique({ where: { attendanceDeviceKey: key } });
      if (!tenant) return reply.status(401).send({ success: false, error: 'Invalid device key' });

      const body = z.object({
        deviceUserId: z.string().min(1),
        timestamp: z.string(),
        type: z.enum(['IN', 'OUT']),
      }).parse(request.body);

      const db = tenantPrisma(tenant.id);
      const staff = await db.staff.findFirst({ where: { deviceUserId: body.deviceUserId } });
      if (!staff) return reply.status(404).send({ success: false, error: `No staff found with device user ID ${body.deviceUserId}` });

      const ts = new Date(body.timestamp);
      if (isNaN(ts.getTime())) return reply.status(400).send({ success: false, error: 'Invalid timestamp' });

      const attendance = await applyPunch(db, staff.id, ts, body.type, 'DEVICE_WEBHOOK');
      return reply.status(201).send(ok(attendance, 'Punch recorded'));
    },
  });

  // ── Device key management ───────────────────────────────────────────────
  app.get('/device-key', {
    schema: { tags: ['attendance'], summary: 'Get (or lazily create) this tenant\'s device webhook key', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      let tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { attendanceDeviceKey: true } });
      if (!tenant?.attendanceDeviceKey) {
        const attendanceDeviceKey = randomBytes(24).toString('hex');
        tenant = await prisma.tenant.update({ where: { id: tenantId }, data: { attendanceDeviceKey }, select: { attendanceDeviceKey: true } });
      }
      return ok({ deviceKey: tenant.attendanceDeviceKey });
    },
  });

  app.post('/device-key/rotate', {
    schema: { tags: ['attendance'], summary: 'Rotate the device webhook key', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const attendanceDeviceKey = randomBytes(24).toString('hex');
      await prisma.tenant.update({ where: { id: tenantId }, data: { attendanceDeviceKey } });
      return ok({ deviceKey: attendanceDeviceKey }, 'Device key rotated — update the desktop app config');
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { checkRoomLimit } from '../utils/entitlement';

const roomSchema = z.object({
  number:       z.string().min(1).max(10),
  name:         z.string().min(1).max(100),
  type:         z.enum(['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW']),
  floor:        z.number().int().optional(),
  maxOccupancy: z.number().int().min(1).max(20),
  basePrice:    z.number().positive(),
  description:  z.string().optional(),
  amenities:    z.array(z.string()).default([]),
  images:       z.array(z.string()).default([]),
  videos:       z.array(z.string().url('Each video must be a valid URL')).default([]),
});

export async function roomRoutes(app: FastifyInstance) {

  /* ── GET /api/rooms/stats ────────────────────────────────────────────────── */
  app.get('/stats', {
    schema: { tags: ['rooms'], summary: 'Room status counts', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;

      const [total, available, occupied, cleaning, maintenance, reserved] = await Promise.all([
        db.room.count({ where: { isActive: true } }),
        db.room.count({ where: { isActive: true, status: 'AVAILABLE' } }),
        db.room.count({ where: { isActive: true, status: 'OCCUPIED' } }),
        db.room.count({ where: { isActive: true, status: 'CLEANING' } }),
        db.room.count({ where: { isActive: true, status: 'MAINTENANCE' } }),
        db.room.count({ where: { isActive: true, status: 'RESERVED' } }),
      ]);

      return ok({ total, available, occupied, cleaning, maintenance, reserved });
    },
  });

  /* ── GET /api/rooms ──────────────────────────────────────────────────────── */
  app.get('/', {
    schema: {
      tags: ['rooms'], summary: 'List all rooms', security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page:   { type: 'integer' },
          limit:  { type: 'integer' },
          status: { type: 'string' },
          type:   { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const q = request.query as { page?: number; limit?: number; status?: string; type?: string; search?: string };
      const { page, limit, skip } = parsePageParams(q);

      const where: Record<string, unknown> = {
        isActive: true,
        ...(q.status && { status: q.status }),
        ...(q.type   && { type:   q.type   }),
        ...(q.search && {
          OR: [
            { name:   { contains: q.search, mode: 'insensitive' } },
            { number: { contains: q.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [rooms, total] = await Promise.all([
        db.room.findMany({ where, skip, take: limit, orderBy: { number: 'asc' } }),
        db.room.count({ where }),
      ]);

      return paginated(rooms, total, page, limit);
    },
  });

  /* ── GET /api/rooms/availability ─────────────────────────────────────────── */
  app.get('/availability', {
    schema: { tags: ['rooms'], summary: 'Check room availability for date range', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const { checkIn, checkOut } = request.query as { checkIn: string; checkOut: string };

      if (!checkIn || !checkOut) {
        return { success: false, error: 'checkIn and checkOut are required' };
      }

      const checkInDate  = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      const bookedRoomIds = await db.booking.findMany({
        where: {
          status:   { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          checkIn:  { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
        select: { roomId: true },
      });

      const bookedIds = bookedRoomIds.map(b => b.roomId);

      const availableRooms = await db.room.findMany({
        where: {
          isActive: true,
          status:   { not: 'MAINTENANCE' },
          id:       { notIn: bookedIds },
        },
        orderBy: { basePrice: 'asc' },
      });

      return ok(availableRooms);
    },
  });

  /* ── GET /api/rooms/:id ──────────────────────────────────────────────────── */
  app.get('/:id', {
    schema: { tags: ['rooms'], summary: 'Get room by ID (with current booking)', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const now = new Date();
      const currentBooking = await db.booking.findFirst({
        where: {
          roomId: id,
          status: { in: ['CHECKED_IN', 'CONFIRMED', 'PENDING'] },
          checkIn:  { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          checkOut: { gte: now },
        },
        orderBy: { checkIn: 'asc' },
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      });

      return ok({ ...room, currentBooking: currentBooking ?? null });
    },
  });

  /* ── POST /api/rooms ─────────────────────────────────────────────────────── */
  app.post('/', {
    schema: { tags: ['rooms'], summary: 'Create room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = roomSchema.parse(request.body);

      const existing = await db.room.findFirst({ where: { number: body.number } });
      if (existing) return reply.status(409).send({ success: false, error: 'Room number already exists' });

      // Plan limit check
      const { tenantId } = request.user as { tenantId: string };
      const limitCheck = await checkRoomLimit(tenantId);
      if (!limitCheck.allowed) {
        return reply.status(403).send({
          success: false,
          error: `Room limit reached. Your plan allows ${limitCheck.limit} rooms. Upgrade to add more.`,
          code: 'ROOM_LIMIT_REACHED',
          data: { limit: limitCheck.limit, current: limitCheck.current } as unknown,
        });
      }

      const room = await db.room.create({ data: body });
      return reply.status(201).send(ok(room, 'Room created'));
    },
  });

  /* ── PATCH /api/rooms/:id ────────────────────────────────────────────────── */
  app.patch('/:id', {
    schema: { tags: ['rooms'], summary: 'Update room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = roomSchema.partial().parse(request.body);

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      if (body.number && body.number !== room.number) {
        const dup = await db.room.findFirst({ where: { number: body.number, id: { not: id } } });
        if (dup) return reply.status(409).send({ success: false, error: 'Room number already exists' });
      }

      const updated = await db.room.update({ where: { id }, data: body });
      return ok(updated, 'Room updated');
    },
  });

  /* ── PATCH /api/rooms/:id/status ─────────────────────────────────────────── */
  app.patch('/:id/status', {
    schema: { tags: ['rooms'], summary: 'Update room status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED']),
      }).parse(request.body);

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const updated = await db.room.update({ where: { id }, data: { status } });
      return ok(updated, 'Status updated');
    },
  });

  /* ── DELETE /api/rooms/:id ───────────────────────────────────────────────── */
  app.delete('/:id', {
    schema: { tags: ['rooms'], summary: 'Delete (deactivate) room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const activeBooking = await db.booking.findFirst({
        where: {
          roomId: id,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        },
      });
      if (activeBooking) {
        return reply.status(409).send({
          success: false,
          error: 'Cannot delete room with active bookings. Cancel or complete them first.',
        });
      }

      await db.room.update({ where: { id }, data: { isActive: false } });
      return ok(null, 'Room deleted');
    },
  });
}

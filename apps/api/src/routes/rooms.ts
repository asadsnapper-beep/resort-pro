import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

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

  /* ── GET /api/rooms/stats ──────────────────────────────────────────────────── */
  // Must be registered BEFORE /:id to avoid Fastify treating "stats" as a param
  app.get('/stats', {
    schema: { tags: ['rooms'], summary: 'Room status counts', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;

      const [total, available, occupied, cleaning, maintenance, reserved] = await Promise.all([
        prisma.room.count({ where: { tenantId, isActive: true } }),
        prisma.room.count({ where: { tenantId, isActive: true, status: 'AVAILABLE' } }),
        prisma.room.count({ where: { tenantId, isActive: true, status: 'OCCUPIED' } }),
        prisma.room.count({ where: { tenantId, isActive: true, status: 'CLEANING' } }),
        prisma.room.count({ where: { tenantId, isActive: true, status: 'MAINTENANCE' } }),
        prisma.room.count({ where: { tenantId, isActive: true, status: 'RESERVED' } }),
      ]);

      return ok({ total, available, occupied, cleaning, maintenance, reserved });
    },
  });

  /* ── GET /api/rooms ────────────────────────────────────────────────────────── */
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
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const q = request.query as { page?: number; limit?: number; status?: string; type?: string; search?: string };
      const { page, limit, skip } = parsePageParams(q);

      const where: Record<string, unknown> = {
        tenantId,
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
        prisma.room.findMany({ where, skip, take: limit, orderBy: { number: 'asc' } }),
        prisma.room.count({ where }),
      ]);

      return paginated(rooms, total, page, limit);
    },
  });

  /* ── GET /api/rooms/availability ──────────────────────────────────────────── */
  app.get('/availability', {
    schema: { tags: ['rooms'], summary: 'Check room availability for date range', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const { checkIn, checkOut } = request.query as { checkIn: string; checkOut: string };

      if (!checkIn || !checkOut) {
        return { success: false, error: 'checkIn and checkOut are required' };
      }

      const checkInDate  = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      const bookedRoomIds = await prisma.booking.findMany({
        where: {
          tenantId,
          status:   { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          checkIn:  { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
        select: { roomId: true },
      });

      const bookedIds = bookedRoomIds.map(b => b.roomId);

      const availableRooms = await prisma.room.findMany({
        where: {
          tenantId,
          isActive: true,
          status:   { not: 'MAINTENANCE' },
          id:       { notIn: bookedIds },
        },
        orderBy: { basePrice: 'asc' },
      });

      return ok(availableRooms);
    },
  });

  /* ── GET /api/rooms/:id ────────────────────────────────────────────────────── */
  app.get('/:id', {
    schema: { tags: ['rooms'], summary: 'Get room by ID (with current booking)', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      // Attach current/upcoming active booking (if any)
      const now = new Date();
      const currentBooking = await prisma.booking.findFirst({
        where: {
          tenantId,
          roomId: id,
          status: { in: ['CHECKED_IN', 'CONFIRMED', 'PENDING'] },
          checkIn:  { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, // within 7 days
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

  /* ── POST /api/rooms ───────────────────────────────────────────────────────── */
  app.post('/', {
    schema: { tags: ['rooms'], summary: 'Create room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = roomSchema.parse(request.body);

      const existing = await prisma.room.findFirst({ where: { tenantId, number: body.number } });
      if (existing) return reply.status(409).send({ success: false, error: 'Room number already exists' });

      const room = await prisma.room.create({ data: { tenantId, ...body } });
      return reply.status(201).send(ok(room, 'Room created'));
    },
  });

  /* ── PATCH /api/rooms/:id ──────────────────────────────────────────────────── */
  app.patch('/:id', {
    schema: { tags: ['rooms'], summary: 'Update room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = roomSchema.partial().parse(request.body);

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      // If room number is being changed, check uniqueness
      if (body.number && body.number !== room.number) {
        const dup = await prisma.room.findFirst({ where: { tenantId, number: body.number, id: { not: id } } });
        if (dup) return reply.status(409).send({ success: false, error: 'Room number already exists' });
      }

      const updated = await prisma.room.update({ where: { id }, data: body });
      return ok(updated, 'Room updated');
    },
  });

  /* ── PATCH /api/rooms/:id/status ───────────────────────────────────────────── */
  app.patch('/:id/status', {
    schema: { tags: ['rooms'], summary: 'Update room status', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED']),
      }).parse(request.body);

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const updated = await prisma.room.update({ where: { id }, data: { status } });
      return ok(updated, 'Status updated');
    },
  });

  /* ── DELETE /api/rooms/:id ─────────────────────────────────────────────────── */
  app.delete('/:id', {
    schema: { tags: ['rooms'], summary: 'Delete (deactivate) room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      // Block delete if there are active bookings
      const activeBooking = await prisma.booking.findFirst({
        where: {
          tenantId,
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

      await prisma.room.update({ where: { id }, data: { isActive: false } });
      return ok(null, 'Room deleted');
    },
  });
}

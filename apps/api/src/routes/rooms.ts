import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const roomSchema = z.object({
  number: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  type: z.enum(['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW']),
  floor: z.number().int().optional(),
  maxOccupancy: z.number().int().min(1).max(20),
  basePrice: z.number().positive(),
  description: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
});

export async function roomRoutes(app: FastifyInstance) {
  // GET /api/rooms
  app.get('/', {
    schema: {
      tags: ['rooms'],
      summary: 'List all rooms',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          status: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string; type?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        tenantId,
        isActive: true,
        ...(query.status && { status: query.status as never }),
        ...(query.type && { type: query.type as never }),
      };

      const [rooms, total] = await Promise.all([
        prisma.room.findMany({ where, skip, take: limit, orderBy: { number: 'asc' } }),
        prisma.room.count({ where }),
      ]);

      return paginated(rooms, total, page, limit);
    },
  });

  // GET /api/rooms/availability
  app.get('/availability', {
    schema: {
      tags: ['rooms'],
      summary: 'Check room availability for date range',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const { checkIn, checkOut } = request.query as { checkIn: string; checkOut: string };

      if (!checkIn || !checkOut) {
        return { success: false, error: 'checkIn and checkOut are required' };
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      const bookedRoomIds = await prisma.booking.findMany({
        where: {
          tenantId,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          checkIn: { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
        select: { roomId: true },
      });

      const bookedIds = bookedRoomIds.map((b) => b.roomId);

      const availableRooms = await prisma.room.findMany({
        where: {
          tenantId,
          isActive: true,
          status: { not: 'MAINTENANCE' },
          id: { notIn: bookedIds },
        },
        orderBy: { basePrice: 'asc' },
      });

      return ok(availableRooms);
    },
  });

  // GET /api/rooms/:id
  app.get('/:id', {
    schema: { tags: ['rooms'], summary: 'Get room by ID', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });
      return ok(room);
    },
  });

  // POST /api/rooms
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

  // PATCH /api/rooms/:id
  app.patch('/:id', {
    schema: { tags: ['rooms'], summary: 'Update room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = roomSchema.partial().parse(request.body);

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const updated = await prisma.room.update({ where: { id }, data: body });
      return ok(updated, 'Room updated');
    },
  });

  // PATCH /api/rooms/:id/status
  app.patch('/:id/status', {
    schema: { tags: ['rooms'], summary: 'Update room status', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const updated = await prisma.room.update({ where: { id }, data: { status: status as never } });
      return ok(updated, 'Status updated');
    },
  });

  // DELETE /api/rooms/:id
  app.delete('/:id', {
    schema: { tags: ['rooms'], summary: 'Delete room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const room = await prisma.room.findFirst({ where: { id, tenantId } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      await prisma.room.update({ where: { id }, data: { isActive: false } });
      return ok(null, 'Room deleted');
    },
  });
}

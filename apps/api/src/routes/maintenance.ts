import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const createSchema = z.object({
  roomId: z.string(),
  issueType: z.enum(['AC', 'PLUMBING', 'ELECTRICAL', 'FURNITURE', 'DOOR', 'WIFI', 'TV', 'OTHER']),
  description: z.string().min(1),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
  assignedTo: z.string().optional().nullable(),
});

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
});

/** When all open tickets for a room are resolved, restore its status to AVAILABLE */
async function restoreRoomIfClear(tenantId: string, roomId: string) {
  const openCount = await prisma.maintenanceTicket.count({
    where: { tenantId, roomId, status: { not: 'RESOLVED' } },
  });
  if (openCount === 0) {
    await prisma.room.update({ where: { id: roomId }, data: { status: 'AVAILABLE' } });
  }
}

export async function maintenanceRoutes(app: FastifyInstance) {
  // GET /api/maintenance
  app.get('/', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { status, roomId, priority } = request.query as {
        status?: string; roomId?: string; priority?: string;
      };

      const tickets = await prisma.maintenanceTicket.findMany({
        where: {
          tenantId,
          ...(status && { status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' }),
          ...(roomId && { roomId }),
          ...(priority && { priority: priority as 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' }),
        },
        include: {
          room: { select: { id: true, name: true, number: true, floor: true } },
        },
        orderBy: [
          // URGENT first, then by createdAt desc
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
      });

      return ok(reply, tickets);
    },
  });

  // GET /api/maintenance/summary
  app.get('/summary', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [open, inProgress, resolvedToday, urgent] = await Promise.all([
        prisma.maintenanceTicket.count({ where: { tenantId, status: 'OPEN' } }),
        prisma.maintenanceTicket.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
        prisma.maintenanceTicket.count({ where: { tenantId, status: 'RESOLVED', resolvedAt: { gte: todayStart } } }),
        prisma.maintenanceTicket.count({ where: { tenantId, status: { not: 'RESOLVED' }, priority: 'URGENT' } }),
      ]);

      return ok(reply, { open, inProgress, resolvedToday, urgent });
    },
  });

  // POST /api/maintenance
  app.post('/', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId, userId } = request.user as JwtPayload;
      const body = createSchema.parse(request.body);

      const room = await prisma.room.findFirst({ where: { id: body.roomId, tenantId } });
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      const ticket = await prisma.maintenanceTicket.create({
        data: {
          tenantId,
          roomId: body.roomId,
          issueType: body.issueType,
          description: body.description,
          priority: body.priority,
          assignedTo: body.assignedTo ?? null,
          createdBy: userId,
        },
        include: { room: { select: { id: true, name: true, number: true } } },
      });

      // Set room status to MAINTENANCE
      await prisma.room.update({ where: { id: body.roomId }, data: { status: 'MAINTENANCE' } });

      return reply.status(201).send({ success: true, data: ticket });
    },
  });

  // PATCH /api/maintenance/:id
  app.patch('/:id', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;
      const body = updateSchema.parse(request.body);

      const existing = await prisma.maintenanceTicket.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' });

      const ticket = await prisma.maintenanceTicket.update({
        where: { id },
        data: {
          ...(body.status !== undefined && { status: body.status }),
          ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.priority !== undefined && { priority: body.priority }),
        },
        include: { room: { select: { id: true, name: true, number: true } } },
      });

      return ok(reply, ticket);
    },
  });

  // PATCH /api/maintenance/:id/resolve
  app.patch('/:id/resolve', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;
      const { notes } = request.body as { notes?: string };

      const existing = await prisma.maintenanceTicket.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' });
      if (existing.status === 'RESOLVED') return reply.status(400).send({ error: 'Already resolved' });

      const ticket = await prisma.maintenanceTicket.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: new Date(), notes: notes ?? existing.notes },
        include: { room: { select: { id: true, name: true, number: true } } },
      });

      // Restore room status if no other open tickets remain
      await restoreRoomIfClear(tenantId, existing.roomId);

      return ok(reply, ticket);
    },
  });

  // DELETE /api/maintenance/:id
  app.delete('/:id', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'STAFF')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;

      const existing = await prisma.maintenanceTicket.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' });

      await prisma.maintenanceTicket.delete({ where: { id } });
      await restoreRoomIfClear(tenantId, existing.roomId);

      return ok(reply, { deleted: true });
    },
  });
}

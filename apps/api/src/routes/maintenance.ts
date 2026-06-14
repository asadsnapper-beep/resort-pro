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

/** When all open tickets for a room are resolved, restore its status.
 *  If a guest is currently checked in → OCCUPIED; otherwise → AVAILABLE.
 */
async function restoreRoomIfClear(tenantId: string, roomId: string) {
  const openCount = await prisma.maintenanceTicket.count({
    where: { tenantId, roomId, status: { not: 'RESOLVED' } },
  });
  if (openCount === 0) {
    const activeBooking = await prisma.booking.findFirst({
      where: { tenantId, roomId, status: 'CHECKED_IN' },
      select: { id: true },
    });
    const newStatus = activeBooking ? 'OCCUPIED' : 'AVAILABLE';
    await prisma.room.update({ where: { id: roomId }, data: { status: newStatus } });
  }
}

export async function maintenanceRoutes(app: FastifyInstance) {
  // GET /api/maintenance
  app.get('/', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { status, roomId, priority } = request.query as {
        status?: string; roomId?: string; priority?: string;
      };

      const tickets = await db.maintenanceTicket.findMany({
        where: {
          ...(status && { status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' }),
          ...(roomId && { roomId }),
          ...(priority && { priority: priority as 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' }),
        },
        include: {
          room: { select: { id: true, name: true, number: true, floor: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Sort by priority (URGENT→HIGH→NORMAL→LOW) then by newest first
      const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      tickets.sort((a, b) =>
        (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return ok(tickets);
    },
  });

  // GET /api/maintenance/summary
  app.get('/summary', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [open, inProgress, resolvedToday, urgent] = await Promise.all([
        db.maintenanceTicket.count({ where: { status: 'OPEN' } }),
        db.maintenanceTicket.count({ where: { status: 'IN_PROGRESS' } }),
        db.maintenanceTicket.count({ where: { status: 'RESOLVED', resolvedAt: { gte: todayStart } } }),
        db.maintenanceTicket.count({ where: { status: { not: 'RESOLVED' }, priority: 'URGENT' } }),
      ]);

      return ok({ open, inProgress, resolvedToday, urgent });
    },
  });

  // POST /api/maintenance
  app.post('/', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId, sub: userId } = request.user as JwtPayload;
      const body = createSchema.parse(request.body);

      const room = await db.room.findFirst({ where: { id: body.roomId } });
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      const ticket = await db.maintenanceTicket.create({
        data: {
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
      await db.room.update({ where: { id: body.roomId }, data: { status: 'MAINTENANCE' } });

      return reply.status(201).send({ success: true, data: ticket });
    },
  });

  // PATCH /api/maintenance/:id
  app.patch('/:id', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;
      const body = updateSchema.parse(request.body);

      const existing = await db.maintenanceTicket.findFirst({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' });

      const ticket = await db.maintenanceTicket.update({
        where: { id },
        data: {
          ...(body.status !== undefined && {
            status: body.status,
            // Ensure resolvedAt is set when status is moved to RESOLVED via this endpoint too
            ...(body.status === 'RESOLVED' && !existing.resolvedAt && { resolvedAt: new Date() }),
          }),
          ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.priority !== undefined && { priority: body.priority }),
        },
        include: { room: { select: { id: true, name: true, number: true } } },
      });

      // If status was set to RESOLVED via this endpoint, also restore room if clear
      if (body.status === 'RESOLVED') {
        await restoreRoomIfClear(tenantId, existing.roomId);
      }

      return ok(ticket);
    },
  });

  // PATCH /api/maintenance/:id/resolve
  app.patch('/:id/resolve', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;
      const { notes } = request.body as { notes?: string };

      const existing = await db.maintenanceTicket.findFirst({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' });
      if (existing.status === 'RESOLVED') return reply.status(400).send({ error: 'Already resolved' });

      const ticket = await db.maintenanceTicket.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: new Date(), notes: notes ?? existing.notes },
        include: { room: { select: { id: true, name: true, number: true } } },
      });

      // Restore room status if no other open tickets remain
      await restoreRoomIfClear(tenantId, existing.roomId);

      return ok(ticket);
    },
  });

  // DELETE /api/maintenance/:id
  app.delete('/:id', {
    schema: { tags: ['maintenance'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'STAFF')],
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;

      const existing = await db.maintenanceTicket.findFirst({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' });

      await db.maintenanceTicket.delete({ where: { id } });
      await restoreRoomIfClear(tenantId, existing.roomId);

      return ok({ deleted: true });
    },
  });
}

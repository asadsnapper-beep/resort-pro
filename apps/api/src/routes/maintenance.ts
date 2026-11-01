import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { recomputeRoomStatus, type RoomStateClient } from '../utils/room-state';

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

/**
 * Re-derive the room's status from everything still open on it.
 *
 * This replaces `restoreRoomIfClear`, which counted tickets and asked about a
 * checked-in guest — and never about the person still cleaning the room. It
 * sent a room being cleaned straight back to Available.
 * (Room Management QA 2026-10-28, RM-004.)
 *
 * `client` must be the tenant-scoped client, so the write it makes cannot
 * reach another resort's room.
 */
async function syncRoom(client: RoomStateClient, tenantId: string, roomId: string) {
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { timezone: true },
  });
  await recomputeRoomStatus(client, {
    tenantId,
    roomId,
    timezone: tenant?.timezone ?? undefined,
  });
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

      // The ticket and the room's status are one fact, so they are written
      // together: a ticket whose room never came off sale is the bug this is
      // here to stop.
      const ticket = await db.$transaction(async (tx) => {
        const created = await tx.maintenanceTicket.create({
          data: {
            // Spelled out because a transaction client's types do not carry
            // the relaxation the request-scoped client has; the extension
            // injects the same value either way.
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

        // Not a blind write to MAINTENANCE any more. A guest asleep in the
        // room outranks a dripping tap: logging the fault must not erase them
        // from the board, which is exactly what this used to do, straight past
        // the guard RM-001 had just put on the room endpoint. The fault is
        // still recorded, and the first recompute after the room empties is
        // the one that takes it off sale.
        await syncRoom(tx as unknown as RoomStateClient, tenantId, body.roomId);

        return created;
      });

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
        await syncRoom(db, tenantId, existing.roomId);
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
      await syncRoom(db, tenantId, existing.roomId);

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
      await syncRoom(db, tenantId, existing.roomId);

      return ok({ deleted: true });
    },
  });
}

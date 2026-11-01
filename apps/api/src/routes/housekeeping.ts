import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '@resort-pro/types';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { matchAllTerms } from '../utils/search-terms';
import { prisma } from '@resort-pro/database';
import { BETWEEN_STAY_TYPES, recomputeRoomStatus, type RoomStateClient } from '../utils/room-state';

const taskSchema = z.object({
  roomId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  type: z.enum(['DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'CHECKOUT', 'CHECKIN']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});


type HousekeepingActor = Pick<JwtPayload, 'role' | 'sub'>;

/** STAFF may read and mutate only tasks assigned to their linked Staff record. */
export function housekeepingAssignmentScope(actor: HousekeepingActor) {
  return actor.role === 'STAFF'
    ? { assignedTo: { is: { userId: actor.sub } } }
    : {};
}

export async function housekeepingRoutes(app: FastifyInstance) {
  // GET /stats — total counts by status (for accurate dashboard cards)
  app.get('/stats', {
    schema: { tags: ['housekeeping'], summary: 'Get housekeeping stats', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const actor = request.user as JwtPayload;
      const query = request.query as { date?: string };
      const dateWhere = query.date ? { scheduledDate: { equals: new Date(query.date) } } : {};
      const assignmentScope = housekeepingAssignmentScope(actor);

      const [pending, inProgress, completed, skipped, total] = await Promise.all([
        db.housekeepingTask.count({ where: { status: 'PENDING', ...dateWhere, ...assignmentScope } }),
        db.housekeepingTask.count({ where: { status: 'IN_PROGRESS', ...dateWhere, ...assignmentScope } }),
        db.housekeepingTask.count({ where: { status: 'COMPLETED', ...dateWhere, ...assignmentScope } }),
        db.housekeepingTask.count({ where: { status: 'SKIPPED', ...dateWhere, ...assignmentScope } }),
        db.housekeepingTask.count({ where: { ...dateWhere, ...assignmentScope } }),
      ]);

      return ok({ total, pending, inProgress, completed, skipped });
    },
  });

  app.get('/', {
    schema: { tags: ['housekeeping'], summary: 'List housekeeping tasks', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const actor = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string; date?: string; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        ...housekeepingAssignmentScope(actor),
        ...(query.status && { status: query.status as never }),
        ...(query.date && { scheduledDate: { equals: new Date(query.date) } }),
        ...(matchAllTerms(query.search, [
          'room.number', 'room.name',
          'assignedTo.user.firstName', 'assignedTo.user.lastName',
        ]) ?? {}),
      };

      const [tasks, total] = await Promise.all([
        db.housekeepingTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: { scheduledDate: 'asc' },
          include: {
            room: { select: { number: true, name: true, floor: true } },
            assignedTo: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        }),
        db.housekeepingTask.count({ where }),
      ]);

      return paginated(tasks, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['housekeeping'], summary: 'Create housekeeping task', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = taskSchema.parse(request.body);

      const task = await db.housekeepingTask.create({
        data: {
          roomId: body.roomId,
          assignedToId: body.assignedToId,
          type: body.type,
          scheduledDate: new Date(body.scheduledDate),
          notes: body.notes,
        },
      });

      return reply.status(201).send(ok(task, 'Task created'));
    },
  });

  app.patch('/:id/status', {
    schema: { tags: ['housekeeping'], summary: 'Update task status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const actor = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { status, expectedStatus } = z.object({
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
        expectedStatus: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).optional(),
      }).parse(request.body);

      const task = await db.housekeepingTask.findFirst({
        where: { id, ...housekeepingAssignmentScope(actor) },
      });
      if (!task) return reply.status(404).send({ success: false, error: 'Task not found' });

      // Idempotent retry: the first request may have committed while its response
      // was lost. Returning the current task prevents duplicate side effects.
      if (task.status === status) return ok(task, 'Task already updated');

      // Offline clients send the status they originally observed. Never let a
      // stale queued change overwrite a newer server decision.
      if (expectedStatus && task.status !== expectedStatus) {
        return reply.status(409).send({
          success: false,
          error: 'Task changed since it was last synced',
          code: 'HOUSEKEEPING_STATUS_CONFLICT',
          data: { currentStatus: task.status },
        });
      }

      // Only tasks done between stays say anything about the room: DAILY and
      // TURNDOWN happen around a guest who is still in residence.
      const isBetweenStay = (BETWEEN_STAY_TYPES as readonly string[]).includes(task.type);

      const updated = await db.$transaction(async (tx) => {
        const task2 = await tx.housekeepingTask.update({
          where: { id },
          data: {
            status: status as never,
            completedAt: status === 'COMPLETED' ? new Date() : null,
          },
        });

        /**
         * Finishing a clean used to *assert* the room was ready: COMPLETED
         * wrote AVAILABLE, full stop. So a room with a broken air conditioner
         * went on sale the moment housekeeping ticked it off, and so did a
         * room whose guest was still checked into it — the clean was DAILY's
         * job and the guest had never left. (Room Management QA 2026-10-28,
         * RM-004.)
         *
         * Now it asks instead. The task's own new status is already written
         * above, inside this transaction, so the recompute sees it: a clean in
         * progress means CLEANING, and one that is finished or skipped means
         * whatever is left blocking the room — a guest, an open ticket, a
         * booking that covers today, or nothing at all.
         */
        if (isBetweenStay) {
          const tenant = await prisma.tenant.findUnique({
            where:  { id: actor.tenantId },
            select: { timezone: true },
          });
          await recomputeRoomStatus(tx as unknown as RoomStateClient, {
            tenantId: actor.tenantId,
            roomId:   task.roomId,
            timezone: tenant?.timezone ?? undefined,
          });
        }

        return task2;
      });

      return ok(updated, 'Task updated');
    },
  });

  app.patch('/:id/assign', {
    schema: { tags: ['housekeeping'], summary: 'Assign task to staff', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { staffId } = request.body as { staffId: string };

      const task = await db.housekeepingTask.findFirst({ where: { id } });
      if (!task) return reply.status(404).send({ success: false, error: 'Task not found' });

      const updated = await db.housekeepingTask.update({ where: { id }, data: { assignedToId: staffId } });
      return ok(updated, 'Task assigned');
    },
  });
}

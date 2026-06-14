import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const taskSchema = z.object({
  roomId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  type: z.enum(['DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'CHECKOUT', 'CHECKIN']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

// Task types that involve cleaning between stays (room should be CLEANING while in progress, AVAILABLE when done)
const BETWEEN_STAY_TYPES = ['CHECKOUT', 'DEEP_CLEAN', 'CHECKIN'] as const;

export async function housekeepingRoutes(app: FastifyInstance) {
  // GET /stats — total counts by status (for accurate dashboard cards)
  app.get('/stats', {
    schema: { tags: ['housekeeping'], summary: 'Get housekeeping stats', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { date?: string };
      const dateWhere = query.date ? { scheduledDate: { equals: new Date(query.date) } } : {};

      const [pending, inProgress, completed, skipped, total] = await Promise.all([
        prisma.housekeepingTask.count({ where: { tenantId, status: 'PENDING', ...dateWhere } }),
        prisma.housekeepingTask.count({ where: { tenantId, status: 'IN_PROGRESS', ...dateWhere } }),
        prisma.housekeepingTask.count({ where: { tenantId, status: 'COMPLETED', ...dateWhere } }),
        prisma.housekeepingTask.count({ where: { tenantId, status: 'SKIPPED', ...dateWhere } }),
        prisma.housekeepingTask.count({ where: { tenantId, ...dateWhere } }),
      ]);

      return ok({ total, pending, inProgress, completed, skipped });
    },
  });

  app.get('/', {
    schema: { tags: ['housekeeping'], summary: 'List housekeeping tasks', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string; date?: string; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        tenantId,
        ...(query.status && { status: query.status as never }),
        ...(query.date && { scheduledDate: { equals: new Date(query.date) } }),
        ...(query.search && {
          OR: [
            { room: { number: { contains: query.search, mode: 'insensitive' as const } } },
            { room: { name:   { contains: query.search, mode: 'insensitive' as const } } },
            { assignedTo: { user: { firstName: { contains: query.search, mode: 'insensitive' as const } } } },
            { assignedTo: { user: { lastName:  { contains: query.search, mode: 'insensitive' as const } } } },
          ],
        }),
      };

      const [tasks, total] = await Promise.all([
        prisma.housekeepingTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: { scheduledDate: 'asc' },
          include: {
            room: { select: { number: true, name: true, floor: true } },
            assignedTo: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        }),
        prisma.housekeepingTask.count({ where }),
      ]);

      return paginated(tasks, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['housekeeping'], summary: 'Create housekeeping task', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = taskSchema.parse(request.body);

      const task = await prisma.housekeepingTask.create({
        data: {
          tenantId,
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
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      const task = await prisma.housekeepingTask.findFirst({ where: { id, tenantId } });
      if (!task) return reply.status(404).send({ success: false, error: 'Task not found' });

      const updated = await prisma.housekeepingTask.update({
        where: { id },
        data: {
          status: status as never,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });

      // Only update room status for tasks that involve cleaning between stays.
      // DAILY and TURNDOWN happen while the guest is still in the room — don't touch room status.
      const isBetweenStay = (BETWEEN_STAY_TYPES as readonly string[]).includes(task.type);
      if (isBetweenStay) {
        if (status === 'IN_PROGRESS') {
          // Mark room as being cleaned
          await prisma.room.update({ where: { id: task.roomId }, data: { status: 'CLEANING' } });
        } else if (status === 'COMPLETED') {
          // Room ready for next guest
          await prisma.room.update({ where: { id: task.roomId }, data: { status: 'AVAILABLE' } });
        }
      }

      return ok(updated, 'Task updated');
    },
  });

  app.patch('/:id/assign', {
    schema: { tags: ['housekeeping'], summary: 'Assign task to staff', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { staffId } = request.body as { staffId: string };

      const task = await prisma.housekeepingTask.findFirst({ where: { id, tenantId } });
      if (!task) return reply.status(404).send({ success: false, error: 'Task not found' });

      const updated = await prisma.housekeepingTask.update({ where: { id }, data: { assignedToId: staffId } });
      return ok(updated, 'Task assigned');
    },
  });
}

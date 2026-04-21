import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const taskSchema = z.object({
  roomId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  type: z.enum(['DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'CHECKOUT', 'CHECKIN']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export async function housekeepingRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['housekeeping'], summary: 'List housekeeping tasks', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string; date?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        tenantId,
        ...(query.status && { status: query.status as never }),
        ...(query.date && { scheduledDate: { equals: new Date(query.date) } }),
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
    preHandler: requireAuth,
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
    preHandler: requireAuth,
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

      if (status === 'COMPLETED') {
        await prisma.room.update({ where: { id: task.roomId }, data: { status: 'AVAILABLE' } });
      }

      return ok(updated, 'Task updated');
    },
  });

  app.patch('/:id/assign', {
    schema: { tags: ['housekeeping'], summary: 'Assign task to staff', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
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

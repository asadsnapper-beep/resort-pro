import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';

const createSchema = z.object({
  roomId: z.string().uuid(),
  bookingId: z.string().uuid().optional().nullable(),
  itemCount: z.number().int().positive(),
  description: z.string().optional(),
  serviceType: z.enum(['WASH', 'DRY_CLEAN', 'IRON', 'WASH_AND_IRON']).optional(),
  cost: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const STATUS_FLOW = ['REQUESTED', 'IN_PROGRESS', 'READY', 'DELIVERED'] as const;

export async function laundryRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['laundry'], summary: 'List laundry orders', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; status?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = { ...(query.status && { status: query.status as never }) };
      const [items, total] = await Promise.all([
        db.laundryOrder.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { room: { select: { name: true, number: true } } },
        }),
        db.laundryOrder.count({ where }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['laundry'], summary: 'Create a laundry order', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = createSchema.parse(request.body);
      const order = await db.laundryOrder.create({ data: { ...body, bookingId: body.bookingId || undefined } });
      return reply.status(201).send(ok(order, 'Laundry order created'));
    },
  });

  app.patch('/:id/status', {
    schema: { tags: ['laundry'], summary: 'Advance laundry order status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({ status: z.enum(STATUS_FLOW), cost: z.number().min(0).optional() }).parse(request.body);
      const existing = await db.laundryOrder.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Order not found' });

      const data: Record<string, unknown> = { status: body.status };
      if (body.cost !== undefined) data.cost = body.cost;
      if (body.status === 'READY' && !existing.readyAt) data.readyAt = new Date();
      if (body.status === 'DELIVERED' && !existing.deliveredAt) data.deliveredAt = new Date();

      const order = await db.laundryOrder.update({ where: { id }, data });
      return ok(order, 'Status updated');
    },
  });

  app.patch('/:id/billed', {
    schema: { tags: ['laundry'], summary: 'Mark a laundry order as billed', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.laundryOrder.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Order not found' });
      const order = await db.laundryOrder.update({ where: { id }, data: { billed: true } });
      return ok(order, 'Marked as billed');
    },
  });
}

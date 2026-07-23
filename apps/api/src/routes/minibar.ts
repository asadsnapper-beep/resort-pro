import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';

const catalogSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  isActive: z.boolean().optional(),
});

const consumptionSchema = z.object({
  roomId: z.string().uuid(),
  bookingId: z.string().uuid().optional().nullable(),
  items: z.array(z.object({ minibarItemId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
  recordedBy: z.string().optional(),
});

export async function minibarRoutes(app: FastifyInstance) {
  // ── Catalog ──────────────────────────────────────────────────────────────
  app.get('/catalog', {
    schema: { tags: ['minibar'], summary: 'List minibar price list', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const items = await db.minibarItem.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
      return ok(items);
    },
  });

  app.post('/catalog', {
    schema: { tags: ['minibar'], summary: 'Add minibar catalog item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = catalogSchema.parse(request.body);
      const item = await db.minibarItem.create({ data: body });
      return reply.status(201).send(ok(item, 'Minibar item added'));
    },
  });

  app.patch('/catalog/:id', {
    schema: { tags: ['minibar'], summary: 'Update minibar catalog item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = catalogSchema.partial().parse(request.body);
      const existing = await db.minibarItem.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Catalog item not found' });
      const item = await db.minibarItem.update({ where: { id }, data: body });
      return ok(item, 'Catalog item updated');
    },
  });

  // ── Consumption ──────────────────────────────────────────────────────────
  app.get('/consumption', {
    schema: { tags: ['minibar'], summary: 'List consumption log', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; billed?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = { ...(query.billed !== undefined && { billed: query.billed === 'true' }) };
      const [items, total] = await Promise.all([
        db.minibarConsumption.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { room: { select: { name: true, number: true } } },
        }),
        db.minibarConsumption.count({ where }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  app.post('/consumption', {
    schema: { tags: ['minibar'], summary: 'Log minibar consumption for a room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = consumptionSchema.parse(request.body);

      const catalogItems = await db.minibarItem.findMany({ where: { id: { in: body.items.map((i) => i.minibarItemId) } } });
      const catalogMap = new Map(catalogItems.map((c) => [c.id, c]));

      const rows = body.items.map((line) => {
        const catalogItem = catalogMap.get(line.minibarItemId);
        if (!catalogItem) throw new Error('Unknown minibar item');
        return {
          roomId: body.roomId,
          bookingId: body.bookingId || undefined,
          minibarItemId: line.minibarItemId,
          itemName: catalogItem.name,
          quantity: line.quantity,
          unitPrice: catalogItem.price,
          recordedBy: body.recordedBy,
        };
      });

      const created = await Promise.all(rows.map((data) => db.minibarConsumption.create({ data })));
      return reply.status(201).send(ok(created, 'Consumption logged'));
    },
  });

  app.patch('/consumption/:id/billed', {
    schema: { tags: ['minibar'], summary: 'Mark a consumption entry as billed', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.minibarConsumption.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Entry not found' });
      const item = await db.minibarConsumption.update({ where: { id }, data: { billed: true } });
      return ok(item, 'Marked as billed');
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';

const itemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['LINEN', 'TOILETRIES', 'CLEANING', 'FOOD_BEVERAGE', 'MAINTENANCE', 'OFFICE', 'OTHER']),
  unit: z.string().min(1),
  currentStock: z.number().min(0),
  minimumStock: z.number().min(0),
  unitCost: z.number().min(0),
  supplier: z.string().optional(),
});

const movementSchema = z.object({
  quantity: z.number().min(0),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  reason: z.string().optional(),
});

export async function inventoryRoutes(app: FastifyInstance) {
  // GET /stats — accurate counts across all items (not just current page)
  app.get('/stats', {
    schema: { tags: ['inventory'], summary: 'Get inventory stats', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const [total, allItems] = await Promise.all([
        db.inventoryItem.count({ where: {} }),
        db.inventoryItem.findMany({
          where: {},
          select: { currentStock: true, minimumStock: true, unitCost: true },
        }),
      ]);
      const lowStockCount = allItems.filter(
        (i) => Number(i.currentStock) <= Number(i.minimumStock),
      ).length;
      const totalValue = allItems.reduce(
        (s, i) => s + Number(i.currentStock) * Number(i.unitCost),
        0,
      );
      return ok({ total, lowStockCount, totalValue });
    },
  });

  app.get('/', {
    schema: { tags: ['inventory'], summary: 'List inventory items', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; category?: string; lowStock?: string; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      // Base where: optional category + optional search
      const baseWhere = {
        ...(query.category && { category: query.category as never }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { supplier: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }),
      };

      // lowStock filter requires column-to-column comparison (currentStock <= minimumStock)
      // Prisma doesn't support this natively, so fetch all matching items and paginate in JS
      if (query.lowStock === 'true') {
        const allItems = await db.inventoryItem.findMany({
          where: baseWhere,
          orderBy: { name: 'asc' },
        });
        const lowItems = allItems.filter((i) => Number(i.currentStock) <= Number(i.minimumStock));
        const sliced = lowItems.slice(skip, skip + limit);
        return paginated(sliced, lowItems.length, page, limit);
      }

      const [items, total] = await Promise.all([
        db.inventoryItem.findMany({ where: baseWhere, skip, take: limit, orderBy: { name: 'asc' } }),
        db.inventoryItem.count({ where: baseWhere }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['inventory'], summary: 'Add inventory item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = itemSchema.parse(request.body);
      const item = await db.inventoryItem.create({ data: { ...body } });
      return reply.status(201).send(ok(item, 'Inventory item added'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['inventory'], summary: 'Update inventory item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = itemSchema.partial().parse(request.body);
      const item = await db.inventoryItem.findFirst({ where: { id } });
      if (!item) return reply.status(404).send({ success: false, error: 'Item not found' });
      const updated = await db.inventoryItem.update({ where: { id }, data: body });
      return ok(updated, 'Item updated');
    },
  });

  app.get('/:id/movements', {
    schema: { tags: ['inventory'], summary: 'Get movement history for an item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const item = await db.inventoryItem.findFirst({ where: { id } });
      if (!item) return reply.status(404).send({ success: false, error: 'Item not found' });
      const movements = await db.inventoryMovement.findMany({
        where: { inventoryItemId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return ok(movements);
    },
  });

  app.post('/:id/movement', {
    schema: { tags: ['inventory'], summary: 'Record stock movement', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = movementSchema.parse(request.body);

      const item = await db.inventoryItem.findFirst({ where: { id } });
      if (!item) return reply.status(404).send({ success: false, error: 'Item not found' });

      const newStock = body.type === 'IN'
        ? Number(item.currentStock) + body.quantity
        : body.type === 'OUT'
          ? Number(item.currentStock) - body.quantity
          : body.quantity;

      if (newStock < 0) return reply.status(400).send({ success: false, error: 'Insufficient stock' });

      const [movement] = await Promise.all([
        db.inventoryMovement.create({ data: { inventoryItemId: id, ...body } }),
        db.inventoryItem.update({ where: { id }, data: { currentStock: newStock } }),
      ]);

      return reply.status(201).send(ok(movement, 'Movement recorded'));
    },
  });
}

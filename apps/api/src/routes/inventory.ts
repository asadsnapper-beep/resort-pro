import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { TenantScopedPrisma } from '@resort-pro/database';

const itemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['LINEN', 'TOILETRIES', 'CLEANING', 'FOOD_BEVERAGE', 'MAINTENANCE', 'OFFICE', 'OTHER']),
  unit: z.string().min(1),
  currentStock: z.number().min(0),
  minimumStock: z.number().min(0),
  unitCost: z.number().min(0),
  supplier: z.string().optional(),
  vendorId: z.string().uuid().optional().nullable(),
});

const movementSchema = z.object({
  quantity: z.number().min(0),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  reason: z.string().optional(),
});

const CATEGORY_VALUES = ['LINEN', 'TOILETRIES', 'CLEANING', 'FOOD_BEVERAGE', 'MAINTENANCE', 'OFFICE', 'OTHER'] as const;

interface ItemWithDemand {
  id: string;
  currentStock: unknown;
  [key: string]: unknown;
  avgDailyUsage?: number;
  daysUntilStockout?: number | null;
}

// Attach 30-day average daily usage + estimated days-until-stockout, computed from OUT movements.
async function attachDemand(db: TenantScopedPrisma, items: ItemWithDemand[]): Promise<ItemWithDemand[]> {
  if (items.length === 0) return items;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const movements = await db.inventoryMovement.findMany({
    where: { inventoryItemId: { in: items.map((i) => i.id) }, type: 'OUT', createdAt: { gte: thirtyDaysAgo } },
    select: { inventoryItemId: true, quantity: true },
  });
  const usage = new Map<string, number>();
  for (const m of movements) usage.set(m.inventoryItemId, (usage.get(m.inventoryItemId) ?? 0) + Number(m.quantity));
  return items.map((item) => {
    const avgDailyUsage = (usage.get(item.id) ?? 0) / 30;
    const daysUntilStockout = avgDailyUsage > 0 ? Math.floor(Number(item.currentStock) / avgDailyUsage) : null;
    return { ...item, avgDailyUsage: Math.round(avgDailyUsage * 100) / 100, daysUntilStockout };
  });
}

// Notify OWNER/MANAGER users the first time an item crosses from above-minimum to at/below-minimum.
async function notifyIfCrossedLowStock(
  db: any,
  item: { id: string; name: string; minimumStock: unknown; unit: string },
  prevStock: number,
  newStock: number,
) {
  const minimum = Number(item.minimumStock);
  if (!(prevStock > minimum && newStock <= minimum)) return;
  const recipients = await db.user.findMany({ where: { role: { in: ['OWNER', 'MANAGER'] } }, select: { id: true } });
  await Promise.all(recipients.map((u: { id: string }) =>
    db.notification.create({
      data: {
        userId: u.id,
        title: 'Low stock alert',
        body: `${item.name} is at ${newStock} ${item.unit} — at or below the minimum of ${minimum} ${item.unit}.`,
        type: 'inventory_low_stock',
        data: { inventoryItemId: item.id },
      },
    }).catch(() => {}),
  ));
}

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
          include: { vendor: { select: { id: true, name: true } } },
          orderBy: { name: 'asc' },
        });
        const lowItems = allItems.filter((i) => Number(i.currentStock) <= Number(i.minimumStock));
        const sliced = await attachDemand(db, lowItems.slice(skip, skip + limit));
        return paginated(sliced, lowItems.length, page, limit);
      }

      const [items, total] = await Promise.all([
        db.inventoryItem.findMany({ where: baseWhere, skip, take: limit, orderBy: { name: 'asc' }, include: { vendor: { select: { id: true, name: true } } } }),
        db.inventoryItem.count({ where: baseWhere }),
      ]);
      return paginated(await attachDemand(db, items), total, page, limit);
    },
  });

  // GET /export — CSV download of all items
  app.get('/export', {
    schema: { tags: ['inventory'], summary: 'Export inventory as CSV', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const items = await db.inventoryItem.findMany({ orderBy: { name: 'asc' } });
      const header = 'Name,Category,Unit,Current Stock,Minimum Stock,Unit Cost,Supplier';
      const rows = items.map((i) => [
        i.name, i.category, i.unit, Number(i.currentStock), Number(i.minimumStock), Number(i.unitCost), i.supplier ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csv = [header, ...rows].join('\n');
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="inventory-export.csv"');
      return reply.send(csv);
    },
  });

  // POST /import — bulk upsert from parsed CSV rows, matched by case-insensitive name
  app.post('/import', {
    schema: { tags: ['inventory'], summary: 'Bulk import inventory items', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const body = z.object({
        rows: z.array(z.object({
          name: z.string().min(1),
          category: z.string().optional(),
          unit: z.string().optional(),
          currentStock: z.number().optional(),
          minimumStock: z.number().optional(),
          unitCost: z.number().optional(),
          supplier: z.string().optional(),
        })).min(1),
      }).parse(request.body);

      const existing = await db.inventoryItem.findMany({ select: { id: true, name: true } });
      const byName = new Map(existing.map((i) => [i.name.toLowerCase(), i.id]));

      let created = 0, updated = 0;
      const errors: string[] = [];

      for (const row of body.rows) {
        const category = CATEGORY_VALUES.includes(row.category as never) ? row.category : 'OTHER';
        const matchId = byName.get(row.name.toLowerCase());
        try {
          if (matchId) {
            await db.inventoryItem.update({
              where: { id: matchId },
              data: {
                ...(row.category && { category: category as never }),
                ...(row.unit && { unit: row.unit }),
                ...(row.currentStock !== undefined && { currentStock: row.currentStock }),
                ...(row.minimumStock !== undefined && { minimumStock: row.minimumStock }),
                ...(row.unitCost !== undefined && { unitCost: row.unitCost }),
                ...(row.supplier && { supplier: row.supplier }),
              },
            });
            updated++;
          } else {
            await db.inventoryItem.create({
              data: {
                name: row.name,
                category: category as never,
                unit: row.unit || 'pcs',
                currentStock: row.currentStock ?? 0,
                minimumStock: row.minimumStock ?? 0,
                unitCost: row.unitCost ?? 0,
                supplier: row.supplier,
              },
            });
            created++;
          }
        } catch {
          errors.push(row.name);
        }
      }

      return ok({ created, updated, errors });
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

      await notifyIfCrossedLowStock(db, item, Number(item.currentStock), newStock);

      return reply.status(201).send(ok(movement, 'Movement recorded'));
    },
  });
}

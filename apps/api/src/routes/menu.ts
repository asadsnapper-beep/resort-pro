import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';

const menuItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'APPETIZER', 'DESSERT', 'BEVERAGE', 'SPECIAL']),
  price: z.number().positive(),
  isAvailable: z.boolean().default(true),
  image: z.string().url().optional(),
});

export async function menuRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['menu'], summary: 'List menu items', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; category?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = { ...(query.category && { category: query.category as never }) };
      const [items, total] = await Promise.all([
        db.menuItem.findMany({ where, skip, take: limit, orderBy: { category: 'asc' } }),
        db.menuItem.count({ where }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['menu'], summary: 'Create menu item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = menuItemSchema.parse(request.body);
      const item = await db.menuItem.create({ data: { ...body } });
      return reply.status(201).send(ok(item, 'Menu item created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['menu'], summary: 'Update menu item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = menuItemSchema.partial().parse(request.body);
      const item = await db.menuItem.findFirst({ where: { id } });
      if (!item) return reply.status(404).send({ success: false, error: 'Menu item not found' });
      const updated = await db.menuItem.update({ where: { id }, data: body });
      return ok(updated, 'Menu item updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['menu'], summary: 'Delete menu item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const item = await db.menuItem.findFirst({ where: { id } });
      if (!item) return reply.status(404).send({ success: false, error: 'Menu item not found' });
      await db.menuItem.delete({ where: { id } });
      return ok(null, 'Menu item deleted');
    },
  });
}

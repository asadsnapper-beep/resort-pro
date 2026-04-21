import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

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
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; category?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = { tenantId, ...(query.category && { category: query.category as never }) };
      const [items, total] = await Promise.all([
        prisma.menuItem.findMany({ where, skip, take: limit, orderBy: { category: 'asc' } }),
        prisma.menuItem.count({ where }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['menu'], summary: 'Create menu item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = menuItemSchema.parse(request.body);
      const item = await prisma.menuItem.create({ data: { tenantId, ...body } });
      return reply.status(201).send(ok(item, 'Menu item created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['menu'], summary: 'Update menu item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = menuItemSchema.partial().parse(request.body);
      const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
      if (!item) return reply.status(404).send({ success: false, error: 'Menu item not found' });
      const updated = await prisma.menuItem.update({ where: { id }, data: body });
      return ok(updated, 'Menu item updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['menu'], summary: 'Delete menu item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
      if (!item) return reply.status(404).send({ success: false, error: 'Menu item not found' });
      await prisma.menuItem.delete({ where: { id } });
      return ok(null, 'Menu item deleted');
    },
  });
}

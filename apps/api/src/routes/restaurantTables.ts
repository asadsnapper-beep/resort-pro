import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';

const tableSchema = z.object({
  tableNumber: z.number().int().min(1),
  label: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
});

export async function restaurantTableRoutes(app: FastifyInstance) {
  // GET /api/restaurant/tables
  app.get('/', {
    schema: { tags: ['restaurant-tables'], summary: 'List tables', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request) => {
      const { db } = request;
      const tables = await db.restaurantTable.findMany({
        orderBy: { tableNumber: 'asc' },
        include: {
          _count: { select: { foodOrders: true } },
        },
      });
      return ok(tables);
    },
  });

  // POST /api/restaurant/tables
  app.post('/', {
    schema: { tags: ['restaurant-tables'], summary: 'Create table', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = tableSchema.parse(request.body);
      const table = await db.restaurantTable.create({ data: body as any });
      return reply.status(201).send(ok(table));
    },
  });

  // PATCH /api/restaurant/tables/:id
  app.patch('/:id', {
    schema: { tags: ['restaurant-tables'], summary: 'Update table', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = tableSchema.partial().parse(request.body);
      const table = await db.restaurantTable.update({ where: { id }, data: body });
      return ok(table);
    },
  });

  // DELETE /api/restaurant/tables/:id
  app.delete('/:id', {
    schema: { tags: ['restaurant-tables'], summary: 'Delete table', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      await db.restaurantTable.delete({ where: { id } });
      return reply.status(204).send();
    },
  });
}

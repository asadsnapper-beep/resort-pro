import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { matchAllTerms } from '../utils/search-terms';

const createSchema = z.object({
  roomId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  category: z.string().optional(),
  foundBy: z.string().optional(),
  storageLocation: z.string().optional(),
  notes: z.string().optional(),
});

const claimSchema = z.object({
  claimedBy: z.string().min(1),
  claimedContact: z.string().optional(),
});

export async function lostFoundRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['lost-found'], summary: 'List lost & found items', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; status?: string; search?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = {
        ...(query.status && { status: query.status as never }),
        ...(matchAllTerms(query.search, ['description', 'storageLocation', 'notes']) ?? {}),
      };
      const [items, total] = await Promise.all([
        db.lostFoundItem.findMany({
          where, skip, take: limit, orderBy: { foundDate: 'desc' },
          include: { room: { select: { name: true, number: true } } },
        }),
        db.lostFoundItem.count({ where }),
      ]);
      return paginated(items, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['lost-found'], summary: 'Log a found item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = createSchema.parse(request.body);
      const item = await db.lostFoundItem.create({ data: body });
      return reply.status(201).send(ok(item, 'Item logged'));
    },
  });

  app.patch('/:id/claim', {
    schema: { tags: ['lost-found'], summary: 'Mark item claimed by guest', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = claimSchema.parse(request.body);
      const existing = await db.lostFoundItem.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Item not found' });
      const item = await db.lostFoundItem.update({
        where: { id },
        data: { status: 'CLAIMED', claimedBy: body.claimedBy, claimedContact: body.claimedContact, claimedDate: new Date() },
      });
      return ok(item, 'Marked as claimed');
    },
  });

  app.patch('/:id/dispose', {
    schema: { tags: ['lost-found'], summary: 'Mark item disposed', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.lostFoundItem.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Item not found' });
      const item = await db.lostFoundItem.update({ where: { id }, data: { status: 'DISPOSED' } });
      return ok(item, 'Marked as disposed');
    },
  });
}

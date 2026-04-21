import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const guestSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  idType: z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'OTHER']).optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function guestRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['guests'], summary: 'List all guests', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        tenantId,
        ...(query.search && {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' as never } },
            { lastName: { contains: query.search, mode: 'insensitive' as never } },
            { email: { contains: query.search, mode: 'insensitive' as never } },
          ],
        }),
      };

      const [guests, total] = await Promise.all([
        prisma.guest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.guest.count({ where }),
      ]);

      return paginated(guests, total, page, limit);
    },
  });

  app.get('/:id', {
    schema: { tags: ['guests'], summary: 'Get guest by ID', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const guest = await prisma.guest.findFirst({
        where: { id, tenantId },
        include: { bookings: { include: { room: { select: { name: true, number: true } } }, orderBy: { createdAt: 'desc' }, take: 10 } },
      });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
      return ok(guest);
    },
  });

  app.post('/', {
    schema: { tags: ['guests'], summary: 'Create a guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = guestSchema.parse(request.body);

      const existing = await prisma.guest.findFirst({ where: { tenantId, email: body.email } });
      if (existing) return reply.status(409).send({ success: false, error: 'Guest with this email already exists' });

      const guest = await prisma.guest.create({ data: { tenantId, ...body } });
      return reply.status(201).send(ok(guest, 'Guest created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['guests'], summary: 'Update guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = guestSchema.partial().parse(request.body);
      const guest = await prisma.guest.findFirst({ where: { id, tenantId } });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
      const updated = await prisma.guest.update({ where: { id }, data: body });
      return ok(updated, 'Guest updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['guests'], summary: 'Delete guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const guest = await prisma.guest.findFirst({ where: { id, tenantId } });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
      await prisma.guest.delete({ where: { id } });
      return ok(null, 'Guest deleted');
    },
  });
}

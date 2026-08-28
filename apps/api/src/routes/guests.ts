import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { matchAllTerms } from '../utils/search-terms';

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
  dateOfBirth: z.string().optional().nullable(), // ISO date string e.g. "1990-05-15"
});

export async function guestRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['guests'], summary: 'List all guests', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      // Every word must match some field, rather than one word matching one
      // field — otherwise a full name like "Karim Hossain" matches nothing,
      // which is exactly what a global-search result hands this page.
      const where = { ...(matchAllTerms(query.search, ['firstName', 'lastName', 'email', 'phone']) ?? {}) };

      const [guests, total] = await Promise.all([
        db.guest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        db.guest.count({ where }),
      ]);

      return paginated(guests, total, page, limit);
    },
  });

  app.get('/:id', {
    schema: { tags: ['guests'], summary: 'Get guest by ID', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const guest = await db.guest.findFirst({
        where: { id },
        include: { bookings: { include: { room: { select: { name: true, number: true } } }, orderBy: { createdAt: 'desc' }, take: 10 } },
      });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
      return ok(guest);
    },
  });

  app.post('/', {
    schema: { tags: ['guests'], summary: 'Create a guest', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = guestSchema.parse(request.body);

      const existing = await db.guest.findFirst({ where: { email: body.email } });
      if (existing) return reply.status(409).send({ success: false, error: 'Guest with this email already exists' });

      const guest = await db.guest.create({
        data: {
          ...body,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        },
      });
      return reply.status(201).send(ok(guest, 'Guest created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['guests'], summary: 'Update guest', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = guestSchema.partial().parse(request.body);
      const guest = await db.guest.findFirst({ where: { id } });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });

      // If email is being changed, ensure it's not already taken by another guest
      if (body.email && body.email !== guest.email) {
        const conflict = await db.guest.findFirst({ where: { email: body.email } });
        if (conflict) return reply.status(409).send({ success: false, error: 'Another guest with this email already exists' });
      }

      const { dateOfBirth, ...rest } = body;
      const updated = await db.guest.update({
        where: { id },
        data: {
          ...rest,
          ...(dateOfBirth !== undefined && {
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          }),
        },
      });
      return ok(updated, 'Guest updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['guests'], summary: 'Delete guest', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const guest = await db.guest.findFirst({ where: { id } });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });

      // Block delete if guest has active bookings
      const activeBookings = await db.booking.count({
        where: { guestId: id, status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] } },
      });
      if (activeBookings > 0) {
        return reply.status(409).send({
          success: false,
          error: `Cannot delete guest — they have ${activeBookings} active booking${activeBookings > 1 ? 's' : ''}. Check out or cancel their bookings first.`,
        });
      }

      await db.guest.delete({ where: { id } });
      return ok(null, 'Guest deleted');
    },
  });
}

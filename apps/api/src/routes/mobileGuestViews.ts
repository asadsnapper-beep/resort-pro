import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from '@resort-pro/types';
import { requireRole } from '../middleware/auth';
import { matchAllTerms } from '../utils/search-terms';
import { ok, paginated, parsePageParams } from '../utils/response';

/** Narrow, read-only projections for the Android guest and booking screens. */
export async function mobileGuestViewRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
  });
  const frontDesk = requireRole('OWNER', 'MANAGER', 'RECEPTIONIST');
  // The shared middleware validates the signed token's role; also check the
  // current DB role so a downgraded user's still-valid token cannot retain
  // mobile access (or owner-only payment fields) until token expiry.
  const currentRole = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub, tenantId, role } = request.user as JwtPayload;
    const account = await request.db.user.findFirst({ where: { id: sub, tenantId }, select: { role: true } });
    if (!account || account.role !== role) return reply.status(403).send({ success: false, error: 'Permissions changed; sign in again' });
  };
  app.post('/guests/search', {
    preHandler: [frontDesk, currentRole],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const query = (request.body ?? {}) as { search?: string; page?: number; limit?: number };
      const search = typeof query.search === 'string' ? query.search.trim() : '';
      if (search.length < 2 || search.length > 100) return reply.status(400).send({ success: false, error: 'Search must contain 2 to 100 characters' });
      const { page, limit, skip } = parsePageParams(query);
      const where = { tenantId, ...(matchAllTerms(search, ['firstName', 'lastName', 'phone']) ?? {}) };
      const [guests, total] = await Promise.all([
        request.db.guest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, firstName: true, lastName: true, phone: true } }),
        request.db.guest.count({ where }),
      ]);
      return paginated(guests, total, page, limit);
    },
  });

  app.get<{ Params: { id: string } }>('/guests/:id', {
    preHandler: [frontDesk, currentRole],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const guest = await request.db.guest.findFirst({
        where: { id: request.params.id, tenantId },
        select: {
          id: true, firstName: true, lastName: true, phone: true, email: true,
          bookings: { where: { tenantId, room: { tenantId } }, orderBy: { createdAt: 'desc' }, take: 10,
            select: { id: true, confirmationNo: true, status: true, checkIn: true, checkOut: true, room: { select: { number: true, name: true } } } },
        },
      });
      if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
      return ok(guest);
    },
  });

  app.get<{ Params: { id: string } }>('/bookings/:id', {
    preHandler: [frontDesk, currentRole],
    handler: async (request, reply) => {
      const { tenantId, role } = request.user as JwtPayload;
      // Receptionists need individual booking payment details for front desk;
      // aggregate financial reports remain separately restricted.
      const financial = role === 'OWNER' || role === 'MANAGER' || role === 'RECEPTIONIST';
      const booking = await request.db.booking.findFirst({
        where: { id: request.params.id, tenantId, guest: { tenantId }, room: { tenantId } },
        select: {
          id: true, confirmationNo: true, status: true, checkIn: true, checkOut: true, adults: true, children: true,
          guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true, name: true } },
          ...(financial ? { paymentStatus: true, totalAmount: true, paidAmount: true } : {}),
        },
      });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      return ok(booking);
    },
  });
}

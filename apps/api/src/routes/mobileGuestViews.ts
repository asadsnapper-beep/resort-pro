import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from '@resort-pro/types';
import { requireRole } from '../middleware/auth';
import { matchAllTerms } from '../utils/search-terms';
import { ok, paginated, parsePageParams } from '../utils/response';

/**
 * Narrow, read-only projections for the Android guest and booking screens.
 *
 * Every query here passes `tenantId` explicitly as well as going through
 * `request.db`, which is `tenantPrisma(tenantId)` and injects the same filter
 * on its own. That is deliberate and it is not redundant in the way it looks:
 * removing the explicit filters breaks no test, because the scoped client
 * already covers them — which is exactly why they are written down. They say
 * what the query depends on, so a future change to `request.db`, or a slip to
 * bare `prisma`, cannot quietly widen the result. Measured: dropping
 * `tenantId` from the booking lookup leaves both test files passing.
 */
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
      const { tenantId } = request.user as JwtPayload;
      // Every role this route admits — Owner, Manager and Receptionist — sees a
      // booking's own payment summary. A receptionist settling a folio at the
      // desk needs it, and that is the owner's stated policy. What stays out of
      // reach is *aggregate* finance: revenue, occupancy and expense reporting
      // live behind their own endpoints, and nothing here returns a total
      // across bookings.
      //
      // Written flat rather than as `role === 'OWNER' || …`, which read like a
      // second gate and was one: the `frontDesk` preHandler already admits
      // exactly those three roles, so the condition could never be false. A
      // dead branch here is worse than none — the next person to widen the
      // gate would assume this line still protected the payment fields.
      const booking = await request.db.booking.findFirst({
        where: { id: request.params.id, tenantId, guest: { tenantId }, room: { tenantId } },
        select: {
          id: true, confirmationNo: true, status: true, checkIn: true, checkOut: true, adults: true, children: true,
          guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true, name: true } },
          paymentStatus: true, totalAmount: true, paidAmount: true,
        },
      });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      return ok(booking);
    },
  });
}

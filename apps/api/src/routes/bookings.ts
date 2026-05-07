import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import { generateConfirmationNo, calculateNights } from '../utils/booking';
import { sendEmail } from '../services/email';
import { createGuestPaymentLink } from './billing';
import type { JwtPayload } from '@resort-pro/types';

const createBookingSchema = z.object({
  roomId: z.string().uuid(),
  guestId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
});

export async function bookingRoutes(app: FastifyInstance) {
  // GET /api/bookings
  app.get('/', {
    schema: {
      tags: ['bookings'],
      summary: 'List all bookings',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        tenantId,
        ...(query.status && { status: query.status as never }),
      };

      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
            room: { select: { number: true, name: true, type: true } },
            payments: { select: { amount: true, method: true, status: true, processedAt: true } },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      return paginated(bookings, total, page, limit);
    },
  });

  // GET /api/bookings/calendar
  app.get('/calendar', {
    schema: { tags: ['bookings'], summary: 'Get booking calendar view', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const { month, year } = request.query as { month?: string; year?: string };

      const targetYear = Number(year) || new Date().getFullYear();
      const targetMonth = Number(month) || new Date().getMonth() + 1;

      const start = new Date(targetYear, targetMonth - 1, 1);
      const end = new Date(targetYear, targetMonth, 0);

      const bookings = await prisma.booking.findMany({
        where: {
          tenantId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          OR: [
            { checkIn: { gte: start, lte: end } },
            { checkOut: { gte: start, lte: end } },
            { checkIn: { lte: start }, checkOut: { gte: end } },
          ],
        },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          room: { select: { number: true, name: true, type: true } },
        },
      });

      return ok(bookings);
    },
  });

  // GET /api/bookings/:id
  app.get('/:id', {
    schema: { tags: ['bookings'], summary: 'Get booking by ID', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
        include: {
          guest: true,
          room: true,
          payments: true,
          foodOrders: { include: { items: { include: { menuItem: true } } } },
          supportTickets: true,
        },
      });

      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      return ok(booking);
    },
  });

  // POST /api/bookings
  app.post('/', {
    schema: { tags: ['bookings'], summary: 'Create a new booking', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = createBookingSchema.parse(request.body);

      const checkInDate = new Date(body.checkIn);
      const checkOutDate = new Date(body.checkOut);

      if (checkOutDate <= checkInDate) {
        return reply.status(400).send({ success: false, error: 'Check-out must be after check-in' });
      }

      // Check room exists and belongs to tenant
      const room = await prisma.room.findFirst({ where: { id: body.roomId, tenantId, isActive: true } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      // Check room availability
      const conflict = await prisma.booking.findFirst({
        where: {
          tenantId,
          roomId: body.roomId,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          checkIn: { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
      });

      if (conflict) {
        return reply.status(409).send({ success: false, error: 'Room is not available for the selected dates' });
      }

      const nights = calculateNights(checkInDate, checkOutDate);
      const totalAmount = Number(room.basePrice) * nights;

      const booking = await prisma.booking.create({
        data: {
          tenantId,
          roomId: body.roomId,
          guestId: body.guestId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: body.adults,
          children: body.children,
          totalAmount,
          specialRequests: body.specialRequests,
          notes: body.notes,
          confirmationNo: generateConfirmationNo(),
          status: 'CONFIRMED',
        },
        include: {
          guest: { select: { firstName: true, lastName: true, email: true } },
          room: { select: { number: true, name: true } },
        },
      });

      // Send confirmation email to guest (fire-and-forget)
      if (booking.guest?.email) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, currency: true } });
        const currency = tenant?.currency || 'USD';
        const checkInFmt = checkInDate.toDateString();
        const checkOutFmt = checkOutDate.toDateString();
        sendEmail({
          to: booking.guest.email,
          subject: `Booking Confirmed — ${booking.confirmationNo}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <div style="background:#1a6b5e;padding:32px;text-align:center;border-radius:8px 8px 0 0">
                <h1 style="color:white;margin:0;font-size:24px">Booking Confirmed ✓</h1>
                <p style="color:#a8d5cf;margin:8px 0 0">${tenant?.name || 'ResortPro'}</p>
              </div>
              <div style="background:#f9fafb;padding:32px;border-radius:0 0 8px 8px">
                <p>Dear ${booking.guest.firstName},</p>
                <p>Your booking has been confirmed. Here are your details:</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr style="border-bottom:1px solid #e5e7eb">
                    <td style="padding:10px 0;color:#6b7280;font-size:14px">Confirmation No.</td>
                    <td style="padding:10px 0;font-weight:700;font-size:18px;color:#1a6b5e;text-align:right">${booking.confirmationNo}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e5e7eb">
                    <td style="padding:10px 0;color:#6b7280;font-size:14px">Room</td>
                    <td style="padding:10px 0;font-weight:600;text-align:right">${booking.room.name} (${booking.room.number})</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e5e7eb">
                    <td style="padding:10px 0;color:#6b7280;font-size:14px">Check-in</td>
                    <td style="padding:10px 0;font-weight:600;text-align:right">${checkInFmt}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e5e7eb">
                    <td style="padding:10px 0;color:#6b7280;font-size:14px">Check-out</td>
                    <td style="padding:10px 0;font-weight:600;text-align:right">${checkOutFmt}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e5e7eb">
                    <td style="padding:10px 0;color:#6b7280;font-size:14px">Nights</td>
                    <td style="padding:10px 0;font-weight:600;text-align:right">${nights}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;font-size:14px">Total Amount</td>
                    <td style="padding:10px 0;font-weight:700;font-size:18px;color:#d4a853;text-align:right">${currency} ${totalAmount.toLocaleString()}</td>
                  </tr>
                </table>
                ${booking.specialRequests ? `<p style="background:#fff;border:1px solid #e5e7eb;padding:12px;border-radius:6px;font-size:14px"><strong>Special Requests:</strong> ${booking.specialRequests}</p>` : ''}
                <p style="color:#6b7280;font-size:13px;margin-top:24px">Please keep your confirmation number handy at check-in. We look forward to welcoming you!</p>
              </div>
            </div>
          `,
        }).catch(() => {}); // don't let email failure block the response
      }

      return reply.status(201).send(ok(booking, 'Booking created'));
    },
  });

  // PATCH /api/bookings/:id/check-in
  app.patch('/:id/check-in', {
    schema: { tags: ['bookings'], summary: 'Check in a guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      if (booking.status !== 'CONFIRMED') {
        return reply.status(400).send({ success: false, error: 'Booking must be confirmed to check in' });
      }

      const [updated] = await Promise.all([
        prisma.booking.update({ where: { id }, data: { status: 'CHECKED_IN' } }),
        prisma.room.update({ where: { id: booking.roomId }, data: { status: 'OCCUPIED' } }),
      ]);

      return ok(updated, 'Guest checked in');
    },
  });

  // PATCH /api/bookings/:id/check-out
  app.patch('/:id/check-out', {
    schema: { tags: ['bookings'], summary: 'Check out a guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      if (booking.status !== 'CHECKED_IN') {
        return reply.status(400).send({ success: false, error: 'Guest must be checked in to check out' });
      }

      const [updated] = await Promise.all([
        prisma.booking.update({ where: { id }, data: { status: 'CHECKED_OUT' } }),
        prisma.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } }),
        prisma.housekeepingTask.create({
          data: {
            tenantId,
            roomId: booking.roomId,
            type: 'CHECKOUT',
            status: 'PENDING',
            scheduledDate: new Date(),
          },
        }),
      ]);

      return ok(updated, 'Guest checked out');
    },
  });

  // PATCH /api/bookings/:id/cancel
  app.patch('/:id/cancel', {
    schema: { tags: ['bookings'], summary: 'Cancel a booking', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
        return reply.status(400).send({ success: false, error: 'Cannot cancel this booking' });
      }

      const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
      return ok(updated, 'Booking cancelled');
    },
  });

  // POST /api/bookings/:id/payment
  app.post('/:id/payment', {
    schema: { tags: ['bookings'], summary: 'Record a payment', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { amount, method, reference } = request.body as { amount: number; method: string; reference?: string };

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });

      const payment = await prisma.payment.create({
        data: {
          tenantId,
          bookingId: id,
          amount,
          method: method as never,
          status: 'PAID',
          reference,
          processedAt: new Date(),
        },
      });

      const newPaid = Number(booking.paidAmount) + amount;
      const paymentStatus = newPaid >= Number(booking.totalAmount) ? 'PAID' : 'PARTIAL';

      await prisma.booking.update({ where: { id }, data: { paidAmount: newPaid, paymentStatus: paymentStatus as never } });

      return reply.status(201).send(ok(payment, 'Payment recorded'));
    },
  });

  // POST /api/bookings/:id/payment-link — generate Stripe payment link for guest
  app.post('/:id/payment-link', {
    schema: { tags: ['bookings'], summary: 'Generate guest payment link', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
        include: {
          guest: { select: { firstName: true, lastName: true, email: true } },
          room: { select: { name: true, number: true } },
          tenant: { select: { currency: true, name: true } },
        },
      });

      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      if (booking.paymentStatus === 'PAID') {
        return reply.status(400).send({ success: false, error: 'Booking is already fully paid' });
      }
      if (!booking.guest.email) {
        return reply.status(400).send({ success: false, error: 'Guest has no email address' });
      }

      // Amount remaining to be paid
      const remaining = Number(booking.totalAmount) - Number(booking.paidAmount);

      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
        return reply.status(400).send({
          success: false,
          error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to environment variables.',
        });
      }

      const { url, sessionId } = await createGuestPaymentLink({
        booking: {
          id: booking.id,
          confirmationNo: booking.confirmationNo,
          totalAmount: remaining,
          tenantId,
        },
        guest: {
          firstName: booking.guest.firstName,
          lastName: booking.guest.lastName,
          email: booking.guest.email,
        },
        roomName: `${booking.room.name} (#${booking.room.number})`,
        currency: booking.tenant.currency,
      });

      // Save link to booking
      await prisma.booking.update({
        where: { id },
        data: { stripePaymentLinkId: sessionId, paymentLinkUrl: url },
      });

      // Email the link to the guest
      sendEmail({
        to: booking.guest.email,
        subject: `Payment link for your booking at ${booking.tenant.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#1a6b5e">Complete Your Payment</h2>
            <p>Hi ${booking.guest.firstName},</p>
            <p>Your booking <strong>${booking.confirmationNo}</strong> at <strong>${booking.tenant.name}</strong> has an outstanding balance.</p>
            <p style="font-size:24px;font-weight:bold;color:#1a6b5e">Amount Due: ${booking.tenant.currency} ${remaining.toFixed(2)}</p>
            <a href="${url}" style="display:inline-block;background:#1a6b5e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Pay Now</a>
            <p style="color:#666;font-size:12px">This link expires in 24 hours. Use test card: <strong>4242 4242 4242 4242</strong>, any future date, any CVC.</p>
          </div>
        `,
      }).catch(() => {});

      return reply.send({ success: true, data: { url, sessionId, amount: remaining } });
    },
  });
}

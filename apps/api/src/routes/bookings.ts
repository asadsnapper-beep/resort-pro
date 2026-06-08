import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import { generateConfirmationNo, calculateNights } from '../utils/booking';
import { sendEmail } from '../services/email';
import {
  sendBookingConfirmation,
  sendCheckoutEmail,
  sendCancellationEmail,
} from '../utils/guest-emails';
import { awardCheckoutPoints } from '../services/loyalty';
import { syncCalendarsForRoom } from '../jobs/ical-sync';
import { createGuestPaymentLink } from './billing';
import type { JwtPayload } from '@resort-pro/types';

/* ── Auto-create invoice when a booking is confirmed ────────────────────── */
async function autoCreateInvoice(bookingId: string, tenantId: string) {
  try {
    // Skip if invoice already exists
    const existing = await prisma.invoice.findFirst({ where: { bookingId } });
    if (existing) return;

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        guest: true, room: true,
        invoiceExtras: true,
        bookingPackages: { include: { package: true } },
      },
    });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const nights = Math.max(1, Math.ceil(
      (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    ));

    const lineItems: { description: string; category: string; quantity: number; unitPrice: number; total: number }[] = [
      {
        description: `${booking.room.name} — ${nights} night${nights > 1 ? 's' : ''} (${new Date(booking.checkIn).toLocaleDateString()} → ${new Date(booking.checkOut).toLocaleDateString()})`,
        category: 'ROOM',
        quantity: nights,
        unitPrice: booking.room.basePrice,
        total: booking.room.basePrice * nights,
      },
    ];

    booking.invoiceExtras.forEach(e => {
      const amt = Number(e.amount);
      lineItems.push({ description: e.description, category: 'SERVICE', quantity: e.quantity, unitPrice: amt, total: e.quantity * amt });
    });
    booking.bookingPackages.forEach(bp => {
      lineItems.push({ description: bp.package.name, category: 'SERVICE', quantity: 1, unitPrice: bp.price, total: bp.price });
    });

    const taxRate  = tenant.taxRate ?? 0;
    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
    const taxAmt   = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total    = subtotal + taxAmt;

    // Generate invoice number
    const year  = new Date().getFullYear();
    const count = await prisma.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

    await prisma.invoice.create({
      data: {
        invoiceNumber, tenantId, bookingId,
        guestName:  `${booking.guest.firstName} ${booking.guest.lastName}`,
        guestEmail: booking.guest.email ?? undefined,
        guestPhone: booking.guest.phone ?? undefined,
        status: 'DRAFT',
        subtotal, taxRate, taxAmount: taxAmt, discountAmt: 0, total,
        items: { create: lineItems },
      },
    });
  } catch {
    // Non-critical — don't fail booking creation
  }
}

const createBookingSchema = z.object({
  roomId: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['DIRECT', 'WALK_IN', 'PHONE', 'OTA', 'ONLINE']).default('DIRECT'),
  skipEmail: z.boolean().optional().default(false),
  autoCheckIn: z.boolean().optional().default(false),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE']).optional(),
  // Walk-in guest fields (when guestId not provided)
  guestFirstName: z.string().optional(),
  guestLastName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
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

  // GET /api/bookings/gantt?from=YYYY-MM-DD&to=YYYY-MM-DD  (Gantt / room-grid view)
  app.get('/gantt', {
    schema: { tags: ['bookings'], summary: 'Gantt calendar — rooms × dates', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const { from, to } = request.query as { from?: string; to?: string };

      const start = from ? new Date(from) : (() => {
        const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d;
      })();
      const end = to ? new Date(to) : new Date(start.getTime() + 29 * 86_400_000);
      end.setHours(23, 59, 59, 999);

      // All rooms for this tenant
      const rooms = await prisma.room.findMany({
        where: { tenantId },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        select: {
          id: true, number: true, name: true, type: true,
          status: true, floor: true, basePrice: true, maxOccupancy: true,
        },
      });

      // All overlapping bookings in range
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
          guest: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { checkIn: 'asc' },
      });

      // Group bookings by roomId
      const bookingsByRoom = new Map<string, typeof bookings>();
      for (const b of bookings) {
        if (!bookingsByRoom.has(b.roomId)) bookingsByRoom.set(b.roomId, []);
        bookingsByRoom.get(b.roomId)!.push(b);
      }

      const result = rooms.map(room => ({
        ...room,
        bookings: (bookingsByRoom.get(room.id) ?? []).map(b => ({
          id: b.id,
          confirmationNumber: b.confirmationNumber,
          guestName: `${b.guest.firstName} ${b.guest.lastName}`,
          guestId: b.guest.id,
          checkIn: b.checkIn.toISOString().slice(0, 10),
          checkOut: b.checkOut.toISOString().slice(0, 10),
          nights: Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000),
          status: b.status,
          totalAmount: b.totalAmount,
          adults: b.adults,
          children: b.children,
        })),
      }));

      // Build date array for the header
      const dates: string[] = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
      }

      return ok({ rooms: result, dates, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
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

      // Layer 1: sync-before-book — if room has external iCal feeds, refresh them NOW
      // before checking availability so we have the latest data from OTAs.
      // Rooms with no external calendars skip this entirely (zero overhead).
      const externalCalendars = await prisma.externalCalendar.findMany({
        where: { roomId: body.roomId, tenantId, isActive: true },
      });
      if (externalCalendars.length > 0) {
        await syncCalendarsForRoom(body.roomId, externalCalendars);
      }

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
        const reason = conflict.externalSource
          ? `Room is already booked via ${conflict.externalSource} for these dates`
          : 'Room is not available for the selected dates';
        return reply.status(409).send({ success: false, error: reason });
      }

      // Resolve or create guest
      let guestId = body.guestId;
      if (!guestId) {
        // Walk-in: create/find guest by name+phone
        if (!body.guestFirstName || !body.guestLastName) {
          return reply.status(400).send({ success: false, error: 'Guest name is required for walk-in bookings' });
        }
        const email = body.guestEmail ?? `walkin-${Date.now()}@resortpro.local`;
        const existing = body.guestEmail
          ? await prisma.guest.findFirst({ where: { tenantId, email } })
          : null;
        const guest = existing ?? await prisma.guest.create({
          data: {
            tenantId,
            firstName: body.guestFirstName,
            lastName: body.guestLastName,
            email,
            phone: body.guestPhone,
          },
        });
        guestId = guest.id;
      }

      const nights = calculateNights(checkInDate, checkOutDate);
      const totalAmount = Number(room.basePrice) * nights;
      const now = new Date();

      const booking = await prisma.booking.create({
        data: {
          tenantId,
          roomId: body.roomId,
          guestId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: body.adults,
          children: body.children,
          totalAmount,
          specialRequests: body.specialRequests,
          notes: body.notes,
          confirmationNo: generateConfirmationNo(),
          status: body.autoCheckIn ? 'CHECKED_IN' : 'CONFIRMED',
          source: body.source,
          actualCheckIn: body.autoCheckIn ? now : undefined,
        },
        include: {
          guest: { select: { firstName: true, lastName: true, email: true } },
          room: { select: { number: true, name: true } },
        },
      });

      // If auto check-in, mark room as OCCUPIED
      if (body.autoCheckIn) {
        await prisma.room.update({ where: { id: body.roomId }, data: { status: 'OCCUPIED' } });
      }

      // Record initial payment if provided
      if (body.paymentMethod && body.paymentMethod !== 'ONLINE') {
        await prisma.payment.create({
          data: {
            tenantId,
            bookingId: booking.id,
            amount: totalAmount,
            method: body.paymentMethod === 'CARD' ? 'CREDIT_CARD' : body.paymentMethod as 'CASH' | 'BANK_TRANSFER',
            status: 'COMPLETED',
            processedAt: now,
          },
        });
        await prisma.booking.update({ where: { id: booking.id }, data: { paidAmount: totalAmount, paymentStatus: 'PAID' } });
      }

      // Send confirmation email (skip for walk-in if opted out)
      if (!body.skipEmail) {
        sendBookingConfirmation(booking.id).catch(() => {});
      }

      // Auto-generate invoice draft (fire-and-forget)
      autoCreateInvoice(booking.id, tenantId).catch(() => {});

      return reply.status(201).send(ok(booking, 'Booking created'));
    },
  });

  // PATCH /api/bookings/:id/check-in
  app.patch('/:id/check-in', {
    schema: { tags: ['bookings'], summary: 'Check in a guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId, sub: checkedInByStaff } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = z.object({
        deposit:   z.number().optional(),
        roomNotes: z.string().optional(),
        roomId:    z.string().optional(), // override room assignment
      }).parse(request.body ?? {});

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      if (booking.status !== 'CONFIRMED') {
        return reply.status(400).send({ success: false, error: 'Booking must be confirmed to check in' });
      }

      const roomId = body.roomId ?? booking.roomId;
      const now = new Date();

      const [updated] = await Promise.all([
        prisma.booking.update({
          where: { id },
          data: {
            status:       'CHECKED_IN',
            actualCheckIn: now,
            checkedInBy:  checkedInByStaff,
            roomId,
            deposit:      body.deposit,
            roomNotes:    body.roomNotes,
          },
          include: {
            guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
            room:  { select: { number: true, name: true, type: true } },
            payments: { select: { amount: true, method: true, status: true, processedAt: true } },
          },
        }),
        prisma.room.update({ where: { id: roomId }, data: { status: 'OCCUPIED' } }),
        // Record deposit payment if provided
        ...(body.deposit
          ? [prisma.payment.create({
              data: {
                tenantId,
                bookingId: id,
                amount:    body.deposit,
                method:    'CASH',
                status:    'PAID',
                processedAt: now,
                notes:     'Deposit collected at check-in',
              },
            })]
          : []),
      ]);

      return ok(updated, 'Guest checked in');
    },
  });

  // PATCH /api/bookings/:id/check-out
  app.patch('/:id/check-out', {
    schema: { tags: ['bookings'], summary: 'Check out a guest', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId, sub: checkedOutByStaff } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = z.object({
        additionalPayment: z.number().optional(), // extra amount collected at checkout
        paymentMethod:     z.enum(['CASH', 'CARD', 'BANK_TRANSFER']).optional(),
      }).parse(request.body ?? {});

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
      if (booking.status !== 'CHECKED_IN') {
        return reply.status(400).send({ success: false, error: 'Guest must be checked in to check out' });
      }

      const now = new Date();

      const [foodAgg] = await Promise.all([
        prisma.foodOrder.aggregate({
          where: { bookingId: id, status: { notIn: ['CANCELLED'] } },
          _sum: { totalAmount: true },
        }),
      ]);
      const foodTotal = Number(foodAgg._sum.totalAmount ?? 0);

      const ops: Promise<unknown>[] = [
        prisma.booking.update({
          where: { id },
          data: { status: 'CHECKED_OUT', actualCheckOut: now, checkedOutBy: checkedOutByStaff },
          include: {
            guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
            room:  { select: { number: true, name: true, type: true } },
            payments: { select: { amount: true, method: true, status: true, processedAt: true } },
          },
        }),
        prisma.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } }),
        prisma.housekeepingTask.create({
          data: { tenantId, roomId: booking.roomId, type: 'CHECKOUT', status: 'PENDING', scheduledDate: now },
        }),
      ];

      // Record additional checkout payment if provided
      if (body.additionalPayment && body.additionalPayment > 0) {
        const method = (body.paymentMethod ?? 'CASH') as 'CASH' | 'CARD' | 'BANK_TRANSFER';
        ops.push(
          prisma.payment.create({
            data: { tenantId, bookingId: id, amount: body.additionalPayment, method, status: 'PAID', processedAt: now },
          }),
          prisma.booking.update({
            where: { id },
            data: { paidAmount: { increment: body.additionalPayment } },
          }),
        );
      }

      const [updated] = await Promise.all(ops) as Awaited<typeof ops>;

      const nights = Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000);
      const grandTotal = Number(booking.totalAmount) + foodTotal;
      const paidAfter  = Number(booking.paidAmount) + (body.additionalPayment ?? 0);

      sendCheckoutEmail(id).catch(() => {});
      awardCheckoutPoints(id).catch(() => {});

      return ok({
        ...(updated as object),
        checkoutSummary: {
          nights,
          roomTotal:  Number(booking.totalAmount),
          foodTotal,
          grandTotal,
          paidAmount: paidAfter,
          balanceDue: Math.max(0, grandTotal - paidAfter),
        },
      }, 'Guest checked out');
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

      // Send cancellation email (fire-and-forget)
      sendCancellationEmail(id).catch(() => {});

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

  // ── Invoice routes ─────────────────────────────────────────────────────────

  // GET /api/bookings/:id/invoice  — compute invoice data
  app.get('/:id/invoice', {
    schema: { tags: ['bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
        include: {
          guest: true,
          room: true,
          payments: { where: { status: 'COMPLETED' } },
          foodOrders: { include: { items: { include: { menuItem: true } } } },
          invoiceExtras: { orderBy: { createdAt: 'asc' } },
          tenant: { select: { name: true, email: true, phone: true, address: true, currency: true, taxRate: true } },
        },
      });
      if (!booking) return reply.status(404).send({ error: 'Booking not found' });

      const nights = calculateNights(booking.checkIn, booking.checkOut);
      const roomTotal = Number(booking.room.basePrice) * nights;
      const foodTotal = booking.foodOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const extrasTotal = booking.invoiceExtras.reduce((sum, e) => sum + e.amount * e.quantity, 0);
      const subtotal = roomTotal + foodTotal + extrasTotal;
      const taxAmount = subtotal * ((booking.tenant.taxRate ?? 0) / 100);
      const grandTotal = subtotal + taxAmount;
      const paidAmount = booking.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balanceDue = grandTotal - paidAmount;

      return reply.send({
        success: true,
        data: {
          booking: {
            id: booking.id,
            confirmationNo: booking.confirmationNo,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            actualCheckIn: booking.actualCheckIn,
            actualCheckOut: booking.actualCheckOut,
            status: booking.status,
            adults: booking.adults,
            children: booking.children,
            invoiceNumber: booking.invoiceNumber,
            invoiceSentAt: booking.invoiceSentAt,
          },
          guest: booking.guest,
          room: { id: booking.room.id, name: booking.room.name, number: booking.room.number, basePrice: booking.room.basePrice },
          tenant: booking.tenant,
          lineItems: {
            room: { description: `Room ${booking.room.name} (${nights} nights × ${booking.tenant.currency} ${Number(booking.room.basePrice).toFixed(2)})`, amount: roomTotal, nights },
            food: booking.foodOrders.flatMap(o => o.items.map(i => ({
              description: i.menuItem.name,
              quantity: i.quantity,
              unitPrice: Number(i.unitPrice),
              amount: i.quantity * Number(i.unitPrice),
            }))),
            extras: booking.invoiceExtras.map(e => ({ id: e.id, description: e.description, quantity: e.quantity, amount: e.amount, total: e.amount * e.quantity })),
          },
          summary: {
            roomTotal,
            foodTotal,
            extrasTotal,
            subtotal,
            taxRate: booking.tenant.taxRate ?? 0,
            taxAmount,
            grandTotal,
            paidAmount,
            balanceDue,
          },
          payments: booking.payments,
        },
      });
    },
  });

  // POST /api/bookings/:id/invoice/extras  — add a manual charge
  app.post('/:id/invoice/extras', {
    schema: { tags: ['bookings'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as { description: string; amount: number; quantity?: number };

      const booking = await prisma.booking.findFirst({ where: { id, tenantId } });
      if (!booking) return reply.status(404).send({ error: 'Booking not found' });

      const extra = await prisma.invoiceExtra.create({
        data: {
          tenantId,
          bookingId: id,
          description: body.description,
          amount: body.amount,
          quantity: body.quantity ?? 1,
        },
      });
      return reply.send({ success: true, data: extra });
    },
  });

  // DELETE /api/bookings/:id/invoice/extras/:extraId  — remove a manual charge
  app.delete('/:id/invoice/extras/:extraId', {
    schema: { tags: ['bookings'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { id, extraId } = request.params as { id: string; extraId: string };
      const { tenantId } = request.user as JwtPayload;

      await prisma.invoiceExtra.deleteMany({ where: { id: extraId, bookingId: id, tenantId } });
      return reply.send({ success: true });
    },
  });

  // POST /api/bookings/:id/invoice/send-email  — email invoice to guest
  app.post('/:id/invoice/send-email', {
    schema: { tags: ['bookings'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;

      const booking = await prisma.booking.findFirst({
        where: { id, tenantId },
        include: {
          guest: true,
          room: true,
          payments: { where: { status: 'COMPLETED' } },
          foodOrders: { include: { items: { include: { menuItem: true } } } },
          invoiceExtras: true,
          tenant: { select: { name: true, email: true, currency: true, taxRate: true } },
        },
      });
      if (!booking) return reply.status(404).send({ error: 'Booking not found' });

      const nights = calculateNights(booking.checkIn, booking.checkOut);
      const roomTotal = Number(booking.room.basePrice) * nights;
      const foodTotal = booking.foodOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const extrasTotal = booking.invoiceExtras.reduce((sum, e) => sum + e.amount * e.quantity, 0);
      const subtotal = roomTotal + foodTotal + extrasTotal;
      const taxAmount = subtotal * ((booking.tenant.taxRate ?? 0) / 100);
      const grandTotal = subtotal + taxAmount;
      const paidAmount = booking.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balanceDue = grandTotal - paidAmount;
      const cur = booking.tenant.currency;
      const fmt = (n: number) => `${cur} ${n.toFixed(2)}`;

      // Generate invoice number if not yet assigned
      const invoiceNumber = booking.invoiceNumber ?? `INV-${booking.confirmationNo}`;
      await prisma.booking.update({ where: { id }, data: { invoiceNumber, invoiceSentAt: new Date() } });

      const foodRows = booking.foodOrders.flatMap(o => o.items).map(i =>
        `<tr><td style="padding:4px 8px">${i.menuItem.name} ×${i.quantity}</td><td style="padding:4px 8px;text-align:right">${fmt(i.quantity * Number(i.unitPrice))}</td></tr>`
      ).join('');
      const extraRows = booking.invoiceExtras.map(e =>
        `<tr><td style="padding:4px 8px">${e.description} ×${e.quantity}</td><td style="padding:4px 8px;text-align:right">${fmt(e.amount * e.quantity)}</td></tr>`
      ).join('');

      const html = `
        <div style="font-family:sans-serif;max-width:650px;margin:0 auto;padding:24px;color:#1a1a1a">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#1a6b5e;margin:0">${booking.tenant.name}</h1>
            <p style="color:#888;margin:4px 0">Invoice / Folio</p>
          </div>

          <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#888;padding:2px 0">Invoice #</td><td style="font-weight:bold">${invoiceNumber}</td></tr>
              <tr><td style="color:#888;padding:2px 0">Guest</td><td>${booking.guest.firstName} ${booking.guest.lastName}</td></tr>
              <tr><td style="color:#888;padding:2px 0">Room</td><td>${booking.room.name} (#${booking.room.number})</td></tr>
              <tr><td style="color:#888;padding:2px 0">Check-in</td><td>${new Date(booking.checkIn).toDateString()}</td></tr>
              <tr><td style="color:#888;padding:2px 0">Check-out</td><td>${new Date(booking.checkOut).toDateString()}</td></tr>
              <tr><td style="color:#888;padding:2px 0">Confirmation</td><td>${booking.confirmationNo}</td></tr>
            </table>
          </div>

          <table style="width:100%;border-collapse:collapse;border-top:2px solid #1a6b5e">
            <thead>
              <tr style="background:#1a6b5e;color:#fff">
                <th style="padding:8px;text-align:left">Description</th>
                <th style="padding:8px;text-align:right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:4px 8px">Room: ${booking.room.name} (${nights}n × ${fmt(Number(booking.room.basePrice))})</td><td style="padding:4px 8px;text-align:right">${fmt(roomTotal)}</td></tr>
              ${foodRows}
              ${extraRows}
              ${booking.tenant.taxRate ? `<tr style="border-top:1px solid #eee"><td style="padding:4px 8px;color:#888">Tax (${booking.tenant.taxRate}%)</td><td style="padding:4px 8px;text-align:right;color:#888">${fmt(taxAmount)}</td></tr>` : ''}
              <tr style="background:#f0faf8;font-weight:bold;border-top:2px solid #1a6b5e">
                <td style="padding:8px">Total</td>
                <td style="padding:8px;text-align:right">${fmt(grandTotal)}</td>
              </tr>
              <tr><td style="padding:4px 8px;color:#10b981">Paid</td><td style="padding:4px 8px;text-align:right;color:#10b981">- ${fmt(paidAmount)}</td></tr>
              <tr style="font-weight:bold;font-size:18px;color:${balanceDue > 0 ? '#ef4444' : '#10b981'}">
                <td style="padding:8px">Balance Due</td>
                <td style="padding:8px;text-align:right">${fmt(balanceDue)}</td>
              </tr>
            </tbody>
          </table>

          <p style="color:#888;font-size:12px;text-align:center;margin-top:32px">Thank you for staying at ${booking.tenant.name}!</p>
        </div>
      `;

      await sendEmail({ to: booking.guest.email, subject: `Invoice ${invoiceNumber} — ${booking.tenant.name}`, html });

      return reply.send({ success: true, data: { invoiceNumber, sentTo: booking.guest.email } });
    },
  });

  // POST /api/bookings/walk-in — create booking + immediately check in
  app.post('/walk-in', {
    schema: { tags: ['bookings'], summary: 'Create walk-in booking and check in', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId, sub: staffId } = request.user as JwtPayload;
      const body = z.object({
        guestName:     z.string().min(1),
        guestPhone:    z.string().optional(),
        adults:        z.number().int().min(1).default(1),
        children:      z.number().int().min(0).default(0),
        roomId:        z.string(),
        checkIn:       z.string(), // YYYY-MM-DD
        checkOut:      z.string(), // YYYY-MM-DD
        ratePerNight:  z.number().optional(), // override room base price
        discount:      z.number().min(0).max(100).default(0), // percentage
        paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'LATER']).default('CASH'),
        advanceAmount: z.number().optional(),
        roomNotes:     z.string().optional(),
      }).parse(request.body);

      const checkInDate  = new Date(body.checkIn);
      const checkOutDate = new Date(body.checkOut);
      if (checkOutDate <= checkInDate) {
        return reply.status(400).send({ success: false, error: 'Check-out must be after check-in' });
      }

      const room = await prisma.room.findFirst({ where: { id: body.roomId, tenantId, isActive: true } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      // Sync iCal before booking if external calendars exist
      const externalCalendars = await prisma.externalCalendar.findMany({
        where: { roomId: body.roomId, tenantId, isActive: true },
      });
      if (externalCalendars.length > 0) await syncCalendarsForRoom(body.roomId, externalCalendars);

      const conflict = await prisma.booking.findFirst({
        where: {
          tenantId, roomId: body.roomId,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          checkIn: { lt: checkOutDate }, checkOut: { gt: checkInDate },
        },
      });
      if (conflict) return reply.status(409).send({ success: false, error: 'Room is not available for these dates' });

      // Create or find guest
      const [firstName, ...rest] = body.guestName.trim().split(' ');
      const lastName = rest.join(' ') || '-';
      const email    = `walkin-${Date.now()}@resortpro.local`;
      const guest    = await prisma.guest.create({
        data: { tenantId, firstName, lastName, email, phone: body.guestPhone },
      });

      const nights      = calculateNights(checkInDate, checkOutDate);
      const rate        = body.ratePerNight ?? Number(room.basePrice);
      const rawTotal    = rate * nights;
      const totalAmount = rawTotal * (1 - body.discount / 100);
      const now         = new Date();

      const booking = await prisma.booking.create({
        data: {
          tenantId,
          roomId:       body.roomId,
          guestId:      guest.id,
          checkIn:      checkInDate,
          checkOut:     checkOutDate,
          adults:       body.adults,
          children:     body.children,
          totalAmount,
          confirmationNo: generateConfirmationNo(),
          status:       'CHECKED_IN',
          actualCheckIn: now,
          checkedInBy:  staffId,
          walkIn:       true,
          roomNotes:    body.roomNotes,
          source:       'WALK_IN',
        },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true } },
          room:  { select: { number: true, name: true, type: true } },
        },
      });

      await prisma.room.update({ where: { id: body.roomId }, data: { status: 'OCCUPIED' } });

      // Record advance payment
      if (body.paymentMethod !== 'LATER' && body.advanceAmount && body.advanceAmount > 0) {
        const method = (body.paymentMethod ?? 'CASH') as 'CASH' | 'CARD' | 'BANK_TRANSFER';
        await prisma.payment.create({
          data: { tenantId, bookingId: booking.id, amount: body.advanceAmount, method, status: 'PAID', processedAt: now },
        });
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paidAmount: body.advanceAmount, paymentStatus: body.advanceAmount >= totalAmount ? 'PAID' : 'PARTIAL' },
        });
      }

      autoCreateInvoice(booking.id, tenantId).catch(() => {});

      return reply.status(201).send({ success: true, data: booking, message: 'Walk-in guest checked in' });
    },
  });
}

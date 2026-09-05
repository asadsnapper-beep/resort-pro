import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import type { JwtPayload } from '@resort-pro/types';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';

const orderSchema = z.object({
  bookingId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
  settlement: z.enum(['PAY_NOW', 'CHARGE_TO_ROOM', 'COMPLIMENTARY', 'CORPORATE']).optional(),
  // Restaurant floors lose connectivity. A client that never saw its order
  // acknowledged replays the same key rather than guessing whether it landed.
  idempotencyKey: z.string().uuid().optional(),
  items: z.array(z.object({ menuItemId: z.string().uuid(), quantity: z.number().int().min(1), notes: z.string().optional() })).min(1),
});

const orderWithItems = { items: { include: { menuItem: true } } } as const;

export async function foodOrderRoutes(app: FastifyInstance) {
  // GET /api/food-orders/stats — accurate counts by status
  app.get('/stats', {
    schema: { tags: ['food-orders'], summary: 'Get order stats by status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request) => {
      const { db } = request;
      const [pending, preparing, ready, delivered, cancelled, total] = await Promise.all([
        db.foodOrder.count({ where: { status: 'PENDING' } }),
        db.foodOrder.count({ where: { status: 'PREPARING' } }),
        db.foodOrder.count({ where: { status: 'READY' } }),
        db.foodOrder.count({ where: { status: 'DELIVERED' } }),
        db.foodOrder.count({ where: { status: 'CANCELLED' } }),
        db.foodOrder.count({ where: {} }),
      ]);
      return ok({ total, pending, preparing, ready, delivered, cancelled });
    },
  });

  app.get('/', {
    schema: { tags: ['food-orders'], summary: 'List food orders', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; status?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = { ...(query.status && { status: query.status as never }) };
      const [orders, total] = await Promise.all([
        db.foodOrder.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: { select: { name: true, price: true } } } }, guest: { select: { firstName: true, lastName: true } } },
        }),
        db.foodOrder.count({ where }),
      ]);
      return paginated(orders, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['food-orders'], summary: 'Place a food order', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = orderSchema.parse(request.body);

      // A bookingId with no settlement has only ever meant one thing: the
      // order rides on that stay's invoice at checkout. Reading it as
      // CHARGE_TO_ROOM keeps existing callers working and puts a name on what
      // they were already doing.
      const settlement = body.settlement ?? (body.bookingId ? 'CHARGE_TO_ROOM' : 'PAY_NOW');

      if (settlement === 'COMPLIMENTARY' || settlement === 'CORPORATE') {
        // Both need billing work that does not exist yet: a comped order must
        // be kept off the guest's folio, and a corporate one belongs on the
        // company's invoice. Accepting them now would quietly bill the guest.
        return reply.status(400).send({
          success: false,
          error: 'Only paying now or charging to a room is available yet',
        });
      }
      if (settlement === 'CHARGE_TO_ROOM' && !body.bookingId) {
        return reply.status(400).send({ success: false, error: 'Select the stay this order should be charged to' });
      }
      if (settlement === 'PAY_NOW' && body.bookingId) {
        return reply.status(400).send({ success: false, error: 'An order being paid for now cannot also be charged to a stay' });
      }

      // A replay of an order the client already sent: return what was created
      // the first time rather than a second order.
      if (body.idempotencyKey) {
        const already = await db.foodOrder.findFirst({
          where: { idempotencyKey: body.idempotencyKey },
          include: orderWithItems,
        });
        if (already) return ok(already, 'Order already placed');
      }

      // Deduplicate IDs before lookup (duplicate menuItemIds in request would give wrong count)
      const uniqueIds = [...new Set(body.items.map((i) => i.menuItemId))];
      const menuItems = await db.menuItem.findMany({
        where: { id: { in: uniqueIds } },
      });

      if (menuItems.length !== uniqueIds.length) {
        return reply.status(400).send({ success: false, error: 'One or more menu items not found' });
      }

      // Block ordering unavailable items
      const unavailable = menuItems.filter((m) => !m.isAvailable);
      if (unavailable.length > 0) {
        return reply.status(400).send({
          success: false,
          error: `Not available: ${unavailable.map((m) => m.name).join(', ')}`,
        });
      }

      const totalAmount = body.items.reduce((sum, item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
        return sum + Number(menuItem.price) * item.quantity;
      }, 0);

      try {
        // The stay is re-checked inside the transaction that creates the order:
        // a guest can check out between the waiter opening the picker and the
        // order being sent, and the client is not trusted either way.
        // Tenant scoping does not survive into a transaction, so every query
        // here carries tenantId itself.
        const order = await prisma.$transaction(async (tx) => {
          let guestId = body.guestId ?? null;
          let tableNumber = body.tableNumber ?? null;

          if (settlement === 'CHARGE_TO_ROOM') {
            const booking = await tx.booking.findFirst({
              where: { id: body.bookingId, tenantId },
              select: { id: true, status: true, guestId: true, room: { select: { number: true } } },
            });
            if (!booking) {
              throw Object.assign(new Error('That stay was not found'), { statusCode: 400 });
            }
            if (booking.status !== 'CHECKED_IN') {
              throw Object.assign(
                new Error(`Only a guest who is checked in can charge to the room — this stay is ${booking.status.toLowerCase().replace(/_/g, ' ')}`),
                { statusCode: 400 },
              );
            }
            if (body.guestId && body.guestId !== booking.guestId) {
              throw Object.assign(new Error('That guest is not the one staying in this room'), { statusCode: 400 });
            }
            const finalized = await tx.invoice.findFirst({
              where: { tenantId, bookingId: booking.id, finalizedAt: { not: null } },
              select: { id: true },
            });
            if (finalized) {
              throw Object.assign(new Error('This stay has already been billed'), { statusCode: 400 });
            }

            // Room and guest come from the stay, never from the request. A
            // typed room number is a label that can be wrong, and a room move
            // would leave it stale while the money still follows the booking.
            guestId = booking.guestId;
            tableNumber = booking.room ? `Room ${booking.room.number}` : null;
          }

          // paymentStatus defaults to PENDING (schema default) — no money has
          // actually been collected yet at order time. A CHARGE_TO_ROOM order
          // rides on the booking's own invoice at checkout; a walk-in/table
          // order needs an explicit "mark as paid" once cash/card is actually
          // collected (see PATCH /:id/payment below).
          return tx.foodOrder.create({
            data: {
              tenantId,
              bookingId: settlement === 'PAY_NOW' ? null : body.bookingId,
              guestId,
              tableNumber,
              settlement,
              idempotencyKey: body.idempotencyKey ?? null,
              notes: body.notes,
              totalAmount,
              items: {
                create: body.items.map((item) => {
                  const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
                  return { menuItemId: item.menuItemId, quantity: item.quantity, unitPrice: menuItem.price, notes: item.notes };
                }),
              },
            },
            include: orderWithItems,
          });
        });

        return reply.status(201).send(ok(order, 'Order placed'));
      } catch (err) {
        const e = err as { statusCode?: number; message?: string; code?: string };
        if (e.statusCode === 400) return reply.status(400).send({ success: false, error: e.message });
        // Two replays arriving at once: the unique index picks a winner, and
        // the loser answers with the order the winner created.
        if (e.code === 'P2002' && body.idempotencyKey) {
          const already = await db.foodOrder.findFirst({
            where: { idempotencyKey: body.idempotencyKey },
            include: orderWithItems,
          });
          if (already) return ok(already, 'Order already placed');
        }
        throw err;
      }
    },
  });

  app.patch('/:id/status', {
    schema: { tags: ['food-orders'], summary: 'Update order status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']),
      }).parse(request.body);
      const order = await db.foodOrder.findFirst({ where: { id } });
      if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
      const updated = await db.foodOrder.update({ where: { id }, data: { status: status as never } });
      return ok(updated, 'Order status updated');
    },
  });

  // PATCH /api/food-orders/:id/payment — record that a walk-in/table order
  // was actually paid for (cash/card at the counter). Room-service orders
  // (bookingId set) don't need this — they're already tracked via the
  // booking's own invoice/payment flow at checkout (see GET /bookings/:id/invoice).
  app.patch('/:id/payment', {
    schema: { tags: ['food-orders'], summary: 'Mark an order as paid', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { method } = z.object({
        method: z.enum([
          'CASH', 'CARD', 'BANK_TRANSFER', 'OTHER',
          'BKASH', 'NAGAD', 'SSLCOMMERZ', 'ROCKET',
          'RAZORPAY', 'CASHFREE', 'PAYHERE',
        ]),
      }).parse(request.body);

      const order = await db.foodOrder.findFirst({ where: { id } });
      if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
      if (order.status === 'CANCELLED') {
        return reply.status(400).send({ success: false, error: 'Cannot mark a cancelled order as paid' });
      }

      const updated = await db.foodOrder.update({
        where: { id },
        data: { paymentStatus: 'PAID', paymentMethod: method as never },
      });
      return ok(updated, 'Order marked as paid');
    },
  });
}

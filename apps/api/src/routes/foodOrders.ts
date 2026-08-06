import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';

const orderSchema = z.object({
  bookingId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({ menuItemId: z.string().uuid(), quantity: z.number().int().min(1), notes: z.string().optional() })).min(1),
});

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
      const body = orderSchema.parse(request.body);

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

      // paymentStatus defaults to PENDING (schema default) — no money has
      // actually been collected yet at order time. A room-service order
      // (bookingId set) rides on the booking's own invoice/payment at
      // checkout; a walk-in/table order needs an explicit "mark as paid"
      // once cash/card is actually collected (see PATCH /:id/payment below).
      const order = await db.foodOrder.create({
        data: {
          bookingId: body.bookingId,
          guestId: body.guestId,
          tableNumber: body.tableNumber,
          notes: body.notes,
          totalAmount,
          items: {
            create: body.items.map((item) => {
              const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
              return { menuItemId: item.menuItemId, quantity: item.quantity, unitPrice: menuItem.price, notes: item.notes };
            }),
          },
        } as any,
        include: { items: { include: { menuItem: true } } },
      });

      return reply.status(201).send(ok(order, 'Order placed'));
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

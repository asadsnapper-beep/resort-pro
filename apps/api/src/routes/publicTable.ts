import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok } from '../utils/response';
import { prisma } from '@resort-pro/database';

const orderSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1),
    notes: z.string().optional(),
  })).min(1),
  notes: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'SSLCOMMERZ', 'STRIPE']).default('CASH'),
  customerName: z.string().optional(),
});

export async function publicTableRoutes(app: FastifyInstance) {
  // GET /table/:slug/:tableNumber — menu + tenant info (no auth)
  app.get('/:slug/:tableNumber', {
    schema: { tags: ['public-table'], summary: 'Get menu for table' },
    handler: async (request, reply) => {
      const { slug, tableNumber } = request.params as { slug: string; tableNumber: string };
      const tableNum = parseInt(tableNumber, 10);
      if (isNaN(tableNum)) return reply.status(400).send({ success: false, error: 'Invalid table number' });

      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, name: true, currency: true, logoUrl: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Restaurant not found' });

      const table = await prisma.restaurantTable.findUnique({
        where: { tenantId_tableNumber: { tenantId: tenant.id, tableNumber: tableNum } },
        select: { id: true, tableNumber: true, label: true, isActive: true },
      });
      if (!table || !table.isActive) return reply.status(404).send({ success: false, error: 'Table not found or inactive' });

      const menuItems = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, isAvailable: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, description: true, category: true, price: true, image: true },
      });

      return ok({ tenant, table, menuItems });
    },
  });

  // POST /table/:slug/:tableNumber/order — place order (cash: direct; gateway: create intent)
  app.post('/:slug/:tableNumber/order', {
    schema: { tags: ['public-table'], summary: 'Place table order' },
    handler: async (request, reply) => {
      const { slug, tableNumber } = request.params as { slug: string; tableNumber: string };
      const tableNum = parseInt(tableNumber, 10);
      const body = orderSchema.parse(request.body);

      const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, currency: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Restaurant not found' });

      const table = await prisma.restaurantTable.findUnique({
        where: { tenantId_tableNumber: { tenantId: tenant.id, tableNumber: tableNum } },
      });
      if (!table || !table.isActive) return reply.status(404).send({ success: false, error: 'Table not found' });

      // Fetch menu items to calculate total
      const menuItemIds = body.items.map(i => i.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds }, tenantId: tenant.id, isAvailable: true },
      });
      if (menuItems.length !== menuItemIds.length) {
        return reply.status(400).send({ success: false, error: 'One or more items are unavailable' });
      }

      const priceMap = new Map(menuItems.map(m => [m.id, Number(m.price)]));
      const totalAmount = body.items.reduce((sum, i) => sum + priceMap.get(i.menuItemId)! * i.quantity, 0);

      // For cash: create order as PENDING payment, staff will confirm
      // For gateway: create order with PENDING, return payment intent info
      const isCash = body.paymentMethod === 'CASH';

      const order = await prisma.foodOrder.create({
        data: {
          tenantId: tenant.id,
          restaurantTableId: table.id,
          tableNumber: String(tableNum),
          status: 'PENDING',
          paymentStatus: isCash ? 'PENDING' : 'PENDING',
          paymentMethod: body.paymentMethod as never,
          totalAmount,
          notes: body.notes,
          items: {
            create: body.items.map(i => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: priceMap.get(i.menuItemId)!,
              notes: i.notes,
            })),
          },
        },
        include: { items: { include: { menuItem: { select: { name: true } } } } },
      });

      // Cash order: immediately goes to KDS (staff takes cash at delivery)
      if (isCash) {
        await prisma.foodOrder.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID' },
        });
        return reply.status(201).send(ok({ order, paymentRequired: false }));
      }

      // Gateway order: return order id for frontend to handle payment
      return reply.status(201).send(ok({ order, paymentRequired: true, totalAmount }));
    },
  });

  // POST /table/payment/verify — after gateway callback, mark order paid
  app.post('/payment/verify', {
    schema: { tags: ['public-table'], summary: 'Verify payment and activate order' },
    handler: async (request, reply) => {
      const { orderId, gatewayPaymentId } = request.body as { orderId: string; gatewayPaymentId: string };
      if (!orderId) return reply.status(400).send({ success: false, error: 'orderId required' });

      const order = await prisma.foodOrder.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID', gatewayPaymentId, status: 'PENDING' },
      });
      return ok(order);
    },
  });

  // GET /table/order/:orderId/status — tablet polls this every 5s for "food ready" alert
  app.get('/order/:orderId/status', {
    schema: { tags: ['public-table'], summary: 'Poll order status' },
    handler: async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await prisma.foodOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, paymentStatus: true, tableNumber: true, updatedAt: true },
      });
      if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
      return ok(order);
    },
  });
}

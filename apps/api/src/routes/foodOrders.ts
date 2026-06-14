import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

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
      const { tenantId } = request.user as JwtPayload;
      const [pending, preparing, ready, delivered, cancelled, total] = await Promise.all([
        prisma.foodOrder.count({ where: { tenantId, status: 'PENDING' } }),
        prisma.foodOrder.count({ where: { tenantId, status: 'PREPARING' } }),
        prisma.foodOrder.count({ where: { tenantId, status: 'READY' } }),
        prisma.foodOrder.count({ where: { tenantId, status: 'DELIVERED' } }),
        prisma.foodOrder.count({ where: { tenantId, status: 'CANCELLED' } }),
        prisma.foodOrder.count({ where: { tenantId } }),
      ]);
      return ok({ total, pending, preparing, ready, delivered, cancelled });
    },
  });

  app.get('/', {
    schema: { tags: ['food-orders'], summary: 'List food orders', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = { tenantId, ...(query.status && { status: query.status as never }) };
      const [orders, total] = await Promise.all([
        prisma.foodOrder.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { items: { include: { menuItem: { select: { name: true, price: true } } } }, guest: { select: { firstName: true, lastName: true } } },
        }),
        prisma.foodOrder.count({ where }),
      ]);
      return paginated(orders, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['food-orders'], summary: 'Place a food order', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = orderSchema.parse(request.body);

      // Deduplicate IDs before lookup (duplicate menuItemIds in request would give wrong count)
      const uniqueIds = [...new Set(body.items.map((i) => i.menuItemId))];
      const menuItems = await prisma.menuItem.findMany({
        where: { tenantId, id: { in: uniqueIds } },
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

      const order = await prisma.foodOrder.create({
        data: {
          tenantId,
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
        },
        include: { items: { include: { menuItem: true } } },
      });

      return reply.status(201).send(ok(order, 'Order placed'));
    },
  });

  app.patch('/:id/status', {
    schema: { tags: ['food-orders'], summary: 'Update order status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']),
      }).parse(request.body);
      const order = await prisma.foodOrder.findFirst({ where: { id, tenantId } });
      if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
      const updated = await prisma.foodOrder.update({ where: { id }, data: { status: status as never } });
      return ok(updated, 'Order status updated');
    },
  });
}

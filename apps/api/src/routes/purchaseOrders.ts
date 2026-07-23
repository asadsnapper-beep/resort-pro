import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { prisma, type TenantScopedPrisma } from '@resort-pro/database';

const createSchema = z.object({
  vendorId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    inventoryItemId: z.string().uuid(),
    quantityOrdered: z.number().positive(),
    unitCost: z.number().min(0),
  })).min(1),
});

const receiveSchema = z.object({
  items: z.array(z.object({
    inventoryItemId: z.string().uuid(),
    quantityReceived: z.number().min(0),
  })).min(1),
});

async function nextPoNumber(db: TenantScopedPrisma): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.purchaseOrder.count({ where: { poNumber: { startsWith: `PO-${year}-` } } });
  return `PO-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function purchaseOrderRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['purchase-orders'], summary: 'List purchase orders', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { status?: string };
      const orders = await db.purchaseOrder.findMany({
        where: { ...(query.status && { status: query.status }) },
        include: {
          vendor: { select: { name: true } },
          items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return ok(orders.map((o) => ({
        id: o.id, poNumber: o.poNumber, status: o.status, notes: o.notes,
        vendorName: o.vendor.name, itemCount: o.items.length,
        totalCost: o.items.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0),
        sentAt: o.sentAt, receivedAt: o.receivedAt, createdAt: o.createdAt,
      })));
    },
  });

  app.get('/:id', {
    schema: { tags: ['purchase-orders'], summary: 'Get purchase order detail', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const order = await db.purchaseOrder.findUnique({
        where: { id },
        include: {
          vendor: true,
          items: { include: { inventoryItem: { select: { name: true, unit: true, currentStock: true } } } },
        },
      });
      if (!order) return reply.status(404).send({ success: false, error: 'Purchase order not found' });
      return ok(order);
    },
  });

  app.post('/', {
    schema: { tags: ['purchase-orders'], summary: 'Create purchase order (DRAFT)', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = createSchema.parse(request.body);

      const vendor = await db.vendor.findUnique({ where: { id: body.vendorId } });
      if (!vendor) return reply.status(404).send({ success: false, error: 'Vendor not found' });

      const poNumber = await nextPoNumber(db);
      const order = await db.purchaseOrder.create({
        data: {
          vendorId: body.vendorId,
          poNumber,
          notes: body.notes,
          items: { create: body.items.map((i) => ({ inventoryItemId: i.inventoryItemId, quantityOrdered: i.quantityOrdered, unitCost: i.unitCost })) },
        },
      });
      return reply.status(201).send(ok(order, `Purchase order ${poNumber} created`));
    },
  });

  app.patch('/:id/send', {
    schema: { tags: ['purchase-orders'], summary: 'Mark PO as sent to vendor', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Purchase order not found' });
      if (existing.status !== 'DRAFT') return reply.status(400).send({ success: false, error: 'Only DRAFT orders can be marked as sent' });
      const order = await db.purchaseOrder.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
      return ok(order, 'Purchase order marked as sent');
    },
  });

  app.post('/:id/receive', {
    schema: { tags: ['purchase-orders'], summary: 'Receive purchase order — updates stock', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = receiveSchema.parse(request.body);

      const order = await db.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
      if (!order) return reply.status(404).send({ success: false, error: 'Purchase order not found' });
      if (order.status === 'RECEIVED') return reply.status(400).send({ success: false, error: 'Already received' });
      if (order.status === 'CANCELLED') return reply.status(400).send({ success: false, error: 'Order was cancelled' });

      for (const line of body.items) {
        const poItem = order.items.find((i) => i.inventoryItemId === line.inventoryItemId);
        if (!poItem || line.quantityReceived <= 0) continue;

        const item = await db.inventoryItem.findUnique({ where: { id: line.inventoryItemId } });
        if (!item) continue;

        await Promise.all([
          db.inventoryMovement.create({
            data: { inventoryItemId: line.inventoryItemId, quantity: line.quantityReceived, type: 'IN', reason: `Received from PO ${order.poNumber}` },
          }),
          db.inventoryItem.update({ where: { id: line.inventoryItemId }, data: { currentStock: Number(item.currentStock) + line.quantityReceived } }),
          // PurchaseOrderItem has no tenantId column (like FoodOrderItem, InvoiceItem).
          // tenantPrisma's $allModels middleware injects tenantId into every model's where
          // clause — including nested relation updates — so it must be written through the
          // raw, unscoped client. Safe here: poItem.id came from `order`, already fetched
          // through the tenant-scoped `db`, so it's proven to belong to this tenant.
          prisma.purchaseOrderItem.update({ where: { id: poItem.id }, data: { quantityReceived: line.quantityReceived } }),
        ]);
      }

      const updated = await db.purchaseOrder.update({ where: { id }, data: { status: 'RECEIVED', receivedAt: new Date() } });
      return ok(updated, 'Stock updated from purchase order');
    },
  });

  app.patch('/:id/cancel', {
    schema: { tags: ['purchase-orders'], summary: 'Cancel a draft/sent PO', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.purchaseOrder.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Purchase order not found' });
      if (existing.status === 'RECEIVED') return reply.status(400).send({ success: false, error: 'Cannot cancel a received order' });
      const order = await db.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      return ok(order, 'Purchase order cancelled');
    },
  });
}

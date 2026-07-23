import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';

const vendorSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export async function vendorRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['vendors'], summary: 'List vendors', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const vendors = await db.vendor.findMany({
        where: { isActive: true },
        include: { _count: { select: { items: true, purchaseOrders: true } } },
        orderBy: { name: 'asc' },
      });
      return ok(vendors);
    },
  });

  app.post('/', {
    schema: { tags: ['vendors'], summary: 'Add vendor', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = vendorSchema.parse(request.body);
      const vendor = await db.vendor.create({ data: { ...body, email: body.email || undefined } });
      return reply.status(201).send(ok(vendor, 'Vendor added'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['vendors'], summary: 'Update vendor', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = vendorSchema.partial().extend({ isActive: z.boolean().optional() }).parse(request.body);
      const existing = await db.vendor.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Vendor not found' });
      const vendor = await db.vendor.update({ where: { id }, data: { ...body, email: body.email || undefined } });
      return ok(vendor, 'Vendor updated');
    },
  });
}

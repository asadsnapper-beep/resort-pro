import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function tenantRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['tenant'], summary: 'Get tenant/resort settings', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true, plan: true, phone: true, email: true, website: true, address: true, currency: true, timezone: true, checkInTime: true, checkOutTime: true, logoUrl: true, createdAt: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      return ok(tenant);
    },
  });

  app.patch('/', {
    schema: { tags: ['tenant'], summary: 'Update resort settings', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const body = updateTenantSchema.parse(request.body);
      const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: body });
      return ok(tenant, 'Settings updated');
    },
  });
}

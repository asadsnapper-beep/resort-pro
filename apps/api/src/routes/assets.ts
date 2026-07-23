import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { TenantScopedPrisma } from '@resort-pro/database';

const ASSET_CATEGORIES = ['FURNITURE', 'ELECTRONICS', 'APPLIANCE', 'KITCHEN_EQUIPMENT', 'VEHICLE', 'IT_EQUIPMENT', 'OTHER'] as const;
const ASSET_STATUSES = ['IN_USE', 'IN_REPAIR', 'IN_STORAGE', 'RETIRED'] as const;

const assetSchema = z.object({
  name: z.string().min(1),
  category: z.enum(ASSET_CATEGORIES),
  status: z.enum(ASSET_STATUSES).optional(),
  condition: z.enum(['GOOD', 'FAIR', 'POOR']).optional(),
  locationRoomId: z.string().uuid().optional().nullable(),
  locationLabel: z.string().optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  warrantyExpiresAt: z.string().datetime().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

const logSchema = z.object({
  type: z.enum(['SERVICE', 'REPAIR', 'INSPECTION']),
  cost: z.number().min(0).optional(),
  performedBy: z.string().optional(),
  notes: z.string().optional(),
});

async function nextAssetTag(db: TenantScopedPrisma): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.asset.count({ where: { assetTag: { startsWith: `AST-${year}-` } } });
  return `AST-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function assetRoutes(app: FastifyInstance) {
  app.get('/stats', {
    schema: { tags: ['assets'], summary: 'Get asset stats', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const [total, inRepair, all] = await Promise.all([
        db.asset.count({ where: { status: { not: 'RETIRED' } } }),
        db.asset.count({ where: { status: 'IN_REPAIR' } }),
        db.asset.findMany({ where: { status: { not: 'RETIRED' } }, select: { purchasePrice: true } }),
      ]);
      const totalValue = all.reduce((s, a) => s + (a.purchasePrice ?? 0), 0);
      return ok({ total, inRepair, totalValue });
    },
  });

  app.get('/', {
    schema: { tags: ['assets'], summary: 'List assets', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; category?: string; status?: string; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        ...(query.category && { category: query.category as never }),
        ...(query.status && { status: query.status as never }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { assetTag: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [assets, total] = await Promise.all([
        db.asset.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: { locationRoom: { select: { name: true, number: true } }, vendor: { select: { id: true, name: true } } },
        }),
        db.asset.count({ where }),
      ]);
      return paginated(assets, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['assets'], summary: 'Add asset', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = assetSchema.parse(request.body);
      const assetTag = await nextAssetTag(db);
      const asset = await db.asset.create({
        data: {
          ...body,
          assetTag,
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
          warrantyExpiresAt: body.warrantyExpiresAt ? new Date(body.warrantyExpiresAt) : undefined,
        },
      });
      return reply.status(201).send(ok(asset, `Asset ${assetTag} added`));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['assets'], summary: 'Update asset', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = assetSchema.partial().parse(request.body);
      const existing = await db.asset.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Asset not found' });
      const asset = await db.asset.update({
        where: { id },
        data: {
          ...body,
          ...(body.purchaseDate !== undefined && { purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null }),
          ...(body.warrantyExpiresAt !== undefined && { warrantyExpiresAt: body.warrantyExpiresAt ? new Date(body.warrantyExpiresAt) : null }),
        },
      });
      return ok(asset, 'Asset updated');
    },
  });

  // AssetMaintenanceLog has no tenantId column (like FoodOrderItem/PurchaseOrderItem) — tenantPrisma's
  // $allModels middleware injects tenantId into every model's where/data, including direct calls on
  // child models without that column. Reads/writes go through the tenant-scoped Asset via include/nested
  // create instead, so the injection only ever touches Asset (which does have tenantId).
  app.get('/:id/logs', {
    schema: { tags: ['assets'], summary: 'Get maintenance history for an asset', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const asset = await db.asset.findUnique({ where: { id }, include: { maintenanceLogs: { orderBy: { createdAt: 'desc' } } } });
      if (!asset) return reply.status(404).send({ success: false, error: 'Asset not found' });
      return ok(asset.maintenanceLogs);
    },
  });

  app.post('/:id/logs', {
    schema: { tags: ['assets'], summary: 'Log a maintenance/repair entry', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = logSchema.parse(request.body);
      const existing = await db.asset.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Asset not found' });
      const updated = await db.asset.update({
        where: { id },
        data: { maintenanceLogs: { create: body } },
        include: { maintenanceLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      return reply.status(201).send(ok(updated.maintenanceLogs[0], 'Maintenance logged'));
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { withQuota, PROPERTY_QUOTA, PlanLimitReached } from '../utils/entitlement';
import type { JwtPayload } from '@resort-pro/types';

const propertySchema = z.object({
  name:         z.string().min(1).max(100),
  slug:         z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  type:         z.enum(['ROOM_BASED', 'VESSEL_BASED']).optional(),
  address:      z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().email().optional().or(z.literal('')),
  timezone:     z.string().optional(),
  checkInTime:  z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function propertyRoutes(app: FastifyInstance) {
  /* ── GET /api/properties ─────────────────────────────────────────────── */
  app.get('/', {
    schema: { tags: ['properties'], summary: 'List properties', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;

      const q = request.query as { page?: number; limit?: number };
      const { page, limit, skip } = parsePageParams(q);

      const [properties, total] = await Promise.all([
        db.property.findMany({
          where: { tenantId },
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { rooms: true } },
            rooms: { where: { isActive: true }, select: { status: true } },
          },
        }),
        db.property.count({ where: { tenantId } }),
      ]);

      // Compute per-property room status breakdown
      const withStats = properties.map(p => {
        const statusCounts = p.rooms.reduce((acc: Record<string, number>, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        }, {});
        const { rooms: _rooms, ...rest } = p;
        return { ...rest, roomStats: statusCounts };
      });

      return paginated(withStats, total, page, limit);
    },
  });

  /* ── GET /api/properties/:id ─────────────────────────────────────────── */
  app.get('/:id', {
    schema: { tags: ['properties'], summary: 'Get property by ID', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const property = await db.property.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { rooms: true } } },
      });
      if (!property) return reply.status(404).send({ success: false, error: 'Property not found' });

      return ok(property);
    },
  });

  /* ── POST /api/properties ────────────────────────────────────────────── */
  app.post('/', {
    schema: { tags: ['properties'], summary: 'Create property', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;

      const body = propertySchema.parse(request.body);

      const existing = await db.property.findFirst({ where: { tenantId, slug: body.slug } });
      if (existing) return reply.status(409).send({ success: false, error: 'A property with this slug already exists' });

      try {
        /*
         * The plan ceiling is counted and the property is inserted as one
         * operation. It used to be a `checkPropertyLimit()` above and a
         * `create()` below with nothing joining them, so concurrent requests
         * all read the same count, all passed, and all inserted — eight at
         * once put nine properties on a five-property plan. See
         * utils/entitlement.ts for why `withQuota` takes a lock rather than
         * relying on Serializable the way the booking routes do.
         *
         * `tenantId` is passed explicitly because this runs on the unscoped
         * client — the tenant extension does not reach inside a transaction.
         */
        const property = await withQuota(tenantId, PROPERTY_QUOTA, tx =>
          tx.property.create({ data: { tenantId, ...body } }),
        );
        return reply.status(201).send(ok(property, 'Property created'));
      } catch (err) {
        if (err instanceof PlanLimitReached) {
          return reply.status(403).send({
            success: false,
            error: err.message,
            code: err.code,
            upgradeRequired: true,
            data: { limit: err.limit, current: err.current } as unknown,
          });
        }
        // The duplicate-slug read above can go stale between here and the
        // insert, and `@@unique([tenantId, slug])` is what actually decides.
        // Two requests claiming one slug used to leave the loser a 500.
        if ((err as { code?: string }).code === 'P2002') {
          return reply.status(409).send({ success: false, error: 'A property with this slug already exists' });
        }
        throw err;
      }
    },
  });

  /* ── PATCH /api/properties/:id ───────────────────────────────────────── */
  app.patch('/:id', {
    schema: { tags: ['properties'], summary: 'Update property', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const property = await db.property.findFirst({ where: { id, tenantId } });
      if (!property) return reply.status(404).send({ success: false, error: 'Property not found' });

      const body = propertySchema.partial().parse(request.body);

      if (body.slug && body.slug !== property.slug) {
        const dup = await db.property.findFirst({ where: { tenantId, slug: body.slug, id: { not: id } } });
        if (dup) return reply.status(409).send({ success: false, error: 'Slug already in use' });
      }

      const updated = await db.property.update({ where: { id }, data: body });
      return ok(updated, 'Property updated');
    },
  });

  /* ── DELETE /api/properties/:id ──────────────────────────────────────── */
  app.delete('/:id', {
    schema: { tags: ['properties'], summary: 'Delete property', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const property = await db.property.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { rooms: true } } },
      });
      if (!property) return reply.status(404).send({ success: false, error: 'Property not found' });
      if (property._count.rooms > 0) {
        return reply.status(409).send({
          success: false,
          error: `Cannot delete property with ${property._count.rooms} room(s). Reassign or remove rooms first.`,
        });
      }

      await db.property.delete({ where: { id } });
      return ok(null, 'Property deleted');
    },
  });

  /* ── GET /api/properties/:id/rooms ───────────────────────────────────── */
  app.get('/:id/rooms', {
    schema: { tags: ['properties'], summary: 'List rooms in a property', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const property = await db.property.findFirst({ where: { id, tenantId } });
      if (!property) return reply.status(404).send({ success: false, error: 'Property not found' });

      const rooms = await db.room.findMany({
        where: { tenantId, propertyId: id, isActive: true },
        orderBy: { number: 'asc' },
      });
      return ok(rooms);
    },
  });
}

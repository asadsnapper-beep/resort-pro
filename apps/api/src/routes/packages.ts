import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';

const packageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  priceType: z.enum(['PER_STAY', 'PER_NIGHT']).default('PER_STAY'),
  inclusions: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function packageRoutes(app: FastifyInstance) {
  // ── GET /api/packages ─────────────────────────────────────────────────────
  app.get('/', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const packages = await db.package.findMany({
        where: {},
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { bookings: true } },
        },
      });
      return ok(packages);
    },
  });

  // ── POST /api/packages ────────────────────────────────────────────────────
  app.post('/', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { db } = request;
      const data = packageSchema.parse(request.body);
      const pkg = await db.package.create({
        data: { ...data },
      });
      return reply.status(201).send(ok(pkg));
    },
  });

  // ── PATCH /api/packages/:id ───────────────────────────────────────────────
  app.patch('/:id', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const data = packageSchema.partial().parse(request.body);

      const pkg = await db.package.findFirst({ where: { id } });
      if (!pkg) return reply.status(404).send({ error: 'Package not found' });

      const updated = await db.package.update({ where: { id }, data });
      return ok(updated);
    },
  });

  // ── DELETE /api/packages/:id ──────────────────────────────────────────────
  app.delete('/:id', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const pkg = await db.package.findFirst({ where: { id } });
      if (!pkg) return reply.status(404).send({ error: 'Package not found' });

      // Block delete if package is used in any bookings.
      // BookingPackage has no tenantId column — see the comment on GET
      // /booking/:bookingId above. The package fetch above already proved
      // this packageId belongs to the caller's tenant.
      const usageCount = await prisma.bookingPackage.count({ where: { packageId: id } });
      if (usageCount > 0) {
        return reply.status(409).send({
          error: `Cannot delete "${pkg.name}" — it has been applied to ${usageCount} booking(s). Deactivate it instead.`,
        });
      }

      await db.package.delete({ where: { id } });
      return ok({ deleted: true });
    },
  });

  // ── GET /api/packages/:id/bookings ────────────────────────────────────────
  // List bookings that have this package applied
  app.get('/:id/bookings', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const pkg = await db.package.findFirst({ where: { id } });
      if (!pkg) return reply.status(404).send({ error: 'Package not found' });

      const bookings = await prisma.bookingPackage.findMany({
        where: { packageId: id },
        include: {
          booking: {
            include: {
              guest: { select: { firstName: true, lastName: true } },
              room: { select: { number: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return ok(bookings);
    },
  });

  // ── POST /api/packages/apply ──────────────────────────────────────────────
  // Apply a package to a booking
  app.post('/apply', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { bookingId, packageId } = z.object({
        bookingId: z.string(),
        packageId: z.string(),
      }).parse(request.body);

      const [booking, pkg] = await Promise.all([
        db.booking.findFirst({ where: { id: bookingId } }),
        db.package.findFirst({ where: { id: packageId, isActive: true } }),
      ]);

      if (!booking) return reply.status(404).send({ error: 'Booking not found' });
      if (!pkg) return reply.status(404).send({ error: 'Package not found' });

      // BookingPackage has no tenantId column — see the comment on GET
      // /booking/:bookingId below. Tenancy is already proven by the
      // tenant-scoped booking/package fetches above, so the raw `prisma`
      // client is safe to use for everything touching BookingPackage itself.
      const existing = await prisma.bookingPackage.findUnique({
        where: { bookingId_packageId: { bookingId, packageId } },
      });
      if (existing) return reply.status(409).send({ error: 'Package already applied to this booking' });

      const nights = Math.max(
        1,
        Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000),
      );
      const packageCost = pkg.priceType === 'PER_NIGHT' ? pkg.price * nights : pkg.price;

      // Create the join record + update booking totalAmount
      const [bp] = await prisma.$transaction([
        prisma.bookingPackage.create({
          data: {
            bookingId,
            packageId,
            packageName: pkg.name,
            price: pkg.price,
            priceType: pkg.priceType,
            nights,
          },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { totalAmount: { increment: packageCost } },
        }),
      ]);

      return reply.status(201).send(ok(bp));
    },
  });

  // ── DELETE /api/packages/remove ───────────────────────────────────────────
  // Remove a package from a booking
  app.delete('/remove', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { bookingId, packageId } = z.object({
        bookingId: z.string(),
        packageId: z.string(),
      }).parse(request.body);

      const booking = await db.booking.findFirst({ where: { id: bookingId } });
      if (!booking) return reply.status(404).send({ error: 'Booking not found' });

      const bp = await prisma.bookingPackage.findUnique({
        where: { bookingId_packageId: { bookingId, packageId } },
      });
      if (!bp) return reply.status(404).send({ error: 'Package not applied to this booking' });

      const packageCost = bp.priceType === 'PER_NIGHT' ? bp.price * bp.nights : bp.price;

      await prisma.$transaction([
        prisma.bookingPackage.delete({
          where: { bookingId_packageId: { bookingId, packageId } },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: { totalAmount: { decrement: packageCost } },
        }),
      ]);

      return ok({ removed: true });
    },
  });

  // ── GET /api/packages/booking/:bookingId ──────────────────────────────────
  // List all packages on a specific booking
  app.get('/booking/:bookingId', {
    schema: { tags: ['packages'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { bookingId } = request.params as { bookingId: string };

      const booking = await db.booking.findFirst({ where: { id: bookingId } });
      if (!booking) return reply.status(404).send({ error: 'Booking not found' });

      // BookingPackage has no tenantId column of its own — the tenant-scoped
      // `db` client's extension injects one into every query regardless, which
      // Prisma rejects as an unknown field. The booking fetch above already
      // proved this bookingId belongs to the caller's tenant, so querying by
      // bookingId through the raw client is safe.
      const packages = await prisma.bookingPackage.findMany({
        where: { bookingId },
        include: {
          package: {
            select: { id: true, name: true, description: true, inclusions: true, imageUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return ok(packages);
    },
  });
}

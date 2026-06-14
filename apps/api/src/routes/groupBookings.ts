import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const groupSchema = z.object({
  name: z.string().min(1),
  organization: z.string().optional(),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  eventType: z.enum(['WEDDING', 'CORPORATE', 'CONFERENCE', 'SPORTS', 'TOUR', 'FAMILY', 'OTHER']).default('OTHER'),
  checkIn: z.string(), // YYYY-MM-DD
  checkOut: z.string(),
  discountType: z.enum(['NONE', 'PERCENTAGE', 'FLAT']).default('NONE'),
  discountValue: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const bookingInclude = {
  guest: { select: { firstName: true, lastName: true, email: true } },
  room: { select: { id: true, number: true, name: true, type: true, basePrice: true } },
  payments: { select: { amount: true, method: true, status: true } },
} as const;

export async function groupBookingRoutes(app: FastifyInstance) {
  // ── GET /api/group-bookings ────────────────────────────────────────────────
  app.get('/', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { status, search } = request.query as { status?: string; search?: string };

      const groups = await db.groupBooking.findMany({
        where: {
          ...(status ? { status: status as any } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { organization: { contains: search, mode: 'insensitive' } },
                  { contactName: { contains: search, mode: 'insensitive' } },
                  { contactEmail: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          bookings: {
            include: bookingInclude,
          },
          _count: { select: { bookings: true } },
        },
        orderBy: { checkIn: 'asc' },
      });

      return ok(groups);
    },
  });

  // ── GET /api/group-bookings/:id ────────────────────────────────────────────
  app.get('/:id', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const group = await db.groupBooking.findFirst({
        where: { id },
        include: {
          bookings: {
            include: {
              ...bookingInclude,
              bookingPackages: { include: { package: { select: { name: true } } } },
            },
          },
        },
      });

      if (!group) return reply.status(404).send({ error: 'Group booking not found' });
      return ok(group);
    },
  });

  // ── POST /api/group-bookings ───────────────────────────────────────────────
  // Create group (optionally with room bookings in one call)
  app.post('/', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;

      const bodySchema = groupSchema.extend({
        // Array of room+guest combos to pre-book immediately
        bookings: z.array(z.object({
          roomId: z.string(),
          guestId: z.string().optional(),
          guestFirstName: z.string().optional(),
          guestLastName: z.string().optional(),
          guestEmail: z.string().optional(),
          adults: z.number().int().min(1).default(1),
          children: z.number().int().min(0).default(0),
          specialRequests: z.string().optional(),
        })).default([]),
      });

      const data = bodySchema.parse(request.body);
      const { bookings: bookingInputs, ...groupData } = data;

      const checkIn = new Date(groupData.checkIn);
      const checkOut = new Date(groupData.checkOut);
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000));

      // Create group + bookings in a transaction
      const group = await db.$transaction(async (tx) => {
        const newGroup = await tx.groupBooking.create({
          data: { ...groupData, checkIn, checkOut },
        });

        for (const bi of bookingInputs) {
          // Resolve or create guest
          let guestId = bi.guestId;
          if (!guestId && bi.guestEmail) {
            const g = await tx.guest.upsert({
              where: { tenantId_email: { tenantId, email: bi.guestEmail } },
              update: {},
              create: {
                firstName: bi.guestFirstName ?? 'Group',
                lastName: bi.guestLastName ?? 'Guest',
                email: bi.guestEmail,
              },
            });
            guestId = g.id;
          }
          if (!guestId) continue; // skip if no guest info

          // Get room base price
          const room = await tx.room.findUnique({ where: { id: bi.roomId } });
          if (!room) continue;

          let totalAmount = Number(room.basePrice) * nights;

          // Apply group discount
          if (groupData.discountType === 'PERCENTAGE' && groupData.discountValue > 0) {
            totalAmount = totalAmount * (1 - groupData.discountValue / 100);
          } else if (groupData.discountType === 'FLAT' && groupData.discountValue > 0) {
            totalAmount = Math.max(0, totalAmount - groupData.discountValue);
          }

          const confirmationNo = `GRP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

          await tx.booking.create({
            data: {
              roomId: bi.roomId,
              guestId,
              groupId: newGroup.id,
              checkIn,
              checkOut,
              adults: bi.adults,
              children: bi.children,
              totalAmount,
              specialRequests: bi.specialRequests,
              status: 'CONFIRMED',
              source: 'GROUP',
              confirmationNo,
            },
          });

          // Mark room as RESERVED
          await tx.room.update({ where: { id: bi.roomId }, data: { status: 'RESERVED' } });
        }

        return tx.groupBooking.findUnique({
          where: { id: newGroup.id },
          include: { bookings: { include: bookingInclude }, _count: { select: { bookings: true } } },
        });
      });

      return reply.status(201).send(ok(group));
    },
  });

  // ── PATCH /api/group-bookings/:id ──────────────────────────────────────────
  app.patch('/:id', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const data = groupSchema.partial().parse(request.body);

      const group = await db.groupBooking.findFirst({ where: { id } });
      if (!group) return reply.status(404).send({ error: 'Group booking not found' });

      const updated = await db.groupBooking.update({
        where: { id },
        data: {
          ...data,
          ...(data.checkIn ? { checkIn: new Date(data.checkIn) } : {}),
          ...(data.checkOut ? { checkOut: new Date(data.checkOut) } : {}),
        },
        include: { bookings: { include: bookingInclude }, _count: { select: { bookings: true } } },
      });

      return ok(updated);
    },
  });

  // ── DELETE /api/group-bookings/:id ─────────────────────────────────────────
  app.delete('/:id', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const group = await db.groupBooking.findFirst({ where: { id } });
      if (!group) return reply.status(404).send({ error: 'Group booking not found' });

      // Unlink bookings (set groupId = null) rather than delete them
      await db.$transaction([
        db.booking.updateMany({ where: { groupId: id }, data: { groupId: null } }),
        db.groupBooking.delete({ where: { id } }),
      ]);

      return ok({ deleted: true });
    },
  });

  // ── POST /api/group-bookings/:id/add-booking ───────────────────────────────
  // Add an existing standalone booking to a group
  app.post('/:id/add-booking', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { bookingId } = z.object({ bookingId: z.string() }).parse(request.body);

      const [group, booking] = await Promise.all([
        db.groupBooking.findFirst({ where: { id } }),
        db.booking.findFirst({ where: { id: bookingId } }),
      ]);

      if (!group) return reply.status(404).send({ error: 'Group not found' });
      if (!booking) return reply.status(404).send({ error: 'Booking not found' });

      await db.booking.update({ where: { id: bookingId }, data: { groupId: id } });
      return ok({ linked: true });
    },
  });

  // ── DELETE /api/group-bookings/:id/remove-booking/:bookingId ──────────────
  app.delete('/:id/remove-booking/:bookingId', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id, bookingId } = request.params as { id: string; bookingId: string };

      const booking = await db.booking.findFirst({ where: { id: bookingId, groupId: id } });
      if (!booking) return reply.status(404).send({ error: 'Booking not in this group' });

      await db.booking.update({ where: { id: bookingId }, data: { groupId: null } });
      return ok({ unlinked: true });
    },
  });

  // ── POST /api/group-bookings/:id/bulk-checkin ──────────────────────────────
  app.post('/:id/bulk-checkin', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const group = await db.groupBooking.findFirst({
        where: { id },
        include: { bookings: { select: { id: true, roomId: true, status: true } } },
      });
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const now = new Date();
      const toCheckIn = group.bookings.filter((b) => b.status === 'CONFIRMED');

      await db.$transaction([
        ...toCheckIn.map((b) =>
          db.booking.update({
            where: { id: b.id },
            data: { status: 'CHECKED_IN', actualCheckIn: now },
          })
        ),
        ...toCheckIn.map((b) =>
          db.room.update({ where: { id: b.roomId }, data: { status: 'OCCUPIED' } })
        ),
        db.groupBooking.update({ where: { id }, data: { status: 'CHECKED_IN' } }),
      ]);

      return ok({ checkedIn: toCheckIn.length });
    },
  });

  // ── POST /api/group-bookings/:id/bulk-checkout ─────────────────────────────
  app.post('/:id/bulk-checkout', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const group = await db.groupBooking.findFirst({
        where: { id },
        include: { bookings: { select: { id: true, roomId: true, status: true } } },
      });
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const now = new Date();
      const toCheckOut = group.bookings.filter((b) => b.status === 'CHECKED_IN');

      await db.$transaction([
        ...toCheckOut.map((b) =>
          db.booking.update({
            where: { id: b.id },
            data: { status: 'CHECKED_OUT', actualCheckOut: now },
          })
        ),
        ...toCheckOut.map((b) =>
          db.room.update({ where: { id: b.roomId }, data: { status: 'AVAILABLE' } })
        ),
        db.groupBooking.update({ where: { id }, data: { status: 'CHECKED_OUT' } }),
      ]);

      return ok({ checkedOut: toCheckOut.length });
    },
  });

  // ── GET /api/group-bookings/:id/summary ────────────────────────────────────
  app.get('/:id/summary', {
    schema: { tags: ['group-bookings'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const group = await db.groupBooking.findFirst({
        where: { id },
        include: {
          bookings: {
            include: {
              ...bookingInclude,
              payments: true,
            },
          },
        },
      });
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const nights = Math.max(
        1,
        Math.ceil((group.checkOut.getTime() - group.checkIn.getTime()) / 86_400_000),
      );

      const totalAmount = group.bookings.reduce((s, b) => s + Number(b.totalAmount), 0);
      const paidAmount = group.bookings.reduce(
        (s, b) => s + b.payments.filter((p) => p.status === 'PAID').reduce((ps, p) => ps + Number(p.amount), 0),
        0,
      );

      const roomCount = group.bookings.length;
      const checkedIn = group.bookings.filter((b) => b.status === 'CHECKED_IN').length;
      const checkedOut = group.bookings.filter((b) => b.status === 'CHECKED_OUT').length;
      const confirmed = group.bookings.filter((b) => b.status === 'CONFIRMED').length;

      return ok({
        group: {
          id: group.id,
          name: group.name,
          organization: group.organization,
          contactName: group.contactName,
          contactEmail: group.contactEmail,
          contactPhone: group.contactPhone,
          eventType: group.eventType,
          status: group.status,
          checkIn: group.checkIn,
          checkOut: group.checkOut,
          discountType: group.discountType,
          discountValue: group.discountValue,
          notes: group.notes,
        },
        stats: { roomCount, nights, totalAmount, paidAmount, outstanding: totalAmount - paidAmount, checkedIn, checkedOut, confirmed },
        bookings: group.bookings,
      });
    },
  });
}

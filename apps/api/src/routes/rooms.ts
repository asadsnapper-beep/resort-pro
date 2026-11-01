import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma, Prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { checkRoomLimit } from '../utils/entitlement';
import { matchAllTerms } from '../utils/search-terms';
import { propertyScope } from '../utils/property-scope';
import { sellableRoomWhere } from '../utils/room-saleability';
import { roomBlocker } from '../utils/room-state';
import { parseStayDates } from '../utils/stay-dates';

const roomSchema = z.object({
  number:       z.string().min(1).max(10),
  name:         z.string().min(1).max(100),
  type:         z.enum(['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW']),
  floor:        z.number().int().optional(),
  maxOccupancy: z.number().int().min(1).max(20),
  basePrice:    z.number().positive(),
  description:  z.string().optional(),
  amenities:    z.array(z.string()).default([]),
  images:       z.array(z.string()).default([]),
  videos:       z.array(z.string().url('Each video must be a valid URL')).default([]),
  /**
   * The property this room belongs to, for a resort group with more than one.
   *
   * It was missing from this schema while the Add/Edit Room modal collected it
   * and sent it on every save. Zod strips what it does not declare, so the
   * request returned 201, the modal closed as though it had worked, and the
   * row was written with propertyId null — for the multi-property customers
   * who are the only ones shown the selector at all. Every dashboard list
   * already narrows by `propertyScope()`, so those rooms could be filtered by
   * a property none of them could ever be given. (Room Management QA
   * 2026-10-28, RM-002.)
   *
   * `null` is how the modal says "no property", so it is accepted and means
   * unassign. Omitting the field leaves an existing assignment alone.
   */
  propertyId:   z.string().uuid('Not a valid property').nullable().optional(),
});

export async function roomRoutes(app: FastifyInstance) {

  /**
   * Is this property one this tenant may put a room in?
   *
   * Read on the tenant-scoped client, so another tenant's property simply
   * matches nothing and is refused the same way a made-up id is — the caller
   * cannot tell the difference, which is the point. An inactive property is
   * refused too: assigning inventory to a property the owner has retired puts
   * rooms somewhere no dashboard view will show them.
   */
  async function assignablePropertyExists(
    db: FastifyRequest['db'],
    propertyId: string,
  ): Promise<boolean> {
    const property = await db.property.findFirst({
      where: { id: propertyId, isActive: true },
      select: { id: true },
    });
    return Boolean(property);
  }

  const unknownProperty = (reply: FastifyReply) =>
    reply.status(400).send({
      success: false,
      error: 'That property does not exist, or is no longer active.',
      code: 'PROPERTY_NOT_FOUND',
      field: 'propertyId',
    });

  /**
   * One answer for "that number is taken", whichever check caught it.
   *
   * Room is `@@unique([tenantId, number])`, so the data was never at risk —
   * but create and update both read first and wrote after, and nothing caught
   * the constraint's refusal when two requests passed that read together.
   * Prisma's P2002 reached the error handler as an unhandled fault and four
   * simultaneous creates answered 201, 500, 500, 500
   * (Room Management QA 2026-10-28, RM-007).
   *
   * A 500 is worse here than untidy: it tells the caller the server broke, so
   * clients retry it — and a receptionist double-clicking a slow button is
   * precisely who opens the window. Which of the two checks turned a request
   * away is a timing accident nobody can branch on, so both say this.
   */
  const numberTaken = (reply: FastifyReply, number: string) =>
    reply.status(409).send({
      success: false,
      error: `Room number ${number} is already in use.`,
      code: 'ROOM_NUMBER_TAKEN',
    });

  /* ── GET /api/rooms/stats ────────────────────────────────────────────────── */
  app.get('/stats', {
    schema: { tags: ['rooms'], summary: 'Room status counts', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      // The property picked in the dashboard's top bar; none means all.
      const scope = propertyScope(request);

      const [total, available, occupied, cleaning, maintenance, reserved] = await Promise.all([
        db.room.count({ where: { isActive: true, ...scope } }),
        db.room.count({ where: { isActive: true, status: 'AVAILABLE', ...scope } }),
        db.room.count({ where: { isActive: true, status: 'OCCUPIED', ...scope } }),
        db.room.count({ where: { isActive: true, status: 'CLEANING', ...scope } }),
        db.room.count({ where: { isActive: true, status: 'MAINTENANCE', ...scope } }),
        db.room.count({ where: { isActive: true, status: 'RESERVED', ...scope } }),
      ]);

      return ok({ total, available, occupied, cleaning, maintenance, reserved });
    },
  });

  /* ── GET /api/rooms ──────────────────────────────────────────────────────── */
  app.get('/', {
    schema: {
      tags: ['rooms'], summary: 'List all rooms', security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page:   { type: 'integer' },
          limit:  { type: 'integer' },
          status: { type: 'string' },
          type:   { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const q = request.query as { page?: number; limit?: number; status?: string; type?: string; search?: string };
      const { page, limit, skip } = parsePageParams(q);

      const where: Record<string, unknown> = {
        isActive: true,
        ...propertyScope(request),
        ...(q.status && { status: q.status }),
        ...(q.type   && { type:   q.type   }),
        // Per-term, so "Sea View Standard" matches rather than requiring the
        // whole phrase to sit in one column.
        ...(matchAllTerms(q.search, ['name', 'number']) ?? {}),
      };

      const [rooms, total] = await Promise.all([
        db.room.findMany({ where, skip, take: limit, orderBy: { number: 'asc' } }),
        db.room.count({ where }),
      ]);

      return paginated(rooms, total, page, limit);
    },
  });

  /* ── GET /api/rooms/availability ─────────────────────────────────────────── */
  app.get('/availability', {
    schema: { tags: ['rooms'], summary: 'Check room availability for date range', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;

      // The dates are a contract, not a suggestion — utils/stay-dates.ts says
      // what a stay date is, and every endpoint that takes one agrees.
      const dates = parseStayDates(request.query);
      if (!dates.ok) {
        return reply.status(400).send({ success: false, error: dates.error, code: dates.code });
      }
      const { checkIn: checkInDate, checkOut: checkOutDate } = dates;

      const bookedRoomIds = await db.booking.findMany({
        where: {
          status:   { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          checkIn:  { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
        select: { roomId: true },
      });

      const bookedIds = bookedRoomIds.map(b => b.roomId);

      // Which room statuses may be sold for a stay starting on this date is
      // utils/room-saleability.ts's decision, not this route's — the public
      // site answers the same question and has to answer it the same way.
      // Read for its own timezone because "today" is where the rule turns.
      const { tenantId } = request.user as { tenantId: string };
      const tenant = await prisma.tenant.findUnique({
        where:  { id: tenantId },
        select: { timezone: true },
      });

      const availableRooms = await db.room.findMany({
        where: {
          ...sellableRoomWhere(checkInDate, tenant?.timezone),
          id: { notIn: bookedIds },
        },
        orderBy: { basePrice: 'asc' },
      });

      return ok(availableRooms);
    },
  });

  /* ── GET /api/rooms/:id ──────────────────────────────────────────────────── */
  app.get('/:id', {
    schema: { tags: ['rooms'], summary: 'Get room by ID (with current booking)', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const now = new Date();
      const currentBooking = await db.booking.findFirst({
        where: {
          roomId: id,
          status: { in: ['CHECKED_IN', 'CONFIRMED', 'PENDING'] },
          checkIn:  { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          checkOut: { gte: now },
        },
        orderBy: { checkIn: 'asc' },
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      });

      return ok({ ...room, currentBooking: currentBooking ?? null });
    },
  });

  /* ── POST /api/rooms ─────────────────────────────────────────────────────── */
  app.post('/', {
    schema: { tags: ['rooms'], summary: 'Create room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = roomSchema.parse(request.body);

      const existing = await db.room.findFirst({ where: { number: body.number } });
      if (existing) return numberTaken(reply, body.number);

      // Plan limit check
      const { tenantId } = request.user as { tenantId: string };
      const limitCheck = await checkRoomLimit(tenantId);
      if (!limitCheck.allowed) {
        return reply.status(403).send({
          success: false,
          error: `Room limit reached. Your plan allows ${limitCheck.limit} rooms. Upgrade to add more.`,
          code: 'ROOM_LIMIT_REACHED',
          data: { limit: limitCheck.limit, current: limitCheck.current } as unknown,
        });
      }

      if (body.propertyId && !(await assignablePropertyExists(db, body.propertyId))) {
        return unknownProperty(reply);
      }

      try {
        const room = await db.room.create({ data: body });
        return reply.status(201).send(ok(room, 'Room created'));
      } catch (err) {
        // The read above can go stale between here and the insert; the
        // constraint is what actually decides, so translate its answer.
        if ((err as { code?: string }).code === 'P2002') return numberTaken(reply, body.number);
        throw err;
      }
    },
  });

  /* ── PATCH /api/rooms/:id ────────────────────────────────────────────────── */
  app.patch('/:id', {
    schema: { tags: ['rooms'], summary: 'Update room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = roomSchema.partial().parse(request.body);

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      if (body.number && body.number !== room.number) {
        const dup = await db.room.findFirst({ where: { number: body.number, id: { not: id } } });
        if (dup) return numberTaken(reply, body.number);
      }

      // Sent and non-null means reassign, so it is checked. Sent as null means
      // unassign, which needs no property to exist. Absent means leave it.
      if (body.propertyId && !(await assignablePropertyExists(db, body.propertyId))) {
        return unknownProperty(reply);
      }

      try {
        const updated = await db.room.update({ where: { id }, data: body });
        return ok(updated, 'Room updated');
      } catch (err) {
        // Renaming has the same read-then-write shape as creating, and the
        // same constraint behind it. `number` is the room's only unique
        // column, so a P2002 here is always two rooms reaching for it.
        if ((err as { code?: string }).code === 'P2002') {
          return numberTaken(reply, body.number ?? room.number);
        }
        throw err;
      }
    },
  });

  /* ── PATCH /api/rooms/:id/status ─────────────────────────────────────────── */
  app.patch('/:id/status', {
    schema: { tags: ['rooms'], summary: 'Update room status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED']),
      }).parse(request.body);

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      /**
       * A room with a guest inside it is occupied, and no one gets to type
       * otherwise.
       *
       * This endpoint used to write whatever status it was handed, for Owner,
       * Manager and Receptionist alike, without looking at the bookings. The
       * audit checked a guest in and then set the same room back to Available
       * in one more request; the booking stayed CHECKED_IN and the call
       * returned 200. From there the room is saleable again — front desk can
       * assign it, the website can offer it, and the occupancy counts and
       * housekeeping lists all read from the same lie. (Room Management QA
       * 2026-10-28, RM-001.)
       *
       * So while a booking on this room is CHECKED_IN, the only status the
       * endpoint accepts is OCCUPIED — which is either a no-op or the repair
       * of a room whose status drifted away from its guest. Everything else is
       * refused until somebody checks the guest out, which is the one action
       * that actually ends the occupancy.
       *
       * The guest is the widest of several vetoes. The others are narrower,
       * and all say the same thing: **Available is a claim, and this endpoint
       * does not let anyone make it while the room is still blocked.** Open
       * maintenance, a clean in progress and a booking that covers today each
       * refuse it with their own code; utils/room-state.ts holds the order and
       * the wording, and every other place that writes a room's status derives
       * it from the same question. (RM-004.)
       *
       * Asking for Maintenance by hand now also opens a ticket, because the
       * audit's complaint was not the status — it was a room off sale "with no
       * actionable work order". A blocked room is one somebody can be sent to.
       */
      const { tenantId, sub: userId } = request.user as { tenantId: string; sub: string };
      const tenant = await prisma.tenant.findUnique({
        where:  { id: tenantId },
        select: { timezone: true },
      });

      let updated;
      try {
        updated = await prisma.$transaction(async (tx) => {
          // Lock this room's live bookings before reading them. Check-in
          // updates such a row, so taking the lock first makes it wait for
          // this transaction instead of slipping in between the read below
          // and the write that follows it. The room row itself is locked by
          // the update, which is what orders this against a booking created
          // and auto-checked-in at the same moment.
          await tx.$queryRaw`
            SELECT "id" FROM "bookings"
            WHERE "tenantId" = ${tenantId}
              AND "roomId" = ${id}
              AND "status"::text IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
            FOR UPDATE`;

          const blocker = await roomBlocker(tx, {
            tenantId,
            roomId:     id,
            timezone:   tenant?.timezone ?? undefined,
            roomNumber: room.number,
          });

          // A guest refuses every status but OCCUPIED; the rest refuse only
          // the claim that the room is ready. Marking a room held for tonight
          // as Cleaning is honest work, and must not be in anybody's way.
          const contradicted = blocker !== null && (
            blocker.code === 'ROOM_HAS_CHECKED_IN_GUEST'
              ? status !== 'OCCUPIED'
              : status === 'AVAILABLE'
          );
          if (contradicted) {
            throw Object.assign(new Error(blocker.error), {
              statusCode: 409,
              code: blocker.code,
            });
          }

          // Blocking by hand opens the work order the audit found missing. If
          // one is already open this is a no-op the front desk does by habit,
          // and must not pile up duplicates.
          if (status === 'MAINTENANCE' && blocker?.code !== 'ROOM_HAS_OPEN_MAINTENANCE') {
            await tx.maintenanceTicket.create({
              data: {
                tenantId,
                roomId:      id,
                issueType:   'OTHER',
                description: `Room ${room.number} was blocked from the room page`,
                priority:    'NORMAL',
                createdBy:   userId,
              },
            });
          }

          return tx.room.update({ where: { id }, data: { status } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string; code?: string };
        if (e.statusCode === 409) {
          // The code travels with the blocker rather than being assumed here,
          // so the caller can tell a guest apart from an open work order.
          return reply.status(409).send({
            success: false,
            error: e.message,
            code: e.code ?? 'ROOM_HAS_CHECKED_IN_GUEST',
          });
        }
        // Another transaction touched the same booking or room first. Say so
        // rather than returning a 500 the front desk cannot act on.
        if (e.code === 'P2034') {
          return reply.status(409).send({
            success: false,
            error: 'This room was being updated elsewhere. Reload and try again.',
            code: 'ROOM_STATUS_CONFLICT',
          });
        }
        throw err;
      }

      return ok(updated, 'Status updated');
    },
  });

  /* ── DELETE /api/rooms/:id ───────────────────────────────────────────────── */
  app.delete('/:id', {
    schema: { tags: ['rooms'], summary: 'Delete (deactivate) room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const room = await db.room.findFirst({ where: { id } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const activeBooking = await db.booking.findFirst({
        where: {
          roomId: id,
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        },
      });
      if (activeBooking) {
        return reply.status(409).send({
          success: false,
          error: 'Cannot delete room with active bookings. Cancel or complete them first.',
        });
      }

      await db.room.update({ where: { id }, data: { isActive: false } });
      return ok(null, 'Room deleted');
    },
  });
}

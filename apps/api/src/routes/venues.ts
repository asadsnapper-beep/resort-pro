import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const VENUE_TYPES = ['INDOOR', 'OUTDOOR', 'BOTH'] as const;
const EVENT_TYPES = ['WEDDING', 'BIRTHDAY', 'CORPORATE', 'SOCIAL', 'OTHER'] as const;
const BOOKING_STATUSES = ['TENTATIVE', 'CONFIRMED', 'CANCELLED'] as const;

const venueSchema = z.object({
  name: z.string().min(1),
  type: z.enum(VENUE_TYPES).default('INDOOR'),
  capacity: z.number().int().positive(),
  description: z.string().optional(),
  photos: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  halfDayRate: z.number().min(0).optional(),
  fullDayRate: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  overtimeRate: z.number().min(0).optional(),
  opensAt: z.string().default('08:00'),
  closesAt: z.string().default('22:00'),
  minAdvanceHrs: z.number().int().min(0).default(24),
  isVisible: z.boolean().default(true),
});

const bookingSchema = z.object({
  venueId: z.string().min(1),
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  clientEmail: z.string().email().optional(),
  eventType: z.enum(EVENT_TYPES).default('OTHER'),
  date: z.string().min(1), // YYYY-MM-DD
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  guestCount: z.number().int().positive(),
  baseAmount: z.number().min(0),
  addonsAmount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  addons: z.record(z.number()).optional(),
  notes: z.string().optional(),
  status: z.enum(BOOKING_STATUSES).default('CONFIRMED'),
});

export async function venueRoutes(app: FastifyInstance) {
  // ── Venues ────────────────────────────────────────────────────────────────

  app.get('/', {
    schema: { tags: ['venues'], summary: 'List venues', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const venues = await db.venue.findMany({
        where: { isActive: true },
        include: {
          bookings: {
            where: { date: { gte: new Date(new Date().toDateString()) }, status: { not: 'CANCELLED' } },
            orderBy: { date: 'asc' },
            take: 3,
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
      return ok(venues);
    },
  });

  app.post('/', {
    schema: { tags: ['venues'], summary: 'Create a venue', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = venueSchema.parse(request.body);
      const venue = await db.venue.create({ data: body });
      return reply.status(201).send(ok(venue, 'Venue created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['venues'], summary: 'Update a venue', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = venueSchema.partial().parse(request.body);
      const existing = await db.venue.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Venue not found' });
      const venue = await db.venue.update({ where: { id }, data: body });
      return ok(venue, 'Venue updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['venues'], summary: 'Delete (deactivate) a venue', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.venue.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Venue not found' });
      await db.venue.update({ where: { id }, data: { isActive: false } });
      return ok(null, 'Venue removed');
    },
  });

  // ── Availability ─────────────────────────────────────────────────────────

  app.get('/:id/availability', {
    schema: { tags: ['venues'], summary: 'Check venue availability for a date', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { date } = request.query as { date?: string };
      if (!date) return reply.status(400).send({ success: false, error: 'date query param required' });

      const bookings = await db.venueBooking.findMany({
        where: { venueId: id, date: new Date(date), status: { not: 'CANCELLED' } },
        select: { id: true, startTime: true, endTime: true, clientName: true },
      });
      return ok({ available: bookings.length === 0, bookings });
    },
  });

  // ── Bookings ──────────────────────────────────────────────────────────────

  app.get('/bookings', {
    schema: { tags: ['venues'], summary: 'List venue bookings', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const { venueId } = request.query as { venueId?: string };
      const bookings = await db.venueBooking.findMany({
        where: venueId ? { venueId } : {},
        include: { venue: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
      });
      return ok(bookings);
    },
  });

  app.post('/bookings', {
    schema: { tags: ['venues'], summary: 'Create a venue booking', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const body = bookingSchema.parse(request.body);

      const venue = await db.venue.findUnique({ where: { id: body.venueId } });
      if (!venue) return reply.status(404).send({ success: false, error: 'Venue not found' });

      const conflict = await db.venueBooking.findFirst({
        where: { venueId: body.venueId, date: new Date(body.date), status: { not: 'CANCELLED' } },
      });
      if (conflict) {
        return reply.status(409).send({ success: false, error: `${venue.name} is already booked on ${body.date} (${conflict.clientName}).` });
      }

      const totalAmount = body.baseAmount + body.addonsAmount;
      const booking = await db.venueBooking.create({
        data: {
          venueId: body.venueId,
          clientName: body.clientName,
          clientPhone: body.clientPhone,
          clientEmail: body.clientEmail,
          eventType: body.eventType,
          date: new Date(body.date),
          startTime: body.startTime,
          endTime: body.endTime,
          guestCount: body.guestCount,
          baseAmount: body.baseAmount,
          addonsAmount: body.addonsAmount,
          totalAmount,
          paidAmount: body.paidAmount,
          addons: body.addons,
          notes: body.notes,
          status: body.status,
          createdBy: userId,
        },
      });
      return reply.status(201).send(ok(booking, 'Booking created'));
    },
  });

  app.patch('/bookings/:id', {
    schema: { tags: ['venues'], summary: 'Update or cancel a venue booking', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = bookingSchema.partial().omit({ venueId: true }).parse(request.body);
      const existing = await db.venueBooking.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Booking not found' });

      const data: Record<string, unknown> = { ...body };
      if (body.date) data.date = new Date(body.date);
      if (body.baseAmount !== undefined || body.addonsAmount !== undefined) {
        data.totalAmount = (body.baseAmount ?? existing.baseAmount) + (body.addonsAmount ?? existing.addonsAmount);
      }

      const booking = await db.venueBooking.update({ where: { id }, data });
      return ok(booking, 'Booking updated');
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';

const VEHICLE_TYPES = ['CAR', 'BIKE', 'SCOOTY', 'BICYCLE', 'VAN', 'OTHER'] as const;

const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  name: z.string().min(1),
  registrationNumber: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  hourlyRate: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  photos: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
});

const rentalSchema = z.object({
  vehicleId: z.string().uuid(),
  guestId: z.string().uuid().optional().nullable(),
  bookingId: z.string().uuid().optional().nullable(),
  guestName: z.string().min(1),
  guestPhone: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  rateType: z.enum(['HOURLY', 'DAILY']).default('HOURLY'),
});

async function hasConflict(db: import('@resort-pro/database').TenantScopedPrisma, vehicleId: string, startAt: Date, endAt: Date, excludeId?: string) {
  return db.vehicleRental.findFirst({
    where: {
      vehicleId,
      status: { in: ['RESERVED', 'OUT'] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
}

export async function vehicleRoutes(app: FastifyInstance) {
  // ── Fleet ────────────────────────────────────────────────────────────────
  app.get('/', {
    schema: { tags: ['vehicles'], summary: 'List fleet', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const vehicles = await db.vehicle.findMany({ orderBy: { name: 'asc' } });
      return ok(vehicles);
    },
  });

  app.post('/', {
    schema: { tags: ['vehicles'], summary: 'Add a vehicle to the fleet', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = vehicleSchema.parse(request.body);
      const vehicle = await db.vehicle.create({ data: body });
      return reply.status(201).send(ok(vehicle, 'Vehicle added'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['vehicles'], summary: 'Update a vehicle', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = vehicleSchema.partial().extend({ availability: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE']).optional() }).parse(request.body);
      const existing = await db.vehicle.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Vehicle not found' });
      const vehicle = await db.vehicle.update({ where: { id }, data: body });
      return ok(vehicle, 'Vehicle updated');
    },
  });

  app.get('/:id/availability', {
    schema: { tags: ['vehicles'], summary: 'Check vehicle availability for a time range', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { start, end } = request.query as { start?: string; end?: string };
      if (!start || !end) return reply.status(400).send({ success: false, error: 'start and end query params required' });
      const conflict = await hasConflict(db, id, new Date(start), new Date(end));
      return ok({ available: !conflict, conflict });
    },
  });

  // ── Rentals ──────────────────────────────────────────────────────────────
  app.get('/rentals', {
    schema: { tags: ['vehicles'], summary: 'List rentals', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const { status } = request.query as { status?: string };
      const rentals = await db.vehicleRental.findMany({
        where: { ...(status && { status: status as never }) },
        include: { vehicle: { select: { id: true, name: true, type: true } } },
        orderBy: { startAt: 'desc' },
      });
      return ok(rentals);
    },
  });

  app.post('/rentals', {
    schema: { tags: ['vehicles'], summary: 'Create a rental (conflict-checked)', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = rentalSchema.parse(request.body);

      const vehicle = await db.vehicle.findUnique({ where: { id: body.vehicleId } });
      if (!vehicle) return reply.status(404).send({ success: false, error: 'Vehicle not found' });

      const startAt = new Date(body.startAt);
      const endAt = new Date(body.endAt);
      if (endAt <= startAt) return reply.status(400).send({ success: false, error: 'End time must be after start time' });

      const conflict = await hasConflict(db, body.vehicleId, startAt, endAt);
      if (conflict) return reply.status(409).send({ success: false, error: `${vehicle.name} is already booked for that time (${conflict.guestName}).` });

      const hours = (endAt.getTime() - startAt.getTime()) / 3600000;
      const rate = body.rateType === 'DAILY' ? (vehicle.dailyRate ?? 0) : (vehicle.hourlyRate ?? 0);
      const totalAmount = body.rateType === 'DAILY' ? rate * Math.ceil(hours / 24) : rate * Math.ceil(hours);

      const rental = await db.vehicleRental.create({
        data: {
          vehicleId: body.vehicleId, guestId: body.guestId || undefined, bookingId: body.bookingId || undefined,
          guestName: body.guestName, guestPhone: body.guestPhone,
          startAt, endAt, rate, totalAmount,
        },
      });
      return reply.status(201).send(ok(rental, 'Rental reserved'));
    },
  });

  app.patch('/rentals/:id/out', {
    schema: { tags: ['vehicles'], summary: 'Mark rental picked up', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        odometerOut: z.number().int().min(0).optional(),
        fuelOut: z.string().optional(),
        conditionNotesOut: z.string().optional(),
        depositCollected: z.number().min(0).optional(),
      }).parse(request.body);

      const existing = await db.vehicleRental.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Rental not found' });
      if (existing.status !== 'RESERVED') return reply.status(400).send({ success: false, error: 'Only reserved rentals can be marked out' });

      const [rental] = await Promise.all([
        db.vehicleRental.update({ where: { id }, data: { ...body, status: 'OUT' } }),
        db.vehicle.update({ where: { id: existing.vehicleId }, data: { availability: 'RENTED' } }),
      ]);
      return ok(rental, 'Marked as picked up');
    },
  });

  app.patch('/rentals/:id/return', {
    schema: { tags: ['vehicles'], summary: 'Mark rental returned', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        odometerIn: z.number().int().min(0).optional(),
        fuelIn: z.string().optional(),
        conditionNotesIn: z.string().optional(),
        depositReturned: z.number().min(0).optional(),
        finalAmount: z.number().min(0).optional(), // override, e.g. for late-return surcharge
      }).parse(request.body);

      const existing = await db.vehicleRental.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Rental not found' });
      if (existing.status !== 'OUT') return reply.status(400).send({ success: false, error: 'Only picked-up rentals can be returned' });

      const [rental] = await Promise.all([
        db.vehicleRental.update({
          where: { id },
          data: {
            odometerIn: body.odometerIn, fuelIn: body.fuelIn, conditionNotesIn: body.conditionNotesIn,
            depositReturned: body.depositReturned,
            ...(body.finalAmount !== undefined && { totalAmount: body.finalAmount }),
            status: 'RETURNED', actualReturnAt: new Date(),
          },
        }),
        db.vehicle.update({ where: { id: existing.vehicleId }, data: { availability: 'AVAILABLE' } }),
      ]);
      return ok(rental, 'Marked as returned');
    },
  });

  app.patch('/rentals/:id/billed', {
    schema: { tags: ['vehicles'], summary: 'Mark a rental as billed to the room', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.vehicleRental.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Rental not found' });
      const rental = await db.vehicleRental.update({ where: { id }, data: { billed: true } });
      return ok(rental, 'Marked as billed');
    },
  });

  app.patch('/rentals/:id/cancel', {
    schema: { tags: ['vehicles'], summary: 'Cancel a reserved rental', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.vehicleRental.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Rental not found' });
      if (existing.status !== 'RESERVED') return reply.status(400).send({ success: false, error: 'Only reserved rentals can be cancelled' });
      const rental = await db.vehicleRental.update({ where: { id }, data: { status: 'CANCELLED' } });
      return ok(rental, 'Rental cancelled');
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

// ── Rate resolution priority: PROMO > SEASONAL > WEEKEND > EARLY_BIRD > LAST_MINUTE > STANDARD ──
const TYPE_PRIORITY: Record<string, number> = {
  PROMO: 6,
  SEASONAL: 5,
  WEEKEND: 4,
  EARLY_BIRD: 3,
  LAST_MINUTE: 2,
  STANDARD: 1,
};

/**
 * Given a roomId + date range, find the best applicable RatePlan price.
 * Returns { price, planName, planType } or null (caller should fall back to basePrice).
 */
export async function resolveRate(
  tenantId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<{ price: number; planName: string; planType: string } | null> {
  const plans = await prisma.ratePlan.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [{ roomId }, { roomId: null }],
    },
  });

  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));

  // Filter applicable plans
  const applicable = plans.filter(p => {
    // min nights check
    if (p.minNights > nights) return false;

    // date range check (if set, checkIn must fall within range)
    if (p.startDate && checkIn < p.startDate) return false;
    if (p.endDate && checkIn > p.endDate) return false;

    // days-of-week check (if set, at least one night must match)
    if (p.daysOfWeek.length > 0) {
      const dayOfWeek = checkIn.getDay(); // 0=Sun
      if (!p.daysOfWeek.includes(dayOfWeek)) return false;
    }

    return true;
  });

  if (applicable.length === 0) return null;

  // Pick highest priority plan (by type, then by specificity: room-specific > global)
  applicable.sort((a, b) => {
    const pDiff = (TYPE_PRIORITY[b.type] ?? 0) - (TYPE_PRIORITY[a.type] ?? 0);
    if (pDiff !== 0) return pDiff;
    // Room-specific beats global
    if (a.roomId && !b.roomId) return -1;
    if (!a.roomId && b.roomId) return 1;
    return 0;
  });

  const best = applicable[0];
  return { price: best.price, planName: best.name, planType: best.type };
}

const createPlanSchema = z.object({
  roomId: z.string().optional().nullable(),
  name: z.string().min(1),
  type: z.enum(['STANDARD', 'SEASONAL', 'WEEKEND', 'PROMO', 'EARLY_BIRD', 'LAST_MINUTE']),
  price: z.number().positive(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  minNights: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export async function ratePlanRoutes(app: FastifyInstance) {
  // GET /api/rate-plans
  app.get('/', {
    schema: { tags: ['rate-plans'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const plans = await prisma.ratePlan.findMany({
        where: { tenantId },
        include: { room: { select: { id: true, name: true, number: true } } },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      });
      return ok(plans);
    },
  });

  // POST /api/rate-plans
  app.post('/', {
    schema: { tags: ['rate-plans'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = createPlanSchema.parse(request.body);

      const plan = await prisma.ratePlan.create({
        data: {
          tenantId,
          roomId: body.roomId ?? null,
          name: body.name,
          type: body.type,
          price: body.price,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          daysOfWeek: body.daysOfWeek,
          minNights: body.minNights,
          isActive: body.isActive,
        },
        include: { room: { select: { id: true, name: true, number: true } } },
      });
      return reply.status(201).send({ success: true, data: plan });
    },
  });

  // PATCH /api/rate-plans/:id
  app.patch('/:id', {
    schema: { tags: ['rate-plans'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;
      const body = createPlanSchema.partial().parse(request.body);

      const plan = await prisma.ratePlan.updateMany({
        where: { id, tenantId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.type !== undefined && { type: body.type }),
          ...(body.price !== undefined && { price: body.price }),
          ...(body.roomId !== undefined && { roomId: body.roomId }),
          ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
          ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
          ...(body.daysOfWeek !== undefined && { daysOfWeek: body.daysOfWeek }),
          ...(body.minNights !== undefined && { minNights: body.minNights }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
      });

      if (plan.count === 0) return reply.status(404).send({ error: 'Rate plan not found' });

      const updated = await prisma.ratePlan.findUnique({
        where: { id },
        include: { room: { select: { id: true, name: true, number: true } } },
      });
      return ok(updated);
    },
  });

  // DELETE /api/rate-plans/:id
  app.delete('/:id', {
    schema: { tags: ['rate-plans'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tenantId } = request.user as JwtPayload;

      await prisma.ratePlan.deleteMany({ where: { id, tenantId } });
      return ok(reply, { deleted: true });
    },
  });

  // GET /api/rate-plans/resolve?roomId=&checkIn=&checkOut=
  app.get('/resolve', {
    schema: { tags: ['rate-plans'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { roomId, checkIn, checkOut } = request.query as { roomId: string; checkIn: string; checkOut: string };

      if (!roomId || !checkIn || !checkOut) {
        return reply.status(400).send({ error: 'roomId, checkIn, checkOut are required' });
      }

      const room = await prisma.room.findFirst({ where: { id: roomId, tenantId } });
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      const resolved = await resolveRate(tenantId, roomId, new Date(checkIn), new Date(checkOut));
      return ok({
        roomId,
        basePrice: Number(room.basePrice),
        resolved,
        effectivePrice: resolved ? resolved.price : Number(room.basePrice),
      });
    },
  });
}

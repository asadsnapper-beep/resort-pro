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

export interface NightlyRate {
  date: string; // YYYY-MM-DD
  price: number;
  planName: string | null; // null = no rate plan matched this specific night, basePrice was used
  planType: string | null;
}

export interface ResolvedRate {
  price: number;       // blended average nightly rate — price * nights === totalPrice, so
                        // existing callers doing `(resolved?.price ?? basePrice) * nights` still get
                        // the right number even though the underlying nights may differ from each other.
  totalPrice: number;  // exact sum across all nights — prefer this when precision matters (money math).
  planName: string;    // the plan used, or "Mixed rates (A, B)" if more than one distinct plan applied
                        // across the stay. Only the FIRST matched night's plan is named otherwise —
                        // see nightlyBreakdown for the exact per-night picture.
  planType: string;
  nightlyBreakdown: NightlyRate[];
}

/**
 * Given a roomId + date range, find the best applicable RatePlan price —
 * evaluated night by night, not just against the check-in date.
 *
 * A stay that crosses a rate plan's own date-range or day-of-week boundary
 * (e.g. a 5-night stay where only the Fri/Sat nights fall inside a Weekend
 * plan) previously priced the *entire* stay off whichever plan matched the
 * check-in night alone — undercharging or overcharging every other night.
 * This resolves each night independently and sums the result.
 *
 * `basePrice` (the room's own nightly price) is required so a night with no
 * matching plan can still be priced correctly within a mixed stay — the
 * caller already has it from its own room lookup.
 *
 * Returns null only when NO night in the stay matched any rate plan at all
 * (a pure base-price stay) — same "caller falls back to basePrice" contract
 * as before. When at least one night matched something, the result always
 * covers the full stay (mixed nights use basePrice internally, not left for
 * the caller to patch in).
 */
export async function resolveRate(
  tenantId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  basePrice: number,
): Promise<ResolvedRate | null> {
  const plans = await prisma.ratePlan.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [{ roomId }, { roomId: null }],
    },
  });

  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));

  const breakdown: NightlyRate[] = [];
  const planNamesUsed = new Set<string>();
  let totalPrice = 0;
  let anyPlanMatched = false;

  for (let i = 0; i < nights; i++) {
    const night = new Date(checkIn.getTime() + i * 86_400_000);

    // Same filters as before, but evaluated against THIS night, not just checkIn.
    // minNights stays a whole-stay qualifier — a plan either qualifies for the
    // stay's total length or it doesn't; that's not a per-night question.
    const applicable = plans.filter(p => {
      if (p.minNights > nights) return false;
      if (p.startDate && night < p.startDate) return false;
      if (p.endDate && night > p.endDate) return false;
      if (p.daysOfWeek.length > 0 && !p.daysOfWeek.includes(night.getDay())) return false;
      return true;
    });

    if (applicable.length === 0) {
      totalPrice += basePrice;
      breakdown.push({ date: night.toISOString().slice(0, 10), price: basePrice, planName: null, planType: null });
      continue;
    }

    // Pick highest priority plan for this night (by type, then by
    // specificity: room-specific beats global). This is an exclusive,
    // highest-priority-wins policy — plans are never additive/stacked
    // against each other for the same night.
    applicable.sort((a, b) => {
      const pDiff = (TYPE_PRIORITY[b.type] ?? 0) - (TYPE_PRIORITY[a.type] ?? 0);
      if (pDiff !== 0) return pDiff;
      if (a.roomId && !b.roomId) return -1;
      if (!a.roomId && b.roomId) return 1;
      return 0;
    });

    const best = applicable[0];
    anyPlanMatched = true;
    planNamesUsed.add(best.name);
    totalPrice += best.price;
    breakdown.push({ date: night.toISOString().slice(0, 10), price: best.price, planName: best.name, planType: best.type });
  }

  if (!anyPlanMatched) return null;

  const firstMatched = breakdown.find((b) => b.planName)!;
  return {
    price: totalPrice / nights,
    totalPrice,
    planName: planNamesUsed.size > 1 ? `Mixed rates (${[...planNamesUsed].join(', ')})` : firstMatched.planName!,
    planType: firstMatched.planType!,
    nightlyBreakdown: breakdown,
  };
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
      const { db } = request;
      const plans = await db.ratePlan.findMany({
        where: {},
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
      const { db } = request;
      const body = createPlanSchema.parse(request.body);

      const plan = await db.ratePlan.create({
        data: {
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
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = createPlanSchema.partial().parse(request.body);

      const plan = await db.ratePlan.updateMany({
        where: { id },
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

      const updated = await db.ratePlan.findUnique({
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
      const { db } = request;
      const { id } = request.params as { id: string };

      await db.ratePlan.deleteMany({ where: { id } });
      return ok({ deleted: true });
    },
  });

  // GET /api/rate-plans/resolve?roomId=&checkIn=&checkOut=
  // Read-only price preview — kept in step with who can modify a booking
  // (OWNER/MANAGER/RECEPTIONIST), not the narrower rate-plan-management roles.
  app.get('/resolve', {
    schema: { tags: ['rate-plans'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { roomId, checkIn, checkOut } = request.query as { roomId: string; checkIn: string; checkOut: string };

      if (!roomId || !checkIn || !checkOut) {
        return reply.status(400).send({ error: 'roomId, checkIn, checkOut are required' });
      }

      const room = await db.room.findFirst({ where: { id: roomId } });
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      const resolved = await resolveRate(tenantId, roomId, new Date(checkIn), new Date(checkOut), Number(room.basePrice));
      return ok({
        roomId,
        basePrice: Number(room.basePrice),
        resolved,
        effectivePrice: resolved ? resolved.price : Number(room.basePrice),
      });
    },
  });
}

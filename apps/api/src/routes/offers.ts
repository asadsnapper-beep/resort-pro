import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function isOfferActive(offer: {
  isActive: boolean; validFrom: Date; validTo: Date; maxUses: number | null; usedCount: number;
}) {
  const now = new Date();
  return (
    offer.isActive &&
    offer.validFrom <= now &&
    offer.validTo   >= now &&
    (offer.maxUses === null || offer.usedCount < offer.maxUses)
  );
}

/** Calculate discount amount for a given offer, nights, and base room price */
export function calcDiscount(
  offer: { type: string; value: number },
  totalAmount: number,
  nights: number,
): number {
  if (offer.type === 'PERCENTAGE') return totalAmount * (offer.value / 100);
  if (offer.type === 'FIXED')      return Math.min(offer.value, totalAmount);
  if (offer.type === 'FREE_NIGHT') {
    // value = number of free nights
    const perNight = nights > 0 ? totalAmount / nights : 0;
    return Math.min(perNight * offer.value, totalAmount);
  }
  return 0;
}

const offerSchema = z.object({
  title:       z.string().min(1).max(100),
  description: z.string().optional(),
  type:        z.enum(['PERCENTAGE', 'FIXED', 'FREE_NIGHT']),
  value:       z.number().positive(),
  promoCode:   z.string().max(20).optional().nullable(),
  minStay:     z.number().int().min(1).default(1),
  validFrom:   z.string(),   // ISO date
  validTo:     z.string(),
  maxUses:     z.number().int().positive().optional().nullable(),
  roomIds:     z.array(z.string()).default([]),
  showOnBar:   z.boolean().default(true),
  showSection: z.boolean().default(true),
  showOnCards: z.boolean().default(true),
  priority:    z.number().int().default(0),
  isActive:    z.boolean().default(true),
});

export async function offersRoutes(app: FastifyInstance) {

  // GET /api/offers — list all tenant offers
  app.get('/', {
    schema: { tags: ['offers'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { status } = request.query as { status?: string };

      const now = new Date();
      const offers = await db.offer.findMany({
        where: {
          ...(status === 'active'   && { isActive: true, validFrom: { lte: now }, validTo: { gte: now } }),
          ...(status === 'scheduled'&& { isActive: true, validFrom: { gt: now } }),
          ...(status === 'expired'  && { validTo: { lt: now } }),
        },
        include: { _count: { select: { bookingOffers: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      return ok(offers.map(o => ({
        ...o,
        bookingsUsed: o._count.bookingOffers,
        isCurrentlyActive: isOfferActive(o),
      })));
    },
  });

  // POST /api/offers — create offer
  app.post('/', {
    schema: { tags: ['offers'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = validate(offerSchema, request.body, reply);
      if (!body) return;

      // Normalise promo code to uppercase
      const promoCode = body.promoCode ? body.promoCode.toUpperCase() : null;

      // Uniqueness check within tenant
      if (promoCode) {
        const clash = await db.offer.findFirst({ where: { promoCode } });
        if (clash) return reply.status(409).send({ success: false, error: 'Promo code already exists' });
      }

      const offer = await db.offer.create({
        data: {
          ...body,
          promoCode,
          validFrom: new Date(body.validFrom),
          validTo:   new Date(body.validTo),
        },
      });

      return reply.status(201).send({ success: true, data: offer, message: 'Offer created' });
    },
  });

  // PATCH /api/offers/:id — update offer
  app.patch('/:id', {
    schema: { tags: ['offers'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = offerSchema.partial().parse(request.body);

      const existing = await db.offer.findFirst({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Offer not found' });

      // '' and null both mean "clear the promo code"; undefined means "don't change it"
      const promoCode =
        body.promoCode === undefined ? undefined
        : body.promoCode === null || body.promoCode === '' ? null
        : body.promoCode.toUpperCase();

      const offer = await db.offer.update({
        where: { id },
        data: {
          ...body,
          ...(promoCode !== undefined && { promoCode }),
          ...(body.validFrom && { validFrom: new Date(body.validFrom) }),
          ...(body.validTo   && { validTo:   new Date(body.validTo) }),
        },
      });

      return ok(offer, 'Offer updated');
    },
  });

  // DELETE /api/offers/:id
  app.delete('/:id', {
    schema: { tags: ['offers'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.offer.findFirst({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Offer not found' });
      await db.offer.delete({ where: { id } });
      return ok(null, 'Offer deleted');
    },
  });

  // GET /api/offers/:id/stats
  app.get('/:id/stats', {
    schema: { tags: ['offers'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const offer = await db.offer.findFirst({ where: { id } });
      if (!offer) return reply.status(404).send({ success: false, error: 'Offer not found' });

      const bookingOffers = await db.bookingOffer.findMany({
        where: { offerId: id },
        select: { discount: true, booking: { select: { createdAt: true, totalAmount: true } } },
        orderBy: { booking: { createdAt: 'desc' } },
      });

      const totalSaved    = bookingOffers.reduce((s, bo) => s + bo.discount, 0);
      const totalRevenue  = bookingOffers.reduce((s, bo) => s + Number(bo.booking.totalAmount), 0);

      return ok({
        offer,
        totalUses:    bookingOffers.length,
        totalSaved,
        totalRevenue,
        recentUsages: bookingOffers.slice(0, 10),
      });
    },
  });
}

// ── Public endpoints (no auth) ─────────────────────────────────────────────────
export async function publicOffersRoutes(app: FastifyInstance) {

  // GET /site/:slug/offers — active offers for website display
  app.get('/:slug/offers', {
    schema: { tags: ['public'] },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const now = new Date();
      const raw = await prisma.offer.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          validFrom: { lte: now },
          validTo:   { gte: now },
        },
        orderBy: [{ priority: 'desc' }, { validFrom: 'asc' }],
      });

      const offers = raw
        .filter(o => o.maxUses === null || o.usedCount < o.maxUses)
        .map(({ usedCount: _u, tenantId: _t, ...rest }) => rest);

      return reply.send({ success: true, data: offers });
    },
  });

  // POST /site/:slug/offers/validate — validate promo code before booking
  app.post('/:slug/offers/validate', {
    schema: { tags: ['public'] },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const body = z.object({
        code:     z.string(),
        roomId:   z.string(),
        checkIn:  z.string(),
        checkOut: z.string(),
      }).parse(request.body);

      const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const now     = new Date();
      const checkIn = new Date(body.checkIn);
      const checkOut= new Date(body.checkOut);
      const nights  = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

      const offer = await prisma.offer.findFirst({
        where: {
          tenantId:  tenant.id,
          promoCode: body.code.toUpperCase(),
          isActive:  true,
          validFrom: { lte: now },
          validTo:   { gte: now },
        },
      });

      if (!offer) return reply.send({ success: true, data: { valid: false, error: 'Invalid or expired promo code' } });
      if (!isOfferActive(offer)) return reply.send({ success: true, data: { valid: false, error: 'Promo code is no longer valid' } });
      if (nights < offer.minStay) {
        return reply.send({ success: true, data: { valid: false, error: `Minimum stay is ${offer.minStay} nights` } });
      }
      if (offer.roomIds.length > 0 && !offer.roomIds.includes(body.roomId)) {
        return reply.send({ success: true, data: { valid: false, error: 'This offer is not valid for the selected room' } });
      }

      // Get room price to calculate discount
      const room = await prisma.room.findUnique({ where: { id: body.roomId }, select: { basePrice: true } });
      const totalAmount = Number(room?.basePrice ?? 0) * nights;
      const discount    = calcDiscount(offer, totalAmount, nights);

      return reply.send({
        success: true,
        data: {
          valid:       true,
          offerId:     offer.id,
          offerTitle:  offer.title,
          type:        offer.type,
          value:       offer.value,
          discount,
          finalPrice:  totalAmount - discount,
          totalAmount,
        },
      });
    },
  });
}

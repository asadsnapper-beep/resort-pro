import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { awardPoints, redeemPoints, getOrCreateAccount, calcTier } from '../services/loyalty';

export async function loyaltyRoutes(app: FastifyInstance) {
  // ── GET /api/loyalty/program ───────────────────────────────────────────────
  app.get('/program', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      let prog = await prisma.loyaltyProgram.findUnique({ where: { tenantId } });
      if (!prog) {
        prog = await prisma.loyaltyProgram.create({
          data: { tenantId },
        });
      }
      return ok(reply, prog);
    },
  });

  // ── PATCH /api/loyalty/program ─────────────────────────────────────────────
  app.patch('/program', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const schema = z.object({
        isEnabled: z.boolean().optional(),
        pointsPerDollar: z.number().positive().optional(),
        redemptionRate: z.number().positive().optional(),
        bronzeThreshold: z.number().int().min(0).optional(),
        silverThreshold: z.number().int().min(0).optional(),
        goldThreshold: z.number().int().min(0).optional(),
        platinumThreshold: z.number().int().min(0).optional(),
        programName: z.string().min(1).optional(),
      });
      const data = schema.parse(request.body);
      const prog = await prisma.loyaltyProgram.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
      });
      return ok(reply, prog);
    },
  });

  // ── GET /api/loyalty/accounts ──────────────────────────────────────────────
  app.get('/accounts', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { search, tier, page = '1', limit = '50' } = request.query as Record<string, string>;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const accounts = await prisma.loyaltyAccount.findMany({
        where: {
          tenantId,
          ...(tier ? { tier: tier as any } : {}),
          ...(search
            ? {
                guest: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          _count: { select: { transactions: true } },
        },
        orderBy: { lifetimePoints: 'desc' },
        skip,
        take: parseInt(limit),
      });

      const total = await prisma.loyaltyAccount.count({
        where: { tenantId, ...(tier ? { tier: tier as any } : {}) },
      });

      // Summary stats
      const stats = await prisma.loyaltyAccount.groupBy({
        by: ['tier'],
        where: { tenantId },
        _count: true,
      });

      return ok(reply, { accounts, total, stats });
    },
  });

  // ── GET /api/loyalty/accounts/:guestId ────────────────────────────────────
  app.get('/accounts/:guestId', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { guestId } = request.params as { guestId: string };

      const account = await prisma.loyaltyAccount.findUnique({
        where: { guestId },
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true } },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      });

      if (!account || account.tenantId !== tenantId) {
        // Return empty account stub if not enrolled yet
        const guest = await prisma.guest.findFirst({ where: { id: guestId, tenantId } });
        if (!guest) return reply.status(404).send({ error: 'Guest not found' });
        return ok(reply, { account: null, guest });
      }

      const prog = await prisma.loyaltyProgram.findUnique({ where: { tenantId } });

      return ok(reply, { account, prog });
    },
  });

  // ── POST /api/loyalty/accounts/:guestId/enroll ────────────────────────────
  app.post('/accounts/:guestId/enroll', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { guestId } = request.params as { guestId: string };

      const guest = await prisma.guest.findFirst({ where: { id: guestId, tenantId } });
      if (!guest) return reply.status(404).send({ error: 'Guest not found' });

      const account = await getOrCreateAccount(tenantId, guestId);
      return ok(reply, account, 201);
    },
  });

  // ── POST /api/loyalty/accounts/:guestId/award ─────────────────────────────
  app.post('/accounts/:guestId/award', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { guestId } = request.params as { guestId: string };
      const { points, description, bookingId } = z.object({
        points: z.number().int().positive(),
        description: z.string().min(1),
        bookingId: z.string().optional(),
      }).parse(request.body);

      const guest = await prisma.guest.findFirst({ where: { id: guestId, tenantId } });
      if (!guest) return reply.status(404).send({ error: 'Guest not found' });

      const updated = await awardPoints(tenantId, guestId, points, description, bookingId);
      return ok(reply, updated);
    },
  });

  // ── POST /api/loyalty/accounts/:guestId/redeem ────────────────────────────
  app.post('/accounts/:guestId/redeem', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { guestId } = request.params as { guestId: string };
      const { points, description, bookingId } = z.object({
        points: z.number().int().positive(),
        description: z.string().min(1),
        bookingId: z.string().optional(),
      }).parse(request.body);

      const guest = await prisma.guest.findFirst({ where: { id: guestId, tenantId } });
      if (!guest) return reply.status(404).send({ error: 'Guest not found' });

      try {
        const result = await redeemPoints(tenantId, guestId, points, description, bookingId);
        return ok(reply, result);
      } catch (e: any) {
        return reply.status(400).send({ error: e.message });
      }
    },
  });

  // ── POST /api/loyalty/accounts/:guestId/adjust ────────────────────────────
  // Admin manual adjustment (positive or negative)
  app.post('/accounts/:guestId/adjust', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER', 'RECEPTIONIST')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { guestId } = request.params as { guestId: string };
      const { points, description } = z.object({
        points: z.number().int(),
        description: z.string().min(1),
      }).parse(request.body);

      const account = await prisma.loyaltyAccount.findUnique({ where: { guestId } });
      if (!account || account.tenantId !== tenantId) {
        return reply.status(404).send({ error: 'Loyalty account not found' });
      }

      const newBalance = Math.max(0, account.points + points);
      const newLifetime = points > 0 ? account.lifetimePoints + points : account.lifetimePoints;

      const prog = await prisma.loyaltyProgram.findUnique({ where: { tenantId } });
      const newTier = prog ? (calcTier(newLifetime, prog) as any) : account.tier;

      await prisma.$transaction([
        prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: { points: newBalance, lifetimePoints: newLifetime, tier: newTier },
        }),
        prisma.loyaltyTransaction.create({
          data: {
            tenantId,
            accountId: account.id,
            type: 'ADJUST',
            points,
            description,
          },
        }),
      ]);

      const updated = await prisma.loyaltyAccount.findUnique({
        where: { id: account.id },
        include: { guest: { select: { firstName: true, lastName: true, email: true } } },
      });
      return ok(reply, updated);
    },
  });

  // ── GET /api/loyalty/leaderboard ──────────────────────────────────────────
  app.get('/leaderboard', {
    schema: { tags: ['loyalty'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const accounts = await prisma.loyaltyAccount.findMany({
        where: { tenantId },
        include: {
          guest: { select: { firstName: true, lastName: true } },
        },
        orderBy: { lifetimePoints: 'desc' },
        take: 10,
      });
      return ok(reply, accounts);
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const PAYOUT_METHODS = ['BANK_TRANSFER', 'BKASH', 'CASH', 'OTHER'] as const;

export async function shareholderRoutes(app: FastifyInstance) {
  // GET /api/shareholders — owner view: everyone's %, joined date, last payout
  app.get('/', {
    schema: { tags: ['shareholders'], summary: 'List all shareholders', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const { db } = request;
      const [profiles, pendingInvites] = await Promise.all([
        db.shareholderProfile.findMany({
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            payouts: { orderBy: { paidAt: 'desc' }, take: 1 },
          },
          orderBy: { ownershipPercent: 'desc' },
        }),
        db.staffInvite.findMany({
          where: { role: 'SHAREHOLDER', used: false, expiresAt: { gt: new Date() } },
          select: { id: true, email: true, ownershipPercent: true, createdAt: true, expiresAt: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      const acceptedAllocated = profiles.reduce((sum, p) => sum + p.ownershipPercent, 0);
      const pendingAllocated = pendingInvites.reduce((sum, i) => sum + (i.ownershipPercent ?? 0), 0);
      const totalAllocated = acceptedAllocated + pendingAllocated;
      return ok({
        shareholders: profiles.map((p) => ({
          id: p.id,
          user: p.user,
          ownershipPercent: p.ownershipPercent,
          investedAmount: p.investedAmount,
          joinedAt: p.joinedAt,
          notes: p.notes,
          lastPayout: p.payouts[0] ?? null,
        })),
        pendingInvites,
        totalAllocated,
        remaining: Math.max(0, 100 - totalAllocated),
      });
    },
  });

  // GET /api/shareholders/summary — allocation + this month's profit pool
  app.get('/summary', {
    schema: { tags: ['shareholders'], summary: 'Shareholder allocation summary', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const { db } = request;
      const agg = await db.shareholderProfile.aggregate({ _sum: { ownershipPercent: true }, _count: true });
      const totalAllocated = agg._sum.ownershipPercent ?? 0;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [revenue, expenses] = await Promise.all([
        db.payment.aggregate({ where: { status: 'PAID', processedAt: { gte: startOfMonth } }, _sum: { amount: true } }),
        db.expense.aggregate({ where: { date: { gte: startOfMonth } }, _sum: { amount: true } }),
      ]);
      const netProfit = Number(revenue._sum.amount || 0) - Number(expenses._sum.amount || 0);

      return ok({
        shareholderCount: agg._count,
        totalAllocated,
        remaining: Math.max(0, 100 - totalAllocated),
        netProfitThisMonth: netProfit,
      });
    },
  });

  // PATCH /api/shareholders/:id — update ownership % or notes
  app.patch('/:id', {
    schema: { tags: ['shareholders'], summary: 'Update a shareholder profile', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = z.object({
        ownershipPercent: z.number().min(0.01).max(100).optional(),
        notes: z.string().optional(),
      }).parse(request.body);

      if (body.ownershipPercent !== undefined) {
        // Use the same per-tenant lock as shareholder invites. This prevents a
        // simultaneous profile edit and invite from taking total ownership over 100%.
        const result = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "tenants" WHERE "id" = ${tenantId} FOR UPDATE`;

          const existing = await tx.shareholderProfile.findFirst({ where: { id, tenantId } });
          if (!existing) return { ok: false as const, error: 'Shareholder not found', status: 404 };

          const [others, pendingInvites] = await Promise.all([
            tx.shareholderProfile.aggregate({
              where: { tenantId, id: { not: id } },
              _sum: { ownershipPercent: true },
            }),
            tx.staffInvite.aggregate({
              where: { tenantId, role: 'SHAREHOLDER', used: false, expiresAt: { gt: new Date() } },
              _sum: { ownershipPercent: true },
            }),
          ]);
          const otherTotal = (others._sum.ownershipPercent ?? 0) + (pendingInvites._sum.ownershipPercent ?? 0);
          if (otherTotal + body.ownershipPercent! > 100) {
            const remaining = Math.max(0, 100 - otherTotal);
            return { ok: false as const, error: `Only ${remaining.toFixed(2)}% ownership available.`, status: 400 };
          }

          const updated = await tx.shareholderProfile.update({ where: { id }, data: body });
          return { ok: true as const, updated };
        });

        if (!result.ok) {
          return reply.status(result.status).send({ success: false, error: result.error });
        }
        return ok(result.updated, 'Shareholder updated');
      }

      const existing = await db.shareholderProfile.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Shareholder not found' });
      const updated = await db.shareholderProfile.update({ where: { id }, data: body });
      return ok(updated, 'Shareholder updated');
    },
  });

  // DELETE /api/shareholders/:id — remove shareholder (payout history cascades)
  app.delete('/:id', {
    schema: { tags: ['shareholders'], summary: 'Remove a shareholder', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.shareholderProfile.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Shareholder not found' });
      await db.shareholderProfile.delete({ where: { id } });
      return ok(null, 'Shareholder removed');
    },
  });

  // POST /api/shareholders/:id/payouts — record a payout
  app.post('/:id/payouts', {
    schema: { tags: ['shareholders'], summary: 'Record a payout', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = z.object({
        amount: z.number().positive(),
        method: z.enum(PAYOUT_METHODS),
        paidAt: z.string().min(1),
        note: z.string().optional(),
      }).parse(request.body);

      const profile = await db.shareholderProfile.findUnique({ where: { id } });
      if (!profile) return reply.status(404).send({ success: false, error: 'Shareholder not found' });

      const payout = await db.payout.create({
        data: {
          shareholderProfileId: id,
          amount: body.amount,
          method: body.method,
          paidAt: new Date(body.paidAt),
          note: body.note,
          recordedBy: userId,
        },
      });
      return reply.status(201).send(ok(payout, 'Payout recorded'));
    },
  });

  // GET /api/shareholders/:id/payouts — payout history for one shareholder
  app.get('/:id/payouts', {
    schema: { tags: ['shareholders'], summary: 'Payout history for a shareholder', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const payouts = await db.payout.findMany({
        where: { shareholderProfileId: id },
        orderBy: { paidAt: 'desc' },
      });
      return ok(payouts);
    },
  });

  // DELETE /api/shareholders/:id/payouts/:payoutId — remove a wrongly-entered payout
  app.delete('/:id/payouts/:payoutId', {
    schema: { tags: ['shareholders'], summary: 'Delete a payout entry', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id, payoutId } = request.params as { id: string; payoutId: string };
      const payout = await db.payout.findUnique({ where: { id: payoutId } });
      if (!payout || payout.shareholderProfileId !== id) {
        return reply.status(404).send({ success: false, error: 'Payout not found' });
      }
      await db.payout.delete({ where: { id: payoutId } });
      return ok(null, 'Payout deleted');
    },
  });

  // ── Self-service (SHAREHOLDER role — own data only) ──────────────────────

  // GET /api/shareholders/me — own ownership % + this month's estimated share
  app.get('/me', {
    schema: { tags: ['shareholders'], summary: "Current user's own shareholder profile", security: [{ bearerAuth: [] }] },
    preHandler: requireRole('SHAREHOLDER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const profile = await db.shareholderProfile.findFirst({ where: { userId } });
      if (!profile) return reply.status(404).send({ success: false, error: 'No shareholder profile found' });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [revenue, expenses] = await Promise.all([
        db.payment.aggregate({ where: { status: 'PAID', processedAt: { gte: startOfMonth } }, _sum: { amount: true } }),
        db.expense.aggregate({ where: { date: { gte: startOfMonth } }, _sum: { amount: true } }),
      ]);
      const netProfit = Number(revenue._sum.amount || 0) - Number(expenses._sum.amount || 0);
      const estimatedShare = Math.max(0, netProfit) * (profile.ownershipPercent / 100);

      return ok({
        ownershipPercent: profile.ownershipPercent,
        joinedAt: profile.joinedAt,
        netProfitThisMonth: netProfit,
        estimatedShareThisMonth: estimatedShare,
      });
    },
  });

  // GET /api/shareholders/me/payouts — own payout history
  app.get('/me/payouts', {
    schema: { tags: ['shareholders'], summary: "Current user's own payout history", security: [{ bearerAuth: [] }] },
    preHandler: requireRole('SHAREHOLDER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const profile = await db.shareholderProfile.findFirst({ where: { userId } });
      if (!profile) return reply.status(404).send({ success: false, error: 'No shareholder profile found' });

      const payouts = await db.payout.findMany({
        where: { shareholderProfileId: profile.id },
        orderBy: { paidAt: 'desc' },
      });
      return ok(payouts);
    },
  });
}

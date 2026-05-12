/**
 * Super Admin Routes — /api/admin/*
 *
 * Protected by SUPER_ADMIN_EMAILS env var.
 * Login via POST /api/admin/login (email + password only, no slug).
 * All other routes require a super-admin JWT (isSuperAdmin: true).
 */
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@resort-pro/database';
import { ok } from '../utils/response';

// ── Helpers ────────────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isSuperAdminEmail(email: string) {
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

async function requireSuperAdmin(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
  if (!request.user?.isSuperAdmin) {
    return reply.status(403).send({ success: false, error: 'Super admin access required' });
  }
}

export async function adminRoutes(app: FastifyInstance) {
  // ── POST /api/admin/login ──────────────────────────────────────────────
  // Separate login — no slug needed, just email + password
  app.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.status(400).send({ success: false, error: 'Email and password required' });
    }

    if (!isSuperAdminEmail(email)) {
      return reply.status(401).send({ success: false, error: 'Invalid admin credentials' });
    }

    // Find any user record with this email (across tenants — pick first)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { tenant: true },
    });

    if (!user) {
      return reply.status(401).send({ success: false, error: 'Invalid admin credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ success: false, error: 'Invalid admin credentials' });
    }

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId, isSuperAdmin: true },
      { expiresIn: '8h' }
    );

    return reply.send({
      success: true,
      data: {
        token,
        admin: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      },
    });
  });

  // ── GET /api/admin/stats ───────────────────────────────────────────────
  app.get('/stats', { preHandler: requireSuperAdmin }, async (_req, reply) => {
    const [
      totalTenants,
      activeTenants,
      trialingTenants,
      paidTenants,
      suspendedTenants,
      totalUsers,
      totalBookings,
      totalRooms,
      recentTenants,
      planBreakdown,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.tenant.count({ where: { planStatus: 'trialing' } }),
      prisma.tenant.count({ where: { planStatus: 'active' } }),
      prisma.tenant.count({ where: { isActive: false } }),
      prisma.user.count(),
      prisma.booking.count(),
      prisma.room.count(),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, plan: true, planStatus: true, createdAt: true, isActive: true },
      }),
      prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    ]);

    // Rough MRR estimate from active paid plans
    const planPrices: Record<string, number> = { STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199, FREE: 0 };
    const mrr = planBreakdown.reduce((sum, p) => {
      return sum + (planPrices[p.plan] || 0) * (p._count._all || 0);
    }, 0);

    return reply.send({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        trialingTenants,
        paidTenants,
        suspendedTenants,
        totalUsers,
        totalBookings,
        totalRooms,
        mrr,
        recentTenants,
        planBreakdown: planBreakdown.map((p) => ({ plan: p.plan, count: p._count._all })),
      },
    });
  });

  // ── GET /api/admin/tenants ─────────────────────────────────────────────
  app.get<{ Querystring: { page?: string; search?: string; plan?: string; status?: string } }>(
    '/tenants',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1');
      const limit = 20;
      const skip = (page - 1) * limit;
      const { search, plan, status } = request.query;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (plan) where.plan = plan;
      if (status === 'active') where.isActive = true;
      if (status === 'suspended') where.isActive = false;
      if (status === 'trialing') where.planStatus = 'trialing';
      if (status === 'paid') where.planStatus = 'active';

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            planStatus: true,
            isActive: true,
            email: true,
            phone: true,
            currency: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            stripeCustomerId: true,
            createdAt: true,
            _count: { select: { users: true, rooms: true, bookings: true } },
          },
        }),
        prisma.tenant.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: { tenants, total, page, pages: Math.ceil(total / limit) },
      });
    }
  );

  // ── GET /api/admin/tenants/:id ─────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/tenants/:id',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
        include: {
          _count: { select: { users: true, rooms: true, bookings: true, guests: true } },
          users: {
            where: { role: 'OWNER' },
            select: { id: true, firstName: true, lastName: true, email: true, lastLoginAt: true },
            take: 5,
          },
          bookings: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true, confirmationNo: true, status: true, paymentStatus: true,
              totalAmount: true, createdAt: true,
            },
          },
        },
      });

      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      return reply.send({ success: true, data: tenant });
    }
  );

  // ── PATCH /api/admin/tenants/:id ───────────────────────────────────────
  app.patch<{
    Params: { id: string };
    Body: { plan?: string; planStatus?: string; isActive?: boolean; trialEndsAt?: string };
  }>('/tenants/:id', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { plan, planStatus, isActive, trialEndsAt } = request.body;

    const data: any = {};
    if (plan !== undefined) data.plan = plan;
    if (planStatus !== undefined) data.planStatus = planStatus;
    if (isActive !== undefined) data.isActive = isActive;
    if (trialEndsAt !== undefined) data.trialEndsAt = new Date(trialEndsAt);

    const updated = await prisma.tenant.update({ where: { id }, data });
    return reply.send({ success: true, data: updated });
  });

  // ── DELETE /api/admin/tenants/:id — soft delete (suspend) ──────────────
  app.delete<{ Params: { id: string } }>(
    '/tenants/:id',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      await prisma.tenant.update({
        where: { id: request.params.id },
        data: { isActive: false },
      });
      return reply.send({ success: true, data: { message: 'Tenant suspended' } });
    }
  );

  // ── POST /api/admin/tenants/:id/impersonate ────────────────────────────
  // Returns a short-lived JWT for the tenant's OWNER — so admin can log in as them
  app.post<{ Params: { id: string } }>(
    '/tenants/:id/impersonate',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const owner = await prisma.user.findFirst({
        where: { tenantId: request.params.id, role: 'OWNER' },
        include: { tenant: true },
      });

      if (!owner) {
        return reply.status(404).send({ success: false, error: 'No owner found for this tenant' });
      }

      const token = app.jwt.sign(
        {
          sub: owner.id,
          email: owner.email,
          role: owner.role,
          tenantId: owner.tenantId,
          impersonatedBy: (request.user as any).email,
        },
        { expiresIn: '2h' }
      );

      // Also create a refresh token so the impersonated session works
      const refreshToken = app.jwt.sign({ sub: owner.id, type: 'refresh' }, { expiresIn: '2h' });
      await prisma.refreshToken.create({
        data: {
          userId: owner.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });

      return reply.send({
        success: true,
        data: {
          token,
          refreshToken,
          user: { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName, role: owner.role },
          tenant: { id: owner.tenant.id, name: owner.tenant.name, slug: owner.tenant.slug, plan: owner.tenant.plan },
        },
      });
    }
  );

  // ── GET /api/admin/users ───────────────────────────────────────────────
  app.get<{ Querystring: { page?: string; search?: string; role?: string } }>(
    '/users',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1');
      const limit = 25;
      const skip = (page - 1) * limit;
      const { search, role } = request.query;

      const where: any = {};
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (role) where.role = role;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            role: true, isActive: true, lastLoginAt: true, createdAt: true,
            tenant: { select: { name: true, slug: true, plan: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: { users, total, page, pages: Math.ceil(total / limit) },
      });
    }
  );

  // ── GET /api/admin/billing ─────────────────────────────────────────────
  app.get('/billing', { preHandler: requireSuperAdmin }, async (_req, reply) => {
    const [planBreakdown, recentPaid, trialExpiringSoon] = await Promise.all([
      prisma.tenant.groupBy({ by: ['plan', 'planStatus'], _count: { _all: true } }),
      prisma.tenant.findMany({
        where: { planStatus: 'active' },
        orderBy: { currentPeriodEnd: 'asc' },
        take: 10,
        select: { id: true, name: true, slug: true, plan: true, currentPeriodEnd: true, stripeCustomerId: true },
      }),
      prisma.tenant.findMany({
        where: {
          planStatus: 'trialing',
          trialEndsAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          isActive: true,
        },
        orderBy: { trialEndsAt: 'asc' },
        select: { id: true, name: true, slug: true, email: true, trialEndsAt: true },
      }),
    ]);

    const planPrices: Record<string, number> = { STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199, FREE: 0 };
    const activePaidRows = planBreakdown.filter((r) => r.planStatus === 'active');
    const mrr = activePaidRows.reduce((sum, r) => sum + (planPrices[r.plan] || 0) * r._count._all, 0);

    return reply.send({
      success: true,
      data: { mrr, planBreakdown, recentPaid, trialExpiringSoon },
    });
  });

  // ── GET /api/admin/me ──────────────────────────────────────────────────
  app.get('/me', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const user = request.user as any;
    return reply.send({ success: true, data: { email: user.email, isSuperAdmin: true } });
  });
}

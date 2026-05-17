/**
 * Super Admin Routes — /api/admin/*
 *
 * DB-based auth via AdminUser model (T-16).
 * Roles: SUPER_ADMIN | SUPPORT | FINANCE | VIEWER
 * Login via POST /api/admin/login (email + password only, no slug).
 * All other routes require a valid admin JWT checked by requireAdminRole().
 */
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '@resort-pro/database';
import { ok } from '../utils/response';
import { createAdminNotification } from '../utils/notifications';
import { computeChurnRisk } from '../utils/churn';
import { FLAG_REGISTRY, FLAG_MAP } from '../utils/feature-flags';
import { anonymizeTenant, collectTenantExport, getPendingErasures } from '../utils/gdpr';
import { metrics } from '../utils/metrics';
import { getStorageConfig, invalidateStorageCache, uploadToStorage, deleteFromStorage, type StorageConfig } from '../services/storage';

// ── Role definitions ───────────────────────────────────────────────────────
type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'FINANCE' | 'VIEWER';

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  SUPPORT: 3,
  FINANCE: 2,
  VIEWER: 1,
};

// Route → minimum roles allowed (checked in requireAdminRole)
const ROUTE_PERMISSIONS: Record<string, AdminRole[]> = {
  // Write / destructive — SUPER_ADMIN only
  impersonate:    ['SUPER_ADMIN'],
  suspend:        ['SUPER_ADMIN'],
  reactivate:     ['SUPER_ADMIN'],
  plan_change:    ['SUPER_ADMIN'],
  settings_change:['SUPER_ADMIN'],
  theme_update:   ['SUPER_ADMIN'],
  theme_toggle:   ['SUPER_ADMIN'],
  admin_team:     ['SUPER_ADMIN'],
  // Support tasks
  extend_trial:   ['SUPER_ADMIN', 'SUPPORT'],
  // Finance tasks
  export:         ['SUPER_ADMIN', 'FINANCE'],
  billing:        ['SUPER_ADMIN', 'FINANCE'],
  // Read access — all roles
  read:           ['SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER'],
};

/** Verify JWT and check role. Pass no roles arg to require any valid admin. */
function requireAdminRole(roles: AdminRole[] = ['SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER']) {
  return async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
    // Support both new tokens (adminRole field) and old tokens (isSuperAdmin bool)
    const adminRole = (request.user?.adminRole ??
      (request.user?.isSuperAdmin ? 'SUPER_ADMIN' : undefined)) as AdminRole | undefined;
    if (!adminRole) {
      return reply.status(403).send({ success: false, error: 'Admin access required' });
    }
    if (!roles.includes(adminRole)) {
      return reply.status(403).send({ success: false, error: `Requires role: ${roles.join(' or ')}` });
    }
  };
}

// Keep legacy alias so existing preHandlers still compile during migration
const requireSuperAdmin = requireAdminRole(['SUPER_ADMIN']);

// ── Audit Log Helper ──────────────────────────────────────────────────────────
async function logAdminAction({
  adminEmail,
  action,
  targetType,
  targetId,
  targetName,
  metadata,
  ipAddress,
}: {
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: { adminEmail, action, targetType, targetId, targetName, metadata: (metadata ?? undefined) as any, ipAddress },
    });
  } catch {
    // Never let logging failure break the main operation
  }
}

export async function adminRoutes(app: FastifyInstance) {
  // ── POST /api/admin/login ──────────────────────────────────────────────
  // DB-based admin auth — queries AdminUser table, not tenant users
  app.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.status(400).send({ success: false, error: 'Email and password required' });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!adminUser || !adminUser.isActive) {
      return reply.status(401).send({ success: false, error: 'Invalid admin credentials' });
    }

    const valid = await bcrypt.compare(password, adminUser.passwordHash);
    if (!valid) {
      return reply.status(401).send({ success: false, error: 'Invalid admin credentials' });
    }

    // Update lastLoginAt
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });

    const token = app.jwt.sign(
      {
        sub: adminUser.id,
        email: adminUser.email,
        adminRole: adminUser.role,  // new field — replaces isSuperAdmin bool
        isSuperAdmin: adminUser.role === 'SUPER_ADMIN', // backward compat
      },
      { expiresIn: '8h' }
    );

    return reply.send({
      success: true,
      data: {
        token,
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: adminUser.role,
        },
      },
    });
  });

  // ── GET /api/admin/stats ───────────────────────────────────────────────
  app.get('/stats', { preHandler: requireAdminRole() }, async (_req, reply) => {
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
        take: 8,
        select: { id: true, name: true, slug: true, plan: true, planStatus: true, createdAt: true, isActive: true, trialEndsAt: true },
      }),
      prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    ]);

    // Get MRR from platform settings plan prices
    const platformSettings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const settingsPlans = (platformSettings?.plans ?? []) as Array<{ key: string; price: number }>;
    const planPrices: Record<string, number> = { FREE: 0 };
    for (const p of settingsPlans) planPrices[p.key] = p.price;
    // Fallback hardcoded prices
    if (!planPrices.STARTER) planPrices.STARTER = 49;
    if (!planPrices.PROFESSIONAL) planPrices.PROFESSIONAL = 99;
    if (!planPrices.ENTERPRISE) planPrices.ENTERPRISE = 199;

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
    { preHandler: requireAdminRole() },
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

      const now = new Date();
      const last30Start = new Date(now.getTime() - 30 * 86_400_000);
      const prev30Start = new Date(now.getTime() - 60 * 86_400_000);

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
            users: {
              where: { role: 'OWNER' },
              select: { lastLoginAt: true },
              take: 1,
            },
            bookings: {
              where: { createdAt: { gte: prev30Start } },
              select: { createdAt: true },
            },
          },
        }),
        prisma.tenant.count({ where }),
      ]);

      // Attach churn risk to each tenant
      const tenantsWithRisk = tenants.map(t => {
        const ownerLastLoginAt = t.users[0]?.lastLoginAt ?? null;
        const bookingsLast30 = t.bookings.filter(b => b.createdAt >= last30Start).length;
        const bookingsPrev30 = t.bookings.filter(b => b.createdAt < last30Start).length;
        const churnRisk = computeChurnRisk({
          ownerLastLoginAt,
          bookingsLast30Days: bookingsLast30,
          bookingsPrev30Days: bookingsPrev30,
          tenantCreatedAt: t.createdAt,
          isActive: t.isActive,
        });
        // Strip raw arrays before sending
        const { users: _u, bookings: _b, ...rest } = t;
        return { ...rest, churnRisk, ownerLastLoginAt };
      });

      return reply.send({
        success: true,
        data: { tenants: tenantsWithRisk, total, page, pages: Math.ceil(total / limit) },
      });
    }
  );

  // ── GET /api/admin/tenants/:id ─────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/tenants/:id',
    { preHandler: requireAdminRole() },
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

    const before = await prisma.tenant.findUnique({
      where: { id },
      select: { name: true, plan: true, planStatus: true, isActive: true },
    });

    const data: any = {};
    if (plan !== undefined) data.plan = plan;
    if (planStatus !== undefined) data.planStatus = planStatus;
    if (isActive !== undefined) data.isActive = isActive;
    if (trialEndsAt !== undefined) data.trialEndsAt = new Date(trialEndsAt);

    const updated = await prisma.tenant.update({ where: { id }, data });

    const adminUser = request.user as any;
    const action = plan && before?.plan !== plan ? 'plan_change'
      : isActive === true ? 'reactivate'
      : isActive === false ? 'suspend'
      : 'tenant_update';
    await logAdminAction({
      adminEmail: adminUser.email,
      action,
      targetType: 'tenant',
      targetId: id,
      targetName: before?.name,
      metadata: { before: { plan: before?.plan, planStatus: before?.planStatus, isActive: before?.isActive }, after: data },
      ipAddress: request.ip,
    });

    return reply.send({ success: true, data: updated });
  });

  // ── DELETE /api/admin/tenants/:id — soft delete (suspend) ──────────────
  app.delete<{ Params: { id: string } }>(
    '/tenants/:id',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
        select: { name: true },
      });
      await prisma.tenant.update({
        where: { id: request.params.id },
        data: { isActive: false },
      });
      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'suspend',
        targetType: 'tenant',
        targetId: request.params.id,
        targetName: tenant?.name,
        ipAddress: request.ip,
      });
      await createAdminNotification({
        type: 'account_suspended',
        title: 'Account suspended',
        message: `${tenant?.name ?? 'A tenant'} was manually suspended by ${adminUser.email}.`,
        metadata: { tenantId: request.params.id, tenantName: tenant?.name, suspendedBy: adminUser.email },
        linkPath: `/admin/tenants`,
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

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'impersonate',
        targetType: 'tenant',
        targetId: request.params.id,
        targetName: owner.tenant.name,
        metadata: { ownerEmail: owner.email, ownerName: `${owner.firstName} ${owner.lastName}` },
        ipAddress: request.ip,
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
    { preHandler: requireAdminRole() },
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
  app.get('/billing', { preHandler: requireAdminRole(['SUPER_ADMIN', 'FINANCE']) }, async (_req, reply) => {
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
  app.get('/me', { preHandler: requireAdminRole() }, async (request, reply) => {
    const user = request.user as any;
    // Fetch fresh data from DB
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    if (!adminUser || !adminUser.isActive) {
      return reply.status(401).send({ success: false, error: 'Admin account not found or inactive' });
    }
    return reply.send({ success: true, data: { ...adminUser, isSuperAdmin: adminUser.role === 'SUPER_ADMIN' } });
  });

  // ── GET /api/admin/tenants/:id/export ─────────────────────────────────
  // Full data export for a tenant (JSON format). Admin can download from UI.
  app.get<{ Params: { id: string } }>(
    '/tenants/:id/export',
    { preHandler: requireAdminRole(['SUPER_ADMIN', 'FINANCE']) },
    async (request, reply) => {
      const { id } = request.params;

      const [tenant, rooms, bookings, guests, users] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id },
          select: {
            id: true, name: true, slug: true, plan: true, planStatus: true,
            trialEndsAt: true, billingEmail: true, createdAt: true,
          },
        }),
        prisma.room.findMany({ where: { tenantId: id }, select: { id: true, name: true, type: true, floor: true, status: true, basePrice: true } }),
        prisma.booking.findMany({
          where: { tenantId: id },
          select: {
            id: true, confirmationNo: true, status: true, checkIn: true, checkOut: true,
            totalAmount: true, paidAmount: true, createdAt: true,
            guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
            room: { select: { name: true } },
          },
        }),
        prisma.guest.findMany({
          where: { tenantId: id },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, nationality: true, createdAt: true },
        }),
        prisma.user.findMany({
          where: { tenantId: id },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
        }),
      ]);

      if (!tenant) {
        return reply.status(404).send({ success: false, error: 'Tenant not found' });
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: 'ResortPro Super Admin',
        tenant,
        summary: {
          totalRooms: rooms.length,
          totalBookings: bookings.length,
          totalGuests: guests.length,
          totalUsers: users.length,
        },
        rooms,
        bookings,
        guests,
        users,
      };

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'export',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        metadata: { summary: exportData.summary },
        ipAddress: request.ip,
      });

      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="resortpro-export-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.json"`);
      return reply.send(exportData);
    },
  );

  // ── POST /api/admin/tenants/:id/extend-trial ──────────────────────────
  // Extend trial by N days
  app.post<{ Params: { id: string }; Body: { days: number } }>(
    '/tenants/:id/extend-trial',
    { preHandler: requireAdminRole(['SUPER_ADMIN', 'SUPPORT']) },
    async (request, reply) => {
      const { id } = request.params;
      const { days } = request.body || {};

      if (!days || days < 1 || days > 365) {
        return reply.status(400).send({ success: false, error: 'days must be 1–365' });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date()
        ? tenant.trialEndsAt   // extend from current end
        : new Date();          // extend from today if already expired

      const newTrialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

      const updated = await prisma.tenant.update({
        where: { id },
        data: {
          trialEndsAt: newTrialEndsAt,
          planStatus: 'trialing', // re-activate trial status
          isActive: true,
        },
      });

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'extend_trial',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        metadata: { days, newTrialEndsAt: newTrialEndsAt.toISOString() },
        ipAddress: request.ip,
      });

      return reply.send(ok({ trialEndsAt: updated.trialEndsAt }, `Trial extended by ${days} days`));
    },
  );

  // ── CSV helpers ───────────────────────────────────────────────────────────────

  function escCsv(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function toCsv(headers: string[], rows: unknown[][]): string {
    const head = headers.map(escCsv).join(',');
    const body = rows.map(r => r.map(escCsv).join(',')).join('\n');
    return `${head}\n${body}`;
  }

  function csvReply(reply: any, filename: string, csv: string) {
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send('﻿' + csv); // BOM for Excel UTF-8
  }

  // ── GET /api/admin/export/tenants-csv ─────────────────────────────────────
  app.get('/export/tenants-csv', { preHandler: requireAdminRole(['SUPER_ADMIN', 'FINANCE']) }, async (_req, reply) => {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, plan: true, planStatus: true, isActive: true,
        email: true, billingEmail: true, phone: true, currency: true,
        stripeCustomerId: true, stripeSubscriptionId: true,
        trialEndsAt: true, currentPeriodEnd: true, createdAt: true, updatedAt: true,
        _count: { select: { users: true, rooms: true, bookings: true, guests: true } },
      },
    });
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199 };
    const headers = [
      'ID', 'Name', 'Slug', 'Plan', 'Plan Status', 'Active',
      'Email', 'Billing Email', 'Phone', 'Currency', 'MRR ($)',
      'Stripe Customer ID', 'Stripe Subscription ID',
      'Trial Ends At', 'Current Period End',
      'Users', 'Rooms', 'Bookings', 'Guests', 'Joined', 'Updated',
    ];
    const rows = tenants.map(t => [
      t.id, t.name, t.slug, t.plan, t.planStatus, t.isActive ? 'Yes' : 'No',
      t.email, t.billingEmail, t.phone, t.currency, PRICES[t.plan] ?? 0,
      t.stripeCustomerId, t.stripeSubscriptionId,
      t.trialEndsAt?.toISOString() ?? '', t.currentPeriodEnd?.toISOString() ?? '',
      t._count.users, t._count.rooms, t._count.bookings, t._count.guests,
      t.createdAt.toISOString(), t.updatedAt.toISOString(),
    ]);
    const date = new Date().toISOString().slice(0, 10);
    return csvReply(reply, `resortpro-tenants-${date}.csv`, toCsv(headers, rows));
  });

  // ── GET /api/admin/export/revenue-csv ─────────────────────────────────────
  app.get('/export/revenue-csv', { preHandler: requireAdminRole(['SUPER_ADMIN', 'FINANCE']) }, async (_req, reply) => {
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199 };
    const paidTenants = await prisma.tenant.findMany({
      where: { planStatus: { in: ['active', 'past_due'] }, plan: { not: 'FREE' } },
      select: { plan: true, planStatus: true, trialEndsAt: true, createdAt: true },
    });
    const now = new Date();
    const monthRows: unknown[][] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const active = paidTenants.filter(t => {
        const conv = t.trialEndsAt ?? new Date(t.createdAt.getTime() + 14 * 86_400_000);
        return conv <= end;
      });
      const newThisMonth = paidTenants.filter(t => {
        const conv = t.trialEndsAt ?? new Date(t.createdAt.getTime() + 14 * 86_400_000);
        return conv >= start && conv <= end;
      });
      monthRows.push([
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label,
        active.reduce((s, t) => s + (PRICES[t.plan] ?? 0), 0),
        newThisMonth.reduce((s, t) => s + (PRICES[t.plan] ?? 0), 0),
        active.length,
      ]);
    }
    const headers = ['Month', 'Label', 'MRR ($)', 'New MRR ($)', 'Paying Customers'];
    const date = new Date().toISOString().slice(0, 10);
    return csvReply(reply, `resortpro-revenue-${date}.csv`, toCsv(headers, monthRows));
  });

  // ── GET /api/admin/tenants/:id/export-csv ─────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/tenants/:id/export-csv',
    { preHandler: requireAdminRole(['SUPER_ADMIN', 'FINANCE']) },
    async (request, reply) => {
      const { id } = request.params;
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { name: true, slug: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const bookings = await prisma.booking.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          confirmationNo: true, status: true, paymentStatus: true,
          checkIn: true, checkOut: true,
          totalAmount: true, paidAmount: true,
          adults: true, children: true, notes: true, createdAt: true,
          guest: { select: { firstName: true, lastName: true, email: true, phone: true, nationality: true } },
          room: { select: { name: true, type: true, floor: true } },
        },
      });

      const headers = [
        'Confirmation #', 'Status', 'Payment Status',
        'Check In', 'Check Out', 'Nights',
        'Total ($)', 'Paid ($)', 'Adults', 'Children',
        'Guest First Name', 'Guest Last Name', 'Guest Email', 'Guest Phone', 'Guest Nationality',
        'Room', 'Room Type', 'Floor', 'Notes', 'Created At',
      ];
      const rows = bookings.map(b => {
        const nights = b.checkIn && b.checkOut
          ? Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86_400_000)
          : '';
        return [
          b.confirmationNo, b.status, b.paymentStatus,
          b.checkIn?.toISOString().slice(0, 10) ?? '', b.checkOut?.toISOString().slice(0, 10) ?? '',
          nights, b.totalAmount, b.paidAmount, b.adults, b.children,
          b.guest?.firstName ?? '', b.guest?.lastName ?? '',
          b.guest?.email ?? '', b.guest?.phone ?? '', b.guest?.nationality ?? '',
          b.room?.name ?? '', b.room?.type ?? '', b.room?.floor ?? '',
          b.notes ?? '', b.createdAt.toISOString(),
        ];
      });

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'export',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        metadata: { format: 'csv', rowCount: bookings.length },
        ipAddress: request.ip,
      });

      const date = new Date().toISOString().slice(0, 10);
      return csvReply(reply, `resortpro-${tenant.slug}-bookings-${date}.csv`, toCsv(headers, rows));
    }
  );

  // ── Platform Settings helpers ──────────────────────────────────────────────

  const DEFAULT_PLANS = [
    {
      key: 'STARTER',
      name: 'Starter',
      price: 49,
      roomLimit: 20,
      features: ['Up to 20 rooms', 'Booking management', 'Guest CRM', 'Website builder', 'Email support'],
    },
    {
      key: 'PROFESSIONAL',
      name: 'Professional',
      price: 99,
      roomLimit: 100,
      features: ['Up to 100 rooms', 'Everything in Starter', 'Staff invites', 'Priority support', 'Advanced analytics'],
    },
    {
      key: 'ENTERPRISE',
      name: 'Enterprise',
      price: 199,
      roomLimit: -1,
      features: ['Unlimited rooms', 'Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    },
  ];

  async function getOrCreateSettings() {
    let settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: 'singleton', trialDays: 14, plans: DEFAULT_PLANS },
      });
    }
    return settings;
  }

  // ── GET /api/admin/mrr-growth ─────────────────────────────────────────────
  // DB-derived MRR timeline — works without live Stripe.
  // Uses trialEndsAt as conversion date proxy for active paying tenants.
  app.get('/mrr-growth', { preHandler: requireAdminRole(['SUPER_ADMIN', 'FINANCE']) }, async (_req, reply) => {
    const PLAN_PRICES: Record<string, number> = { FREE: 0, STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199 };

    // Fetch all tenants that ever paid (active or canceled)
    const allTenants = await prisma.tenant.findMany({
      where: { plan: { not: 'FREE' } },
      select: {
        id: true,
        plan: true,
        planStatus: true,
        trialEndsAt: true,
        createdAt: true,
        currentPeriodEnd: true,
      },
    });

    // Build 12 monthly buckets (past 12 full months + current)
    const now = new Date();
    const months: Array<{
      month: string;      // "2025-06"
      label: string;      // "Jun 2025"
      start: Date;
      end: Date;
    }> = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      months.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        start: d,
        end,
      });
    }

    // For each tenant, determine their "conversion date" (when they started paying)
    // Proxy: trialEndsAt if available, else createdAt + 14 days
    const paidTenants = allTenants
      .filter(t => t.planStatus === 'active' || t.planStatus === 'past_due')
      .map(t => ({
        ...t,
        conversionDate: t.trialEndsAt ?? new Date(t.createdAt.getTime() + 14 * 86_400_000),
        price: PLAN_PRICES[t.plan] ?? 0,
      }));

    // Compute monthly snapshots
    let prevMrr = 0;
    const monthlyData = months.map(({ month, label, start, end }) => {
      // Paying customers as of end of this month
      const activeThisMonth = paidTenants.filter(t => t.conversionDate <= end);
      const mrr = activeThisMonth.reduce((s, t) => s + t.price, 0);

      // New this month (converted during this month)
      const newThisMonth = paidTenants.filter(t => t.conversionDate >= start && t.conversionDate <= end);
      const newMrr = newThisMonth.reduce((s, t) => s + t.price, 0);

      // Churned = previous month MRR - current + new (i.e. how much was lost)
      const churnedMrr = Math.max(0, prevMrr + newMrr - mrr);

      // Expansion (simplified: upgrades — zero for now since we don't track plan history)
      const expansionMrr = 0;

      const netMrr = newMrr + expansionMrr - churnedMrr;

      prevMrr = mrr;

      return {
        month,
        label,
        mrr,
        newMrr,
        churnedMrr,
        expansionMrr,
        netMrr,
        payingCustomers: activeThisMonth.length,
      };
    });

    // ── Summary metrics ─────────────────────────────────────────────────────
    const currentMrr = monthlyData[monthlyData.length - 1].mrr;
    const lastMonthMrr = monthlyData[monthlyData.length - 2]?.mrr ?? 0;
    const mrrGrowthRate = lastMonthMrr > 0
      ? Math.round(((currentMrr - lastMonthMrr) / lastMonthMrr) * 100)
      : currentMrr > 0 ? 100 : 0;

    const currentPayingCustomers = monthlyData[monthlyData.length - 1].payingCustomers;
    const arpu = currentPayingCustomers > 0 ? Math.round(currentMrr / currentPayingCustomers) : 0;

    // NRR: current MRR from 12-month cohort / 12-month-ago MRR
    // Simplified: (currentMrr / Math.max(monthlyData[0].mrr, 1)) * 100
    const twelveMonthsAgoMrr = monthlyData[0].mrr;
    const nrr = twelveMonthsAgoMrr > 0
      ? Math.round((currentMrr / twelveMonthsAgoMrr) * 100)
      : 100;

    // LTV per plan: ARPU / estimated_monthly_churn_rate
    // Estimated churn: total churned MRR / avg MRR × 100
    const totalChurned = monthlyData.reduce((s, m) => s + m.churnedMrr, 0);
    const avgMrr = monthlyData.reduce((s, m) => s + m.mrr, 0) / monthlyData.length || 1;
    const monthlyChurnRate = Math.min(totalChurned / (avgMrr * 12), 0.5); // cap at 50%

    const ltv: Record<string, number> = {};
    for (const [plan, price] of Object.entries(PLAN_PRICES)) {
      if (price > 0) {
        const rate = monthlyChurnRate > 0 ? monthlyChurnRate : 0.05; // default 5% if no data
        ltv[plan] = Math.round(price / rate);
      }
    }

    return reply.send(ok({
      months: monthlyData,
      metrics: {
        currentMrr,
        arr: currentMrr * 12,
        arpu,
        mrrGrowthRate,
        nrr,
        ltv,
        totalChurnedMrr: totalChurned,
        currentPayingCustomers,
      },
    }));
  });

  // ── GET /api/admin/themes ─────────────────────────────────────────────────
  app.get('/themes', { preHandler: requireAdminRole() }, async (_request, reply) => {
    const themes = await prisma.theme.findMany({ orderBy: { sortOrder: 'asc' } });

    // Count how many WebsiteContent rows use each theme key
    const usageCounts = await prisma.websiteContent.groupBy({
      by: ['templateId'],
      _count: { templateId: true },
    });
    const countMap = Object.fromEntries(
      usageCounts.map(r => [r.templateId ?? 'luxe', r._count.templateId])
    );

    const data = themes.map(t => ({ ...t, usageCount: countMap[t.key] ?? 0 }));
    return reply.send(ok(data));
  });

  // ── PUT /api/admin/themes/:key ─────────────────────────────────────────────
  app.put<{ Params: { key: string }; Body: { name: string; description?: string; previewImage?: string; isActive?: boolean; isPremium?: boolean; sortOrder?: number } }>(
    '/themes/:key',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { key } = request.params;
      const { name, description, previewImage, isActive, isPremium, sortOrder } = request.body;
      const theme = await prisma.theme.upsert({
        where: { key },
        update: { name, description, previewImage, isActive, isPremium, sortOrder },
        create: { key, name, description, previewImage, isActive: isActive ?? true, isPremium: isPremium ?? false, sortOrder: sortOrder ?? 99 },
      });
      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'theme_update',
        targetType: 'theme',
        targetId: key,
        targetName: name,
        metadata: { name, isPremium, isActive, sortOrder },
        ipAddress: request.ip,
      });
      return reply.send(ok(theme, 'Theme saved'));
    }
  );

  // ── PATCH /api/admin/themes/:key/toggle ───────────────────────────────────
  app.patch<{ Params: { key: string } }>(
    '/themes/:key/toggle',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { key } = request.params;
      const theme = await prisma.theme.findUnique({ where: { key } });
      if (!theme) return reply.status(404).send({ success: false, error: 'Theme not found' });
      const updated = await prisma.theme.update({
        where: { key },
        data: { isActive: !theme.isActive },
      });
      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'theme_toggle',
        targetType: 'theme',
        targetId: key,
        targetName: theme.name,
        metadata: { from: theme.isActive, to: updated.isActive },
        ipAddress: request.ip,
      });
      return reply.send(ok(updated, updated.isActive ? 'Theme activated' : 'Theme deactivated'));
    }
  );

  // ── GET /api/admin/settings ────────────────────────────────────────────────
  app.get('/settings', { preHandler: requireSuperAdmin }, async (_request, reply) => {
    const settings = await getOrCreateSettings();
    return reply.send(ok(settings));
  });

  // ── PUT /api/admin/settings ────────────────────────────────────────────────
  app.put<{
    Body: {
      trialDays?: number;
      plans?: Array<{
        key: string;
        name: string;
        price: number;
        roomLimit: number;
        features: string[];
      }>;
    };
  }>('/settings', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { trialDays, plans } = request.body || {};

    const data: Record<string, unknown> = {};
    if (trialDays !== undefined) {
      if (trialDays < 1 || trialDays > 365) {
        return reply.status(400).send({ success: false, error: 'trialDays must be 1–365' });
      }
      data.trialDays = trialDays;
    }
    if (plans !== undefined) {
      if (!Array.isArray(plans) || plans.length === 0) {
        return reply.status(400).send({ success: false, error: 'plans must be a non-empty array' });
      }
      data.plans = plans;
    }

    const updated = await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', trialDays: trialDays ?? 14, plans: plans ?? DEFAULT_PLANS },
    });

    const adminUser = request.user as any;
    await logAdminAction({
      adminEmail: adminUser.email,
      action: 'settings_change',
      targetType: 'settings',
      targetId: 'singleton',
      targetName: 'Platform Settings',
      metadata: {
        changed: Object.keys(data),
        ...(trialDays !== undefined && { trialDays }),
        ...(plans !== undefined && { planCount: plans.length }),
      },
      ipAddress: request.ip,
    });

    return reply.send(ok(updated, 'Settings updated'));
  });

  // ── GET /api/admin/referrals ──────────────────────────────────────────────
  app.get('/referrals', { preHandler: requireAdminRole() }, async (_req, reply) => {
    const PRICES: Record<string, number> = { FREE: 0, STARTER: 49, PROFESSIONAL: 99, ENTERPRISE: 199 };

    // All tenants that have a referralCode (potential referrers)
    // + all tenants that were referred (have referredById)
    const [referrers, referred] = await Promise.all([
      prisma.tenant.findMany({
        where: { referralCode: { not: null } },
        select: {
          id: true, name: true, slug: true, plan: true, planStatus: true,
          referralCode: true, createdAt: true, isActive: true,
          referrals: {
            select: {
              id: true, name: true, slug: true, plan: true, planStatus: true,
              isActive: true, createdAt: true, trialEndsAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.findMany({
        where: { referredById: { not: null } },
        select: {
          id: true, name: true, slug: true, plan: true, planStatus: true,
          isActive: true, createdAt: true,
          referrer: { select: { id: true, name: true, slug: true, referralCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Build per-referrer stats
    const referrerStats = referrers
      .filter(r => r.referrals.length > 0)
      .map(r => {
        const converted = r.referrals.filter(ref => ref.planStatus === 'active').length;
        const mrr = r.referrals
          .filter(ref => ref.planStatus === 'active')
          .reduce((s, ref) => s + (PRICES[ref.plan] ?? 0), 0);
        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          plan: r.plan,
          planStatus: r.planStatus,
          referralCode: r.referralCode,
          totalReferrals: r.referrals.length,
          converted,
          conversionRate: r.referrals.length > 0
            ? Math.round((converted / r.referrals.length) * 100)
            : 0,
          attributedMrr: mrr,
          referrals: r.referrals,
        };
      })
      .sort((a, b) => b.totalReferrals - a.totalReferrals);

    // Summary
    const totalReferred = referred.length;
    const totalConverted = referred.filter(r => r.planStatus === 'active').length;
    const totalAttributedMrr = referred
      .filter(r => r.planStatus === 'active')
      .reduce((s, r) => s + (PRICES[r.plan] ?? 0), 0);

    return reply.send(ok({
      summary: {
        totalReferred,
        totalConverted,
        conversionRate: totalReferred > 0 ? Math.round((totalConverted / totalReferred) * 100) : 0,
        totalAttributedMrr,
        activeReferrers: referrerStats.length,
      },
      referrers: referrerStats,
      recentReferrals: referred.slice(0, 20),
    }));
  });

  // ── GET /api/admin/churn-risk ─────────────────────────────────────────────
  // Top at-risk tenants for dashboard widget
  app.get('/churn-risk', { preHandler: requireAdminRole() }, async (_req, reply) => {
    const now = new Date();
    const last30Start = new Date(now.getTime() - 30 * 86_400_000);
    const prev30Start = new Date(now.getTime() - 60 * 86_400_000);

    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        planStatus: true,
        createdAt: true,
        isActive: true,
        users: {
          where: { role: 'OWNER' },
          select: { lastLoginAt: true },
          take: 1,
        },
        bookings: {
          where: { createdAt: { gte: prev30Start } },
          select: { createdAt: true },
        },
      },
    });

    const scored = tenants.map(t => {
      const ownerLastLoginAt = t.users[0]?.lastLoginAt ?? null;
      const bookingsLast30 = t.bookings.filter(b => b.createdAt >= last30Start).length;
      const bookingsPrev30 = t.bookings.filter(b => b.createdAt < last30Start).length;
      const churnRisk = computeChurnRisk({
        ownerLastLoginAt,
        bookingsLast30Days: bookingsLast30,
        bookingsPrev30Days: bookingsPrev30,
        tenantCreatedAt: t.createdAt,
        isActive: t.isActive,
      });
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        planStatus: t.planStatus,
        ownerLastLoginAt,
        churnRisk,
      };
    });

    // Sort by score desc, filter out NONE, return top 10
    const atRisk = scored
      .filter(t => t.churnRisk.level !== 'NONE')
      .sort((a, b) => b.churnRisk.score - a.churnRisk.score)
      .slice(0, 10);

    const summary = {
      total: scored.filter(t => t.churnRisk.level !== 'NONE').length,
      high: scored.filter(t => t.churnRisk.level === 'HIGH').length,
      medium: scored.filter(t => t.churnRisk.level === 'MEDIUM').length,
      low: scored.filter(t => t.churnRisk.level === 'LOW').length,
    };

    return reply.send(ok({ atRisk, summary }));
  });

  // ── GET /api/admin/notifications ─────────────────────────────────────────
  app.get('/notifications', { preHandler: requireAdminRole() }, async (_req, reply) => {
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.adminNotification.count({ where: { isRead: false } }),
    ]);
    return reply.send(ok({ notifications, unreadCount }));
  });

  // ── PATCH /api/admin/notifications/:id/read ────────────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: requireAdminRole() },
    async (request, reply) => {
      await prisma.adminNotification.update({
        where: { id: request.params.id },
        data: { isRead: true },
      });
      return reply.send(ok({ message: 'Marked as read' }));
    }
  );

  // ── PATCH /api/admin/notifications/read-all ────────────────────────────────
  app.patch('/notifications/read-all', { preHandler: requireAdminRole() }, async (_req, reply) => {
    await prisma.adminNotification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    return reply.send(ok({ message: 'All notifications marked as read' }));
  });

  // ── GET /api/admin/audit-log ──────────────────────────────────────────────
  app.get<{
    Querystring: {
      page?: string;
      action?: string;
      adminEmail?: string;
      targetType?: string;
      from?: string;
      to?: string;
    };
  }>('/audit-log', { preHandler: requireAdminRole(['SUPER_ADMIN', 'SUPPORT']) }, async (request, reply) => {
    const page = parseInt(request.query.page || '1');
    const limit = 50;
    const skip = (page - 1) * limit;
    const { action, adminEmail, targetType, from, to } = request.query;

    const where: any = {};
    if (action) where.action = action;
    if (adminEmail) where.adminEmail = { contains: adminEmail, mode: 'insensitive' };
    if (targetType) where.targetType = targetType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return reply.send(ok({ logs, total, page, pages: Math.ceil(total / limit) }));
  });

  // ── GET /api/admin/team ────────────────────────────────────────────────────
  app.get('/team', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (_req, reply) => {
    const members = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, lastLoginAt: true, invitedBy: true, createdAt: true,
      },
    });
    return reply.send(ok(members));
  });

  // ── POST /api/admin/team — create new admin user ──────────────────────────
  app.post<{
    Body: { email: string; password: string; role: string; firstName?: string; lastName?: string };
  }>('/team', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { email, password, role, firstName = '', lastName = '' } = request.body || {};
    if (!email || !password || !role) {
      return reply.status(400).send({ success: false, error: 'email, password, and role required' });
    }
    const validRoles = ['SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return reply.status(400).send({ success: false, error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return reply.status(409).send({ success: false, error: 'An admin with that email already exists' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ success: false, error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const adminUser = request.user as any;

    const newAdmin = await prisma.adminUser.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: role as any,
        firstName,
        lastName,
        invitedBy: adminUser.email,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, createdAt: true, invitedBy: true,
      },
    });

    await logAdminAction({
      adminEmail: adminUser.email,
      action: 'admin_invite',
      targetType: 'admin_user',
      targetId: newAdmin.id,
      targetName: email,
      metadata: { role, invitedEmail: email },
      ipAddress: request.ip,
    });

    return reply.status(201).send(ok(newAdmin, 'Admin user created'));
  });

  // ── PATCH /api/admin/team/:id — update role or active status ─────────────
  app.patch<{
    Params: { id: string };
    Body: { role?: string; isActive?: boolean; firstName?: string; lastName?: string };
  }>('/team/:id', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { id } = request.params;
    const { role, isActive, firstName, lastName } = request.body || {};
    const requester = request.user as any;

    // Cannot demote or deactivate yourself
    if (id === requester.sub && (isActive === false || (role && role !== 'SUPER_ADMIN'))) {
      return reply.status(400).send({ success: false, error: 'Cannot demote or deactivate your own account' });
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return reply.status(404).send({ success: false, error: 'Admin user not found' });

    const validRoles = ['SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER'];
    if (role && !validRoles.includes(role)) {
      return reply.status(400).send({ success: false, error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const data: any = {};
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;

    const updated = await prisma.adminUser.update({
      where: { id },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
    });

    await logAdminAction({
      adminEmail: requester.email,
      action: 'admin_role_change',
      targetType: 'admin_user',
      targetId: id,
      targetName: target.email,
      metadata: { before: { role: target.role, isActive: target.isActive }, after: data },
      ipAddress: request.ip,
    });

    return reply.send(ok(updated, 'Admin user updated'));
  });

  // ── DELETE /api/admin/team/:id — deactivate (soft delete) ────────────────
  app.delete<{ Params: { id: string } }>(
    '/team/:id',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const requester = request.user as any;

      if (id === requester.sub) {
        return reply.status(400).send({ success: false, error: 'Cannot delete your own account' });
      }

      const target = await prisma.adminUser.findUnique({ where: { id } });
      if (!target) return reply.status(404).send({ success: false, error: 'Admin user not found' });

      await prisma.adminUser.update({ where: { id }, data: { isActive: false } });

      await logAdminAction({
        adminEmail: requester.email,
        action: 'admin_deactivate',
        targetType: 'admin_user',
        targetId: id,
        targetName: target.email,
        ipAddress: request.ip,
      });

      return reply.send(ok({ message: 'Admin user deactivated' }));
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ANNOUNCEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/admin/announcements ──────────────────────────────────────────
  app.get('/announcements', { preHandler: requireAdminRole() }, async (_req, reply) => {
    const announcements = await prisma.platformAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(ok(announcements));
  });

  // ── POST /api/admin/announcements ─────────────────────────────────────────
  app.post<{
    Body: {
      title: string; body: string; type?: string;
      targetPlans?: string[]; isDismissible?: boolean;
      startsAt?: string; endsAt?: string;
    };
  }>('/announcements', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { title, body, type = 'info', targetPlans = [], isDismissible = true, startsAt, endsAt } = request.body ?? {};
    if (!title || !body) {
      return reply.status(400).send({ success: false, error: 'title and body required' });
    }
    const adminUser = request.user as any;
    const ann = await prisma.platformAnnouncement.create({
      data: {
        title, body, type, targetPlans, isDismissible,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
        createdBy: adminUser.email,
      },
    });
    await logAdminAction({
      adminEmail: adminUser.email,
      action: 'announcement_create',
      targetType: 'announcement',
      targetId: ann.id,
      targetName: title,
      metadata: { type, targetPlans },
      ipAddress: request.ip,
    });
    return reply.status(201).send(ok(ann, 'Announcement created'));
  });

  // ── PATCH /api/admin/announcements/:id ────────────────────────────────────
  app.patch<{
    Params: { id: string };
    Body: {
      title?: string; body?: string; type?: string;
      targetPlans?: string[]; isDismissible?: boolean;
      startsAt?: string; endsAt?: string | null; isActive?: boolean;
    };
  }>('/announcements/:id', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { id } = request.params;
    const { title, body, type, targetPlans, isDismissible, startsAt, endsAt, isActive } = request.body ?? {};
    const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ success: false, error: 'Announcement not found' });

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (body !== undefined) data.body = body;
    if (type !== undefined) data.type = type;
    if (targetPlans !== undefined) data.targetPlans = targetPlans;
    if (isDismissible !== undefined) data.isDismissible = isDismissible;
    if (startsAt !== undefined) data.startsAt = new Date(startsAt);
    if (endsAt !== undefined) data.endsAt = endsAt ? new Date(endsAt) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.platformAnnouncement.update({ where: { id }, data });
    const adminUser = request.user as any;
    await logAdminAction({
      adminEmail: adminUser.email,
      action: 'announcement_update',
      targetType: 'announcement',
      targetId: id,
      targetName: existing.title,
      metadata: data,
      ipAddress: request.ip,
    });
    return reply.send(ok(updated, 'Announcement updated'));
  });

  // ── DELETE /api/admin/announcements/:id ───────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/announcements/:id',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Announcement not found' });
      await prisma.platformAnnouncement.delete({ where: { id } });
      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'announcement_delete',
        targetType: 'announcement',
        targetId: id,
        targetName: existing.title,
        ipAddress: request.ip,
      });
      return reply.send(ok({ message: 'Deleted' }));
    }
  );

  // ── POST /api/admin/announcements/:id/broadcast ───────────────────────────
  // Send announcement as email to matching tenants
  app.post<{ Params: { id: string } }>(
    '/announcements/:id/broadcast',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const ann = await prisma.platformAnnouncement.findUnique({ where: { id } });
      if (!ann) return reply.status(404).send({ success: false, error: 'Announcement not found' });

      // Find target tenants
      const where: any = { isActive: true };
      if (ann.targetPlans.length > 0) where.plan = { in: ann.targetPlans };

      const tenants = await prisma.tenant.findMany({
        where,
        select: { billingEmail: true, name: true },
      });

      if (tenants.length === 0) {
        return reply.send(ok({ sent: 0 }, 'No matching tenants'));
      }

      // Import sendEmail lazily to avoid circular deps
      const { sendEmail } = await import('../services/email');

      const typeLabels: Record<string, string> = {
        info: '📣 Platform Update',
        warning: '⚠️ Important Notice',
        maintenance: '🔧 Maintenance Window',
        feature: '🎉 New Feature',
      };
      const subject = `${typeLabels[ann.type] ?? '📣'} — ${ann.title}`;

      let sent = 0;
      await Promise.allSettled(
        tenants
          .filter((t) => t.billingEmail)
          .map((t) =>
            sendEmail({
              to: t.billingEmail!,
              subject,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                  <h2 style="color:#1a6b5e">${ann.title}</h2>
                  <p>${ann.body.replace(/\n/g, '<br>')}</p>
                  <p style="color:#666;font-size:13px;margin-top:24px">— The ResortPro Team</p>
                </div>
              `,
            }).then(() => { sent++; })
          )
      );

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'announcement_broadcast',
        targetType: 'announcement',
        targetId: id,
        targetName: ann.title,
        metadata: { sent, total: tenants.length, targetPlans: ann.targetPlans },
        ipAddress: request.ip,
      });

      return reply.send(ok({ sent, total: tenants.length }, `Email sent to ${sent} tenants`));
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // GDPR
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/admin/gdpr/requests — list pending erasure requests ──────────
  app.get('/gdpr/requests', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (_req, reply) => {
    const pending = await getPendingErasures();

    // Also fetch all erasure requests (including already-anonymized)
    const all = await prisma.tenant.findMany({
      where: { gdprErasureRequestedAt: { not: null } },
      select: {
        id: true, name: true, slug: true, plan: true,
        gdprErasureRequestedAt: true, gdprErasureRequestedBy: true,
        gdprAnonymizedAt: true, deletedAt: true, isActive: true,
      },
      orderBy: { gdprErasureRequestedAt: 'desc' },
    });

    return reply.send(ok({ pending: pending.length, requests: all }));
  });

  // ── POST /api/admin/tenants/:id/gdpr/request-erasure ─────────────────────
  // Admin marks a tenant for erasure — 30-day grace, then purge job anonymizes
  app.post<{ Params: { id: string } }>(
    '/tenants/:id/gdpr/request-erasure',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = request.user as any;

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true, name: true, gdprErasureRequestedAt: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      if (tenant.gdprErasureRequestedAt) {
        return reply.status(409).send({ success: false, error: 'Erasure already requested for this tenant' });
      }

      await prisma.tenant.update({
        where: { id },
        data: {
          gdprErasureRequestedAt: new Date(),
          gdprErasureRequestedBy: adminUser.email,
          isActive: false,
        },
      });

      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'gdpr_erasure_request',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        metadata: { scheduledAnonymizationAfter: new Date(Date.now() + 30 * 86_400_000).toISOString() },
        ipAddress: request.ip,
      });

      return reply.send(ok({
        message: 'Erasure scheduled. Tenant data will be anonymized after 30-day grace period.',
        erasureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));
    }
  );

  // ── POST /api/admin/tenants/:id/gdpr/anonymize-now ────────────────────────
  // Immediate anonymization — bypasses 30-day grace (SUPER_ADMIN only, irreversible)
  app.post<{ Params: { id: string } }>(
    '/tenants/:id/gdpr/anonymize-now',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = request.user as any;

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      // Ensure erasure request exists (or create it)
      await prisma.tenant.update({
        where: { id },
        data: {
          gdprErasureRequestedAt: new Date(),
          gdprErasureRequestedBy: adminUser.email,
        },
      });

      const result = await anonymizeTenant(id);

      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'gdpr_anonymize',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        metadata: { usersAnonymized: result.usersAnonymized, guestsAnonymized: result.guestsAnonymized },
        ipAddress: request.ip,
      });

      return reply.send(ok(result, 'Tenant data anonymized'));
    }
  );

  // ── GET /api/admin/tenants/:id/gdpr/export ────────────────────────────────
  // Download all PII for a tenant as JSON (Article 20)
  app.get<{ Params: { id: string } }>(
    '/tenants/:id/gdpr/export',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const data = await collectTenantExport(id);

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'gdpr_data_export',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        ipAddress: request.ip,
      });

      const filename = `gdpr-export-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(JSON.stringify(data, null, 2));
    }
  );

  // ── POST /api/admin/tenants/:id/gdpr/cancel-erasure ──────────────────────
  // Cancel erasure request during 30-day grace period
  app.post<{ Params: { id: string } }>(
    '/tenants/:id/gdpr/cancel-erasure',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { id } = request.params;
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true, name: true, gdprErasureRequestedAt: true, gdprAnonymizedAt: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      if (!tenant.gdprErasureRequestedAt) {
        return reply.status(400).send({ success: false, error: 'No erasure request found' });
      }
      if (tenant.gdprAnonymizedAt) {
        return reply.status(400).send({ success: false, error: 'Data already anonymized — cannot cancel' });
      }

      await prisma.tenant.update({
        where: { id },
        data: {
          gdprErasureRequestedAt: null,
          gdprErasureRequestedBy: null,
          deletedAt: null,
          isActive: true,
        },
      });

      const adminUser = request.user as any;
      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'gdpr_erasure_cancelled',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        ipAddress: request.ip,
      });

      return reply.send(ok({ message: 'Erasure request cancelled. Tenant reactivated.' }));
    }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PLATFORM HEALTH
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/health', { preHandler: requireAdminRole() }, async (_req, reply) => {
    const mem = process.memoryUsage();
    const uptimeSec = process.uptime();

    // DB stats via raw SQL
    const [dbSizeRows, tableRows, connRows] = await Promise.all([
      prisma.$queryRaw<{ size: string }[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size
      `,
      prisma.$queryRaw<{ table_name: string; row_estimate: bigint; size: string }[]>`
        SELECT
          relname AS table_name,
          reltuples::bigint AS row_estimate,
          pg_size_pretty(pg_total_relation_size(relid)) AS size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
      `,
    ]).catch(() => [[], [], []] as [any[], any[], any[]]);

    // App-level counts (fast — all indexed)
    const [tenants, users, bookings, activeSubscriptions] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.booking.count(),
      prisma.tenant.count({ where: { planStatus: 'active' } }),
    ]);

    // Request metrics (last 60 min)
    const reqMetrics = metrics.snapshot(60 * 60_000);

    return reply.send(ok({
      process: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSec: Math.round(uptimeSec),
        uptimeHuman: (() => {
          const h = Math.floor(uptimeSec / 3600);
          const m = Math.floor((uptimeSec % 3600) / 60);
          return h > 0 ? `${h}h ${m}m` : `${m}m`;
        })(),
        memory: {
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024),
          externalMb: Math.round(mem.external / 1024 / 1024),
        },
        env: process.env.NODE_ENV ?? 'unknown',
      },
      database: {
        size: (dbSizeRows as any[])[0]?.size ?? 'unknown',
        activeConnections: Number((connRows as any[])[0]?.count ?? 0),
        topTables: (tableRows as any[]).map((r) => ({
          name: r.table_name,
          rowEstimate: Number(r.row_estimate),
          size: r.size,
        })),
      },
      platform: {
        totalTenants: tenants,
        totalUsers: users,
        totalBookings: bookings,
        activeSubscriptions,
      },
      requests: reqMetrics,
      checkedAt: new Date().toISOString(),
    }));
  });

  // ── GET /api/admin/feature-flags — registry of all known flags ────────────
  app.get('/feature-flags', { preHandler: requireAdminRole() }, async (_req, reply) => {
    return reply.send(ok(FLAG_REGISTRY));
  });

  // ── GET /api/admin/tenants/:id/flags — flags for one tenant ───────────────
  app.get<{ Params: { id: string } }>(
    '/tenants/:id/flags',
    { preHandler: requireAdminRole() },
    async (request, reply) => {
      const { id } = request.params;
      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      // Get existing rows
      const rows = await prisma.tenantFeatureFlag.findMany({ where: { tenantId: id } });
      const rowMap = Object.fromEntries(rows.map((r) => [r.flag, r]));

      // Merge with registry — unknown flags still appear as "disabled"
      const flags = FLAG_REGISTRY.map((def) => ({
        ...def,
        enabled: rowMap[def.flag]?.enabled ?? def.defaultOn,
        updatedAt: rowMap[def.flag]?.updatedAt ?? null,
        updatedBy: rowMap[def.flag]?.updatedBy ?? null,
      }));

      return reply.send(ok({ tenantId: id, tenantName: tenant.name, flags }));
    }
  );

  // ── PATCH /api/admin/tenants/:id/flags/:flag — toggle one flag ────────────
  app.patch<{ Params: { id: string; flag: string }; Body: { enabled: boolean } }>(
    '/tenants/:id/flags/:flag',
    { preHandler: requireAdminRole(['SUPER_ADMIN', 'SUPPORT']) },
    async (request, reply) => {
      const { id, flag } = request.params;
      const { enabled } = request.body ?? {};

      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ success: false, error: '`enabled` (boolean) required' });
      }
      if (!FLAG_MAP[flag]) {
        return reply.status(400).send({ success: false, error: `Unknown flag: ${flag}` });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const adminUser = request.user as any;

      await prisma.tenantFeatureFlag.upsert({
        where: { tenantId_flag: { tenantId: id, flag } },
        update: { enabled, updatedBy: adminUser.email },
        create: { tenantId: id, flag, enabled, updatedBy: adminUser.email },
      });

      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'feature_flag_toggle',
        targetType: 'tenant',
        targetId: id,
        targetName: tenant.name,
        metadata: { flag, enabled, flagLabel: FLAG_MAP[flag]?.label },
        ipAddress: request.ip,
      });

      return reply.send(ok({ flag, enabled }, `Flag ${enabled ? 'enabled' : 'disabled'}`));
    }
  );

  // ── PATCH /api/admin/tenants/:id/flags — bulk set flags ───────────────────
  app.patch<{ Params: { id: string }; Body: { flags: Record<string, boolean> } }>(
    '/tenants/:id/flags',
    { preHandler: requireAdminRole(['SUPER_ADMIN', 'SUPPORT']) },
    async (request, reply) => {
      const { id } = request.params;
      const { flags } = request.body ?? {};
      if (!flags || typeof flags !== 'object') {
        return reply.status(400).send({ success: false, error: '`flags` object required' });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const adminUser = request.user as any;

      await Promise.all(
        Object.entries(flags).map(([flag, enabled]) => {
          if (!FLAG_MAP[flag] || typeof enabled !== 'boolean') return Promise.resolve();
          return prisma.tenantFeatureFlag.upsert({
            where: { tenantId_flag: { tenantId: id, flag } },
            update: { enabled, updatedBy: adminUser.email },
            create: { tenantId: id, flag, enabled, updatedBy: adminUser.email },
          });
        })
      );

      return reply.send(ok({ updated: Object.keys(flags).length }));
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // T-27 — CUSTOM DOMAIN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /api/admin/domains — all tenants with custom domains ───────────────
  app.get(
    '/domains',
    { preHandler: requireAdminRole() },
    async (_req, reply) => {
      const tenants = await prisma.tenant.findMany({
        where: { customDomain: { not: null } },
        select: {
          id: true, name: true, slug: true, plan: true, isActive: true,
          customDomain: true, domainVerified: true, domainVerifiedAt: true,
          sslStatus: true, sslProvisionedAt: true, sslExpiresAt: true, sslError: true,
          createdAt: true,
        },
        orderBy: { customDomain: 'asc' },
      });

      const total = await prisma.tenant.count({ where: { customDomain: { not: null } } });
      const verified = tenants.filter((t) => t.domainVerified).length;
      const sslActive = tenants.filter((t) => t.sslStatus === 'active').length;
      const pending = tenants.filter((t) => !t.domainVerified).length;

      return reply.send(ok({ stats: { total, verified, sslActive, pending }, tenants }));
    }
  );

  // ── POST /api/admin/domains/:id/force-verify — override DNS check ──────────
  app.post<{ Params: { id: string } }>(
    '/domains/:id/force-verify',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = request.user as any;
      const tenant = await prisma.tenant.findUnique({
        where: { id }, select: { id: true, name: true, customDomain: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      if (!tenant.customDomain) return reply.status(400).send({ success: false, error: 'No custom domain set' });

      await prisma.tenant.update({
        where: { id },
        data: { domainVerified: true, domainVerifiedAt: new Date() },
      });
      await logAdminAction({
        adminEmail: adminUser.email, action: 'domain_force_verify',
        targetType: 'tenant', targetId: id, targetName: tenant.name,
        metadata: { domain: tenant.customDomain }, ipAddress: request.ip,
      });
      return reply.send(ok({ verified: true }, 'Domain force-verified'));
    }
  );

  // ── DELETE /api/admin/domains/:id — remove custom domain ──────────────────
  app.delete<{ Params: { id: string } }>(
    '/domains/:id',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = request.user as any;
      const tenant = await prisma.tenant.findUnique({
        where: { id }, select: { id: true, name: true, customDomain: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      await prisma.tenant.update({
        where: { id },
        data: {
          customDomain: null, domainVerified: false, domainVerifiedAt: null,
          sslStatus: 'none', sslProvisionedAt: null, sslExpiresAt: null, sslError: null,
        },
      });
      await logAdminAction({
        adminEmail: adminUser.email, action: 'domain_remove',
        targetType: 'tenant', targetId: id, targetName: tenant.name,
        metadata: { removedDomain: tenant.customDomain }, ipAddress: request.ip,
      });
      return reply.send(ok(null, 'Custom domain removed'));
    }
  );

  // ── PATCH /api/admin/domains/:id/ssl — update SSL status (cert-manager webhook) ──
  app.patch<{
    Params: { id: string };
    Body: { sslStatus: string; sslExpiresAt?: string; sslError?: string };
  }>(
    '/domains/:id/ssl',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const { sslStatus, sslExpiresAt, sslError } = request.body ?? {};
      const validStatuses = ['none', 'pending', 'provisioning', 'active', 'error'];
      if (!validStatuses.includes(sslStatus)) {
        return reply.status(400).send({ success: false, error: 'Invalid sslStatus' });
      }

      const updated = await prisma.tenant.update({
        where: { id },
        data: {
          sslStatus,
          ...(sslStatus === 'active' && { sslProvisionedAt: new Date() }),
          ...(sslExpiresAt && { sslExpiresAt: new Date(sslExpiresAt) }),
          ...(sslError !== undefined && { sslError }),
        },
        select: { id: true, customDomain: true, sslStatus: true, sslProvisionedAt: true, sslExpiresAt: true },
      });
      return reply.send(ok(updated, 'SSL status updated'));
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // T-21 — ENTERPRISE / SLA / WHITE-LABEL / SSO
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /api/admin/enterprise — list enterprise tenants with SLA ───────────
  app.get(
    '/enterprise',
    { preHandler: requireAdminRole() },
    async (_req, reply) => {
      const tenants = await prisma.tenant.findMany({
        where: { plan: 'ENTERPRISE' },
        select: {
          id: true, name: true, slug: true, plan: true, isActive: true,
          whitelabelEnabled: true, ssoEnabled: true, ssoProvider: true,
          onboardingStep: true, onboardingCompletedAt: true,
          createdAt: true,
          slaAgreement: {
            select: {
              tier: true, uptimePercent: true, responseTimeH: true,
              contractStart: true, contractEnd: true, autoRenew: true,
              signedAt: true, createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const all = await prisma.tenant.count();
      const entCount = tenants.length;
      const slaCount = tenants.filter((t) => t.slaAgreement).length;
      const ssoCount = tenants.filter((t) => t.ssoEnabled).length;
      const completedCount = tenants.filter((t) => t.onboardingCompletedAt).length;

      return reply.send(ok({
        stats: { totalTenants: all, enterpriseTenants: entCount, activeSlas: slaCount, ssoEnabled: ssoCount, onboardingComplete: completedCount },
        tenants,
      }));
    }
  );

  // ── GET /api/admin/tenants/:id/enterprise — full enterprise profile ────────
  app.get<{ Params: { id: string } }>(
    '/tenants/:id/enterprise',
    { preHandler: requireAdminRole() },
    async (request, reply) => {
      const { id } = request.params;
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: {
          id: true, name: true, slug: true, plan: true, email: true,
          // white-label
          whitelabelEnabled: true, brandLogoUrl: true,
          brandPrimaryColor: true, brandAccentColor: true,
          companyDisplayName: true,
          // SSO (no secret in response)
          ssoEnabled: true, ssoProvider: true, ssoClientId: true, ssoConfig: true,
          // onboarding
          onboardingStep: true, onboardingCompletedAt: true, enterpriseNotes: true,
          slaAgreement: true,
        },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      return reply.send(ok(tenant));
    }
  );

  // ── PUT /api/admin/tenants/:id/sla — create or update SLA ─────────────────
  app.put<{
    Params: { id: string };
    Body: {
      tier?: string; uptimePercent?: number; responseTimeH?: number;
      contractStart?: string; contractEnd?: string | null;
      autoRenew?: boolean; notes?: string; signedBy?: string; signedAt?: string;
    };
  }>(
    '/tenants/:id/sla',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const adminUser = request.user as any;

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const validTiers = ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
      if (body.tier && !validTiers.includes(body.tier as string)) {
        return reply.status(400).send({ success: false, error: 'Invalid tier' });
      }

      const data: Record<string, unknown> = { updatedAt: new Date() };
      if (body.tier !== undefined) data.tier = body.tier;
      if (body.uptimePercent !== undefined) data.uptimePercent = Number(body.uptimePercent);
      if (body.responseTimeH !== undefined) data.responseTimeH = Number(body.responseTimeH);
      if (body.contractStart !== undefined) data.contractStart = new Date(body.contractStart);
      if ('contractEnd' in body) data.contractEnd = body.contractEnd ? new Date(body.contractEnd) : null;
      if (body.autoRenew !== undefined) data.autoRenew = Boolean(body.autoRenew);
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.signedBy !== undefined) data.signedBy = body.signedBy;
      if (body.signedAt !== undefined) data.signedAt = body.signedAt ? new Date(body.signedAt) : null;

      const sla = await prisma.slaAgreement.upsert({
        where: { tenantId: id },
        update: data as any,
        create: {
          tenantId: id,
          tier: (body.tier ?? 'ENTERPRISE') as any,
          uptimePercent: body.uptimePercent ?? 99.9,
          responseTimeH: body.responseTimeH ?? 4,
          contractStart: body.contractStart ? new Date(body.contractStart) : new Date(),
          contractEnd: body.contractEnd ? new Date(body.contractEnd) : null,
          autoRenew: body.autoRenew ?? true,
          notes: body.notes,
          signedBy: body.signedBy,
          signedAt: body.signedAt ? new Date(body.signedAt) : null,
          createdBy: adminUser.email,
        },
      });

      await logAdminAction({
        adminEmail: adminUser.email, action: 'sla_update',
        targetType: 'tenant', targetId: id, targetName: tenant.name,
        metadata: { tier: sla.tier, uptimePercent: sla.uptimePercent },
        ipAddress: request.ip,
      });

      return reply.send(ok(sla, 'SLA agreement saved'));
    }
  );

  // ── DELETE /api/admin/tenants/:id/sla — remove SLA agreement ─────────────
  app.delete<{ Params: { id: string } }>(
    '/tenants/:id/sla',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const adminUser = request.user as any;
      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      try {
        await prisma.slaAgreement.delete({ where: { tenantId: id } });
      } catch {
        return reply.status(404).send({ success: false, error: 'No SLA agreement found' });
      }
      await logAdminAction({ adminEmail: adminUser.email, action: 'sla_delete', targetType: 'tenant', targetId: id, targetName: tenant.name, ipAddress: request.ip });
      return reply.send(ok(null, 'SLA agreement removed'));
    }
  );

  // ── PUT /api/admin/tenants/:id/whitelabel ─────────────────────────────────
  app.put<{
    Params: { id: string };
    Body: {
      whitelabelEnabled?: boolean; brandLogoUrl?: string | null;
      brandPrimaryColor?: string | null; brandAccentColor?: string | null;
      companyDisplayName?: string | null;
    };
  }>(
    '/tenants/:id/whitelabel',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const adminUser = request.user as any;

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const updated = await prisma.tenant.update({
        where: { id },
        data: {
          ...(body.whitelabelEnabled !== undefined && { whitelabelEnabled: body.whitelabelEnabled }),
          ...(body.brandLogoUrl !== undefined && { brandLogoUrl: body.brandLogoUrl }),
          ...(body.brandPrimaryColor !== undefined && { brandPrimaryColor: body.brandPrimaryColor }),
          ...(body.brandAccentColor !== undefined && { brandAccentColor: body.brandAccentColor }),
          ...(body.companyDisplayName !== undefined && { companyDisplayName: body.companyDisplayName }),
        },
        select: { id: true, whitelabelEnabled: true, brandLogoUrl: true, brandPrimaryColor: true, brandAccentColor: true, companyDisplayName: true },
      });

      await logAdminAction({ adminEmail: adminUser.email, action: 'whitelabel_update', targetType: 'tenant', targetId: id, targetName: tenant.name, metadata: body as any, ipAddress: request.ip });
      return reply.send(ok(updated, 'White-label settings saved'));
    }
  );

  // ── PUT /api/admin/tenants/:id/sso ────────────────────────────────────────
  app.put<{
    Params: { id: string };
    Body: {
      ssoEnabled?: boolean; ssoProvider?: string | null;
      ssoClientId?: string | null; ssoClientSecret?: string | null;
      ssoConfig?: Record<string, unknown> | null;
    };
  }>(
    '/tenants/:id/sso',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const adminUser = request.user as any;

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const validProviders = ['google', 'microsoft', 'okta', 'saml'];
      if (body.ssoProvider && !validProviders.includes(body.ssoProvider)) {
        return reply.status(400).send({ success: false, error: 'Invalid SSO provider' });
      }

      await prisma.tenant.update({
        where: { id },
        data: {
          ...(body.ssoEnabled !== undefined && { ssoEnabled: body.ssoEnabled }),
          ...(body.ssoProvider !== undefined && { ssoProvider: body.ssoProvider }),
          ...(body.ssoClientId !== undefined && { ssoClientId: body.ssoClientId }),
          ...(body.ssoClientSecret !== undefined && { ssoClientSecret: body.ssoClientSecret }),
          ...(body.ssoConfig !== undefined && { ssoConfig: body.ssoConfig as any }),
        },
      });

      await logAdminAction({ adminEmail: adminUser.email, action: 'sso_update', targetType: 'tenant', targetId: id, targetName: tenant.name, metadata: { ssoEnabled: body.ssoEnabled, ssoProvider: body.ssoProvider }, ipAddress: request.ip });
      return reply.send(ok({ ssoEnabled: body.ssoEnabled, ssoProvider: body.ssoProvider }, 'SSO configuration saved'));
    }
  );

  // ── PATCH /api/admin/tenants/:id/onboarding ───────────────────────────────
  app.patch<{ Params: { id: string }; Body: { step?: number; notes?: string; complete?: boolean } }>(
    '/tenants/:id/onboarding',
    { preHandler: requireAdminRole(['SUPER_ADMIN', 'SUPPORT']) },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const adminUser = request.user as any;

      const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, onboardingStep: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const updateData: Record<string, unknown> = {};
      if (body.step !== undefined) updateData.onboardingStep = Math.min(6, Math.max(0, body.step));
      if (body.notes !== undefined) updateData.enterpriseNotes = body.notes;
      if (body.complete) {
        updateData.onboardingStep = 6;
        updateData.onboardingCompletedAt = new Date();
      }

      const updated = await prisma.tenant.update({ where: { id }, data: updateData as any, select: { id: true, onboardingStep: true, onboardingCompletedAt: true, enterpriseNotes: true } });
      await logAdminAction({ adminEmail: adminUser.email, action: 'onboarding_update', targetType: 'tenant', targetId: id, targetName: tenant.name, metadata: updateData, ipAddress: request.ip });
      return reply.send(ok(updated, 'Onboarding updated'));
    }
  );

  // ── GET /api/admin/storage ─────────────────────────────────────────────────
  app.get(
    '/storage',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (_request, reply) => {
      const cfg = await getStorageConfig();
      // Mask the secret key for display
      const masked: StorageConfig = {
        ...cfg,
        secretKey: cfg.secretKey ? '••••••••' : undefined,
      };
      return reply.send(ok(masked, 'Storage config fetched'));
    }
  );

  // ── PATCH /api/admin/storage ───────────────────────────────────────────────
  app.patch<{ Body: Partial<StorageConfig> }>(
    '/storage',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const adminUser = request.user as any;
      const body = request.body ?? {};

      // Build update — if secretKey is the mask placeholder, keep existing secret
      const existing = await getStorageConfig();
      const updated: StorageConfig = {
        driver:    body.driver    ?? existing.driver,
        endpoint:  body.endpoint  ?? existing.endpoint,
        region:    body.region    ?? existing.region,
        bucket:    body.bucket    ?? existing.bucket,
        publicUrl: body.publicUrl ?? existing.publicUrl,
        accessKey: body.accessKey ?? existing.accessKey,
        secretKey: (body.secretKey && body.secretKey !== '••••••••')
          ? body.secretKey
          : existing.secretKey,
      };

      await prisma.platformSettings.upsert({
        where:  { id: 'singleton' },
        create: { id: 'singleton', plans: [], storageConfig: updated as any },
        update: { storageConfig: updated as any },
      });

      invalidateStorageCache();

      await logAdminAction({
        adminEmail: adminUser.email,
        action: 'storage_config_update',
        targetType: 'platform',
        targetId: 'singleton',
        targetName: 'Storage Config',
        metadata: { driver: updated.driver, bucket: updated.bucket, endpoint: updated.endpoint },
        ipAddress: request.ip,
      });

      return reply.send(ok({ driver: updated.driver }, 'Storage config saved'));
    }
  );

  // ── POST /api/admin/storage/test ──────────────────────────────────────────
  app.post(
    '/storage/test',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (_request, reply) => {
      try {
        // Upload a tiny test file then delete it immediately
        const testBuffer = Buffer.from('ResortPro storage test — safe to delete');
        const result = await uploadToStorage(testBuffer, 'image/png', 'test', 'admin-test');
        await deleteFromStorage(result.key);
        return reply.send(ok({ url: result.url }, 'Connection test successful'));
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err?.message ?? 'Storage test failed' });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // THEME MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/admin/themes — সব themes list
  app.get('/themes', { preHandler: requireAdminRole() }, async (_request, reply) => {
    const themes = await prisma.theme.findMany({ orderBy: { sortOrder: 'asc' } });
    return reply.send(ok(themes));
  });

  // POST /api/admin/themes — নতুন theme register
  app.post<{
    Body: {
      key: string; name: string; description?: string;
      previewImage?: string; author?: string; version?: string;
      tags?: string[]; isPremium?: boolean; requiredPlan?: string; sortOrder?: number;
    };
  }>('/themes', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { key, name, description, previewImage, author, version, tags, isPremium, requiredPlan, sortOrder } = request.body ?? {};
    if (!key || !name) return reply.status(400).send({ success: false, error: 'key and name required' });

    const existing = await prisma.theme.findUnique({ where: { key } });
    if (existing) return reply.status(409).send({ success: false, error: `Theme key '${key}' already exists` });

    const theme = await prisma.theme.create({
      data: { key, name, description, previewImage, author, version, tags, isPremium, requiredPlan, sortOrder },
    });
    const adminUser = request.user as any;
    await logAdminAction({ adminEmail: adminUser.email, action: 'theme_update', targetType: 'theme', targetId: theme.id, targetName: name, metadata: { action: 'create', key }, ipAddress: request.ip });
    return reply.status(201).send(ok(theme, 'Theme created'));
  });

  // PUT /api/admin/themes/:key — full update
  app.put<{
    Params: { key: string };
    Body: {
      name?: string; description?: string; previewImage?: string;
      author?: string; version?: string; tags?: string[];
      isActive?: boolean; isDefault?: boolean; isPremium?: boolean;
      requiredPlan?: string; sortOrder?: number;
    };
  }>('/themes/:key', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { key } = request.params;
    const body = request.body ?? {};

    const theme = await prisma.theme.findUnique({ where: { key } });
    if (!theme) {
      // upsert — create if not found (add new theme flow)
      const created = await prisma.theme.create({ data: { key, name: body.name ?? key, ...body } });
      return reply.status(201).send(ok(created, 'Theme created'));
    }

    // isDefault → unset others first
    if (body.isDefault === true) {
      await prisma.theme.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const updated = await prisma.theme.update({ where: { key }, data: body });
    const adminUser = request.user as any;
    await logAdminAction({ adminEmail: adminUser.email, action: 'theme_update', targetType: 'theme', targetId: theme.id, targetName: theme.name, metadata: { changes: body }, ipAddress: request.ip });
    return reply.send(ok(updated, 'Theme updated'));
  });

  // PATCH /api/admin/themes/:key/toggle — toggle active status
  app.patch<{ Params: { key: string } }>(
    '/themes/:key/toggle',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { key } = request.params;
      const theme = await prisma.theme.findUnique({ where: { key } });
      if (!theme) return reply.status(404).send({ success: false, error: 'Theme not found' });

      const updated = await prisma.theme.update({ where: { key }, data: { isActive: !theme.isActive } });
      const adminUser = request.user as any;
      await logAdminAction({ adminEmail: adminUser.email, action: 'theme_toggle', targetType: 'theme', targetId: theme.id, targetName: theme.name, metadata: { isActive: updated.isActive }, ipAddress: request.ip });
      return reply.send(ok(updated, `Theme ${updated.isActive ? 'activated' : 'deactivated'}`));
    }
  );

  // PATCH /api/admin/themes/:key — partial update (isDefault, requiredPlan, etc.)
  app.patch<{
    Params: { key: string };
    Body: { isDefault?: boolean; requiredPlan?: string; sortOrder?: number; };
  }>('/themes/:key', { preHandler: requireAdminRole(['SUPER_ADMIN']) }, async (request, reply) => {
    const { key } = request.params;
    const body = request.body ?? {};

    const theme = await prisma.theme.findUnique({ where: { key } });
    if (!theme) return reply.status(404).send({ success: false, error: 'Theme not found' });

    if (body.isDefault === true) {
      await prisma.theme.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const updated = await prisma.theme.update({ where: { key }, data: body });
    return reply.send(ok(updated, 'Theme updated'));
  });

  // DELETE /api/admin/themes/:key — theme delete
  app.delete<{ Params: { key: string } }>(
    '/themes/:key',
    { preHandler: requireAdminRole(['SUPER_ADMIN']) },
    async (request, reply) => {
      const { key } = request.params;
      const theme = await prisma.theme.findUnique({ where: { key } });
      if (!theme) return reply.status(404).send({ success: false, error: 'Theme not found' });
      if (theme.isDefault) return reply.status(400).send({ success: false, error: 'Cannot delete the default theme. Set another theme as default first.' });

      await prisma.theme.delete({ where: { key } });
      const adminUser = request.user as any;
      await logAdminAction({ adminEmail: adminUser.email, action: 'theme_update', targetType: 'theme', targetId: theme.id, targetName: theme.name, metadata: { action: 'delete' }, ipAddress: request.ip });
      return reply.send(ok(null, 'Theme deleted'));
    }
  );
}

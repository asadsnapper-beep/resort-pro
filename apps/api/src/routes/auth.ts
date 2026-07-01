import type { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import { sendEmail } from '../services/email';
import { createAdminNotification } from '../utils/notifications';
import { generateReferralCode } from '../utils/referral';
import type { JwtPayload } from '@resort-pro/types';

const REFRESH_COOKIE = 'rp_refresh';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

function getRefreshToken(request: { cookies: Record<string, string | undefined>; body: unknown }): string | undefined {
  // Cookie takes precedence; fall back to body for backward-compat during transition
  return request.cookies[REFRESH_COOKIE] ??
    (request.body as Record<string, string> | null)?.[REFRESH_COOKIE] ??
    (request.body as Record<string, string> | null)?.['refreshToken'];
}

const registerSchema = z.object({
  resortName: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must contain uppercase and number'),
  referralCode: z.string().max(20).optional(),  // ?ref=CODE from URL
  plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  slug: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register a new resort (tenant)',
      body: {
        type: 'object',
        required: ['resortName', 'slug', 'firstName', 'lastName', 'email', 'password'],
        properties: {
          resortName: { type: 'string' },
          slug: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = validate(registerSchema, request.body, reply);
      if (!body) return;

      const existingTenant = await prisma.tenant.findUnique({ where: { slug: body.slug } });
      if (existingTenant) {
        return reply.status(409).send({ success: false, error: 'Resort slug already taken' });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      // Use platform trial days setting (falls back to 14)
      const platformSettings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
      const trialDays = platformSettings?.trialDays ?? 14;
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      // Resolve referral — check tenant referralCode first, then campaign link
      let referredById: string | undefined;
      let campaignSource: string | undefined;
      if (body.referralCode) {
        const referrer = await prisma.tenant.findUnique({
          where: { referralCode: body.referralCode },
          select: { id: true },
        });
        if (referrer) {
          referredById = referrer.id;
        } else {
          // Not a tenant code — check if it's a campaign/marketing link
          const campaignLink = await prisma.campaignLink.findUnique({
            where: { code: body.referralCode.toUpperCase() },
            select: { code: true, isActive: true },
          });
          if (campaignLink?.isActive) campaignSource = campaignLink.code;
        }
      }

      // Generate unique referral code for this new tenant
      let referralCode = generateReferralCode(body.slug);
      // Ensure uniqueness (retry if collision)
      const existing = await prisma.tenant.findUnique({ where: { referralCode } });
      if (existing) referralCode = generateReferralCode(body.slug + Date.now());

      const tenant = await prisma.tenant.create({
        data: {
          name: body.resortName,
          slug: body.slug,
          plan: body.plan ?? 'STARTER',
          planStatus: 'trialing',
          trialEndsAt,
          billingEmail: body.email,
          referralCode,
          ...(referredById && { referredById }),
          ...(campaignSource && { campaignSource }),
          users: {
            create: {
              email: body.email,
              passwordHash,
              firstName: body.firstName,
              lastName: body.lastName,
              role: 'OWNER',
            },
          },
          websiteContent: {
            create: {
              heroTitle: `Welcome to ${body.resortName}`,
              heroSubtitle: 'Experience luxury and comfort',
            },
          },
        },
        include: { users: true },
      });

      // Create Referral record if referred
      if (referredById) {
        await prisma.referral.create({
          data: {
            referrerId: referredById,
            referredId: tenant.id,
            status: 'PENDING',
          },
        }).catch(() => {}); // non-blocking
      }

      // Notify admin of new signup
      const referralNote = referredById ? ` (referred by tenant ${referredById})` : '';
      await createAdminNotification({
        type: 'new_signup',
        title: referredById ? '🔗 New referral signup' : 'New resort signed up',
        message: `${body.resortName} (${body.email}) just started a ${trialDays}-day trial${referralNote}.`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          ownerEmail: body.email,
          trialDays,
          trialEndsAt: trialEndsAt.toISOString(),
          isReferral: !!referredById,
          referredById,
        },
        linkPath: referredById ? `/admin/referrals` : `/admin/tenants`,
      });

      const user = tenant.users[0];
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: 'OWNER',
        tenantId: tenant.id,
      };

      const token = app.jwt.sign(payload);
      const refreshToken = app.jwt.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d' },
      );

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Send welcome email
      await sendEmail({
        to: body.email,
        subject: `Welcome to ResortPro — Your 14-day trial has started! 🎉`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a6b5e">Welcome to ResortPro, ${body.firstName}!</h2>
            <p>Your resort <strong>${body.resortName}</strong> is ready. You have a full <strong>14-day free trial</strong> with access to all Starter features.</p>
            <p style="margin:24px 0">
              <a href="${process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/${body.slug}/dashboard"
                 style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                Open Your Dashboard
              </a>
            </p>
            <p><strong>Your trial includes:</strong></p>
            <ul>
              <li>Full booking management</li>
              <li>Guest CRM</li>
              <li>Room management</li>
              <li>Website builder</li>
            </ul>
            <p>Trial ends on: <strong>${trialEndsAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</strong></p>
            <p>Questions? Reply to this email anytime.</p>
            <p style="color:#666;font-size:13px">— The ResortPro Team</p>
          </div>
        `,
      }).catch(() => {}); // don't block registration if email fails

      setRefreshCookie(reply, refreshToken);
      return reply.status(201).send(ok({
        token,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, planStatus: tenant.planStatus, trialEndsAt: tenant.trialEndsAt, isActive: tenant.isActive },
      }, 'Resort registered successfully'));
    },
  });

  // POST /api/auth/login
  app.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'Login to the dashboard',
      body: {
        type: 'object',
        required: ['email', 'password', 'slug'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = validate(loginSchema, request.body, reply);
      if (!body) return;

      const tenant = await prisma.tenant.findUnique({ where: { slug: body.slug } });
      if (!tenant) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }
      if (!tenant.isActive) {
        return reply.status(403).send({ success: false, error: 'Account suspended. Please contact support.' });
      }

      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: body.email } },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role as JwtPayload['role'],
        tenantId: tenant.id,
      };

      const token = app.jwt.sign(payload);
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      setRefreshCookie(reply, refreshToken);
      return ok({
        token,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, planStatus: tenant.planStatus, trialEndsAt: tenant.trialEndsAt, isActive: tenant.isActive },
      });
    },
  });

  // POST /api/auth/refresh
  app.post('/refresh', {
    schema: { tags: ['auth'], summary: 'Refresh access token' },
    handler: async (request, reply) => {
      const refreshToken = getRefreshToken(request);
      if (!refreshToken) {
        return reply.status(400).send({ success: false, error: 'Refresh token required' });
      }

      const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } });
      if (!stored || stored.expiresAt < new Date()) {
        clearRefreshCookie(reply);
        return reply.status(401).send({ success: false, error: 'Invalid or expired refresh token' });
      }

      await prisma.refreshToken.delete({ where: { id: stored.id } });

      const user = stored.user;
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
      if (!tenant) return reply.status(401).send({ success: false, error: 'Tenant not found' });

      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role as JwtPayload['role'],
        tenantId: user.tenantId,
      };

      const newToken = app.jwt.sign(payload);
      const newRefreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      await prisma.refreshToken.create({
        data: { userId: user.id, token: newRefreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      setRefreshCookie(reply, newRefreshToken);
      return ok({ token: newToken });
    },
  });

  // GET /api/auth/me
  app.get('/me', {
    schema: { tags: ['auth'], summary: 'Get current user', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const payload = request.user as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, avatarUrl: true, tenantId: true },
      });
      return ok(user);
    },
  });

  // PATCH /api/auth/me — update own profile
  app.patch('/me', {
    schema: { tags: ['auth'], summary: 'Update own profile', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const payload = request.user as JwtPayload;
      const body = z.object({
        firstName:  z.string().min(1).max(50).optional(),
        lastName:   z.string().min(1).max(50).optional(),
        phone:      z.string().max(30).nullable().optional(),
        avatarUrl:  z.string().url().nullable().optional(),
      }).parse(request.body);

      const updated = await prisma.user.update({
        where: { id: payload.sub },
        data: body,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, avatarUrl: true, tenantId: true },
      });
      return ok(updated, 'Profile updated');
    },
  });

  // POST /api/auth/change-password
  app.post('/change-password', {
    schema: { tags: ['auth'], summary: 'Change own password', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const payload = request.user as JwtPayload;
      const body = z.object({
        currentPassword: z.string().min(1),
        newPassword:     z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must contain uppercase and a number'),
      }).parse(request.body);

      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return reply.status(404).send({ success: false, error: 'User not found' });

      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!valid) return reply.status(400).send({ success: false, error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(body.newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

      // Invalidate all refresh tokens to force re-login on other devices
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

      return ok(null, 'Password changed successfully');
    },
  });

  // POST /api/auth/logout
  app.post('/logout', {
    schema: { tags: ['auth'], summary: 'Logout (invalidate refresh token)' },
    handler: async (request, reply) => {
      const refreshToken = getRefreshToken(request);
      if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      }
      clearRefreshCookie(reply);
      return reply.send(ok(null, 'Logged out'));
    },
  });

  // ── Password Reset ────────────────────────────────────────────────────────

  // POST /api/auth/forgot-password
  app.post('/forgot-password', {
    schema: { tags: ['auth'], summary: 'Request password reset email' },
    handler: async (request, reply) => {
      const { email, slug } = request.body as { email: string; slug: string };
      if (!email || !slug) return reply.status(400).send({ success: false, error: 'Email and resort slug required' });

      // Always return 200 to prevent email enumeration
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return reply.send(ok(null, 'If that account exists, a reset link has been sent.'));

      const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } });
      if (!user) return reply.send(ok(null, 'If that account exists, a reset link has been sent.'));

      // Expire old tokens
      await prisma.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });

      const token = randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour
      });

      const webUrl = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
      const resetUrl = `${webUrl}/auth/reset-password?token=${token}`;

      await sendEmail({
        to: email,
        subject: 'Reset your ResortPro password',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.firstName},</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Reset Password
            </a>
          </p>
          <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you didn't request this, ignore this email.</p>
        `,
      });

      return ok(null, 'If that account exists, a reset link has been sent.');
    },
  });

  // POST /api/auth/reset-password
  app.post('/reset-password', {
    schema: { tags: ['auth'], summary: 'Reset password using token' },
    handler: async (request, reply) => {
      const body = z.object({
        token: z.string().min(1),
        password: z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must contain uppercase and number'),
      }).parse(request.body);

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token: body.token },
        include: { user: true },
      });

      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return reply.status(400).send({ success: false, error: 'Invalid or expired reset link.' });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      await prisma.$transaction([
        prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
        prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } }),
        prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
      ]);

      return ok(null, 'Password reset successfully. Please log in.');
    },
  });

  // ── Staff Invite ──────────────────────────────────────────────────────────

  // GET /api/auth/invite/:token — validate invite (public)
  app.get('/invite/:token', {
    schema: { tags: ['auth'], summary: 'Validate staff invite token' },
    handler: async (request, reply) => {
      const { token } = request.params as { token: string };
      const invite = await prisma.staffInvite.findUnique({
        where: { token },
        include: { tenant: { select: { name: true, slug: true, logoUrl: true } } },
      });

      if (!invite || invite.used || invite.expiresAt < new Date()) {
        return reply.status(400).send({ success: false, error: 'Invalid or expired invite link.' });
      }

      return ok({ email: invite.email, role: invite.role, tenant: invite.tenant });
    },
  });

  // POST /api/auth/invite/accept — accept invite and create account
  app.post('/invite/accept', {
    schema: { tags: ['auth'], summary: 'Accept staff invite and create account' },
    handler: async (request, reply) => {
      const body = z.object({
        token: z.string().min(1),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must contain uppercase and number'),
      }).parse(request.body);

      const invite = await prisma.staffInvite.findUnique({ where: { token: body.token } });
      if (!invite || invite.used || invite.expiresAt < new Date()) {
        return reply.status(400).send({ success: false, error: 'Invalid or expired invite.' });
      }

      // Check if user already exists for this tenant
      const existing = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: invite.tenantId, email: invite.email } },
      });
      if (existing) return reply.status(409).send({ success: false, error: 'Account already exists with this email.' });

      const passwordHash = await bcrypt.hash(body.password, 12);

      const user = await prisma.user.create({
        data: {
          tenantId: invite.tenantId,
          email: invite.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          role: invite.role,
        },
      });

      await prisma.staffInvite.update({ where: { id: invite.id }, data: { used: true } });

      const tenant = await prisma.tenant.findUnique({ where: { id: invite.tenantId }, select: { slug: true, name: true } });

      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role as JwtPayload['role'],
        tenantId: user.tenantId,
      };
      const token = app.jwt.sign(payload);
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });
      await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      setRefreshCookie(reply, refreshToken);
      return reply.status(201).send(ok({
        token,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        tenant,
      }, `Welcome to ${tenant?.name}!`));
    },
  });

  // ── GET /api/auth/referrer?code=CODE ─────────────────────────────────────
  // Public endpoint — returns referrer resort name for the register page banner.
  app.get('/referrer', async (req, reply) => {
    const { code } = req.query as { code?: string };
    if (!code) return reply.status(400).send({ error: 'code required' });
    const tenant = await prisma.tenant.findUnique({
      where: { referralCode: code.toUpperCase() },
      select: { name: true },
    });
    if (!tenant) return reply.status(404).send({ error: 'Invalid referral code' });
    return reply.send(ok({ name: tenant.name }));
  });

  // ── POST /api/auth/demo-login ─────────────────────────────────────────────
  // No password required — issues a short-lived JWT for the demo tenant.
  // Accepts optional { role } body to select which demo persona to use.
  // Safe: demo tenant is completely isolated (separate tenantId, isDemo=true).
  app.post('/demo-login', async (req, reply) => {
    const { role: requestedRole } = (req.body as any) ?? {};

    const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!tenant || !tenant.isDemo) {
      return reply.status(404).send({ error: 'Demo not available' });
    }

    // Role → email map (matching seed-demo.ts users)
    const roleEmailMap: Record<string, string> = {
      OWNER:        'demo@resortpro.site',
      MANAGER:      'manager@coralbay.demo',
      SHAREHOLDER:  'partner@coralbay.demo',
      RECEPTIONIST: 'reception@coralbay.demo',
      MARKETER:     'marketer@coralbay.demo',
      DEVELOPER:    'dev@coralbay.demo',
      STAFF:        'hk@coralbay.demo',
      CHEF:         'chef@coralbay.demo',
    };

    const targetEmail = roleEmailMap[requestedRole as string] ?? roleEmailMap.OWNER;

    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: targetEmail },
    });

    if (!user) {
      return reply.status(404).send({ error: 'Demo user not found' });
    }

    // Short-lived token: 90 minutes only
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub:      user.id,
      email:    user.email,
      role:     user.role as JwtPayload['role'],
      tenantId: tenant.id,
    };

    const token = app.jwt.sign(payload, { expiresIn: '90m' });

    return reply.send(ok({
      token,
      isDemo: true,
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
      },
      tenant: {
        id:   tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
    }, `Welcome to the ResortPro demo! (${user.role})`));
  });
}

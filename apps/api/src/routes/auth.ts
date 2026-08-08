import type { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { applyPlanFlagsToTenant } from '../utils/entitlement';
import { ok, validate } from '../utils/response';
import { sendEmail } from '../services/email';
import { createAdminNotification } from '../utils/notifications';
import { generateReferralCode } from '../utils/referral';
import type { JwtPayload } from '@resort-pro/types';

const REFRESH_COOKIE = 'rp_refresh';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const LAUNCH_PROMOTION_KEY = 'launch_three_months_2026';

function normalized(value: string | undefined) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US') || undefined;
}

function launchPromotionWindow() {
  if (process.env.LAUNCH_PROMOTION_ENABLED !== 'true') return null;
  const startsAt = process.env.LAUNCH_PROMOTION_START_AT ? new Date(process.env.LAUNCH_PROMOTION_START_AT) : null;
  const endsAt = process.env.LAUNCH_PROMOTION_END_AT ? new Date(process.env.LAUNCH_PROMOTION_END_AT) : null;
  const now = new Date();
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) return null;
  if ((startsAt && now < startsAt) || (endsAt && now >= endsAt)) return null;
  return { key: LAUNCH_PROMOTION_KEY, now };
}

// Calendar months are based on the product's operating timezone, not a
// browser's local clock. Noon Dhaka avoids a DST-free but still clear boundary.
function threeCalendarMonthsFromDhaka(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const expiry = new Date(Date.UTC(part('year'), part('month') - 1, part('day'), 6, 0, 0));
  expiry.setUTCMonth(expiry.getUTCMonth() + 3);
  return expiry;
}

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
  address: z.string().min(3).max(200).optional(),
  // FREE is the internal key for the paid Solo plan. Enterprise remains valid
  // for existing/admin-assisted accounts but is not a public selector.
  plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  slug: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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

      const selectedPlan = body.plan ?? 'FREE';
      const promotion = launchPromotionWindow();
      const normalizedBusinessName = normalized(body.resortName)!;
      const normalizedAddress = normalized(body.address);
      const previousPromotion = promotion
        ? await prisma.promotionRedemption.findFirst({
          where: {
            promotionKey: promotion.key,
            normalizedBusinessName: { equals: normalizedBusinessName, mode: 'insensitive' },
            ...(normalizedAddress && { normalizedAddress: { equals: normalizedAddress, mode: 'insensitive' } }),
          },
          select: { id: true },
        })
        : null;
      const promotionGranted = !!promotion && !previousPromotion;
      const trialEndsAt = promotionGranted ? threeCalendarMonthsFromDhaka(promotion!.now) : null;

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
          ...(body.address && { address: body.address }),
          plan: selectedPlan,
          // Accounts are created first so a Stripe/bKash checkout can be tied
          // to the tenant. They become active only after the payment webhook.
          planStatus: promotionGranted ? 'trialing' : 'incomplete',
          trialEndsAt,
          priceProtectedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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

      await applyPlanFlagsToTenant(tenant.id, selectedPlan);
      if (promotionGranted && promotion) {
        await prisma.promotionRedemption.create({
          data: {
            promotionKey: promotion.key,
            tenantId: tenant.id,
            normalizedBusinessName,
            normalizedAddress,
            expiresAt: trialEndsAt!,
          },
        });
      }

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
        message: `${body.resortName} (${body.email}) created a ${selectedPlan} account${promotionGranted ? ' with the launch offer' : ' and is ready for checkout'}${referralNote}.`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          ownerEmail: body.email,
          plan: selectedPlan,
          promotionGranted,
          ...(trialEndsAt && { trialEndsAt: trialEndsAt.toISOString() }),
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

      // Send welcome email. Dashboard routes are platform-level, so never put
      // the internal tenant slug in the path (e.g. /demopro/dashboard). The
      // sign-in screen can safely use it to prefill the workspace instead.
      const webUrl = (
        process.env.WEB_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || process.env.CORS_ORIGIN?.split(',')[0]
        || 'http://localhost:3000'
      ).replace(/\/$/, '');
      const signInUrl = `${webUrl}/auth/login?workspace=${encodeURIComponent(body.slug)}`;

      await sendEmail({
        to: body.email,
        subject: promotionGranted ? 'Welcome to ResortPro — your launch offer is active' : 'Welcome to ResortPro — finish setting up your plan',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a6b5e">Welcome to ResortPro, ${body.firstName}!</h2>
            <p>Your resort <strong>${body.resortName}</strong> is ready. ${promotionGranted ? `Your three-month launch offer is active until <strong>${trialEndsAt!.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'Asia/Dhaka' })}</strong>.` : 'Complete checkout to activate your selected ResortPro plan.'}</p>
            <p style="margin:24px 0">
              <a href="${signInUrl}"
                 style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                ${promotionGranted ? 'Open Your Dashboard' : 'Sign in to finish setup'}
              </a>
            </p>
            <p><strong>After activation, you can:</strong></p>
            <ul>
              <li>Full booking management</li>
              <li>Guest CRM</li>
              <li>Room management</li>
              <li>Website builder</li>
            </ul>
            <p>You can always view and export your data if you decide not to continue.</p>
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
    // Brute-force / credential-stuffing guard — far stricter than the global
    // 100/min. Keyed per-IP by the rate-limit plugin's default keyGenerator.
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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

      if (invite.role === 'SHAREHOLDER' && invite.ownershipPercent) {
        await prisma.shareholderProfile.create({
          data: {
            userId: user.id,
            tenantId: invite.tenantId,
            ownershipPercent: invite.ownershipPercent,
          },
        });
      }

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

  // ── GET /api/auth/check-slug?slug=X ───────────────────────────────────────
  // Public endpoint — live availability check while typing on the register
  // page. If taken, returns a ready-to-use suggestion (base-2, base-3, ...)
  // instead of just failing, so a duplicate resort name never dead-ends the
  // signup flow at submit time.
  app.get('/check-slug', async (req, reply) => {
    const { slug: rawSlug } = req.query as { slug?: string };
    const base = (rawSlug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base || base.length < 2) {
      return reply.send(ok({ slug: base, available: false, suggestion: null }));
    }

    const existing = await prisma.tenant.findUnique({ where: { slug: base }, select: { id: true } });
    if (!existing) {
      return reply.send(ok({ slug: base, available: true, suggestion: null }));
    }

    // Base is taken — find the first free "base-2", "base-3", ... suffix.
    for (let n = 2; n <= 50; n++) {
      const candidate = `${base}-${n}`;
      const taken = await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) {
        return reply.send(ok({ slug: base, available: false, suggestion: candidate }));
      }
    }
    // Extremely unlikely (50 resorts with the exact same name) — fall back to a short random suffix.
    const fallback = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    return reply.send(ok({ slug: base, available: false, suggestion: fallback }));
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
  // Accepts { role, email }. Access is still instant (no verification step),
  // but a real email is now required: every demo view leaves behind a
  // DemoLead record + a follow-up email, so marketing knows who's evaluating
  // the product. Safe: demo tenant is completely isolated (separate
  // tenantId, isDemo=true).
  app.post('/demo-login', {
    // Was 10/min — easily exceeded by a normal shared-IP burst (an office
    // or school trying the demo together) since this endpoint is meant to
    // be frictionless, and by the E2E role suite itself (17 logins/run from
    // one IP), which started intermittently failing mid-suite once it hit
    // this ceiling. Still meaningfully bot-resistant at 30/min.
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { role: requestedRole, email } = (req.body as any) ?? {};

    const parsedEmail = z.string().trim().email().safeParse(email);
    if (!parsedEmail.success) {
      return reply.status(400).send({ error: 'A valid email is required to access the demo' });
    }

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

    const role = roleEmailMap[requestedRole as string] ? (requestedRole as string) : 'OWNER';
    const targetEmail = roleEmailMap[role];

    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: targetEmail },
    });

    if (!user) {
      return reply.status(404).send({ error: 'Demo user not found' });
    }

    // Record the lead — best-effort, must never block or fail demo access.
    try {
      await prisma.demoLead.create({
        data: {
          email:     parsedEmail.data,
          role,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to record demo lead');
    }

    // Email a copy — fire-and-forget, never block the response on delivery.
    sendEmail({
      to: parsedEmail.data,
      subject: 'Your ResortPro demo access',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a6b5e">You're exploring ResortPro as ${user.firstName} (${role.charAt(0)}${role.slice(1).toLowerCase()})</h2>
          <p>Thanks for taking a look! Your demo session is already open in the tab where you clicked in — this email is just your copy.</p>
          <p style="margin:24px 0">
            <a href="${process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/try?email=${encodeURIComponent(parsedEmail.data)}"
               style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Open the demo again
            </a>
          </p>
          <p>Liked what you saw? Start your own 14-day free trial — no credit card needed.</p>
          <p style="margin:24px 0">
            <a href="${process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/plans"
               style="background:#d4a853;color:#1a1a1a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Start free trial
            </a>
          </p>
          <p>Questions? Reply to this email anytime.</p>
        </div>
      `,
    }).catch((err) => req.log.error({ err }, 'Failed to send demo access email'));

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

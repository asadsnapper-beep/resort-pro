import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database'; // kept for cross-tenant checks (e.g. domain uniqueness)
import { requireRole, requireAuth } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import * as dns from 'dns/promises';
import { FLAG_REGISTRY } from '../utils/feature-flags';
import { sendTestEmail } from '../utils/guest-emails';
import crypto from 'crypto';

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  // Allow empty string to clear these fields — transform '' → undefined so Prisma skips the field
  email: z.union([z.string().email(), z.literal('')]).optional().transform(v => v === '' ? undefined : v),
  website: z.union([z.string().url(), z.literal('')]).optional().transform(v => v === '' ? undefined : v),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function tenantRoutes(app: FastifyInstance) {
  // Our own app domain — used for CNAME target instructions
  const APP_DOMAIN = process.env.APP_DOMAIN || 'resortpro.site';
  const APP_IP     = process.env.APP_IP     || '';   // set in production

  app.get('/', {
    schema: { tags: ['tenant'], summary: 'Get tenant/resort settings', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true, name: true, slug: true, plan: true,
          phone: true, email: true, website: true, address: true,
          currency: true, timezone: true, checkInTime: true, checkOutTime: true,
          logoUrl: true, createdAt: true,
          customDomain: true, domainVerified: true, domainVerifiedAt: true,
        },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      return ok(tenant);
    },
  });

  /* ── Custom domain ───────────────────────────────────────────────────────── */

  // PUT /api/tenant/domain — save or clear custom domain
  app.put('/domain', {
    schema: { tags: ['tenant'], summary: 'Set custom domain', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = z.object({
        domain: z.string()
          .transform(d => d.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, ''))
          .refine(d => /^[a-z0-9][a-z0-9\-.]+\.[a-z]{2,}$/.test(d), 'Invalid domain format')
          .nullable(),
      }).parse(request.body);

      if (body.domain) {
        // Check domain not already used by another tenant — cross-tenant check, must use bare prisma
        const existing = await prisma.tenant.findFirst({
          where: { customDomain: body.domain, id: { not: tenantId } },
        });
        if (existing) return reply.status(409).send({ success: false, error: 'This domain is already connected to another resort' });
      }

      const tenant = await db.tenant.update({
        where: { id: tenantId },
        data: {
          customDomain:   body.domain,
          domainVerified: false,
          domainVerifiedAt: null,
        },
        select: { customDomain: true, domainVerified: true, slug: true },
      });

      return ok({
        ...tenant,
        cnameTarget: `${tenant.slug}.${APP_DOMAIN}`,
        aRecord:     APP_IP || null,
        instructions: body.domain ? [
          `Add a CNAME record: ${body.domain} → ${tenant.slug}.${APP_DOMAIN}`,
          `Or an A record: ${body.domain} → ${APP_IP || '<server IP>'}`,
          'DNS changes may take up to 48 hours to propagate.',
          'Click "Verify Domain" once DNS is set.',
        ] : [],
      }, body.domain ? 'Custom domain saved' : 'Custom domain removed');
    },
  });

  // POST /api/tenant/domain/verify — check DNS then mark verified
  app.post('/domain/verify', {
    schema: { tags: ['tenant'], summary: 'Verify custom domain DNS', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { customDomain: true, slug: true },
      });

      if (!tenant?.customDomain) {
        return reply.status(400).send({ success: false, error: 'No custom domain set' });
      }

      const cnameTarget = `${tenant.slug}.${APP_DOMAIN}`;
      let verified = false;
      let method: string | null = null;
      let resolvedTo: string | null = null;

      try {
        // Check CNAME
        const cnames = await dns.resolveCname(tenant.customDomain).catch(() => []);
        if (cnames.some(c => c.replace(/\.$/, '') === cnameTarget)) {
          verified = true; method = 'CNAME'; resolvedTo = cnameTarget;
        }

        // Fallback: check A record if IP configured
        if (!verified && APP_IP) {
          const addrs = await dns.resolve4(tenant.customDomain).catch(() => [] as string[]);
          if (addrs.includes(APP_IP)) {
            verified = true; method = 'A'; resolvedTo = APP_IP;
          }
        }

        // Dev mode: allow localhost / same-host to verify automatically
        if (!verified && process.env.NODE_ENV === 'development') {
          verified = true; method = 'DEV'; resolvedTo = 'localhost (dev mode)';
        }
      } catch {
        // DNS lookup failed
      }

      if (!verified) {
        return reply.status(422).send({
          success: false,
          error: 'DNS not configured yet',
          message: `We could not find a CNAME pointing ${tenant.customDomain} → ${cnameTarget}. DNS changes can take up to 48 hours.`,
        });
      }

      await db.tenant.update({
        where: { id: tenantId },
        data: { domainVerified: true, domainVerifiedAt: new Date() },
      });

      return ok({ verified: true, method, resolvedTo }, '✅ Domain verified successfully!');
    },
  });

  // POST /api/tenant/domain/provision-ssl — request SSL certificate provisioning
  app.post('/domain/provision-ssl', {
    schema: { tags: ['tenant'], summary: 'Request SSL certificate for custom domain', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { customDomain: true, domainVerified: true, sslStatus: true },
      });

      if (!tenant?.customDomain) {
        return reply.status(400).send({ success: false, error: 'No custom domain configured' });
      }
      if (!tenant.domainVerified) {
        return reply.status(400).send({ success: false, error: 'Domain must be verified before provisioning SSL' });
      }
      if (tenant.sslStatus === 'active') {
        return reply.status(400).send({ success: false, error: 'SSL certificate is already active' });
      }

      // In production this would call cert-manager / ACME / Caddy API.
      // Here we set status to "provisioning" — a background job / webhook updates it to "active".
      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: { sslStatus: 'provisioning', sslError: null },
        select: { customDomain: true, sslStatus: true },
      });

      return ok({
        ...updated,
        message: 'SSL provisioning started. Certificates are usually issued within 5 minutes.',
        webhook: `${process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : 'http://localhost:4000'}/api/tenant/domain/ssl-webhook`,
      }, 'SSL provisioning initiated');
    },
  });

  // GET /api/tenant/domain/status — full domain + SSL status
  app.get('/domain/status', {
    schema: { tags: ['tenant'], summary: 'Get domain & SSL status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          customDomain: true, domainVerified: true, domainVerifiedAt: true,
          domainVerificationToken: true, slug: true,
          sslStatus: true, sslProvisionedAt: true, sslExpiresAt: true, sslError: true,
        },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Not found' });

      const APP_DOMAIN = process.env.APP_DOMAIN || 'resortpro.site';
      const APP_IP = process.env.APP_IP || '';

      return ok({
        ...tenant,
        cnameTarget: `${tenant.slug}.${APP_DOMAIN}`,
        aRecord: APP_IP || null,
        daysUntilExpiry: tenant.sslExpiresAt
          ? Math.ceil((new Date(tenant.sslExpiresAt).getTime() - Date.now()) / 86_400_000)
          : null,
      });
    },
  });

  app.patch('/', {
    schema: { tags: ['tenant'], summary: 'Update resort settings', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = updateTenantSchema.parse(request.body);
      const tenant = await db.tenant.update({ where: { id: tenantId }, data: body });
      return ok(tenant, 'Settings updated');
    },
  });

  // ── GET /api/tenant/flags — returns enabled flags for this tenant ─────────
  app.get('/flags', {
    schema: { tags: ['tenant'], summary: 'Get feature flags for this tenant', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'SHAREHOLDER', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const rows = await db.tenantFeatureFlag.findMany({
        where: { enabled: true },
        select: { flag: true },
      });
      // Return as a flat set of enabled flag keys — easy to check in the dashboard
      const enabledFlags = new Set(rows.map((r) => r.flag));
      // Also include any flags that are defaultOn and have no override row
      for (const def of FLAG_REGISTRY) {
        if (def.defaultOn) enabledFlags.add(def.flag);
      }
      // But respect explicit disabled overrides
      const allRows = await db.tenantFeatureFlag.findMany({ where: {}, select: { flag: true, enabled: true } });
      for (const row of allRows) {
        if (!row.enabled) enabledFlags.delete(row.flag);
      }
      return ok(Array.from(enabledFlags));
    },
  });

  // ── PATCH /api/tenant/flags/module — owner toggles an ownerControllable module flag
  app.patch('/flags/module', {
    schema: { tags: ['tenant'], summary: 'Toggle an owner-controlled module flag', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = z.object({
        flag: z.string(),
        enabled: z.boolean(),
      }).parse(request.body);

      const flagDef = FLAG_REGISTRY.find((f) => f.flag === body.flag);
      if (!flagDef || !flagDef.ownerControllable) {
        return reply.status(403).send({ success: false, error: 'This flag cannot be toggled by owners.' });
      }

      await db.tenantFeatureFlag.upsert({
        where: { tenantId_flag: { tenantId, flag: body.flag } },
        create: { tenantId, flag: body.flag, enabled: body.enabled },
        update: { enabled: body.enabled },
      });

      return ok({ flag: body.flag, enabled: body.enabled }, 'Module updated');
    },
  });

  // ── GET /api/tenant/flags/modules — returns owner-controllable modules with their status
  app.get('/flags/modules', {
    schema: { tags: ['tenant'], summary: 'Get owner-controllable module flags and their status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;

      const moduleFlags = FLAG_REGISTRY.filter((f) => f.ownerControllable);
      const rows = await db.tenantFeatureFlag.findMany({
        where: { flag: { in: moduleFlags.map((f) => f.flag) } },
        select: { flag: true, enabled: true },
      });
      const overrides = Object.fromEntries(rows.map((r) => [r.flag, r.enabled]));

      const modules = moduleFlags.map((f) => ({
        flag: f.flag,
        label: f.label,
        description: f.description,
        enabled: f.flag in overrides ? overrides[f.flag] : f.defaultOn,
      }));

      return ok(modules);
    },
  });

  // ── POST /api/tenant/gdpr/request-erasure — owner requests own data deletion
  app.post('/gdpr/request-erasure', {
    schema: { tags: ['tenant'], summary: 'Request GDPR erasure of this resort\'s data', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, gdprErasureRequestedAt: true, gdprAnonymizedAt: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      if (tenant.gdprErasureRequestedAt) {
        return reply.status(409).send({
          success: false,
          error: 'Erasure already requested. Data will be anonymized after the 30-day grace period.',
        });
      }
      await db.tenant.update({
        where: { id: tenantId },
        data: {
          gdprErasureRequestedAt: new Date(),
          gdprErasureRequestedBy: 'owner',
          isActive: false,
        },
      });
      const erasureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return ok({
        message: 'Erasure request submitted. Your data will be anonymized after a 30-day grace period. Contact support to cancel.',
        erasureDate,
      });
    },
  });

  // ── GET /api/tenant/gdpr/export — owner exports their own data ─────────────
  app.get('/gdpr/export', {
    schema: { tags: ['tenant'], summary: 'Export all personal data (Article 20)', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, slug: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      // Lazy import to keep gdpr util out of the main bundle
      const { collectTenantExport } = await import('../utils/gdpr');
      const data = await collectTenantExport(tenantId);

      const filename = `my-data-export-${tenant.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(JSON.stringify(data, null, 2));
    },
  });

  // ── GET /api/tenant/announcements — active platform announcements ─────────
  // Used by tenant dashboard to show in-app banners
  app.get('/announcements', {
    schema: { tags: ['tenant'], summary: 'Get active platform announcements', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'SHAREHOLDER', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'STAFF'),
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });
      if (!tenant) return ok([]);

      const now = new Date();
      // PlatformAnnouncement has no tenantId column (it's a global/platform model, not
      // tenant-scoped) — tenantPrisma's $allModels middleware would inject tenantId into
      // every model's where clause regardless, so this must go through the raw client.
      const announcements = await prisma.platformAnnouncement.findMany({
        where: {
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, body: true, type: true,
          isDismissible: true, targetPlans: true, startsAt: true, endsAt: true,
        },
      });

      // Filter by plan targeting
      const filtered = announcements.filter(
        (a) => a.targetPlans.length === 0 || a.targetPlans.includes(tenant.plan)
      );

      return ok(filtered);
    },
  });

  // ── GET /api/tenant/sla — tenant views their own SLA agreement ────────────
  app.get('/sla', {
    schema: { tags: ['tenant'], summary: 'Get own SLA agreement', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const sla = await db.slaAgreement.findUnique({ where: { tenantId } });
      return ok(sla ?? null);
    },
  });

  // ── GET /api/tenant/enterprise — tenant's enterprise profile (no secrets) ─
  app.get('/enterprise', {
    schema: { tags: ['tenant'], summary: 'Get enterprise profile', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          plan: true,
          whitelabelEnabled: true, brandLogoUrl: true,
          brandPrimaryColor: true, brandAccentColor: true,
          companyDisplayName: true,
          ssoEnabled: true, ssoProvider: true, ssoClientId: true,
          // no ssoClientSecret
          onboardingStep: true, onboardingCompletedAt: true,
          slaAgreement: {
            select: {
              tier: true, uptimePercent: true, responseTimeH: true,
              contractStart: true, contractEnd: true, autoRenew: true,
              signedAt: true,
            },
          },
        },
      });
      return ok(tenant);
    },
  });

  // ── Email Settings ─────────────────────────────────────────────────────────

  // GET /api/tenant/email-settings
  app.get('/email-settings', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const settings = await db.emailSettings.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
      return ok(settings);
    },
  });

  // PATCH /api/tenant/email-settings
  app.patch('/email-settings', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as {
        sendConfirmation?: boolean;
        sendPreArrival?: boolean;
        sendCheckoutInvoice?: boolean;
        sendCancellation?: boolean;
        replyToEmail?: string | null;
        footerText?: string | null;
      };
      const settings = await db.emailSettings.upsert({
        where: { tenantId },
        create: { tenantId, ...body },
        update: body,
      });
      return ok(settings);
    },
  });

  // POST /api/tenant/email-settings/test
  app.post('/email-settings/test', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { toEmail } = request.body as { toEmail: string };
      await sendTestEmail(tenantId, toEmail); // uses tenantId param — bare helper
      return ok({ sent: true, to: toEmail });
    },
  });

  // ─── SMS & WhatsApp Settings ────────────────────────────────────────────────

  // GET /api/tenant/sms-settings
  app.get('/sms-settings', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: {
          smsEnabled: true, smsMode: true, smsProvider: true,
          smsSenderId: true,
          // never return raw api keys — mask them
          smsApiKey: true, smsApiSecret: true,
          waEnabled: true, waMode: true,
          waApiToken: true, waPhoneNumberId: true, waBusinessAccId: true,
          notifBookingConfirm: true, notifPaymentReceived: true,
          notifCheckinReminder: true, notifCheckoutRemind: true,
          notifCancellation: true, notifInvoiceSent: true,
          notifLanguage: true,
          smsQuotaMonthly: true, smsUsedThisMonth: true, smsCredits: true,
          waQuotaMonthly: true,  waUsedThisMonth: true,  waCredits: true,
        },
      });
      if (!tenant) return { success: false, error: 'Tenant not found' };

      // Mask API keys — only show last 4 chars if set
      const mask = (v?: string | null) => v ? '••••••••' + v.slice(-4) : null;
      return ok({
        ...tenant,
        smsApiKey:    mask(tenant.smsApiKey),
        smsApiSecret: mask(tenant.smsApiSecret),
        waApiToken:   mask(tenant.waApiToken),
      });
    },
  });

  // PATCH /api/tenant/sms-settings  — toggle, triggers, language
  app.patch('/sms-settings', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as {
        smsEnabled?: boolean; waEnabled?: boolean;
        notifBookingConfirm?: boolean; notifPaymentReceived?: boolean;
        notifCheckinReminder?: boolean; notifCheckoutRemind?: boolean;
        notifCancellation?: boolean; notifInvoiceSent?: boolean;
        notifLanguage?: string;
      };
      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: {
          ...(body.smsEnabled            !== undefined && { smsEnabled: body.smsEnabled }),
          ...(body.waEnabled             !== undefined && { waEnabled:  body.waEnabled }),
          ...(body.notifBookingConfirm   !== undefined && { notifBookingConfirm:  body.notifBookingConfirm }),
          ...(body.notifPaymentReceived  !== undefined && { notifPaymentReceived: body.notifPaymentReceived }),
          ...(body.notifCheckinReminder  !== undefined && { notifCheckinReminder: body.notifCheckinReminder }),
          ...(body.notifCheckoutRemind   !== undefined && { notifCheckoutRemind:  body.notifCheckoutRemind }),
          ...(body.notifCancellation     !== undefined && { notifCancellation:    body.notifCancellation }),
          ...(body.notifInvoiceSent      !== undefined && { notifInvoiceSent:     body.notifInvoiceSent }),
          ...(body.notifLanguage         !== undefined && { notifLanguage:        body.notifLanguage }),
        },
        select: {
          smsEnabled: true, waEnabled: true,
          notifBookingConfirm: true, notifPaymentReceived: true,
          notifCheckinReminder: true, notifCheckoutRemind: true,
          notifCancellation: true, notifInvoiceSent: true,
          notifLanguage: true,
        },
      });
      return ok(updated, 'Notification settings saved');
    },
  });

  // PATCH /api/tenant/sms-credentials  — SMS BYOC credentials
  app.patch('/sms-credentials', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER')],
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as {
        smsMode: 'platform' | 'own';
        smsProvider?: string;
        smsApiKey?: string;
        smsApiSecret?: string;
        smsSenderId?: string;
      };

      const data: Record<string, any> = { smsMode: body.smsMode };
      if (body.smsMode === 'own') {
        if (body.smsProvider) data.smsProvider = body.smsProvider;
        if (body.smsSenderId) data.smsSenderId = body.smsSenderId;
        // Only update keys if new value provided (not the masked placeholder)
        if (body.smsApiKey    && !body.smsApiKey.startsWith('••••'))    data.smsApiKey    = body.smsApiKey;
        if (body.smsApiSecret && !body.smsApiSecret.startsWith('••••')) data.smsApiSecret = body.smsApiSecret;
      }

      await db.tenant.update({ where: { id: tenantId }, data });
      return ok({ smsMode: body.smsMode }, 'SMS credentials saved');
    },
  });

  // PATCH /api/tenant/wa-credentials  — WhatsApp BYOC credentials
  app.patch('/wa-credentials', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER')],
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as {
        waMode: 'platform' | 'own';
        waPhoneNumberId?: string;
        waApiToken?: string;
        waBusinessAccId?: string;
      };

      const data: Record<string, any> = { waMode: body.waMode };
      if (body.waMode === 'own') {
        if (body.waPhoneNumberId) data.waPhoneNumberId = body.waPhoneNumberId;
        if (body.waBusinessAccId) data.waBusinessAccId = body.waBusinessAccId;
        if (body.waApiToken && !body.waApiToken.startsWith('••••')) data.waApiToken = body.waApiToken;
      }

      await db.tenant.update({ where: { id: tenantId }, data });
      return ok({ waMode: body.waMode }, 'WhatsApp credentials saved');
    },
  });

  // POST /api/tenant/sms-settings/test-sms
  app.post('/sms-settings/test-sms', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { to } = request.body as { to: string };
      if (!to) return reply.status(400).send({ success: false, error: 'Phone number required' });
      // Placeholder — real SMS service will be wired in Phase 1 implementation
      return ok({ sent: true, to, message: `Test SMS from ResortPro — SMS notifications are configured correctly!` }, 'Test SMS queued (SMS service coming soon)');
    },
  });

  // POST /api/tenant/sms-settings/test-whatsapp
  app.post('/sms-settings/test-whatsapp', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { to } = request.body as { to: string };
      if (!to) return reply.status(400).send({ success: false, error: 'Phone number required' });
      return ok({ sent: true, to }, 'WhatsApp test queued (WhatsApp service coming soon)');
    },
  });

  // ── GET /api/tenant/referrals ────────────────────────────────────────────
  app.get('/referrals', {
    schema: { tags: ['tenant'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER')],
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { referralCode: true, accountCredit: true, freeUntil: true, plan: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      const referrals = await db.referral.findMany({
        where: { referrerId: tenantId },
        include: {
          referred: { select: { name: true, slug: true, plan: true, planStatus: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const APP_URL = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
      const referralLink = tenant.referralCode
        ? `${APP_URL}/register?ref=${tenant.referralCode}`
        : null;

      return reply.send(ok({
        referralCode: tenant.referralCode,
        referralLink,
        accountCredit: tenant.accountCredit,
        freeUntil: tenant.freeUntil,
        stats: {
          total: referrals.length,
          rewarded: referrals.filter(r => r.status === 'REWARDED').length,
          pending: referrals.filter(r => r.status === 'PENDING').length,
        },
        referrals,
      }));
    },
  });

  // ── Team management ──────────────────────────────────────────────────────────

  // GET /api/tenants/team — list all team members + pending invites
  app.get('/team', {
    schema: { tags: ['tenants'], summary: 'List team members', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const { sub } = request.user as JwtPayload;
      const [members, pendingInvites] = await Promise.all([
        db.user.findMany({
          where: {},
          select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        db.staffInvite.findMany({
          where: { used: false, expiresAt: { gt: new Date() } },
          select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return ok({ members: members.map(m => ({ ...m, isSelf: m.id === sub })), pendingInvites });
    },
  });

  // POST /api/tenants/team/invite — send invite link
  app.post('/team/invite', {
    schema: { tags: ['tenants'], summary: 'Invite a team member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { email, role } = z.object({
        email: z.string().email(),
        role: z.enum(['MANAGER', 'SHAREHOLDER', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'STAFF', 'CHEF']),
      }).parse(request.body);

      // Check if user already exists in this tenant
      const existing = await db.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
      if (existing) return reply.status(409).send({ success: false, error: 'A user with this email already exists in your team.' });

      // Cancel any previous pending invites for same email
      await db.staffInvite.updateMany({
        where: { email, used: false },
        data: { used: true },
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await db.staffInvite.create({ data: { tenantId, email, role: role as never, token, expiresAt } });

      const APP_URL = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
      const inviteLink = `${APP_URL}/auth/invite?token=${token}`;

      return reply.status(201).send(ok({ inviteLink, email, role, expiresAt }, 'Invite created'));
    },
  });

  // PATCH /api/tenants/team/:userId/role — change a member's role (OWNER only)
  app.patch('/team/:userId/role', {
    schema: { tags: ['tenants'], summary: 'Change team member role', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { sub } = request.user as JwtPayload;
      const { userId } = request.params as { userId: string };
      const { role } = z.object({
        role: z.enum(['MANAGER', 'SHAREHOLDER', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'STAFF', 'CHEF']),
      }).parse(request.body);

      if (userId === sub) return reply.status(400).send({ success: false, error: 'You cannot change your own role.' });

      const member = await db.user.findFirst({ where: { id: userId } });
      if (!member) return reply.status(404).send({ success: false, error: 'Team member not found.' });
      if (member.role === 'OWNER') return reply.status(403).send({ success: false, error: 'Cannot change the owner\'s role.' });

      const updated = await db.user.update({ where: { id: userId }, data: { role: role as never } });
      return ok({ id: updated.id, role: updated.role }, 'Role updated');
    },
  });

  // DELETE /api/tenants/team/:userId — remove a team member (OWNER only)
  app.delete('/team/:userId', {
    schema: { tags: ['tenants'], summary: 'Remove a team member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { sub } = request.user as JwtPayload;
      const { userId } = request.params as { userId: string };

      if (userId === sub) return reply.status(400).send({ success: false, error: 'You cannot remove yourself.' });

      const member = await db.user.findFirst({ where: { id: userId } });
      if (!member) return reply.status(404).send({ success: false, error: 'Team member not found.' });
      if (member.role === 'OWNER') return reply.status(403).send({ success: false, error: 'Cannot remove the owner.' });

      await db.user.delete({ where: { id: userId } });
      return ok({ id: userId }, 'Team member removed');
    },
  });

  // DELETE /api/tenants/team/invite/:inviteId — cancel a pending invite
  app.delete('/team/invite/:inviteId', {
    schema: { tags: ['tenants'], summary: 'Cancel a pending invite', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { inviteId } = request.params as { inviteId: string };
      const invite = await db.staffInvite.findFirst({ where: { id: inviteId } });
      if (!invite) return reply.status(404).send({ success: false, error: 'Invite not found.' });
      await db.staffInvite.update({ where: { id: inviteId }, data: { used: true } });
      return ok({ id: inviteId }, 'Invite cancelled');
    },
  });

  // ── Room Type Labels ────────────────────────────────────────────────────────

  const VALID_ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;
  const DEFAULT_ROOM_TYPE_LABELS: Record<string, string> = {
    STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
    VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
  };

  // GET /api/tenant/room-types — current labels merged with defaults
  app.get('/room-types', {
    schema: { tags: ['tenants'], summary: 'Get room type display labels', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { roomTypeLabels: true } });
      const saved = (tenant?.roomTypeLabels ?? {}) as Record<string, string>;
      const labels = { ...DEFAULT_ROOM_TYPE_LABELS, ...saved };
      return ok({ labels, defaults: DEFAULT_ROOM_TYPE_LABELS });
    },
  });

  // PATCH /api/tenant/room-types — update one or more labels
  app.patch('/room-types', {
    schema: { tags: ['tenants'], summary: 'Update room type display labels', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;

      const body = z.record(z.string().min(1).max(50)).parse(request.body);

      const invalidKeys = Object.keys(body).filter(k => !VALID_ROOM_TYPES.includes(k as typeof VALID_ROOM_TYPES[number]));
      if (invalidKeys.length > 0) {
        return reply.status(400).send({ success: false, error: `Invalid room type keys: ${invalidKeys.join(', ')}` });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { roomTypeLabels: true } });
      const current = (tenant?.roomTypeLabels ?? {}) as Record<string, string>;

      const merged = { ...current, ...body };
      for (const [k, v] of Object.entries(merged)) {
        if (v === DEFAULT_ROOM_TYPE_LABELS[k]) delete merged[k];
      }

      await prisma.tenant.update({ where: { id: tenantId }, data: { roomTypeLabels: merged } });
      const labels = { ...DEFAULT_ROOM_TYPE_LABELS, ...merged };
      return ok({ labels, defaults: DEFAULT_ROOM_TYPE_LABELS }, 'Room type labels updated');
    },
  });

  // DELETE /api/tenant/room-types/:type — reset a single type to default
  app.delete('/room-types/:type', {
    schema: { tags: ['tenants'], summary: 'Reset a room type label to default', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { type } = request.params as { type: string };

      if (!VALID_ROOM_TYPES.includes(type as typeof VALID_ROOM_TYPES[number])) {
        return reply.status(400).send({ success: false, error: `Invalid room type: ${type}` });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { roomTypeLabels: true } });
      const current = { ...(tenant?.roomTypeLabels ?? {}) } as Record<string, string>;
      delete current[type];
      await prisma.tenant.update({ where: { id: tenantId }, data: { roomTypeLabels: current } });

      const labels = { ...DEFAULT_ROOM_TYPE_LABELS, ...current };
      return ok({ labels, defaults: DEFAULT_ROOM_TYPE_LABELS }, 'Reset to default');
    },
  });
}

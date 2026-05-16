import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole, requireAuth } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import * as dns from 'dns/promises';
import { FLAG_REGISTRY } from '../utils/feature-flags';
import { sendTestEmail } from '../utils/guest-emails';

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function tenantRoutes(app: FastifyInstance) {
  // Our own app domain — used for CNAME target instructions
  const APP_DOMAIN = process.env.APP_DOMAIN || 'resortpro.app';
  const APP_IP     = process.env.APP_IP     || '';   // set in production

  app.get('/', {
    schema: { tags: ['tenant'], summary: 'Get tenant/resort settings', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
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
      const { tenantId } = request.user as JwtPayload;
      const body = z.object({
        domain: z.string()
          .transform(d => d.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, ''))
          .refine(d => /^[a-z0-9][a-z0-9\-.]+\.[a-z]{2,}$/.test(d), 'Invalid domain format')
          .nullable(),
      }).parse(request.body);

      if (body.domain) {
        // Check domain not already used by another tenant
        const existing = await prisma.tenant.findFirst({
          where: { customDomain: body.domain, id: { not: tenantId } },
        });
        if (existing) return reply.status(409).send({ success: false, error: 'This domain is already connected to another resort' });
      }

      const tenant = await prisma.tenant.update({
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
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
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
          const addrs = await dns.resolve4(tenant.customDomain).catch(() => []);
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

      await prisma.tenant.update({
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
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
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
      const updated = await prisma.tenant.update({
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
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          customDomain: true, domainVerified: true, domainVerifiedAt: true,
          domainVerificationToken: true, slug: true,
          sslStatus: true, sslProvisionedAt: true, sslExpiresAt: true, sslError: true,
        },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Not found' });

      const APP_DOMAIN = process.env.APP_DOMAIN || 'resortpro.app';
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
      const { tenantId } = request.user as JwtPayload;
      const body = updateTenantSchema.parse(request.body);
      const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: body });
      return ok(tenant, 'Settings updated');
    },
  });

  // ── GET /api/tenant/flags — returns enabled flags for this tenant ─────────
  app.get('/flags', {
    schema: { tags: ['tenant'], summary: 'Get feature flags for this tenant', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'PARTNER', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'STAFF'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const rows = await prisma.tenantFeatureFlag.findMany({
        where: { tenantId, enabled: true },
        select: { flag: true },
      });
      // Return as a flat set of enabled flag keys — easy to check in the dashboard
      const enabledFlags = new Set(rows.map((r) => r.flag));
      // Also include any flags that are defaultOn and have no override row
      for (const def of FLAG_REGISTRY) {
        if (def.defaultOn) enabledFlags.add(def.flag);
      }
      // But respect explicit disabled overrides
      const allRows = await prisma.tenantFeatureFlag.findMany({ where: { tenantId }, select: { flag: true, enabled: true } });
      for (const row of allRows) {
        if (!row.enabled) enabledFlags.delete(row.flag);
      }
      return ok(Array.from(enabledFlags));
    },
  });

  // ── POST /api/tenant/gdpr/request-erasure — owner requests own data deletion
  app.post('/gdpr/request-erasure', {
    schema: { tags: ['tenant'], summary: 'Request GDPR erasure of this resort\'s data', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
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
      await prisma.tenant.update({
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
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
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
    preHandler: requireRole('OWNER', 'MANAGER', 'PARTNER', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'STAFF'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });
      if (!tenant) return ok([]);

      const now = new Date();
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
      const { tenantId } = request.user as JwtPayload;
      const sla = await prisma.slaAgreement.findUnique({ where: { tenantId } });
      return ok(sla ?? null);
    },
  });

  // ── GET /api/tenant/enterprise — tenant's enterprise profile (no secrets) ─
  app.get('/enterprise', {
    schema: { tags: ['tenant'], summary: 'Get enterprise profile', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const tenant = await prisma.tenant.findUnique({
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
      const { tenantId } = request.user as JwtPayload;
      const settings = await prisma.emailSettings.upsert({
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
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as {
        sendConfirmation?: boolean;
        sendPreArrival?: boolean;
        sendCheckoutInvoice?: boolean;
        sendCancellation?: boolean;
        replyToEmail?: string | null;
        footerText?: string | null;
      };
      const settings = await prisma.emailSettings.upsert({
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
      await sendTestEmail(tenantId, toEmail);
      return ok({ sent: true, to: toEmail });
    },
  });
}

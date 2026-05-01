import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import * as dns from 'dns/promises';

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
}

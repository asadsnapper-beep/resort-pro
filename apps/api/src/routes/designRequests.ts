/**
 * Custom design service — owner-facing routes.
 *
 * An owner asks for a bespoke website from the dashboard; admin quotes it,
 * builds it, and ships it as a theme scoped to that tenant only
 * (Theme.exclusiveToTenantId). Admin-side pipeline lives in admin.ts.
 *
 * See plan/theme-studio-and-design-service.md (Part B).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import { createAdminNotification } from '../utils/notifications';
import type { JwtPayload } from '@resort-pro/types';

/** Matches the pricing tiers shown in the dashboard modal. */
const TIERS = ['branding', 'custom', 'premium'] as const;

const createSchema = z.object({
  contactName:  z.string().min(1).max(100),
  contactPhone: z.string().min(1).max(30),
  contactEmail: z.string().email(),
  tier:         z.enum(TIERS).optional(),
  budgetRange:  z.string().max(60).optional(),
  timeline:     z.string().max(60).optional(),
  description:  z.string().min(10).max(4000),
  // Reference sites they like. Capped so the field can't be used as free storage.
  referenceUrls: z.array(z.string().url()).max(10).default([]),
});

export async function designRequestRoutes(app: FastifyInstance) {
  // ── POST / — owner submits a request ────────────────────────────────────────
  app.post('/', {
    // This creates records and fires an admin notification, so cap it well
    // below the global limit — one resort has no reason to submit in bulk.
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    schema: { tags: ['design-requests'], summary: 'Request a custom website design', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = validate(createSchema, request.body, reply);
      if (!body) return;

      // One open request at a time — avoids duplicate leads for the same job.
      const existing = await db.designRequest.findFirst({
        where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        select: { id: true, status: true },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: 'You already have a design request in progress. We will get back to you shortly.',
        });
      }

      // tenantPrisma injects tenantId at runtime, which Prisma's generated
      // CreateInput type has no way to know — so the object is genuinely
      // "incomplete" as far as the compiler is concerned. Narrow cast rather
      // than leaving the error in place (most tenant-scoped creates elsewhere
      // in this codebase still carry it as part of the ~105-error backlog).
      const created = await db.designRequest.create({
        data: body as unknown as Parameters<typeof db.designRequest.create>[0]['data'],
      });

      // Tenant name for the notification copy. Safe through `db`: tenantPrisma
      // skips its scoping check for the Tenant model itself, and the id comes
      // from the caller's own token.
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true },
      });

      await createAdminNotification({
        type: 'design_request',
        title: '🎨 Custom design request',
        message: `${tenant?.name ?? 'A resort'} requested a ${body.tier ?? 'custom'} design.`,
        metadata: {
          designRequestId: created.id,
          tenantId,
          tenantName: tenant?.name,
          tenantSlug: tenant?.slug,
          tier: body.tier,
          budgetRange: body.budgetRange,
        },
        linkPath: '/admin/design-requests',
      });

      return reply.status(201).send(ok(created, 'Request sent — we will contact you shortly.'));
    },
  });

  // ── GET / — owner sees their own requests ───────────────────────────────────
  app.get('/', {
    schema: { tags: ['design-requests'], summary: 'List my design requests', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const rows = await db.designRequest.findMany({
        orderBy: { createdAt: 'desc' },
        // adminNotes is internal — never expose it to the tenant.
        select: {
          id: true, status: true, tier: true, description: true,
          budgetRange: true, timeline: true, referenceUrls: true,
          quotedAmount: true, currency: true, quotedAt: true,
          deliveredThemeKey: true, createdAt: true, updatedAt: true,
        },
      });
      return ok(rows);
    },
  });
}

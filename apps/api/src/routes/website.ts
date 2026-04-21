import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const websiteSchema = z.object({
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().optional(),
  heroImage: z.string().url().optional(),
  aboutTitle: z.string().optional(),
  aboutText: z.string().optional(),
  aboutImage: z.string().url().optional(),
  galleryImages: z.array(z.string().url()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  testimonials: z.array(z.object({
    name: z.string(),
    text: z.string(),
    rating: z.number().min(1).max(5),
    avatar: z.string().optional(),
  })).optional(),
});

export async function websiteRoutes(app: FastifyInstance) {
  // GET /api/website — get website content (authenticated)
  app.get('/', {
    schema: { tags: ['website'], summary: 'Get website content', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const content = await prisma.websiteContent.findUnique({ where: { tenantId } });
      if (!content) return reply.status(404).send({ success: false, error: 'Website content not found' });
      return ok(content);
    },
  });

  // PUT /api/website — update website content
  app.put('/', {
    schema: { tags: ['website'], summary: 'Update website content', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const body = websiteSchema.parse(request.body);
      const content = await prisma.websiteContent.upsert({
        where: { tenantId },
        update: body,
        create: { tenantId, heroTitle: body.heroTitle, ...body },
      });
      return ok(content, 'Website updated');
    },
  });
}

// ── Public routes (no auth) ──────────────────────────────────────────────────
export async function publicWebsiteRoutes(app: FastifyInstance) {
  // GET /site/:slug — public website data
  app.get('/:slug', {
    schema: { tags: ['website'], summary: 'Get public resort website data' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        include: {
          websiteContent: true,
          amenities: { where: { isActive: true } },
          rooms: { where: { isActive: true, status: { not: 'MAINTENANCE' } }, select: { id: true, name: true, type: true, basePrice: true, maxOccupancy: true, images: true, amenities: true } },
        },
      });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });
      return ok({ tenant: { name: tenant.name, slug: tenant.slug, phone: tenant.phone, email: tenant.email, currency: tenant.currency, checkInTime: tenant.checkInTime, checkOutTime: tenant.checkOutTime }, website: tenant.websiteContent, amenities: tenant.amenities, rooms: tenant.rooms });
    },
  });
}

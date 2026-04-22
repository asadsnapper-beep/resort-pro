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
  templateId: z.string().optional(),
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
  // GET /site/:slug — full public resort data
  app.get('/:slug', {
    schema: { tags: ['website'], summary: 'Get public resort website data' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        include: {
          websiteContent: true,
          rooms: {
            where: { isActive: true, status: { not: 'MAINTENANCE' } },
            select: { id: true, name: true, type: true, number: true, floor: true, basePrice: true, maxOccupancy: true, images: true, amenities: true, description: true },
            orderBy: { basePrice: 'asc' },
          },
        },
      });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });
      return ok({
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          phone: tenant.phone,
          email: tenant.email,
          address: tenant.address,
          currency: tenant.currency,
          checkInTime: tenant.checkInTime,
          checkOutTime: tenant.checkOutTime,
          logoUrl: tenant.logoUrl,
        },
        website: tenant.websiteContent,
        rooms: tenant.rooms,
      });
    },
  });

  // POST /site/:slug/book — public booking inquiry (creates a guest + booking)
  const publicBookSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    roomId: z.string().uuid(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    specialRequests: z.string().optional(),
  });

  app.post('/:slug/book', {
    schema: { tags: ['website'], summary: 'Submit public booking inquiry' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const body = publicBookSchema.parse(request.body);
      const checkIn = new Date(body.checkIn);
      const checkOut = new Date(body.checkOut);

      if (checkOut <= checkIn) return reply.status(400).send({ success: false, error: 'Check-out must be after check-in' });

      const room = await prisma.room.findFirst({ where: { id: body.roomId, tenantId: tenant.id, isActive: true } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      // Check availability
      const conflict = await prisma.booking.findFirst({
        where: {
          tenantId: tenant.id, roomId: room.id,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gt: checkIn } }],
        },
      });
      if (conflict) return reply.status(409).send({ success: false, error: 'Room not available for selected dates' });

      // Find or create guest
      let guest = await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } });
      if (!guest) {
        guest = await prisma.guest.create({
          data: { tenantId: tenant.id, firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone },
        });
      }

      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000);
      const totalAmount = Number(room.basePrice) * nights;

      const booking = await prisma.booking.create({
        data: {
          tenantId: tenant.id,
          guestId: guest.id,
          roomId: room.id,
          checkIn,
          checkOut,
          adults: body.adults,
          children: body.children,
          totalAmount,
          specialRequests: body.specialRequests,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          confirmationNo: `WEB-${Date.now().toString(36).toUpperCase()}`,
        },
      });

      return reply.status(201).send(ok({ confirmationNo: booking.confirmationNo, totalAmount, nights }, 'Booking request submitted!'));
    },
  });

  // POST /site/:slug/feedback — public feedback / complaint (creates support ticket)
  const feedbackSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    type: z.enum(['FEEDBACK', 'COMPLAINT', 'REQUEST', 'OTHER']).default('FEEDBACK'),
    subject: z.string().min(1),
    message: z.string().min(1),
  });

  app.post('/:slug/feedback', {
    schema: { tags: ['website'], summary: 'Submit public feedback or complaint' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const body = feedbackSchema.parse(request.body);

      // Find guest by email if exists
      const guest = await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } });

      await prisma.supportTicket.create({
        data: {
          tenantId: tenant.id,
          guestId: guest?.id,
          title: body.subject,
          description: `From: ${body.name} <${body.email}>\n\n${body.message}`,
          category: body.type === 'COMPLAINT' ? 'COMPLAINT' : body.type === 'REQUEST' ? 'REQUEST' : 'OTHER',
          priority: body.type === 'COMPLAINT' ? 'HIGH' : 'MEDIUM',
          status: 'OPEN',
        },
      });

      return reply.status(201).send(ok(null, 'Thank you! Your message has been received.'));
    },
  });

  // GET /site/:slug/availability — check room availability for dates
  app.get('/:slug/availability', {
    schema: { tags: ['website'], summary: 'Check room availability' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const query = request.query as { checkIn?: string; checkOut?: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      if (!query.checkIn || !query.checkOut) {
        return reply.status(400).send({ success: false, error: 'checkIn and checkOut required' });
      }

      const checkIn = new Date(query.checkIn);
      const checkOut = new Date(query.checkOut);

      const bookedRoomIds = await prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gt: checkIn } }],
        },
        select: { roomId: true },
      });

      const bookedIds = bookedRoomIds.map((b) => b.roomId);

      const rooms = await prisma.room.findMany({
        where: { tenantId: tenant.id, isActive: true, status: { not: 'MAINTENANCE' }, id: { notIn: bookedIds } },
        select: { id: true, name: true, type: true, number: true, basePrice: true, maxOccupancy: true, images: true, amenities: true, description: true },
        orderBy: { basePrice: 'asc' },
      });

      return ok(rooms);
    },
  });
}

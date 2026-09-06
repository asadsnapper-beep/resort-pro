import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, Prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { resolveRate } from './ratePlans';
import { sendWebBookingEmails } from '../utils/guest-emails';
import { PENDING_HOLD_MINUTES } from '../utils/booking';
import { effectiveThemePrice, themeAccessFor } from '../utils/theme-access';

// Accept absolute http(s) URLs OR site-relative upload paths (/uploads/…) —
// the app's own ImageUpload produces relative paths, so strict .url() broke saves.
const imageRef = z.string().refine(
  (v) => v === '' || v.startsWith('/') || /^https?:\/\//i.test(v),
  'Must be an http(s) URL or a site-relative path',
);

const websiteSchema = z.object({
  heroTitle: z.string().optional().default('Welcome'),
  heroSubtitle: z.string().optional(),
  heroImage: imageRef.optional(),
  aboutTitle: z.string().optional(),
  aboutText: z.string().optional(),
  aboutImage: imageRef.optional(),
  galleryImages: z.array(imageRef).optional(),
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
  hiddenSections: z.array(z.string()).optional(),
  sectionOrder: z.array(z.string()).optional(),
  // Social media
  facebookUrl: z.string().url().optional().or(z.literal('')),
  instagramUrl: z.string().url().optional().or(z.literal('')),
  twitterUrl: z.string().url().optional().or(z.literal('')),
  tiktokUrl: z.string().url().optional().or(z.literal('')),
  youtubeUrl: z.string().url().optional().or(z.literal('')),
  whatsappNumber: z.string().optional(),
  tripadvisorUrl: z.string().url().optional().or(z.literal('')),
  googleAnalyticsId: z.string().regex(/^G-[A-Z0-9]+$/).optional().or(z.literal('')),
});

export async function websiteRoutes(app: FastifyInstance) {
  // GET /api/website — get website content (authenticated)
  app.get('/', {
    schema: { tags: ['website'], summary: 'Get website content', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'),
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      // Return existing content or an empty shell — never 404, so the dashboard form always loads.
      // tenantId is @unique on WebsiteContent; the tenant-scoped client does NOT
      // inject it into findUnique, so it must be passed explicitly.
      const content = await db.websiteContent.findUnique({ where: { tenantId } });
      return ok(content ?? { heroTitle: '', galleryImages: [], testimonials: [], hiddenSections: [] });
    },
  });

  // PUT /api/website — update website content
  app.put('/', {
    schema: { tags: ['website'], summary: 'Update website content', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = websiteSchema.parse(request.body);

      // templateId is a free-form string, so without this check a tenant who
      // learns another tenant's bespoke theme key — or the key of a paid theme
      // they never bought — could simply set it and use a design they have no
      // claim to. This is the one gate on that, so it covers both cases.
      if (body.templateId) {
        const theme = await prisma.theme.findUnique({
          where: { key: body.templateId },
          select: {
            key: true, exclusiveToTenantId: true,
            priceUsd: true, priceBdt: true,
            offerPriceUsd: true, offerPriceBdt: true, offerEndsAt: true,
          },
        });
        // An unknown key is left alone deliberately: the renderer already falls
        // back to the default theme for one, and rejecting here would lock out
        // any tenant sitting on a stale templateId from saving anything at all.
        if (theme) {
          const owned = await prisma.themePurchase.findUnique({
            where: { tenantId_themeKey: { tenantId, themeKey: theme.key } },
            select: { id: true },
          });
          const access = themeAccessFor(theme, tenantId, !!owned);
          if (!access.allowed) {
            return reply.status(403).send({
              success: false,
              error: access.message,
              code: access.code,
              // Sent so the dashboard can offer to buy it right there rather
              // than leaving the owner at a dead end.
              ...(access.code === 'THEME_NOT_PURCHASED'
                ? { themeKey: theme.key, priceUsd: access.price.usd, priceBdt: access.price.bdt }
                : {}),
            });
          }
        }
      }

      const content = await db.websiteContent.upsert({
        where: { tenantId },
        update: body,
        create: { tenantId, ...body },
      });
      return ok(content, 'Website updated');
    },
  });

  // GET /api/website/stats — visitor stats for dashboard widget
  app.get('/stats', {
    schema: { tags: ['website'], summary: 'Website visitor stats', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'),
    handler: async (request) => {
      const { db } = request;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29);

      const rows = await (db as any).websitePageView.findMany({
        where: {
          date: { gte: thirtyDaysAgo },
        },
        orderBy: { date: 'asc' },
      });

      const todayRow  = rows.find((r: any) => r.date.toISOString().split('T')[0] === todayStr);
      const total30d  = rows.reduce((s: number, r: any) => s + r.count, 0);
      const todayViews = todayRow?.count ?? 0;

      // Build last-30-days chart data
      const chartData: { date: string; views: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const row = rows.find((r: any) => r.date.toISOString().split('T')[0] === key);
        chartData.push({ date: d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }), views: row?.count ?? 0 });
      }

      return ok({ todayViews, total30d, chartData });
    },
  });
}

// ── Public routes (no auth) ──────────────────────────────────────────────────
export async function publicWebsiteRoutes(app: FastifyInstance) {
  // POST /site/:slug/pageview — fire-and-forget visitor counter (no auth, lightweight)
  app.post('/:slug/pageview', {
    schema: { tags: ['website'], summary: 'Track a public website page view' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      // Run in background — respond immediately so it never blocks the visitor's page load
      setImmediate(async () => {
        try {
          const tenant = await (prisma as any).tenant.findUnique({
            where: { slug, isActive: true },
            select: { id: true },
          });
          if (!tenant) return;
          const today = new Date(); today.setHours(0, 0, 0, 0);
          await (prisma as any).websitePageView.upsert({
            where: { tenantId_date: { tenantId: tenant.id, date: today } },
            update: { count: { increment: 1 } },
            create: { tenantId: tenant.id, date: today, count: 1 },
          });
        } catch { /* silent — never break visitor experience */ }
      });
      return reply.status(204).send();
    },
  });

  // GET /site/domain/:hostname — resolve custom domain → slug (used by Next.js middleware)
  app.get('/domain/:hostname', {
    schema: { tags: ['website'], summary: 'Resolve custom domain to tenant slug' },
    handler: async (request, reply) => {
      const { hostname } = request.params as { hostname: string };
      const tenant = await prisma.tenant.findFirst({
        where: { customDomain: hostname.toLowerCase(), domainVerified: true, isActive: true },
        select: { slug: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Domain not found' });
      return ok({ slug: tenant.slug });
    },
  });

  // GET /site/theme/:key — fetch theme config by key (used by preview page)
  app.get('/theme/:key', {
    schema: { tags: ['website'], summary: 'Get theme config JSON by key' },
    handler: async (request, reply) => {
      const { key } = request.params as { key: string };
      const theme = await prisma.theme.findUnique({
        where: { key },
        select: {
          key: true, name: true, themeType: true, configJson: true, themeStatus: true,
          templateHtml: true, templateCss: true, contractVersion: true,
        },
      });
      if (!theme) return reply.status(404).send({ success: false, error: 'Theme not found' });
      return reply.send({ success: true, data: theme });
    },
  });

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
            select: { id: true, name: true, type: true, number: true, floor: true, basePrice: true, maxOccupancy: true, images: true, videos: true, amenities: true, description: true },
            orderBy: { basePrice: 'asc' },
          },
        },
      });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      // Look up theme config/template if the selected template is dynamic (not hardcoded)
      const templateId = tenant.websiteContent?.templateId;
      let themeConfig = null;
      let themeType: string | null = null;
      let templateHtml: string | null = null;
      let templateCss: string | null = null;
      if (templateId) {
        const theme = await prisma.theme.findUnique({
          where: { key: templateId },
          select: { themeType: true, configJson: true, templateHtml: true, templateCss: true },
        });
        if (theme) {
          themeType = theme.themeType;
          if (theme.themeType !== 'HARDCODED' && theme.configJson) {
            themeConfig = theme.configJson;
          }
          if (theme.themeType === 'TEMPLATE') {
            templateHtml = theme.templateHtml;
            templateCss = theme.templateCss;
          }
        }
      }

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
        website:     tenant.websiteContent,
        rooms:       tenant.rooms,
        themeConfig,  // null for hardcoded themes, ThemeConfig JSON for uploaded/AI themes
        themeType,    // null | 'HARDCODED' | 'UPLOADED' | 'AI_GENERATED' | 'TEMPLATE'
        templateHtml, // Tier 2 only — Handlebars HTML, style stripped out
        templateCss,  // Tier 2 only
      });
    },
  });

  // POST /site/:slug/book — public booking inquiry (creates a guest + booking)
  const publicBookSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    roomId: z.string().min(1),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    specialRequests: z.string().optional(),
    promoCode: z.string().optional(),
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

      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000);
      const baseAmount = Number(room.basePrice) * nights;

      // Resolve promo code (read-only lookup — usage increment happens inside
      // the transaction below, right next to the booking create, so a guest
      // can't spend the last redemption of a maxUses offer twice).
      let appliedOfferCandidate: { id: string; type: string; value: number } | null = null;
      if (body.promoCode) {
        const now = new Date();
        const offer = await prisma.offer.findFirst({
          where: {
            tenantId: tenant.id,
            promoCode: body.promoCode.toUpperCase(),
            isActive: true,
            validFrom: { lte: now },
            validTo:   { gte: now },
          },
        });
        if (offer) {
          const canUse = offer.maxUses === null || offer.usedCount < offer.maxUses;
          const minOk  = nights >= offer.minStay;
          const roomOk = offer.roomIds.length === 0 || offer.roomIds.includes(body.roomId);
          if (canUse && minOk && roomOk) appliedOfferCandidate = { id: offer.id, type: offer.type, value: offer.value };
        }
      }

      let result: { booking: Awaited<ReturnType<typeof prisma.booking.create>>; discount: number };

      // ── Atomic: conflict-check + create inside a serializable transaction ──
      // Same pattern as the internal/dashboard booking routes (bookings.ts) —
      // without this, two guests hitting "Book now" for the same room/dates
      // within milliseconds of each other could both pass the availability
      // check and both get a PENDING booking created (double-booking).
      try {
        result = await prisma.$transaction(async (tx) => {
          // Check availability — PENDING bookings within last 30 min also
          // block (stale/abandoned ones are ignored). Read happens inside the
          // transaction so it's serialized against any concurrent attempt.
          const pendingCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);
          const conflict = await tx.booking.findFirst({
            where: {
              tenantId: tenant.id, roomId: room.id,
              checkIn: { lt: checkOut },
              checkOut: { gt: checkIn },
              OR: [
                { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
                { status: 'PENDING', createdAt: { gte: pendingCutoff } },
              ],
            },
          });
          if (conflict) {
            throw Object.assign(new Error('Room not available for selected dates'), { statusCode: 409 });
          }

          // Find or create guest
          let guest = await tx.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } });
          if (!guest) {
            guest = await tx.guest.create({
              data: { tenantId: tenant.id, firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone },
            });
          }

          // Re-validate the promo code's usage limit inside the transaction —
          // the read above could be stale by the time we get here.
          let appliedOffer: { id: string; discount: number } | null = null;
          if (appliedOfferCandidate) {
            const offer = await tx.offer.findFirst({ where: { id: appliedOfferCandidate.id } });
            if (offer && (offer.maxUses === null || offer.usedCount < offer.maxUses)) {
              let disc = 0;
              if (offer.type === 'PERCENTAGE') disc = baseAmount * (offer.value / 100);
              else if (offer.type === 'FIXED')  disc = Math.min(offer.value, baseAmount);
              else if (offer.type === 'FREE_NIGHT') {
                const perNight = nights > 0 ? baseAmount / nights : 0;
                disc = Math.min(perNight * offer.value, baseAmount);
              }
              appliedOffer = { id: offer.id, discount: disc };
            }
          }

          const totalAmount = appliedOffer ? baseAmount - appliedOffer.discount : baseAmount;

          const newBooking = await tx.booking.create({
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
              paymentStatus: 'PENDING',
              confirmationNo: `WEB-${Date.now().toString(36).toUpperCase()}`,
            },
          });

          if (appliedOffer) {
            await tx.bookingOffer.create({
              data: { bookingId: newBooking.id, offerId: appliedOffer.id, discount: appliedOffer.discount },
            });
            await tx.offer.update({
              where: { id: appliedOffer.id },
              data: { usedCount: { increment: 1 } },
            });
          }

          return { booking: newBooking, discount: appliedOffer?.discount ?? 0 };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string; code?: string };
        if (e.statusCode === 409) return reply.status(409).send({ success: false, error: e.message });
        // Prisma serialization failure (P2034) — another request won the race
        if (e.code === 'P2034') return reply.status(409).send({ success: false, error: 'Room was just booked by someone else — please choose different dates or a different room' });
        throw err;
      }

      const { booking, discount } = result;

      // Fire-and-forget emails — don't block the 201 response
      sendWebBookingEmails(booking.id).catch(() => {});

      return reply.status(201).send(ok({
        id: booking.id,
        confirmationNo: booking.confirmationNo,
        totalAmount: Number(booking.totalAmount),
        baseAmount,
        discount,
        nights,
      }, 'Booking request submitted!'));
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

  // ── Public Venues (see plan/public-venues-vehicles.md) ─────────────────────

  app.get('/:slug/venues', {
    schema: { tags: ['website'], summary: 'List active venues for the public site' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const venues = await prisma.venue.findMany({
        where: { tenantId: tenant.id, isActive: true, isVisible: true },
        select: {
          id: true, name: true, type: true, capacity: true, description: true, photos: true, videos: true, amenities: true,
          halfDayRate: true, fullDayRate: true, hourlyRate: true, opensAt: true, closesAt: true,
        },
        orderBy: { sortOrder: 'asc' },
      });
      return ok(venues);
    },
  });

  const venueEnquirySchema = z.object({
    venueId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(1),
    preferredDate: z.string().optional(),
    guestCount: z.number().int().positive().optional(),
    message: z.string().optional(),
  });

  app.post('/:slug/venue-enquiry', {
    schema: { tags: ['website'], summary: 'Submit a venue booking enquiry' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const body = venueEnquirySchema.parse(request.body);
      const venue = await prisma.venue.findFirst({ where: { id: body.venueId, tenantId: tenant.id } });
      if (!venue) return reply.status(404).send({ success: false, error: 'Venue not found' });

      const guest = body.email ? await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } }) : null;

      await prisma.supportTicket.create({
        data: {
          tenantId: tenant.id,
          guestId: guest?.id,
          title: `Venue Enquiry: ${venue.name}`,
          description: [
            `From: ${body.name} <${body.email || 'no email'}> · ${body.phone}`,
            body.preferredDate && `Preferred date: ${body.preferredDate}`,
            body.guestCount && `Guest count: ${body.guestCount}`,
            body.message && `\n${body.message}`,
          ].filter(Boolean).join('\n'),
          category: 'REQUEST',
          priority: 'MEDIUM',
          status: 'OPEN',
        },
      });

      return reply.status(201).send(ok(null, "Thank you! We'll get back to you shortly."));
    },
  });

  // ── Public Vehicle Rental (see plan/public-venues-vehicles.md) ─────────────

  app.get('/:slug/vehicles', {
    schema: { tags: ['website'], summary: 'List available vehicles for the public site' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const vehicles = await prisma.vehicle.findMany({
        where: { tenantId: tenant.id, availability: { not: 'MAINTENANCE' } },
        select: { id: true, type: true, name: true, capacity: true, hourlyRate: true, dailyRate: true, photos: true, videos: true },
        orderBy: { name: 'asc' },
      });
      return ok(vehicles);
    },
  });

  const vehicleEnquirySchema = z.object({
    vehicleId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(1),
    preferredDate: z.string().optional(),
    message: z.string().optional(),
  });

  app.post('/:slug/vehicle-enquiry', {
    schema: { tags: ['website'], summary: 'Submit a vehicle rental enquiry' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const body = vehicleEnquirySchema.parse(request.body);
      const vehicle = await prisma.vehicle.findFirst({ where: { id: body.vehicleId, tenantId: tenant.id } });
      if (!vehicle) return reply.status(404).send({ success: false, error: 'Vehicle not found' });

      const guest = body.email ? await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } }) : null;

      await prisma.supportTicket.create({
        data: {
          tenantId: tenant.id,
          guestId: guest?.id,
          title: `Vehicle Rental Enquiry: ${vehicle.name}`,
          description: [
            `From: ${body.name} <${body.email || 'no email'}> · ${body.phone}`,
            body.preferredDate && `Preferred date: ${body.preferredDate}`,
            body.message && `\n${body.message}`,
          ].filter(Boolean).join('\n'),
          category: 'REQUEST',
          priority: 'MEDIUM',
          status: 'OPEN',
        },
      });

      return reply.status(201).send(ok(null, "Thank you! We'll get back to you shortly."));
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

      const checkIn  = new Date(query.checkIn);
      const checkOut = new Date(query.checkOut);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        return reply.status(400).send({ success: false, error: 'Invalid date format for checkIn or checkOut' });
      }
      if (checkOut <= checkIn) {
        return reply.status(400).send({ success: false, error: 'checkOut must be after checkIn' });
      }

      const bookedRoomIds = await prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          // PENDING included — a "Pay at Hotel" booking is a real hold on the
          // room even though staff hasn't confirmed it yet (matches the
          // dashboard's own conflict logic in bookings.ts).
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gt: checkIn } }],
        },
        select: { roomId: true },
      });

      const bookedIds = bookedRoomIds.map((b) => b.roomId);

      const rooms = await prisma.room.findMany({
        where: { tenantId: tenant.id, isActive: true, status: { not: 'MAINTENANCE' }, id: { notIn: bookedIds } },
        select: { id: true, name: true, type: true, number: true, basePrice: true, maxOccupancy: true, images: true, videos: true, amenities: true, description: true },
        orderBy: { basePrice: 'asc' },
      });

      return ok(rooms);
    },
  });

  // GET /site/:slug/availability/calendar — monthly availability calendar
  app.get('/:slug/availability/calendar', {
    schema: { tags: ['website'], summary: 'Get monthly room availability calendar' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const query = request.query as { month?: string; roomType?: string };

      // Validate slug
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, isActive: true },
      });
      if (!tenant || !tenant.isActive) {
        return reply.status(404).send({ success: false, error: 'Resort not found' });
      }

      // Validate month format YYYY-MM
      if (!query.month || !/^\d{4}-\d{2}$/.test(query.month)) {
        return reply.status(400).send({ success: false, error: 'month is required in YYYY-MM format' });
      }

      const [yearStr, monthStr] = query.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10); // 1-based

      if (month < 1 || month > 12) {
        return reply.status(400).send({ success: false, error: 'Invalid month value' });
      }

      // First and last day of the month
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0); // day 0 of next month = last day of current month
      lastDay.setHours(23, 59, 59, 999);

      // Fetch active rooms (with optional roomType filter)
      const validRoomTypes = ['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;
      type RoomType = typeof validRoomTypes[number];
      const roomTypeFilter = query.roomType && (validRoomTypes as readonly string[]).includes(query.roomType)
        ? (query.roomType as RoomType)
        : undefined;

      const rooms = await prisma.room.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          status: { not: 'MAINTENANCE' },
          ...(roomTypeFilter ? { type: roomTypeFilter } : {}),
        },
        select: { id: true },
      });

      const totalRooms = rooms.length;
      const roomIds = rooms.map((r) => r.id);

      if (totalRooms === 0) {
        return ok({ month: query.month, totalRooms: 0, days: {} });
      }

      // Fetch all bookings that overlap this month
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          roomId: { in: roomIds },
          // PENDING included — see the matching comment in /:slug/availability.
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          AND: [
            { checkIn: { lt: lastDay } },
            { checkOut: { gt: firstDay } },
          ],
        },
        select: { roomId: true, checkIn: true, checkOut: true },
      });

      // Build per-day availability map
      const days: Record<string, { available: number; total: number; status: string }> = {};
      const daysInMonth = lastDay.getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStart = new Date(year, month - 1, d, 0, 0, 0, 0);
        const dayEnd = new Date(year, month - 1, d, 23, 59, 59, 999);

        // Count how many rooms are booked on this day
        const bookedRoomIds = new Set<string>();
        for (const booking of bookings) {
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          // A booking covers this day if checkIn < dayEnd AND checkOut > dayStart
          if (checkIn < dayEnd && checkOut > dayStart) {
            bookedRoomIds.add(booking.roomId);
          }
        }

        const booked = bookedRoomIds.size;
        const available = totalRooms - booked;

        let status: string;
        if (available === 0) {
          status = 'full';
        } else if (available === totalRooms) {
          status = 'available';
        } else {
          status = 'partial';
        }

        // Format date as YYYY-MM-DD
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days[dateKey] = { available, total: totalRooms, status };
      }

      return ok({ month: query.month, totalRooms, days });
    },
  });

  // GET /site/:slug/themes — list active themes (for owner dashboard picker)
  app.get('/:slug/themes', {
    schema: { tags: ['website'], summary: 'Get available themes list' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const themes = await prisma.theme.findMany({
        where: {
          isActive: true,
          // Bespoke themes belong to the tenant that paid for them. Everyone
          // sees the shared catalogue (exclusiveToTenantId = null) plus their
          // own commissioned theme — never someone else's.
          OR: [
            { exclusiveToTenantId: null },
            { exclusiveToTenantId: tenant.id },
          ],
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          key: true, name: true, description: true, previewImage: true,
          // tags is what the picker's search box matches against — it was
          // never selected here, so searching threw on `undefined.some(...)`.
          isPremium: true, tags: true, exclusiveToTenantId: true,
          priceUsd: true, priceBdt: true,
          offerPriceUsd: true, offerPriceBdt: true, offerEndsAt: true,
        },
      });

      // The picker has to show a lock and a price on themes this resort has not
      // bought, otherwise the owner picks one, saves, and only then discovers
      // it is refused. One query for the whole list rather than one per theme.
      const purchases = await prisma.themePurchase.findMany({
        where: { tenantId: tenant.id },
        select: { themeKey: true },
      });
      const ownedKeys = new Set(purchases.map(p => p.themeKey));

      const data = themes.map(t => {
        const price = effectiveThemePrice(t);
        const owned = ownedKeys.has(t.key);
        return {
          key: t.key,
          name: t.name,
          description: t.description,
          previewImage: t.previewImage,
          isPremium: t.isPremium,
          tags: t.tags,
          exclusiveToTenantId: t.exclusiveToTenantId,
          priceUsd: price.usd,
          priceBdt: price.bdt,
          listPriceUsd: price.listUsd,
          listPriceBdt: price.listBdt,
          onOffer: price.onOffer,
          isFree: price.isFree,
          /** Already bought, commissioned bespoke, or free — usable right now. */
          owned: themeAccessFor(t, tenant.id, owned).allowed,
        };
      });

      return ok(data);
    },
  });

  // GET /site/:slug/menu — public menu (available items only)
  app.get('/:slug/menu', {
    schema: { tags: ['website'], summary: 'Get public menu for resort' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const items = await prisma.menuItem.findMany({
        where: { tenantId: tenant.id, isAvailable: true },
        select: { id: true, name: true, description: true, category: true, price: true, image: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });

      return ok(items);
    },
  });

  // POST /site/:slug/order — place a food order from the website
  const publicOrderSchema = z.object({
    guestName: z.string().min(1),
    roomNumber: z.string().optional(),
    bookingRef: z.string().optional(),
    email: z.string().email().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
    })).min(1),
  });

  app.post('/:slug/order', {
    schema: { tags: ['website'], summary: 'Place a food order from the public website' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant || !tenant.isActive) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const body = publicOrderSchema.parse(request.body);

      // Find menu items and validate
      const menuItems = await prisma.menuItem.findMany({
        where: {
          tenantId: tenant.id,
          id: { in: body.items.map(i => i.menuItemId) },
          isAvailable: true,
        },
      });

      if (menuItems.length !== body.items.length) {
        return reply.status(400).send({ success: false, error: 'One or more items are unavailable' });
      }

      const totalAmount = body.items.reduce((sum, item) => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId)!;
        return sum + Number(menuItem.price) * item.quantity;
      }, 0);

      // Find guest by email if provided
      let guestId: string | undefined;
      if (body.email) {
        const guest = await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } });
        if (guest) guestId = guest.id;
      }

      // Find booking by confirmation number if provided
      let bookingId: string | undefined;
      if (body.bookingRef) {
        const booking = await prisma.booking.findFirst({
          where: { tenantId: tenant.id, confirmationNo: body.bookingRef, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        });
        if (booking) { bookingId = booking.id; if (!guestId) guestId = booking.guestId; }
      }

      const order = await prisma.foodOrder.create({
        data: {
          tenantId: tenant.id,
          guestId,
          bookingId,
          // An order tied to a stay rides that stay's invoice at checkout, so it
          // has to say so. Left at the PAY_NOW default it would read as a
          // counter sale the front desk still has to collect — and bill() would
          // put it on the room anyway, which is how a guest gets charged twice.
          settlement: bookingId ? 'CHARGE_TO_ROOM' : 'PAY_NOW',
          tableNumber: body.roomNumber ? `Room ${body.roomNumber}` : undefined,
          notes: body.notes ? `From: ${body.guestName}${body.email ? ` <${body.email}>` : ''}. ${body.notes}` : `From: ${body.guestName}${body.email ? ` <${body.email}>` : ''}`,
          totalAmount,
          status: 'PENDING',
          items: {
            create: body.items.map(item => {
              const menuItem = menuItems.find(m => m.id === item.menuItemId)!;
              return {
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                unitPrice: menuItem.price,
                notes: item.notes,
              };
            }),
          },
        },
      });

      return reply.status(201).send(ok({
        orderId: order.id,
        totalAmount,
        itemCount: body.items.length,
      }, 'Order placed! Our team will deliver to your room shortly.'));
    },
  });

  // GET /site/:slug/rate?roomId=&checkIn=&checkOut=  — public rate lookup
  app.get('/:slug/rate', {
    schema: { tags: ['website'], summary: 'Get effective rate for room + dates' },
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { roomId, checkIn, checkOut } = request.query as { roomId: string; checkIn: string; checkOut: string };

      const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, currency: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Resort not found' });

      const room = await prisma.room.findFirst({ where: { id: roomId, tenantId: tenant.id }, select: { id: true, basePrice: true, name: true } });
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' });

      const resolved = await resolveRate(tenant.id, roomId, new Date(checkIn), new Date(checkOut), Number(room.basePrice));

      return reply.send({
        success: true,
        data: {
          roomId,
          roomName: room.name,
          basePrice: Number(room.basePrice),
          currency: tenant.currency,
          resolved,
          effectivePrice: resolved ? resolved.price : Number(room.basePrice),
        },
      });
    },
  });
}

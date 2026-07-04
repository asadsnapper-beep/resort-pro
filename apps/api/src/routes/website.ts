import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { resolveRate } from './ratePlans';
import { sendWebBookingEmails } from '../utils/guest-emails';

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
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = websiteSchema.parse(request.body);
      const content = await db.websiteContent.upsert({
        where: { tenantId },
        update: body,
        create: { tenantId, heroTitle: body.heroTitle, ...body },
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
        select: { key: true, name: true, themeType: true, configJson: true, themeStatus: true },
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

      // Look up theme config if the selected template is a config-driven theme
      const templateId = tenant.websiteContent?.templateId;
      let themeConfig = null;
      if (templateId) {
        const theme = await prisma.theme.findUnique({
          where: { key: templateId },
          select: { themeType: true, configJson: true },
        });
        if (theme && theme.themeType !== 'HARDCODED' && theme.configJson) {
          themeConfig = theme.configJson;
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

      // Check availability — PENDING bookings within last 30 min also block (stale ones are ignored)
      const pendingCutoff = new Date(Date.now() - 30 * 60 * 1000);
      const conflict = await prisma.booking.findFirst({
        where: {
          tenantId: tenant.id, roomId: room.id,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          AND: [
            { checkIn: { lt: checkOut } },
            { checkOut: { gt: checkIn } },
            // Ignore stale PENDING bookings older than 30 minutes
            {
              OR: [
                { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
                { status: 'PENDING', createdAt: { gte: pendingCutoff } },
              ],
            },
          ],
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
      const baseAmount = Number(room.basePrice) * nights;

      // Resolve promo code
      let appliedOffer: { id: string; discount: number } | null = null;
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
          if (canUse && minOk && roomOk) {
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
      }

      const totalAmount = appliedOffer ? baseAmount - appliedOffer.discount : baseAmount;

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
          paymentStatus: 'PENDING',
          confirmationNo: `WEB-${Date.now().toString(36).toUpperCase()}`,
        },
      });

      // Record offer usage
      if (appliedOffer) {
        await prisma.bookingOffer.create({
          data: { bookingId: booking.id, offerId: appliedOffer.id, discount: appliedOffer.discount },
        });
        await prisma.offer.update({
          where: { id: appliedOffer.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // Fire-and-forget emails — don't block the 201 response
      sendWebBookingEmails(booking.id).catch(() => {});

      return reply.status(201).send(ok({
        id: booking.id,
        confirmationNo: booking.confirmationNo,
        totalAmount,
        baseAmount,
        discount: appliedOffer?.discount ?? 0,
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
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
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
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
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
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { key: true, name: true, description: true, previewImage: true, isPremium: true },
      });

      return ok(themes);
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

      const resolved = await resolveRate(tenant.id, roomId, new Date(checkIn), new Date(checkOut));

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

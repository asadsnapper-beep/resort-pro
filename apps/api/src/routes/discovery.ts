/**
 * discovery.ts
 * Public API for stay.resortpro.site — resort discovery map & list
 *
 * Routes (public):
 *   GET  /discovery/resorts             → paginated list with revenue fields
 *   GET  /discovery/resorts/:slug       → single resort detail
 *   GET  /discovery/countries           → countries with visible resorts
 *   POST /discovery/click               → track a click event
 *
 * Routes (authenticated):
 *   GET   /discovery/admin/settings     → get own map + revenue settings
 *   PATCH /discovery/admin/settings     → update map + revenue settings
 *   GET   /discovery/admin/analytics    → click stats for own resort
 */

import { FastifyInstance } from 'fastify';
import { prisma }          from '@resort-pro/database';
import { requireAuth }     from '../middleware/auth';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ResortListQuery {
  country?:  string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  page?:     string;
  limit?:    string;
  q?:        string;
  featured?: string; // "true" → featured only
}

// ─── Select shape reused across routes ─────────────────────────────────────────

const PUBLIC_SELECT = {
  slug:                 true,
  name:                 true,
  country:              true,
  resortCategory:       true,
  shortDescription:     true,
  coverImageUrl:        true,
  logoUrl:              true,
  priceFrom:            true,
  latitude:             true,
  longitude:            true,
  website:              true,
  address:              true,
  // Revenue fields
  isFeatured:           true,
  featuredBadge:        true,
  featuredUntil:        true,
  affiliateUrl:         true,
  affiliateSource:      true,
  discoveryTier:        true,
  galleryImages:        true,
  amenitiesHighlights:  true,
  bookingPhone:         true,
  instagramHandle:      true,
};

// ─── Helper: shape a tenant row → public resort card ───────────────────────────

function toResortCard(t: any) {
  const nowMs  = Date.now();
  const active = t.isFeatured && (!t.featuredUntil || new Date(t.featuredUntil).getTime() > nowMs);

  return {
    slug:                 t.slug,
    name:                 t.name,
    country:              t.country,
    category:             t.resortCategory ?? 'resort',
    shortDescription:     t.shortDescription ?? '',
    coverImageUrl:        t.coverImageUrl ?? t.logoUrl ?? null,
    priceFrom:            t.priceFrom ?? null,
    latitude:             t.latitude ?? null,
    longitude:            t.longitude ?? null,
    website:              t.website ?? null,
    address:              t.address ?? null,
    // Revenue
    isFeatured:           active,
    featuredBadge:        active ? (t.featuredBadge ?? 'Featured') : null,
    affiliateUrl:         t.affiliateUrl ?? null,
    affiliateSource:      t.affiliateSource ?? null,
    tier:                 t.discoveryTier ?? 'free',
    // Premium profile fields
    galleryImages:        t.discoveryTier !== 'free' ? (t.galleryImages ?? []) : [],
    amenitiesHighlights:  t.discoveryTier !== 'free' ? (t.amenitiesHighlights ?? []) : [],
    bookingPhone:         t.discoveryTier !== 'free' ? (t.bookingPhone ?? null) : null,
    instagramHandle:      t.discoveryTier !== 'free' ? (t.instagramHandle ?? null) : null,
    // internal
    url: `/${t.slug}`,
  };
}

// ─── Register ──────────────────────────────────────────────────────────────────

export async function discoveryRoutes(fastify: FastifyInstance) {

  // ── GET /discovery/resorts ──────────────────────────────────────────────────
  fastify.get<{ Querystring: ResortListQuery }>('/discovery/resorts', async (req, reply) => {
    const {
      country, category, minPrice, maxPrice, q, featured,
      page  = '1',
      limit = '50',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const where: any = { mapVisible: true, isActive: true, deletedAt: null };
    if (country)             where.country        = country.toUpperCase();
    if (category)            where.resortCategory = category;
    if (featured === 'true') where.isFeatured     = true;
    if (minPrice) where.priceFrom = { ...where.priceFrom, gte: parseFloat(minPrice) };
    if (maxPrice) where.priceFrom = { ...where.priceFrom, lte: parseFloat(maxPrice) };
    if (q) {
      where.OR = [
        { name:             { contains: q, mode: 'insensitive' } },
        { shortDescription: { contains: q, mode: 'insensitive' } },
        { address:          { contains: q, mode: 'insensitive' } },
      ];
    }

    const [resorts, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take:    limitNum,
        // Featured first, then by name
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
        select:  PUBLIC_SELECT,
      }),
      prisma.tenant.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: {
        resorts:    resorts.map(toResortCard),
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      },
    });
  });

  // ── GET /discovery/resorts/:slug ────────────────────────────────────────────
  fastify.get<{ Params: { slug: string } }>('/discovery/resorts/:slug', async (req, reply) => {
    const { slug } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where:  { slug, mapVisible: true, isActive: true, deletedAt: null },
      select: {
        ...PUBLIC_SELECT,
        phone: true, email: true,
        _count: { select: { rooms: true } },
      },
    });

    if (!tenant) return reply.status(404).send({ success: false, error: 'Resort not found' });

    return reply.send({
      success: true,
      data: {
        ...toResortCard(tenant),
        phone:     tenant.phone,
        email:     tenant.email,
        roomCount: tenant._count.rooms,
      },
    });
  });

  // ── GET /discovery/countries ────────────────────────────────────────────────
  fastify.get('/discovery/countries', async (_req, reply) => {
    const rows = await prisma.tenant.groupBy({
      by:    ['country'],
      where: { mapVisible: true, isActive: true, deletedAt: null },
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
    });

    const NAMES: Record<string, string> = {
      BD: 'Bangladesh', IN: 'India', LK: 'Sri Lanka',
      NP: 'Nepal',      TH: 'Thailand', ID: 'Indonesia',
      MY: 'Malaysia',   KE: 'Kenya',    PH: 'Philippines',
    };

    return reply.send({
      success: true,
      data: rows.map((r: any) => ({
        code: r.country, name: NAMES[r.country] ?? r.country, count: r._count.country,
      })),
    });
  });

  // ── POST /discovery/click ───────────────────────────────────────────────────
  // Track click events: map_pin, list_card, affiliate, whatsapp, profile_view
  fastify.post<{ Body: { slug: string; type: string; source?: string } }>(
    '/discovery/click',
    async (req, reply) => {
      const { slug, type, source } = req.body ?? {};
      if (!slug || !type) return reply.status(400).send({ error: 'slug and type required' });

      const tenant = await prisma.tenant.findFirst({
        where:  { slug, mapVisible: true },
        select: { id: true },
      });
      if (!tenant) return reply.status(404).send({ error: 'Resort not found' });

      const country   = req.headers['cf-ipcountry'] as string | undefined
                      ?? req.headers['x-country']   as string | undefined;
      const userAgent = req.headers['user-agent'] as string | undefined;
      const referrer  = req.headers['referer']    as string | undefined;

      await prisma.discoveryClick.create({
        data: {
          tenantId: tenant.id,
          type,
          source:   source ?? null,
          country:  country ?? null,
          userAgent: userAgent?.slice(0, 200) ?? null,
          referrer:  referrer?.slice(0, 500)  ?? null,
        },
      });

      // For affiliate clicks, return the redirect URL
      if (type === 'affiliate') {
        const full = await prisma.tenant.findUnique({
          where:  { id: tenant.id },
          select: { affiliateUrl: true, website: true },
        });
        const redirect = full?.affiliateUrl ?? full?.website ?? null;
        return reply.send({ success: true, redirect });
      }

      return reply.send({ success: true });
    }
  );

  // ── GET /discovery/admin/settings ──────────────────────────────────────────
  fastify.get('/discovery/admin/settings', {
    preHandler: [requireAuth],
  }, async (req: any, reply) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: {
        mapVisible: true, latitude: true, longitude: true,
        resortCategory: true, priceFrom: true,
        shortDescription: true, coverImageUrl: true,
        isFeatured: true, featuredUntil: true, featuredBadge: true,
        affiliateUrl: true, affiliateSource: true, discoveryTier: true,
        galleryImages: true, amenitiesHighlights: true,
        bookingPhone: true, instagramHandle: true,
      },
    });

    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
    return reply.send({ success: true, data: tenant });
  });

  // ── PATCH /discovery/admin/settings ────────────────────────────────────────
  fastify.patch('/discovery/admin/settings', {
    preHandler: [requireAuth],
  }, async (req: any, reply) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const {
      mapVisible, latitude, longitude, resortCategory, priceFrom,
      shortDescription, coverImageUrl,
      affiliateUrl, affiliateSource,
      galleryImages, amenitiesHighlights, bookingPhone, instagramHandle,
    } = req.body as any;

    const data: any = {};
    if (mapVisible        !== undefined) data.mapVisible        = mapVisible;
    if (latitude          !== undefined) data.latitude          = latitude;
    if (longitude         !== undefined) data.longitude         = longitude;
    if (resortCategory    !== undefined) data.resortCategory    = resortCategory;
    if (priceFrom         !== undefined) data.priceFrom         = priceFrom;
    if (shortDescription  !== undefined) data.shortDescription  = shortDescription;
    if (coverImageUrl     !== undefined) data.coverImageUrl     = coverImageUrl;
    if (affiliateUrl      !== undefined) data.affiliateUrl      = affiliateUrl;
    if (affiliateSource   !== undefined) data.affiliateSource   = affiliateSource;
    if (galleryImages     !== undefined) data.galleryImages     = galleryImages;
    if (amenitiesHighlights !== undefined) data.amenitiesHighlights = amenitiesHighlights;
    if (bookingPhone      !== undefined) data.bookingPhone      = bookingPhone;
    if (instagramHandle   !== undefined) data.instagramHandle   = instagramHandle;

    const updated = await prisma.tenant.update({ where: { id: tenantId }, data });
    return reply.send({ success: true, data: updated });
  });

  // ── GET /discovery/admin/analytics ─────────────────────────────────────────
  // Click analytics for the authenticated resort owner
  fastify.get('/discovery/admin/analytics', {
    preHandler: [requireAuth],
  }, async (req: any, reply) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, byType, byDay, recent] = await Promise.all([
      // Total clicks last 30 days
      prisma.discoveryClick.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),

      // Breakdown by type
      prisma.discoveryClick.groupBy({
        by:    ['type'],
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
        _count: { type: true },
      }),

      // Daily clicks (last 7 days)
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*) as clicks
        FROM discovery_clicks
        WHERE "tenantId" = ${tenantId}
          AND "createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
      `,

      // Most recent 5 clicks
      prisma.discoveryClick.findMany({
        where:   { tenantId },
        orderBy: { createdAt: 'desc' },
        take:    5,
        select:  { type: true, source: true, country: true, createdAt: true },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        total,
        byType:  byType.map((r: any) => ({ type: r.type, count: r._count.type })),
        byDay,
        recent,
      },
    });
  });
}

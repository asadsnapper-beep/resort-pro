import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { sendEmail, wrapEmail, renderTemplate, SEQUENCE_TEMPLATES } from '../services/email';

// ─── Default email templates (auto-created for every new tenant) ──────────────
const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: 'Booking Confirmation',
    subject: 'Your booking is confirmed! ✅',
    preheader: "We can't wait to welcome you.",
    isDefault: true,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">{{tenantName}}</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">Your reservation is confirmed</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>Great news — your reservation at <strong>{{tenantName}}</strong> is confirmed!</p>
    <div style="background:#f0faf8;border-left:4px solid #1a6b5e;padding:16px;margin:24px 0;border-radius:4px">
      <p style="margin:4px 0"><strong>Booking Reference:</strong> {{confirmationNo}}</p>
      <p style="margin:4px 0"><strong>Room:</strong> {{roomName}}</p>
      <p style="margin:4px 0"><strong>Check-in:</strong> {{checkInDate}} at {{checkInTime}}</p>
      <p style="margin:4px 0"><strong>Check-out:</strong> {{checkOutDate}} at {{checkOutTime}}</p>
      <p style="margin:4px 0"><strong>Guests:</strong> {{adults}} adults{{children}}</p>
      <p style="margin:4px 0"><strong>Total:</strong> {{totalAmount}}</p>
    </div>
    <p>If you need to make any changes or have questions before your arrival, please contact us — we're happy to help.</p>
    <p style="color:#6b7280;font-size:14px;margin-top:32px">Warm regards,<br><strong>{{tenantName}} Team</strong><br>{{tenantPhone}} | {{tenantEmail}}</p>
  </div>
</div>`,
  },
  {
    name: 'Pre-Arrival Welcome',
    subject: "Your stay is coming up soon, {{guestName}}! ✨",
    preheader: 'Everything you need to know before you arrive.',
    isDefault: true,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">{{tenantName}}</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">We're getting ready for your arrival!</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>Your check-in is just a few days away and we're so excited to welcome you to <strong>{{tenantName}}</strong>!</p>
    <h3 style="color:#1a6b5e">📅 Your Booking</h3>
    <p><strong>Check-in:</strong> {{checkInDate}} from {{checkInTime}}<br>
    <strong>Check-out:</strong> {{checkOutDate}} by {{checkOutTime}}</p>
    <h3 style="color:#1a6b5e">🏨 On Arrival</h3>
    <ul>
      <li>Please bring a valid photo ID for check-in</li>
      <li>Early check-in is subject to availability — please contact us in advance</li>
      <li>Free parking is available on-site</li>
    </ul>
    <h3 style="color:#1a6b5e">📍 Getting Here</h3>
    <p>{{tenantAddress}}</p>
    <p style="color:#6b7280;font-size:14px;margin-top:32px">Looking forward to seeing you!<br><strong>{{tenantName}} Team</strong></p>
  </div>
</div>`,
  },
  {
    name: 'Post-Stay Thank You',
    subject: 'Thank you for staying with us, {{guestName}} 🙏',
    preheader: 'We hope you had a wonderful experience.',
    isDefault: true,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">Thank You!</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">We hope you had a wonderful stay</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>It was our absolute pleasure hosting you at <strong>{{tenantName}}</strong>. We hope every moment of your stay was exactly what you needed.</p>
    <h3 style="color:#1a6b5e">📝 Share Your Experience</h3>
    <p>Your feedback helps us improve and helps other travellers make great decisions. Would you take a moment to leave us a review?</p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{reviewUrl}}" style="background:#1a6b5e;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600">Leave a Review</a>
    </div>
    <h3 style="color:#1a6b5e">🎁 Come Back Soon</h3>
    <p>As a valued guest, enjoy a special discount on your next stay. Just mention this email when booking directly.</p>
    <p style="color:#6b7280;font-size:14px;margin-top:32px">With warm regards,<br><strong>{{tenantName}} Team</strong><br>{{tenantPhone}} | {{tenantEmail}}</p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px"><a href="{{unsubscribeUrl}}" style="color:#9ca3af">Unsubscribe</a></p>
  </div>
</div>`,
  },
  {
    name: 'Win-Back Offer',
    subject: "We miss you, {{guestName}}! Here's a special offer 🌟",
    preheader: "It's been a while — come back with an exclusive discount.",
    isDefault: false,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#1a6b5e,#2d9e8f);padding:40px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:28px;margin:0">We Miss You! 🌊</h1>
    <p style="color:#ffffff;margin:12px 0 0;font-size:16px">It's been a while since your last visit</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>It's been over 3 months since your last stay with us — we genuinely miss having you here at <strong>{{tenantName}}</strong>!</p>
    <div style="background:#f0faf8;border:2px solid #1a6b5e;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <p style="font-size:14px;color:#6b7280;margin:0">Exclusive offer for you</p>
      <p style="font-size:40px;font-weight:700;color:#1a6b5e;margin:8px 0">20% OFF</p>
      <p style="font-size:14px;color:#374151;margin:0">on any room for any 2+ night stay</p>
      <p style="background:#1a6b5e;color:#fff;display:inline-block;padding:8px 20px;border-radius:6px;font-weight:600;margin-top:12px;letter-spacing:2px">COMEBACK20</p>
    </div>
    <p style="color:#6b7280;font-size:13px;text-align:center">Valid for 14 days. Direct bookings only.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{bookingUrl}}" style="background:#1a6b5e;color:#fff;padding:16px 36px;text-decoration:none;border-radius:8px;font-weight:600">Book My Return →</a>
    </div>
    <p style="color:#6b7280;font-size:14px">Can't wait to see you again,<br><strong>{{tenantName}} Team</strong></p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px"><a href="{{unsubscribeUrl}}" style="color:#9ca3af">Unsubscribe</a></p>
  </div>
</div>`,
  },
  {
    name: 'Birthday Greeting',
    subject: '🎂 Happy Birthday {{guestName}}! A special gift from us',
    preheader: 'Your birthday deserves something special.',
    isDefault: false,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:40px 24px;text-align:center">
    <h1 style="color:#ffffff;font-size:32px;margin:0">🎂 Happy Birthday!</h1>
    <p style="color:#fce7f3;margin:12px 0 0">Wishing you a day as wonderful as you are</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff;text-align:center">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>The entire team at <strong>{{tenantName}}</strong> wishes you a very Happy Birthday! 🎉 As a special thank-you for being a valued guest, here is a birthday gift from us:</p>
    <div style="background:#fdf4ff;border:2px solid #7c3aed;border-radius:12px;padding:24px;margin:24px 0">
      <p style="font-size:20px;font-weight:700;color:#7c3aed;margin:0">Your Birthday Gift 🎁</p>
      <p style="font-size:36px;font-weight:700;color:#ec4899;margin:8px 0">20% OFF</p>
      <p style="color:#374151">on any stay booked within the next 30 days</p>
      <p style="background:#7c3aed;color:#fff;display:inline-block;padding:8px 20px;border-radius:6px;font-weight:600;letter-spacing:2px">BDAY20</p>
    </div>
    <p>Stay with us on your birthday and we'll make it unforgettable!</p>
    <div style="margin:24px 0">
      <a href="{{bookingUrl}}" style="background:#7c3aed;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600">Claim Your Birthday Gift</a>
    </div>
    <p style="color:#6b7280;font-size:14px">With birthday wishes,<br><strong>{{tenantName}} Team</strong></p>
    <p style="color:#9ca3af;font-size:11px;margin-top:24px"><a href="{{unsubscribeUrl}}" style="color:#9ca3af">Unsubscribe</a></p>
  </div>
</div>`,
  },
  {
    name: 'General Newsletter',
    subject: 'News & offers from {{tenantName}} 🌴',
    preheader: "See what's new and coming up at the resort.",
    isDefault: false,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:24px;text-align:center">
    <h1 style="color:#d4a853;font-size:22px;margin:0">{{tenantName}} — Newsletter</h1>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>Here's the latest news and special offers from <strong>{{tenantName}}</strong>!</p>
    <h3 style="color:#1a6b5e">🆕 What's New</h3>
    <p>[Add your latest news and updates here]</p>
    <h3 style="color:#1a6b5e">🎉 Upcoming Events</h3>
    <p>[Add upcoming events, festivals, or activities here]</p>
    <h3 style="color:#1a6b5e">💰 Special Offers</h3>
    <p>[Add your current promotions and packages here]</p>
    <div style="text-align:center;margin:32px 0">
      <a href="{{bookingUrl}}" style="background:#1a6b5e;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600">Book Your Stay</a>
    </div>
    <p style="color:#6b7280;font-size:14px">Warm regards,<br><strong>{{tenantName}} Team</strong></p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px"><a href="{{unsubscribeUrl}}" style="color:#9ca3af">Unsubscribe</a></p>
  </div>
</div>`,
  },
  {
    name: 'Promotional Offer',
    subject: 'Special offer just for you — limited time! 🎯',
    preheader: 'Exclusive deal inside — book before it expires.',
    isDefault: false,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#d4a853,#f59e0b);padding:40px 24px;text-align:center">
    <h1 style="color:#ffffff;font-size:28px;margin:0">Special Offer 🎯</h1>
    <p style="color:#fef3c7;margin:12px 0 0">Exclusive deal for our valued guests</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>We have an exclusive offer just for you at <strong>{{tenantName}}</strong>:</p>
    <div style="background:#fffbeb;border:2px solid #d4a853;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <p style="font-size:20px;font-weight:700;color:#92400e;margin:0">[Offer Title]</p>
      <p style="font-size:36px;font-weight:700;color:#d4a853;margin:8px 0">[Discount]%</p>
      <p style="color:#374151;font-size:14px">[Offer description — what's included, conditions]</p>
      <p style="background:#d4a853;color:#fff;display:inline-block;padding:8px 20px;border-radius:6px;font-weight:600;margin-top:12px;letter-spacing:2px">[CODE]</p>
    </div>
    <p style="color:#6b7280;font-size:13px;text-align:center">Offer valid until [date]. Direct bookings only.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{bookingUrl}}" style="background:#d4a853;color:#fff;padding:16px 36px;text-decoration:none;border-radius:8px;font-weight:600">Book Now →</a>
    </div>
    <p style="color:#6b7280;font-size:14px">Warm regards,<br><strong>{{tenantName}} Team</strong></p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px"><a href="{{unsubscribeUrl}}" style="color:#9ca3af">Unsubscribe</a></p>
  </div>
</div>`,
  },
  {
    name: 'Check-in Instructions',
    subject: 'Your check-in details for {{tenantName}} 🏨',
    preheader: 'Everything you need for a smooth arrival.',
    isDefault: false,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">Check-in Instructions</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">{{tenantName}}</p>
  </div>
  <div style="padding:32px 24px;background:#ffffff">
    <p>Dear <strong>{{guestName}}</strong>,</p>
    <p>We're looking forward to welcoming you! Here are your check-in details:</p>
    <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0">
      <p style="margin:6px 0">🕐 <strong>Check-in:</strong> {{checkInDate}} from {{checkInTime}}</p>
      <p style="margin:6px 0">🕙 <strong>Check-out:</strong> {{checkOutDate}} by {{checkOutTime}}</p>
      <p style="margin:6px 0">📍 <strong>Address:</strong> {{tenantAddress}}</p>
      <p style="margin:6px 0">📞 <strong>Contact:</strong> {{tenantPhone}}</p>
    </div>
    <h3 style="color:#1a6b5e">📋 What to Bring</h3>
    <ul>
      <li>Valid government-issued photo ID</li>
      <li>Your booking confirmation (this email)</li>
      <li>Payment card used for booking</li>
    </ul>
    <h3 style="color:#1a6b5e">🚗 Parking</h3>
    <p>Free parking is available on-site. Please inform us of your vehicle details upon arrival.</p>
    <p style="color:#6b7280;font-size:14px;margin-top:32px">See you soon!<br><strong>{{tenantName}} Team</strong></p>
  </div>
</div>`,
  },
];

// ─── Helper: recalculate guest score ─────────────────────────────────────────
async function recalcScore(tenantId: string, guestId: string) {
  const bookings = await prisma.booking.findMany({
    where: { tenantId, guestId, status: { in: ['CHECKED_OUT', 'CONFIRMED', 'CHECKED_IN'] } },
    select: { totalAmount: true, checkOut: true },
    orderBy: { checkOut: 'desc' },
  });

  const existing = await prisma.guestScore.findUnique({ where: { guestId } });

  const totalStays  = bookings.length;
  const totalSpend  = bookings.reduce((s, b) => s + Number(b.totalAmount), 0);
  const lastStayAt  = bookings[0]?.checkOut ?? null;
  const emailOpens  = existing?.emailOpens  ?? 0;
  const emailClicks = existing?.emailClicks ?? 0;

  // Score formula
  const stayPts    = Math.min(totalStays * 10, 30);
  const spendPts   = Math.min(Math.floor(totalSpend / 100), 30);
  const emailPts   = Math.min(emailOpens * 2 + emailClicks * 5, 20);
  const recencyPts = lastStayAt
    ? Math.max(0, 20 - Math.floor((Date.now() - lastStayAt.getTime()) / 86400000 / 30))
    : 0;
  const score = stayPts + spendPts + emailPts + recencyPts;

  const tier = score >= 80 ? 'PLATINUM' : score >= 50 ? 'GOLD' : score >= 25 ? 'SILVER' : 'STANDARD';

  await prisma.guestScore.upsert({
    where:  { guestId },
    create: { tenantId, guestId, score, tier, totalStays, totalSpend, lastStayAt, emailOpens, emailClicks },
    update: { score, tier, totalStays, totalSpend, lastStayAt },
  });
}

// ─── Routes ──────────────────────────────────────────────────────────────────
export async function crmRoutes(app: FastifyInstance) {
  const pre = requireRole('OWNER', 'MANAGER', 'MARKETER');

  /* ── CONTACTS ─────────────────────────────────────────────────────────────── */

  // GET /api/crm/contacts — enriched guest list with score, tier, tags
  app.get('/contacts', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const q = request.query as { search?: string; tier?: string; tag?: string; page?: string; limit?: string };
    const page  = Math.max(1, parseInt(q.page  ?? '1'));
    const limit = Math.min(100, parseInt(q.limit ?? '20'));

    const guests = await prisma.guest.findMany({
      where: {
        tenantId,
        ...(q.search ? { OR: [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName:  { contains: q.search, mode: 'insensitive' } },
          { email:     { contains: q.search, mode: 'insensitive' } },
        ]} : {}),
        ...(q.tier ? { score: { tier: q.tier as any } } : {}),
        ...(q.tag  ? { tags: { some: { tag: { name: q.tag } } } } : {}),
      },
      include: {
        score:    true,
        consent:  true,
        tags:     { include: { tag: true } },
        _count:   { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    const total = await prisma.guest.count({ where: { tenantId } });
    return ok({ guests, total, page, pages: Math.ceil(total / limit) });
  });

  // GET /api/crm/contacts/:id — single enriched guest
  app.get('/contacts/:id', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const guest = await prisma.guest.findFirst({
      where: { id, tenantId },
      include: {
        score:      true,
        consent:    true,
        tags:       { include: { tag: true } },
        bookings:   { orderBy: { checkIn: 'desc' }, take: 10, include: { room: { select: { name: true } } } },
        emailSends: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, subject: true, status: true, openedAt: true, createdAt: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 30 },
        enrollments:{ include: { sequence: { select: { name: true, trigger: true } } } },
      },
    });

    if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
    return ok(guest);
  });

  // POST /api/crm/contacts/:id/recalc-score
  app.post('/contacts/:id/recalc-score', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const guest = await prisma.guest.findFirst({ where: { id, tenantId } });
    if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });
    await recalcScore(tenantId, id);
    const score = await prisma.guestScore.findUnique({ where: { guestId: id } });
    return ok(score, 'Score recalculated');
  });

  /* ── TAGS ─────────────────────────────────────────────────────────────────── */

  app.get('/tags', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const tags = await prisma.guestTag.findMany({ where: { tenantId }, include: { _count: { select: { relations: true } } } });
    return ok(tags);
  });

  app.post('/tags', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const body = z.object({ name: z.string().min(1), color: z.string().optional() }).parse(request.body);
    const tag  = await prisma.guestTag.create({ data: { tenantId, name: body.name, color: body.color ?? '#6b7280' } });
    return ok(tag, 'Tag created');
  });

  app.delete('/tags/:id', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    await prisma.guestTag.deleteMany({ where: { id, tenantId } });
    return ok(null, 'Tag deleted');
  });

  // Assign / remove tags from a guest
  app.post('/contacts/:id/tags', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = z.object({ tagId: z.string().uuid(), action: z.enum(['add', 'remove']) }).parse(request.body);

    const guest = await prisma.guest.findFirst({ where: { id, tenantId } });
    if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });

    if (body.action === 'add') {
      await prisma.guestTagRelation.upsert({
        where:  { guestId_tagId: { guestId: id, tagId: body.tagId } },
        create: { guestId: id, tagId: body.tagId },
        update: {},
      });
    } else {
      await prisma.guestTagRelation.deleteMany({ where: { guestId: id, tagId: body.tagId } });
    }
    return ok(null, `Tag ${body.action}ed`);
  });

  /* ── EMAIL TEMPLATES ──────────────────────────────────────────────────────── */

  app.get('/templates', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    let templates = await prisma.emailTemplate.findMany({ where: { tenantId }, orderBy: { isDefault: 'desc', createdAt: 'asc' } });

    // ── Lazy-init: first visit → create default templates ──────────────────
    if (templates.length === 0) {
      await prisma.emailTemplate.createMany({
        data: DEFAULT_EMAIL_TEMPLATES.map(t => ({ ...t, tenantId })),
        skipDuplicates: true,
      });
      templates = await prisma.emailTemplate.findMany({ where: { tenantId }, orderBy: { isDefault: 'desc', createdAt: 'asc' } });
    }

    return ok(templates);
  });

  const templateSchema = z.object({
    name:      z.string().min(1),
    subject:   z.string().min(1),
    html:      z.string().min(1),
    preheader: z.string().optional(),
  });

  app.post('/templates', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const body = templateSchema.parse(request.body);
    const tpl  = await prisma.emailTemplate.create({ data: { tenantId, name: body.name, subject: body.subject, html: body.html, preheader: body.preheader } });
    return ok(tpl, 'Template created');
  });

  app.put('/templates/:id', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = templateSchema.partial().parse(request.body);
    const tpl  = await prisma.emailTemplate.updateMany({ where: { id, tenantId }, data: body });
    if (!tpl.count) return reply.status(404).send({ success: false, error: 'Template not found' });
    return ok(null, 'Template updated');
  });

  app.delete('/templates/:id', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    await prisma.emailTemplate.deleteMany({ where: { id, tenantId } });
    return ok(null, 'Template deleted');
  });

  /* ── CAMPAIGNS ────────────────────────────────────────────────────────────── */

  app.get('/campaigns', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const campaigns = await prisma.campaign.findMany({
      where:   { tenantId },
      include: { stats: true, _count: { select: { sends: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(campaigns);
  });

  const campaignSchema = z.object({
    name:        z.string().min(1),
    subject:     z.string().min(1),
    html:        z.string().min(1),
    templateId:  z.string().uuid().optional(),
    segment:     z.record(z.any()).optional(),
    scheduledAt: z.string().datetime().optional(),
  });

  app.post('/campaigns', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const body = campaignSchema.parse(request.body);
    const c    = await prisma.campaign.create({
      data: {
        tenantId,
        name:        body.name,
        subject:     body.subject,
        html:        body.html,
        templateId:  body.templateId,
        segment:     body.segment ?? {},
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        status:      body.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });
    return ok(c, 'Campaign created');
  });

  // POST /api/crm/campaigns/:id/send — send campaign now
  app.post('/campaigns/:id/send', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) return reply.status(404).send({ success: false, error: 'Campaign not found' });
    if (campaign.status === 'SENT') return reply.status(400).send({ success: false, error: 'Already sent' });

    // Build segment filter
    const seg = (campaign.segment ?? {}) as Record<string, any>;
    const guests = await prisma.guest.findMany({
      where: {
        tenantId,
        consent: { subscribed: true },
        ...(seg.tier ? { score: { tier: seg.tier } } : {}),
        ...(seg.tag  ? { tags:  { some: { tag: { name: seg.tag } } } } : {}),
      },
      select: { id: true, firstName: true, email: true },
    });

    // Get tenant info for branding
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const wc     = await prisma.websiteContent.findUnique({ where: { tenantId }, select: { primaryColor: true, accentColor: true } });

    await prisma.campaign.update({ where: { id }, data: { status: 'SENDING', recipientCount: guests.length } });
    await prisma.campaignStats.upsert({
      where:  { campaignId: id },
      create: { campaignId: id, sent: 0 },
      update: {},
    });

    let sent = 0;
    for (const guest of guests) {
      const html = wrapEmail({
        body: renderTemplate(campaign.html, { guestName: guest.firstName }),
        tenantName: tenant?.name ?? 'Resort',
        primaryColor: wc?.primaryColor ?? '#1a6b5e',
        accentColor:  wc?.accentColor  ?? '#d4a853',
        unsubscribeUrl: `${process.env.API_URL || 'http://localhost:4000'}/crm/unsubscribe/${guest.id}`,
      });

      const { id: resendId, error } = await sendEmail({ to: guest.email, subject: campaign.subject, html });

      await prisma.emailSend.create({
        data: {
          tenantId,
          guestId:    guest.id,
          campaignId: id,
          subject:    campaign.subject,
          status:     error ? 'FAILED' : 'SENT',
          resendId:   resendId ?? undefined,
        },
      });
      if (!error) sent++;
    }

    await prisma.campaign.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
    await prisma.campaignStats.update({ where: { campaignId: id }, data: { sent } });

    return ok({ sent, total: guests.length }, 'Campaign sent');
  });

  app.delete('/campaigns/:id', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    await prisma.campaign.deleteMany({ where: { id, tenantId, status: { in: ['DRAFT', 'SCHEDULED'] } } });
    return ok(null, 'Campaign deleted');
  });

  /* ── SEQUENCES ────────────────────────────────────────────────────────────── */

  app.get('/sequences', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const sequences = await prisma.sequence.findMany({
      where:   { tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } }, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(sequences);
  });

  const sequenceSchema = z.object({
    name:        z.string().min(1),
    trigger:     z.enum(['BOOKING_CONFIRMED', 'PRE_ARRIVAL', 'CHECK_IN', 'POST_STAY', 'WIN_BACK', 'BIRTHDAY', 'MANUAL']),
    triggerMeta: z.record(z.any()).optional(),
  });

  app.post('/sequences', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const body = sequenceSchema.parse(request.body);
    const seq  = await prisma.sequence.create({ data: { tenantId, name: body.name, trigger: body.trigger, triggerMeta: body.triggerMeta ?? undefined } });
    return ok(seq, 'Sequence created');
  });

  app.put('/sequences/:id', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = z.object({ name: z.string().optional(), status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional() }).parse(request.body);
    await prisma.sequence.updateMany({ where: { id, tenantId }, data: body });
    return ok(null, 'Sequence updated');
  });

  // Add a step to a sequence
  app.post('/sequences/:id/steps', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = z.object({
      subject:    z.string().min(1),
      html:       z.string().min(1),
      delayDays:  z.number().int().min(0).default(0),
      templateId: z.string().uuid().optional(),
    }).parse(request.body);

    const seq = await prisma.sequence.findFirst({ where: { id, tenantId } });
    if (!seq) return reply.status(404).send({ success: false, error: 'Sequence not found' });

    const lastStep = await prisma.sequenceStep.findFirst({ where: { sequenceId: id }, orderBy: { stepOrder: 'desc' } });
    const stepOrder = (lastStep?.stepOrder ?? 0) + 1;

    const step = await prisma.sequenceStep.create({ data: { sequenceId: id, stepOrder, subject: body.subject, html: body.html, delayDays: body.delayDays, ...(body.templateId ? { templateId: body.templateId } : {}) } });
    return ok(step, 'Step added');
  });

  // Manually enroll a guest in a sequence
  app.post('/sequences/:id/enroll', { preHandler: pre }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = z.object({ guestId: z.string().uuid(), triggerMeta: z.record(z.any()).optional() }).parse(request.body);

    const [seq, guest] = await Promise.all([
      prisma.sequence.findFirst({ where: { id, tenantId } }),
      prisma.guest.findFirst({ where: { id: body.guestId, tenantId } }),
    ]);
    if (!seq)   return reply.status(404).send({ success: false, error: 'Sequence not found' });
    if (!guest) return reply.status(404).send({ success: false, error: 'Guest not found' });

    const enrollment = await prisma.sequenceEnrollment.upsert({
      where:  { sequenceId_guestId: { sequenceId: id, guestId: body.guestId } },
      create: { tenantId, sequenceId: id, guestId: body.guestId, triggerMeta: body.triggerMeta ?? {} },
      update: { status: 'ACTIVE', currentStep: 0, completedAt: null },
    });
    return ok(enrollment, 'Guest enrolled in sequence');
  });

  /* ── ANALYTICS ────────────────────────────────────────────────────────────── */

  app.get('/analytics', { preHandler: pre }, async (request) => {
    const { tenantId } = request.user as JwtPayload;

    const [
      totalContacts,
      subscribed,
      tierCounts,
      campaignStats,
      recentSends,
      topGuests,
    ] = await Promise.all([
      prisma.guest.count({ where: { tenantId } }),
      prisma.emailConsent.count({ where: { tenantId, subscribed: true } }),
      prisma.guestScore.groupBy({ by: ['tier'], where: { tenantId }, _count: { tier: true } }),
      prisma.campaignStats.findMany({
        where: { campaign: { tenantId } },
        include: { campaign: { select: { name: true, sentAt: true } } },
        orderBy: { campaign: { sentAt: 'desc' } },
        take: 5,
      }),
      prisma.emailSend.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      prisma.guestScore.findMany({
        where: { tenantId },
        orderBy: { score: 'desc' },
        take: 5,
        include: { guest: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);

    return ok({ totalContacts, subscribed, tierCounts, campaignStats, recentSends, topGuests });
  });
}

/* ── Public unsubscribe route ─────────────────────────────────────────────── */
export async function crmPublicRoutes(app: FastifyInstance) {
  app.get('/unsubscribe/:guestId', async (request, reply) => {
    const { guestId } = request.params as { guestId: string };
    const guest = await prisma.guest.findUnique({ where: { id: guestId }, select: { tenantId: true } });
    if (!guest) return reply.status(404).send('Guest not found');

    await prisma.emailConsent.upsert({
      where:  { guestId },
      create: { tenantId: guest.tenantId, guestId, subscribed: false, unsubscribedAt: new Date() },
      update: { subscribed: false, unsubscribedAt: new Date() },
    });

    // Update all active enrollments
    await prisma.sequenceEnrollment.updateMany({ where: { guestId }, data: { status: 'UNSUBSCRIBED' } });

    return reply.type('text/html').send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Unsubscribed</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
        <h2>You've been unsubscribed</h2>
        <p style="color:#6b7280;">You will no longer receive marketing emails from this resort.</p>
      </body></html>
    `);
  });
}

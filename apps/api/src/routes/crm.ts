import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { sendEmail, wrapEmail, renderTemplate, SEQUENCE_TEMPLATES } from '../services/email';

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
  const pre = requireRole('OWNER', 'MANAGER');

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
    const templates = await prisma.emailTemplate.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
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
    const tpl  = await prisma.emailTemplate.create({ data: { tenantId, ...body } });
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
    const seq  = await prisma.sequence.create({ data: { tenantId, ...body } });
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

    const step = await prisma.sequenceStep.create({ data: { sequenceId: id, stepOrder, ...body } });
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

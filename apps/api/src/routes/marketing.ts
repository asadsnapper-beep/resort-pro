import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveRecipients(tenantId: string, audienceType: string, audienceFilter: any) {
  const base: any = { tenantId, phone: { not: null } };

  switch (audienceType) {
    case 'past':
      base.bookings = { some: { status: { in: ['CHECKED_OUT', 'COMPLETED'] } } };
      break;
    case 'upcoming': {
      const days = audienceFilter?.days ?? 7;
      const from = new Date();
      const to   = new Date();
      to.setDate(to.getDate() + days);
      base.bookings = { some: { checkIn: { gte: from, lte: to }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } };
      break;
    }
    case 'date_range': {
      const checkInFilter: any = {};
      if (audienceFilter?.dateFrom) checkInFilter.gte = new Date(audienceFilter.dateFrom);
      if (audienceFilter?.dateTo)   checkInFilter.lte = new Date(audienceFilter.dateTo);
      if (Object.keys(checkInFilter).length) base.bookings = { some: { checkIn: checkInFilter } };
      break;
    }
    case 'vip':
      base.bookings = { some: {} };
      break;
    case 'all':
    default:
      break;
  }

  const guests = await prisma.guest.findMany({
    where: base,
    select: { id: true, firstName: true, lastName: true, phone: true, bookings: { select: { id: true } } },
  });

  if (audienceType === 'vip') {
    const min = audienceFilter?.minStays ?? 2;
    return guests
      .filter(g => g.bookings.length >= min)
      .map(g => ({ id: g.id, name: `${g.firstName} ${g.lastName}`, phone: g.phone! }));
  }

  return guests.map(g => ({ id: g.id, name: `${g.firstName} ${g.lastName}`, phone: g.phone! }));
}

function renderMessage(message: string, vars: Record<string, string>) {
  return message.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function marketingRoutes(app: FastifyInstance) {

  // ── Audience Preview ────────────────────────────────────────────────────────
  const audiencePreviewSchema = z.object({
    audienceType:   z.string().default('all'),
    audienceFilter: z.any().optional(),
  });

  app.post('/audience-preview', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const body = validate(audiencePreviewSchema, req.body, reply);
    if (!body) return;
    const recipients = await resolveRecipients(user.tenantId, body.audienceType ?? 'all', body.audienceFilter ?? null);
    return reply.send(ok({ count: recipients.length }));
  });

  // ── Campaigns ───────────────────────────────────────────────────────────────
  const campaignCreateSchema = z.object({
    name:           z.string().min(1).max(100),
    channel:        z.enum(['sms', 'whatsapp', 'both']),
    audienceType:   z.string().default('all'),
    audienceFilter: z.any().optional(),
    message:        z.string().min(1).max(1600),
    templateId:     z.string().optional(),
    scheduledAt:    z.string().datetime().optional(),
  });

  // GET /api/marketing/campaigns
  app.get('/campaigns', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { status } = req.query as { status?: string };

    const where: any = { tenantId: user.tenantId };
    if (status && status !== 'all') where.status = status;

    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    });

    return reply.send(ok(campaigns));
  });

  // POST /api/marketing/campaigns
  app.post('/campaigns', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const body = validate(campaignCreateSchema, req.body, reply);
    if (!body) return;

    const recipients = await resolveRecipients(user.tenantId, body.audienceType ?? 'all', body.audienceFilter ?? null);

    const campaign = await prisma.marketingCampaign.create({
      data: {
        tenantId:       user.tenantId,
        name:           body.name,
        channel:        body.channel,
        audienceType:   body.audienceType,
        audienceFilter: body.audienceFilter ?? undefined,
        message:        body.message,
        templateId:     body.templateId,
        recipientCount: recipients.length,
        scheduledAt:    body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status:         body.scheduledAt ? 'scheduled' : 'draft',
      },
    });

    return reply.status(201).send(ok(campaign));
  });

  // GET /api/marketing/campaigns/:id
  app.get('/campaigns/:id', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { id } = req.params as { id: string };

    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { logs: { orderBy: { createdAt: 'desc' }, take: 200 } },
    });

    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    return reply.send(ok(campaign));
  });

  // DELETE /api/marketing/campaigns/:id
  app.delete('/campaigns/:id', {
    preHandler: requireRole('OWNER', 'MANAGER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { id } = req.params as { id: string };

    const campaign = await prisma.marketingCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    if (!['draft', 'failed', 'cancelled'].includes(campaign.status)) {
      return reply.status(400).send({ error: 'Only draft/failed/cancelled campaigns can be deleted' });
    }

    await prisma.marketingCampaign.delete({ where: { id } });
    return reply.send(ok({ deleted: true }));
  });

  // ── Campaign Actions ────────────────────────────────────────────────────────

  // POST /api/marketing/campaigns/:id/send
  app.post('/campaigns/:id/send', {
    preHandler: requireRole('OWNER', 'MANAGER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { id } = req.params as { id: string };

    const campaign = await prisma.marketingCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return reply.status(400).send({ error: 'Campaign already sent or sending' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        smsEnabled: true, waEnabled: true,
        smsMode: true, waMode: true,
        smsApiKey: true, smsApiSecret: true, smsSenderId: true, smsProvider: true,
        waApiToken: true, waPhoneNumberId: true,
        smsQuotaMonthly: true, smsUsedThisMonth: true, smsCredits: true,
        waQuotaMonthly: true, waUsedThisMonth: true, waCredits: true,
        name: true,
      },
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const needsSms = campaign.channel === 'sms' || campaign.channel === 'both';
    const needsWa  = campaign.channel === 'whatsapp' || campaign.channel === 'both';

    if (needsSms && !tenant.smsEnabled) {
      return reply.status(400).send({ error: 'SMS notifications are disabled. Enable SMS in Settings → SMS & WhatsApp first.' });
    }
    if (needsWa && !tenant.waEnabled) {
      return reply.status(400).send({ error: 'WhatsApp notifications are disabled. Enable WhatsApp in Settings → SMS & WhatsApp first.' });
    }

    const recipients = await resolveRecipients(user.tenantId, campaign.audienceType, campaign.audienceFilter);
    if (recipients.length === 0) {
      return reply.status(400).send({ error: 'No recipients found for this audience filter' });
    }

    // Quota check (SMS)
    if (needsSms) {
      const remaining = (tenant.smsQuotaMonthly - tenant.smsUsedThisMonth) + tenant.smsCredits;
      if (remaining < recipients.length) {
        return reply.status(400).send({
          error: `Not enough SMS quota. Need ${recipients.length}, have ${remaining}. Buy more credits in Billing.`,
        });
      }
    }

    // Quota check (WhatsApp)
    if (needsWa) {
      const remaining = (tenant.waQuotaMonthly - tenant.waUsedThisMonth) + tenant.waCredits;
      if (remaining < recipients.length) {
        return reply.status(400).send({
          error: `Not enough WhatsApp quota. Need ${recipients.length}, have ${remaining}. Buy more credits in Billing.`,
        });
      }
    }

    // BTRC time rule: no marketing SMS 10 PM – 8 AM BDT (UTC+6)
    const bdtHour = (new Date().getUTCHours() + 6) % 24;
    if (needsSms && (bdtHour >= 22 || bdtHour < 8)) {
      return reply.status(400).send({
        error: 'Marketing SMS cannot be sent between 10 PM and 8 AM (BTRC guideline). Please schedule it for later.',
      });
    }

    // Mark as sending + create log entries
    await prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'sending', recipientCount: recipients.length },
    });

    const channels = needsSms && needsWa ? ['sms', 'whatsapp'] : needsSms ? ['sms'] : ['whatsapp'];

    await prisma.campaignLog.createMany({
      data: recipients.flatMap(r =>
        channels.map(ch => ({
          campaignId: id,
          guestId:    r.id,
          guestName:  r.name,
          phone:      r.phone,
          channel:    ch,
          status:     'queued',
        }))
      ),
    });

    // Fire-and-forget background send
    setImmediate(async () => {
      await processCampaignSend(id, campaign, recipients, tenant, channels, user.tenantId);
    });

    return reply.send(ok({ message: `Campaign is sending to ${recipients.length} recipients`, recipientCount: recipients.length }));
  });

  // POST /api/marketing/campaigns/:id/cancel
  app.post('/campaigns/:id/cancel', {
    preHandler: requireRole('OWNER', 'MANAGER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { id } = req.params as { id: string };

    const campaign = await prisma.marketingCampaign.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    if (campaign.status !== 'scheduled') {
      return reply.status(400).send({ error: 'Only scheduled campaigns can be cancelled' });
    }

    await prisma.marketingCampaign.update({ where: { id }, data: { status: 'cancelled' } });
    return reply.send(ok({ cancelled: true }));
  });

  // ── Templates ───────────────────────────────────────────────────────────────
  const templateSchema = z.object({
    name:    z.string().min(1).max(100),
    channel: z.enum(['sms', 'whatsapp', 'both']),
    message: z.string().min(1).max(1600),
  });

  // GET /api/marketing/templates
  app.get('/templates', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const templates = await prisma.messageTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });
    return reply.send(ok(templates));
  });

  // POST /api/marketing/templates
  app.post('/templates', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const body = validate(templateSchema, req.body, reply);
    if (!body) return;
    const template = await prisma.messageTemplate.create({
      data: { tenantId: user.tenantId, name: body.name, channel: body.channel, message: body.message },
    });
    return reply.status(201).send(ok(template));
  });

  // PUT /api/marketing/templates/:id
  app.put('/templates/:id', {
    preHandler: requireRole('OWNER', 'MANAGER', 'MARKETER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const body = validate(templateSchema, req.body, reply);
    if (!body) return;

    const existing = await prisma.messageTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Template not found' });

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: { name: body.name, channel: body.channel, message: body.message },
    });
    return reply.send(ok(template));
  });

  // DELETE /api/marketing/templates/:id
  app.delete('/templates/:id', {
    preHandler: requireRole('OWNER', 'MANAGER'),
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const { id } = req.params as { id: string };

    const existing = await prisma.messageTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Template not found' });

    await prisma.messageTemplate.delete({ where: { id } });
    return reply.send(ok({ deleted: true }));
  });
}

// ─── Background send processor ────────────────────────────────────────────────

async function processCampaignSend(
  campaignId: string,
  campaign: any,
  recipients: Array<{ id: string; name: string; phone: string }>,
  tenant: any,
  channels: string[],
  tenantId: string,
) {
  let delivered = 0;
  let failed    = 0;

  for (const recipient of recipients) {
    const msg = renderMessage(campaign.message, {
      guest_name:  recipient.name,
      resort_name: tenant.name ?? 'Resort',
    });

    for (const ch of channels) {
      let success  = false;
      let errorMsg: string | undefined;

      try {
        success = ch === 'sms'
          ? await sendSms(tenant, recipient.phone, msg)
          : await sendWhatsApp(tenant, recipient.phone, msg);
      } catch (e: any) {
        errorMsg = e?.message ?? 'Unknown error';
      }

      await prisma.campaignLog.updateMany({
        where: { campaignId, guestId: recipient.id, channel: ch, status: 'queued' },
        data: {
          status:   success ? 'delivered' : 'failed',
          errorMsg: errorMsg ?? null,
          sentAt:   success ? new Date() : null,
        },
      });

      if (success) delivered++;
      else         failed++;
    }
  }

  const finalStatus = delivered > 0 ? 'sent' : 'failed';
  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: finalStatus, sentAt: new Date(), deliveredCount: delivered, failedCount: failed },
  });

  // Track platform pool usage
  const smsSent = channels.includes('sms') ? delivered : 0;
  const waSent  = channels.includes('whatsapp') ? delivered : 0;
  const usageUpdate: any = {};
  if (tenant.smsMode === 'platform' && channels.includes('sms') && smsSent > 0) {
    usageUpdate.smsUsedThisMonth = { increment: smsSent };
  }
  if (tenant.waMode === 'platform' && channels.includes('whatsapp') && waSent > 0) {
    usageUpdate.waUsedThisMonth = { increment: waSent };
  }
  if (Object.keys(usageUpdate).length > 0) {
    await prisma.tenant.update({ where: { id: tenantId }, data: usageUpdate });
  }
}

// ─── Gateway implementations ──────────────────────────────────────────────────

async function sendSms(tenant: any, phone: string, message: string): Promise<boolean> {
  if (tenant.smsMode === 'own' && tenant.smsApiKey) {
    if (tenant.smsProvider === 'ssl_wireless') {
      return sslWirelessSend(tenant.smsApiKey, tenant.smsSenderId ?? 'RESORT', phone, message);
    }
    if (tenant.smsProvider === 'twilio') {
      return twilioSend(tenant.smsApiKey, tenant.smsApiSecret ?? '', tenant.smsSenderId ?? '', phone, message);
    }
  }
  const apiKey   = process.env.SSL_WIRELESS_API_KEY;
  const senderId = process.env.SSL_WIRELESS_SENDER_ID ?? 'ResortPro';
  if (apiKey) return sslWirelessSend(apiKey, senderId, phone, message);
  console.warn(`[Marketing] SMS skipped — no gateway configured. To: ${phone}`);
  return false;
}

async function sendWhatsApp(tenant: any, phone: string, message: string): Promise<boolean> {
  if (tenant.waMode === 'own' && tenant.waApiToken && tenant.waPhoneNumberId) {
    return metaWaSend(tenant.waApiToken, tenant.waPhoneNumberId, phone, message);
  }
  const token   = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (token && phoneId) return metaWaSend(token, phoneId, phone, message);
  console.warn(`[Marketing] WhatsApp skipped — no gateway configured. To: ${phone}`);
  return false;
}

async function sslWirelessSend(apiKey: string, senderId: string, phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch('https://globalsms.sslwireless.com/api/v3/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_token: apiKey,
        sid:       senderId,
        msisdn:    phone.replace(/^\+/, ''),
        sms:       message,
        csmsid:    `rp_${Date.now()}`,
      }),
    });
    const data = await res.json() as any;
    return data?.status === 'ACCEPTED' || data?.status_code === 200;
  } catch (e) {
    console.error('[SSL Wireless]', e);
    return false;
  }
}

async function twilioSend(sid: string, token: string, from: string, to: string, message: string): Promise<boolean> {
  try {
    const creds = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
    });
    const data = await res.json() as any;
    return data?.status === 'queued' || data?.status === 'sent';
  } catch (e) {
    console.error('[Twilio]', e);
    return false;
  }
}

async function metaWaSend(token: string, phoneNumberId: string, to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await res.json() as any;
    return !!data?.messages?.[0]?.id;
  } catch (e) {
    console.error('[Meta WA]', e);
    return false;
  }
}

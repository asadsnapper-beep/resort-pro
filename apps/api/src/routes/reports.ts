import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { sendEmail } from '../services/email';
import { deliveryVerdict } from '../utils/delivery';
import type { JwtPayload } from '@resort-pro/types';
import { resolveReportPeriod, ReportPeriodError, weekContaining, localDateToday } from '../services/reporting/period';
import { buildReport, type Report } from '../services/reporting/build-report';

/**
 * Resolve the resort's timezone, then the period, in that order.
 *
 * The timezone has to be known before the period can be, which is the whole
 * reason the old `dayBounds()` was wrong: it never asked.
 */
async function periodFor(
  tenantId: string,
  range: { from: string; to: string; kind?: 'daily' | 'weekly' | 'custom' },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  return resolveReportPeriod({ ...range, timezone: tenant?.timezone });
}

/** The resort's own today, for defaulting a missing date. */
async function todayFor(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  return localDateToday(tenant?.timezone || 'Asia/Dhaka');
}

async function buildDailyReport(tenantId: string, dateStr: string) {
  return buildReport(tenantId, await periodFor(tenantId, { from: dateStr, to: dateStr, kind: 'daily' }));
}

function fmt(n: number, currency = 'USD') {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}

function buildReportEmail(report: Report, primaryColor = '#1a6b5e') {
  const cur = report.tenant.currency;
  const row = (label: string, value: string, bold = false) =>
    `<tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px 12px;color:#888;font-size:13px">${label}</td>
      <td style="padding:8px 12px;${bold ? 'font-weight:700;' : ''}font-size:13px;text-align:right">${value}</td>
    </tr>`;

  const arrivalsRows = report.arrivals.length
    ? report.arrivals.map(a =>
        `<tr style="border-bottom:1px solid #f8f8f8">
          <td style="padding:7px 12px;font-size:12px">${a.guestName}</td>
          <td style="padding:7px 12px;font-size:12px;color:#888">${a.room}</td>
          <td style="padding:7px 12px;font-size:12px;text-align:right">${a.nights}n → ${a.checkOut}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#aaa;font-size:12px">No arrivals today</td></tr>`;

  const departuresRows = report.departures.length
    ? report.departures.map(d =>
        `<tr style="border-bottom:1px solid #f8f8f8">
          <td style="padding:7px 12px;font-size:12px">${d.guestName}</td>
          <td style="padding:7px 12px;font-size:12px;color:#888">${d.room}</td>
          <td style="padding:7px 12px;font-size:12px;text-align:right;${d.paidAmount < d.totalBill ? 'color:#ef4444' : 'color:#10b981'}">${fmt(d.totalBill, cur)}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#aaa;font-size:12px">No departures today</td></tr>`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 16px">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <!-- Header -->
  <tr><td style="background:${primaryColor};padding:24px 28px">
    <h1 style="color:#fff;margin:0;font-size:20px">${report.tenant.name}</h1>
    <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px">Daily Report — ${report.date}</p>
  </td></tr>

  <!-- Occupancy -->
  <tr><td style="padding:20px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">📊 Occupancy</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Rooms Occupied', `${report.occupancy.occupiedRoomNights} / ${report.occupancy.totalRooms}`)}
      ${row('Occupancy Rate', `${report.occupancy.rate}%`, true)}
    </table>
  </td></tr>

  <!-- Money received. Deliberately not totalled with what was charged. -->
  <tr><td style="padding:16px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">💳 Payments received</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Cash', fmt(report.financial.cashCollected.byMethod.CASH, cur))}
      ${row('Card / Online', fmt(report.financial.cashCollected.byMethod.CARD + report.financial.cashCollected.byMethod.STRIPE, cur))}
      ${row('Bank Transfer', fmt(report.financial.cashCollected.byMethod.BANK_TRANSFER, cur))}
      ${row('Total received', fmt(report.financial.cashCollected.total, cur), true)}
    </table>
    <p style="margin:6px 0 0;color:#999;font-size:11px">
      Money banked on this date. Restaurant bills settled at the counter are not counted here yet.
    </p>
  </td></tr>

  <!-- Charged, which is a different question from received. -->
  <tr><td style="padding:16px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">🧾 Charged to guests</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Restaurant', fmt(report.financial.chargesPosted.restaurant, cur))}
      ${row('Extras', fmt(report.financial.chargesPosted.extras, cur))}
    </table>
    <p style="margin:6px 0 0;color:#999;font-size:11px">
      Added to guests' bills on this date. Some is still owed, so it is not added to the payments above.
    </p>
  </td></tr>

  <!-- Arrivals -->
  <tr><td style="padding:16px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">🛬 Arrivals (${report.arrivals.length})</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#f8f8f8"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#888">Guest</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#888">Room</th><th style="padding:8px 12px;text-align:right;font-size:11px;color:#888">Stay</th></tr>
      ${arrivalsRows}
    </table>
  </td></tr>

  <!-- Departures -->
  <tr><td style="padding:16px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">🛫 Departures (${report.departures.length})</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      <tr style="background:#f8f8f8"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#888">Guest</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#888">Room</th><th style="padding:8px 12px;text-align:right;font-size:11px;color:#888">Bill</th></tr>
      ${departuresRows}
    </table>
  </td></tr>

  <!-- Operations -->
  <tr><td style="padding:16px 28px 20px">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">🔧 Operations</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Housekeeping Completed', String(report.housekeeping.completed))}
      ${row('Housekeeping Pending', String(report.housekeeping.pendingAtEnd))}
      ${row('Maintenance Open', String(report.maintenance.openAtEnd))}
      ${row('Maintenance Resolved Today', String(report.maintenance.resolved))}
      ${report.noShows.length > 0 ? row('No-Shows', String(report.noShows.length)) : ''}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafa;border-top:1px solid #eee;padding:14px 28px;text-align:center">
    <p style="color:#aaa;font-size:11px;margin:0">Generated by ResortPro · ${new Date().toLocaleString()}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ── Telegram helper (for test dispatch) ──────────────────────────────────────
async function sendTelegramMsg(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json() as any;
    return data?.ok === true;
  } catch { return false; }
}

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/reports/daily?date=YYYY-MM-DD
  app.get('/daily', {
    schema: { tags: ['reports'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { date } = request.query as { date?: string };
      const dateStr = date ?? new Date().toISOString().slice(0, 10);

      const report = await buildDailyReport(tenantId, dateStr);
      return ok(report);
    },
  });

  // GET /api/reports/period?from=YYYY-MM-DD&to=YYYY-MM-DD
  //
  // The canonical endpoint. `/daily` is the same builder with from === to, kept
  // so existing clients keep working while the UI migrates.
  //
  // `week=YYYY-MM-DD` is a convenience: it answers with the Monday–Sunday week
  // that date falls in, so the client does not have to know where a week
  // starts. Quick ranges like "last 30 days" are the client's arithmetic; they
  // arrive here as plain from/to.
  app.get('/period', {
    schema: { tags: ['reports'], security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { from, to, week } = request.query as { from?: string; to?: string; week?: string };

      let range: { from: string; to: string; kind?: 'daily' | 'weekly' | 'custom' };
      if (week) {
        range = { ...weekContaining(week), kind: 'weekly' };
      } else if (from && to) {
        range = { from, to };
      } else {
        return reply.status(400).send({
          success: false,
          error: 'Give both from and to, or a week date.',
          field: from ? 'to' : 'from',
        });
      }

      try {
        const period = await periodFor(tenantId, range);
        // No activity is a valid answer, not an error: every figure comes back
        // zero and every list empty.
        return ok(await buildReport(tenantId, period));
      } catch (error) {
        if (error instanceof ReportPeriodError) {
          // Field-specific so the form can point at the offending input, and
          // never silently corrected — a reversed range is the caller's to see.
          return reply.status(400).send({ success: false, error: error.message, field: error.field });
        }
        throw error;
      }
    },
  });

  // POST /api/reports/daily/email?date=YYYY-MM-DD
  app.post('/daily/email', {
    schema: { tags: ['reports'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { date } = request.query as { date?: string };
      const { toEmail } = request.body as { toEmail?: string };
      const dateStr = date ?? new Date().toISOString().slice(0, 10);

      const report = await buildDailyReport(tenantId, dateStr);

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { email: true, brandPrimaryColor: true },
      });

      const recipientEmail = toEmail ?? tenant?.email;
      if (!recipientEmail) return reply.status(400).send({ error: 'No email address available' });

      const html = buildReportEmail(report, tenant?.brandPrimaryColor ?? '#1a6b5e');
      const verdict = deliveryVerdict(await sendEmail({
        to: recipientEmail,
        subject: `Daily Report — ${report.tenant.name} · ${dateStr}`,
        html,
      }));

      // "Report emailed" used to appear whether or not anything was sent. An
      // owner who believes the evening report went out does not go looking for
      // it.
      if (!verdict.delivered) {
        return reply.status(verdict.status).send({
          success: false, error: verdict.error, code: verdict.code,
        });
      }

      return ok({ sent: true, to: recipientEmail, date: dateStr, id: verdict.id });
    },
  });

  // ── GET /api/reports/dispatch — get dispatch settings ─────────────────────
  app.get('/dispatch', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const settings = await db.reportDispatchSettings.findUnique({ where: { tenantId } });
      return ok(settings ?? {
        enabled: false,
        dispatchTime: '22:00',
        telegramEnabled: false,
        telegramBotToken: null,
        telegramChatId: null,
        whatsappEnabled: false,
        whatsappPhone: null,
        lastDispatchedAt: null,
        lastDispatchDate: null,
      });
    },
  });

  // ── PUT /api/reports/dispatch — save dispatch settings ────────────────────
  app.put('/dispatch', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as {
        enabled?: boolean;
        dispatchTime?: string;
        telegramEnabled?: boolean;
        telegramBotToken?: string | null;
        telegramChatId?: string | null;
        whatsappEnabled?: boolean;
        whatsappPhone?: string | null;
      };

      const settings = await db.reportDispatchSettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          enabled:          body.enabled          ?? false,
          dispatchTime:     body.dispatchTime      ?? '22:00',
          telegramEnabled:  body.telegramEnabled   ?? false,
          telegramBotToken: body.telegramBotToken  ?? null,
          telegramChatId:   body.telegramChatId    ?? null,
          whatsappEnabled:  body.whatsappEnabled   ?? false,
          whatsappPhone:    body.whatsappPhone      ?? null,
        },
        update: {
          ...(body.enabled          !== undefined && { enabled: body.enabled }),
          ...(body.dispatchTime     !== undefined && { dispatchTime: body.dispatchTime }),
          ...(body.telegramEnabled  !== undefined && { telegramEnabled: body.telegramEnabled }),
          ...(body.telegramBotToken !== undefined && { telegramBotToken: body.telegramBotToken }),
          ...(body.telegramChatId   !== undefined && { telegramChatId: body.telegramChatId }),
          ...(body.whatsappEnabled  !== undefined && { whatsappEnabled: body.whatsappEnabled }),
          ...(body.whatsappPhone    !== undefined && { whatsappPhone: body.whatsappPhone }),
        },
      });

      return ok(settings);
    },
  });

  // ── POST /api/reports/dispatch/test — send test report now ───────────────
  app.post('/dispatch/test', {
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = request.body as { channel: 'telegram' | 'whatsapp' };

      const settings = await db.reportDispatchSettings.findUnique({ where: { tenantId } });
      if (!settings) return reply.code(400).send({ success: false, error: 'No dispatch settings found. Save settings first.' });

      const dateStr = new Date().toISOString().slice(0, 10);
      const report  = await buildDailyReport(tenantId, dateStr);

      let sent = false;
      let error = '';

      if (body.channel === 'telegram') {
        if (!settings.telegramBotToken || !settings.telegramChatId) {
          return reply.code(400).send({ success: false, error: 'Telegram bot token and chat ID are required.' });
        }
        const cur = report.tenant.currency;
        const fmt = (n: number) => {
          try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
          catch { return `${cur} ${n.toFixed(0)}`; }
        };
        const text = `<b>📊 Test Report — ${report.tenant.name}</b>\n📅 ${dateStr}\n\n<b>🏨 Occupancy</b>\nRooms: ${report.occupancy.occupiedRoomNights}/${report.occupancy.totalRooms} (${report.occupancy.rate}%)\n\n<b>💳 Received</b>\n<b>${fmt(report.financial.cashCollected.total)}</b>\n\n<i>✅ Test message from ResortPro</i>`;
        sent = await sendTelegramMsg(settings.telegramBotToken, settings.telegramChatId, text);
        if (!sent) error = 'Telegram delivery failed. Check your bot token and chat ID.';
      } else if (body.channel === 'whatsapp') {
        if (!settings.whatsappPhone) {
          return reply.code(400).send({ success: false, error: 'WhatsApp phone number is required.' });
        }
        // Use tenant WA config
        const tenant = await db.tenant.findUnique({
          where: { id: tenantId },
          select: { waMode: true, waApiToken: true, waPhoneNumberId: true },
        });
        const waToken = (tenant?.waMode === 'own' && tenant?.waApiToken) ? tenant.waApiToken : (process.env.META_WA_TOKEN ?? '');
        const waPhoneId = (tenant?.waMode === 'own' && tenant?.waPhoneNumberId) ? tenant.waPhoneNumberId : (process.env.META_WA_PHONE_NUMBER_ID ?? '');
        if (!waToken || !waPhoneId) {
          return reply.code(400).send({ success: false, error: 'WhatsApp gateway not configured. Set up WhatsApp in Settings first.' });
        }
        try {
          const res = await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: settings.whatsappPhone.replace(/^\+/, ''),
              type: 'text',
              text: { body: `✅ Test report from ResortPro — ${report.tenant.name}\nDate: ${dateStr}\nOccupancy: ${report.occupancy.rate}%\nReceived: ${report.financial.cashCollected.total}` },
            }),
          });
          const data = await res.json() as any;
          sent = !!data?.messages?.[0]?.id;
          if (!sent) error = 'WhatsApp delivery failed. Check gateway configuration.';
        } catch (e) {
          error = 'WhatsApp request failed.';
        }
      } else {
        return reply.code(400).send({ success: false, error: 'channel must be "telegram" or "whatsapp"' });
      }

      if (!sent) return reply.code(502).send({ success: false, error });
      return ok({ sent: true, channel: body.channel, date: dateStr });
    },
  });
}

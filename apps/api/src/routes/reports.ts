import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { sendEmail } from '../services/email';
import type { JwtPayload } from '@resort-pro/types';
import { resolveReportPeriod } from '../services/reporting/period';

async function buildDailyReport(tenantId: string, dateStr: string) {
  // The resort's timezone decides where its day begins, so it has to be known
  // before any query is built. The previous version used `setHours`, which
  // reads the server's timezone instead — see services/reporting/period.ts.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, currency: true, email: true, logoUrl: true,
      brandPrimaryColor: true, timezone: true,
    },
  });

  const period = resolveReportPeriod({
    from: dateStr, to: dateStr, timezone: tenant?.timezone, kind: 'daily',
  });

  // Timestamp columns want instants; `@db.Date` columns want dates. Mixing the
  // two is what once had every Dhaka resort reporting zero arrivals.
  const inPeriod = { gte: period.startInstant, lt: period.endInstantExclusive };
  const onDates = { gte: period.startDate, lt: period.endDateExclusive };

  const [
    totalRooms,
    occupiedRooms,
    arrivals,
    departures,
    noShows,
    roomPayments,
    restaurantOrders,
    invoiceExtras,
    housekeepingCompleted,
    housekeepingPending,
    maintenanceOpen,
    maintenanceResolvedToday,
  ] = await Promise.all([
    // Rooms
    prisma.room.count({ where: { tenantId, isActive: true } }),
    prisma.room.count({ where: { tenantId, status: 'OCCUPIED', isActive: true } }),

    // Arrivals: checked in today (actualCheckIn within day) OR confirmed checkIn=today
    prisma.booking.findMany({
      where: {
        tenantId,
        OR: [
          { actualCheckIn: inPeriod },
          { checkIn: onDates, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        ],
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, name: true } },
      },
      orderBy: { checkIn: 'asc' },
    }),

    // Departures: checked out today
    prisma.booking.findMany({
      where: {
        tenantId,
        OR: [
          { actualCheckOut: inPeriod },
          { checkOut: onDates, status: { in: ['CHECKED_OUT', 'CHECKED_IN'] } },
        ],
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, name: true } },
        payments: { where: { status: 'PAID' } },
      },
      orderBy: { checkOut: 'asc' },
    }),

    // No-shows: checkIn=today, status=CONFIRMED (never checked in)
    prisma.booking.findMany({
      where: {
        tenantId,
        checkIn: onDates,
        status: 'CONFIRMED',
        actualCheckIn: null,
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, name: true } },
      },
    }),

    // Room revenue: payments processed today
    prisma.payment.findMany({
      where: { tenantId, processedAt: inPeriod, status: 'PAID' },
      include: { booking: { select: { id: true } } },
    }),

    // Restaurant revenue: food orders today
    prisma.foodOrder.aggregate({
      where: { tenantId, createdAt: inPeriod, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),

    // Invoice extras charged today
    prisma.invoiceExtra.aggregate({
      where: { tenantId, createdAt: inPeriod },
      _sum: { amount: true },
    }),

    // Housekeeping
    prisma.housekeepingTask.count({ where: { tenantId, status: 'COMPLETED', scheduledDate: onDates } }),
    prisma.housekeepingTask.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: onDates } }),

    // Maintenance
    prisma.maintenanceTicket.count({ where: { tenantId, status: { not: 'RESOLVED' } } }),
    prisma.maintenanceTicket.count({ where: { tenantId, status: 'RESOLVED', resolvedAt: inPeriod } }),

  ]);

  // ── Money ─────────────────────────────────────────────────────────────────
  //
  // Two figures, never one. This used to be
  //   revenue.total = payments + food orders + invoice extras
  // and called "Total Revenue" on screen, in the evening email and in the
  // Telegram message. Those are not the same kind of number, and for a stay
  // whose food was charged to the room they are not independent either: the
  // checkout payment already contains the food, so the food was counted twice.
  // A room at 1200 with 600 of food, paid 1800 at checkout, was reported as
  // 2400 — a third more money than the resort took.
  //
  // So: what arrived, and what was charged, side by side and never added.
  const byMethod = { CASH: 0, CARD: 0, BANK_TRANSFER: 0, STRIPE: 0, OTHER: 0, PENDING: 0 };
  let cashCollectedTotal = 0;
  for (const p of roomPayments) {
    const amt = Number(p.amount);
    byMethod[p.method as keyof typeof byMethod] = (byMethod[p.method as keyof typeof byMethod] ?? 0) + amt;
    cashCollectedTotal += amt;
  }

  const restaurantCharges = Number(restaurantOrders._sum.totalAmount ?? 0);
  const extrasCharges = Number(invoiceExtras._sum.amount ?? 0);

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0;

  // Calc nights sold: count of unique CHECKED_IN bookings with overlapping stay
  const nightsSold = occupiedRooms; // 1 night per occupied room for the day

  const calcNights = (checkIn: Date, checkOut: Date) =>
    Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000));

  return {
    date: dateStr,
    tenant: { name: tenant?.name ?? '', currency: tenant?.currency ?? 'USD' },
    occupancy: { totalRooms, occupied: occupiedRooms, rate: occupancyRate, nightsSold },
    arrivals: arrivals.map(b => ({
      bookingId: b.id,
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
      nights: calcNights(b.checkIn, b.checkOut),
      checkOut: b.checkOut.toISOString().slice(0, 10),
      status: b.status,
    })),
    departures: departures.map(b => ({
      bookingId: b.id,
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
      totalBill: Number(b.totalAmount),
      paidAmount: b.payments.reduce((s, p) => s + Number(p.amount), 0),
      status: b.status,
    })),
    noShows: noShows.map(b => ({
      bookingId: b.id,
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
    })),
    period: {
      kind: period.kind, from: period.from, to: period.to,
      timezone: period.timezone, dayCount: period.dayCount,
    },
    financial: {
      /**
       * Money that arrived, from `Payment` rows alone. The method figures sum
       * to the total, by construction.
       *
       * Known incomplete, and deliberately not papered over: a restaurant
       * order settled in cash never creates a `Payment` row — marking it paid
       * only flips `FoodOrder.paymentStatus`, and there is no column recording
       * *when* that happened. So till money taken at the restaurant counter is
       * not here. Closing that needs a `paidAt` on FoodOrder.
       */
      cashCollected: { byMethod, total: cashCollectedTotal },
      /**
       * Value charged to guests in the period. Not money; some of it is still
       * owed, and some was paid in a different period.
       *
       * `room` is absent on purpose rather than guessed. Room charges accrue
       * per night, so attributing them to a period needs the room-night engine
       * in plan/report-periods-and-custom-range.md, and the choice between
       * planned and actual stay dates is still an open product decision there.
       * A wrong room figure here would be worse than none.
       */
      chargesPosted: { restaurant: restaurantCharges, extras: extrasCharges, room: null },
    },
    housekeeping: { completed: housekeepingCompleted, pending: housekeepingPending },
    maintenance: { open: maintenanceOpen, resolvedToday: maintenanceResolvedToday },
  };
}

function fmt(n: number, currency = 'USD') {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}

function buildReportEmail(report: Awaited<ReturnType<typeof buildDailyReport>>, primaryColor = '#1a6b5e') {
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
      ${row('Rooms Occupied', `${report.occupancy.occupied} / ${report.occupancy.totalRooms}`)}
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
      ${row('Housekeeping Pending', String(report.housekeeping.pending))}
      ${row('Maintenance Open', String(report.maintenance.open))}
      ${row('Maintenance Resolved Today', String(report.maintenance.resolvedToday))}
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
      await sendEmail({
        to: recipientEmail,
        subject: `Daily Report — ${report.tenant.name} · ${dateStr}`,
        html,
      });

      return ok({ sent: true, to: recipientEmail, date: dateStr });
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
        const text = `<b>📊 Test Report — ${report.tenant.name}</b>\n📅 ${dateStr}\n\n<b>🏨 Occupancy</b>\nRooms: ${report.occupancy.occupied}/${report.occupancy.totalRooms} (${report.occupancy.rate}%)\n\n<b>💳 Received</b>\n<b>${fmt(report.financial.cashCollected.total)}</b>\n\n<i>✅ Test message from ResortPro</i>`;
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

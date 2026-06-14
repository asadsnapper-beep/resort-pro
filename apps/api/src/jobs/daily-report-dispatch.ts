/**
 * Daily Report Auto-Dispatch
 *
 * Runs every minute. For each tenant with dispatch enabled,
 * checks if the current HH:MM matches their dispatchTime,
 * and if this date hasn't been dispatched yet, sends the report
 * to Telegram and/or WhatsApp.
 */

import cron from 'node-cron';
import { prisma } from '@resort-pro/database';

// ── Telegram ──────────────────────────────────────────────────────────────────
async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json() as any;
    return data?.ok === true;
  } catch (e) {
    console.error('[ReportDispatch] Telegram error:', e);
    return false;
  }
}

// ── WhatsApp (Meta Cloud API via tenant config or env vars) ───────────────────
async function sendWhatsAppReport(
  tenant: { waMode?: string | null; waApiToken?: string | null; waPhoneNumberId?: string | null },
  phone: string,
  message: string,
): Promise<boolean> {
  let token: string | null = null;
  let phoneNumberId: string | null = null;

  if (tenant.waMode === 'own' && tenant.waApiToken && tenant.waPhoneNumberId) {
    token = tenant.waApiToken;
    phoneNumberId = tenant.waPhoneNumberId;
  } else {
    token = process.env.META_WA_TOKEN ?? null;
    phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID ?? null;
  }

  if (!token || !phoneNumberId) {
    console.warn('[ReportDispatch] WhatsApp not configured for tenant');
    return false;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await res.json() as any;
    return !!data?.messages?.[0]?.id;
  } catch (e) {
    console.error('[ReportDispatch] WhatsApp error:', e);
    return false;
  }
}

// ── Report text builder ───────────────────────────────────────────────────────
function buildReportText(report: any): string {
  const cur = report.tenant.currency;
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch { return `${cur} ${n.toFixed(0)}`; }
  };

  return `<b>📊 Daily Report — ${report.tenant.name}</b>
📅 ${report.date}

<b>🏨 Occupancy</b>
Rooms: ${report.occupancy.occupied}/${report.occupancy.totalRooms} (${report.occupancy.rate}%)

<b>💰 Revenue</b>
Rooms: ${fmt(report.revenue.rooms)}
Restaurant: ${fmt(report.revenue.restaurant)}
Extras: ${fmt(report.revenue.extras)}
<b>Total: ${fmt(report.revenue.total)}</b>

<b>💳 Payments</b>
Cash: ${fmt(report.payments.cash)}
Card/Online: ${fmt(report.payments.card)}
Bank Transfer: ${fmt(report.payments.bankTransfer)}

<b>🛬 Arrivals: ${report.arrivals.length}</b>
<b>🛫 Departures: ${report.departures.length}</b>
${report.noShows.length > 0 ? `⚠️ No-shows: ${report.noShows.length}\n` : ''}
<b>🔧 Operations</b>
Housekeeping: ✅${report.housekeeping.completed} ⏳${report.housekeeping.pending}
Maintenance: 🔴${report.maintenance.open} open, ✅${report.maintenance.resolvedToday} resolved

<i>Sent by ResortPro</i>`;
}

// Plain text version for WhatsApp (no HTML)
function buildReportTextPlain(report: any): string {
  const cur = report.tenant.currency;
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch { return `${cur} ${n.toFixed(0)}`; }
  };

  return `📊 Daily Report — ${report.tenant.name}
📅 ${report.date}

🏨 Occupancy
Rooms: ${report.occupancy.occupied}/${report.occupancy.totalRooms} (${report.occupancy.rate}%)

💰 Revenue
Rooms: ${fmt(report.revenue.rooms)}
Restaurant: ${fmt(report.revenue.restaurant)}
Extras: ${fmt(report.revenue.extras)}
Total: ${fmt(report.revenue.total)}

💳 Payments
Cash: ${fmt(report.payments.cash)}
Card/Online: ${fmt(report.payments.card)}
Bank Transfer: ${fmt(report.payments.bankTransfer)}

🛬 Arrivals: ${report.arrivals.length}
🛫 Departures: ${report.departures.length}${report.noShows.length > 0 ? `\n⚠️ No-shows: ${report.noShows.length}` : ''}

🔧 Operations
Housekeeping: ✅${report.housekeeping.completed} pending: ${report.housekeeping.pending}
Maintenance: ${report.maintenance.open} open, ${report.maintenance.resolvedToday} resolved today

Sent by ResortPro`;
}

// ── Import buildDailyReport (we re-implement a minimal DB-only version here) ──
// Instead of importing from routes (which would create a circular dep via Fastify),
// we inline the same logic here using prisma directly.
async function buildDailyReport(tenantId: string, dateStr: string) {
  const d = new Date(dateStr);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end   = new Date(d); end.setHours(23, 59, 59, 999);

  const [
    totalRooms, occupiedRooms,
    arrivals, departures, noShows,
    roomPayments, restaurantOrders, invoiceExtras,
    housekeepingCompleted, housekeepingPending,
    maintenanceOpen, maintenanceResolvedToday,
    tenant,
  ] = await Promise.all([
    prisma.room.count({ where: { tenantId, isActive: true } }),
    prisma.room.count({ where: { tenantId, status: 'OCCUPIED', isActive: true } }),
    prisma.booking.findMany({
      where: { tenantId, OR: [
        { actualCheckIn: { gte: start, lte: end } },
        { checkIn: { gte: start, lte: end }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      ]},
      include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true, name: true } } },
    }),
    prisma.booking.findMany({
      where: { tenantId, OR: [
        { actualCheckOut: { gte: start, lte: end } },
        { checkOut: { gte: start, lte: end }, status: { in: ['CHECKED_OUT', 'CHECKED_IN'] } },
      ]},
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, name: true } },
        payments: { where: { status: 'PAID' } },
      },
    }),
    prisma.booking.findMany({
      where: { tenantId, checkIn: { gte: start, lte: end }, status: 'CONFIRMED', actualCheckIn: null },
      include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { number: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { tenantId, processedAt: { gte: start, lte: end }, status: 'PAID' },
    }),
    prisma.foodOrder.aggregate({
      where: { tenantId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),
    prisma.invoiceExtra.aggregate({
      where: { tenantId, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.housekeepingTask.count({ where: { tenantId, status: 'COMPLETED', scheduledDate: { gte: start, lte: end } } }),
    prisma.housekeepingTask.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { gte: start, lte: end } } }),
    prisma.maintenanceTicket.count({ where: { tenantId, status: { not: 'RESOLVED' } } }),
    prisma.maintenanceTicket.count({ where: { tenantId, status: 'RESOLVED', resolvedAt: { gte: start, lte: end } } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, currency: true, waMode: true, waApiToken: true, waPhoneNumberId: true },
    }),
  ]);

  const paymentsBreakdown = { CASH: 0, CARD: 0, BANK_TRANSFER: 0, STRIPE: 0, OTHER: 0 };
  let roomRevenue = 0;
  for (const p of roomPayments) {
    const amt = Number(p.amount);
    paymentsBreakdown[p.method as keyof typeof paymentsBreakdown] =
      (paymentsBreakdown[p.method as keyof typeof paymentsBreakdown] ?? 0) + amt;
    roomRevenue += amt;
  }

  const restaurantRevenue = Number(restaurantOrders._sum.totalAmount ?? 0);
  const extrasRevenue     = Number(invoiceExtras._sum.amount ?? 0);
  const totalRevenue      = roomRevenue + restaurantRevenue + extrasRevenue;
  const occupancyRate     = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0;

  const calcNights = (ci: Date, co: Date) => Math.max(1, Math.ceil((co.getTime() - ci.getTime()) / 86_400_000));

  return {
    date: dateStr,
    tenant: { name: tenant?.name ?? '', currency: tenant?.currency ?? 'USD', waMode: tenant?.waMode, waApiToken: tenant?.waApiToken, waPhoneNumberId: tenant?.waPhoneNumberId },
    occupancy: { totalRooms, occupied: occupiedRooms, rate: occupancyRate },
    arrivals: arrivals.map(b => ({
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
      nights: calcNights(b.checkIn, b.checkOut),
    })),
    departures: departures.map(b => ({
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
      totalBill: Number(b.totalAmount),
      paidAmount: b.payments.reduce((s: number, p: any) => s + Number(p.amount), 0),
    })),
    noShows: noShows.map(b => ({
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
    })),
    revenue: { rooms: roomRevenue, restaurant: restaurantRevenue, extras: extrasRevenue, total: totalRevenue },
    payments: {
      cash: paymentsBreakdown.CASH,
      card: paymentsBreakdown.CARD + paymentsBreakdown.STRIPE,
      bankTransfer: paymentsBreakdown.BANK_TRANSFER,
    },
    housekeeping: { completed: housekeepingCompleted, pending: housekeepingPending },
    maintenance:  { open: maintenanceOpen, resolvedToday: maintenanceResolvedToday },
  };
}

// ── Main cron ─────────────────────────────────────────────────────────────────
export function startReportDispatchJob() {
  // Runs every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    const todayStr    = now.toISOString().slice(0, 10);

    // Find all tenants that have dispatch enabled and it's their dispatch time
    const settings = await prisma.reportDispatchSettings.findMany({
      where: {
        enabled: true,
        dispatchTime: currentTime,
      },
    });

    for (const setting of settings) {
      // Skip if already dispatched today
      if (setting.lastDispatchDate === todayStr) continue;

      // Skip if neither channel is enabled
      if (!setting.telegramEnabled && !setting.whatsappEnabled) continue;

      try {
        const report = await buildDailyReport(setting.tenantId, todayStr);
        let tgSent = false;
        let waSent = false;

        if (setting.telegramEnabled && setting.telegramBotToken && setting.telegramChatId) {
          const text = buildReportText(report);
          tgSent = await sendTelegram(setting.telegramBotToken, setting.telegramChatId, text);
        }

        if (setting.whatsappEnabled && setting.whatsappPhone) {
          const text = buildReportTextPlain(report);
          waSent = await sendWhatsAppReport(
            { waMode: report.tenant.waMode, waApiToken: report.tenant.waApiToken, waPhoneNumberId: report.tenant.waPhoneNumberId },
            setting.whatsappPhone,
            text,
          );
        }

        await prisma.reportDispatchSettings.update({
          where: { id: setting.id },
          data: {
            lastDispatchedAt: now,
            lastDispatchDate: todayStr,
          },
        });

        console.log(`[ReportDispatch] Tenant ${setting.tenantId} — Telegram: ${tgSent}, WhatsApp: ${waSent}, date: ${todayStr}`);
      } catch (err) {
        console.error(`[ReportDispatch] Error for tenant ${setting.tenantId}:`, err);
      }
    }
  });

  console.log('[ReportDispatch] Daily report dispatch cron started (every minute)');
}

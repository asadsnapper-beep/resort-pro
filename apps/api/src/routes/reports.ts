import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { sendEmail } from '../services/email';
import type { JwtPayload } from '@resort-pro/types';

function dayBounds(dateStr: string) {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function buildDailyReport(tenantId: string, dateStr: string) {
  const { start, end } = dayBounds(dateStr);

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
    tenant,
  ] = await Promise.all([
    // Rooms
    prisma.room.count({ where: { tenantId, isActive: true } }),
    prisma.room.count({ where: { tenantId, status: 'OCCUPIED', isActive: true } }),

    // Arrivals: checked in today (actualCheckIn within day) OR confirmed checkIn=today
    prisma.booking.findMany({
      where: {
        tenantId,
        OR: [
          { actualCheckIn: { gte: start, lte: end } },
          { checkIn: { gte: start, lte: end }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
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
          { actualCheckOut: { gte: start, lte: end } },
          { checkOut: { gte: start, lte: end }, status: { in: ['CHECKED_OUT', 'CHECKED_IN'] } },
        ],
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, name: true } },
        payments: { where: { status: 'COMPLETED' } },
      },
      orderBy: { checkOut: 'asc' },
    }),

    // No-shows: checkIn=today, status=CONFIRMED (never checked in)
    prisma.booking.findMany({
      where: {
        tenantId,
        checkIn: { gte: start, lte: end },
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
      where: { tenantId, processedAt: { gte: start, lte: end }, status: 'COMPLETED' },
      include: { booking: { select: { id: true } } },
    }),

    // Restaurant revenue: food orders today
    prisma.foodOrder.aggregate({
      where: { tenantId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),

    // Invoice extras charged today
    prisma.invoiceExtra.aggregate({
      where: { tenantId, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),

    // Housekeeping
    prisma.housekeepingTask.count({ where: { tenantId, status: 'COMPLETED', scheduledDate: { gte: start, lte: end } } }),
    prisma.housekeepingTask.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { gte: start, lte: end } } }),

    // Maintenance
    prisma.maintenanceTicket.count({ where: { tenantId, status: { not: 'RESOLVED' } } }),
    prisma.maintenanceTicket.count({ where: { tenantId, status: 'RESOLVED', resolvedAt: { gte: start, lte: end } } }),

    // Tenant info
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, currency: true, email: true, logoUrl: true, brandPrimaryColor: true } }),
  ]);

  // Payment breakdown by method
  const paymentsBreakdown = { CASH: 0, CARD: 0, BANK_TRANSFER: 0, STRIPE: 0, OTHER: 0, PENDING: 0 };
  let roomRevenue = 0;
  for (const p of roomPayments) {
    const amt = Number(p.amount);
    paymentsBreakdown[p.method as keyof typeof paymentsBreakdown] = (paymentsBreakdown[p.method as keyof typeof paymentsBreakdown] ?? 0) + amt;
    roomRevenue += amt;
  }

  const restaurantRevenue = Number(restaurantOrders._sum.totalAmount ?? 0);
  const extrasRevenue = Number(invoiceExtras._sum.amount ?? 0);
  const totalRevenue = roomRevenue + restaurantRevenue + extrasRevenue;

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
    revenue: {
      rooms: roomRevenue,
      restaurant: restaurantRevenue,
      extras: extrasRevenue,
      total: totalRevenue,
    },
    payments: {
      cash: paymentsBreakdown.CASH,
      card: paymentsBreakdown.CARD + paymentsBreakdown.STRIPE,
      bankTransfer: paymentsBreakdown.BANK_TRANSFER,
      other: paymentsBreakdown.OTHER,
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

  <!-- Revenue -->
  <tr><td style="padding:16px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">💰 Revenue</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Room Revenue', fmt(report.revenue.rooms, cur))}
      ${row('Restaurant', fmt(report.revenue.restaurant, cur))}
      ${row('Extras', fmt(report.revenue.extras, cur))}
      ${row('Total Revenue', fmt(report.revenue.total, cur), true)}
    </table>
  </td></tr>

  <!-- Payments -->
  <tr><td style="padding:16px 28px 0">
    <h3 style="margin:0 0 10px;color:#1a1a1a;font-size:14px;text-transform:uppercase;letter-spacing:.5px">💳 Payments</h3>
    <table width="100%" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Cash', fmt(report.payments.cash, cur))}
      ${row('Card / Online', fmt(report.payments.card, cur))}
      ${row('Bank Transfer', fmt(report.payments.bankTransfer, cur))}
    </table>
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

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/reports/daily?date=YYYY-MM-DD
  app.get('/daily', {
    schema: { tags: ['reports'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { date } = request.query as { date?: string };
      const dateStr = date ?? new Date().toISOString().slice(0, 10);

      const report = await buildDailyReport(tenantId, dateStr);
      return ok(reply, report);
    },
  });

  // POST /api/reports/daily/email?date=YYYY-MM-DD
  app.post('/daily/email', {
    schema: { tags: ['reports'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { date } = request.query as { date?: string };
      const { toEmail } = request.body as { toEmail?: string };
      const dateStr = date ?? new Date().toISOString().slice(0, 10);

      const report = await buildDailyReport(tenantId, dateStr);

      const tenant = await prisma.tenant.findUnique({
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

      return ok(reply, { sent: true, to: recipientEmail, date: dateStr });
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import dayjs from 'dayjs';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: {
      tags: ['dashboard'],
      summary: 'Get dashboard statistics',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const today = dayjs().startOf('day').toDate();
      const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();
      const monthStart = dayjs().startOf('month').toDate();
      const lastMonthStart = dayjs().subtract(1, 'month').startOf('month').toDate();
      const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

      const [
        totalRooms,
        availableRooms,
        occupiedRooms,
        todayCheckIns,
        todayCheckOuts,
        activeBookings,
        openTickets,
        monthRevenue,
        lastMonthRevenue,
        recentBookings,
        lowInventory,
        pendingHousekeeping,
        openMaintenance,
      ] = await Promise.all([
        prisma.room.count({ where: { tenantId, isActive: true } }),
        prisma.room.count({ where: { tenantId, status: 'AVAILABLE', isActive: true } }),
        prisma.room.count({ where: { tenantId, status: 'OCCUPIED', isActive: true } }),
        prisma.booking.count({ where: { tenantId, checkIn: { gte: today, lt: tomorrow }, status: { in: ['CONFIRMED', 'PENDING'] } } }),
        prisma.booking.count({ where: { tenantId, checkOut: { gte: today, lt: tomorrow }, status: 'CHECKED_IN' } }),
        prisma.booking.count({ where: { tenantId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
        prisma.supportTicket.count({ where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.payment.aggregate({ where: { tenantId, processedAt: { gte: monthStart }, status: 'PAID' }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { tenantId, processedAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: 'PAID' }, _sum: { amount: true } }),
        prisma.booking.findMany({
          where: { tenantId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { guest: { select: { firstName: true, lastName: true } }, room: { select: { name: true, number: true } } },
        }),
        prisma.inventoryItem.findMany({
          where: { tenantId },
          take: 5,
        }),
        prisma.housekeepingTask.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { lte: tomorrow } } }),
        prisma.maintenanceTicket.count({ where: { tenantId, status: { not: 'RESOLVED' } } }),
      ]);

      const monthlyRevenue = Number(monthRevenue._sum.amount || 0);
      const lastMonthlyRevenue = Number(lastMonthRevenue._sum.amount || 0);
      const revenueGrowth = lastMonthlyRevenue > 0
        ? ((monthlyRevenue - lastMonthlyRevenue) / lastMonthlyRevenue) * 100
        : 0;

      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      const lowStockItems = lowInventory.filter(
        (item) => Number(item.currentStock) <= Number(item.minimumStock)
      );

      return ok({
        stats: {
          totalRooms,
          availableRooms,
          occupiedRooms,
          occupancyRate: Math.round(occupancyRate * 10) / 10,
          todayCheckIns,
          todayCheckOuts,
          activeBookings,
          openTickets,
          monthlyRevenue,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10,
          pendingHousekeeping,
          openMaintenance,
        },
        recentBookings,
        lowStockAlerts: lowStockItems,
      });
    },
  });

  // Revenue chart data
  app.get('/revenue', {
    schema: {
      tags: ['dashboard'],
      summary: 'Get revenue chart data (last 12 months)',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;

      const months = Array.from({ length: 12 }, (_, i) => {
        const d = dayjs().subtract(11 - i, 'month');
        return { label: d.format('MMM YYYY'), start: d.startOf('month').toDate(), end: d.endOf('month').toDate() };
      });

      const revenueData = await Promise.all(
        months.map(async ({ label, start, end }) => {
          const agg = await prisma.payment.aggregate({
            where: { tenantId, processedAt: { gte: start, lte: end }, status: 'PAID' },
            _sum: { amount: true },
          });
          return { month: label, revenue: Number(agg._sum.amount || 0) };
        }),
      );

      return ok(revenueData);
    },
  });

  // Occupancy chart data
  app.get('/occupancy', {
    schema: {
      tags: ['dashboard'],
      summary: 'Get occupancy data (last 30 days)',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const totalRooms = await prisma.room.count({ where: { tenantId, isActive: true } });

      const days = Array.from({ length: 30 }, (_, i) => {
        const d = dayjs().subtract(29 - i, 'day');
        return { label: d.format('MMM D'), date: d.toDate() };
      });

      const occupancyData = await Promise.all(
        days.map(async ({ label, date }) => {
          const occupied = await prisma.booking.count({
            where: {
              tenantId,
              checkIn: { lte: date },
              checkOut: { gt: date },
              status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
            },
          });
          return {
            date: label,
            occupied,
            rate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
          };
        }),
      );

      return ok(occupancyData);
    },
  });

  // ── GET /api/dashboard/analytics — full analytics for owner ───────────────
  app.get('/analytics', {
    schema: {
      tags: ['dashboard'],
      summary: 'Full owner analytics — KPIs, revenue breakdown, guest stats, booking insights',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;

      const now    = dayjs();
      const ytdStart      = now.startOf('year').toDate();
      const monthStart    = now.startOf('month').toDate();
      const lastMoStart   = now.subtract(1, 'month').startOf('month').toDate();
      const lastMoEnd     = now.subtract(1, 'month').endOf('month').toDate();
      const prev7Start    = now.subtract(7, 'day').toDate();
      const prev30Start   = now.subtract(30, 'day').toDate();
      const prev90Start   = now.subtract(90, 'day').toDate();

      const [
        ytdRevenue,
        mtdRevenue,
        lastMoRevenue,
        totalBookings30,
        totalBookings30Prev,       // prev 30d for comparison
        confirmedBookings,
        totalRooms,
        occupiedRooms,
        allPaidPayments90,
        guestCount,
        returningGuests,
        bookingsBySource,
        allBookings90,
        revenueByMonth,            // last 12 months
      ] = await Promise.all([
        // YTD revenue
        prisma.payment.aggregate({ where: { tenantId, status: 'PAID', processedAt: { gte: ytdStart } }, _sum: { amount: true } }),
        // MTD revenue
        prisma.payment.aggregate({ where: { tenantId, status: 'PAID', processedAt: { gte: monthStart } }, _sum: { amount: true } }),
        // Last month revenue
        prisma.payment.aggregate({ where: { tenantId, status: 'PAID', processedAt: { gte: lastMoStart, lte: lastMoEnd } }, _sum: { amount: true } }),
        // Bookings last 30d
        prisma.booking.count({ where: { tenantId, createdAt: { gte: prev30Start } } }),
        // Bookings 30-60d ago
        prisma.booking.count({ where: { tenantId, createdAt: { gte: dayjs().subtract(60, 'day').toDate(), lt: prev30Start } } }),
        // Active confirmed/checked-in
        prisma.booking.count({ where: { tenantId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } } }),
        // Total rooms
        prisma.room.count({ where: { tenantId, isActive: true } }),
        // Currently occupied
        prisma.room.count({ where: { tenantId, status: 'OCCUPIED' } }),
        // All paid payments last 90d (for ADR/RevPAR)
        prisma.payment.findMany({
          where: { tenantId, status: 'PAID', processedAt: { gte: prev90Start } },
          select: { amount: true },
        }),
        // Total unique guests
        prisma.guest.count({ where: { tenantId } }),
        // Returning guests (more than 1 booking)
        prisma.guest.count({
          where: {
            tenantId,
            bookings: { some: {} },
          },
        }),
        // Bookings by source last 90d
        prisma.booking.groupBy({
          by: ['source'],
          where: { tenantId, createdAt: { gte: prev90Start } },
          _count: { source: true },
        }),
        // All bookings last 90d with room type (for room breakdown)
        prisma.booking.findMany({
          where: { tenantId, createdAt: { gte: prev90Start }, status: { not: 'CANCELLED' } },
          select: { totalAmount: true, checkIn: true, checkOut: true, room: { select: { type: true } } },
        }),
        // Last 12 months revenue
        Promise.all(
          Array.from({ length: 12 }, (_, i) => {
            const d = dayjs().subtract(11 - i, 'month');
            return prisma.payment.aggregate({
              where: { tenantId, status: 'PAID', processedAt: { gte: d.startOf('month').toDate(), lte: d.endOf('month').toDate() } },
              _sum: { amount: true },
            }).then((agg) => ({ month: d.format('MMM YY'), revenue: Number(agg._sum.amount || 0) }));
          })
        ),
      ]);

      // ── Expense data ──────────────────────────────────────────────────────────
      const [mtdExpensesAgg, prevMoExpensesAgg, expenseByCategory] = await Promise.all([
        prisma.expense.aggregate({ where: { tenantId, date: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { tenantId, date: { gte: lastMoStart, lte: lastMoEnd } }, _sum: { amount: true } }),
        prisma.expense.groupBy({
          by: ['category'],
          where: { tenantId, date: { gte: monthStart } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
        }),
      ]);
      const mtdExpenses  = Number(mtdExpensesAgg._sum.amount ?? 0);
      const prevMoExpenses = Number(prevMoExpensesAgg._sum.amount ?? 0);
      const expenseGrowth  = prevMoExpenses > 0
        ? Math.round(((mtdExpenses - prevMoExpenses) / prevMoExpenses) * 10) / 10 : 0;

      // ── KPIs ──────────────────────────────────────────────────────────────
      const ytdRev = Number(ytdRevenue._sum.amount || 0);
      const mtdRev = Number(mtdRevenue._sum.amount || 0);
      const lastMoRev = Number(lastMoRevenue._sum.amount || 0);
      const revenueGrowth = lastMoRev > 0 ? Math.round(((mtdRev - lastMoRev) / lastMoRev) * 1000) / 10 : 0;

      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0;
      const bookingGrowth = totalBookings30Prev > 0
        ? Math.round(((totalBookings30 - totalBookings30Prev) / totalBookings30Prev) * 1000) / 10 : 0;

      // ADR (average daily rate from recent bookings)
      let adr = 0;
      let revpar = 0;
      if (allBookings90.length > 0) {
        const totalNights = allBookings90.reduce((s, b) => {
          const nights = dayjs(b.checkOut).diff(dayjs(b.checkIn), 'day');
          return s + Math.max(nights, 1);
        }, 0);
        const totalRev = allBookings90.reduce((s, b) => s + Number(b.totalAmount), 0);
        adr = totalNights > 0 ? Math.round(totalRev / totalNights) : 0;
        const days90 = 90;
        revpar = totalRooms > 0 ? Math.round(totalRev / (totalRooms * days90)) : 0;
      }

      // ── Room type breakdown ────────────────────────────────────────────────
      const roomTypeMap: Record<string, { bookings: number; revenue: number }> = {};
      for (const b of allBookings90) {
        const t = b.room.type;
        if (!roomTypeMap[t]) roomTypeMap[t] = { bookings: 0, revenue: 0 };
        roomTypeMap[t].bookings += 1;
        roomTypeMap[t].revenue += Number(b.totalAmount);
      }
      const byRoomType = Object.entries(roomTypeMap)
        .map(([type, d]) => ({ type, bookings: d.bookings, revenue: Math.round(d.revenue) }))
        .sort((a, b) => b.revenue - a.revenue);

      // ── Booking sources ────────────────────────────────────────────────────
      const bySources = bookingsBySource.map((r) => ({
        source: r.source || 'DIRECT',
        count: r._count.source,
      })).sort((a, b) => b.count - a.count);

      // ── Guest stats ────────────────────────────────────────────────────────
      const newGuests = await prisma.guest.count({ where: { tenantId, createdAt: { gte: prev30Start } } });
      const nationalities = await prisma.guest.groupBy({
        by: ['nationality'],
        where: { tenantId, nationality: { not: null } },
        _count: { nationality: true },
        orderBy: { _count: { nationality: 'desc' } },
        take: 8,
      });
      const topNationalities = nationalities.map((n) => ({
        country: n.nationality ?? 'Unknown',
        count: n._count.nationality,
      }));

      // ── Avg stay length (last 90d completed bookings) ─────────────────────
      const completedBookings = allBookings90.filter((b) => b.checkIn && b.checkOut);
      const avgStayDays = completedBookings.length > 0
        ? Math.round(completedBookings.reduce((s, b) => s + Math.max(dayjs(b.checkOut).diff(dayjs(b.checkIn), 'day'), 1), 0) / completedBookings.length * 10) / 10
        : 0;

      const profitMarginMTD = mtdRev > 0
        ? Math.round(((mtdRev - mtdExpenses) / mtdRev) * 1000) / 10 : 0;

      return ok({
        kpis: {
          ytdRevenue: ytdRev,
          mtdRevenue: mtdRev,
          revenueGrowth,
          occupancyRate,
          adr,
          revpar,
          totalBookings30,
          bookingGrowth,
          confirmedBookings,
          totalGuests: guestCount,
          newGuests30: newGuests,
          avgStayDays,
          // Expenses
          mtdExpenses,
          expenseGrowth,
          profitMarginMTD,
        },
        revenueByMonth,
        byRoomType,
        bySources,
        topNationalities,
        expenseByCategory: expenseByCategory.map(c => ({
          category: c.category,
          amount: Number(c._sum.amount ?? 0),
        })),
      });
    },
  });

  // ── GET /api/dashboard/today — today's arrivals + departures ─────────────
  app.get('/today', {
    schema: { tags: ['dashboard'], summary: "Today's arrivals and departures", security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const [arrivals, departures, inHouse] = await Promise.all([
        // Arriving today (checkIn = today, status CONFIRMED or CHECKED_IN)
        prisma.booking.findMany({
          where: {
            tenantId,
            checkIn: { gte: todayStart, lte: todayEnd },
            status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          },
          include: {
            guest: { select: { firstName: true, lastName: true, phone: true } },
            room:  { select: { number: true, name: true, type: true } },
          },
          orderBy: { checkIn: 'asc' },
        }),
        // Departing today (checkOut = today, still checked in)
        prisma.booking.findMany({
          where: {
            tenantId,
            checkOut: { gte: todayStart, lte: todayEnd },
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          },
          include: {
            guest: { select: { firstName: true, lastName: true, phone: true } },
            room:  { select: { number: true, name: true, type: true } },
          },
          orderBy: { checkOut: 'asc' },
        }),
        // Currently in-house (checked in, not yet out)
        prisma.booking.count({
          where: { tenantId, status: 'CHECKED_IN' },
        }),
      ]);

      return ok({
        arrivals: arrivals.map(b => ({
          id: b.id, confirmationNo: b.confirmationNo, status: b.status,
          checkIn: b.checkIn, checkOut: b.checkOut,
          nights: Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000),
          adults: b.adults, children: b.children,
          totalAmount: Number(b.totalAmount), paidAmount: Number(b.paidAmount),
          guest: b.guest, room: b.room,
          actualCheckIn: (b as any).actualCheckIn ?? null,
        })),
        departures: departures.map(b => ({
          id: b.id, confirmationNo: b.confirmationNo, status: b.status,
          checkIn: b.checkIn, checkOut: b.checkOut,
          nights: Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000),
          adults: b.adults, children: b.children,
          totalAmount: Number(b.totalAmount), paidAmount: Number(b.paidAmount),
          guest: b.guest, room: b.room,
          actualCheckOut: (b as any).actualCheckOut ?? null,
        })),
        summary: {
          arrivalsCount: arrivals.length,
          departuresCount: departures.length,
          inHouseCount: inHouse,
        },
      });
    },
  });
}

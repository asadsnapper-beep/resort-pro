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
}

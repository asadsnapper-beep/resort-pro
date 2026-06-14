import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

export async function frontDeskRoutes(app: FastifyInstance) {

  // GET /api/front-desk/today — arrivals, departures, in-house summary
  app.get('/today', {
    schema: { tags: ['front-desk'], summary: 'Today front desk summary', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;

      const today     = new Date();
      const todayDate = today.toISOString().split('T')[0];
      const tomorrow  = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];

      const guestSelect = {
        id: true, firstName: true, lastName: true, phone: true, email: true,
      } as const;
      const roomSelect = {
        id: true, number: true, name: true, type: true, floor: true,
      } as const;
      const bookingBase = {
        id: true, confirmationNo: true, checkIn: true, checkOut: true,
        adults: true, children: true, totalAmount: true, paidAmount: true,
        paymentStatus: true, status: true, source: true, walkIn: true,
        specialRequests: true, roomNotes: true, actualCheckIn: true, actualCheckOut: true,
      } as const;

      const [arrivals, departures, inHouse, rooms] = await Promise.all([
        // Today's arrivals: checkIn = today, status CONFIRMED or PENDING
        prisma.booking.findMany({
          where: {
            tenantId,
            checkIn: { gte: new Date(todayDate), lt: new Date(tomorrowDate) },
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          select: { ...bookingBase, guest: { select: guestSelect }, room: { select: roomSelect } },
          orderBy: { checkIn: 'asc' },
        }),

        // Today's departures: checkOut = today, status CHECKED_IN
        prisma.booking.findMany({
          where: {
            tenantId,
            checkOut: { gte: new Date(todayDate), lt: new Date(tomorrowDate) },
            status: 'CHECKED_IN',
          },
          select: { ...bookingBase, guest: { select: guestSelect }, room: { select: roomSelect } },
          orderBy: { checkOut: 'asc' },
        }),

        // Currently in-house: status CHECKED_IN
        prisma.booking.findMany({
          where: { tenantId, status: 'CHECKED_IN' },
          select: { ...bookingBase, guest: { select: guestSelect }, room: { select: roomSelect } },
          orderBy: { checkIn: 'asc' },
        }),

        // All rooms summary
        prisma.room.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, number: true, name: true, type: true, status: true, floor: true, basePrice: true },
          orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        }),
      ]);

      const roomStats = {
        total:     rooms.length,
        occupied:  rooms.filter(r => r.status === 'OCCUPIED').length,
        available: rooms.filter(r => r.status === 'AVAILABLE').length,
        cleaning:     rooms.filter(r => r.status === 'CLEANING').length,
        maintenance:  rooms.filter(r => r.status === 'MAINTENANCE').length,
      };

      const totalGuests = inHouse.reduce((s, b) => s + b.adults + b.children, 0);

      return ok({
        date:     todayDate,
        roomStats,
        totalGuests,
        arrivals: {
          count: arrivals.length,
          checkedIn: arrivals.filter(b => b.status === 'CHECKED_IN').length,
          pending:   arrivals.filter(b => b.status !== 'CHECKED_IN').length,
          bookings:  arrivals,
        },
        departures: {
          count:      departures.length,
          checkedOut: departures.filter(b => b.status === 'CHECKED_OUT').length,
          pending:    departures.filter(b => b.status === 'CHECKED_IN').length,
          bookings:   departures,
        },
        inHouse: {
          count:    inHouse.length,
          bookings: inHouse,
        },
      }, 'Front desk summary');
    },
  });

  // GET /api/front-desk/room-map — visual room grid with occupancy
  app.get('/room-map', {
    schema: { tags: ['front-desk'], summary: 'Room map with live status', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;

      const [rooms, activeBookings] = await Promise.all([
        prisma.room.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, number: true, name: true, type: true, status: true, floor: true, basePrice: true, maxOccupancy: true },
          orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        }),
        prisma.booking.findMany({
          where: { tenantId, status: { in: ['CHECKED_IN', 'CONFIRMED'] } },
          select: {
            id: true, roomId: true, status: true, checkIn: true, checkOut: true,
            adults: true, children: true, confirmationNo: true,
            guest: { select: { firstName: true, lastName: true, phone: true } },
          },
        }),
      ]);

      // Index bookings by roomId
      const bookingByRoom = new Map<string, typeof activeBookings[number]>();
      for (const b of activeBookings) bookingByRoom.set(b.roomId, b);

      // Group rooms by floor
      const floorMap = new Map<number, typeof rooms>();
      for (const room of rooms) {
        const floor = room.floor ?? 1;
        if (!floorMap.has(floor)) floorMap.set(floor, []);
        floorMap.get(floor)!.push(room);
      }

      const floors = Array.from(floorMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([floor, floorRooms]) => ({
          floor,
          rooms: floorRooms.map(room => ({
            ...room,
            booking: bookingByRoom.get(room.id) ?? null,
          })),
        }));

      return ok({ floors }, 'Room map');
    },
  });
}

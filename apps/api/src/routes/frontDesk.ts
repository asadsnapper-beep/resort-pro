import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { tenantTodayRange } from '../utils/tenant-day';

export async function frontDeskRoutes(app: FastifyInstance) {

  // GET /api/front-desk/today — arrivals, departures, in-house summary
  app.get('/today', {
    schema: { tags: ['front-desk'], summary: 'Today front desk summary', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;

      // checkIn/checkOut are `@db.Date`. Deriving the day from
      // `toISOString()` took the UTC calendar date, which in Asia/Dhaka is
      // still yesterday between midnight and 6am — handing the night shift
      // yesterday's arrival list at exactly the hours they rely on it.
      // utils/tenant-day.ts resolves the day in the resort's own timezone.
      const todayRange = tenantTodayRange();

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
        db.booking.findMany({
          where: {
            checkIn: todayRange,
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          select: { ...bookingBase, guest: { select: guestSelect }, room: { select: roomSelect } },
          orderBy: { checkIn: 'asc' },
        }),

        // Today's departures: checkOut = today, status CHECKED_IN
        db.booking.findMany({
          where: {
            checkOut: todayRange,
            status: 'CHECKED_IN',
          },
          select: { ...bookingBase, guest: { select: guestSelect }, room: { select: roomSelect } },
          orderBy: { checkOut: 'asc' },
        }),

        // Currently in-house: status CHECKED_IN
        db.booking.findMany({
          where: { status: 'CHECKED_IN' },
          select: { ...bookingBase, guest: { select: guestSelect }, room: { select: roomSelect } },
          orderBy: { checkIn: 'asc' },
        }),

        // All rooms summary
        db.room.findMany({
          where: { isActive: true },
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
        date:     todayRange.gte.toISOString().split('T')[0],
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
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;

      const [rooms, activeBookings] = await Promise.all([
        db.room.findMany({
          where: { isActive: true },
          select: { id: true, number: true, name: true, type: true, status: true, floor: true, basePrice: true, maxOccupancy: true },
          orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        }),
        db.booking.findMany({
          where: { status: { in: ['CHECKED_IN', 'CONFIRMED'] } },
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

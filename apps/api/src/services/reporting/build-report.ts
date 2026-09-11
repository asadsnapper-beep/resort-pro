/**
 * The one place a report is computed.
 *
 * Phase 1 of plan/report-periods-and-custom-range.md. It exists as a service
 * rather than living in routes/reports.ts for a concrete reason: the evening
 * dispatch job needed the same figures, could not import them from a route
 * without dragging Fastify in, and so carried its own 133-line copy — with its
 * own copy of every bug. Two implementations of "how much money came in" is one
 * too many.
 *
 * Works for any period: one day, a Monday–Sunday week, or an arbitrary
 * inclusive range. See ./period.ts for why the period is resolved in the
 * resort's timezone and why timestamp and `@db.Date` columns need different
 * bounds.
 */

import { prisma } from '@resort-pro/database';
import type { ReportPeriod } from './period';

const MS_PER_DAY = 86_400_000;

/** Whole nights of `[checkIn, checkOut)` that fall inside the period. */
function overlapNights(checkIn: Date, checkOut: Date, period: ReportPeriod): number {
  const start = Math.max(checkIn.getTime(), period.startDate.getTime());
  const end = Math.min(checkOut.getTime(), period.endDateExclusive.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / MS_PER_DAY);
}

export interface ReportTenant {
  name: string;
  currency: string;
  email: string | null;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  timezone: string;
}

export async function buildReport(tenantId: string, period: ReportPeriod) {
  // Timestamp columns want instants; `@db.Date` columns want dates.
  const inPeriod = { gte: period.startInstant, lt: period.endInstantExclusive };
  const onDates = { gte: period.startDate, lt: period.endDateExclusive };

  const [
    tenant,
    totalRooms,
    roomNightBookings,
    arrivals,
    departures,
    noShows,
    payments,
    restaurantOrders,
    invoiceExtras,
    housekeepingCompleted,
    housekeepingPending,
    maintenanceOpen,
    maintenanceResolved,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true, currency: true, email: true, logoUrl: true,
        brandPrimaryColor: true, timezone: true,
      },
    }),

    prisma.room.count({ where: { tenantId, isActive: true } }),

    // Every stay that touches the period, for the room-night count. Overlap is
    // computed per booking rather than in SQL so the rule stays readable and
    // testable; the row count here is bounded by the length of the period.
    //
    // Which stays count as selling a night: the plan leaves "planned versus
    // actual dates" open, and the choice taken here — to revisit if it proves
    // wrong — is that nights come from the stay's own calendar dates while
    // arrivals and departures come from the actual timestamps. A night is a
    // property of the booking; an arrival happened at a moment.
    //
    // PENDING is excluded along with CANCELLED and NO_SHOW: an unpaid public
    // hold blocks a room without having sold it, and those holds expire.
    prisma.booking.findMany({
      where: {
        tenantId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn: { lt: period.endDateExclusive },
        checkOut: { gt: period.startDate },
      },
      select: { checkIn: true, checkOut: true },
    }),

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

    prisma.booking.findMany({
      where: { tenantId, checkIn: onDates, status: 'CONFIRMED', actualCheckIn: null },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, name: true } },
      },
    }),

    prisma.payment.findMany({
      where: { tenantId, processedAt: inPeriod, status: 'PAID' },
      select: { amount: true, method: true },
    }),

    prisma.foodOrder.aggregate({
      where: { tenantId, createdAt: inPeriod, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true },
    }),

    prisma.invoiceExtra.aggregate({
      where: { tenantId, createdAt: inPeriod },
      _sum: { amount: true },
    }),

    prisma.housekeepingTask.count({
      where: { tenantId, status: 'COMPLETED', scheduledDate: onDates },
    }),

    // Pending is a snapshot at the end of the period, not a sum across it:
    // summing would count the same unfinished task once per day.
    prisma.housekeepingTask.count({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledDate: { lt: period.endDateExclusive },
      },
    }),

    // Open as of the end of the period, so a historical report is not coloured
    // by what has been fixed since.
    prisma.maintenanceTicket.count({
      where: {
        tenantId,
        createdAt: { lt: period.endInstantExclusive },
        OR: [{ resolvedAt: null }, { resolvedAt: { gte: period.endInstantExclusive } }],
      },
    }),

    prisma.maintenanceTicket.count({
      where: { tenantId, status: 'RESOLVED', resolvedAt: inPeriod },
    }),
  ]);

  // ── Money ─────────────────────────────────────────────────────────────────
  //
  // Two figures, never one. This was
  //   revenue.total = payments + food orders + invoice extras
  // labelled "Total Revenue" on the dashboard, in the evening email and in the
  // Telegram message. Those are not the same kind of number, and for a stay
  // whose food went on the room they are not independent either: the checkout
  // payment already contains the food, so the food was counted twice. A room at
  // 1200 with 600 of food, settled at 1800, was reported as 2400.
  const byMethod = { CASH: 0, CARD: 0, BANK_TRANSFER: 0, STRIPE: 0, OTHER: 0, PENDING: 0 };
  let cashCollectedTotal = 0;
  for (const payment of payments) {
    const amount = Number(payment.amount);
    const key = payment.method as keyof typeof byMethod;
    byMethod[key] = (byMethod[key] ?? 0) + amount;
    cashCollectedTotal += amount;
  }

  const restaurantCharges = Number(restaurantOrders._sum.totalAmount ?? 0);
  const extrasCharges = Number(invoiceExtras._sum.amount ?? 0);

  // ── Occupancy ─────────────────────────────────────────────────────────────
  //
  // Room-nights, not a count of rooms whose status says OCCUPIED right now.
  // Live status would report a room occupied today as occupied on all six days
  // of a 20–25 range, and would answer a question about last week with facts
  // about this minute.
  const availableRoomNights = totalRooms * period.dayCount;
  const occupiedRoomNights = roomNightBookings.reduce(
    (sum, booking) => sum + overlapNights(booking.checkIn, booking.checkOut, period),
    0,
  );
  const rate = availableRoomNights > 0
    ? Math.round((occupiedRoomNights / availableRoomNights) * 1000) / 10
    : 0;

  const nightsOf = (checkIn: Date, checkOut: Date) =>
    Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY));

  return {
    /** Kept for clients that still read a single date; equals `period.to`. */
    date: period.to,
    period: {
      kind: period.kind, from: period.from, to: period.to,
      timezone: period.timezone, dayCount: period.dayCount,
    },
    tenant: {
      name: tenant?.name ?? '',
      currency: tenant?.currency ?? 'USD',
      email: tenant?.email ?? null,
      logoUrl: tenant?.logoUrl ?? null,
      brandPrimaryColor: tenant?.brandPrimaryColor ?? null,
      timezone: period.timezone,
    },
    occupancy: { totalRooms, availableRoomNights, occupiedRoomNights, rate },
    arrivals: arrivals.map((b) => ({
      bookingId: b.id,
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
      nights: nightsOf(b.checkIn, b.checkOut),
      checkOut: b.checkOut.toISOString().slice(0, 10),
      status: b.status,
    })),
    departures: departures.map((b) => ({
      bookingId: b.id,
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
      totalBill: Number(b.totalAmount),
      paidAmount: b.payments.reduce((s, p) => s + Number(p.amount), 0),
      status: b.status,
    })),
    noShows: noShows.map((b) => ({
      bookingId: b.id,
      guestName: `${b.guest.firstName} ${b.guest.lastName}`,
      room: `${b.room.name} #${b.room.number}`,
    })),
    financial: {
      /**
       * Money that arrived, from `Payment` rows alone. The method figures sum
       * to the total by construction.
       *
       * Known incomplete, and said out loud rather than papered over: a
       * restaurant order settled at the counter creates no `Payment` row —
       * marking it paid only flips `FoodOrder.paymentStatus` — and nothing
       * records when that happened, so till money cannot be placed in a period
       * at all. Closing it needs a `paidAt` on FoodOrder.
       */
      cashCollected: { byMethod, total: cashCollectedTotal },
      /**
       * Value added to guests' bills in the period. Not money: some is still
       * owed, and some was paid in a different period.
       *
       * `room` is null on purpose. Room charges accrue per night, and whether
       * to attribute them by planned or actual dates is still open in the plan.
       * A wrong room figure would be worse than none.
       */
      chargesPosted: { restaurant: restaurantCharges, extras: extrasCharges, room: null },
    },
    housekeeping: {
      completed: housekeepingCompleted,
      /** Still unfinished as of the end of the period, not a sum over it. */
      pendingAtEnd: housekeepingPending,
    },
    maintenance: {
      /** Open as of the end of the period. */
      openAtEnd: maintenanceOpen,
      resolved: maintenanceResolved,
    },
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

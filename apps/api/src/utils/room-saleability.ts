import type { Prisma } from '@resort-pro/database';
import { tenantToday } from './tenant-day';

/** `Room.status`, taken from the generated client rather than re-typed here. */
type RoomStatus = Extract<NonNullable<Prisma.RoomWhereInput['status']>, string>;

/** Out of order with no end date, so never on sale. */
const OUT_OF_ORDER: RoomStatus = 'MAINTENANCE';

/** True of the room *this moment*, so only today's stay is affected. */
const HELD_RIGHT_NOW: RoomStatus[] = ['CLEANING', 'OCCUPIED', 'RESERVED'];

/**
 * Which rooms may be offered for a stay — one definition, shared by every
 * channel that sells a room.
 *
 * Two different things were being conflated. `Room.status` says what is true
 * of the room *right now*: it is being cleaned, a guest is in it, a group has
 * it held. A `Booking` row says which *dates* are taken. Availability read
 * only half of that — it excluded `MAINTENANCE` and nothing else — so a room
 * stamped `CLEANING` by a checkout an hour ago was still offered to the next
 * walk-in (Room Management QA 2026-10-28, RM-003).
 *
 * Demanding `AVAILABLE` outright would have been the wrong correction. A room
 * dirty this afternoon is clean tomorrow; and a group booking writes a real
 * CONFIRMED booking row for its dates *and* stamps the room `RESERVED`
 * (groupBookings.ts), so treating `RESERVED` as a standing block would take
 * that room off sale on every other date too, until someone noticed and reset
 * it by hand. Either way the resort would lose nights it could have sold.
 *
 * So: **status decides today, bookings decide the calendar.** Which dates are
 * taken stays the booking-overlap check each caller already does; this module
 * deliberately says nothing about it.
 *
 * `timezone` is the resort's own (`Tenant.timezone`); it decides where the
 * line between today and tomorrow falls, and defaults the way the rest of
 * tenant-day.ts does.
 */
export function unsellableStatusesFor(checkIn: Date, timezone?: string): RoomStatus[] {
  return startsTodayOrEarlier(checkIn, timezone)
    ? [OUT_OF_ORDER, ...HELD_RIGHT_NOW]
    : [OUT_OF_ORDER];
}

/** The same rule as a `where` fragment, for a query that selects rooms to sell. */
export function sellableRoomWhere(checkIn: Date, timezone?: string): Prisma.RoomWhereInput {
  return {
    isActive: true,
    status: { notIn: unsellableStatusesFor(checkIn, timezone) },
  };
}

/** A stay starting on the resort's current date, or one already under way. */
function startsTodayOrEarlier(checkIn: Date, timezone?: string): boolean {
  // `checkIn` is a calendar date, not an instant: `Booking.checkIn` is
  // `@db.Date`, and the query strings that produce it ("2026-11-01") parse to
  // midnight UTC. `tenantToday` hands back the resort's date in that same
  // shape, so the two compare directly.
  const day = Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate());
  return day <= tenantToday(timezone).getTime();
}

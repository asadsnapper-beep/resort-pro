import type { Prisma } from '@resort-pro/database';
import { tenantToday } from './tenant-day';

/**
 * What a room's status is allowed to say, decided from the work open on it.
 *
 * `Room.status` was written directly by five places that never consulted each
 * other: the room endpoint, maintenance ticket creation, maintenance
 * resolution, housekeeping task transitions, and the booking lifecycle. So the
 * dashboard could claim a room was ready while nobody had fixed it, or hide a
 * room from sale with no work order anyone could act on.
 * (Room Management QA 2026-10-28, RM-004.)
 *
 * The status is now *derived* rather than asserted. One question — what is
 * actually blocking this room right now — answered in one place, and the
 * first blocker that holds decides:
 *
 *   1. a guest checked into it      → OCCUPIED
 *   2. an unresolved maintenance ticket → MAINTENANCE
 *   3. a between-stay clean in progress → CLEANING
 *   4. a booking that covers today      → RESERVED
 *   5. nothing                          → AVAILABLE
 *
 * The order is the order of who is standing in the room. A guest outranks
 * everything because they are physically there and RM-001 already made that
 * the only truth a room with a guest may tell; the fault is still logged and
 * still visible in the maintenance list, and the next recompute after the room
 * empties is the one that takes it off sale. Maintenance outranks cleaning
 * because a clean finishes on its own and a broken air conditioner does not.
 *
 * Tier 4 is why this does not quietly undo a hold. A group booking stamps its
 * rooms RESERVED and writes real booking rows for the same dates; a recompute
 * that knew only about tickets and cleans would answer AVAILABLE and throw the
 * label away. Deriving it from the booking rows instead means the hold is
 * stated by the thing that actually holds it — the same split
 * utils/room-saleability.ts relies on: **status describes today, bookings
 * describe the calendar.** A booking further out does not change the status,
 * because it does not stop the room being sold tonight.
 */

/** `Room.status`, taken from the generated client rather than re-typed here. */
export type RoomStatus = Extract<NonNullable<Prisma.RoomWhereInput['status']>, string>;

/**
 * Cleans done between stays — the only ones that say anything about whether
 * the room can be handed to somebody else. A DAILY or TURNDOWN clean happens
 * around a guest who is still in residence.
 */
export const BETWEEN_STAY_TYPES = ['CHECKOUT', 'DEEP_CLEAN', 'CHECKIN'] as const;

/** A machine-readable reason a room cannot be declared ready. */
export type RoomBlockerCode =
  | 'ROOM_HAS_CHECKED_IN_GUEST'
  | 'ROOM_HAS_OPEN_MAINTENANCE'
  | 'ROOM_IS_BEING_CLEANED'
  | 'ROOM_IS_HELD_TODAY';

export type RoomBlocker = {
  code: RoomBlockerCode;
  /** The status the room must have while this blocker holds. */
  status: RoomStatus;
  /** Said to whoever tried to contradict it, naming what to do instead. */
  error: string;
};

/**
 * The slice of the Prisma client this needs, so it can be handed either the
 * tenant-scoped client or a transaction without either having to pretend to be
 * the other.
 */
export type RoomStateClient = {
  booking: {
    findFirst(args: unknown): Promise<unknown>;
  };
  maintenanceTicket: {
    findFirst(args: unknown): Promise<unknown>;
  };
  housekeepingTask: {
    findFirst(args: unknown): Promise<unknown>;
  };
  room: {
    update(args: unknown): Promise<unknown>;
  };
};

type CheckedInBooking = {
  confirmationNo: string;
  guest: { firstName: string; lastName: string };
};

/**
 * What is standing in the way of this room right now, or null if nothing is.
 *
 * `roomNumber` only ever reaches the message, so a caller that has the room
 * loaded should pass it; without one the messages say "This room".
 */
export async function roomBlocker(
  client: RoomStateClient,
  args: { tenantId: string; roomId: string; timezone?: string; roomNumber?: string },
): Promise<RoomBlocker | null> {
  const { tenantId, roomId, timezone, roomNumber } = args;
  const room = roomNumber ? `Room ${roomNumber}` : 'This room';

  const checkedIn = (await client.booking.findFirst({
    where: { tenantId, roomId, status: 'CHECKED_IN' },
    select: {
      confirmationNo: true,
      guest: { select: { firstName: true, lastName: true } },
    },
  })) as CheckedInBooking | null;
  if (checkedIn) {
    const guest = `${checkedIn.guest.firstName} ${checkedIn.guest.lastName}`.trim();
    return {
      code: 'ROOM_HAS_CHECKED_IN_GUEST',
      status: 'OCCUPIED',
      error:
        `${room} has a guest checked in (${guest}, booking ${checkedIn.confirmationNo}). ` +
        `Check them out before changing the room's status.`,
    };
  }

  const ticket = await client.maintenanceTicket.findFirst({
    where: { tenantId, roomId, status: { not: 'RESOLVED' } },
    select: { description: true },
  }) as { description: string } | null;
  if (ticket) {
    return {
      code: 'ROOM_HAS_OPEN_MAINTENANCE',
      status: 'MAINTENANCE',
      error:
        `${room} has maintenance still open (${ticket.description}). ` +
        `Resolve the ticket to put the room back on sale.`,
    };
  }

  const cleaning = await client.housekeepingTask.findFirst({
    where: {
      tenantId,
      roomId,
      status: 'IN_PROGRESS',
      type: { in: [...BETWEEN_STAY_TYPES] },
    },
    select: { id: true },
  });
  if (cleaning) {
    return {
      code: 'ROOM_IS_BEING_CLEANED',
      status: 'CLEANING',
      error:
        `${room} is still being cleaned. Complete the housekeeping task to put ` +
        `the room back on sale.`,
    };
  }

  // A stay that covers today. `checkIn`/`checkOut` are `@db.Date`, so this is
  // the resort's own calendar date, not the server's — see utils/tenant-day.ts.
  const today = tenantToday(timezone);
  const held = await client.booking.findFirst({
    where: {
      tenantId,
      roomId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      checkIn:  { lte: today },
      checkOut: { gt: today },
    },
    select: { confirmationNo: true },
  }) as { confirmationNo: string } | null;
  if (held) {
    return {
      code: 'ROOM_IS_HELD_TODAY',
      status: 'RESERVED',
      error:
        `${room} is held for booking ${held.confirmationNo} today. ` +
        `Cancel or move that booking to free the room.`,
    };
  }

  return null;
}

/**
 * Write the status the room's blockers say it has, and return it.
 *
 * Call this after anything that can add or clear a blocker — a ticket opened
 * or resolved, a clean started or finished, a guest checked in or out. Pass a
 * transaction client when the blocker was changed in one, so the status cannot
 * be computed from a world that has already moved on.
 */
export async function recomputeRoomStatus(
  client: RoomStateClient,
  args: { tenantId: string; roomId: string; timezone?: string },
): Promise<RoomStatus> {
  const blocker = await roomBlocker(client, args);
  const status: RoomStatus = blocker?.status ?? 'AVAILABLE';
  await client.room.update({ where: { id: args.roomId }, data: { status } });
  return status;
}

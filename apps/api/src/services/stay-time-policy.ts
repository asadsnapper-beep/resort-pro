/**
 * Early check-in and late checkout — availability first, then price.
 *
 * A room that is not clean cannot be given at any price. So this asks whether
 * the room can be handed over at all before it works out what it would cost,
 * and when the answer is no it returns no price at all: a receptionist told
 * only "৳3,187" will promise a room that is being cleaned.
 *
 * Implements plan/early-checkin-late-checkout.md §2–§5.
 */
import { prisma, Prisma } from '@resort-pro/database';
import { calculateNights } from '../utils/booking';
import { startOfTenantDay, tenantWallMinutes } from '../utils/tenant-day';
import { round2 } from './billing';

export type StayTimeKind = 'EARLY_CHECKIN' | 'LATE_CHECKOUT';
export type PolicyBand = 'FREE' | 'HALF' | 'FULL';

export type StayTimeBlocker = {
  kind:
    | 'ROOM_BEING_CLEANED'
    | 'ROOM_OCCUPIED'
    | 'ROOM_UNAVAILABLE'
    | 'HOUSEKEEPING_OPEN'
    | 'OVERLAPPING_BOOKING'
    | 'PREVIOUS_GUEST_PRESENT'
    | 'ARRIVAL_TODAY';
  detail: string;
};

export type StayTimeQuote = {
  kind: StayTimeKind;
  requestedFor: Date;
  /** The zone every time in this quote was read in — the resort's own. */
  timezone: string;
  /** Whether the room can be handed over at that time at all. */
  available: boolean;
  blockers: StayTimeBlocker[];
  /** False when the resort has not turned the policy on: context, no fee. */
  policyEnabled: boolean;
  /** True when the requested time is inside normal hours — nothing to grant. */
  withinNormalHours: boolean;
  /** null whenever no fee may be proposed: unavailable, or policy off. */
  band: PolicyBand | null;
  quotedFee: number;
  chargeBasis: 'EFFECTIVE' | 'BASE';
  nightlyRate: number;
  /** Granting anyway is a decision outside policy, and needs a manager. */
  requiresOverride: boolean;
};

/** "14:00" → 840. Invalid or missing values fall back rather than throw. */
export function minutesOfDay(wallClock: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(wallClock?.trim() ?? '');
  if (!m) return fallback;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

const BLOCKING_ROOM_STATUS: Record<string, StayTimeBlocker> = {
  CLEANING: { kind: 'ROOM_BEING_CLEANED', detail: 'The room is being cleaned' },
  OCCUPIED: { kind: 'ROOM_OCCUPIED', detail: 'The room is still occupied' },
  MAINTENANCE: { kind: 'ROOM_UNAVAILABLE', detail: 'The room is out of service' },
};

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * What the desk may offer for `bookingId` at `at`.
 *
 * `tenantId` is passed rather than inferred because a transaction hands back an
 * unextended client, where tenant scoping does not apply.
 */
export async function quoteStayTime(
  tenantId: string,
  bookingId: string,
  input: { kind: StayTimeKind; at: Date },
  client: Client = prisma,
): Promise<StayTimeQuote> {
  const booking = await client.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: {
      room: { select: { id: true, number: true, status: true, basePrice: true } },
      tenant: { select: { timezone: true, checkInTime: true, checkOutTime: true } },
    },
  });
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  }

  const timezone = booking.tenant.timezone ?? 'Asia/Dhaka';
  const policy = await client.stayTimePolicy.findFirst({ where: { tenantId } });
  const requestedMinutes = tenantWallMinutes(input.at, timezone);
  const day = startOfTenantDay(input.at, timezone);

  const blockers = input.kind === 'EARLY_CHECKIN'
    ? await earlyCheckInBlockers(client, tenantId, booking, day)
    : await lateCheckOutBlockers(client, tenantId, booking, day, requestedMinutes, timezone);

  const checkInMinutes = minutesOfDay(booking.tenant.checkInTime, 14 * 60);
  const checkOutMinutes = minutesOfDay(booking.tenant.checkOutTime, 11 * 60);
  const withinNormalHours = input.kind === 'EARLY_CHECKIN'
    ? requestedMinutes >= checkInMinutes
    : requestedMinutes <= checkOutMinutes;

  const chargeBasis = (policy?.chargeBasis === 'BASE' ? 'BASE' : 'EFFECTIVE') as 'EFFECTIVE' | 'BASE';
  const nights = Math.max(1, calculateNights(booking.checkIn, booking.checkOut));
  const nightlyRate = round2(
    chargeBasis === 'BASE'
      ? Number(booking.room.basePrice)
      : Number(booking.totalAmount) / nights,
  );

  const available = blockers.length === 0;
  const policyEnabled = policy?.enabled === true;

  // No price when the room cannot be given, and none when the resort has not
  // turned the policy on. Returning a number in either case is how a desk ends
  // up quoting for a room that is still dirty.
  if (!available || !policyEnabled) {
    return {
      kind: input.kind, requestedFor: input.at, timezone, available, blockers,
      policyEnabled, withinNormalHours,
      band: null, quotedFee: 0, chargeBasis, nightlyRate,
      requiresOverride: !available,
    };
  }

  const band = withinNormalHours
    ? 'FREE'
    : bandFor(input.kind, requestedMinutes, policy!, timezone);
  const factor = band === 'FREE' ? 0 : band === 'HALF' ? (policy!.halfRatePercent ?? 50) / 100 : 1;

  return {
    kind: input.kind, requestedFor: input.at, timezone, available, blockers,
    policyEnabled, withinNormalHours,
    band, quotedFee: round2(nightlyRate * factor), chargeBasis, nightlyRate,
    requiresOverride: false,
  };
}

function bandFor(
  kind: StayTimeKind,
  requestedMinutes: number,
  policy: { earlyFreeAfter: string; earlyHalfAfter: string; lateFreeUntil: string; lateHalfUntil: string },
  _timezone: string,
): PolicyBand {
  if (kind === 'EARLY_CHECKIN') {
    if (requestedMinutes >= minutesOfDay(policy.earlyFreeAfter, 11 * 60)) return 'FREE';
    // Arriving at 02:00 is the previous night, not a cheap morning — it falls
    // below earlyHalfAfter and is charged in full. Staff argue this one, so the
    // rule is the same single comparison rather than a special case.
    if (requestedMinutes >= minutesOfDay(policy.earlyHalfAfter, 6 * 60)) return 'HALF';
    return 'FULL';
  }
  if (requestedMinutes <= minutesOfDay(policy.lateFreeUntil, 14 * 60)) return 'FREE';
  if (requestedMinutes <= minutesOfDay(policy.lateHalfUntil, 18 * 60)) return 'HALF';
  return 'FULL';
}

type BookingForQuote = {
  id: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  room: { id: string; number: string; status: string };
};

async function earlyCheckInBlockers(
  client: Client,
  tenantId: string,
  booking: BookingForQuote,
  day: Date,
): Promise<StayTimeBlocker[]> {
  const blockers: StayTimeBlocker[] = [];

  const roomBlocker = BLOCKING_ROOM_STATUS[booking.room.status];
  if (roomBlocker) blockers.push(roomBlocker);

  const overlapping = await client.booking.findFirst({
    where: {
      tenantId, roomId: booking.roomId, id: { not: booking.id },
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      checkIn: { lte: day }, checkOut: { gt: day },
    },
    select: { confirmationNo: true },
  });
  if (overlapping) {
    blockers.push({
      kind: 'OVERLAPPING_BOOKING',
      detail: `Another stay (${overlapping.confirmationNo}) still holds the room`,
    });
  }

  // A guest whose stay ends today but who has not checked out is still in the
  // room. Their booking does not overlap the day by dates, so the check above
  // never sees them.
  const stillInRoom = await client.booking.findFirst({
    where: {
      tenantId, roomId: booking.roomId, id: { not: booking.id },
      status: 'CHECKED_IN', checkOut: { lte: day },
    },
    select: { confirmationNo: true },
  });
  if (stillInRoom) {
    blockers.push({
      kind: 'PREVIOUS_GUEST_PRESENT',
      detail: 'The previous guest has not checked out yet',
    });
  }

  const cleaning = await client.housekeepingTask.findFirst({
    where: {
      tenantId, roomId: booking.roomId,
      type: { in: ['CHECKOUT', 'CHECKIN'] },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: { id: true },
  });
  if (cleaning && !blockers.some((b) => b.kind === 'ROOM_BEING_CLEANED')) {
    blockers.push({ kind: 'HOUSEKEEPING_OPEN', detail: 'The room is not cleaned yet' });
  }

  return blockers;
}

async function lateCheckOutBlockers(
  client: Client,
  tenantId: string,
  booking: BookingForQuote,
  day: Date,
  requestedMinutes: number,
  timezone: string,
): Promise<StayTimeBlocker[]> {
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    select: { checkInTime: true },
  });
  const checkInMinutes = minutesOfDay(tenant?.checkInTime ?? '14:00', 14 * 60);

  // An arrival today only conflicts if the guest would still be in the room at
  // the hour the next one may claim it. Leaving at noon on a day with a 14:00
  // arrival takes nothing from anyone.
  if (requestedMinutes < checkInMinutes) return [];

  const arrival = await client.booking.findFirst({
    where: {
      tenantId, roomId: booking.roomId, id: { not: booking.id },
      status: { in: ['CONFIRMED', 'PENDING'] },
      checkIn: day,
    },
    select: { confirmationNo: true },
  });
  if (!arrival) return [];

  void timezone;
  return [{
    kind: 'ARRIVAL_TODAY',
    detail: `Room ${booking.room.number} has an arrival today (${arrival.confirmationNo})`,
  }];
}

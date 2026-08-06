/**
 * Expire Pending Bookings Job
 *
 * PENDING is a transient "awaiting payment" state — it's only ever set by
 * the public booking endpoint (POST /site/:slug/book), while a guest is
 * completing checkout. Every other booking-creation path (internal create,
 * walk-in, group booking, iCal import) creates bookings as CONFIRMED or
 * CHECKED_IN directly.
 *
 * If a guest abandons checkout (closes the tab before paying), that PENDING
 * row never went away on its own — nothing in the codebase ever transitions
 * it out of PENDING except a successful payment (markBookingPaid). It sat in
 * the database blocking the room indefinitely:
 *   - from the public site, past the 30-minute hold window used by the
 *     availability check in website.ts (see PENDING_HOLD_MINUTES)
 *   - from the internal dashboard too — POST /api/bookings and
 *     PATCH /:id/modify's conflict checks block on ANY 'PENDING' booking
 *     with no age limit at all.
 *
 * This job periodically cancels stale, unpaid PENDING bookings so the room
 * frees up everywhere. It intentionally never touches a PENDING booking that
 * has any recorded payment (paidAmount > 0) — that guards against wrongly
 * cancelling a booking a guest (or staff, recording cash) already paid for.
 */

import cron from 'node-cron';
import { prisma } from '@resort-pro/database';
import { PENDING_HOLD_MINUTES } from '../utils/booking';

export async function expireStalePendingBookings(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);

  const stale = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
      paidAmount: { lte: 0 },
    },
    select: { id: true, confirmationNo: true, roomId: true },
  });

  if (stale.length === 0) return 0;

  await prisma.booking.updateMany({
    where: { id: { in: stale.map((b) => b.id) } },
    data: {
      status: 'CANCELLED',
      cancellationReason: `Auto-expired — no payment received within ${PENDING_HOLD_MINUTES} minutes`,
      cancelledAt: new Date(),
      cancelledBy: 'system',
    },
  });

  console.log(
    `[expire-pending] Cancelled ${stale.length} stale unpaid booking(s): ${stale.map((b) => b.confirmationNo).join(', ')}`,
  );
  return stale.length;
}

export function startPendingExpiryCron() {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    expireStalePendingBookings().catch((err) =>
      console.error('[expire-pending] Unhandled error in cron:', err),
    );
  });

  // Also run once on startup so a freshly-restarted worker catches up
  // immediately instead of waiting up to 5 minutes for the first tick.
  expireStalePendingBookings().catch((err) =>
    console.error('[expire-pending] Startup run error:', err),
  );

  console.log(
    `[expire-pending] Cron started — checking every 5 minutes for PENDING bookings older than ${PENDING_HOLD_MINUTES} minutes`,
  );
}

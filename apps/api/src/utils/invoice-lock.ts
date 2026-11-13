import type { Prisma } from '@resort-pro/database';

/**
 * "One invoice per booking", enforced before the database has to.
 *
 * `Invoice.bookingId` is `@unique`, so the rule is never actually broken — but
 * two writers can both decide to be the one who creates it, and the loser finds
 * out by having its whole transaction aborted. Check-out was that loser: it
 * read `priorInvoice`, then branched on that read hundreds of milliseconds
 * later inside its transaction, and `autoCreateInvoice` — fired and forgotten
 * at booking time — could commit the booking's draft in between. The create
 * hit the unique constraint, the transaction rolled back, and the front desk
 * got HTTP 500 on a guest standing at the counter.
 *
 * Checking again inside the transaction narrows that window but does not close
 * it: under READ COMMITTED another insert can still land between the check and
 * the write. Catching the constraint violation and falling back to an update
 * cannot work either — in Postgres a failed statement poisons the whole
 * transaction, so the fallback would itself fail with `25P02`, and Prisma
 * exposes no savepoint to roll back to. An `upsert` is out for a reason the
 * check-out handler documents: Prisma validates the `create` branch even when
 * it takes `update`.
 *
 * So the writers are serialised instead, the same way plan quotas are
 * (`utils/entitlement.ts` → `withQuota`). Whoever holds this lock does its
 * read-and-write as one step; the other waits, and then reads a world that
 * already has the invoice in it and updates instead of creating.
 *
 * The lock is per booking, so two bookings never wait for each other, and two
 * bookings whose ids happen to hash alike occasionally will — which costs
 * milliseconds and changes no answer. Taken with `pg_advisory_xact_lock`, it is
 * released when the transaction ends, however it ends: commit, rollback, or a
 * connection dropped mid-flight. Nothing has to release it by hand.
 *
 * Waiting for it is time spent inside the waiter's own transaction, so it is
 * bounded by that transaction's timeout rather than being able to hang. A
 * check-out cannot hold the lock longer than its own transaction is allowed to
 * run, and the background draft, if it ever did give up waiting, fails the way
 * it already fails — by recording that a confirmed booking has no invoice,
 * where somebody can see it.
 *
 * Every writer that may create a booking's invoice has to take it — a lock one
 * side ignores protects nobody. Today that is `autoCreateInvoice` and the
 * check-out handler, both in `routes/bookings.ts`. The two invoice routes that
 * can also attach an invoice to a booking by hand (`POST /api/invoices` and
 * `POST /api/invoices/booking/:id`, neither of which runs in a transaction
 * yet) do not, and remain able to lose the same way.
 */

/**
 * Advisory-lock namespace. Arbitrary, but distinct from the plan quotas'
 * 21069–21071 so a check-out never queues behind a resort adding a room.
 */
const BOOKING_INVOICE_LOCK = 21072;

/**
 * Hold "the right to decide this booking's invoice" until `tx` ends.
 *
 * `$executeRaw`, not `$queryRaw`: `pg_advisory_xact_lock()` returns void, and
 * Prisma cannot deserialize a void column — it fails the request with a 500
 * rather than taking the lock.
 */
export async function lockBookingInvoice(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_INVOICE_LOCK}::int, hashtext(${bookingId})::int)`;
}

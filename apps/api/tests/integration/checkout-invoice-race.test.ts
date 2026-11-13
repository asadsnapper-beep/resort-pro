/**
 * Check-out when the booking-time draft invoice arrives late.
 *
 * `autoCreateInvoice` runs fire-and-forget at booking creation —
 * `bookings.ts` fires it with `.catch(() => {})` and answers the request
 * without waiting. It writes an `Invoice` row whose `bookingId` is `@unique`.
 *
 * The check-out handler read `priorInvoice` *before* opening its transaction,
 * because the invoice number has to be minted outside the transaction, and
 * then branched on that read hundreds of milliseconds later, inside the
 * transaction, after claiming the booking, recording the payment and pricing
 * the stay. Anything that inserted the booking's invoice in between made the
 * handler take the `create` branch against a row that now existed: unique
 * violation on `bookingId`, the whole transaction rolled back, HTTP **500**.
 *
 * That is not a tidiness problem. The guest is checked in, the bill is not
 * frozen, the room is not sent to cleaning, and the front desk is looking at
 * a server error on a guest who is standing at the counter. Three CI runs
 * failed on it — twice on `dev` with nothing related in flight — surfacing in
 * whichever test happened to book and check out quickly enough:
 *
 *   - run 42926638007 (dev, 2026-11-10) room-detail-overstay.test.ts
 *   - run 42963870848 (dev, 2026-11-11) room-status-occupied-guard.test.ts
 *   - run 43138525842 (fix/checkout-email-claim, 2026-11-12) as the first
 *
 * all with `Unique constraint failed on the fields: (bookingId)`.
 *
 * ── Why this test interposes rather than races ───────────────────────────────
 *
 * Firing a booking and a check-out at each other reproduces it only sometimes;
 * that is precisely what made it a flake nobody could pin down. So this test
 * drops the row into the window by hand, on the one seam that sits inside it:
 * the handler reads `priorInvoice`, then calls `prisma.$transaction`. Inserting
 * the draft at the moment that transaction opens is, by construction, after
 * the read and before the write — the exact interleaving CI hit, every run.
 *
 * It fails with a 500 against the unfixed handler and passes against the fixed
 * one, and it is deterministic in both directions.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma, type Prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { nextDocumentNumber } from '../../src/utils/sequence';
import { lockBookingInvoice } from '../../src/utils/invoice-lock';
import { autoCreateInvoice } from '../../src/routes/bookings';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `checkout-race-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let guestId: string;
const rooms: string[] = [];
let roomCursor = 0;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const nextRoom = () => rooms[roomCursor++]!;

/** A guest who is in the room and has paid, with no invoice of any kind yet. */
async function checkedInStay(day: number, total = 8000) {
  const d = (n: number) => new Date(`2029-03-${String(n).padStart(2, '0')}`);
  return prisma.booking.create({
    data: {
      tenantId, roomId: nextRoom(), guestId,
      checkIn: d(day), checkOut: d(day + 1),
      totalAmount: total, paidAmount: total,
      status: 'CHECKED_IN', actualCheckIn: new Date(),
      confirmationNo: `RACE-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

/**
 * What `autoCreateInvoice` leaves behind: a DRAFT priced from the booking as
 * it stood on confirmation day, holding an invoice number of its own.
 */
async function landBookingTimeDraft(
  bookingId: string,
  total: number,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.invoice.create({
    data: {
      invoiceNumber: await nextDocumentNumber(tenantId, slug, 'INV'),
      tenantId, bookingId,
      guestName: 'Race Guest',
      status: 'DRAFT',
      subtotal: total, taxRate: 0, taxAmount: 0, total,
      items: {
        create: [{
          description: 'Race Room — 1 night', category: 'ROOM' as never,
          quantity: 1, unitPrice: total, total,
          sourceType: 'ROOM', sourceId: bookingId,
        }],
      },
    },
  });
}

const checkOut = (id: string) =>
  app.inject({ method: 'PATCH', url: `/api/bookings/${id}/check-out`, headers: auth(), payload: {} });

/**
 * Run `checkOut` with `write` committing at the instant the handler's
 * transaction opens — after it has read `priorInvoice`, before it writes the
 * invoice. The original `$transaction` is captured before the spy replaces it,
 * so the real transaction still runs.
 */
async function checkOutWithWriteInsideTheWindow(bookingId: string, write: () => Promise<unknown>) {
  const original = prisma.$transaction.bind(prisma) as typeof prisma.$transaction;
  let fired = false;
  const spy = vi
    .spyOn(prisma, '$transaction')
    .mockImplementation((...args: Parameters<typeof prisma.$transaction>) => {
      if (fired) return original(...(args as [never]));
      fired = true;
      return (async () => {
        await write();
        return original(...(args as [never]));
      })() as ReturnType<typeof prisma.$transaction>;
    });
  try {
    const res = await checkOut(bookingId);
    return { res, fired };
  } finally {
    spy.mockRestore();
  }
}

/**
 * A writer that already holds the booking's invoice lock and is part-way
 * through deciding what the invoice should be — the state the other writer must
 * not be allowed to read past.
 *
 * `held` resolves once the lock is genuinely taken, so a test never races to
 * get in first; `release()` lets the holder finish its write and commit. The
 * transaction is given a long timeout because it is deliberately made to sit
 * still.
 */
function writerHoldingTheLock<T>(
  bookingId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let signalHeld!: () => void;
  let openGate!: () => void;
  const held = new Promise<void>((r) => { signalHeld = r; });
  const gate = new Promise<void>((r) => { openGate = r; });

  const done = prisma.$transaction(async (tx) => {
    await lockBookingInvoice(tx, bookingId);
    signalHeld();
    await gate;
    return write(tx);
  }, { timeout: 20000 });

  return { held, release: () => openGate(), done };
}

/** How long the other writer is watched for, to see whether it waits. */
const WATCH_MS = 300;
const settle = () => new Promise((r) => setTimeout(r, WATCH_MS));

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Checkout Race Test', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0 },
  });

  for (const n of ['1', '2', '3', '4', '5', '6']) {
    const r = await app.inject({
      method: 'POST', url: '/api/rooms', headers: auth(),
      payload: { number: `R${n}`, name: `Race Room ${n}`, type: 'DELUXE', basePrice: 8000, maxOccupancy: 2 },
    });
    expect(r.statusCode).toBe(201);
    rooms.push(JSON.parse(r.body).data.id);
  }
  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Race', lastName: 'Guest', email: `guest-${slug}@test.com` },
  })).id;
}, 30000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('check-out survives a draft invoice that lands mid-flight', () => {
  it('answers 200, not 500, when autoCreateInvoice commits inside the window', async () => {
    const b = await checkedInStay(1);

    const { res, fired } = await checkOutWithWriteInsideTheWindow(
      b.id,
      () => landBookingTimeDraft(b.id, 8000),
    );

    // If this is false the seam moved and the test proved nothing — fail loudly
    // rather than passing for the wrong reason.
    expect(fired).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('freezes the late draft instead of leaving the stay unbilled', async () => {
    const b = await checkedInStay(2);

    const { res } = await checkOutWithWriteInsideTheWindow(
      b.id,
      () => landBookingTimeDraft(b.id, 8000),
    );
    expect(res.statusCode).toBe(200);

    // One invoice for the booking — the draft that won the race, now finalised,
    // not a second one beside it.
    const invoices = await prisma.invoice.findMany({ where: { bookingId: b.id } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.finalizedAt).not.toBeNull();
    expect(invoices[0]!.status).toBe('PAID');
    expect(invoices[0]!.total).toBe(8000);

    // And the rest of the transaction committed with it, rather than rolling
    // back and leaving a checked-out guest in a room nobody was told to clean.
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: b.id },
      select: { status: true, invoiceNumber: true, roomId: true },
    });
    expect(booking.status).toBe('CHECKED_OUT');
    expect(booking.invoiceNumber).toBe(invoices[0]!.invoiceNumber);
    const room = await prisma.room.findUniqueOrThrow({ where: { id: booking.roomId }, select: { status: true } });
    expect(room.status).toBe('CLEANING');
  });

  it('writes the priced lines once, not the draft lines twice', async () => {
    // The draft's own ROOM line has the same (sourceType, sourceId) as the one
    // check-out writes. Repricing has to replace it, not add to it — a doubled
    // room charge is the quiet version of this bug.
    const b = await checkedInStay(3);

    const { res } = await checkOutWithWriteInsideTheWindow(
      b.id,
      () => landBookingTimeDraft(b.id, 8000),
    );
    expect(res.statusCode).toBe(200);

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { bookingId: b.id },
      include: { items: true },
    });
    const roomLines = invoice.items.filter((i) => i.sourceType === 'ROOM');
    expect(roomLines).toHaveLength(1);
    expect(invoice.items.reduce((s, i) => s + i.total, 0)).toBe(invoice.subtotal);
  });

  it('still mints a number for a booking with no draft at all', async () => {
    // The un-raced path, with the same seam armed but writing nothing: a
    // booking that never got an autoCreateInvoice must still be invoiced.
    const b = await checkedInStay(4);

    const { res, fired } = await checkOutWithWriteInsideTheWindow(b.id, async () => {});

    expect(fired).toBe(true);
    expect(res.statusCode).toBe(200);
    const invoices = await prisma.invoice.findMany({ where: { bookingId: b.id } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.invoiceNumber).toMatch(/^INV-/);
    expect(invoices[0]!.finalizedAt).not.toBeNull();
  });
});

/**
 * Re-reading inside the transaction shrinks the window; it does not close it.
 * Under READ COMMITTED another insert can still land between that read and the
 * write two statements later, and an insert that has not committed yet is
 * invisible to the read however late it is taken. What closes the window is
 * that both writers take the booking's invoice lock first, so one of them
 * always does its read-and-write while the other is held outside.
 *
 * These two pin that, one writer each. They are the tests that fail if either
 * `lockBookingInvoice` call is dropped — the tests above would not notice,
 * because they drop their row in before the transaction opens, where the
 * re-read alone catches it.
 */
describe('the two writers of a booking’s invoice exclude each other', () => {
  it('check-out waits for a draft that is already being written', async () => {
    const b = await checkedInStay(5);
    const writer = writerHoldingTheLock(b.id, (tx) => landBookingTimeDraft(b.id, 8000, tx));
    await writer.held;

    let settled = false;
    const checkout = checkOut(b.id).then((r) => { settled = true; return r; });
    try {
      await settle();
      // Not a statement about speed: check-out has reached the point where it
      // decides this booking's invoice and has stopped there. Without the lock
      // it reads an empty world instead and creates a second invoice — the
      // insert that aborts one of the two transactions.
      expect(settled).toBe(false);
    } finally {
      writer.release();
    }

    const draft = await writer.done;
    const res = await checkout;
    expect(res.statusCode).toBe(200);

    // It then saw the draft and froze that, rather than adding to it.
    const invoices = await prisma.invoice.findMany({ where: { bookingId: b.id } });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.id).toBe(draft.id);
    expect(invoices[0]!.finalizedAt).not.toBeNull();
    expect(invoices[0]!.status).toBe('PAID');
  });

  it('the booking-time draft waits too, instead of landing mid-check-out', async () => {
    // The mirror image: this time the holder stands in for a check-out that has
    // read and is about to freeze the bill, and the background writer is the
    // real `autoCreateInvoice`.
    const b = await checkedInStay(6);
    const writer = writerHoldingTheLock(b.id, (tx) => landBookingTimeDraft(b.id, 8000, tx));
    await writer.held;

    let settled = false;
    const auto = autoCreateInvoice(b.id, tenantId).then(() => { settled = true; });
    try {
      await settle();
      expect(settled).toBe(false);
    } finally {
      writer.release();
    }
    await writer.done;
    await auto;

    // It found the invoice once it got the lock and stood down: one row, and
    // none of the noise losing the constraint would have made.
    const invoices = await prisma.invoice.findMany({ where: { bookingId: b.id } });
    expect(invoices).toHaveLength(1);
    const failures = await prisma.adminNotification.count({
      where: { type: 'invoice_creation_failed', message: { contains: b.id } },
    });
    expect(failures).toBe(0);
  });
});

/**
 * Check-out freezes the bill.
 *
 * The risky step: it now writes an invoice, its line items, a payment, the
 * room state, a housekeeping task and an audit row — in one transaction, from
 * one calculation. These tests pin the properties that matter when it goes
 * wrong: it must not charge twice, must not half-complete, and must not let a
 * failing email undo a settled stay.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `checkout-final-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let guestId: string;
let menuItemId: string;
const rooms: string[] = [];
let roomCursor = 0;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const nextRoom = () => rooms[roomCursor++]!;

async function stay(opts: { total: number; paid?: number; day: number }) {
  const d = (n: number) => new Date(`2029-01-${String(n).padStart(2, '0')}`);
  return prisma.booking.create({
    data: {
      tenantId, roomId: nextRoom(), guestId,
      checkIn: d(opts.day), checkOut: d(opts.day + 1),
      totalAmount: opts.total, paidAmount: opts.paid ?? 0,
      status: 'CHECKED_IN', actualCheckIn: new Date(),
      confirmationNo: `FIN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

const checkOut = (id: string, payload: Record<string, unknown> = {}) =>
  app.inject({ method: 'PATCH', url: `/api/bookings/${id}/check-out`, headers: auth(), payload });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Checkout Finalisation Test', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0 } });

  for (const n of ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20']) {
    const r = await app.inject({
      method: 'POST', url: '/api/rooms', headers: auth(),
      payload: { number: `F${n}`, name: `Fin Room ${n}`, type: 'DELUXE', basePrice: 4000, maxOccupancy: 2 },
    });
    rooms.push(JSON.parse(r.body).data.id);
  }
  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Fin', lastName: 'Guest', email: `guest-${slug}@test.com` },
  })).id;
  menuItemId = (await prisma.menuItem.create({
    data: { tenantId, name: 'Fin Dish', category: 'DINNER' as never, price: 500, isAvailable: true },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('check-out finalises the invoice', () => {
  it('freezes an invoice carrying room, food and extras', async () => {
    const b = await stay({ total: 10000, paid: 10000, day: 1 });
    await prisma.foodOrder.create({
      data: {
        tenantId, bookingId: b.id, totalAmount: 1200, status: 'DELIVERED', paymentStatus: 'PENDING',
        items: { create: [{ menuItemId, quantity: 2, unitPrice: 600 }] },
      },
    });
    await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Broken glass', amount: 500, quantity: 1 },
    });

    const res = await checkOut(b.id, { additionalPayment: 1700, paymentMethod: 'CASH' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.checkoutSummary.grandTotal).toBe(11700);
    expect(JSON.parse(res.body).data.checkoutSummary.balanceDue).toBe(0);

    const inv = await prisma.invoice.findFirstOrThrow({ where: { bookingId: b.id }, include: { items: true } });
    expect(inv.finalizedAt).not.toBeNull();
    expect(inv.status).toBe('PAID');
    expect(inv.total).toBe(11700);
    // Room, food and the extra each became one traceable line.
    expect(inv.items).toHaveLength(3);
    expect(inv.items.map(i => i.sourceType).sort()).toEqual(['EXTRA', 'FOOD_ORDER', 'ROOM']);
    expect(inv.items.find(i => i.sourceType === 'ROOM')!.total).toBe(10000);
  });

  it('writes an audit row naming who settled it', async () => {
    const b = await stay({ total: 5000, paid: 5000, day: 3 });
    await checkOut(b.id);
    const audit = await prisma.billingAudit.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(audit.action).toBe('FINALISE');
    expect(audit.amount).toBe(5000);
    expect(audit.actorId).toBeTruthy();
  });

  it('refuses a second check-out instead of charging twice', async () => {
    const b = await stay({ total: 8000, paid: 0, day: 5 });
    const first = await checkOut(b.id, { additionalPayment: 8000 });
    expect(first.statusCode).toBe(200);

    const second = await checkOut(b.id, { additionalPayment: 8000 });
    expect(second.statusCode).toBe(409);

    // The second attempt must leave no trace: one payment, one invoice.
    expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(1);
    expect(await prisma.invoice.count({ where: { bookingId: b.id } })).toBe(1);
    const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(Number(fresh.paidAmount)).toBe(8000);
  });

  it('survives two simultaneous check-outs', async () => {
    const b = await stay({ total: 6000, paid: 0, day: 7 });
    const results = await Promise.all([
      checkOut(b.id, { additionalPayment: 6000 }),
      checkOut(b.id, { additionalPayment: 6000 }),
    ]);
    const codes = results.map(r => r.statusCode).sort();
    expect(codes).toEqual([200, 409]);
    expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(1);
    expect(Number((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).paidAmount)).toBe(6000);
  });

  it('leaves undelivered food off the bill and reports it', async () => {
    const b = await stay({ total: 7000, paid: 7000, day: 9 });
    await prisma.foodOrder.create({
      data: {
        tenantId, bookingId: b.id, totalAmount: 450, status: 'PREPARING', paymentStatus: 'PENDING',
        items: { create: [{ menuItemId, quantity: 1, unitPrice: 450 }] },
      },
    });
    const res = await checkOut(b.id);
    const summary = JSON.parse(res.body).data.checkoutSummary;
    expect(summary.grandTotal).toBe(7000);
    expect(summary.unbilled).toHaveLength(1);
    expect(summary.unbilled[0].amount).toBe(450);
  });

  it('replaces the stale draft written at booking time', async () => {
    const b = await stay({ total: 9000, paid: 9000, day: 11 });
    const draft = await prisma.invoice.create({
      data: {
        tenantId, bookingId: b.id, invoiceNumber: `INV-STALE-${Date.now()}`,
        guestName: 'Fin Guest', status: 'DRAFT', subtotal: 4000, total: 4000,
        items: { create: [{ description: 'Stale room line', category: 'ROOM', quantity: 1, unitPrice: 4000, total: 4000 }] },
      },
    });
    await checkOut(b.id);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { bookingId: b.id }, include: { items: true } });
    expect(inv.id).toBe(draft.id);          // same invoice, same number
    expect(inv.total).toBe(9000);           // repriced
    expect(inv.status).toBe('PAID');
    expect(inv.items).toHaveLength(1);
    expect(inv.items[0]!.total).toBe(9000); // the stale line is gone
  });

  it('keeps an adjustment line when repricing', async () => {
    const b = await stay({ total: 9000, paid: 9000, day: 13 });
    const draft = await prisma.invoice.create({
      data: {
        tenantId, bookingId: b.id, invoiceNumber: `INV-ADJ-${Date.now()}`,
        guestName: 'Fin Guest', status: 'DRAFT',
        items: { create: [{ description: 'Goodwill credit', category: 'OTHER', quantity: 1, unitPrice: -200, total: -200, sourceType: 'ADJUSTMENT' }] },
      },
    });
    await checkOut(b.id);
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: draft.id } });
    expect(items.some(i => i.sourceType === 'ADJUSTMENT')).toBe(true);
    expect(items.some(i => i.sourceType === 'ROOM')).toBe(true);
  });

  it('still moves the room to cleaning and raises the housekeeping task', async () => {
    const b = await stay({ total: 4000, paid: 4000, day: 15 });
    await checkOut(b.id);
    const room = await prisma.room.findUniqueOrThrow({ where: { id: b.roomId } });
    expect(room.status).toBe('CLEANING');
    expect(await prisma.housekeepingTask.count({ where: { roomId: b.roomId, type: 'CHECKOUT' } })).toBe(1);
  });

  it('marks the invoice PARTIAL when the guest leaves owing money', async () => {
    const b = await stay({ total: 10000, paid: 3000, day: 17 });
    const res = await checkOut(b.id);
    expect(JSON.parse(res.body).data.checkoutSummary.balanceDue).toBe(7000);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { bookingId: b.id } });
    expect(inv.status).toBe('PARTIAL');
  });
});

/**
 * The acceptance criterion for the whole P0 plan: one stay, one number,
 * everywhere. Before this work the front desk, the check-out response, the
 * invoice page and the guest email each computed their own total and all four
 * disagreed.
 */
describe('every surface reports the same total', () => {
  it('bill, check-out summary, invoice page and stored invoice agree', async () => {
    const b = await stay({ total: 12000, paid: 5000, day: 19 });
    await prisma.foodOrder.create({
      data: {
        tenantId, bookingId: b.id, totalAmount: 900, status: 'DELIVERED', paymentStatus: 'PENDING',
        items: { create: [{ menuItemId, quantity: 1, unitPrice: 900 }] },
      },
    });
    await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Laundry', amount: 300, quantity: 1 },
    });

    const preview = JSON.parse((await app.inject({
      method: 'GET', url: `/api/bookings/${b.id}/bill`, headers: auth(),
    })).body).data;

    const summary = JSON.parse((await app.inject({
      method: 'PATCH', url: `/api/bookings/${b.id}/check-out`, headers: auth(),
      payload: { additionalPayment: 8200, paymentMethod: 'CASH' },
    })).body).data.checkoutSummary;

    const invoicePage = JSON.parse((await app.inject({
      method: 'GET', url: `/api/bookings/${b.id}/invoice`, headers: auth(),
    })).body).data;

    const stored = await prisma.invoice.findFirstOrThrow({ where: { bookingId: b.id } });

    expect(preview.grandTotal).toBe(13200);
    expect(summary.grandTotal).toBe(13200);
    expect(invoicePage.summary.grandTotal).toBe(13200);
    expect(stored.total).toBe(13200);
    expect(summary.balanceDue).toBe(0);
    expect(invoicePage.finalizedAt).not.toBeNull();
  });

  it('prices the invoice page from what was charged, not the room rate card', async () => {
    // basePrice is 4000/night; this stay was booked at 9000 for one night.
    const b = await stay({ total: 9000, paid: 9000, day: 21 });
    const page = JSON.parse((await app.inject({
      method: 'GET', url: `/api/bookings/${b.id}/invoice`, headers: auth(),
    })).body).data;
    expect(page.lineItems.room.amount).toBe(9000);
    expect(page.summary.grandTotal).toBe(9000);
  });

  it('stamps the booking with the invoice’s own number, not a second scheme', async () => {
    const b = await stay({ total: 4000, paid: 4000, day: 23 });
    await checkOut(b.id);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { bookingId: b.id } });
    const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(fresh.invoiceNumber).toBe(inv.invoiceNumber);
    expect(fresh.invoiceNumber).not.toMatch(/^INV-FIN-/); // not the confirmation-number fallback
  });
});

/**
 * Side effects run after the bill is committed, so each needs its own guard.
 * Without them a retry emails the guest their invoice twice and awards the
 * loyalty points twice — points given away twice are money given away twice.
 */
describe('side effects are claimed, not repeated', () => {
  it('sends the checkout invoice once', async () => {
    await prisma.emailSettings.upsert({
      where: { tenantId }, create: { tenantId, sendCheckoutInvoice: true }, update: { sendCheckoutInvoice: true },
    });
    // Its own guest, so the count cannot pick up the fire-and-forget emails
    // other tests in this file leave in flight.
    const soloEmail = `solo-${Date.now()}@test.com`;
    const solo = await prisma.guest.create({
      data: { tenantId, firstName: 'Solo', lastName: 'Guest', email: soloEmail },
    });
    const b = await prisma.booking.create({
      data: {
        tenantId, roomId: nextRoom(), guestId: solo.id,
        checkIn: new Date('2029-01-25'), checkOut: new Date('2029-01-26'),
        totalAmount: 5000, paidAmount: 5000, status: 'CHECKED_IN',
        confirmationNo: `SOLO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      },
    });

    // Count the actual sends. Asserting on invoiceSentAt would pass with the
    // guard removed, because the stamp does not move on a second send — it
    // has to be the email itself that is counted.
    const emailService = await import('../../src/services/email');
    const spy = vi.spyOn(emailService, 'sendEmail');
    const { sendCheckoutEmail } = await import('../../src/utils/guest-emails');

    await sendCheckoutEmail(b.id);
    await sendCheckoutEmail(b.id);

    expect(spy.mock.calls.filter(([arg]) => arg.to === soloEmail)).toHaveLength(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).invoiceSentAt).not.toBeNull();
    spy.mockRestore();
  });

  it('awards loyalty points once', async () => {
    await prisma.loyaltyProgram.upsert({
      where: { tenantId },
      create: { tenantId, isEnabled: true, pointsPerDollar: 1 },
      update: { isEnabled: true, pointsPerDollar: 1 },
    });
    const b = await stay({ total: 5000, paid: 5000, day: 27 });

    const { awardCheckoutPoints } = await import('../../src/services/loyalty');
    // Concurrently on purpose. Run one after the other, the flag read at the
    // top of the function already stops the second — it is only two callers
    // reading `false` at the same moment that the atomic claim exists for.
    await Promise.all([awardCheckoutPoints(b.id), awardCheckoutPoints(b.id)]);

    const txns = await prisma.loyaltyTransaction.count({ where: { bookingId: b.id } });
    expect(txns).toBe(1);
  });

  it('does not mark a stay awarded when the programme is off', async () => {
    await prisma.loyaltyProgram.upsert({
      where: { tenantId },
      create: { tenantId, isEnabled: false, pointsPerDollar: 1 },
      update: { isEnabled: false },
    });
    const b = await stay({ total: 5000, paid: 5000, day: 29 });
    const { awardCheckoutPoints } = await import('../../src/services/loyalty');
    await awardCheckoutPoints(b.id);
    const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    // Claiming the flag here would deny the stay its points forever once the
    // resort switches loyalty on.
    expect(fresh.loyaltyPointsAwarded).toBe(false);
  });
});

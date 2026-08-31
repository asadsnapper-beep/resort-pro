/**
 * bill() — the single billing calculation.
 *
 * These tests pin the rules in plan/billing-contract.md §3, especially the two
 * that were wrong in every previous code path: the room is priced from
 * booking.totalAmount (not room.basePrice), and only DELIVERED, not-already-paid
 * food reaches the bill.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { bill } from '../../src/services/billing';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `billing-svc-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let roomId: string;
let guestId: string;
let menuItemId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

/** A booking whose totalAmount deliberately differs from basePrice × nights. */
async function makeBooking(opts: { total: number; checkIn: string; checkOut: string; status?: string; paid?: number }) {
  return prisma.booking.create({
    data: {
      tenantId, roomId, guestId,
      checkIn: new Date(opts.checkIn), checkOut: new Date(opts.checkOut),
      totalAmount: opts.total, paidAmount: opts.paid ?? 0,
      status: (opts.status ?? 'CHECKED_IN') as never,
      confirmationNo: `BILL-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

async function makeFoodOrder(bookingId: string, amount: number, status: string, paymentStatus = 'PENDING') {
  return prisma.foodOrder.create({
    data: {
      tenantId, bookingId, totalAmount: amount,
      status: status as never, paymentStatus: paymentStatus as never,
      items: { create: [{ menuItemId, quantity: 1, unitPrice: amount }] },
    },
  });
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Billing Service Test', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0 } });

  // basePrice 9000/night — every bill below must ignore it in favour of totalAmount.
  const room = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: { number: '901', name: 'Bill Test Room', type: 'DELUXE', basePrice: 9000, maxOccupancy: 2 },
  });
  roomId = JSON.parse(room.body).data.id;

  const guest = await prisma.guest.create({
    data: { tenantId, firstName: 'Bill', lastName: 'Payer', email: `guest-${slug}@test.com` },
  });
  guestId = guest.id;

  const item = await prisma.menuItem.create({
    data: { tenantId, name: 'Test Curry', category: 'DINNER' as never, price: 600, isAvailable: true },
  });
  menuItemId = item.id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('bill() — room', () => {
  it('prices the room from booking.totalAmount, not room.basePrice', async () => {
    // 2 nights: basePrice would say 18,000. The booking was rate-planned to 13,500.
    const b = await makeBooking({ total: 13500, checkIn: '2027-03-01', checkOut: '2027-03-03' });
    const result = await bill(tenantId, b.id);
    expect(result.roomTotal).toBe(13500);
    expect(result.grandTotal).toBe(13500);
    expect(result.nights).toBe(2);
    // The per-night figure shown to the guest is derived from what they pay.
    expect(result.lines[0]!.unitPrice).toBe(6750);
  });

  it('never returns a negative or NaN total for a same-day booking', async () => {
    const b = await makeBooking({ total: 5000, checkIn: '2027-03-05', checkOut: '2027-03-05' });
    const result = await bill(tenantId, b.id);
    expect(result.nights).toBe(1);
    expect(result.grandTotal).toBe(5000);
  });
});

describe('bill() — food eligibility', () => {
  it('bills a DELIVERED order', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-04-01', checkOut: '2027-04-02' });
    await makeFoodOrder(b.id, 1200, 'DELIVERED');
    const result = await bill(tenantId, b.id);
    expect(result.foodTotal).toBe(1200);
    expect(result.grandTotal).toBe(11200);
  });

  it('does not bill an undelivered order, but warns about it', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-04-03', checkOut: '2027-04-04' });
    await makeFoodOrder(b.id, 900, 'PREPARING');
    const result = await bill(tenantId, b.id);
    expect(result.foodTotal).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.kind).toBe('UNDELIVERED_FOOD');
    expect(result.warnings[0]!.amount).toBe(900);
  });

  it('does not bill a cancelled order and does not warn', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-04-05', checkOut: '2027-04-06' });
    await makeFoodOrder(b.id, 700, 'CANCELLED');
    const result = await bill(tenantId, b.id);
    expect(result.foodTotal).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not bill an order already paid at the restaurant', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-04-07', checkOut: '2027-04-08' });
    await makeFoodOrder(b.id, 500, 'DELIVERED', 'PAID');
    const result = await bill(tenantId, b.id);
    expect(result.foodTotal).toBe(0);
  });
});

describe('bill() — extras, packages, tax, payments', () => {
  it('includes invoice extras', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-05-01', checkOut: '2027-05-02' });
    await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Broken glass', amount: 500, quantity: 1 },
    });
    await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Minibar: Coke', amount: 150, quantity: 2 },
    });
    const result = await bill(tenantId, b.id);
    expect(result.extrasTotal).toBe(800);
    expect(result.grandTotal).toBe(10800);
  });

  it('applies tax to the subtotal', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { taxRate: 10 } });
    const b = await makeBooking({ total: 10000, checkIn: '2027-06-01', checkOut: '2027-06-02' });
    await makeFoodOrder(b.id, 1000, 'DELIVERED');
    const result = await bill(tenantId, b.id);
    expect(result.subtotal).toBe(11000);
    expect(result.taxAmount).toBe(1100);
    expect(result.grandTotal).toBe(12100);
    await prisma.tenant.update({ where: { id: tenantId }, data: { taxRate: 0 } });
  });

  it('reports balance due after a partial payment, and never goes negative', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-07-01', checkOut: '2027-07-02', paid: 4000 });
    expect((await bill(tenantId, b.id)).balanceDue).toBe(6000);

    const over = await makeBooking({ total: 5000, checkIn: '2027-07-03', checkOut: '2027-07-04', paid: 6000 });
    expect((await bill(tenantId, over.id)).balanceDue).toBe(0);
  });

  it('adds up room, food and extras into one total', async () => {
    const b = await makeBooking({ total: 13500, checkIn: '2027-08-01', checkOut: '2027-08-03', paid: 13500 });
    await makeFoodOrder(b.id, 1200, 'DELIVERED');
    await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Minibar', amount: 500, quantity: 1 },
    });
    const result = await bill(tenantId, b.id);
    expect(result.grandTotal).toBe(15200);
    expect(result.balanceDue).toBe(1700);
    expect(result.lines).toHaveLength(3);
  });
});

describe('bill() — provenance and isolation', () => {
  it('gives every line a sourceType and sourceId', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-09-01', checkOut: '2027-09-02' });
    const order = await makeFoodOrder(b.id, 300, 'DELIVERED');
    const extra = await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Laundry', amount: 200, quantity: 1 },
    });
    const result = await bill(tenantId, b.id);
    const byType = Object.fromEntries(result.lines.map((l) => [l.sourceType, l.sourceId]));
    expect(byType.ROOM).toBe(b.id);
    expect(byType.FOOD_ORDER).toBe(order.id);
    expect(byType.EXTRA).toBe(extra.id);
    // No line may be untraceable — that is what makes charge writes idempotent.
    expect(result.lines.every((l) => l.sourceId && l.sourceType)).toBe(true);
  });

  it('refuses a booking belonging to another tenant', async () => {
    const b = await makeBooking({ total: 10000, checkIn: '2027-10-01', checkOut: '2027-10-02' });
    await expect(bill('00000000-0000-0000-0000-000000000000', b.id)).rejects.toThrow();
  });
});

describe('GET /api/bookings/:id/bill', () => {
  it('returns the same numbers bill() computes', async () => {
    const b = await makeBooking({ total: 12000, checkIn: '2027-11-01', checkOut: '2027-11-03', paid: 5000 });
    await makeFoodOrder(b.id, 800, 'DELIVERED');
    await prisma.invoiceExtra.create({
      data: { tenantId, bookingId: b.id, description: 'Minibar', amount: 200, quantity: 1 },
    });

    const res = await app.inject({ method: 'GET', url: `/api/bookings/${b.id}/bill`, headers: auth() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body).data;

    const direct = await bill(tenantId, b.id);
    expect(body.grandTotal).toBe(direct.grandTotal);
    expect(body.grandTotal).toBe(13000);
    expect(body.balanceDue).toBe(8000);
    expect(body.lines).toHaveLength(3);
  });

  it('surfaces undelivered food as a warning', async () => {
    const b = await makeBooking({ total: 9000, checkIn: '2027-11-05', checkOut: '2027-11-06' });
    await makeFoodOrder(b.id, 450, 'READY');
    const res = await app.inject({ method: 'GET', url: `/api/bookings/${b.id}/bill`, headers: auth() });
    const body = JSON.parse(res.body).data;
    expect(body.foodTotal).toBe(0);
    expect(body.warnings).toHaveLength(1);
  });

  it('404s for an unknown booking', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/bookings/00000000-0000-0000-0000-000000000000/bill', headers: auth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it('requires authentication', async () => {
    const b = await makeBooking({ total: 5000, checkIn: '2027-11-08', checkOut: '2027-11-09' });
    const res = await app.inject({ method: 'GET', url: `/api/bookings/${b.id}/bill` });
    expect(res.statusCode).toBe(401);
  });
});

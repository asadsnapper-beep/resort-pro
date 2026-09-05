/**
 * Charging a restaurant order to a room.
 *
 * Covers the creation half of plan/restaurant-room-billing.md — §3's
 * server-side validation and §8's idempotency. The billing half (an order
 * reaching the bill exactly once at checkout) is pinned by
 * billing-service.test.ts and checkout-finalisation.test.ts.
 *
 * The rule these tests exist for: a client that sends a stale or foreign
 * bookingId must never succeed, whatever it claims.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `resto-room-${Date.now()}`;
const otherSlug = `resto-other-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let roomId: string;
let guestId: string;
let menuItemId: string;
let otherTenantId: string;
let otherBookingId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

async function makeBooking(status: string, guest = guestId, room = roomId) {
  const booking = await prisma.booking.create({
    data: {
      tenantId, roomId: room, guestId: guest,
      checkIn: new Date('2026-09-01'), checkOut: new Date('2026-09-03'),
      totalAmount: 8000, status: status as never,
      confirmationNo: `RR-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  });
  return booking.id;
}

function order(payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST', url: '/api/food-orders', headers: auth(),
    payload: { items: [{ menuItemId, quantity: 2 }], ...payload },
  });
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Restaurant Room Billing', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0 } });
  // The restaurant lives behind a plan flag; turn it on explicitly rather than
  // relying on whatever the platform's plan config happens to say today.
  await prisma.tenantFeatureFlag.upsert({
    where: { tenantId_flag: { tenantId, flag: 'restaurant_module' } },
    create: { tenantId, flag: 'restaurant_module', enabled: true },
    update: { enabled: true },
  });

  const room = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: { number: '901', name: 'Sea View', type: 'DELUXE', basePrice: 4000, maxOccupancy: 2 },
  });
  roomId = JSON.parse(room.body).data.id;

  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Karim', lastName: 'Hossain', email: `guest-${slug}@test.com` },
  })).id;

  menuItemId = (await prisma.menuItem.create({
    data: { tenantId, name: 'Test Curry', category: 'DINNER' as never, price: 600, isAvailable: true },
  })).id;

  // A second resort, with a stay of its own — nothing about it may be reachable
  // through the first resort's token.
  const otherTenant = await prisma.tenant.create({
    data: { name: 'Other Resort', slug: otherSlug, planStatus: 'active' },
  });
  otherTenantId = otherTenant.id;
  const otherRoom = await prisma.room.create({
    data: { tenantId: otherTenantId, number: '101', name: 'Other Room', basePrice: 3000 },
  });
  const otherGuest = await prisma.guest.create({
    data: { tenantId: otherTenantId, firstName: 'Someone', lastName: 'Else', email: `guest-${otherSlug}@test.com` },
  });
  otherBookingId = (await prisma.booking.create({
    data: {
      tenantId: otherTenantId, roomId: otherRoom.id, guestId: otherGuest.id,
      checkIn: new Date('2026-09-01'), checkOut: new Date('2026-09-03'),
      totalAmount: 5000, status: 'CHECKED_IN' as never,
      confirmationNo: `RRO-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { in: [slug, otherSlug] } } });
  await app.close();
});

describe('creating an order against a stay', () => {
  it('charges to the room when the guest is checked in', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const res = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });

    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body).data;
    expect(created.bookingId).toBe(bookingId);
    expect(created.settlement).toBe('CHARGE_TO_ROOM');
    expect(Number(created.totalAmount)).toBe(1200);
    // Nothing is collected at order time — it rides on the stay's invoice.
    expect(created.paymentStatus).toBe('PENDING');
  });

  it('takes the room and the guest from the stay, not from the request', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const res = await order({ bookingId, settlement: 'CHARGE_TO_ROOM', tableNumber: 'Room 207' });

    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body).data;
    expect(created.tableNumber).toBe('Room 901');
    expect(created.guestId).toBe(guestId);
  });

  it('reads a bookingId with no settlement as charging to the room', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const res = await order({ bookingId });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.settlement).toBe('CHARGE_TO_ROOM');
  });

  it('refuses a stay that has not arrived', async () => {
    const bookingId = await makeBooking('CONFIRMED');
    const res = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/checked in/i);
  });

  it('refuses a stay that has already checked out', async () => {
    const bookingId = await makeBooking('CHECKED_OUT');
    const res = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });

    expect(res.statusCode).toBe(400);
  });

  it('refuses another resort’s stay without leaking anything about it', async () => {
    const res = await order({ bookingId: otherBookingId, settlement: 'CHARGE_TO_ROOM' });

    expect(res.statusCode).toBe(400);
    expect(res.body).not.toMatch(/Someone|Else|101/);
    expect(await prisma.foodOrder.count({ where: { bookingId: otherBookingId } })).toBe(0);
  });

  it('refuses a guest who is not the one staying in the room', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const stranger = await prisma.guest.create({
      data: { tenantId, firstName: 'Not', lastName: 'Staying', email: `stranger-${slug}@test.com` },
    });
    const res = await order({ bookingId, settlement: 'CHARGE_TO_ROOM', guestId: stranger.id });

    expect(res.statusCode).toBe(400);
  });

  it('refuses a stay whose bill has already been finalised', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    await prisma.invoice.create({
      data: {
        tenantId, bookingId, guestName: 'Karim Hossain',
        invoiceNumber: `INV-RR-${randomUUID().slice(0, 8)}`,
        finalizedAt: new Date(),
      },
    });
    const res = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/already been billed/i);
  });

  it('refuses an order that is both paid now and attached to a stay', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const res = await order({ bookingId, settlement: 'PAY_NOW' });

    expect(res.statusCode).toBe(400);
  });

  it('refuses charging to a room with no stay selected', async () => {
    const res = await order({ settlement: 'CHARGE_TO_ROOM' });

    expect(res.statusCode).toBe(400);
  });

  it('leaves the walk-in flow untouched', async () => {
    const res = await order({ tableNumber: 'Table 4' });

    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body).data;
    expect(created.settlement).toBe('PAY_NOW');
    expect(created.bookingId).toBeNull();
    expect(created.tableNumber).toBe('Table 4');
  });

  it('does not accept settlements whose billing does not exist yet', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    for (const settlement of ['COMPLIMENTARY', 'CORPORATE']) {
      const res = await order({ bookingId, settlement });
      expect(res.statusCode).toBe(400);
    }
    expect(await prisma.foodOrder.count({ where: { bookingId } })).toBe(0);
  });
});

describe('a client replaying an order it never saw acknowledged', () => {
  it('creates one order, not two', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const idempotencyKey = randomUUID();

    const first = await order({ bookingId, settlement: 'CHARGE_TO_ROOM', idempotencyKey });
    const replay = await order({ bookingId, settlement: 'CHARGE_TO_ROOM', idempotencyKey });

    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(JSON.parse(replay.body).data.id).toBe(JSON.parse(first.body).data.id);
    expect(await prisma.foodOrder.count({ where: { bookingId } })).toBe(1);
  });

  it('creates one order when both attempts arrive at once', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const idempotencyKey = randomUUID();

    const [a, b] = await Promise.all([
      order({ bookingId, settlement: 'CHARGE_TO_ROOM', idempotencyKey }),
      order({ bookingId, settlement: 'CHARGE_TO_ROOM', idempotencyKey }),
    ]);

    expect([a.statusCode, b.statusCode].every((s) => s === 200 || s === 201)).toBe(true);
    expect(await prisma.foodOrder.count({ where: { bookingId } })).toBe(1);
  });

  it('keys are the client’s own, so another resort may reuse one', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const idempotencyKey = randomUUID();
    await order({ bookingId, settlement: 'CHARGE_TO_ROOM', idempotencyKey });

    await prisma.foodOrder.create({
      data: { tenantId: otherTenantId, totalAmount: 100, idempotencyKey },
    });

    expect(await prisma.foodOrder.count({ where: { idempotencyKey } })).toBe(2);
  });
});

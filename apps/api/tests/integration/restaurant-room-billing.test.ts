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

describe('finding the stay to charge', () => {
  let staying: string;
  let departed: string;
  let notArrived: string;
  let roomNumber: string;

  const inHouse = (q?: string) => app.inject({
    method: 'GET',
    url: `/api/bookings/in-house${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`,
    headers: auth(),
  });

  beforeAll(async () => {
    const room = await prisma.room.create({
      data: { tenantId, number: '902', name: 'Garden Suite', basePrice: 5000 },
    });
    roomNumber = room.number;
    const guest = await prisma.guest.create({
      data: { tenantId, firstName: 'Nusrat', lastName: 'Jahan', email: `nusrat-${slug}@test.com`, phone: '+8801711000000' },
    });
    staying = await makeBooking('CHECKED_IN', guest.id, room.id);
    departed = await makeBooking('CHECKED_OUT', guest.id, room.id);
    notArrived = await makeBooking('CONFIRMED', guest.id, room.id);
  });

  it('lists only guests who are checked in', async () => {
    const res = await inHouse();
    expect(res.statusCode).toBe(200);
    const ids = JSON.parse(res.body).data.map((s: { id: string }) => s.id);

    expect(ids).toContain(staying);
    expect(ids).not.toContain(departed);
    expect(ids).not.toContain(notArrived);
  });

  it('finds the stay by room number, by name, and by confirmation number', async () => {
    const confirmationNo = (await prisma.booking.findUniqueOrThrow({ where: { id: staying } })).confirmationNo;

    for (const q of [roomNumber, 'Nusrat', 'Jahan', 'nusrat jahan', confirmationNo]) {
      const res = await inHouse(q);
      const ids = JSON.parse(res.body).data.map((s: { id: string }) => s.id);
      expect(ids, `searching for "${q}"`).toContain(staying);
    }
  });

  it('answers with nothing rather than everything when the search matches no one', async () => {
    const res = await inHouse('no-such-guest-xyz');
    expect(JSON.parse(res.body).data).toEqual([]);
  });

  it('does not reach into another resort', async () => {
    const res = await inHouse();
    const ids = JSON.parse(res.body).data.map((s: { id: string }) => s.id);

    expect(ids).not.toContain(otherBookingId);
    expect(res.body).not.toMatch(/Someone|Else/);
  });

  it('tells the order-taker who and where, and nothing else', async () => {
    const res = await inHouse(roomNumber);
    const stay = JSON.parse(res.body).data.find((s: { id: string }) => s.id === staying);

    expect(stay.room.number).toBe('902');
    expect(stay.guest.firstName).toBe('Nusrat');
    expect(stay.checkOut).toBeTruthy();
    // The restaurant identifies a stay; it has no business reading the guest's
    // contact details or what the room is costing.
    expect(res.body).not.toMatch(/8801711000000|nusrat-.*@test\.com|totalAmount|paidAmount/);
  });
});

describe('from the waiter’s order to the guest’s bill', () => {
  let secondItemId: string;

  const setStatus = (orderId: string, status: string) => app.inject({
    method: 'PATCH', url: `/api/food-orders/${orderId}/status`, headers: auth(), payload: { status },
  });
  const checkOut = (bookingId: string) => app.inject({
    method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`, headers: auth(), payload: {},
  });
  const invoiceFor = (bookingId: string) => prisma.invoice.findFirstOrThrow({
    where: { bookingId }, include: { items: true },
  });

  beforeAll(async () => {
    secondItemId = (await prisma.menuItem.create({
      data: { tenantId, name: 'Test Dessert', category: 'DINNER' as never, price: 300, isAvailable: true },
    })).id;
  });

  it('puts a delivered room charge on the finalised invoice exactly once', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'DELIVERED');

    expect((await checkOut(bookingId)).statusCode).toBe(200);

    const invoice = await invoiceFor(bookingId);
    const foodLines = invoice.items.filter(i => i.sourceType === 'FOOD_ORDER' && i.sourceId === orderId);
    expect(foodLines).toHaveLength(1);
    expect(foodLines[0]!.total).toBe(1200);      // 2 × 600, the price at order time
    expect(invoice.total).toBe(8000 + 1200);     // room + food, tax 0
    expect(invoice.finalizedAt).not.toBeNull();
  });

  it('writes one line for an order of several dishes, not one per dish', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await app.inject({
      method: 'POST', url: '/api/food-orders', headers: auth(),
      payload: {
        bookingId, settlement: 'CHARGE_TO_ROOM',
        items: [{ menuItemId, quantity: 1 }, { menuItemId: secondItemId, quantity: 2 }],
      },
    });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'DELIVERED');
    await checkOut(bookingId);

    const invoice = await invoiceFor(bookingId);
    const foodLines = invoice.items.filter(i => i.sourceType === 'FOOD_ORDER');
    // One line per order is what the (invoiceId, sourceType, sourceId) unique
    // constraint requires — a line per dish would collide on the second write.
    expect(foodLines).toHaveLength(1);
    expect(foodLines[0]!.total).toBe(600 + 600);
    expect(foodLines[0]!.description).toContain('Test Dessert');
  });

  it('does not bill the food a second time when check-out is retried', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'DELIVERED');

    const first = await checkOut(bookingId);
    const again = await checkOut(bookingId);

    expect([first.statusCode, again.statusCode]).toEqual([200, 409]);
    const invoice = await invoiceFor(bookingId);
    expect(invoice.items.filter(i => i.sourceId === orderId)).toHaveLength(1);
    expect(invoice.total).toBe(8000 + 1200);
  });

  it('leaves food still being cooked off the bill and says so', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'PREPARING');

    const res = await checkOut(bookingId);
    const summary = JSON.parse(res.body).data.checkoutSummary;

    expect(summary.grandTotal).toBe(8000);
    expect(summary.unbilled).toHaveLength(1);
    expect(summary.unbilled[0].sourceId).toBe(orderId);
    expect(summary.unbilled[0].amount).toBe(1200);
    const invoice = await invoiceFor(bookingId);
    expect(invoice.items.some(i => i.sourceId === orderId)).toBe(false);
  });

  it('refuses to charge a stay the guest has already settled and left', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    await checkOut(bookingId);

    const late = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });

    // Two reasons now hold — the stay is CHECKED_OUT and its invoice is
    // finalised — and either alone must be enough.
    expect(late.statusCode).toBe(400);
    expect(await prisma.foodOrder.count({ where: { bookingId } })).toBe(0);
  });

  it('never puts a walk-in’s dinner on anyone’s room', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const walkIn = await order({ tableNumber: 'Table 9' });
    const orderId = JSON.parse(walkIn.body).data.id;
    await setStatus(orderId, 'DELIVERED');

    await checkOut(bookingId);

    const invoice = await invoiceFor(bookingId);
    expect(invoice.items.some(i => i.sourceId === orderId)).toBe(false);
    expect(invoice.total).toBe(8000);
  });

  it('does not bill an order the guest already paid for at the restaurant', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'DELIVERED');
    await app.inject({
      method: 'PATCH', url: `/api/food-orders/${orderId}/payment`, headers: auth(), payload: { method: 'CASH' },
    });

    await checkOut(bookingId);

    const invoice = await invoiceFor(bookingId);
    expect(invoice.items.some(i => i.sourceId === orderId)).toBe(false);
    expect(invoice.total).toBe(8000);
  });
});

describe('cancelling food the guest has already been billed for', () => {
  let receptionistToken: string;

  const setStatus = (orderId: string, status: string, payload: Record<string, unknown> = {}, token = ownerToken) =>
    app.inject({
      method: 'PATCH', url: `/api/food-orders/${orderId}/status`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { status, ...payload },
    });
  const checkOut = (bookingId: string) => app.inject({
    method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`, headers: auth(), payload: {},
  });

  /** A stay whose delivered food has been billed and frozen at check-out. */
  async function billedOrder() {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'DELIVERED');
    await checkOut(bookingId);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { bookingId } });
    return { bookingId, orderId, invoice };
  }

  beforeAll(async () => {
    const bcrypt = await import('bcryptjs');
    const email = `reception-${slug}@test.com`;
    await prisma.user.create({
      data: {
        tenantId, email, passwordHash: await bcrypt.hash(password, 10),
        firstName: 'Rita', lastName: 'Front', role: 'RECEPTIONIST',
        emailVerifiedAt: new Date(),
      },
    });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password, slug } });
    receptionistToken = JSON.parse(login.body).data.token;
  });

  it('credits the invoice without touching the original charge', async () => {
    const { orderId, invoice } = await billedOrder();
    expect(invoice.total).toBe(8000 + 1200);

    const res = await setStatus(orderId, 'CANCELLED', { reason: 'Kitchen sent the wrong dish' });
    expect(res.statusCode).toBe(200);

    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
    const charge = items.find(i => i.sourceType === 'FOOD_ORDER' && i.sourceId === orderId);
    const credit = items.find(i => i.sourceType === 'ADJUSTMENT' && i.sourceId === orderId);

    expect(charge!.total).toBe(1200);   // the history stays true
    expect(credit!.total).toBe(-1200);
    expect(credit!.description).toContain('Cancelled');
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).total).toBe(8000);
  });

  it('records who cancelled it and why', async () => {
    const { bookingId, orderId } = await billedOrder();
    await setStatus(orderId, 'CANCELLED', { reason: 'Guest never received it' });

    const audit = await prisma.billingAudit.findFirstOrThrow({
      where: { bookingId, action: 'VOID' },
    });
    expect(audit.reason).toBe('Guest never received it');
    expect(audit.amount).toBe(-1200);
    expect(audit.actorId).toBeTruthy();
    expect((audit.metadata as { foodOrderId: string }).foodOrderId).toBe(orderId);
  });

  it('credits once however many times cancel is pressed', async () => {
    const { orderId, invoice } = await billedOrder();

    await setStatus(orderId, 'CANCELLED', { reason: 'Wrong dish' });
    await setStatus(orderId, 'CANCELLED', { reason: 'Wrong dish' });

    const credits = await prisma.invoiceItem.findMany({
      where: { invoiceId: invoice.id, sourceType: 'ADJUSTMENT' },
    });
    expect(credits).toHaveLength(1);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).total).toBe(8000);
  });

  it('says what the resort now owes the guest back', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'DELIVERED');
    // Guest settles the whole bill on the way out, food included.
    await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`, headers: auth(),
      payload: { additionalPayment: 9200, paymentMethod: 'CASH' },
    });

    const res = await setStatus(orderId, 'CANCELLED', { reason: 'Never served' });

    expect(JSON.parse(res.body).data.credited.refundDue).toBe(1200);
  });

  it('is a manager’s decision, and needs a reason', async () => {
    const a = await billedOrder();
    const refused = await setStatus(a.orderId, 'CANCELLED', { reason: 'Wrong dish' }, receptionistToken);
    expect(refused.statusCode).toBe(403);

    const b = await billedOrder();
    const noReason = await setStatus(b.orderId, 'CANCELLED');
    expect(noReason.statusCode).toBe(400);

    // Neither refusal may have moved money or the order.
    for (const { orderId, invoice } of [a, b]) {
      expect((await prisma.foodOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('DELIVERED');
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).total).toBe(9200);
    }
  });

  it('needs neither when the food never reached the guest', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
    const orderId = JSON.parse(placed.body).data.id;
    await setStatus(orderId, 'PREPARING');

    const res = await setStatus(orderId, 'CANCELLED', {}, receptionistToken);

    expect(res.statusCode).toBe(200);
    await checkOut(bookingId);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { bookingId }, include: { items: true } });
    expect(invoice.total).toBe(8000);
    expect(invoice.items.some(i => i.sourceId === orderId)).toBe(false);
  });

  it('credits the tax the guest paid on it too', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { taxRate: 10 } });
    try {
      const bookingId = await makeBooking('CHECKED_IN');
      const placed = await order({ bookingId, settlement: 'CHARGE_TO_ROOM' });
      const orderId = JSON.parse(placed.body).data.id;
      await setStatus(orderId, 'DELIVERED');
      await checkOut(bookingId);

      const before = await prisma.invoice.findFirstOrThrow({ where: { bookingId } });
      expect(before.total).toBe((8000 + 1200) * 1.1);

      await setStatus(orderId, 'CANCELLED', { reason: 'Wrong dish' });

      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: before.id } });
      expect(after.subtotal).toBe(8000);
      expect(after.taxAmount).toBe(800);
      expect(after.total).toBe(8800);
    } finally {
      await prisma.tenant.update({ where: { id: tenantId }, data: { taxRate: 0 } });
    }
  });
});

describe('orders that arrive from outside the dashboard', () => {
  /**
   * The guest's own ordering page and the embeddable widget attach a booking
   * when the guest gives a confirmation number. bill() bills by bookingId, so
   * such an order reaches the room whatever it is labelled — and a row left at
   * the PAY_NOW default reads to the front desk as cash still to collect.
   */
  it('labels a public order against a stay as charged to the room', async () => {
    const bookingId = await makeBooking('CHECKED_IN');
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    const res = await app.inject({
      method: 'POST', url: `/site/${slug}/order`,
      payload: {
        guestName: 'Karim Hossain',
        bookingRef: booking.confirmationNo,
        roomNumber: '901',
        items: [{ menuItemId, quantity: 1 }],
      },
    });

    expect(res.statusCode).toBe(201);
    const created = await prisma.foodOrder.findUniqueOrThrow({ where: { id: JSON.parse(res.body).data.orderId } });
    expect(created.bookingId).toBe(bookingId);
    expect(created.settlement).toBe('CHARGE_TO_ROOM');
  });

  it('leaves a public order with no stay as a counter sale', async () => {
    const res = await app.inject({
      method: 'POST', url: `/site/${slug}/order`,
      payload: { guestName: 'Passer By', items: [{ menuItemId, quantity: 1 }] },
    });

    expect(res.statusCode).toBe(201);
    const created = await prisma.foodOrder.findUniqueOrThrow({ where: { id: JSON.parse(res.body).data.orderId } });
    expect(created.bookingId).toBeNull();
    expect(created.settlement).toBe('PAY_NOW');
  });

  it('never leaves an order attached to a stay looking like a counter sale', async () => {
    const mislabelled = await prisma.foodOrder.count({
      where: { tenantId, bookingId: { not: null }, settlement: 'PAY_NOW' },
    });
    expect(mislabelled).toBe(0);
  });
});

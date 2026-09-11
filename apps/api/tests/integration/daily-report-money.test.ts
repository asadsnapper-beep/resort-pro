/**
 * What the daily report is allowed to call money.
 *
 * The report summed three things into one "Total Revenue": payments received,
 * food orders created, and invoice extras created. Those are not the same kind
 * of number, and for a stay whose food was charged to the room they are not
 * even independent — the checkout payment already contains the food, so the
 * food was counted twice.
 *
 * A resort owner reads that figure every evening, by email and by Telegram,
 * and decides things with it. So the rule these tests pin is: money received
 * and money charged are reported separately, and nothing adds them together.
 *
 * See plan/report-periods-and-custom-range.md, "Revenue, charges, and
 * payments".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `report-money-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let roomId: string;
let guestId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

/** The figures under test, for one stay: room 1200, food 600, paid 1800. */
const ROOM_TOTAL = 1200;
const FOOD_TOTAL = 600;
const PAID_AT_CHECKOUT = ROOM_TOTAL + FOOD_TOTAL;

function today() {
  return new Date().toISOString().slice(0, 10);
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Report Money', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0,
      // Pinned to UTC so `today()` below — which is a UTC date — is the same
      // day the report resolves. Without this the result would depend on what
      // time of day the suite happens to run: in Asia/Dhaka the UTC date is
      // still yesterday between 18:00 and midnight UTC. Which day a resort's
      // report covers is itself under test in tests/unit/report-period.test.ts.
      timezone: 'UTC',
    },
  });

  const room = await prisma.room.create({
    data: { tenantId, number: '501', name: 'Garden', basePrice: ROOM_TOTAL },
  });
  roomId = room.id;

  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Nusrat', lastName: 'Jahan', email: `guest-${slug}@test.com` },
  })).id;

  const menuItem = await prisma.menuItem.create({
    data: { tenantId, name: 'Fish Curry', category: 'DINNER' as never, price: FOOD_TOTAL, isAvailable: true },
  });

  const booking = await prisma.booking.create({
    data: {
      tenantId, roomId, guestId,
      checkIn: new Date(today()), checkOut: new Date(today()),
      totalAmount: ROOM_TOTAL, status: 'CHECKED_OUT' as never,
      confirmationNo: `RM-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  });

  // Food charged to the room, delivered — so it is on the guest's bill.
  await prisma.foodOrder.create({
    data: {
      tenantId, bookingId: booking.id, guestId,
      status: 'DELIVERED' as never,
      settlement: 'CHARGE_TO_ROOM' as never,
      totalAmount: FOOD_TOTAL,
      items: { create: [{ menuItemId: menuItem.id, quantity: 1, unitPrice: FOOD_TOTAL }] },
    },
  });

  // One payment at checkout, covering the room and the food together. This is
  // the whole of the money that actually arrived.
  await prisma.payment.create({
    data: {
      tenantId, bookingId: booking.id,
      amount: PAID_AT_CHECKOUT, method: 'CASH' as never,
      status: 'PAID' as never, processedAt: new Date(),
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('the daily report', () => {
  async function report() {
    const res = await app.inject({
      method: 'GET', url: `/api/reports/daily?date=${today()}`, headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body).data;
  }

  it('reports the money that arrived, not the money that arrived plus the bill it paid', async () => {
    const { financial } = await report();

    // 1800 came in. The old figure was 2400: the 600 of food was counted once
    // inside the checkout payment and once again on its own.
    expect(financial.cashCollected.total).toBe(PAID_AT_CHECKOUT);
  });

  it('reports what was charged as its own figure', async () => {
    const { financial } = await report();

    expect(financial.chargesPosted.restaurant).toBe(FOOD_TOTAL);
  });

  it('leaves room charges out rather than attributing them to a day', async () => {
    const { financial } = await report();

    // Room charges accrue per night, so placing them in a period needs the
    // room-night engine, and whether a stay counts by planned or actual dates
    // is still an open decision in the plan. Absent beats invented.
    expect(financial.chargesPosted.room).toBeNull();
  });

  it('never adds money received to money charged', async () => {
    const data = await report();
    const mixed = PAID_AT_CHECKOUT + FOOD_TOTAL; // 2400 — the old "Total Revenue"

    const everyNumber = JSON.stringify(data);
    expect(everyNumber).not.toContain(String(mixed));
  });

  it('breaks the money received down by method, and the parts sum to the whole', async () => {
    const { cashCollected } = (await report()).financial;

    expect(cashCollected.byMethod.CASH).toBe(PAID_AT_CHECKOUT);
    const sum = Object.values(cashCollected.byMethod as Record<string, number>)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBe(cashCollected.total);
  });
});

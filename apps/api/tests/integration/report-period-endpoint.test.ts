/**
 * GET /api/reports/period — daily, weekly and inclusive custom ranges.
 *
 * Covers the API rules in plan/report-periods-and-custom-range.md: inclusive
 * both ends, room-nights rather than live room status, field-specific 400s that
 * never silently correct the caller, and a quiet period answering with zeros
 * instead of an error.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `report-period-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

// A two-night stay, inside a six-day window, all comfortably in the past so
// the future-date guard is not what is being tested here.
const STAY_IN = '2026-09-03';
const STAY_OUT = '2026-09-05';
const WINDOW_FROM = '2026-09-01';
const WINDOW_TO = '2026-09-06';
const WINDOW_DAYS = 6;
const STAY_NIGHTS = 2;

async function period(query: string) {
  const res = await app.inject({
    method: 'GET', url: `/api/reports/period?${query}`, headers: auth(),
  });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Report Period', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    // UTC so the expected instants below are readable. Which day a resort's
    // report covers is under test in tests/unit/report-period.test.ts.
    data: { planStatus: 'active', plan: 'ENTERPRISE', taxRate: 0, timezone: 'UTC' },
  });

  const room = await prisma.room.create({
    data: { tenantId, number: '601', name: 'Lagoon', basePrice: 5000 },
  });
  const guest = await prisma.guest.create({
    data: { tenantId, firstName: 'Rafi', lastName: 'Ahmed', email: `guest-${slug}@test.com` },
  });

  await prisma.booking.create({
    data: {
      tenantId, roomId: room.id, guestId: guest.id,
      checkIn: new Date(`${STAY_IN}T00:00:00Z`), checkOut: new Date(`${STAY_OUT}T00:00:00Z`),
      totalAmount: 10000, status: 'CHECKED_OUT' as never,
      confirmationNo: `RP-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  });

  // One payment on the window's first instant, one on the first instant after
  // it. Only the first belongs to the window.
  await prisma.payment.create({
    data: {
      tenantId, amount: 500, method: 'CASH' as never, status: 'PAID' as never,
      processedAt: new Date(`${WINDOW_FROM}T00:00:00.000Z`),
    },
  });
  await prisma.payment.create({
    data: {
      tenantId, amount: 999, method: 'CASH' as never, status: 'PAID' as never,
      processedAt: new Date('2026-09-07T00:00:00.000Z'),
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('a custom range', () => {
  it('includes both ends', async () => {
    const { status, body } = await period(`from=${WINDOW_FROM}&to=${WINDOW_TO}`);
    expect(status).toBe(200);
    expect(body.data.period).toMatchObject({
      kind: 'custom', from: WINDOW_FROM, to: WINDOW_TO, dayCount: WINDOW_DAYS,
    });
  });

  it('counts the nights a stay actually sold, not the rooms occupied right now', async () => {
    const { body } = await period(`from=${WINDOW_FROM}&to=${WINDOW_TO}`);
    const { occupancy } = body.data;

    // One active room over six days. The stay covers two of those nights, so
    // live room status — which would say either 0 or 6 — is the wrong answer.
    expect(occupancy.availableRoomNights).toBe(WINDOW_DAYS);
    expect(occupancy.occupiedRoomNights).toBe(STAY_NIGHTS);
    expect(occupancy.rate).toBe(Math.round((STAY_NIGHTS / WINDOW_DAYS) * 1000) / 10);
  });

  it('counts only the night a one-day window covers', async () => {
    const { body } = await period('from=2026-09-04&to=2026-09-04');
    expect(body.data.occupancy.occupiedRoomNights).toBe(1);
    expect(body.data.period.kind).toBe('daily');
  });

  it('excludes a stay that ends where the window begins', async () => {
    // The stay's last night is 4 Sep; it is gone by the 5th.
    const { body } = await period(`from=${STAY_OUT}&to=${STAY_OUT}`);
    expect(body.data.occupancy.occupiedRoomNights).toBe(0);
  });

  it('takes the first instant of the window and leaves the one after it', async () => {
    const { body } = await period(`from=${WINDOW_FROM}&to=${WINDOW_TO}`);
    // 500 is on the opening instant; 999 is on the first instant after the
    // window and must not be here. A `lte 23:59:59.999` end bound is what this
    // guards against.
    expect(body.data.financial.cashCollected.total).toBe(500);
  });
});

describe('a week', () => {
  it('answers with the Monday to Sunday week the date falls in', async () => {
    // 2026-09-03 is a Thursday.
    const { status, body } = await period('week=2026-09-03');
    expect(status).toBe(200);
    expect(body.data.period).toMatchObject({
      kind: 'weekly', from: '2026-08-31', to: '2026-09-06', dayCount: 7,
    });
  });
});

describe('a quiet period', () => {
  it('answers with zeros rather than an error', async () => {
    const { status, body } = await period('from=2026-01-05&to=2026-01-06');
    expect(status).toBe(200);
    expect(body.data.financial.cashCollected.total).toBe(0);
    expect(body.data.occupancy.occupiedRoomNights).toBe(0);
    expect(body.data.arrivals).toEqual([]);
  });
});

describe('input the caller controls', () => {
  it('refuses a reversed range and says which field is wrong', async () => {
    const { status, body } = await period('from=2026-09-06&to=2026-09-01');
    expect(status).toBe(400);
    expect(body.field).toBe('to');
    expect(body.error).toBe('End date must be the same as or after start date.');
  });

  it('refuses a malformed date', async () => {
    const { status, body } = await period('from=01-09-2026&to=2026-09-06');
    expect(status).toBe(400);
    expect(body.field).toBe('from');
  });

  it('refuses a date that does not exist', async () => {
    const { status } = await period('from=2026-02-30&to=2026-02-30');
    expect(status).toBe(400);
  });

  it('refuses the future', async () => {
    const { status, body } = await period('from=2030-01-01&to=2030-01-02');
    expect(status).toBe(400);
    expect(body.field).toBe('range');
  });

  it('refuses a range past the cap', async () => {
    const { status, body } = await period('from=2024-01-01&to=2026-09-06');
    expect(status).toBe(400);
    expect(body.error).toContain('366');
  });

  it('refuses a half-given range', async () => {
    expect((await period('from=2026-09-01')).status).toBe(400);
    expect((await period('to=2026-09-06')).status).toBe(400);
  });
});

describe('the daily endpoint', () => {
  it('agrees with a one-day period', async () => {
    const day = '2026-09-04';
    const viaPeriod = await period(`from=${day}&to=${day}`);
    const viaDaily = await app.inject({
      method: 'GET', url: `/api/reports/daily?date=${day}`, headers: auth(),
    });
    expect(viaDaily.statusCode).toBe(200);

    const a = viaPeriod.body.data;
    const b = JSON.parse(viaDaily.body).data;
    expect(b.occupancy).toEqual(a.occupancy);
    expect(b.financial).toEqual(a.financial);
    expect(b.period.dayCount).toBe(1);
  });
});

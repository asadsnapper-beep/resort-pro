/**
 * Double-booking race condition test
 *
 * Fires N concurrent booking requests for the same room + dates.
 * The serializable transaction in bookings.ts must ensure exactly one
 * succeeds (201) and the rest get 409.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `race-test-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let roomId: string;

const CONCURRENT = 5;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Race Test Resort',
      slug,
      firstName: 'Race',
      lastName: 'Owner',
      email: `race-${slug}@test.com`,
      password,
    },
  });
  expect(reg.statusCode).toBe(201);
  const regBody = JSON.parse(reg.body);
  ownerToken = await verifyOwnerAndLogin(app, {
    tenantId: regBody.data.tenant.id,
    email: `race-${slug}@test.com`,
    password,
    slug,
  });
  await prisma.tenant.update({ where: { id: regBody.data.tenant.id }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });

  const roomRes = await app.inject({
    method: 'POST', url: '/api/rooms',
    headers: { Authorization: `Bearer ${ownerToken}` },
    payload: { number: 'RACE-101', name: 'Race Room 101', type: 'STANDARD', floor: 1, maxOccupancy: 2, basePrice: 3000 },
  });
  expect(roomRes.statusCode).toBe(201);
  roomId = JSON.parse(roomRes.body).data.id;
}, 15000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('Concurrent booking race condition', () => {
  it(`exactly 1 of ${CONCURRENT} simultaneous requests for the same room+dates succeeds`, async () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3);

    const checkInStr = checkIn.toISOString().split('T')[0];
    const checkOutStr = checkOut.toISOString().split('T')[0];

    const requests = Array.from({ length: CONCURRENT }, (_, i) =>
      app.inject({
        method: 'POST', url: '/api/bookings',
        headers: { Authorization: `Bearer ${ownerToken}` },
        payload: {
          roomId,
          guestFirstName: `Guest`,
          guestLastName: `${i + 1}`,
          guestEmail: `concurrent-${i}@test.com`,
          guestPhone: `017000000${i}0`,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          adults: 2,
          children: 0,
          paymentMethod: 'CASH',
        },
      })
    );

    const results = await Promise.all(requests);
    const statuses = results.map((r) => r.statusCode);

    const successes = statuses.filter((s) => s === 201);
    const conflicts = statuses.filter((s) => s === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(CONCURRENT - 1);
  });

  it('does not leave orphaned room status after failed races', async () => {
    // The room should still be queryable and not in a broken state
    const res = await app.inject({
      method: 'GET', url: `/api/rooms/${roomId}`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(['AVAILABLE', 'OCCUPIED']).toContain(body.data.status);
  });

  it('non-overlapping dates succeed independently after a conflict', async () => {
    const laterIn = new Date();
    laterIn.setDate(laterIn.getDate() + 30);
    const laterOut = new Date(laterIn);
    laterOut.setDate(laterOut.getDate() + 2);

    const res = await app.inject({
      method: 'POST', url: '/api/bookings',
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        roomId,
        guestFirstName: 'Later',
        guestLastName: 'Guest',
        guestEmail: 'later@test.com',
        guestPhone: '01799999999',
        checkIn: laterIn.toISOString().split('T')[0],
        checkOut: laterOut.toISOString().split('T')[0],
        adults: 1,
        children: 0,
        paymentMethod: 'CASH',
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

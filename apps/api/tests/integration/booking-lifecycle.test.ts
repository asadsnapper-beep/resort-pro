/**
 * Booking critical path integration tests
 *
 * Covers the full happy path:
 *   register → create room → create booking → check-in → add payment → check-out
 *
 * Also covers guard rails:
 *   - Cannot book a room that is already booked for overlapping dates (409)
 *   - Cannot check in a booking that is already checked in
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `booking-test-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let roomId: string;
let bookingId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register tenant
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Booking Test Resort',
      slug,
      firstName: 'Owner',
      lastName: 'Test',
      email: `owner-${slug}@test.com`,
      password,
    },
  });
  expect(reg.statusCode).toBe(201);
  const body = JSON.parse(reg.body);
  tenantId = body.data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, {
    tenantId,
    email: `owner-${slug}@test.com`,
    password,
    slug,
  });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });
}, 15000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

// ── Room setup ────────────────────────────────────────────────────────────────

describe('Room creation', () => {
  it('creates a room', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/rooms',
      headers: auth(),
      payload: {
        number: '101',
        name: 'Room 101',
        type: 'DELUXE',
        floor: 1,
        maxOccupancy: 2,
        basePrice: 5000,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    roomId = body.data.id;
    expect(roomId).toBeDefined();
    expect(body.data.tenantId).toBe(tenantId);
  });
});

// ── Booking lifecycle ─────────────────────────────────────────────────────────

describe('Booking lifecycle', () => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);

  const checkInStr = checkIn.toISOString().split('T')[0];
  const checkOutStr = checkOut.toISOString().split('T')[0];

  it('creates a booking', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/bookings',
      headers: auth(),
      payload: {
        roomId,
        guestFirstName: 'Rahim',
        guestLastName: 'Uddin',
        guestEmail: 'rahim@test.com',
        guestPhone: '01700000001',
        checkIn: checkInStr,
        checkOut: checkOutStr,
        adults: 2,
        children: 0,
        paymentMethod: 'CASH',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    bookingId = body.data.id;
    expect(bookingId).toBeDefined();
    expect(body.data.status).toBe('CONFIRMED');
    expect(body.data.tenantId).toBe(tenantId);
  });

  it('rejects a double booking for the same room and overlapping dates (409)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/bookings',
      headers: auth(),
      payload: {
        roomId,
        guestFirstName: 'Karim',
        guestLastName: 'Ahmed',
        guestEmail: 'karim@test.com',
        guestPhone: '01700000002',
        checkIn: checkInStr,
        checkOut: checkOutStr,
        adults: 1,
        children: 0,
        paymentMethod: 'CASH',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('allows booking the same room for non-overlapping dates', async () => {
    const futureIn = new Date(checkOut);
    futureIn.setDate(futureIn.getDate() + 1);
    const futureOut = new Date(futureIn);
    futureOut.setDate(futureOut.getDate() + 2);

    const res = await app.inject({
      method: 'POST', url: '/api/bookings',
      headers: auth(),
      payload: {
        roomId,
        guestFirstName: 'Fatema',
        guestLastName: 'Begum',
        guestEmail: 'fatema@test.com',
        guestPhone: '01700000003',
        checkIn: futureIn.toISOString().split('T')[0],
        checkOut: futureOut.toISOString().split('T')[0],
        adults: 2,
        children: 0,
        paymentMethod: 'CASH',
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('can get the booking', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/bookings/${bookingId}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(bookingId);
  });

  it('checks in the booking', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`,
      headers: auth(),
      payload: { deposit: 5000 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('CHECKED_IN');
  });

  it('cannot double check-in an already checked-in booking', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-in`,
      headers: auth(),
      payload: {},
    });
    // Must be a 4xx, not 200
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('checks out the booking', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingId}/check-out`,
      headers: auth(),
      payload: { additionalPayment: 0, paymentMethod: 'CASH' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('CHECKED_OUT');
  });

  it('room is available again after checkout', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/rooms/availability',
      headers: auth(),
      query: { checkIn: checkInStr, checkOut: checkOutStr },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // The room should show as available since the booking is CHECKED_OUT
    const room = body.data.find((r: { id: string }) => r.id === roomId);
    expect(room).toBeDefined();
  });
});

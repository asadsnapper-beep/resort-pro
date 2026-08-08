/**
 * Tenant isolation integration tests
 *
 * Two separate tenants are registered. Verifies that:
 *  - Tenant A cannot read Tenant B's rooms, bookings, guests, staff
 *  - Tenant A cannot modify Tenant B's resources
 *  - request.db (tenantPrisma) auto-scoping returns empty arrays, not 403
 *    (isolation at the data layer, not auth layer)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

const slugA = `tenant-a-${Date.now()}`;
const slugB = `tenant-b-${Date.now()}`;
const password = 'TestPass123!';

let tokenA: string;
let tokenB: string;
let tenantAId: string;
let tenantBId: string;
let roomAId: string;
let bookingAId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register Tenant A
  const regA = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Resort Alpha',
      slug: slugA,
      firstName: 'Alice',
      lastName: 'Owner',
      email: `alice-${slugA}@test.com`,
      password,
    },
  });
  expect(regA.statusCode).toBe(201);
  const bodyA = JSON.parse(regA.body);
  tokenA = bodyA.data.token;
  tenantAId = bodyA.data.tenant.id;

  // Register Tenant B
  const regB = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Resort Beta',
      slug: slugB,
      firstName: 'Bob',
      lastName: 'Owner',
      email: `bob-${slugB}@test.com`,
      password,
    },
  });
  expect(regB.statusCode).toBe(201);
  const bodyB = JSON.parse(regB.body);
  tokenB = bodyB.data.token;
  tenantBId = bodyB.data.tenant.id;
  await prisma.tenant.updateMany({ where: { id: { in: [tenantAId, tenantBId] } }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });
  await applyPlanFlagsToTenant(tenantAId, 'ENTERPRISE');
  await applyPlanFlagsToTenant(tenantBId, 'ENTERPRISE');

  // Tenant A creates a room
  const roomRes = await app.inject({
    method: 'POST', url: '/api/rooms',
    headers: { Authorization: `Bearer ${tokenA}` },
    payload: { number: 'A-101', name: 'Room A-101', type: 'DELUXE', floor: 1, maxOccupancy: 2, basePrice: 5000 },
  });
  expect(roomRes.statusCode).toBe(201);
  roomAId = JSON.parse(roomRes.body).data.id;

  // Tenant A creates a booking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 10);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const bookingRes = await app.inject({
    method: 'POST', url: '/api/bookings',
    headers: { Authorization: `Bearer ${tokenA}` },
    payload: {
      roomId: roomAId,
      guestFirstName: 'Alice',
      guestLastName: 'Guest',
      guestEmail: 'alice-guest@test.com',
      guestPhone: '01711111111',
      checkIn: tomorrow.toISOString().split('T')[0],
      checkOut: dayAfter.toISOString().split('T')[0],
      adults: 2,
      children: 0,
      paymentMethod: 'CASH',
    },
  });
  expect(bookingRes.statusCode).toBe(201);
  bookingAId = JSON.parse(bookingRes.body).data.id;
}, 20000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
  await app.close();
});

// ── Room isolation ─────────────────────────────────────────────────────────────

describe('Room isolation', () => {
  it("Tenant B cannot see Tenant A's rooms", async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/rooms',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const ids = body.data.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(roomAId);
  });

  it("Tenant B cannot get Tenant A's room by ID", async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/rooms/${roomAId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    // tenantPrisma returns null → route sends 404
    expect(res.statusCode).toBe(404);
  });

  it("Tenant B cannot update Tenant A's room", async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/rooms/${roomAId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { basePrice: 1 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Tenant B cannot delete Tenant A's room", async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/rooms/${roomAId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── Booking isolation ──────────────────────────────────────────────────────────

describe('Booking isolation', () => {
  it("Tenant B cannot see Tenant A's bookings in list", async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/bookings',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const ids = (body.data.bookings ?? body.data).map((b: { id: string }) => b.id);
    expect(ids).not.toContain(bookingAId);
  });

  it("Tenant B cannot get Tenant A's booking by ID", async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/bookings/${bookingAId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Tenant B cannot cancel Tenant A's booking", async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingAId}/cancel`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Tenant B cannot check in Tenant A's booking", async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/bookings/${bookingAId}/check-in`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── Data integrity: Tenant A still owns their data ────────────────────────────

describe('Tenant A data integrity after B attacks', () => {
  it("Tenant A can still read their own room", async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/rooms/${roomAId}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.tenantId).toBe(tenantAId);
  });

  it("Tenant A can still read their own booking", async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/bookings/${bookingAId}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.tenantId).toBe(tenantAId);
  });
});

// ── Unauthenticated access ─────────────────────────────────────────────────────

describe('Unauthenticated access', () => {
  it('returns 401 on rooms without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/rooms' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on bookings without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bookings' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on guests without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/guests' });
    expect(res.statusCode).toBe(401);
  });
});

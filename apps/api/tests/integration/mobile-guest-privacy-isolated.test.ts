import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { prisma } from '@resort-pro/database';
import { mobileGuestViewRoutes } from '../../src/routes/mobileGuestViews';

// This test creates fixtures and must never run against a developer or resort DB.
const isolated = process.env.MOBILE_PRIVACY_ISOLATED_DB === '1'
  && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL
  && /^postgresql:\/\/[^@]+@127\.0\.0\.1:\d+\/resortpro_privacy_test(?:\?|$)/.test(process.env.TEST_DATABASE_URL ?? '');

describe.skipIf(!isolated)('mobile guest privacy with isolated PostgreSQL', () => {
  it('restricts fields and rejects other tenants and stale roles', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const tenantA = await prisma.tenant.create({ data: { name: 'Test A', slug: `mobile-a-${suffix}` }, select: { id: true } });
    const tenantB = await prisma.tenant.create({ data: { name: 'Test B', slug: `mobile-b-${suffix}` }, select: { id: true } });
    const createUser = (tenantId: string, role: 'OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'STAFF' | 'SHAREHOLDER') => prisma.user.create({ data: { tenantId, role, email: `${role}-${suffix}@example.test`, passwordHash: 'synthetic-only', firstName: 'Test', lastName: role }, select: { id: true, tenantId: true, role: true } });
    const [owner, manager, reception, staff, shareholder, otherOwner] = await Promise.all([
      createUser(tenantA.id, 'OWNER'), createUser(tenantA.id, 'MANAGER'), createUser(tenantA.id, 'RECEPTIONIST'),
      createUser(tenantA.id, 'STAFF'), createUser(tenantA.id, 'SHAREHOLDER'), createUser(tenantB.id, 'OWNER'),
    ]);
    const guest = await prisma.guest.create({ data: { tenantId: tenantA.id, firstName: 'Privacy', lastName: 'Guest', email: `guest-${suffix}@example.test`, idNumber: 'PRIVATE-ID', notes: 'PRIVATE-NOTES' }, select: { id: true } });
    const room = await prisma.room.create({ data: { tenantId: tenantA.id, number: '101', name: 'Garden', basePrice: 1000, amenities: [], images: [], videos: [] }, select: { id: true } });
    const roomB = await prisma.room.create({ data: { tenantId: tenantB.id, number: '201', name: 'Other', basePrice: 1000, amenities: [], images: [], videos: [] }, select: { id: true } });
    const createBooking = (roomId: string, confirmationNo: string) => prisma.booking.create({ data: { tenantId: tenantA.id, guestId: guest.id, roomId, confirmationNo, checkIn: new Date('2026-11-01'), checkOut: new Date('2026-11-02'), totalAmount: 1000, paidAmount: 300 }, select: { id: true } });
    const booking = await createBooking(room.id, `ok-${suffix}`);
    const badRelation = await createBooking(roomB.id, `cross-${suffix}`);
    const app = Fastify();
    await app.register(jwt, { secret: 'integration-test-secret' });
    await app.register(mobileGuestViewRoutes, { prefix: '/api/mobile' });
    const get = (url: string, user: typeof owner, role = user.role) => app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${app.jwt.sign({ sub: user.id, tenantId: user.tenantId, role })}` } });
    const search = (user: typeof owner) => app.inject({ method: 'POST', url: '/api/mobile/guests/search', headers: { authorization: `Bearer ${app.jwt.sign({ sub: user.id, tenantId: user.tenantId, role: user.role })}` }, payload: { search: 'Privacy' } });
    try {
      const response = await search(reception);
      expect(response.headers['cache-control']).toContain('no-store');
      const list = response.json();
      expect(list.data).toHaveLength(1);
      expect(Object.keys(list.data[0]).sort()).toEqual(['firstName', 'id', 'lastName', 'phone']);
      expect((await search(otherOwner)).json().data).toEqual([]);
      const guestResponse = (await get(`/api/mobile/guests/${guest.id}`, reception)).json().data;
      expect(guestResponse.idNumber).toBeUndefined();
      expect(guestResponse.notes).toBeUndefined();
      expect(guestResponse.bookings.map((item: any) => item.id)).toEqual([booking.id]);
      expect(guestResponse.bookings[0].totalAmount).toBeUndefined();
      const receptionBooking = (await get(`/api/mobile/bookings/${booking.id}`, reception)).json().data;
      expect(receptionBooking.totalAmount).toBe('1000');
      expect(receptionBooking.paidAmount).toBe('300');
      for (const user of [owner, manager]) expect((await get(`/api/mobile/bookings/${booking.id}`, user)).json().data.totalAmount).toBe('1000');
      for (const user of [staff, shareholder]) expect((await get(`/api/mobile/guests/${guest.id}`, user)).statusCode).toBe(403);
      expect((await get(`/api/mobile/guests/${guest.id}`, otherOwner)).statusCode).toBe(404);
      expect((await get(`/api/mobile/bookings/${booking.id}`, otherOwner)).statusCode).toBe(404);
      expect((await get(`/api/mobile/bookings/${badRelation.id}`, owner)).statusCode).toBe(404);
      expect((await get(`/api/mobile/bookings/${booking.id}`, reception, 'OWNER')).statusCode).toBe(403);
      // Search uses POST to keep names and phone numbers out of URLs, but is read-only.
      await prisma.tenant.update({ where: { id: tenantA.id }, data: { planStatus: 'canceled' }, select: { id: true } });
      expect((await search(owner)).statusCode).toBe(200);
      await prisma.user.update({ where: { id: reception.id }, data: { role: 'STAFF' }, select: { id: true } });
      expect((await get(`/api/mobile/bookings/${booking.id}`, reception)).statusCode).toBe(403);
    } finally { await app.close(); }
  });
});

import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';

const fixtures = vi.hoisted(() => {
  const guest = { id: 'g-a', tenantId: 'tenant-a', firstName: 'Demo', lastName: 'Guest', phone: '1234', email: 'demo@example.test', idNumber: 'PRIVATE-ID', notes: 'PRIVATE-NOTES' };
  const room = { number: '101', name: 'Garden', tenantId: 'tenant-a' };
  const booking = { id: 'b-a', tenantId: 'tenant-a', confirmationNo: 'DEMO-1', status: 'CONFIRMED', checkIn: '2026-11-01', checkOut: '2026-11-02', adults: 2, children: 0, totalAmount: '2000', paidAmount: '500', paymentStatus: 'PARTIAL', guest, room, secret: 'PRIVATE' };
  return { guest, booking };
});

function project(row: any, select: Record<string, any>): any {
  return Object.fromEntries(Object.entries(select).flatMap(([key, spec]) => {
    if (spec === true) return [[key, row[key]]];
    if (!spec || !row[key]) return [];
    const value = Array.isArray(row[key]) ? row[key].map((entry: any) => project(entry, spec.select)) : project(row[key], spec.select);
    return [[key, value]];
  }));
}

vi.mock('@resort-pro/database', () => ({
  prisma: { user: { findUnique: async ({ where }: any) => ({ emailVerifiedAt: new Date(), isActive: true, tenantId: where.id.endsWith('-b') ? 'tenant-b' : 'tenant-a' }) } },
  tenantPrisma: (tenantId: string) => ({
    user: { findFirst: async ({ where }: any) => where.tenantId === tenantId ? { role: where.id.split('-')[1].toUpperCase() } : null },
    guest: {
      findMany: async ({ where, select }: any) => where.tenantId === tenantId && tenantId === 'tenant-a' ? [project(fixtures.guest, select)] : [],
      count: async ({ where }: any) => where.tenantId === tenantId && tenantId === 'tenant-a' ? 1 : 0,
      findFirst: async ({ where, select }: any) => {
        if (where.tenantId !== tenantId || tenantId !== 'tenant-a' || where.id !== fixtures.guest.id) return null;
        expect(select.bookings.where.tenantId).toBe(tenantId);
        return project({ ...fixtures.guest, bookings: [fixtures.booking] }, select);
      },
    },
    booking: { findFirst: async ({ where, select }: any) => {
      if (where.tenantId !== tenantId || tenantId !== 'tenant-a' || where.id !== fixtures.booking.id) return null;
      expect(where.guest.tenantId).toBe(tenantId);
      expect(where.room.tenantId).toBe(tenantId);
      return project(fixtures.booking, select);
    } },
  }),
}));

import { mobileGuestViewRoutes } from '../../src/routes/mobileGuestViews';

describe('mobile guest and booking privacy', () => {
  it('enforces authentication, roles, tenant boundaries and least-privilege fields', async () => {
    const app = Fastify();
    await app.register(jwt, { secret: 'test-secret-not-for-production' });
    await app.register(mobileGuestViewRoutes, { prefix: '/api/mobile' });
    const token = (role: string, tenant = 'tenant-a') => app.jwt.sign({ sub: `user-${role.toLowerCase()}-${tenant.endsWith('b') ? 'b' : 'a'}`, tenantId: tenant, role });
    const get = (url: string, role?: string, tenant?: string) => app.inject({ method: 'GET', url, headers: role ? { authorization: `Bearer ${token(role, tenant)}` } : {} });
    const search = (term: string, role?: string, tenant?: string) => app.inject({ method: 'POST', url: '/api/mobile/guests/search', headers: role ? { authorization: `Bearer ${token(role, tenant)}` } : {}, payload: { search: term } });

    expect((await search('Demo')).statusCode).toBe(401);
    for (const role of ['STAFF', 'SHAREHOLDER']) {
      expect((await search('Demo', role)).statusCode).toBe(403);
      for (const path of ['/api/mobile/guests/g-a', '/api/mobile/bookings/b-a']) {
        expect((await get(path, role)).statusCode).toBe(403);
      }
    }
    expect((await search('D', 'OWNER')).statusCode).toBe(400);
    const downgraded = app.jwt.sign({ sub: 'user-receptionist-a', tenantId: 'tenant-a', role: 'OWNER' });
    expect((await app.inject({ method: 'GET', url: '/api/mobile/bookings/b-a', headers: { authorization: `Bearer ${downgraded}` } })).statusCode).toBe(403);
    const searchResponse = await search('Demo', 'RECEPTIONIST');
    expect(searchResponse.headers['cache-control']).toContain('no-store');
    expect((await get('/api/mobile/bookings/b-a', 'STAFF')).headers['cache-control']).toContain('no-store');
    const list = searchResponse.json();
    expect(Object.keys(list.data[0]).sort()).toEqual(['firstName', 'id', 'lastName', 'phone']);
    const guest = (await get('/api/mobile/guests/g-a', 'RECEPTIONIST')).json().data;
    expect(guest.idNumber).toBeUndefined();
    expect(guest.notes).toBeUndefined();
    expect(guest.bookings[0].totalAmount).toBeUndefined();
    const reception = (await get('/api/mobile/bookings/b-a', 'RECEPTIONIST')).json().data;
    expect(reception.totalAmount).toBe('2000');
    expect(reception.paidAmount).toBe('500');
    expect(reception.paymentStatus).toBe('PARTIAL');
    expect(reception.guest.idNumber).toBeUndefined();
    for (const role of ['OWNER', 'MANAGER']) {
      const data = (await get('/api/mobile/bookings/b-a', role)).json().data;
      expect(data.totalAmount).toBe('2000');
      expect(data.paidAmount).toBe('500');
    }
    expect((await get('/api/mobile/guests/g-a', 'OWNER', 'tenant-b')).statusCode).toBe(404);
    expect((await get('/api/mobile/bookings/b-a', 'OWNER', 'tenant-b')).statusCode).toBe(404);
    expect((await search('Demo', 'OWNER', 'tenant-b')).json().data).toEqual([]);
    await app.close();
  });
});

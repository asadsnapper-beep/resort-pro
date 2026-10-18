/**
 * Looking at one property's rooms.
 *
 * Rooms could be assigned to a property, and the Rooms page still listed every
 * room in the account with counts across all of them. With a property chosen in
 * the top bar, the list and its counts narrow to that property; with none, the
 * page behaves exactly as it always did.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `prop-scope-${Date.now()}`;
const otherSlug = `${slug}-other`;
const password = 'TestPass123!';
let token: string;
let beach: string;
let hill: string;
let otherTenantProperty: string;

const get = (url: string, propertyId?: string) => app.inject({
  method: 'GET', url,
  headers: { Authorization: `Bearer ${token}`, ...(propertyId && { 'x-property-id': propertyId }) },
});
const numbers = async (propertyId?: string) =>
  (JSON.parse((await get('/api/rooms?limit=100', propertyId)).body).data as { number: string }[])
    .map((r) => r.number).sort();

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Property Scope', slug, firstName: 'Owner', lastName: 'Test', email: `owner-${slug}@test.com`, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'PROFESSIONAL' } });

  beach = (await prisma.property.create({ data: { tenantId, name: 'Beach', slug: 'beach' } })).id;
  hill = (await prisma.property.create({ data: { tenantId, name: 'Hill', slug: 'hill' } })).id;
  await prisma.room.createMany({
    data: [
      { tenantId, propertyId: beach, number: 'B1', name: 'Beach 1', basePrice: 3000, status: 'AVAILABLE' },
      { tenantId, propertyId: beach, number: 'B2', name: 'Beach 2', basePrice: 3000, status: 'OCCUPIED' },
      { tenantId, propertyId: hill, number: 'H1', name: 'Hill 1', basePrice: 2500, status: 'AVAILABLE' },
      { tenantId, number: 'U1', name: 'Unassigned', basePrice: 2000, status: 'AVAILABLE' },
    ],
  });

  const other = await prisma.tenant.create({ data: { name: 'Other', slug: otherSlug, planStatus: 'active' } });
  otherTenantProperty = (await prisma.property.create({ data: { tenantId: other.id, name: 'Theirs', slug: 'theirs' } })).id;
  await prisma.room.create({ data: { tenantId: other.id, propertyId: otherTenantProperty, number: 'X1', name: 'Theirs', basePrice: 1 } });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { in: [slug, otherSlug] } } });
  await app.close();
});

describe('the room list', () => {
  it('shows every room when no property is chosen, as before', async () => {
    expect(await numbers()).toEqual(['B1', 'B2', 'H1', 'U1']);
  });

  it('shows only the chosen property\'s rooms', async () => {
    expect(await numbers(beach)).toEqual(['B1', 'B2']);
    expect(await numbers(hill)).toEqual(['H1']);
  });

  it('shows nothing — and nothing of theirs — for another resort\'s property', async () => {
    expect(await numbers(otherTenantProperty)).toEqual([]);
  });

  it('ignores a header that is not an id, instead of emptying the page', async () => {
    expect(await numbers('all')).toEqual(['B1', 'B2', 'H1', 'U1']);
  });
});

describe('the room counts', () => {
  it('count one property when one is chosen', async () => {
    const stats = JSON.parse((await get('/api/rooms/stats', beach)).body).data;
    expect(stats.total).toBe(2);
    expect(stats.available).toBe(1);
    expect(stats.occupied).toBe(1);
  });

  it('count everything when none is chosen', async () => {
    const stats = JSON.parse((await get('/api/rooms/stats')).body).data;
    expect(stats.total).toBe(4);
  });
});

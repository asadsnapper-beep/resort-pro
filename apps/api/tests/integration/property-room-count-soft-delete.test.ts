/**
 * Deleting a property whose rooms are already gone.
 *
 * Room deletion is a soft delete — the row stays with `isActive: false` — but
 * the property room count was unfiltered, so a deleted room still counted. Two
 * things followed from that. The property card showed "1 room" next to an empty
 * status breakdown, the two numbers on one card disagreeing; and the delete
 * guard refused forever, because the rooms blocking the delete were already
 * invisible on every page that could have cleared them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `prop-room-count-${Date.now()}`;
const email = `owner-${slug}@test.com`;
const password = 'TestPass123!';
let token: string;
let propertyId: string;
let roomId: string;

const auth = () => ({ Authorization: `Bearer ${token}` });

/** The count the property list puts on the card, plus its status breakdown. */
const fromList = async () => {
  const res = await app.inject({ method: 'GET', url: '/api/properties?limit=100', headers: auth() });
  expect(res.statusCode, res.body).toBe(200);
  const row = (JSON.parse(res.body).data as {
    id: string; _count: { rooms: number }; roomStats: Record<string, number>;
  }[]).find((p) => p.id === propertyId);
  expect(row, 'the property is missing from the list').toBeDefined();
  return row!;
};

/** The count the single-property route reports. */
const fromDetail = async () => {
  const res = await app.inject({ method: 'GET', url: `/api/properties/${propertyId}`, headers: auth() });
  expect(res.statusCode, res.body).toBe(200);
  return (JSON.parse(res.body).data as { _count: { rooms: number } })._count.rooms;
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Room Count', slug, firstName: 'Owner', lastName: 'Test', email, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });

  const created = await app.inject({
    method: 'POST', url: '/api/properties', headers: auth(),
    payload: { name: 'Lone Villa', slug: 'lone-villa' },
  });
  expect(created.statusCode, created.body).toBe(201);
  propertyId = JSON.parse(created.body).data.id;

  // The rooms route has no propertyId field, so assignment is written directly —
  // the same shape the dashboard's assignment path leaves behind.
  roomId = (await prisma.room.create({
    data: { tenantId, propertyId, number: 'L1', name: 'Lone 1', basePrice: 4000, status: 'AVAILABLE' },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('a property whose only room is soft-deleted', () => {
  it('counts the room while it is still there', async () => {
    const row = await fromList();
    expect(row._count.rooms).toBe(1);
    expect(row.roomStats).toEqual({ AVAILABLE: 1 });
    expect(await fromDetail()).toBe(1);
  });

  it('reports 0 rooms once the room is deleted', async () => {
    const del = await app.inject({ method: 'DELETE', url: `/api/rooms/${roomId}`, headers: auth() });
    expect(del.statusCode, del.body).toBe(200);

    // The row is still there, inactive — this is a soft delete, not a removal.
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { isActive: true } });
    expect(room?.isActive).toBe(false);

    const row = await fromList();
    expect(row._count.rooms).toBe(0);
    // The count and the breakdown on the same card now agree.
    expect(row.roomStats).toEqual({});
    expect(await fromDetail()).toBe(0);
  });

  it('can then be deleted, instead of being blocked forever', async () => {
    const del = await app.inject({ method: 'DELETE', url: `/api/properties/${propertyId}`, headers: auth() });
    expect(del.statusCode, del.body).toBe(200);

    const gone = await app.inject({ method: 'GET', url: `/api/properties/${propertyId}`, headers: auth() });
    expect(gone.statusCode).toBe(404);
  });
});

describe('a property with a live room', () => {
  it('is still refused, with the active count in the message', async () => {
    const tenantId = (await prisma.tenant.findFirstOrThrow({ where: { slug }, select: { id: true } })).id;
    const kept = await prisma.property.create({ data: { tenantId, name: 'Busy', slug: 'busy' } });
    await prisma.room.create({
      data: { tenantId, propertyId: kept.id, number: 'K1', name: 'Kept 1', basePrice: 2000 },
    });
    // One deleted room alongside it must not inflate the number in the message.
    await prisma.room.create({
      data: { tenantId, propertyId: kept.id, number: 'K2', name: 'Kept 2', basePrice: 2000, isActive: false },
    });

    const del = await app.inject({ method: 'DELETE', url: `/api/properties/${kept.id}`, headers: auth() });
    expect(del.statusCode).toBe(409);
    expect(JSON.parse(del.body).error).toContain('1 room(s)');
  });
});

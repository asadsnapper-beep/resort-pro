/**
 * The property a room is assigned to, and whether it survives the save.
 *
 * The Add/Edit Room modal loads the tenant's properties, offers a selector,
 * and sends `propertyId` on every save. The API's room schema did not declare
 * the field, so Zod stripped it: 201 came back, the modal closed as though it
 * had worked, and the row was written with `propertyId: null`. The selector is
 * only rendered when the tenant has properties, so the one group of customers
 * who could see it was the only group it failed for — and every room list
 * already narrows by `propertyScope()`, so those rooms were filterable by a
 * property they could never be given. (Room Management QA 2026-10-28, RM-002.)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-prop-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let beachId: string;
let lodgeId: string;
let retiredId: string;
let otherTenantPropertyId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

let n = 0;
const roomPayload = (over: Record<string, unknown> = {}) => ({
  number: `${100 + n++}`,
  name: 'Test Room',
  type: 'STANDARD',
  maxOccupancy: 2,
  basePrice: 2500,
  ...over,
});

const createRoom = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/rooms', headers: auth(), payload });

const patchRoom = (id: string, payload: Record<string, unknown>) =>
  app.inject({ method: 'PATCH', url: `/api/rooms/${id}`, headers: auth(), payload });

const storedPropertyId = (roomId: string) =>
  prisma.room.findUnique({ where: { id: roomId }, select: { propertyId: true } })
    .then(r => r?.propertyId ?? null);

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Property Test', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });

  const property = (name: string, slug: string, isActive = true) =>
    prisma.property.create({ data: { tenantId, name, slug, isActive } }).then(p => p.id);

  beachId = await property('Beach Villa', 'beach-villa');
  lodgeId = await property('Mountain Lodge', 'mountain-lodge');
  retiredId = await property('Old Wing', 'old-wing', false);

  const stranger = await prisma.tenant.create({ data: { name: 'Stranger', slug: `${run}-other` } });
  otherTenantPropertyId = (await prisma.property.create({
    data: { tenantId: stranger.id, name: 'Not Yours', slug: 'not-yours' },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('creating a room in a property', () => {
  it('stores the property that was chosen', async () => {
    // The bug in one assertion: this returned 201 with propertyId null.
    const res = await createRoom(roomPayload({ propertyId: beachId }));
    expect(res.statusCode).toBe(201);
    expect(body(res).data.propertyId).toBe(beachId);
    expect(await storedPropertyId(body(res).data.id)).toBe(beachId);
  });

  it('returns the stored value, so the UI does not have to guess', async () => {
    const res = await createRoom(roomPayload({ propertyId: lodgeId }));
    expect(body(res).data.propertyId).toBe(lodgeId);
  });

  it('accepts a room with no property at all', async () => {
    // A single-property resort never sees the selector, and the modal sends
    // null when nothing is chosen. That has to stay a normal save.
    const res = await createRoom(roomPayload({ propertyId: null }));
    expect(res.statusCode).toBe(201);
    expect(body(res).data.propertyId).toBeNull();
  });

  it('accepts a room created without mentioning a property', async () => {
    const res = await createRoom(roomPayload());
    expect(res.statusCode).toBe(201);
    expect(body(res).data.propertyId).toBeNull();
  });
});

describe('moving a room between properties', () => {
  it('reassigns it', async () => {
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    const res = await patchRoom(id, { propertyId: lodgeId });
    expect(res.statusCode).toBe(200);
    expect(body(res).data.propertyId).toBe(lodgeId);
    expect(await storedPropertyId(id)).toBe(lodgeId);
  });

  it('unassigns it when sent null', async () => {
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    expect(body(await patchRoom(id, { propertyId: null })).data.propertyId).toBeNull();
    expect(await storedPropertyId(id)).toBeNull();
  });

  it('leaves the assignment alone when the field is not sent', async () => {
    // Renaming a room must not quietly move it out of its property.
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    await patchRoom(id, { name: 'Renamed Room' });
    expect(await storedPropertyId(id)).toBe(beachId);
  });

  it('round-trips through the detail route the modal reads on edit', async () => {
    // The modal fills its selector from this payload. While the write was
    // being dropped it always read null, so an owner editing a room saw no
    // property selected however many times they had set one.
    const id = body(await createRoom(roomPayload({ propertyId: lodgeId }))).data.id;
    const res = await app.inject({ method: 'GET', url: `/api/rooms/${id}`, headers: auth() });
    expect(body(res).data.propertyId).toBe(lodgeId);
  });
});

describe('a property it may not use', () => {
  it('refuses another tenant\'s property', async () => {
    // The id is real, and belongs to someone else. It must be refused in the
    // same words as one that does not exist — anything else confirms it is a
    // real property to a caller guessing ids.
    const res = await createRoom(roomPayload({ propertyId: otherTenantPropertyId }));
    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('PROPERTY_NOT_FOUND');
  });

  it('writes no room when it refuses one', async () => {
    const payload = roomPayload({ propertyId: otherTenantPropertyId });
    await createRoom(payload);
    const room = await prisma.room.findFirst({ where: { tenantId, number: String(payload.number) } });
    expect(room).toBeNull();
  });

  it('refuses a property that has been retired', async () => {
    // Inventory assigned to an inactive property sits where no dashboard view
    // will show it.
    const res = await createRoom(roomPayload({ propertyId: retiredId }));
    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('PROPERTY_NOT_FOUND');
  });

  it('refuses a property id that does not exist', async () => {
    const res = await createRoom(roomPayload({ propertyId: '00000000-0000-4000-8000-000000000000' }));
    expect(res.statusCode).toBe(400);
    expect(body(res).code).toBe('PROPERTY_NOT_FOUND');
  });

  it('tells a malformed id apart from an unknown one', async () => {
    // Both are 400, but they are different answers and the UI shows them
    // differently: a slug in the field is the form's own mistake and comes
    // back as a field-level validation error, while a well-formed id nobody
    // owns is a lookup that found nothing. Without the format check a slug
    // would reach the database and be reported as a missing property, which
    // sends an owner looking for a property that was never the problem.
    const malformed = await createRoom(roomPayload({ propertyId: 'beach-villa' }));
    expect(malformed.statusCode).toBe(400);
    expect(body(malformed).error).toBe('Validation failed');
    expect(body(malformed).details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'propertyId' })]),
    );
    expect(body(malformed).code).toBeUndefined();

    const unknown = await createRoom(roomPayload({ propertyId: '00000000-0000-4000-8000-000000000000' }));
    expect(body(unknown).code).toBe('PROPERTY_NOT_FOUND');
    expect(body(unknown).error).not.toBe('Validation failed');
  });

  it('does not move a room to a property it may not use', async () => {
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    const res = await patchRoom(id, { propertyId: otherTenantPropertyId });
    expect(res.statusCode).toBe(400);
    expect(await storedPropertyId(id)).toBe(beachId);
  });

  it('does not move a room to a retired property', async () => {
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    expect((await patchRoom(id, { propertyId: retiredId })).statusCode).toBe(400);
    expect(await storedPropertyId(id)).toBe(beachId);
  });
});

describe('the lists that narrow by property', () => {
  it('finds a room under the property it was given', async () => {
    // propertyScope() reads X-Property-Id and filters on it. This is what the
    // assignment is for, and what could not work before.
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    const res = await app.inject({
      method: 'GET', url: '/api/rooms',
      headers: { ...auth(), 'X-Property-Id': beachId },
    });
    const ids = body(res).data.map((r: { id: string }) => r.id);
    expect(ids).toContain(id);
  });

  it('does not find it under a different property', async () => {
    const id = body(await createRoom(roomPayload({ propertyId: beachId }))).data.id;
    const res = await app.inject({
      method: 'GET', url: '/api/rooms',
      headers: { ...auth(), 'X-Property-Id': lodgeId },
    });
    expect(body(res).data.map((r: { id: string }) => r.id)).not.toContain(id);
  });

  it('counts it in that property\'s statistics', async () => {
    const before = body(await app.inject({
      method: 'GET', url: '/api/rooms/stats',
      headers: { ...auth(), 'X-Property-Id': lodgeId },
    })).data;
    await createRoom(roomPayload({ propertyId: lodgeId }));
    const after = body(await app.inject({
      method: 'GET', url: '/api/rooms/stats',
      headers: { ...auth(), 'X-Property-Id': lodgeId },
    })).data;
    expect(after.total).toBe(before.total + 1);
  });
});

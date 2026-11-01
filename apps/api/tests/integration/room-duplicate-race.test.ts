/**
 * What happens when two people create the same room number at the same time.
 *
 * `POST /api/rooms` read for an existing number and then created. The database
 * has `@@unique([tenantId, number])`, so the data was never actually
 * corrupted — but nothing caught the constraint's refusal, and Prisma's P2002
 * reached the error handler as an unhandled error. The audit fired four
 * simultaneous creates and got one 201 and at least one **500**.
 * (Room Management QA 2026-10-28, RM-007.)
 *
 * A 500 is the wrong answer to this in a way that matters beyond tidiness: it
 * tells the caller the server broke, so clients retry it, and front-desk staff
 * double-clicking a slow button are exactly the people who generate the race
 * in the first place. A 409 tells them the truth — someone already has that
 * number — and is safe to show and safe not to retry.
 *
 * These tests assert the invariant rather than the race: however the requests
 * interleave, exactly one must be created, every other must be refused with
 * 409, and none may answer 5xx. That holds whether or not the window is hit on
 * a given run, so the suite does not flake — but it was confirmed to fail
 * against the unfixed code before the fix was written.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-race-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

const createRoom = (number: string) =>
  app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: { number, name: `Room ${number}`, type: 'STANDARD', maxOccupancy: 2, basePrice: 2500 },
  });

const renameRoom = (id: string, number: string) =>
  app.inject({
    method: 'PATCH', url: `/api/rooms/${id}`, headers: auth(), payload: { number },
  });

const storedWithNumber = (number: string) =>
  prisma.room.count({ where: { tenantId, number } });

/** How many answers fell in each status class, for readable failures. */
const tally = (results: { statusCode: number }[]) => ({
  created:  results.filter(r => r.statusCode === 201 || r.statusCode === 200).length,
  refused:  results.filter(r => r.statusCode === 409).length,
  serverErrors: results.filter(r => r.statusCode >= 500).length,
  statuses: results.map(r => r.statusCode).sort(),
});

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Race', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });
  // ENTERPRISE so the plan's room ceiling can never be what refuses a request
  // here — this suite is about the uniqueness race, nothing else.
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('two people creating the same room number at once', () => {
  it('creates one and refuses the rest, without a single 500', async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => createRoom('900')));
    const seen = tally(results);

    expect(seen.serverErrors, `statuses: ${seen.statuses}`).toBe(0);
    expect(seen.created,      `statuses: ${seen.statuses}`).toBe(1);
    expect(seen.refused,      `statuses: ${seen.statuses}`).toBe(3);
    expect(await storedWithNumber('900')).toBe(1);
  }, 20000);

  it('holds over repeated attempts, so the answer is not luck', async () => {
    // The interleaving is not deterministic; a single pass can miss the window
    // entirely. Several rounds on fresh numbers make hitting it likely, and
    // the invariant is asserted on every round either way.
    for (let round = 0; round < 5; round++) {
      const number = `91${round}`;
      const results = await Promise.all([1, 2, 3].map(() => createRoom(number)));
      const seen = tally(results);

      expect(seen.serverErrors, `round ${round}, statuses: ${seen.statuses}`).toBe(0);
      expect(seen.created,      `round ${round}, statuses: ${seen.statuses}`).toBe(1);
      expect(await storedWithNumber(number)).toBe(1);
    }
  }, 40000);

  it('says the same thing however the request lost', async () => {
    // Whether a request is turned away by the pre-check or by the constraint
    // is an implementation detail and a timing accident. A client cannot
    // branch on it, so the two must be indistinguishable.
    await createRoom('920');
    const refused = await createRoom('920');

    expect(refused.statusCode).toBe(409);
    expect(body(refused).code).toBe('ROOM_NUMBER_TAKEN');
    expect(body(refused).error).toContain('920');
  });
});

describe('two people renaming rooms onto the same number at once', () => {
  it('lets one through and refuses the rest, without a 500', async () => {
    // The update path has the same read-then-write shape as create, and the
    // same constraint behind it.
    const ids = await Promise.all(['930', '931', '932'].map(async n => {
      const res = await createRoom(n);
      expect(res.statusCode).toBe(201);
      return body(res).data.id as string;
    }));

    const results = await Promise.all(ids.map(id => renameRoom(id, '940')));
    const seen = tally(results);

    expect(seen.serverErrors, `statuses: ${seen.statuses}`).toBe(0);
    expect(seen.created,      `statuses: ${seen.statuses}`).toBe(1);
    expect(await storedWithNumber('940')).toBe(1);
  }, 20000);

  it('refuses a rename onto a number that is plainly taken', async () => {
    await createRoom('950');
    const other = await createRoom('951');

    const res = await renameRoom(body(other).data.id, '950');

    expect(res.statusCode).toBe(409);
    expect(body(res).code).toBe('ROOM_NUMBER_TAKEN');
  });

  it('still lets a room keep its own number', async () => {
    // Renaming a room to what it already is must not collide with itself.
    const res = await createRoom('960');
    const id = body(res).data.id as string;

    const again = await renameRoom(id, '960');

    expect(again.statusCode).toBe(200);
  });
});

describe('ordinary room creation is untouched', () => {
  it('still creates a room with a free number', async () => {
    const res = await createRoom('970');

    expect(res.statusCode).toBe(201);
    expect(body(res).data.number).toBe('970');
  });
});

/**
 * Whether a resort can end up with more rooms than its plan allows.
 *
 * RM-007 was two races wearing one name. The uniqueness half is closed: a
 * duplicate room number is caught by `@@unique([tenantId, number])` and
 * translated into a 409, because the database decides and the handler only
 * reports. The plan ceiling has no such constraint. It is
 *
 *     const { allowed } = await checkRoomLimit(tenantId);   // a COUNT
 *     ...
 *     await db.room.create({ data: body });                 // an INSERT
 *
 * with nothing holding the two together, so every request in flight reads the
 * same count, every one of them is under the ceiling, and every one of them
 * inserts. A resort on a five-room plan finishes with eight rooms and nothing
 * in the system ever notices — the ceiling is only consulted on the way in.
 * (Room Management QA 2026-10-28, RM-007.)
 *
 * Two of these are the shapes a customer actually produces: a double-clicked
 * Add Room button, and a client that retries a request whose response it never
 * saw. Neither is adversarial, and the free plan is where it matters most,
 * because that is the ceiling somebody is sitting exactly against.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { PLAN_PRICING } from '@resort-pro/types';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-quota-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

/** The ceiling this test is about, read from the plan rather than retyped. */
const FREE_ROOMS = PLAN_PRICING.FREE.roomLimit;

let n = 0;
const create = (number?: string) =>
  app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: {
      number: number ?? `Q${n++}`, name: 'Quota Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 2500,
    },
  });

const roomCount = () => prisma.room.count({ where: { tenantId, isActive: true } });

/** Put the tenant back on exactly `target` active rooms between cases. */
const trimTo = async (target: number) => {
  const rooms = await prisma.room.findMany({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const doomed = rooms.slice(target).map(r => r.id);
  if (doomed.length > 0) {
    await prisma.room.deleteMany({ where: { id: { in: doomed } } });
  }
  while ((await roomCount()) < target) {
    const res = await create();
    if (res.statusCode !== 201) throw new Error(`top-up failed: ${res.body}`);
  }
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Quota', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });

  // FREE on purpose: the smallest ceiling, and the one a real customer sits
  // against. A new tenant is on it already; this is here so the test does not
  // depend on that staying true.
  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'FREE', planStatus: 'active' },
  });
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('the ceiling holds one request at a time', () => {
  it('allows rooms up to the plan limit', async () => {
    await trimTo(0);

    for (let i = 0; i < FREE_ROOMS; i++) {
      const res = await create();
      expect(res.statusCode, `room ${i + 1} of ${FREE_ROOMS}: ${res.body}`).toBe(201);
    }

    expect(await roomCount()).toBe(FREE_ROOMS);
  }, 30000);

  it('refuses the one after that, naming the limit', async () => {
    const res = await create();

    expect(res.statusCode).toBe(403);
    expect(body(res).code).toBe('ROOM_LIMIT_REACHED');
    expect(await roomCount()).toBe(FREE_ROOMS);
  });
});

describe('the ceiling holds when requests arrive together', () => {
  it('lets exactly one through when there is one place left', async () => {
    /*
      The double-clicked button. Both requests read a count of four against a
      ceiling of five, both are under it, and both insert — so the resort ends
      up on six rooms, one more than it pays for, with no error anywhere and
      nothing that will ever reconcile it.

      **This case is the realistic one, not the reliable one.** Measured
      against the unmodified code it over-created on two attempts out of
      three; on the third the two requests happened not to overlap and it
      passed. The larger bursts below are what actually hold this gate, and
      they failed every time. Said here so nobody reads a green run of this
      single case as proof.
    */
    await trimTo(FREE_ROOMS - 1);

    const results = await Promise.all([create(), create()]);
    const created = results.filter(r => r.statusCode === 201);
    const refused = results.filter(r => r.statusCode === 403);

    expect(created, results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(await roomCount()).toBe(FREE_ROOMS);
  }, 30000);

  it('lets exactly one through out of eight at once', async () => {
    // The same thing with the volume turned up: a retry storm, or a script.
    await trimTo(FREE_ROOMS - 1);

    const results = await Promise.all(Array.from({ length: 8 }, () => create()));
    const created = results.filter(r => r.statusCode === 201);

    expect(created).toHaveLength(1);
    expect(await roomCount()).toBe(FREE_ROOMS);
  }, 30000);

  it('refuses all of them when the resort is already at its ceiling', async () => {
    await trimTo(FREE_ROOMS);

    const results = await Promise.all(Array.from({ length: 5 }, () => create()));

    expect(results.every(r => r.statusCode === 403)).toBe(true);
    expect(await roomCount()).toBe(FREE_ROOMS);
  }, 30000);

  it('fills the remaining places and no more', async () => {
    // Three places left, six requests. Not a single-winner case: the point is
    // that the ceiling is a ceiling, not that concurrency is serialised away.
    await trimTo(FREE_ROOMS - 3);

    const results = await Promise.all(Array.from({ length: 6 }, () => create()));
    const created = results.filter(r => r.statusCode === 201);

    expect(created).toHaveLength(3);
    expect(await roomCount()).toBe(FREE_ROOMS);
  }, 30000);

  it('does not answer 500 to any of the losers', async () => {
    // A refusal that leaks as a 500 tells the caller the server broke, and
    // clients retry those — the same reasoning as the duplicate-number half
    // of this finding, which used to answer 500 and now answers 409.
    await trimTo(FREE_ROOMS - 1);

    const results = await Promise.all(Array.from({ length: 6 }, () => create()));

    for (const res of results) {
      expect(res.statusCode, res.body).toBeLessThan(500);
    }
    expect(results.filter(r => r.statusCode === 403).length).toBe(5);
  }, 30000);
});

describe('an unlimited plan is not accidentally limited by this', () => {
  it('lets an Enterprise resort create many rooms at once', async () => {
    // roomLimit is -1 there, and a counted write must not turn "no ceiling"
    // into a ceiling of its own, nor serialise what used to be parallel.
    await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'ENTERPRISE' } });
    await trimTo(FREE_ROOMS);

    const results = await Promise.all(Array.from({ length: 6 }, () => create()));

    expect(results.every(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toBe(true);
    expect(await roomCount()).toBe(FREE_ROOMS + 6);

    await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'FREE' } });
  }, 30000);
});

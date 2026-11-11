/**
 * Whether a resort can end up with more properties than its plan allows.
 *
 * The same shape as the room ceiling (RM-007), in a second place:
 *
 *     const limitCheck = await checkPropertyLimit(tenantId);  // a COUNT
 *     ...
 *     await db.property.create({ data: { tenantId, ...body } }); // an INSERT
 *
 * with nothing holding the two together. Every request in flight reads the
 * same count, every one is under the ceiling, and every one inserts. There is
 * no `propertyLimit` constraint a database could enforce, and nothing later
 * reconciles the count, because the ceiling is only consulted on the way in.
 *
 * The duplicate-slug half is different: `@@unique([tenantId, slug])` already
 * decides it, so the only question is whether the loser is told 409 or leaks
 * a 500 — which is what the pre-flight `findFirst` cannot prevent on its own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { PLAN_PRICING } from '@resort-pro/types';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `prop-quota-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

/** The ceilings this test is about, read from the plans rather than retyped. */
const FREE_PROPERTIES = PLAN_PRICING.FREE.propertyLimit;
const PRO_PROPERTIES = PLAN_PRICING.PROFESSIONAL.propertyLimit;

let n = 0;
const create = (slug?: string) =>
  app.inject({
    method: 'POST', url: '/api/properties', headers: auth(),
    payload: { name: 'Quota Villa', slug: slug ?? `${run}-p${n++}` },
  });

const propertyCount = () => prisma.property.count({ where: { tenantId } });

/** Put the tenant on exactly `target` properties between cases. */
const trimTo = async (target: number) => {
  const rows = await prisma.property.findMany({
    where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true },
  });
  const doomed = rows.slice(target).map(r => r.id);
  if (doomed.length > 0) await prisma.property.deleteMany({ where: { id: { in: doomed } } });

  while ((await propertyCount()) < target) {
    const res = await create();
    if (res.statusCode !== 201) throw new Error(`top-up failed: ${res.body}`);
  }
};

const setPlan = (plan: string) =>
  prisma.tenant.update({ where: { id: tenantId }, data: { plan } });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Property Quota', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });

  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'FREE', planStatus: 'active' },
  });
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('the ceiling holds one request at a time', () => {
  it('allows properties up to the plan limit', async () => {
    await setPlan('FREE');
    await trimTo(0);

    for (let i = 0; i < FREE_PROPERTIES; i++) {
      const res = await create();
      expect(res.statusCode, `property ${i + 1} of ${FREE_PROPERTIES}: ${res.body}`).toBe(201);
    }
    expect(await propertyCount()).toBe(FREE_PROPERTIES);
  }, 30000);

  it('refuses the one after that, naming the limit', async () => {
    const res = await create();

    expect(res.statusCode).toBe(403);
    expect(body(res).code).toBe('PROPERTY_LIMIT_REACHED');
    // The web upsell reads this field; it is part of the answer, not decoration.
    expect(body(res).upgradeRequired).toBe(true);
    expect(body(res).data).toEqual({ limit: FREE_PROPERTIES, current: FREE_PROPERTIES });
    expect(await propertyCount()).toBe(FREE_PROPERTIES);
  });
});

describe('the ceiling holds when requests arrive together', () => {
  it('lets exactly one through when there is one place left', async () => {
    // The double-clicked button, on the plan where one place is all there is.
    await setPlan('FREE');
    await trimTo(FREE_PROPERTIES - 1);

    const results = await Promise.all([create(), create()]);

    expect(results.filter(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toHaveLength(1);
    expect(results.filter(r => r.statusCode === 403)).toHaveLength(1);
    expect(await propertyCount()).toBe(FREE_PROPERTIES);
  }, 30000);

  it('lets exactly one through out of eight at once', async () => {
    // A retry storm against the last remaining place, on a plan with room to
    // overshoot visibly: Professional allows five, so a failure here shows up
    // as six or more rather than as two.
    await setPlan('PROFESSIONAL');
    await trimTo(PRO_PROPERTIES - 1);

    const results = await Promise.all(Array.from({ length: 8 }, () => create()));

    expect(results.filter(r => r.statusCode === 201)).toHaveLength(1);
    expect(await propertyCount()).toBe(PRO_PROPERTIES);
  }, 30000);

  it('refuses all of them when the resort is already at its ceiling', async () => {
    await setPlan('PROFESSIONAL');
    await trimTo(PRO_PROPERTIES);

    const results = await Promise.all(Array.from({ length: 5 }, () => create()));

    expect(results.every(r => r.statusCode === 403)).toBe(true);
    expect(await propertyCount()).toBe(PRO_PROPERTIES);
  }, 30000);

  it('fills the remaining places and no more', async () => {
    // Three places left, six requests. The point is that the ceiling is a
    // ceiling, not that concurrency is serialised away.
    await setPlan('PROFESSIONAL');
    await trimTo(PRO_PROPERTIES - 3);

    const results = await Promise.all(Array.from({ length: 6 }, () => create()));

    expect(results.filter(r => r.statusCode === 201)).toHaveLength(3);
    expect(await propertyCount()).toBe(PRO_PROPERTIES);
  }, 30000);

  it('does not answer 500 to any of the losers', async () => {
    // A refusal that leaks as a 500 tells the caller the server broke, and
    // clients retry those.
    await setPlan('PROFESSIONAL');
    await trimTo(PRO_PROPERTIES - 1);

    const results = await Promise.all(Array.from({ length: 6 }, () => create()));

    for (const res of results) expect(res.statusCode, res.body).toBeLessThan(500);
    expect(results.filter(r => r.statusCode === 403)).toHaveLength(5);
  }, 30000);
});

describe('two properties reaching for the same slug', () => {
  it('gives one of them the slug and tells the other 409', async () => {
    // `@@unique([tenantId, slug])` decides this; the handler only reports. The
    // pre-flight findFirst cannot, because the row it looked for can be
    // inserted between the look and the insert.
    await setPlan('PROFESSIONAL');
    await trimTo(0);

    const slug = `${run}-samename`;
    const results = await Promise.all([create(slug), create(slug)]);
    const created = results.filter(r => r.statusCode === 201);
    const refused = results.filter(r => r.statusCode === 409);

    expect(created, results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(body(refused[0]).error).toMatch(/slug already exists/i);
    expect(await propertyCount()).toBe(1);
  }, 30000);
});

describe('an unlimited plan is not accidentally limited by this', () => {
  it('lets an Enterprise resort create many properties at once', async () => {
    // propertyLimit is -1 there, and a counted write must not turn "no
    // ceiling" into a ceiling of its own, nor serialise what used to run free.
    await setPlan('ENTERPRISE');
    await trimTo(2);

    const results = await Promise.all(Array.from({ length: 6 }, () => create()));

    expect(results.every(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toBe(true);
    expect(await propertyCount()).toBe(8);

    await setPlan('FREE');
  }, 30000);
});

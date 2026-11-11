/**
 * Whether a resort can end up with more staff seats than its plan allows.
 *
 * The third place with the shape RM-007 described, and the worst of the three,
 * because it is two holes rather than one.
 *
 *  1. `POST /api/staff` is the familiar race — a COUNT above and an INSERT
 *     below with nothing joining them, so every request in flight reads the
 *     same count, every one is under the ceiling, and every one inserts.
 *
 *  2. `POST /api/auth/invite/accept` never consulted the ceiling **at all**.
 *     An owner on a two-seat plan could invite fifty people and all fifty got
 *     accounts. That is not a race; the gate simply was not there, and it is
 *     the path most staff actually arrive through.
 *
 * A seat is a user who can sign in, which is what `staffLimit` counts and why
 * the owner holds one of them. Deactivating a staff member hands the seat
 * back — that is existing behaviour, and these tests lean on it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { PLAN_PRICING } from '@resort-pro/types';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `staff-quota-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let ownerUserId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

/** The ceilings this test is about, read from the plans rather than retyped. */
const FREE_SEATS = PLAN_PRICING.FREE.staffLimit;       // 2 — the owner plus one
const STARTER_SEATS = PLAN_PRICING.STARTER.staffLimit; // 20

let n = 0;
const nextEmail = () => `s${n++}-${run}@test.com`;

const createStaff = (email = nextEmail()) =>
  app.inject({
    method: 'POST', url: '/api/staff', headers: auth(),
    payload: {
      firstName: 'New', lastName: 'Hire', email, password,
      department: 'FRONT_DESK', position: 'Receptionist',
      hireDate: '2026-01-01', role: 'STAFF',
    },
  });

/** Send an invite and read back the token the email would have carried. */
const inviteToken = async (email = nextEmail()) => {
  const res = await app.inject({
    method: 'POST', url: '/api/staff/invite', headers: auth(),
    payload: { email, role: 'STAFF' },
  });
  if (res.statusCode !== 200) throw new Error(`invite failed: ${res.body}`);
  const row = await prisma.staffInvite.findFirst({
    where: { tenantId, email, used: false }, orderBy: { createdAt: 'desc' },
    select: { token: true },
  });
  if (!row) throw new Error(`no invite row for ${email}`);
  return row.token;
};

const accept = (token: string) =>
  app.inject({
    method: 'POST', url: '/api/auth/invite/accept',
    payload: { token, firstName: 'Invited', lastName: 'Person', password: 'Accept1Pass' },
  });

const seats = () => prisma.user.count({ where: { tenantId, isActive: true } });

/**
 * Put the tenant on exactly `target` occupied seats. Seats are handed back by
 * deactivating, not deleting, because that is what the product does and what
 * the count already measures.
 */
const seatsTakenBy = async (target: number) => {
  if (target < 1) throw new Error('the owner always holds a seat');
  await prisma.user.updateMany({
    where: { tenantId, id: { not: ownerUserId } }, data: { isActive: false },
  });
  while ((await seats()) < target) {
    const res = await createStaff();
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
      resortName: 'Staff Quota', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });

  const owner = await prisma.user.findFirstOrThrow({
    where: { tenantId, role: 'OWNER' }, select: { id: true },
  });
  ownerUserId = owner.id;

  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'FREE', planStatus: 'active' },
  });
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('the ceiling holds one request at a time', () => {
  it('allows staff up to the plan limit, the owner included', async () => {
    await setPlan('FREE');
    await seatsTakenBy(1);

    for (let i = 1; i < FREE_SEATS; i++) {
      const res = await createStaff();
      expect(res.statusCode, `seat ${i + 1} of ${FREE_SEATS}: ${res.body}`).toBe(201);
    }
    expect(await seats()).toBe(FREE_SEATS);
  }, 60000);

  it('refuses the one after that, naming the limit', async () => {
    const res = await createStaff();

    expect(res.statusCode, res.body).toBe(403);
    expect(body(res).code).toBe('STAFF_LIMIT_REACHED');
    expect(body(res).data).toEqual({ limit: FREE_SEATS, current: FREE_SEATS });
    expect(await seats()).toBe(FREE_SEATS);
  }, 30000);

  it('hands the seat back when a staff member is deactivated', async () => {
    // Not decoration: the whole gate counts active users, so this is the
    // behaviour that makes the ceiling a ceiling rather than a lifetime total.
    const hire = await prisma.user.findFirstOrThrow({
      where: { tenantId, isActive: true, id: { not: ownerUserId } }, select: { id: true },
    });
    await prisma.user.update({ where: { id: hire.id }, data: { isActive: false } });

    const res = await createStaff();
    expect(res.statusCode, res.body).toBe(201);
    expect(await seats()).toBe(FREE_SEATS);
  }, 30000);
});

describe('the ceiling holds when requests arrive together', () => {
  it('lets exactly one through when there is one seat left', async () => {
    // The double-clicked Add Staff button.
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS - 1);

    const results = await Promise.all([createStaff(), createStaff()]);

    expect(results.filter(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toHaveLength(1);
    expect(results.filter(r => r.statusCode === 403)).toHaveLength(1);
    expect(await seats()).toBe(FREE_SEATS);
  }, 60000);

  it('lets exactly one through out of eight at once', async () => {
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS - 1);

    const results = await Promise.all(Array.from({ length: 8 }, () => createStaff()));

    expect(results.filter(r => r.statusCode === 201)).toHaveLength(1);
    expect(await seats()).toBe(FREE_SEATS);
  }, 60000);

  it('fills the remaining seats and no more', async () => {
    // Three seats left, six requests, on a plan with room to overshoot
    // visibly. The point is that the ceiling is a ceiling, not that
    // concurrency is serialised away.
    await setPlan('STARTER');
    await seatsTakenBy(STARTER_SEATS - 3);

    const results = await Promise.all(Array.from({ length: 6 }, () => createStaff()));

    expect(results.filter(r => r.statusCode === 201)).toHaveLength(3);
    expect(await seats()).toBe(STARTER_SEATS);
  }, 120000);

  it('refuses all of them when the resort is already at its ceiling', async () => {
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS);

    const results = await Promise.all(Array.from({ length: 5 }, () => createStaff()));

    expect(results.every(r => r.statusCode === 403)).toBe(true);
    expect(await seats()).toBe(FREE_SEATS);
  }, 60000);

  it('does not answer 500 to any of the losers', async () => {
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS - 1);

    const results = await Promise.all(Array.from({ length: 6 }, () => createStaff()));

    for (const res of results) expect(res.statusCode, res.body).toBeLessThan(500);
    expect(results.filter(r => r.statusCode === 403)).toHaveLength(5);
  }, 60000);
});

describe('two hires reaching for the same email address', () => {
  it('gives one of them the address and tells the other 409', async () => {
    // `@@unique([tenantId, email])` decides this; the handler only reports.
    // The pre-flight findFirst cannot, because the row it looks for can be
    // inserted between the look and the insert.
    await setPlan('STARTER');
    await seatsTakenBy(1);

    const email = nextEmail();
    const results = await Promise.all([createStaff(email), createStaff(email)]);

    expect(results.filter(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toHaveLength(1);
    const refused = results.filter(r => r.statusCode === 409);
    expect(refused).toHaveLength(1);
    expect(body(refused[0]).error).toMatch(/email already in use/i);
  }, 60000);
});

describe('an invite cannot walk past the ceiling', () => {
  it('refuses to accept an invite when every seat is taken', async () => {
    /*
      This was never a race. `POST /api/auth/invite/accept` created the user
      without consulting the plan at all, so the limit held only against the
      one path the dashboard uses and not against the one most staff arrive
      through. Three invites on a two-seat plan used to produce three
      accounts, and a resort could sit at any number of seats indefinitely.
    */
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS);

    const tokens = await Promise.all([inviteToken(), inviteToken(), inviteToken()]);
    const results = [];
    for (const token of tokens) results.push(await accept(token));

    expect(results.map(r => r.statusCode)).toEqual([403, 403, 403]);
    expect(body(results[0]).code).toBe('STAFF_LIMIT_REACHED');
    expect(await seats()).toBe(FREE_SEATS);
  }, 60000);

  it('leaves the invite unused so it still works after an upgrade', async () => {
    // A refusal must not burn the link. The owner's fix is to upgrade, and
    // the person they invited should not have to be invited again.
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS);

    const token = await inviteToken();
    expect((await accept(token)).statusCode).toBe(403);

    await setPlan('STARTER');
    const second = await accept(token);
    expect(second.statusCode, second.body).toBe(201);
    expect(await seats()).toBe(FREE_SEATS + 1);
  }, 60000);

  it('lets exactly one of two invites in when there is one seat left', async () => {
    await setPlan('FREE');
    await seatsTakenBy(FREE_SEATS - 1);

    const tokens = await Promise.all([inviteToken(), inviteToken()]);
    const results = await Promise.all(tokens.map(t => accept(t)));

    expect(results.filter(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toHaveLength(1);
    expect(results.filter(r => r.statusCode === 403)).toHaveLength(1);
    expect(await seats()).toBe(FREE_SEATS);
  }, 60000);

  it('still accepts an invite normally when there is room', async () => {
    await setPlan('STARTER');
    await seatsTakenBy(1);

    const res = await accept(await inviteToken());

    expect(res.statusCode, res.body).toBe(201);
    expect(body(res).data.token, 'the invitee is signed in by accepting').toBeTruthy();
    expect(await seats()).toBe(2);
  }, 60000);
});

describe('an unlimited plan is not accidentally limited by this', () => {
  it('lets an Enterprise resort add many staff at once', async () => {
    // staffLimit is -1 there, and a counted write must not turn "no ceiling"
    // into a ceiling of its own, nor serialise what used to run free.
    await setPlan('ENTERPRISE');
    await seatsTakenBy(1);

    const results = await Promise.all(Array.from({ length: 6 }, () => createStaff()));

    expect(results.every(r => r.statusCode === 201),
      results.map(r => `${r.statusCode} ${r.body}`).join('\n')).toBe(true);
    expect(await seats()).toBe(7);

    await setPlan('FREE');
  }, 120000);
});

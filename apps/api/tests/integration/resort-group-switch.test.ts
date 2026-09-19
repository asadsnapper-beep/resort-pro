/**
 * Moving to another resort in your group.
 *
 * What comes back is an ordinary login for a real user row in that resort — the
 * one recorded on the connection. Nothing impersonates anybody, so deactivating
 * that row stops this working on the very next request, like any other account.
 *
 * Two of these tests are about traps rather than features. One: a resort sitting
 * in somebody else's group must not let that group's owner in here — membership
 * is not authority, owning the group is. Two: an owner whose current resort has
 * stopped paying must still be able to switch away from it, or the subscription
 * gate locks them inside the one resort that cannot pay.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-switch-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;
const strangerEmail = `stranger-${run}@test.com`;

let token: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
const tenants: Record<string, string> = {};

const switchTo = (tenantId: string, opts: { bearer?: string; cookie?: string } = {}) => app.inject({
  method: 'POST', url: '/api/auth/switch-resort',
  headers: {
    ...(opts.bearer !== null && { Authorization: `Bearer ${opts.bearer ?? token}` }),
    ...(opts.cookie && { cookie: opts.cookie }),
  },
  payload: { tenantId },
});

const whoAmI = (bearer: string) => app.inject({
  method: 'GET', url: '/api/auth/me', headers: { Authorization: `Bearer ${bearer}` },
});

/**
 * Log in for real, so the refresh cookie comes back with the token.
 *
 * The delete is not tidiness. A refresh token is `jwt.sign({ sub, type })` with
 * no nonce, so two logins by the same user inside one second produce the same
 * string and the second one dies on the unique index. That is a real defect in
 * /api/auth/login, filed separately; here it only has to stop poisoning the
 * fixtures.
 */
async function login(email: string, slug: string) {
  await prisma.refreshToken.deleteMany({ where: { user: { email } } });
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { email, password, slug },
  });
  if (res.statusCode !== 200) throw new Error(`login failed (${res.statusCode}): ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'rp_refresh');
  return { token: JSON.parse(res.body).data.token as string, refresh: cookie?.value as string };
}

async function makeResort(key: string, email = myEmail) {
  const tenant = await prisma.tenant.create({
    data: { name: key, slug: `${run}-${key}`, planStatus: 'active' },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email, passwordHash, firstName: 'Owner', lastName: key,
      role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  tenants[key] = tenant.id;
  return tenant.id;
}

const clearGroups = () => prisma.resortGroup.deleteMany({
  where: { OR: [{ ownerUserId }, { name: { contains: run } }] },
});

/** Connect hill (and lagoon when asked) through the real endpoint. */
async function connect(...keys: string[]) {
  for (const key of keys) {
    const res = await app.inject({
      method: 'POST', url: '/api/resort-group/links',
      headers: { Authorization: `Bearer ${token}` }, payload: { slug: `${run}-${key}` },
    });
    expect(res.statusCode, res.body).toBe(200);
  }
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Sea Pearl', slug: run, firstName: 'Owner', lastName: 'Test', email: myEmail, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  homeId = JSON.parse(reg.body).data.tenant.id;
  tenants.home = homeId;

  await prisma.user.update({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    data: { emailVerifiedAt: new Date() },
  });
  await prisma.tenant.update({ where: { id: homeId }, data: { planStatus: 'active' } });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  ({ token } = await login(myEmail, run));

  await makeResort('hill');
  await makeResort('lagoon');
  await makeResort('outside');
  await makeResort('theirs', strangerEmail);
}, 30000);

beforeEach(async () => {
  await clearGroups();
  await prisma.tenant.updateMany({
    where: { slug: { startsWith: run } }, data: { isActive: true, planStatus: 'active' },
  });
  await prisma.user.updateMany({ where: { email: myEmail }, data: { isActive: true } });
  // Deliberately no fresh login here: /api/auth/login allows ten attempts a
  // minute, and the bearer token from beforeAll stays valid for the whole file.
});

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('switching into a connected resort', () => {
  beforeEach(() => connect('hill'));

  it('hands back a session for that resort', async () => {
    const res = await switchTo(tenants.hill);
    expect(res.statusCode, res.body).toBe(200);

    const data = JSON.parse(res.body).data;
    expect(data.tenant).toMatchObject({ id: tenants.hill, slug: `${run}-hill` });
    expect(data.token).toBeTruthy();
  });

  it('is a real user of that resort, not the one who switched', async () => {
    const { token: hillToken } = JSON.parse((await switchTo(tenants.hill)).body).data;

    const me = JSON.parse((await whoAmI(hillToken)).body).data;
    expect(me.tenantId).toBe(tenants.hill);
    expect(me.id).not.toBe(ownerUserId);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).toMatchObject({
      tenantId: tenants.hill, role: 'OWNER',
    });
  });

  it('leaves the old token working for the resort it was issued for', async () => {
    // Deliberate: the token is a JWT and stays valid until it expires. A tab
    // left open on the previous resort keeps working there — it does not
    // suddenly start showing another resort's numbers, which is the part that
    // would be dangerous.
    await switchTo(tenants.hill);
    expect(JSON.parse((await whoAmI(token)).body).data.tenantId).toBe(homeId);
  });

  it('retires the refresh token that brought you here', async () => {
    const { token: bearer, refresh } = await login(myEmail, run);
    expect(await prisma.refreshToken.count({ where: { token: refresh } })).toBe(1);

    const res = await switchTo(tenants.hill, { bearer, cookie: `rp_refresh=${refresh}` });
    expect(res.statusCode, res.body).toBe(200);
    expect(await prisma.refreshToken.count({ where: { token: refresh } })).toBe(0);
    expect(res.cookies.find((c) => c.name === 'rp_refresh')?.value).toBeTruthy();
  });

  it('survives being asked twice in the same second', async () => {
    // A double-clicked dropdown. Both answers have to be a session, not a
    // unique-index error on a refresh token signed byte for byte the same way.
    const [first, second] = await Promise.all([switchTo(tenants.hill), switchTo(tenants.hill)]);
    expect([first.statusCode, second.statusCode], `${first.body} ${second.body}`).toEqual([200, 200]);
  });

  it('records the switch', async () => {
    await switchTo(tenants.hill);
    expect(await prisma.resortGroupEvent.findFirstOrThrow({
      where: { tenantId: tenants.hill, action: 'switched' },
    })).toMatchObject({ actorUserId: ownerUserId });
  });

  it('works even when the resort you are leaving has stopped paying', async () => {
    await prisma.tenant.update({ where: { id: homeId }, data: { planStatus: 'past_due' } });

    const res = await switchTo(tenants.hill);
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('refusing to switch', () => {
  it('refuses a resort that is not connected', async () => {
    await connect('hill');
    const res = await switchTo(tenants.outside);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('RESORT_NOT_CONNECTED');
  });

  it('refuses a resort you may only see the figures of', async () => {
    await connect('hill');
    await prisma.resortGroupTenant.update({
      where: { tenantId: tenants.hill }, data: { access: 'NUMBERS_ONLY' },
    });

    const res = await switchTo(tenants.hill);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ACCESS_NUMBERS_ONLY');
  });

  it('refuses once the connection is removed', async () => {
    await connect('hill');
    await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${tenants.hill}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect((await switchTo(tenants.hill)).statusCode).toBe(403);
  });

  it('refuses a suspended resort', async () => {
    await connect('hill');
    await prisma.tenant.update({ where: { id: tenants.hill }, data: { isActive: false } });

    expect((await switchTo(tenants.hill)).statusCode).toBe(403);
  });

  it('refuses when the user on the other side has been deactivated', async () => {
    await connect('hill');
    const member = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: tenants.hill } });
    await prisma.user.update({ where: { id: member.linkedUserId! }, data: { isActive: false } });

    expect((await switchTo(tenants.hill)).statusCode).toBe(403);
  });

  it('refuses somebody whose resort is in a group they do not own', async () => {
    // The stranger's group contains this owner's resort. That buys the
    // stranger nothing: owning the group is what allows a switch.
    const stranger = await prisma.user.findFirstOrThrow({ where: { email: strangerEmail } });
    await prisma.resortGroup.create({
      data: {
        name: `${run} foreign`, ownerUserId: stranger.id,
        members: { create: [{ tenantId: tenants.hill, access: 'FULL' }] },
      },
    });

    const res = await switchTo(tenants.hill);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('RESORT_NOT_CONNECTED');
  });

  it('refuses an unauthenticated caller', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/switch-resort', payload: { tenantId: tenants.hill },
    });
    expect(res.statusCode).toBe(401);
  });
});

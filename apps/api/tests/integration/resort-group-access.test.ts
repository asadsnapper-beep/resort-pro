/**
 * Changing what a connection gives, after it has been given.
 *
 * The founder asked for this explicitly — "eita poriborton korte parbe" — and
 * the rule that makes it safe is who may do it. Only the resort's own owner,
 * never the person who asked for access. If the asking side could raise its own
 * level, the choice made when the request was approved would have been theatre.
 *
 * The other thing worth proving: dropping to figures only has to bite at once.
 * A session already open on that resort must stop working on its next request,
 * not whenever its token happens to run out.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

const sent: { to: string }[] = [];
vi.mock('../../src/services/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/email')>()),
  sendEmail: async (mail: { to: string }) => { sent.push(mail); return { sent: true }; },
}));

import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-acc-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;
const theirEmail = `their-${run}@test.com`;

let token: string;
let theirToken: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
let hillId: string;

const setAccess = (tenantId: string, access: string, bearer: string) => app.inject({
  method: 'PATCH', url: `/api/resort-group/members/${tenantId}`,
  headers: { Authorization: `Bearer ${bearer}` }, payload: { access },
});
const switchTo = (tenantId: string, bearer = token) => app.inject({
  method: 'POST', url: '/api/auth/switch-resort',
  headers: { Authorization: `Bearer ${bearer}` }, payload: { tenantId },
});
const events = (bearer: string) => app.inject({
  method: 'GET', url: '/api/resort-group/events', headers: { Authorization: `Bearer ${bearer}` },
});
const whoAmI = (bearer: string) => app.inject({
  method: 'GET', url: '/api/auth/me', headers: { Authorization: `Bearer ${bearer}` },
});

/** Ask, then have the other owner approve at the given level. */
async function connectAt(access: 'FULL' | 'NUMBERS_ONLY') {
  await app.inject({
    method: 'POST', url: '/api/resort-group/links',
    headers: { Authorization: `Bearer ${token}` }, payload: { slug: `${run}-hillview` },
  });
  const req = await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: hillId } });
  const res = await app.inject({
    method: 'POST', url: `/api/resort-group/requests/${req.id}/approve`,
    headers: { Authorization: `Bearer ${theirToken}` }, payload: { access },
  });
  expect(res.statusCode, res.body).toBe(200);
}

const clearGroups = () => prisma.resortGroup.deleteMany({
  where: { OR: [{ ownerUserId }, { name: { contains: run } }] },
});

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Sea Pearl', slug: run, firstName: 'Asha', lastName: 'Rahman', email: myEmail, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  homeId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId: homeId, email: myEmail, password, slug: run });
  await prisma.tenant.update({ where: { id: homeId }, data: { planStatus: 'active' } });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  const hill = await prisma.tenant.create({
    data: { name: 'Hill View', slug: `${run}-hillview`, planStatus: 'active' },
  });
  hillId = hill.id;
  await prisma.user.create({
    data: {
      tenantId: hillId, email: theirEmail, passwordHash, firstName: 'Their', lastName: 'Owner',
      role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  theirToken = await verifyOwnerAndLogin(app, {
    tenantId: hillId, email: theirEmail, password, slug: `${run}-hillview`,
  });
}, 60000);

beforeEach(async () => {
  sent.length = 0;
  await clearGroups();
  await prisma.user.deleteMany({ where: { tenantId: hillId, email: myEmail } });
});

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('dropping to figures only', () => {
  it('shuts the open session out on its very next request', async () => {
    await connectAt('FULL');
    const inside = JSON.parse((await switchTo(hillId)).body).data.token as string;
    expect(JSON.parse((await whoAmI(inside)).body).data.tenantId).toBe(hillId);

    const res = await setAccess(hillId, 'NUMBERS_ONLY', theirToken);
    expect(res.statusCode, res.body).toBe(200);

    // Not at expiry — now.
    expect((await whoAmI(inside)).statusCode).toBe(401);
    expect((await switchTo(hillId)).statusCode).toBe(403);
  });

  it('leaves the numbers flowing', async () => {
    await connectAt('FULL');
    await setAccess(hillId, 'NUMBERS_ONLY', theirToken);

    const overview = JSON.parse((await app.inject({
      method: 'GET', url: '/api/resort-group/overview',
      headers: { Authorization: `Bearer ${token}` },
    })).body).data;
    const card = overview.resorts.find((r: { tenantId: string }) => r.tenantId === hillId);
    expect(card).toMatchObject({ access: 'NUMBERS_ONLY', canOpen: false });
    expect(card.numbers).not.toBeNull();
  });

  it('does not touch an account the resort was already using itself', async () => {
    const theirs = await prisma.user.create({
      data: {
        tenantId: hillId, email: myEmail, passwordHash, firstName: 'Asha', lastName: 'Rahman',
        role: 'MANAGER', emailVerifiedAt: new Date(),
      },
    });
    await connectAt('FULL');
    await setAccess(hillId, 'NUMBERS_ONLY', theirToken);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: theirs.id } })).isActive).toBe(true);
    // Reachable by its own password, but no longer by switching.
    expect((await switchTo(hillId)).statusCode).toBe(403);
  });
});

describe('raising it back', () => {
  it('lets them in again, through the same account as before', async () => {
    await connectAt('FULL');
    const before = (await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: hillId } })).linkedUserId;
    await setAccess(hillId, 'NUMBERS_ONLY', theirToken);

    expect((await setAccess(hillId, 'FULL', theirToken)).statusCode).toBe(200);
    const after = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: hillId } });
    expect(after.linkedUserId).toBe(before);
    expect((await switchTo(hillId)).statusCode).toBe(200);
  });

  it('makes an account for a connection that never had one', async () => {
    await connectAt('NUMBERS_ONLY');
    expect((await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: hillId } })).linkedUserId).toBeNull();

    expect((await setAccess(hillId, 'FULL', theirToken)).statusCode).toBe(200);
    const member = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: hillId } });
    expect(member).toMatchObject({ access: 'FULL', linkedUserCreated: true });
    expect((await switchTo(hillId)).statusCode).toBe(200);
  });
});

describe('who is allowed to change it', () => {
  it('refuses the person who asked for the access', async () => {
    await connectAt('NUMBERS_ONLY');

    const res = await setAccess(hillId, 'FULL', token);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('NOT_RESORT_OWNER');
    expect((await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: hillId } })).access)
      .toBe('NUMBERS_ONLY');
  });

  it('refuses one owner reaching into another resort in the same group', async () => {
    await connectAt('FULL');
    // Hill View's owner has no say over Sea Pearl, group or no group.
    expect((await setAccess(homeId, 'NUMBERS_ONLY', theirToken)).statusCode).toBe(403);
  });

  it('answers 404 for a resort that is not connected at all', async () => {
    await connectAt('FULL');
    const stranger = await prisma.tenant.create({
      data: { name: 'Nowhere', slug: `${run}-nowhere`, planStatus: 'active' },
    });
    expect((await setAccess(stranger.id, 'FULL', theirToken)).statusCode).toBe(404);
  });

  it('treats setting the level it already has as nothing to do', async () => {
    await connectAt('FULL');
    const before = await prisma.resortGroupEvent.count({ where: { action: 'access_changed' } });

    expect((await setAccess(hillId, 'FULL', theirToken)).statusCode).toBe(200);
    expect(await prisma.resortGroupEvent.count({ where: { action: 'access_changed' } })).toBe(before);
  });
});

describe('the history', () => {
  it('tells the resort\'s owner who was given what, and when', async () => {
    await connectAt('FULL');
    await setAccess(hillId, 'NUMBERS_ONLY', theirToken);

    const rows = JSON.parse((await events(theirToken)).body).data;
    expect(rows[0]).toMatchObject({ action: 'access_changed', resortName: 'Hill View' });
    expect(rows[0].metadata).toMatchObject({ from: 'FULL', to: 'NUMBERS_ONLY' });
    expect(rows.some((r: { action: string }) => r.action === 'link_approved')).toBe(true);
  });

  it('shows the group\'s owner the whole group', async () => {
    await connectAt('FULL');
    const rows = JSON.parse((await events(token)).body).data;
    expect(rows.some((r: { action: string }) => r.action === 'link_requested')).toBe(true);
  });

  it('shows a connected resort nothing about the group\'s other resorts', async () => {
    await connectAt('FULL');
    const other = await prisma.tenant.create({
      data: { name: 'Elsewhere', slug: `${run}-elsewhere`, planStatus: 'active' },
    });
    const group = await prisma.resortGroup.findFirstOrThrow({ where: { ownerUserId } });
    await prisma.resortGroupEvent.create({
      data: { groupId: group.id, tenantId: other.id, action: 'link_approved' },
    });

    const rows = JSON.parse((await events(theirToken)).body).data;
    expect(rows.every((r: { tenantId: string }) => r.tenantId === hillId)).toBe(true);
  });

  it('has nothing to show a resort that is connected to nobody', async () => {
    expect((await events(theirToken)).statusCode).toBe(404);
  });
});

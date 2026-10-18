/**
 * The group, seen from the resort you switched into.
 *
 * Staging found this by doing the one thing no test had done: walking into the
 * second resort and looking around. The dropdown was gone, the 360 view 404'd,
 * and there was no way back — only signing out and in again.
 *
 * The cause was a single assumption repeated everywhere: that the person who
 * owns a group is whoever the current token says. Owning one is recorded
 * against a single `User` row, and switching resorts makes you a different row.
 *
 * Every test here therefore asks its questions with the token from *inside* the
 * second resort, which is the case the old tests never made.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-inside-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;

let homeToken: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
let hillId: string;
let lagoonId: string;

/** A session inside the second resort — what the old tests never used. */
let insideToken: string;

const get = (url: string, bearer: string) =>
  app.inject({ method: 'GET', url, headers: { Authorization: `Bearer ${bearer}` } });

const switchTo = (tenantId: string, bearer: string) => app.inject({
  method: 'POST', url: '/api/auth/switch-resort',
  headers: { Authorization: `Bearer ${bearer}` }, payload: { tenantId },
});

async function makeResort(key: string) {
  const tenant = await prisma.tenant.create({
    data: { name: key, slug: `${run}-${key}`, planStatus: 'active' },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email: myEmail, passwordHash, firstName: 'Owner', lastName: key,
      role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  return tenant.id;
}

const connect = async (key: string) => {
  const res = await app.inject({
    method: 'POST', url: '/api/resort-group/links',
    headers: { Authorization: `Bearer ${homeToken}` }, payload: { slug: `${run}-${key}` },
  });
  expect(res.statusCode, res.body).toBe(200);
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Sea Pearl', slug: run, firstName: 'Asha', lastName: 'Rahman', email: myEmail, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  homeId = JSON.parse(reg.body).data.tenant.id;
  homeToken = await verifyOwnerAndLogin(app, { tenantId: homeId, email: myEmail, password, slug: run });
  await prisma.tenant.update({ where: { id: homeId }, data: { planStatus: 'active' } });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  hillId = await makeResort('hill');
  lagoonId = await makeResort('lagoon');
}, 60000);

beforeEach(async () => {
  await prisma.resortGroup.deleteMany({ where: { ownerUserId } });
  await connect('hill');
  await connect('lagoon');

  const res = await switchTo(hillId, homeToken);
  expect(res.statusCode, res.body).toBe(200);
  insideToken = JSON.parse(res.body).data.token;
});

afterAll(async () => {
  await prisma.resortGroup.deleteMany({ where: { ownerUserId } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('after switching into a connected resort', () => {
  it('is a different account, which is exactly why this was broken', async () => {
    const inside = JSON.parse((await get('/api/auth/me', insideToken)).body).data;
    expect(inside.tenantId).toBe(hillId);
    expect(inside.id).not.toBe(ownerUserId);
  });

  it('still shows the group, and every resort in it', async () => {
    const group = JSON.parse((await get('/api/resort-group', insideToken)).body).data;
    expect(group, 'the dropdown disappears when this is null').not.toBeNull();
    expect(group.resorts.map((r: { slug: string }) => r.slug).sort())
      .toEqual([run, `${run}-hill`, `${run}-lagoon`].sort());
  });

  it('marks the resort you are actually standing in', async () => {
    const group = JSON.parse((await get('/api/resort-group', insideToken)).body).data;
    expect(group.resorts.find((r: { isCurrent: boolean }) => r.isCurrent).slug).toBe(`${run}-hill`);
  });

  it('still answers the 360 view', async () => {
    const res = await get('/api/resort-group/overview', insideToken);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.resorts).toHaveLength(3);
  });

  it('lets you move on to a third resort, and back home', async () => {
    const onward = await switchTo(lagoonId, insideToken);
    expect(onward.statusCode, onward.body).toBe(200);

    const back = await switchTo(homeId, JSON.parse(onward.body).data.token);
    expect(back.statusCode, back.body).toBe(200);
    expect(JSON.parse(back.body).data.tenant.id).toBe(homeId);
  });

  it('still offers the combined bill', async () => {
    const res = await get('/api/billing/group?interval=month', insideToken);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data).not.toBeNull();
  });

  it('still reads the history', async () => {
    const res = await get('/api/resort-group/events', insideToken);
    expect(res.statusCode, res.body).toBe(200);
  });

  it('can open another resort from in here', async () => {
    // Reading ownerUserId directly left this answering "already connected" —
    // the same blind spot as the rest, in the one place the fix missed.
    const res = await app.inject({
      method: 'POST', url: '/api/resort-group/new-resort',
      headers: { Authorization: `Bearer ${insideToken}` },
      payload: { name: 'From Inside', slug: `${run}-from-inside` },
    });
    expect(res.statusCode, res.body).toBe(201);

    const group = JSON.parse((await get('/api/resort-group', insideToken)).body).data;
    expect(group.resorts.map((r: { slug: string }) => r.slug)).toContain(`${run}-from-inside`);
  });

  it('can disconnect a resort from in here', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${lagoonId}`,
      headers: { Authorization: `Bearer ${insideToken}` },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: lagoonId } })).toBe(0);
  });
});

describe('what it must still refuse', () => {
  it('shows a stranger in that same resort nothing', async () => {
    // A receptionist at the resort you switched into is not you.
    const deskEmail = `desk-${run}@test.com`;
    await prisma.user.deleteMany({ where: { tenantId: hillId, email: deskEmail } });
    await prisma.user.create({
      data: {
        tenantId: hillId, email: deskEmail, passwordHash, firstName: 'Front', lastName: 'Desk',
        role: 'OWNER', emailVerifiedAt: new Date(),
      },
    });
    const deskToken = await verifyOwnerAndLogin(app, {
      tenantId: hillId, email: deskEmail, password, slug: `${run}-hill`,
    });

    expect(JSON.parse((await get('/api/resort-group', deskToken)).body).data).toBeNull();
    expect((await get('/api/resort-group/overview', deskToken)).statusCode).toBe(404);
    expect((await switchTo(lagoonId, deskToken)).statusCode).toBe(403);
  });
});

/**
 * What support can see about a connection.
 *
 * These are the two questions support actually gets — "why is somebody else's
 * name on my staff list?" and "who can see my revenue?" — and until this
 * existed the only way to answer either was to read four tables by hand.
 *
 * Read-only on purpose. A connection is an agreement between two owners, and
 * an admin unpicking it from the outside would be a decision neither of them
 * made.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-admin-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;

let token: string;
let adminToken: string;
let ownerUserId: string;
let homeId: string;
let hillId: string;
let loneId: string;

const tenantDetail = (id: string, bearer = adminToken) => app.inject({
  method: 'GET', url: `/api/admin/tenants/${id}`,
  headers: { Authorization: `Bearer ${bearer}` },
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

  const hill = await prisma.tenant.create({
    data: { name: 'Hill View', slug: `${run}-hill`, planStatus: 'active' },
  });
  hillId = hill.id;
  await prisma.user.create({
    data: {
      tenantId: hillId, email: myEmail, passwordHash: me.passwordHash,
      firstName: 'Asha', lastName: 'Rahman', role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  loneId = (await prisma.tenant.create({
    data: { name: 'On Its Own', slug: `${run}-lone`, planStatus: 'active' },
  })).id;

  const linked = await app.inject({
    method: 'POST', url: '/api/resort-group/links',
    headers: { Authorization: `Bearer ${token}` }, payload: { slug: `${run}-hill` },
  });
  expect(linked.statusCode, linked.body).toBe(200);

  adminToken = app.jwt.sign({
    sub: `admin-${run}`, email: `admin-${run}@test.com`, adminRole: 'SUPER_ADMIN',
  });
}, 60000);

afterAll(async () => {
  await prisma.resortGroup.deleteMany({ where: { ownerUserId } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('a connected resort', () => {
  it('names the account that can see it', async () => {
    const res = await tenantDetail(hillId);
    expect(res.statusCode, res.body).toBe(200);

    const group = JSON.parse(res.body).data.resortGroup;
    expect(group).toMatchObject({ name: 'Sea Pearl Group', access: 'FULL' });
    expect(group.owner).toMatchObject({ name: 'Asha Rahman', email: myEmail, resortName: 'Sea Pearl' });
  });

  it('lists the other resorts in the same group', async () => {
    const group = JSON.parse((await tenantDetail(hillId)).body).data.resortGroup;
    expect(group.siblings).toMatchObject([{ tenantId: homeId, name: 'Sea Pearl' }]);
  });

  it('says whether the account it uses was made for the connection', async () => {
    // Same-email links reuse the owner's own login, which is why disconnecting
    // must leave it alone. Support needs to see that distinction.
    const group = JSON.parse((await tenantDetail(hillId)).body).data.resortGroup;
    expect(group.linkedUserCreated).toBe(false);
  });
});

describe('everything else', () => {
  it('says nothing about a resort connected to nobody', async () => {
    expect(JSON.parse((await tenantDetail(loneId)).body).data.resortGroup).toBeNull();
  });

  it('is not readable with a resort owner\'s token', async () => {
    expect((await tenantDetail(hillId, token)).statusCode).toBe(403);
  });

  it('is not readable without one at all', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/tenants/${hillId}` });
    expect(res.statusCode).toBe(401);
  });
});

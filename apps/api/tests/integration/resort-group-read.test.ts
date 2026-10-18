/**
 * Reading the group of connected resorts.
 *
 * The dropdown and the 360 nav item are both drawn from this one endpoint, so
 * what it refuses to return matters as much as what it returns. The load-bearing
 * case is the last one: a group that belongs to somebody else must come back as
 * `null`, even when this user's own resort is sitting inside it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `rg-read-${Date.now()}`;
const secondSlug = `${slug}-second`;
const thirdSlug = `${slug}-third`;
const password = 'TestPass123!';
const email = `owner-${slug}@test.com`;

let token: string;
let ownerUserId: string;
let tenantId: string;
let secondTenantId: string;
let thirdTenantId: string;
let groupId: string;

const read = (auth = true) => app.inject({
  method: 'GET',
  url: '/api/resort-group',
  ...(auth && { headers: { Authorization: `Bearer ${token}` } }),
});

const body = async () => JSON.parse((await read()).body).data;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Group Read', slug, firstName: 'Owner', lastName: 'Test', email, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active' } });
  ownerUserId = (await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId, email } }, select: { id: true },
  })).id;

  secondTenantId = (await prisma.tenant.create({
    data: { name: 'Hill View', slug: secondSlug, planStatus: 'active' },
  })).id;
  thirdTenantId = (await prisma.tenant.create({
    data: { name: 'Blue Lagoon', slug: thirdSlug, planStatus: 'active' },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { in: [slug, secondSlug, thirdSlug] } } });
  await app.close();
});

describe('before anything is connected', () => {
  it('refuses an unauthenticated caller', async () => {
    expect((await read(false)).statusCode).toBe(401);
  });

  it('answers null for an owner with one resort', async () => {
    const res = await read();
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, data: null });
  });
});

describe('once resorts are connected', () => {
  beforeAll(async () => {
    groupId = (await prisma.resortGroup.create({
      data: {
        name: 'Group Read Group',
        ownerUserId,
        members: {
          create: [
            { tenantId, access: 'FULL' },
            { tenantId: secondTenantId, access: 'NUMBERS_ONLY' },
          ],
        },
      },
    })).id;
  });

  it('returns every connected resort, oldest first', async () => {
    const group = await body();
    expect(group.id).toBe(groupId);
    expect(group.name).toBe('Group Read Group');
    expect(group.resorts.map((r: { slug: string }) => r.slug)).toEqual([slug, secondSlug]);
  });

  it('marks the resort the request came from', async () => {
    const group = await body();
    expect(group.resorts.map((r: { isCurrent: boolean }) => r.isCurrent)).toEqual([true, false]);
  });

  it('lets a full-access resort be opened, and a numbers-only one not', async () => {
    const [mine, theirs] = (await body()).resorts;
    expect(mine).toMatchObject({ access: 'FULL', canOpen: true });
    expect(theirs).toMatchObject({ access: 'NUMBERS_ONLY', canOpen: false });
  });

  it('will not open a suspended resort even with full access', async () => {
    await prisma.resortGroupTenant.update({
      where: { tenantId: secondTenantId }, data: { access: 'FULL' },
    });
    await prisma.tenant.update({ where: { id: secondTenantId }, data: { isActive: false } });

    const [, theirs] = (await body()).resorts;
    expect(theirs).toMatchObject({ access: 'FULL', isActive: false, canOpen: false });

    await prisma.tenant.update({ where: { id: secondTenantId }, data: { isActive: true } });
    await prisma.resortGroupTenant.update({
      where: { tenantId: secondTenantId }, data: { access: 'NUMBERS_ONLY' },
    });
  });

  it('shows a request that is still waiting, and hides one that has expired', async () => {
    await prisma.resortLinkRequest.create({
      data: {
        groupId, tenantId: thirdTenantId, requestedById: ownerUserId,
        tokenHash: `waiting-${slug}`, expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect((await body()).pendingRequests).toMatchObject([{ tenantSlug: thirdSlug }]);

    await prisma.resortLinkRequest.updateMany({
      where: { groupId }, data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await body()).pendingRequests).toEqual([]);

    await prisma.resortLinkRequest.deleteMany({ where: { groupId } });
  });
});

describe('a group that belongs to somebody else', () => {
  it('is not returned, even though this resort is inside it', async () => {
    const stranger = await prisma.user.create({
      data: {
        tenantId: secondTenantId, email: `stranger-${slug}@test.com`,
        passwordHash: 'x', firstName: 'Not', lastName: 'Me', role: 'OWNER',
      },
    });
    await prisma.resortGroup.update({
      where: { id: groupId }, data: { ownerUserId: stranger.id },
    });

    // The group row still lists this user's own resort as a member. Membership
    // is not what grants the 360 view — owning the group is.
    expect(await body()).toBeNull();
  });
});

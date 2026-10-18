/**
 * Connecting a second resort you already own, and disconnecting it again.
 *
 * The one-click path fires only when the same **verified** email is an active
 * owner of both accounts, which is what makes it safe: an address becomes an
 * owner's login only after that address clicked a verification link, so two
 * matching addresses are the same person. Everything else has to be asked for.
 *
 * Most of what follows is about the refusals. The one worth reading twice is
 * "without confirming it exists": a resort that is not yours and a slug that
 * was never registered must produce the same answer, byte for byte, or this
 * endpoint becomes a way to enumerate every resort on the platform.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-link-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;
const strangerEmail = `stranger-${run}@test.com`;

let token: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;

/** slug → tenant id, for every fixture resort. */
const tenants: Record<string, string> = {};

const link = (slug: string, bearer = token) => app.inject({
  method: 'POST', url: '/api/resort-group/links',
  headers: { Authorization: `Bearer ${bearer}` },
  payload: { slug },
});

const disconnect = (tenantId: string, bearer = token) => app.inject({
  method: 'DELETE', url: `/api/resort-group/members/${tenantId}`,
  headers: { Authorization: `Bearer ${bearer}` },
});

const group = async () => JSON.parse((await app.inject({
  method: 'GET', url: '/api/resort-group', headers: { Authorization: `Bearer ${token}` },
})).body).data;

/** A resort with an owner login, so it can be connected or logged into. */
async function makeResort(key: string, opts: {
  email?: string;
  verified?: boolean;
  role?: 'OWNER' | 'MANAGER';
  isDemo?: boolean;
  isActive?: boolean;
} = {}) {
  const slug = `${run}-${key}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: key, slug, planStatus: 'active',
      isDemo: opts.isDemo ?? false, isActive: opts.isActive ?? true,
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email: opts.email ?? myEmail, passwordHash,
      firstName: 'Owner', lastName: key, role: opts.role ?? 'OWNER',
      emailVerifiedAt: (opts.verified ?? true) ? new Date() : null,
    },
  });
  tenants[key] = tenant.id;
  return { id: tenant.id, slug };
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
  token = await verifyOwnerAndLogin(app, { tenantId: homeId, email: myEmail, password, slug: run });
  await prisma.tenant.update({ where: { id: homeId }, data: { planStatus: 'active' } });
  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;
  tenants.home = homeId;

  await makeResort('hill');                                   // mine, connectable
  await makeResort('lagoon');                                 // mine, connectable
  await makeResort('theirs', { email: strangerEmail });       // somebody else's
  await makeResort('unverified', { verified: false });        // mine, email never verified
  await makeResort('demo', { isDemo: true });                 // the demo resort
  await makeResort('suspended', { isActive: false });         // mine, suspended
  await makeResort('taken');                                  // mine, but in another group
  await makeResort('staffonly', { role: 'MANAGER' });         // my email, but not an owner there
  await prisma.user.create({                                  // …it has its own owner
    data: {
      tenantId: tenants.staffonly, email: strangerEmail, passwordHash,
      firstName: 'Real', lastName: 'Owner', role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  await makeResort('shouty', { email: myEmail.toUpperCase() }); // mine, registered in capitals
}, 30000);

/**
 * Groups are named after the resort they were built from ("Sea Pearl Group"),
 * so the run prefix alone does not find them — this has to clear by owner as
 * well, or one test's group survives into the next.
 */
const clearGroups = () => prisma.resortGroup.deleteMany({
  where: { OR: [{ ownerUserId }, { name: { contains: run } }] },
});

beforeEach(clearGroups);

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('connecting a resort registered to the same email', () => {
  it('connects it, and puts the resort you are standing in beside it', async () => {
    const res = await link(`${run}-hill`);
    expect(res.statusCode, res.body).toBe(200);

    const data = JSON.parse(res.body).data;
    expect(data.status).toBe('connected');
    expect(data.group.resorts.map((r: { slug: string }) => r.slug)).toEqual([run, `${run}-hill`]);
    expect(data.group.resorts.every((r: { access: string }) => r.access === 'FULL')).toBe(true);
  });

  it('connects an account registered with the same address in capitals', async () => {
    // The two accounts were registered separately, and nothing made the owner
    // spell their own address the same way twice.
    const res = await link(`${run}-shouty`);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.group.resorts).toHaveLength(2);
  });

  it('names the group after the resort it was built from', async () => {
    await link(`${run}-hill`);
    expect((await group()).name).toBe('Sea Pearl Group');
  });

  it('adds a third resort to the same group rather than starting another', async () => {
    await link(`${run}-hill`);
    await link(`${run}-lagoon`);

    expect(await prisma.resortGroup.count({ where: { ownerUserId } })).toBe(1);
    expect((await group()).resorts.map((r: { slug: string }) => r.slug))
      .toEqual([run, `${run}-hill`, `${run}-lagoon`]);
  });

  it('records who connected what, and why it was allowed without asking', async () => {
    await link(`${run}-hill`);
    const event = await prisma.resortGroupEvent.findFirstOrThrow({
      where: { tenantId: tenants.hill },
    });
    expect(event).toMatchObject({ action: 'link_approved', actorUserId: ownerUserId });
    expect(event.metadata).toMatchObject({ reason: 'same_verified_email' });
  });
});

describe('refusing to connect', () => {
  it('refuses a slug nobody has registered', async () => {
    const res = await link(`${run}-no-such-resort`);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('RESORT_NOT_FOUND');
  });

  it('asks rather than connects when the resort is somebody else\'s', async () => {
    const res = await link(`${run}-theirs`);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('requested');
    // Asked, not taken.
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.theirs } })).toBe(0);
  });

  it('asks rather than connects when my email is staff there, not the owner', async () => {
    const res = await link(`${run}-staffonly`);
    expect(JSON.parse(res.body).data.status).toBe('requested');
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.staffonly } })).toBe(0);
  });

  it('will not connect an account whose owner never verified their email', async () => {
    // Nobody there can be asked, so there is no request to make either.
    const res = await link(`${run}-unverified`);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('RESORT_HAS_NO_OWNER');
  });

  it('refuses the resort you are already in', async () => {
    const res = await link(run);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('SAME_RESORT');
  });

  it('refuses the demo resort', async () => {
    const res = await link(`${run}-demo`);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('RESORT_NOT_CONNECTABLE');
  });

  it('refuses a suspended resort', async () => {
    const res = await link(`${run}-suspended`);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('RESORT_NOT_CONNECTABLE');
  });

  it('refuses a resort that belongs to somebody else\'s group', async () => {
    const stranger = await prisma.user.findFirstOrThrow({ where: { email: strangerEmail } });
    const foreign = await prisma.resortGroup.create({
      data: {
        name: `${run} foreign`, ownerUserId: stranger.id,
        members: { create: [{ tenantId: tenants.taken, access: 'FULL' }] },
      },
    });

    const res = await link(`${run}-taken`);
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toContain('another account');
    // Still theirs, and still not mine.
    expect(await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: tenants.taken } }))
      .toMatchObject({ groupId: foreign.id });
    expect(await prisma.resortGroup.count({ where: { ownerUserId } })).toBe(0);
  });

  it('refuses a resort that is already in my own group', async () => {
    await link(`${run}-hill`);
    const again = await link(`${run}-hill`);
    expect(again.statusCode).toBe(409);
    expect(JSON.parse(again.body).error).toContain('already in your group');
    expect((await group()).resorts).toHaveLength(2);
  });

  it('refuses a twenty-first resort', async () => {
    const filler = await Promise.all(
      Array.from({ length: 19 }, (_, i) =>
        prisma.tenant.create({ data: { name: `Filler ${i}`, slug: `${run}-filler-${i}` } })),
    );
    await prisma.resortGroup.create({
      data: {
        name: `${run} full`, ownerUserId,
        members: { create: filler.map((t) => ({ tenantId: t.id, access: 'FULL' as const })) },
      },
    });

    const res = await link(`${run}-hill`);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('GROUP_LIMIT_REACHED');
  });

  it('is not available to staff who are not the owner', async () => {
    await prisma.user.create({
      data: {
        tenantId: homeId, email: `desk-${run}@test.com`, passwordHash,
        firstName: 'Front', lastName: 'Desk', role: 'RECEPTIONIST', emailVerifiedAt: new Date(),
      },
    });
    const deskToken = await verifyOwnerAndLogin(app, {
      tenantId: homeId, email: `desk-${run}@test.com`, password, slug: run,
    });

    expect((await link(`${run}-hill`, deskToken)).statusCode).toBe(403);
  });
});

describe('disconnecting', () => {
  it('removes the resort, and the group with it when one is left', async () => {
    await link(`${run}-hill`);

    const res = await disconnect(tenants.hill);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data).toBeNull();
    expect(await prisma.resortGroup.count({ where: { ownerUserId } })).toBe(0);
  });

  it('keeps the group when two resorts are still connected', async () => {
    await link(`${run}-hill`);
    await link(`${run}-lagoon`);

    const data = JSON.parse((await disconnect(tenants.lagoon)).body).data;
    expect(data.resorts.map((r: { slug: string }) => r.slug)).toEqual([run, `${run}-hill`]);
  });

  it('lets the connected resort\'s own owner walk away', async () => {
    await link(`${run}-hill`);
    const hillToken = await verifyOwnerAndLogin(app, {
      tenantId: tenants.hill, email: myEmail, password, slug: `${run}-hill`,
    });

    expect((await disconnect(tenants.hill, hillToken)).statusCode).toBe(200);
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.hill } })).toBe(0);
  });

  it('refuses somebody who owns neither the group nor the resort', async () => {
    await link(`${run}-hill`);
    const theirToken = await verifyOwnerAndLogin(app, {
      tenantId: tenants.theirs, email: strangerEmail, password, slug: `${run}-theirs`,
    });

    const res = await disconnect(tenants.hill, theirToken);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('NOT_RESORT_OWNER');
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.hill } })).toBe(1);
  });

  it('answers 404 for a resort that was never connected', async () => {
    await link(`${run}-hill`);
    expect((await disconnect(tenants.lagoon)).statusCode).toBe(404);
  });
});

/**
 * Asking another owner to connect their resort, and their answer.
 *
 * The rule the whole flow rests on: the emailed token is only a lookup key.
 * Authority comes from being signed in as that resort's owner, checked when the
 * link is opened and again when it is answered — so a forwarded email gives its
 * reader nothing at all.
 *
 * The other one worth reading twice: "figures only" creates no user account in
 * the resort. There is nothing to sign in as, which is a stronger guarantee
 * than any permission check.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { createHash } from 'crypto';

// Captured so the emailed link can actually be followed. Without this the only
// way to test the token is to plant one, which proves the reader works and says
// nothing about what the writer stored.
const sent: { to: string; subject: string; html: string }[] = [];
vi.mock('../../src/services/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/email')>()),
  sendEmail: async (mail: { to: string; subject: string; html: string }) => {
    sent.push(mail);
    return { sent: true };
  },
}));

import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rg-ask-${Date.now()}`;
const password = 'TestPass123!';
const myEmail = `owner-${run}@test.com`;
const theirEmail = `their-${run}@test.com`;

let token: string;
let theirToken: string;
let ownerUserId: string;
let passwordHash: string;
let homeId: string;
const tenants: Record<string, string> = {};

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

const ask = (slug: string) => app.inject({
  method: 'POST', url: '/api/resort-group/links',
  headers: { Authorization: `Bearer ${token}` }, payload: { slug },
});
const incoming = (bearer: string) => app.inject({
  method: 'GET', url: '/api/resort-group/requests/incoming',
  headers: { Authorization: `Bearer ${bearer}` },
});
const byToken = (raw: string, bearer: string) => app.inject({
  method: 'GET', url: `/api/resort-group/requests/by-token/${raw}`,
  headers: { Authorization: `Bearer ${bearer}` },
});
const approve = (id: string, access: string, bearer: string) => app.inject({
  method: 'POST', url: `/api/resort-group/requests/${id}/approve`,
  headers: { Authorization: `Bearer ${bearer}` }, payload: { access },
});
const decline = (id: string, bearer: string) => app.inject({
  method: 'POST', url: `/api/resort-group/requests/${id}/decline`,
  headers: { Authorization: `Bearer ${bearer}` },
});

async function makeResort(key: string, email: string) {
  const tenant = await prisma.tenant.create({
    data: { name: key, slug: `${run}-${key}`, planStatus: 'active' },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email, passwordHash, firstName: 'Their', lastName: key,
      role: 'OWNER', emailVerifiedAt: new Date(),
    },
  });
  tenants[key] = tenant.id;
  return tenant.id;
}

/** A request row with a token this test knows, for the emailed-link paths. */
async function plantRequest(tenantId: string, raw: string, over: Record<string, unknown> = {}) {
  const group = await prisma.resortGroup.findFirstOrThrow({ where: { ownerUserId } });
  return prisma.resortLinkRequest.create({
    data: {
      groupId: group.id, tenantId, requestedById: ownerUserId, tokenHash: hash(raw),
      expiresAt: new Date(Date.now() + 86_400_000), ...over,
    },
  });
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
  tenants.home = homeId;
  token = await verifyOwnerAndLogin(app, { tenantId: homeId, email: myEmail, password, slug: run });
  await prisma.tenant.update({ where: { id: homeId }, data: { planStatus: 'active' } });

  const me = await prisma.user.findUniqueOrThrow({
    where: { tenantId_email: { tenantId: homeId, email: myEmail } },
    select: { id: true, passwordHash: true },
  });
  ownerUserId = me.id;
  passwordHash = me.passwordHash;

  await makeResort('hillview', theirEmail);
  theirToken = await verifyOwnerAndLogin(app, {
    tenantId: tenants.hillview, email: theirEmail, password, slug: `${run}-hillview`,
  });
}, 60000);

beforeEach(async () => {
  sent.length = 0;
  await clearGroups();
  await prisma.user.deleteMany({ where: { tenantId: tenants.hillview, email: myEmail } });
});

afterAll(async () => {
  await clearGroups();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('asking', () => {
  it('creates a request rather than connecting anything', async () => {
    const res = await ask(`${run}-hillview`);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('requested');

    const row = await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: tenants.hillview } });
    expect(row.approvedAt).toBeNull();
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.hillview } })).toBe(0);
  });

  it('emails that resort\'s owner a link that works', async () => {
    await ask(`${run}-hillview`);

    const mail = sent.find((m) => m.to === theirEmail);
    expect(mail, JSON.stringify(sent.map((m) => m.to))).toBeTruthy();
    expect(mail!.subject).toContain('Asha Rahman');

    const raw = mail!.html.match(/\/resort-link\/([0-9a-f]{64})/)?.[1];
    expect(raw).toBeTruthy();
    const res = await byToken(raw!, theirToken);
    expect(res.statusCode, res.body).toBe(200);
  });

  it('keeps only the hash of that token, so a stolen row is not a key', async () => {
    await ask(`${run}-hillview`);
    const raw = sent.find((m) => m.to === theirEmail)!.html.match(/\/resort-link\/([0-9a-f]{64})/)![1];
    const row = await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: tenants.hillview } });

    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toBe(hash(raw));
  });

  it('shows the asker their request is waiting', async () => {
    await ask(`${run}-hillview`);
    const group = JSON.parse((await app.inject({
      method: 'GET', url: '/api/resort-group', headers: { Authorization: `Bearer ${token}` },
    })).body).data;

    expect(group.pendingRequests).toMatchObject([{ tenantSlug: `${run}-hillview` }]);
    // …and their own resort alone is not enough for the dropdown to appear.
    expect(group.resorts).toHaveLength(1);
  });

  it('refuses a second ask a moment later', async () => {
    await ask(`${run}-hillview`);
    const again = await ask(`${run}-hillview`);
    expect(again.statusCode).toBe(429);
    expect(JSON.parse(again.body).code).toBe('REQUEST_TOO_SOON');
  });

  it('replaces the old token when asked again later, instead of leaving two live', async () => {
    await ask(`${run}-hillview`);
    const first = await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: tenants.hillview } });
    await prisma.resortLinkRequest.update({
      where: { id: first.id }, data: { createdAt: new Date(Date.now() - 120_000) },
    });

    expect((await ask(`${run}-hillview`)).statusCode).toBe(200);
    const rows = await prisma.resortLinkRequest.findMany({ where: { tenantId: tenants.hillview } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(first.tokenHash);
  });
});

describe('the owner being asked', () => {
  beforeEach(() => ask(`${run}-hillview`));

  it('sees who is asking and from where', async () => {
    const rows = JSON.parse((await incoming(theirToken)).body).data;
    expect(rows).toMatchObject([{ askerName: 'Asha Rahman', askerEmail: myEmail, askerResort: 'Sea Pearl' }]);
  });

  it('is the only one who sees it', async () => {
    expect(JSON.parse((await incoming(token)).body).data).toEqual([]);
  });
});

describe('the link in the email', () => {
  it('opens for that resort\'s owner', async () => {
    await ask(`${run}-hillview`);
    const raw = 'a'.repeat(64);
    await prisma.resortLinkRequest.deleteMany({ where: { tenantId: tenants.hillview } });
    await plantRequest(tenants.hillview, raw);

    const res = await byToken(raw, theirToken);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data).toMatchObject({ resortName: 'hillview', askerName: 'Asha Rahman' });
  });

  it('is worthless to anyone else, including whoever sent it', async () => {
    await ask(`${run}-hillview`);
    const raw = 'b'.repeat(64);
    await prisma.resortLinkRequest.deleteMany({ where: { tenantId: tenants.hillview } });
    await plantRequest(tenants.hillview, raw);

    const res = await byToken(raw, token);
    expect(res.statusCode).toBe(404);
  });

  it('is gone after a week', async () => {
    await ask(`${run}-hillview`);
    const raw = 'c'.repeat(64);
    await prisma.resortLinkRequest.deleteMany({ where: { tenantId: tenants.hillview } });
    await plantRequest(tenants.hillview, raw, { expiresAt: new Date(Date.now() - 1000) });

    const res = await byToken(raw, theirToken);
    expect(res.statusCode).toBe(410);
    expect(JSON.parse(res.body).code).toBe('LINK_REQUEST_EXPIRED');
  });

  it('is gone once it has been answered', async () => {
    await ask(`${run}-hillview`);
    const raw = 'd'.repeat(64);
    await prisma.resortLinkRequest.deleteMany({ where: { tenantId: tenants.hillview } });
    await plantRequest(tenants.hillview, raw, { declinedAt: new Date() });

    expect((await byToken(raw, theirToken)).statusCode).toBe(410);
  });
});

describe('saying yes', () => {
  let requestId: string;
  beforeEach(async () => {
    await ask(`${run}-hillview`);
    requestId = (await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: tenants.hillview } })).id;
  });

  it('gives full access through a real account, and records that it made one', async () => {
    const res = await approve(requestId, 'FULL', theirToken);
    expect(res.statusCode, res.body).toBe(200);
    expect(sent.some((m) => m.to === myEmail && m.subject.includes('connected'))).toBe(true);

    const member = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: tenants.hillview } });
    expect(member).toMatchObject({ access: 'FULL', linkedUserCreated: true });

    const linked = await prisma.user.findUniqueOrThrow({ where: { id: member.linkedUserId! } });
    expect(linked).toMatchObject({ tenantId: tenants.hillview, email: myEmail, role: 'OWNER' });

    // And the asker can now actually get in.
    const switched = await app.inject({
      method: 'POST', url: '/api/auth/switch-resort',
      headers: { Authorization: `Bearer ${token}` }, payload: { tenantId: tenants.hillview },
    });
    expect(switched.statusCode, switched.body).toBe(200);
  });

  it('gives figures only by creating no account at all', async () => {
    const before = await prisma.user.count({ where: { tenantId: tenants.hillview } });

    expect((await approve(requestId, 'NUMBERS_ONLY', theirToken)).statusCode).toBe(200);

    const member = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: tenants.hillview } });
    expect(member).toMatchObject({ access: 'NUMBERS_ONLY', linkedUserId: null, linkedUserCreated: false });
    expect(await prisma.user.count({ where: { tenantId: tenants.hillview } })).toBe(before);

    const switched = await app.inject({
      method: 'POST', url: '/api/auth/switch-resort',
      headers: { Authorization: `Bearer ${token}` }, payload: { tenantId: tenants.hillview },
    });
    expect(switched.statusCode).toBe(403);
  });

  it('cannot be done by the person who asked', async () => {
    const res = await approve(requestId, 'FULL', token);
    expect(res.statusCode).toBe(404);
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.hillview } })).toBe(0);
  });

  it('cannot be done twice', async () => {
    expect((await approve(requestId, 'FULL', theirToken)).statusCode).toBe(200);
    const again = await approve(requestId, 'NUMBERS_ONLY', theirToken);
    expect(again.statusCode).toBe(410);
    expect(JSON.parse(again.body).code).toBe('LINK_REQUEST_USED');
  });

  it('cannot be done after a week', async () => {
    await prisma.resortLinkRequest.update({
      where: { id: requestId }, data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await approve(requestId, 'FULL', theirToken)).statusCode).toBe(410);
  });

  it('reuses an account that already exists for that address', async () => {
    const existing = await prisma.user.create({
      data: {
        tenantId: tenants.hillview, email: myEmail, passwordHash,
        firstName: 'Asha', lastName: 'Rahman', role: 'MANAGER', emailVerifiedAt: new Date(),
      },
    });

    expect((await approve(requestId, 'FULL', theirToken)).statusCode).toBe(200);
    const member = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: tenants.hillview } });
    // Reused, and marked as not ours — disconnecting must not switch off an
    // account this resort was already using for its own reasons.
    expect(member.linkedUserId).toBe(existing.id);
    expect(member.linkedUserCreated).toBe(false);
  });
});

describe('saying no', () => {
  let requestId: string;
  beforeEach(async () => {
    await ask(`${run}-hillview`);
    requestId = (await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: tenants.hillview } })).id;
  });

  it('records the refusal, connects nothing, and tells whoever asked', async () => {
    expect((await decline(requestId, theirToken)).statusCode).toBe(200);
    expect(sent.some((m) => m.to === myEmail && m.subject.includes('hillview'))).toBe(true);
    expect((await prisma.resortLinkRequest.findUniqueOrThrow({ where: { id: requestId } })).declinedAt).not.toBeNull();
    expect(await prisma.resortGroupTenant.count({ where: { tenantId: tenants.hillview } })).toBe(0);
  });

  it('takes a second click calmly', async () => {
    await decline(requestId, theirToken);
    expect((await decline(requestId, theirToken)).statusCode).toBe(200);
  });

  it('will not undo an approval', async () => {
    await approve(requestId, 'FULL', theirToken);
    expect((await decline(requestId, theirToken)).statusCode).toBe(410);
  });

  it('cannot be done by the person who asked', async () => {
    expect((await decline(requestId, token)).statusCode).toBe(404);
  });
});

describe('disconnecting afterwards', () => {
  it('switches off an account that existed only for the connection', async () => {
    await ask(`${run}-hillview`);
    const requestId = (await prisma.resortLinkRequest.findFirstOrThrow({ where: { tenantId: tenants.hillview } })).id;
    await approve(requestId, 'FULL', theirToken);

    const member = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: tenants.hillview } });
    const linkedUserId = member.linkedUserId!;
    await prisma.refreshToken.create({
      data: { userId: linkedUserId, token: `rt-${run}`, expiresAt: new Date(Date.now() + 86_400_000) },
    });

    const res = await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${tenants.hillview}`,
      headers: { Authorization: `Bearer ${theirToken}` },
    });
    expect(res.statusCode, res.body).toBe(200);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: linkedUserId } })).isActive).toBe(false);
    expect(await prisma.refreshToken.count({ where: { userId: linkedUserId } })).toBe(0);
  });

  it('leaves a same-email owner\'s own login alone', async () => {
    // Their own account on their own resort. Disconnecting must not lock them
    // out of it.
    const mine = await makeResort('second', myEmail);
    await ask(`${run}-second`);
    const linked = await prisma.resortGroupTenant.findUniqueOrThrow({ where: { tenantId: mine } });
    expect(linked.linkedUserCreated).toBe(false);

    await app.inject({
      method: 'DELETE', url: `/api/resort-group/members/${mine}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: linked.linkedUserId! } })).isActive).toBe(true);
  });
});

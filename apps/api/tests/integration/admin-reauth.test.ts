/**
 * Typing the password again before something that cannot be undone.
 *
 * An admin token lasts eight hours. Revoking it is possible now, but revocation
 * is a reaction — it needs someone to notice first. This is the other half: for
 * the handful of actions where being wrong is permanent, holding the session is
 * not enough (release-readiness review M-03).
 *
 * The two that matter here are the last two: a session whose window has closed
 * cannot delete a resort, and reauth is scoped to the session that asked — so
 * confirming on one laptop does not open the window on another.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `reauth-${Date.now()}`;
const email = `admin-${run}@test.com`;
const password = 'a-long-enough-admin-password';
let adminId: string;
let doomedTenantId: string;

let ipCounter = 0;
const nextIp = () => `10.2.${Math.floor(ipCounter / 254) % 254}.${(ipCounter++ % 254) + 1}`;

const login = () => app.inject({
  method: 'POST', url: '/api/admin/login', remoteAddress: nextIp(),
  payload: { email, password },
});

const tokenFrom = (res: { body: string }) => JSON.parse(res.body).data.token as string;
const sidOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sid as string;

const call = (token: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url, remoteAddress: nextIp(),
    headers: { Authorization: `Bearer ${token}` }, payload: payload as never,
  });

/** Push this session's last-password-typed back beyond the window. */
const goStale = (token: string) => prisma.adminSession.update({
  where: { id: sidOf(token) },
  data: { reauthAt: new Date(Date.now() - 60 * 60 * 1000) },
});

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  adminId = (await prisma.adminUser.create({
    data: {
      email, passwordHash: await bcrypt.hash(password, 10),
      role: 'SUPER_ADMIN', firstName: 'Reauth', lastName: 'Probe',
    },
  })).id;

  doomedTenantId = (await prisma.tenant.create({
    data: { name: 'Doomed Resort', slug: run },
  })).id;
}, 60000);

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { adminEmail: email } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await prisma.adminUser.deleteMany({ where: { email } });
  await app.close();
});

describe('just after signing in', () => {
  it('the window is already open — signing in is typing the password', async () => {
    const token = tokenFrom(await login());
    const session = await prisma.adminSession.findUnique({ where: { id: sidOf(token) } });
    expect(session?.reauthAt).not.toBeNull();
  });

  it('an ordinary read is not affected either way', async () => {
    const token = tokenFrom(await login());
    await goStale(token);
    expect((await call(token, 'GET', '/api/admin/stats')).statusCode).toBe(200);
  });
});

describe('when the window has closed', () => {
  it('refuses to permanently delete a resort, and says what is needed', async () => {
    const token = tokenFrom(await login());
    await goStale(token);

    const res = await call(token, 'DELETE', `/api/admin/tenants/${doomedTenantId}`, {
      confirmName: 'Doomed Resort',
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('REAUTH_REQUIRED');

    // And the resort is still there, which is the point.
    expect(await prisma.tenant.count({ where: { id: doomedTenantId } })).toBe(1);
  });

  it('refuses to create another admin', async () => {
    const token = tokenFrom(await login());
    await goStale(token);

    const res = await call(token, 'POST', '/api/admin/team', {
      email: `sneaky-${run}@test.com`, password: 'whatever-long-enough', role: 'SUPER_ADMIN',
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('REAUTH_REQUIRED');
    expect(await prisma.adminUser.count({ where: { email: `sneaky-${run}@test.com` } })).toBe(0);
  });

  it('refuses to write the platform storage credentials', async () => {
    const token = tokenFrom(await login());
    await goStale(token);

    const res = await call(token, 'PATCH', '/api/admin/storage', { bucket: 'somewhere-else' });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('REAUTH_REQUIRED');
  });
});

describe('confirming the password', () => {
  it('refuses a wrong one and leaves the window shut', async () => {
    const token = tokenFrom(await login());
    await goStale(token);

    expect((await call(token, 'POST', '/api/admin/reauth', { password: 'wrong' })).statusCode).toBe(401);
    expect((await call(token, 'PATCH', '/api/admin/storage', { bucket: 'x' })).statusCode).toBe(403);
  });

  it('opens it again for the right one', async () => {
    const token = tokenFrom(await login());
    await goStale(token);

    expect((await call(token, 'POST', '/api/admin/reauth', { password })).statusCode).toBe(200);
    expect((await call(token, 'PATCH', '/api/admin/storage', { bucket: `b-${run}` })).statusCode).toBe(200);
  });

  it('opens it only for the session that asked', async () => {
    const mine = tokenFrom(await login());
    const other = tokenFrom(await login());
    await goStale(mine);
    await goStale(other);

    expect((await call(mine, 'POST', '/api/admin/reauth', { password })).statusCode).toBe(200);

    // The other laptop is still shut out.
    const res = await call(other, 'PATCH', '/api/admin/storage', { bucket: 'nope' });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('REAUTH_REQUIRED');
  });
});

describe('with two-factor on', () => {
  it('asks for the code as well as the password', async () => {
    const { generateSecret, totp } = await import('../../src/utils/totp');
    const { encryptOrNull } = await import('../../src/utils/secret-box');
    const previousKey = process.env.CREDENTIALS_KEY;
    process.env.CREDENTIALS_KEY = Buffer.from(`reauth-mfa-key-${'z'.repeat(20)}`)
      .subarray(0, 32).toString('base64');

    const secret = generateSecret();
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { mfaSecret: encryptOrNull(secret), mfaEnabledAt: new Date() },
    });

    try {
      const token = tokenFrom(await app.inject({
        method: 'POST', url: '/api/admin/login', remoteAddress: nextIp(),
        payload: { email, password, code: totp(secret) },
      }));
      await goStale(token);

      // Password alone is no longer enough to reopen the window.
      const passwordOnly = await call(token, 'POST', '/api/admin/reauth', { password });
      expect(passwordOnly.statusCode).toBe(401);
      expect(JSON.parse(passwordOnly.body).code).toBe('MFA_INVALID');

      const both = await call(token, 'POST', '/api/admin/reauth', { password, code: totp(secret) });
      expect(both.statusCode, both.body).toBe(200);
    } finally {
      await prisma.adminUser.update({
        where: { id: adminId }, data: { mfaSecret: null, mfaEnabledAt: null },
      });
      if (previousKey === undefined) delete process.env.CREDENTIALS_KEY;
      else process.env.CREDENTIALS_KEY = previousKey;
    }
  });
});

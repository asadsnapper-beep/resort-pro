/**
 * An admin sign-in that can be taken back.
 *
 * The admin token was a bearer JWT and nothing else: once issued there was no
 * way to stop it short of its eight hours, so a token lifted off a laptop was
 * eight hours of the whole platform and nobody could end it — not even the
 * person it belonged to (release-readiness review M-03).
 *
 * What these hold down is that revocation is real: the same token, which worked
 * a moment ago, stops working. And that a token naming no session at all — the
 * shape every admin token had before this — is refused rather than trusted,
 * because that would be a permanent way around the whole thing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `sess-${Date.now()}`;
const email = `admin-${run}@test.com`;
const password = 'a-long-enough-admin-password';
let adminId: string;

let ipCounter = 0;
const nextIp = () => `10.1.${Math.floor(ipCounter / 254) % 254}.${(ipCounter++ % 254) + 1}`;

const login = () => app.inject({
  method: 'POST', url: '/api/admin/login', remoteAddress: nextIp(),
  headers: { 'user-agent': 'ResortPro test runner' },
  payload: { email, password },
});

const tokenFrom = (res: { body: string }) => JSON.parse(res.body).data.token as string;
const sidOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sid as string;

const call = (token: string, method: 'GET' | 'POST' = 'GET', url = '/api/admin/stats', payload?: unknown) =>
  app.inject({
    method, url, remoteAddress: nextIp(),
    headers: { Authorization: `Bearer ${token}` }, payload: payload as never,
  });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  adminId = (await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'SUPER_ADMIN',
      firstName: 'Session',
      lastName: 'Probe',
    },
  })).id;
}, 60000);

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { adminEmail: email } });
  await prisma.adminUser.deleteMany({ where: { email } });
  await app.close();
});

describe('signing in', () => {
  it('records where and how, and names that session in the token', async () => {
    const token = tokenFrom(await login());
    const session = await prisma.adminSession.findUnique({ where: { id: sidOf(token) } });

    expect(session?.adminUserId).toBe(adminId);
    expect(session?.userAgent).toBe('ResortPro test runner');
    expect(session?.ipAddress).toBeTruthy();
    expect(session?.revokedAt).toBeNull();
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives each sign-in its own session', async () => {
    const a = sidOf(tokenFrom(await login()));
    const b = sidOf(tokenFrom(await login()));
    expect(a).not.toBe(b);
  });
});

describe('a token that names no session', () => {
  it('is refused — this is the shape every admin token used to have', async () => {
    const legacy = app.jwt.sign({
      sub: adminId, email, adminRole: 'SUPER_ADMIN', isSuperAdmin: true,
    }, { expiresIn: '8h' });

    const res = await call(legacy);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('SESSION_REQUIRED');
  });
});

describe('revoking', () => {
  it('kills the token that was working a moment ago', async () => {
    const token = tokenFrom(await login());
    expect((await call(token)).statusCode).toBe(200);

    await prisma.adminSession.update({
      where: { id: sidOf(token) }, data: { revokedAt: new Date() },
    });

    const after = await call(token);
    expect(after.statusCode).toBe(401);
    expect(JSON.parse(after.body).code).toBe('SESSION_ENDED');
  });

  it('signing out revokes the session on the server, not just the browser', async () => {
    const token = tokenFrom(await login());
    expect((await call(token, 'POST', '/api/admin/logout')).statusCode).toBe(200);

    expect((await call(token)).statusCode).toBe(401);
    const session = await prisma.adminSession.findUnique({ where: { id: sidOf(token) } });
    expect(session?.revokedAt).not.toBeNull();
  });

  it('ends every other session but the one asking', async () => {
    const stale = tokenFrom(await login());
    const alsoStale = tokenFrom(await login());
    const current = tokenFrom(await login());

    const res = await call(current, 'POST', '/api/admin/sessions/revoke', { others: true });
    expect(res.statusCode, res.body).toBe(200);

    expect((await call(stale)).statusCode).toBe(401);
    expect((await call(alsoStale)).statusCode).toBe(401);
    expect((await call(current)).statusCode).toBe(200);
  });

  it('cannot reach another admin\'s session', async () => {
    const otherEmail = `other-${run}@test.com`;
    const other = await prisma.adminUser.create({
      data: {
        email: otherEmail, passwordHash: 'x', role: 'SUPER_ADMIN',
        firstName: 'Other', lastName: 'Admin',
      },
    });
    const theirSession = await prisma.adminSession.create({
      data: { adminUserId: other.id, expiresAt: new Date(Date.now() + 3600_000) },
    });

    const mine = tokenFrom(await login());
    const res = await call(mine, 'POST', '/api/admin/sessions/revoke', { sessionId: theirSession.id });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.revoked).toBe(0);

    const still = await prisma.adminSession.findUnique({ where: { id: theirSession.id } });
    expect(still?.revokedAt).toBeNull();

    await prisma.adminUser.delete({ where: { id: other.id } });
  });
});

describe('an expired session', () => {
  it('is refused even though the token itself has not expired', async () => {
    const token = tokenFrom(await login());
    await prisma.adminSession.update({
      where: { id: sidOf(token) }, data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await call(token);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('SESSION_ENDED');
  });
});

describe('listing sessions', () => {
  it('shows where this account is signed in, and which one is asking', async () => {
    await login();
    const current = tokenFrom(await login());

    const res = await call(current, 'GET', '/api/admin/sessions');
    expect(res.statusCode, res.body).toBe(200);
    const { sessions } = JSON.parse(res.body).data;

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    expect(sessions.find((s: { current: boolean }) => s.current).id).toBe(sidOf(current));
  });

  it('leaves out the ones already ended', async () => {
    const doomed = tokenFrom(await login());
    const current = tokenFrom(await login());
    await call(doomed, 'POST', '/api/admin/logout');

    const { sessions } = JSON.parse((await call(current, 'GET', '/api/admin/sessions')).body).data;
    expect(sessions.map((s: { id: string }) => s.id)).not.toContain(sidOf(doomed));
  });
});

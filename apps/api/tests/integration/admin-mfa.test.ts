/**
 * The admin second factor, end to end.
 *
 * Admin login had a password and nothing else, so a leaked or guessed password
 * was the whole platform (release-readiness review M-03). The thing these tests
 * hold down is not that the feature exists — it is that it cannot be walked
 * around, and that it cannot lock the one admin out of their own platform.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import bcrypt from 'bcryptjs';
import { totp } from '../../src/utils/totp';
import { decryptOrNull } from '../../src/utils/secret-box';
import { keepEnv } from '../helpers/env';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `mfa-${Date.now()}`;
const email = `admin-${run}@test.com`;
const password = 'a-long-enough-admin-password';

let adminId: string;
let token: string;
let secret: string;
let recoveryCodes: string[];

// Admin login is capped at ten attempts a minute per IP, which is the point of
// it — this file makes far more than ten. Each request comes from its own
// address rather than the limit being loosened for tests.
let ipCounter = 0;
const nextIp = () => `10.${Math.floor(ipCounter / 65025) % 255}.`
  + `${Math.floor(ipCounter / 255) % 255}.${(ipCounter++ % 254) + 1}`;

const login = (body: Record<string, unknown>) => app.inject({
  method: 'POST',
  url: '/api/admin/login',
  remoteAddress: nextIp(),
  payload: { email, password, ...body },
});

const authed = (method: 'GET' | 'POST', url: string, payload?: unknown) => app.inject({
  method,
  url,
  remoteAddress: nextIp(),
  headers: { Authorization: `Bearer ${token}` },
  payload: payload as never,
});

keepEnv('CREDENTIALS_KEY');

beforeAll(async () => {
  process.env.CREDENTIALS_KEY = Buffer.from(`admin-mfa-test-key-${'y'.repeat(16)}`)
    .subarray(0, 32).toString('base64');

  app = await buildApp();
  await app.ready();

  adminId = (await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'SUPER_ADMIN',
      firstName: 'Mfa',
      lastName: 'Probe',
    },
  })).id;

  const first = await login({});
  expect(first.statusCode, first.body).toBe(200);
  token = JSON.parse(first.body).data.token;
}, 60000);

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { adminEmail: email } });
  await prisma.adminUser.deleteMany({ where: { email } });
  await app.close();
});

describe('before anything is set up', () => {
  it('a password alone is still enough', async () => {
    expect((await login({})).statusCode).toBe(200);
  });

  it('reports itself as off', async () => {
    const res = await authed('GET', '/api/admin/mfa');
    expect(JSON.parse(res.body).data).toMatchObject({ enabled: false, recoveryCodesRemaining: 0 });
  });
});

describe('enrolling', () => {
  it('hands back a secret and a URI an authenticator can read', async () => {
    const res = await authed('POST', '/api/admin/mfa/setup');
    expect(res.statusCode, res.body).toBe(200);
    const data = JSON.parse(res.body).data;
    secret = data.secret;
    expect(data.otpauthUri).toContain('otpauth://totp/');
    expect(data.otpauthUri).toContain(`secret=${secret}`);
  });

  it('stores that secret encrypted, not as itself', async () => {
    const row = await prisma.adminUser.findUnique({
      where: { id: adminId }, select: { mfaSecret: true },
    });
    expect(row?.mfaSecret).not.toBe(secret);
    expect(row?.mfaSecret?.startsWith('enc:v1:')).toBe(true);
    expect(decryptOrNull(row?.mfaSecret)).toBe(secret);
  });

  it('is not in force until a code is proved', async () => {
    // Half-enrolled: the login that follows must still work on a password.
    expect((await login({})).statusCode).toBe(200);
  });

  it('refuses a wrong code and stays off', async () => {
    const res = await authed('POST', '/api/admin/mfa/enable', { code: '000000' });
    expect(res.statusCode).toBe(400);
    expect((await login({})).statusCode).toBe(200);
  });

  it('turns on with a real code and returns recovery codes once', async () => {
    const res = await authed('POST', '/api/admin/mfa/enable', { code: totp(secret) });
    expect(res.statusCode, res.body).toBe(200);
    recoveryCodes = JSON.parse(res.body).data.recoveryCodes;
    expect(recoveryCodes).toHaveLength(10);

    // Stored hashed — the codes themselves are not in the table.
    const stored = await prisma.adminRecoveryCode.findMany({
      where: { adminUserId: adminId }, select: { codeHash: true },
    });
    expect(stored).toHaveLength(10);
    for (const row of stored) expect(recoveryCodes).not.toContain(row.codeHash);
  });
});

describe('once it is on', () => {
  it('refuses a password on its own, and says why', async () => {
    const res = await login({});
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('MFA_REQUIRED');
    expect(JSON.parse(res.body).data?.token).toBeUndefined();
  });

  it('refuses a wrong code', async () => {
    const res = await login({ code: '000000' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('MFA_INVALID');
  });

  it('still refuses a wrong password even with a right code', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/login',
      remoteAddress: nextIp(),
      payload: { email, password: 'not-the-password', code: totp(secret) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('lets the real code through', async () => {
    const res = await login({ code: totp(secret) });
    expect(res.statusCode, res.body).toBe(200);
    token = JSON.parse(res.body).data.token;
  });

  it('records a failed attempt in the audit log', async () => {
    await login({ code: '111111' });
    const rows = await prisma.auditLog.findMany({
      where: { adminEmail: email, action: 'admin_mfa_failed' },
    });
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('the day the phone is lost', () => {
  it('a recovery code gets you in', async () => {
    const res = await login({ code: recoveryCodes[0] });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('and only once', async () => {
    const again = await login({ code: recoveryCodes[0] });
    expect(again.statusCode).toBe(401);
  });

  it('accepts one however it was typed', async () => {
    const messy = ` ${recoveryCodes[1].toLowerCase().replace('-', ' ')} `;
    expect((await login({ code: messy })).statusCode).toBe(200);
  });

  it('does not spend a code when an authenticator code is mistyped', async () => {
    const before = await prisma.adminRecoveryCode.count({
      where: { adminUserId: adminId, usedAt: null },
    });
    await login({ code: '000000' });
    const after = await prisma.adminRecoveryCode.count({
      where: { adminUserId: adminId, usedAt: null },
    });
    expect(after).toBe(before);
  });
});

describe('turning it off', () => {
  beforeAll(async () => {
    token = JSON.parse((await login({ code: totp(secret) })).body).data.token;
  });

  it('needs the password, not just the session', async () => {
    const res = await authed('POST', '/api/admin/mfa/disable', { code: totp(secret) });
    expect(res.statusCode).toBe(401);
  });

  it('needs a current code as well as the password', async () => {
    const res = await authed('POST', '/api/admin/mfa/disable', { password, code: '000000' });
    expect(res.statusCode).toBe(401);
  });

  it('clears the secret and the recovery codes when both are right', async () => {
    const res = await authed('POST', '/api/admin/mfa/disable', { password, code: totp(secret) });
    expect(res.statusCode, res.body).toBe(200);

    const row = await prisma.adminUser.findUnique({
      where: { id: adminId }, select: { mfaSecret: true, mfaEnabledAt: true },
    });
    expect(row).toMatchObject({ mfaSecret: null, mfaEnabledAt: null });
    expect(await prisma.adminRecoveryCode.count({ where: { adminUserId: adminId } })).toBe(0);
    expect((await login({})).statusCode).toBe(200);
  });
});

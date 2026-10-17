/**
 * Signing in twice in the same second.
 *
 * A refresh token used to be signed as `{ sub, type: 'refresh' }`, and a JWT's
 * iat/exp have one-second resolution — so two tokens issued for the same user
 * inside one second were byte for byte identical, and `RefreshToken.token` is
 * unique. The second died on the index and the caller got a 500.
 *
 * That is not an exotic race. It is a double-clicked Sign in button, two tabs
 * restoring together, or a phone and a laptop signing in at once.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { refreshTokenPayload } from '../../src/utils/refresh-token';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `rt-nonce-${Date.now()}`;
const password = 'TestPass123!';
const email = `owner-${run}@test.com`;
let tenantId: string;

const login = () => app.inject({
  method: 'POST', url: '/api/auth/login', payload: { email, password, slug: run },
});

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Sea Pearl', slug: run, firstName: 'Asha', lastName: 'Rahman', email, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  await prisma.user.update({
    where: { tenantId_email: { tenantId, email } }, data: { emailVerifiedAt: new Date() },
  });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active' } });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('two sign-ins at once', () => {
  it('both succeed, and leave two separate sessions behind', async () => {
    const before = await prisma.refreshToken.count({ where: { user: { email } } });

    const [first, second] = await Promise.all([login(), login()]);
    expect([first.statusCode, second.statusCode], `${first.body} ${second.body}`).toEqual([200, 200]);

    const cookie = (res: typeof first) => res.cookies.find((c) => c.name === 'rp_refresh')?.value;
    expect(cookie(first)).toBeTruthy();
    expect(cookie(first)).not.toBe(cookie(second));
    expect(await prisma.refreshToken.count({ where: { user: { email } } })).toBe(before + 2);
  });
});

describe('the nonce', () => {
  it('makes every token different, even for the same user in the same instant', () => {
    const a = refreshTokenPayload('user-1');
    const b = refreshTokenPayload('user-1');
    expect(a.jti).not.toBe(b.jti);
    expect(a.sub).toBe(b.sub);
  });

  it('is the only way a refresh token is built', () => {
    // Source-level, because the failure it prevents only appears when two
    // requests land in the same second — and the next hand-rolled
    // `{ sub, type: 'refresh' }` would bring the 500 straight back.
    for (const file of ['routes/auth.ts', 'routes/admin.ts']) {
      const source = readFileSync(join(__dirname, '../../src', file), 'utf8');
      expect(source, file).not.toMatch(/sign\(\s*\{\s*sub:[^}]*type:\s*'refresh'/);
    }
  });
});

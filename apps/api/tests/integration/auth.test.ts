import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { prisma } from '@resort-pro/database';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/auth/register', () => {
  it('creates an unverified account and requires email verification', async () => {
    const slug = `test-resort-${Date.now()}`;
    const email = `owner-${Date.now()}@test.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: '127.0.0.10',
      payload: {
        resortName: 'Test Resort',
        slug,
        firstName: 'John',
        lastName: 'Doe',
        email,
        password: 'Password123!',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeUndefined();
    expect(body.data.requiresEmailVerification).toBe(true);
    expect(body.data.tenant.slug).toBe(slug);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'Password123!', slug },
    });
    expect(login.statusCode).toBe(403);
    expect(JSON.parse(login.body).code).toBe('EMAIL_VERIFICATION_REQUIRED');

    const rawToken = `verification-${Date.now()}-token-with-enough-length`;
    await prisma.emailVerificationToken.updateMany({
      where: { userId: body.data.user.id, usedAt: null },
      data: { tokenHash: createHash('sha256').update(rawToken).digest('hex') },
    });
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: rawToken },
    });
    expect(verified.statusCode).toBe(200);
    expect(JSON.parse(verified.body).data.token).toBeDefined();
  });

  it('returns 409 when slug is taken', async () => {
    const slug = `duplicate-${Date.now()}`;
    const payload = {
      resortName: 'Test Resort',
      slug,
      firstName: 'Jane',
      lastName: 'Doe',
      email: `test-${Date.now()}@test.com`,
      password: 'Password123!',
    };
    await app.inject({ method: 'POST', url: '/api/auth/register', remoteAddress: '127.0.0.11', payload });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: '127.0.0.12',
      payload: { ...payload, email: `other-${Date.now()}@test.com` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 on invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: '127.0.0.13',
      payload: {
        resortName: 'Test',
        slug: `bad-${Date.now()}`,
        firstName: 'A',
        lastName: 'B',
        email: 'test@test.com',
        password: 'weak',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('allows only one signup per IP every ten minutes', async () => {
    const suffix = Date.now();
    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: '127.0.0.14',
      payload: {
        resortName: 'Rate Limit One', slug: `rate-one-${suffix}`,
        firstName: 'A', lastName: 'Owner', email: `rate-one-${suffix}@test.com`, password: 'Password123!',
      },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      remoteAddress: '127.0.0.14',
      payload: {
        resortName: 'Rate Limit Two', slug: `rate-two-${suffix}`,
        firstName: 'B', lastName: 'Owner', email: `rate-two-${suffix}@test.com`, password: 'Password123!',
      },
    });
    expect(second.statusCode).toBe(429);
  });
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });
});

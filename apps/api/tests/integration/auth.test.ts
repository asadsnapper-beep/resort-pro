import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/auth/register', () => {
  it('returns 201 with token on valid registration', async () => {
    const slug = `test-resort-${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        resortName: 'Test Resort',
        slug,
        firstName: 'John',
        lastName: 'Doe',
        email: `owner-${Date.now()}@test.com`,
        password: 'Password123!',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.tenant.slug).toBe(slug);
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
    await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...payload, email: `other-${Date.now()}@test.com` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 on invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
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
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });
});

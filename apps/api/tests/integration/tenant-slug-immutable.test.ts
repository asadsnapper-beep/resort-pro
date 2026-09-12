/**
 * The workspace URL cannot be changed, and saying so beats pretending.
 *
 * Settings offered URL Slug as an editable input. `updateTenantSchema` never
 * declared `slug`, so z.object stripped it and the route answered 200 "Settings
 * updated" — an owner could type a new public URL, be told it saved, and find
 * the old one still in place. Nothing in the API changes a slug: it is set at
 * registration and never again, not even by an admin route.
 *
 * reports/qa/2026-09-09-settings-deep-qa.md (C-02), whose required fix was
 * either real slug changes or an explicitly read-only field. Read-only was the
 * founder's call.
 *
 * The shape of the guard matters as much as the guard. A blanket rejection of
 * any `slug` in the body would break saving for a cached older bundle that
 * still submits the current value — which is precisely what the phantom `city`
 * field did to General Settings. So an identical slug is accepted and only a
 * different one is refused.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `tenant-slug-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

const patch = (payload: object) => app.inject({
  method: 'PATCH', url: '/api/tenant', headers: auth(), payload,
});

async function storedSlug() {
  const row = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return row?.slug;
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Tenant Slug', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planStatus: 'active', plan: 'ENTERPRISE' },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('trying to change the workspace URL', () => {
  it('is refused, instead of being dropped and called a success', async () => {
    const res = await patch({ slug: 'something-else-entirely' });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('SLUG_IMMUTABLE');
    expect(body.field).toBe('slug');
    // The old answer was 200 with "Settings updated".
    expect(body.success).toBe(false);
  });

  it('leaves the stored slug exactly as it was', async () => {
    await patch({ slug: 'another-attempt' });
    expect(await storedSlug()).toBe(slug);
  });

  it('says something the owner can act on', async () => {
    const body = JSON.parse((await patch({ slug: 'nope' })).body);
    // Not "invalid field": the reason the URL is fixed is what makes the
    // refusal make sense.
    expect(body.error).toMatch(/contact support/i);
  });

  it('refuses before writing anything else in the same request', async () => {
    // A partial save would be worse than a refusal: the owner would be told the
    // slug failed while their other edits had silently landed.
    const before = await prisma.tenant.findUnique({
      where: { id: tenantId }, select: { phone: true },
    });

    const res = await patch({ slug: 'nope-again', phone: '+8801755555555' });
    expect(res.statusCode).toBe(400);

    const after = await prisma.tenant.findUnique({
      where: { id: tenantId }, select: { phone: true },
    });
    expect(after?.phone).toBe(before?.phone);
  });
});

describe('a client that submits the slug it already has', () => {
  it('still saves, so an older bundle does not lose the ability to save', async () => {
    const res = await patch({ slug, phone: '+8801744444444' });

    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.phone).toBe('+8801744444444');
    expect(await storedSlug()).toBe(slug);
  });

  it('saves normally when no slug is sent at all', async () => {
    const res = await patch({ phone: '+8801733333333' });
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('reading Settings', () => {
  it('still returns the slug, because the page has to display it', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    expect(JSON.parse(res.body).data.slug).toBe(slug);
  });
});

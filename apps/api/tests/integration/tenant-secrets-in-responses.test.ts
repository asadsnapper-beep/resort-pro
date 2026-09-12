/**
 * A response body may not carry the tenant's credentials.
 *
 * Both of these routes answered with `prisma.tenant.update(...)`'s whole row
 * and no select, and Tenant holds nine secret-looking columns including
 * `smsApiSecret`, `waApiToken`, `telegramBotToken` and `ssoClientSecret`. So
 * every Settings save and every Discovery save shipped those to the browser,
 * where they reach network logs, proxies and client-side error telemetry.
 *
 * Found by reports/qa/2026-09-09-settings-deep-qa.md (C-05).
 *
 * The forbidden names are read out of schema.prisma at test time rather than
 * listed here — see tests/helpers/secret-fields.ts. A secret added next month
 * is then covered without anyone remembering this file exists.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { tenantSecretFields } from '../helpers/secret-fields';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `tenant-secrets-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const SECRETS = tenantSecretFields();

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Tenant Secrets', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });

  // Real values, so a leak would be a leak of something and not of null. The
  // assertions match on field *names*, which catches the shape either way.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planStatus: 'active', plan: 'ENTERPRISE',
      smsApiKey: 'sk-test-sms-key',
      smsApiSecret: 'sk-test-sms-secret',
      waApiToken: 'wa-test-token',
      telegramBotToken: 'tg-test-token',
      ssoClientSecret: 'sso-test-secret',
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

/** Fails with the offending names rather than just "expected false". */
function expectNoSecrets(where: string, body: string) {
  const leaked = SECRETS.filter((field) => body.includes(field));
  expect(leaked, `${where} leaked: ${leaked.join(', ')}`).toEqual([]);
}

describe('the columns being guarded', () => {
  it('is not an empty list, or these tests prove nothing', () => {
    expect(SECRETS.length).toBeGreaterThan(0);
    expect(SECRETS).toContain('waApiToken');
  });
});

describe('saving Settings', () => {
  it('answers without the tenant credentials', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { name: 'Tenant Secrets Renamed' },
    });

    expect(res.statusCode).toBe(200);
    expectNoSecrets('PATCH /api/tenant', res.body);
  });

  it('still answers with what the Settings screen needs', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(),
      payload: { phone: '+8801700000000' },
    });

    const data = JSON.parse(res.body).data;
    // A select that guards by returning nothing useful would pass the test
    // above and break the page.
    expect(data.phone).toBe('+8801700000000');
    expect(data.name).toBeDefined();
    expect(data.slug).toBeDefined();
    expect(data.currency).toBeDefined();
  });

  it('reads and writes the same shape', async () => {
    const read = await app.inject({ method: 'GET', url: '/api/tenant', headers: auth() });
    const write = await app.inject({
      method: 'PATCH', url: '/api/tenant', headers: auth(), payload: { phone: '+8801711111111' },
    });

    // The read and the update share one select precisely so they cannot drift
    // apart, with the larger one winning by accident.
    expect(Object.keys(JSON.parse(write.body).data).sort())
      .toEqual(Object.keys(JSON.parse(read.body).data).sort());
  });
});

describe('saving Discovery settings', () => {
  it('answers without the tenant credentials', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/discovery/admin/settings', headers: auth(),
      payload: { shortDescription: 'A quiet place by the water.' },
    });

    expect(res.statusCode).toBe(200);
    expectNoSecrets('PATCH /api/discovery/admin/settings', res.body);
  });

  it('echoes the field it just saved', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/discovery/admin/settings', headers: auth(),
      payload: { priceFrom: 4500 },
    });

    expect(Number(JSON.parse(res.body).data.priceFrom)).toBe(4500);
  });
});

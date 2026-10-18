/**
 * A resort's gateway credentials, in the database.
 *
 * `schema.prisma` claimed for months that these were encrypted with AES-256 and
 * `payments.ts` carried a `// TODO: decrypt in production` next to the code
 * that read them straight out. So every resort's bKash app secret and
 * SSLCommerz store password sat in the table in plain text, and in every backup
 * of it.
 *
 * The test that matters is the first one: it reads the raw column and asserts
 * the secret is not in it. Everything else is about not breaking the resorts
 * whose credentials were written before this existed.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { keepEnv } from '../helpers/env';
import { isEncrypted } from '../../src/utils/secret-box';
import type { FastifyInstance } from 'fastify';

keepEnv('CREDENTIALS_KEY');

let app: FastifyInstance;
const run = `pay-creds-${Date.now()}`;
const password = 'TestPass123!';
const email = `owner-${run}@test.com`;
let token: string;
let tenantId: string;

const APP_SECRET = 'bkash_secret_ABCD1234';
const KEY = Buffer.alloc(32, 11).toString('base64');

const save = (credentials: Record<string, Record<string, string>>) => app.inject({
  method: 'PUT', url: '/api/payments/config',
  headers: { Authorization: `Bearer ${token}` },
  payload: { activeGateway: 'bkash', credentials },
});
const readConfig = () => app.inject({
  method: 'GET', url: '/api/payments/config',
  headers: { Authorization: `Bearer ${token}` },
});
const rawColumn = async () => (await prisma.tenantPaymentConfig.findUnique({
  where: { tenantId }, select: { credentials: true },
}))?.credentials as Record<string, unknown> | undefined;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { resortName: 'Creds', slug: run, firstName: 'Owner', lastName: 'Test', email, password },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  token = await verifyOwnerAndLogin(app, { tenantId, email, password, slug: run });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active' } });
}, 30000);

beforeEach(async () => {
  process.env.CREDENTIALS_KEY = KEY;
  await prisma.tenantPaymentConfig.deleteMany({ where: { tenantId } });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('what lands in the table', () => {
  it('does not contain the secret in any form', async () => {
    const res = await save({ bkash: { appKey: 'pubkey', appSecret: APP_SECRET } });
    expect(res.statusCode, res.body).toBe(200);

    const stored = await rawColumn();
    expect(JSON.stringify(stored)).not.toContain(APP_SECRET);
    expect(isEncrypted((stored as { enc: string }).enc)).toBe(true);
  });

  it('hides which gateways the resort configured, not only the values', async () => {
    await save({ bkash: { appSecret: APP_SECRET }, sslcommerz: { storePassword: 'p' } });
    const raw = JSON.stringify(await rawColumn());

    expect(raw).not.toContain('bkash');
    expect(raw).not.toContain('sslcommerz');
    expect(raw).not.toContain('storePassword');
  });
});

describe("the owner's own screen", () => {
  it('still shows the last four characters, so they know which key it is', async () => {
    await save({ bkash: { username: 'merchant01', appSecret: APP_SECRET } });

    const config = JSON.parse((await readConfig()).body).data;
    expect(config.credentials.bkash.appSecret).toBe('••••••••1234');
    // A username is not a secret, so it is shown. Note that `appKey` *is*
    // masked — the existing rule matches /secret|password|key/i, and "appKey"
    // contains "key". That is the screen's behaviour, not something encryption
    // changed.
    expect(config.credentials.bkash.username).toBe('merchant01');
  });

  it('keeps a value the owner did not retype', async () => {
    const first = await save({ bkash: { username: 'merchant01', appSecret: APP_SECRET } });
    expect(first.statusCode, first.body).toBe(200);
    // The screen sends back the mask for fields it did not touch.
    const second = await save({ bkash: { username: 'merchant02', appSecret: '••••••••1234' } });
    expect(second.statusCode, second.body).toBe(200);

    const config = JSON.parse((await readConfig()).body).data;
    expect(config.credentials.bkash.username).toBe('merchant02');
    expect(config.credentials.bkash.appSecret).toBe('••••••••1234');
  });
});

describe('resorts whose credentials were written before this', () => {
  it('reads their plain rows back unchanged', async () => {
    // Exactly the shape every row has in production today.
    await prisma.tenantPaymentConfig.create({
      data: {
        tenantId, activeGateway: 'bkash',
        credentials: { bkash: { appKey: 'legacykey', appSecret: 'legacy_secret_9999' } },
      },
    });

    const config = JSON.parse((await readConfig()).body).data;
    expect(config.credentials.bkash.appSecret).toBe('••••••••9999');
  });

  it('encrypts them on the next save, without losing the untouched fields', async () => {
    await prisma.tenantPaymentConfig.create({
      data: {
        tenantId, activeGateway: 'bkash',
        credentials: { bkash: { username: 'legacyuser', appSecret: 'legacy_secret_9999' } },
      },
    });

    const res = await save({ bkash: { username: 'newuser' } });
    expect(res.statusCode, res.body).toBe(200);

    const raw = JSON.stringify(await rawColumn());
    expect(raw).not.toContain('legacy_secret_9999');
    expect(raw).not.toContain('legacyuser');

    const config = JSON.parse((await readConfig()).body).data;
    expect(config.credentials.bkash.username).toBe('newuser');
    expect(config.credentials.bkash.appSecret).toBe('••••••••9999');
  });
});

describe('with no key configured', () => {
  it('refuses to save rather than storing it in the clear', async () => {
    delete process.env.CREDENTIALS_KEY;

    const res = await save({ bkash: { appSecret: APP_SECRET } });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(await rawColumn()).toBeUndefined();
  });
});

describe('the credentials on the tenant row', () => {
  /**
   * The same problem, in a different shape: a resort's SMS key and WhatsApp
   * token are plain columns on `Tenant`, written by the Settings screen and
   * read at the moment a message is sent.
   */
  const setSms = (body: Record<string, string>) => app.inject({
    method: 'PATCH', url: '/api/tenant/sms-credentials',
    headers: { Authorization: `Bearer ${token}` },
    payload: { smsMode: 'own', smsProvider: 'ssl_wireless', ...body },
  });
  const readSettings = () => app.inject({
    method: 'GET', url: '/api/tenant/sms-settings',
    headers: { Authorization: `Bearer ${token}` },
  });
  const rawTenant = () => prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId }, select: { smsApiKey: true, smsApiSecret: true },
  });

  it('does not leave the SMS key readable in the row', async () => {
    const res = await setSms({ smsApiKey: 'ssl_live_key_7788' });
    expect(res.statusCode, res.body).toBe(200);

    const row = await rawTenant();
    expect(row.smsApiKey).not.toContain('ssl_live_key_7788');
    expect(isEncrypted(row.smsApiKey)).toBe(true);
  });

  it('still shows the owner the last four characters of what they pasted', async () => {
    await setSms({ smsApiKey: 'ssl_live_key_7788' });

    const settings = JSON.parse((await readSettings()).body).data;
    // The tail of the real key, not the tail of a ciphertext.
    expect(settings.smsApiKey).toBe('••••••••7788');
  });

  it('sends with the real key, not the stored one', async () => {
    await setSms({ smsApiKey: 'ssl_live_key_7788' });
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { smsMode: true, smsProvider: true, smsApiKey: true, smsApiSecret: true, smsSenderId: true },
    });

    const calls: string[] = [];
    const fetchMock = async (_url: string, init: { body: string }) => {
      calls.push(init.body);
      return new Response(JSON.stringify({ status: 'SUCCESS', status_code: 200, smsinfo: [{ reference_id: 'r' }] }), { status: 200 });
    };
    vi.stubGlobal('fetch', fetchMock);
    const { sendSms } = await import('../../src/services/messaging');
    const result = await sendSms(tenant, '+8801712345678', 'hello');
    vi.unstubAllGlobals();

    expect(result).toMatchObject({ delivered: true, via: 'own' });
    // The provider must receive the key the owner typed.
    expect(calls[0]).toContain('ssl_live_key_7788');
    expect(calls[0]).not.toContain('enc:v1:');
  });

  it('reads back a key saved before any of this', async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { smsApiKey: 'legacy_plain_key_4321', smsMode: 'own', smsProvider: 'ssl_wireless' },
    });

    const settings = JSON.parse((await readSettings()).body).data;
    expect(settings.smsApiKey).toBe('••••••••4321');
  });
});

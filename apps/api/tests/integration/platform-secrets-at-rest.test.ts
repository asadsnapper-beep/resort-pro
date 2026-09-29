/**
 * The platform's own credentials are encrypted in the database.
 *
 * The AI API key bills us directly, and the object-storage pair can read and
 * delete every guest document we hold. Both were stored in plain text while
 * `schema.prisma` described the column as "Encrypted API key", and masking them
 * in GET responses — which the panel does — protects a browser, not a database
 * dump (release-readiness review M-05).
 *
 * The test that matters most is the last one in each group: the value handed to
 * the provider is the real key, not the envelope. Encrypting on the way in and
 * forgetting to decrypt on the way out is the failure that looks like success.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { getStorageConfig, invalidateStorageCache } from '../../src/services/storage';
import { keepEnv } from '../helpers/env';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `plat-sec-${Date.now()}`;
const adminEmail = `admin-${run}@test.com`;
let adminToken: string;

const AI_KEY = 'sk-ant-test-0123456789abcdef';
const STORAGE_SECRET = 's3-secret-0123456789abcdef';
const STORAGE_ACCESS = 's3-access-0123456789';

/** Whatever the singleton held before this file ran. */
let saved: { aiApiKey: string | null; aiProvider: string | null; storageConfig: unknown } | null = null;

keepEnv('CREDENTIALS_KEY');

beforeAll(async () => {
  // A key of this file's own, so the suite does not depend on one being set.
  process.env.CREDENTIALS_KEY = Buffer.from(`platform-secrets-test-key-${'x'.repeat(8)}`)
    .subarray(0, 32).toString('base64');

  app = await buildApp();
  await app.ready();

  const existing = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  if (existing) {
    saved = {
      aiApiKey: existing.aiApiKey,
      aiProvider: existing.aiProvider,
      storageConfig: existing.storageConfig,
    };
  }

  adminToken = app.jwt.sign({ sub: `admin-${run}`, email: adminEmail, adminRole: 'SUPER_ADMIN' });
}, 60000);

afterAll(async () => {
  // The singleton is shared with every other test in this suite, and what this
  // file leaves behind is encrypted with a key only this file has. Anything
  // reading it afterwards would fail to decrypt, which is a failure in a file
  // that never touched storage. So it is restored either way: to what was
  // there, or — when this file created the row — to empty.
  await prisma.platformSettings.updateMany({
    where: { id: 'singleton' },
    data: {
      aiApiKey: saved?.aiApiKey ?? null,
      aiProvider: saved?.aiProvider ?? null,
      storageConfig: (saved?.storageConfig ?? null) as never,
    },
  });
  invalidateStorageCache();
  await prisma.auditLog.deleteMany({ where: { adminEmail } });
  await app.close();
});

describe('the platform AI key', () => {
  beforeAll(async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings/ai',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { apiKey: AI_KEY, provider: 'claude' },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('is not in the row in a form anyone can read', async () => {
    const row = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' }, select: { aiApiKey: true },
    });
    expect(row?.aiApiKey).not.toBe(AI_KEY);
    expect(row?.aiApiKey).not.toContain('sk-ant');
    expect(row?.aiApiKey?.startsWith('enc:v1:')).toBe(true);
  });

  it('still reports itself as configured', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/settings/ai',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(JSON.parse(res.body).data).toMatchObject({ configured: true, provider: 'claude' });
  });

  it('comes back out as the real key, not the envelope', async () => {
    const { decryptOrNull } = await import('../../src/utils/secret-box');
    const row = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' }, select: { aiApiKey: true },
    });
    expect(decryptOrNull(row?.aiApiKey)).toBe(AI_KEY);
  });
});

describe('the object storage credentials', () => {
  beforeAll(async () => {
    invalidateStorageCache();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/storage',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        driver: 's3', bucket: `bucket-${run}`, endpoint: 'https://example.test',
        accessKey: STORAGE_ACCESS, secretKey: STORAGE_SECRET,
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    invalidateStorageCache();
  });

  it('keeps both credentials out of the row', async () => {
    const row = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' }, select: { storageConfig: true },
    });
    const cfg = row?.storageConfig as Record<string, string>;

    expect(cfg.secretKey).not.toBe(STORAGE_SECRET);
    expect(cfg.accessKey).not.toBe(STORAGE_ACCESS);
    expect(cfg.secretKey.startsWith('enc:v1:')).toBe(true);
    expect(cfg.accessKey.startsWith('enc:v1:')).toBe(true);
  });

  it('leaves the rest of the config readable', async () => {
    const row = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' }, select: { storageConfig: true },
    });
    const cfg = row?.storageConfig as Record<string, string>;
    expect(cfg.bucket).toBe(`bucket-${run}`);
    expect(cfg.endpoint).toBe('https://example.test');
  });

  it('hands the uploader the real credentials', async () => {
    invalidateStorageCache();
    const cfg = await getStorageConfig();
    expect(cfg.secretKey).toBe(STORAGE_SECRET);
    expect(cfg.accessKey).toBe(STORAGE_ACCESS);
  });

  it('still masks the secret for the screen, and re-saving keeps it', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/admin/storage',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(JSON.parse(res.body).data.secretKey).toBe('••••••••');

    // Saving the mask back must not overwrite the credential with the mask.
    const again = await app.inject({
      method: 'PATCH', url: '/api/admin/storage',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { bucket: `bucket-${run}-renamed`, secretKey: '••••••••' },
    });
    expect(again.statusCode, again.body).toBe(200);

    invalidateStorageCache();
    expect((await getStorageConfig()).secretKey).toBe(STORAGE_SECRET);
  });
});

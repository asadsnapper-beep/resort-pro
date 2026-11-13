import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('@resort-pro/database', () => ({
  prisma: { platformSettings: { findUnique: async () => null } },
}));
vi.mock('../../src/middleware/auth', () => ({
  requireRole: (...roles: string[]) => async (request: any, reply: any) => {
    if (!roles.includes(request.headers['x-test-role'])) return reply.status(403).send({ success: false });
  },
}));

import { guestDocumentRoutes } from '../../src/routes/guestDocuments';
import { invalidateStorageCache } from '../../src/services/storage';
import { verifyUploadSignature } from '../../src/utils/signed-upload-url';

let tempDir: string;
let priorDir: string | undefined;
let priorDriver: string | undefined;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const boundary = 'private-image-test';

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'resortpro-images-'));
  priorDir = process.env.STORAGE_LOCAL_DIR;
  priorDriver = process.env.STORAGE_DRIVER;
  process.env.STORAGE_LOCAL_DIR = tempDir;
  process.env.STORAGE_DRIVER = 'local';
  invalidateStorageCache();
});
afterEach(() => {
  if (priorDir === undefined) delete process.env.STORAGE_LOCAL_DIR; else process.env.STORAGE_LOCAL_DIR = priorDir;
  if (priorDriver === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = priorDriver;
  invalidateStorageCache();
  rmSync(tempDir, { recursive: true, force: true });
});

function payload(bookingId: string, type: string) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="docType"\r\n\r\n${type}\r\n--${boundary}\r\nContent-Disposition: form-data; name="bookingId"\r\n\r\n${bookingId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe('guest images with isolated local storage', () => {
  it('writes sample images, associates the correct guest and booking, and verifies the signed URL', async () => {
    const rows: any[] = [];
    const raceId = 'd4372b31-0e15-4ef1-8bc2-c62491ee0239';
    let raceReads = 0;
    let releaseRace!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseRace = resolve; });
    const app = Fastify();
    await app.register(multipart);
    app.addHook('onRequest', async (request) => {
      (request as any).user = { tenantId: 'tenant-1', sub: 'reception-1' };
      (request as any).db = {
        guest: { findFirst: async ({ where }: any) => where.id === 'guest-1' ? { id: 'guest-1' } : null },
        booking: { findFirst: async ({ where }: any) => where.id === 'booking-1' && where.guestId === 'guest-1' ? { id: 'booking-1' } : null },
        guestDocument: {
          create: async ({ data }: any) => {
            if (data.id && rows.some((row) => row.id === data.id)) throw Object.assign(new Error('duplicate id'), { code: 'P2002' });
            const row = { ...data, id: data.id ?? `doc-${rows.length}`, uploadedAt: new Date() };
            rows.push(row);
            return row;
          },
          findFirst: async ({ where }: any) => {
            const found = rows.find((row) => row.id === where.id) ?? null;
            if (where.id === raceId && raceReads < 2) {
              if (++raceReads === 2) releaseRace();
              await bothRead;
            }
            return found;
          },
          findMany: async () => rows,
        },
      };
    });
    await app.register(guestDocumentRoutes);
    const capabilities = await app.inject({ method: 'GET', url: '/document-upload-capabilities', headers: { 'x-test-role': 'RECEPTIONIST' } });
    expect(capabilities.json().data.idempotencyVersion).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/document-upload-capabilities', headers: { 'x-test-role': 'STAFF' } })).statusCode).toBe(403);
    const send = (type: string, booking = 'booking-1', role = 'RECEPTIONIST', uploadId?: string) => app.inject({ method: 'POST', url: '/guest-1/documents', headers: { 'x-test-role': role, 'content-type': `multipart/form-data; boundary=${boundary}`, ...(uploadId ? { 'idempotency-key': uploadId } : {}) }, payload: payload(booking, type) });

    for (const type of ['GUEST_PHOTO', 'NATIONAL_ID']) {
      const response = await send(type);
      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({ docType: type, bookingId: 'booking-1' });
      const url = new URL(response.json().data.imageUrl);
      const key = decodeURIComponent(url.pathname.split('/uploads/')[1]!);
      expect(verifyUploadSignature(key, url.searchParams.get('exp') ?? undefined, url.searchParams.get('sig') ?? undefined)).toBe(true);
      expect(verifyUploadSignature(key, undefined, undefined)).toBe(false);
      expect(await import('node:fs/promises').then((fs) => fs.readFile(join(tempDir, key)))).toEqual(png);
    }
    expect((await send('NATIONAL_ID', 'other-booking')).statusCode).toBe(404);
    expect((await send('NATIONAL_ID', 'booking-1', 'STAFF')).statusCode).toBe(403);
    expect(rows).toHaveLength(2);
    const uploadId = 'a7468b0a-8a43-4c8b-92dc-5be8336de4f9';
    const first = await send('GUEST_PHOTO', 'booking-1', 'RECEPTIONIST', uploadId);
    const retry = await send('GUEST_PHOTO', 'booking-1', 'RECEPTIONIST', uploadId);
    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data.id).toBe(first.json().data.id);
    expect((await send('NATIONAL_ID', 'booking-1', 'RECEPTIONIST', uploadId)).statusCode).toBe(409);
    expect(rows).toHaveLength(3);
    expect((await send('GUEST_PHOTO', 'booking-1', 'RECEPTIONIST', 'invalid')).statusCode).toBe(400);
    const concurrent = await Promise.all([
      send('GUEST_PHOTO', 'booking-1', 'RECEPTIONIST', raceId),
      send('GUEST_PHOTO', 'booking-1', 'RECEPTIONIST', raceId),
    ]);
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 201]);
    expect(rows.filter((row) => row.id === raceId)).toHaveLength(1);
    expect(readdirSync(join(tempDir, 'tenant-1', 'guest-docs'))).toHaveLength(4);
    const list = await app.inject({ method: 'GET', url: '/guest-1/documents', headers: { 'x-test-role': 'OWNER' } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((row: any) => row.docType)).toEqual(['GUEST_PHOTO', 'NATIONAL_ID', 'GUEST_PHOTO', 'GUEST_PHOTO']);
    await app.close();
  });
});

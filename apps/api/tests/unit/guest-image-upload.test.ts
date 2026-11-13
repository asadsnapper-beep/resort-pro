import { describe, expect, it, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';

const mocks = vi.hoisted(() => ({
  driver: 'local',
  upload: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../../src/middleware/auth', () => ({
  requireRole: (...roles: string[]) => async (request: any, reply: any) => {
    if (!roles.includes(request.headers['x-test-role'])) return reply.status(403).send({ success: false });
  },
}));
vi.mock('../../src/services/storage', () => ({
  getStorageConfig: async () => ({ driver: mocks.driver }),
  uploadToStorage: mocks.upload,
  deleteFromStorage: vi.fn(),
}));

import { guestDocumentRoutes } from '../../src/routes/guestDocuments';

const boundary = 'image-test-boundary';
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function form(type: string) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="docType"\r\n\r\n${type}\r\n--${boundary}\r\nContent-Disposition: form-data; name="bookingId"\r\n\r\nbooking-1\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

beforeEach(() => {
  mocks.driver = 'local';
  mocks.upload.mockReset().mockResolvedValue({ url: 'http://localhost/uploads/tenant/guest-docs/test.png' });
  mocks.create.mockReset().mockImplementation(async ({ data }) => ({ ...data, id: 'doc-1', uploadedAt: new Date() }));
});

async function appForTest() {
  const app = Fastify();
  await app.register(multipart);
  app.addHook('onRequest', async (request) => {
    (request as any).user = { tenantId: 'tenant', sub: 'user' };
    (request as any).db = {
      guest: { findFirst: async () => ({ id: 'guest-1' }) },
      booking: { findFirst: async () => ({ id: 'booking-1' }) },
      guestDocument: { create: mocks.create },
    };
  });
  await app.register(guestDocumentRoutes);
  return app;
}

describe('guest image uploads', () => {
  it.each(['GUEST_PHOTO', 'NATIONAL_ID'])('links %s to the guest and booking', async (type) => {
    const app = await appForTest();
    const response = await app.inject({ method: 'POST', url: '/guest-1/documents', headers: { 'x-test-role': 'RECEPTIONIST', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: form(type) });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ docType: type, bookingId: 'booking-1' });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ guestId: 'guest-1', bookingId: 'booking-1', docType: type }) }));
    await app.close();
  });

  it('blocks roles outside front desk and management', async () => {
    const app = await appForTest();
    const response = await app.inject({ method: 'POST', url: '/guest-1/documents', headers: { 'x-test-role': 'STAFF', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: form('GUEST_PHOTO') });
    expect(response.statusCode).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
    await app.close();
  });

  it('fails closed when storage cannot provide private image delivery', async () => {
    mocks.driver = 's3';
    const app = await appForTest();
    const response = await app.inject({ method: 'POST', url: '/guest-1/documents', headers: { 'x-test-role': 'OWNER', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: form('GUEST_PHOTO') });
    expect(response.statusCode).toBe(503);
    expect(mocks.upload).not.toHaveBeenCalled();
    await app.close();
  });
});

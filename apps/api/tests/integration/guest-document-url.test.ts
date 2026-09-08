/**
 * A stored document URL has to be reachable from outside the container.
 *
 * The URL is written into the row at upload time, not derived on read, so a
 * wrong base is permanent: no later configuration change repairs a document
 * already saved as http://localhost:4000/... The general upload route has
 * always passed the request's own origin; this one did not, and every guest
 * document taken on an environment without APP_URL was saved unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `guest-doc-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let guestId: string;

/** A one-pixel PNG — the smallest thing the endpoint will accept as an image. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function multipart(fields: Record<string, string>, file: Buffer) {
  const boundary = `----rp${randomUUID()}`;
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="id.png"\r\n` +
    'Content-Type: image/png\r\n\r\n',
  ));
  parts.push(file, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Guest Doc Test', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });
  guestId = (await prisma.guest.create({
    data: { tenantId, firstName: 'Doc', lastName: 'Owner', email: `guest-${slug}@test.com` },
  })).id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('POST /api/guests/:id/documents', () => {
  it('stores a URL on the host the request arrived at, not localhost', async () => {
    const previous = process.env.APP_URL;
    delete process.env.APP_URL;
    try {
      const { boundary, body } = multipart({ docType: 'PASSPORT' }, PNG);
      const res = await app.inject({
        method: 'POST', url: `/api/guests/${guestId}/documents`,
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
          host: 'api.example-resort.test',
        },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const stored = await prisma.guestDocument.findFirstOrThrow({ where: { guestId } });
      expect(stored.imageUrl).toContain('api.example-resort.test');
      // The row outlives any later configuration change, so localhost here is
      // not a display problem — it is a document nobody can ever open.
      expect(stored.imageUrl).not.toContain('localhost');
    } finally {
      if (previous !== undefined) process.env.APP_URL = previous;
    }
  });
});

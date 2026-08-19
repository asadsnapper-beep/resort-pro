/**
 * Guest ID and passport scans must not be readable by URL alone.
 *
 * They were served from the same unauthenticated /uploads/ static route as
 * room photos, so anyone holding the link could read one — from any tenant,
 * indefinitely. Unguessable filenames are not access control: URLs leak through
 * history, Referer headers, screenshots and logs.
 *
 * Locking the whole prefix is not the fix. Room, menu, website and vehicle
 * images are rendered by public resort sites to visitors with no account. Only
 * guest-docs is private, and it is released against a short-lived signature.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../../src/app';
import { signUploadUrl, verifyUploadSignature, isPrivateUploadKey } from '../../src/utils/signed-upload-url';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const uploadsDir = process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), 'uploads');
const tenant = `sig-test-${Date.now()}`;
const PRIVATE_KEY = `${tenant}/guest-docs/passport.png`;
const PUBLIC_KEY  = `${tenant}/rooms/suite.png`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const get = (path: string) => app.inject({ method: 'GET', url: path });

beforeAll(async () => {
  for (const key of [PRIVATE_KEY, PUBLIC_KEY]) {
    const full = join(uploadsDir, key);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, PNG);
  }
  app = await buildApp();
  await app.ready();
}, 25000);

afterAll(async () => {
  rmSync(join(uploadsDir, tenant), { recursive: true, force: true });
  await app.close();
});

describe('Private uploads', () => {
  it('a guest document is not readable without a signature', async () => {
    const res = await get(`/uploads/${PRIVATE_KEY}`);
    expect(res.statusCode).toBe(404);
  });

  it('404 rather than 403 — a refusal must not confirm the document exists', async () => {
    const real = await get(`/uploads/${PRIVATE_KEY}`);
    const fake = await get(`/uploads/${tenant}/guest-docs/does-not-exist.png`);
    expect(real.statusCode).toBe(fake.statusCode);
  });

  it('a valid signature releases it', async () => {
    const signed = signUploadUrl(`http://localhost:4000/uploads/${PRIVATE_KEY}`);
    const res = await get(signed.slice(signed.indexOf('/uploads/')));
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(PNG)).toBe(true);
  });

  it('a tampered signature does not', async () => {
    const signed = signUploadUrl(`http://localhost:4000/uploads/${PRIVATE_KEY}`);
    const path = signed.slice(signed.indexOf('/uploads/')).replace(/sig=([0-9a-f])/, (_m, c) => `sig=${c === '0' ? '1' : '0'}`);
    expect((await get(path)).statusCode).toBe(404);
  });

  it('a signature for one document does not open another', async () => {
    const other = `${tenant}/guest-docs/other.png`;
    writeFileSync(join(uploadsDir, other), PNG);
    const signed = signUploadUrl(`http://localhost:4000/uploads/${PRIVATE_KEY}`);
    const query = signed.slice(signed.indexOf('?'));
    expect((await get(`/uploads/${other}${query}`)).statusCode).toBe(404);
  });

  it('an expired signature does not', async () => {
    const signed = signUploadUrl(`http://localhost:4000/uploads/${PRIVATE_KEY}`, -60);
    expect((await get(signed.slice(signed.indexOf('/uploads/')))).statusCode).toBe(404);
  });

  it('public site images are untouched — no signature needed', async () => {
    const res = await get(`/uploads/${PUBLIC_KEY}`);
    expect(res.statusCode).toBe(200);
    expect(signUploadUrl(`http://localhost:4000/uploads/${PUBLIC_KEY}`))
      .toBe(`http://localhost:4000/uploads/${PUBLIC_KEY}`);
  });

  it('classifies keys by folder, not by guessing', () => {
    expect(isPrivateUploadKey('t/guest-docs/a.png')).toBe(true);
    expect(isPrivateUploadKey('t/rooms/a.png')).toBe(false);
    expect(isPrivateUploadKey('t/guest-docs-public/a.png')).toBe(false); // segment match, not prefix
  });

  it('rejects missing halves of the pair', () => {
    expect(verifyUploadSignature(PRIVATE_KEY, undefined, 'abc')).toBe(false);
    expect(verifyUploadSignature(PRIVATE_KEY, '99999999999', undefined)).toBe(false);
    expect(verifyUploadSignature(PRIVATE_KEY, 'not-a-number', 'abc')).toBe(false);
  });
});

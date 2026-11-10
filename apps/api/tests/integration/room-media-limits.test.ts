/**
 * What the room endpoints accept into `images`, `videos` and `amenities`.
 *
 * The modal stops at eight photos and four videos, refuses a video that is not
 * a URL, and counts them on screen. None of that was true of the API: `images`
 * was `z.array(z.string())` with no cap and no validation at all, and
 * `amenities` the same. A caller with a token — a script, a stale build, a
 * curl — could store four hundred photos on one room, or a `javascript:` URL
 * the dashboard would then render into an `<img src>`, or a megabyte of
 * base64 in a column meant to hold a link.
 * (Room Management QA 2026-10-28, RM-012.)
 *
 * `videos` already had `.url()`, which is the shape of the fix the rest needed:
 * the rule belongs where the request is parsed, not where the form is drawn.
 *
 * The limits are the ones the modal already shows, because two numbers that
 * disagree is the bug reported here in a different costume.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `room-media-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
let roomId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });
const body = (res: { body: string }) => JSON.parse(res.body);

const photo = (n: number) => `https://cdn.example.com/rooms/photo-${n}.jpg`;
const clip  = (n: number) => `https://youtube.com/watch?v=clip${n}`;

let nextNumber = 400;
const create = (extra: Record<string, unknown>) =>
  app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: {
      number: String(nextNumber++), name: 'Media Room', type: 'STANDARD',
      maxOccupancy: 2, basePrice: 2500, ...extra,
    },
  });

const update = (extra: Record<string, unknown>) =>
  app.inject({ method: 'PATCH', url: `/api/rooms/${roomId}`, headers: auth(), payload: extra });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Room Media', slug: run,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${run}@test.com`, password,
    },
  });
  if (reg.statusCode !== 201) throw new Error(`register failed: ${reg.body}`);
  tenantId = body(reg).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${run}@test.com`, password, slug: run });

  // ENTERPRISE so the room ceiling can never be what refuses a request here.
  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'ENTERPRISE', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'ENTERPRISE');

  const base = await create({});
  if (base.statusCode !== 201) throw new Error(`fixture room failed: ${base.body}`);
  roomId = body(base).data.id;
}, 40000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: run } } });
  await app.close();
});

describe('how many photos and videos a room may have', () => {
  it('takes the eight the form offers', async () => {
    const res = await create({ images: Array.from({ length: 8 }, (_, i) => photo(i)) });

    expect(res.statusCode, res.body).toBe(201);
    expect(body(res).data.images).toHaveLength(8);
  });

  it('refuses the ninth', async () => {
    const res = await create({ images: Array.from({ length: 9 }, (_, i) => photo(i)) });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('images');
  });

  it('refuses four hundred', async () => {
    // Not a hypothetical: nothing stopped a script from doing this, and the
    // row is read back in full by every room list on the dashboard.
    const res = await create({ images: Array.from({ length: 400 }, (_, i) => photo(i)) });

    expect(res.statusCode).toBe(400);
  });

  it('takes four videos and refuses a fifth', async () => {
    const four = await create({ videos: Array.from({ length: 4 }, (_, i) => clip(i)) });
    expect(four.statusCode, four.body).toBe(201);

    const five = await create({ videos: Array.from({ length: 5 }, (_, i) => clip(i)) });
    expect(five.statusCode).toBe(400);
    expect(five.body).toContain('videos');
  });

  it('counts an edit the same as a create', async () => {
    // The cap is about what is stored, not about which verb stored it.
    const res = await update({ images: Array.from({ length: 9 }, (_, i) => photo(i)) });

    expect(res.statusCode).toBe(400);
  });
});

describe('what may be in an image string', () => {
  it('refuses a javascript: URL', async () => {
    // The dashboard puts these straight into an `<img src>`. An img does not
    // execute a javascript: URL in a current browser, but nothing about the
    // column said it had to be a picture, and the same strings are rendered
    // as links and backgrounds elsewhere.
    const res = await create({ images: ['javascript:alert(document.cookie)'] });

    expect(res.statusCode).toBe(400);
  });

  it('refuses the schemes `videos` was already letting through', async () => {
    /*
      The field the report treated as the correct one. `videos` had
      `.url()` on it, which reads like validation and is not: Zod's `.url()`
      is `new URL()`, and that parses `javascript:`, `data:` and `file:`
      without complaint. The one field with a check had the same hole as the
      field with none — it was just harder to see.
    */
    for (const scheme of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'file:///etc/passwd',
    ]) {
      const res = await create({ videos: [scheme] });
      expect(res.statusCode, `${scheme} was accepted`).toBe(400);
    }
  });

  it('refuses something that is not a URL at all', async () => {
    const res = await create({ images: ['../../etc/passwd'] });

    expect(res.statusCode).toBe(400);
  });

  it('refuses a data: URL with a megabyte of base64 in it', async () => {
    // A text column is not a file store. This is the payload-size half of the
    // finding, and it is the one a caller reaches by accident rather than
    // maliciously — a client that inlines an image instead of uploading it.
    const res = await create({
      images: [`data:image/png;base64,${'A'.repeat(1_000_000)}`],
    });

    expect(res.statusCode).toBe(400);
  });

  it('refuses an http(s) URL that is absurdly long', async () => {
    const res = await create({
      images: [`https://cdn.example.com/${'a'.repeat(4000)}.jpg`],
    });

    expect(res.statusCode).toBe(400);
  });

  it('still takes the URLs the uploader actually produces', async () => {
    // The upload route returns an absolute http(s) URL — either the API's own
    // origin plus /uploads/..., or the object store's base. Both must keep
    // working, and so must a pasted https:// link, which is what the modal's
    // "Use URL" button is for.
    const res = await create({
      images: [
        'http://localhost:4000/uploads/rooms/abc-123.jpg',
        'https://images.unsplash.com/photo-1631049307264-da0ec9d70304',
      ],
    });

    expect(res.statusCode, res.body).toBe(201);
    expect(body(res).data.images).toHaveLength(2);
  });
});

describe('amenities', () => {
  it('refuses a list nobody could have typed', async () => {
    const res = await create({
      amenities: Array.from({ length: 500 }, (_, i) => `Amenity ${i}`),
    });

    expect(res.statusCode).toBe(400);
  });

  it('refuses a single amenity the size of a document', async () => {
    const res = await create({ amenities: ['A'.repeat(50_000)] });

    expect(res.statusCode).toBe(400);
  });

  it('takes an ordinary list', async () => {
    const res = await create({ amenities: ['WiFi', 'AC', 'Ocean View'] });

    expect(res.statusCode, res.body).toBe(201);
    expect(body(res).data.amenities).toEqual(['WiFi', 'AC', 'Ocean View']);
  });
});

describe('the refusal says what is wrong', () => {
  it('names the field rather than failing blankly', async () => {
    // "Validation failed" sends somebody to read the source. The report asks
    // for field-level errors and this is the whole of that request: the
    // caller is told which array, and why.
    const res = await create({ images: Array.from({ length: 20 }, (_, i) => photo(i)) });

    expect(res.statusCode).toBe(400);
    const payload = body(res);
    expect(JSON.stringify(payload)).toContain('images');
    expect(JSON.stringify(payload).toLowerCase()).toMatch(/8|eight/);
  });

  it('does not answer 500 for any of it', async () => {
    // A refusal that leaks as a 500 tells the caller the server broke, and
    // clients retry those — the same reasoning as RM-007.
    for (const payload of [
      { images: Array.from({ length: 400 }, (_, i) => photo(i)) },
      { images: ['javascript:alert(1)'] },
      { amenities: ['A'.repeat(50_000)] },
      { videos: Array.from({ length: 50 }, (_, i) => clip(i)) },
    ]) {
      const res = await create(payload);
      expect(res.statusCode, `${JSON.stringify(payload).slice(0, 60)} → ${res.body}`)
        .toBeLessThan(500);
    }
  });
});

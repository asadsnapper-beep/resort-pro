/**
 * What the website API will and will not take.
 *
 * `PUT /api/website` accepted an unknown `templateId` on purpose, so a tenant
 * could end up with a key no renderer knows: the public page silently fell
 * back to the default theme while the dashboard went on claiming the chosen
 * one was selected (Website Builder QA 2026-10-28, WB-005). It also took any
 * strings at all as `sectionOrder` and `hiddenSections`, and a repeated known
 * id rendered its section twice under one React key (WB-006).
 *
 * The exception that has to survive is the reason the old behaviour existed:
 * a tenant already sitting on a stale key must still be able to save their
 * hero text. Refusing only a *change* to an unknown key closes the door
 * without locking anyone in behind it.
 *
 * No test here publishes anything or touches the demo tenant; each run builds
 * and removes its own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `websec-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
const auth = { Authorization: '' };

const put = (payload: unknown) =>
  app.inject({ method: 'PUT', url: '/api/website', headers: auth, payload: payload as never });

const stored = () =>
  prisma.websiteContent.findUnique({ where: { tenantId } });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Section Validation Resort', slug: run, firstName: 'Mira', lastName: 'H',
      email: ownerEmail, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'STARTER', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'STARTER');

  const token = await verifyOwnerAndLogin(app, { tenantId, email: ownerEmail, password, slug: run });
  auth.Authorization = `Bearer ${token}`;
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('choosing a template', () => {
  it('takes one that exists', async () => {
    const res = await put({ heroTitle: 'By the water', templateId: 'luxe' });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.templateId).toBe('luxe');
  });

  it('refuses one that does not, and says which', async () => {
    const res = await put({ heroTitle: 'By the water', templateId: 'not-a-real-theme' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNKNOWN_TEMPLATE');
    expect(body.error).toContain('not-a-real-theme');
  });

  it('leaves the stored template alone when it refuses', async () => {
    expect((await stored())?.templateId).toBe('luxe');
  });

  it('still lets a tenant already on a stale key save everything else', async () => {
    // The case the old permissive behaviour existed to protect. Put the tenant
    // on a stale key the way history would have, then save with that same key
    // present in the payload — as the dashboard's form sends it.
    await prisma.websiteContent.update({
      where: { tenantId }, data: { templateId: 'retired-theme-from-2024' },
    });
    const res = await put({ heroTitle: 'Still editable', templateId: 'retired-theme-from-2024' });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.heroTitle).toBe('Still editable');

    await put({ heroTitle: 'Back to normal', templateId: 'luxe' });
  });
});

describe('the order and visibility of sections', () => {
  it('keeps the order the owner chose', async () => {
    const res = await put({ sectionOrder: ['contact', 'about', 'rooms'] });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.sectionOrder).toEqual(['contact', 'about', 'rooms']);
  });

  it('drops an id no theme has ever heard of', async () => {
    const res = await put({ sectionOrder: ['about', 'wedding-chapel', 'rooms'] });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.sectionOrder).toEqual(['about', 'rooms']);
  });

  it('keeps a repeated id once, rather than rendering it twice', async () => {
    const res = await put({ sectionOrder: ['about', 'rooms', 'about'] });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.sectionOrder).toEqual(['about', 'rooms']);
  });

  it('cleans hiddenSections the same way', async () => {
    const res = await put({ hiddenSections: ['gallery', 'gallery', 'not-a-section'] });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.hiddenSections).toEqual(['gallery']);
  });

  it('accepts an empty list — hiding nothing is a real choice', async () => {
    const res = await put({ hiddenSections: [] });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.hiddenSections).toEqual([]);
  });

  it('leaves a field alone when the save does not mention it', async () => {
    await put({ sectionOrder: ['about', 'rooms'] });
    await put({ heroTitle: 'Only the title changed' });
    const after = await stored();
    expect(after?.sectionOrder).toEqual(['about', 'rooms']);
    expect(after?.heroTitle).toBe('Only the title changed');
  });
});

describe('the rules the form claimed to enforce, now enforced where it counts', () => {
  it('refuses a hero title that is nothing at all, and says why', () => {
    return put({ heroTitle: '   ' }).then((res) => {
      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('Hero Title cannot be empty');
    });
  });

  it('takes a real one', async () => {
    const res = await put({ heroTitle: 'Where the hills meet the tea' });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.heroTitle).toBe('Where the hills meet the tea');
  });

  it('refuses a testimonial with no name', async () => {
    const res = await put({ testimonials: [{ name: '', text: 'Lovely stay', rating: 5 }] });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("guest's name");
  });

  it('refuses a testimonial that says nothing', async () => {
    const res = await put({ testimonials: [{ name: 'Rina', text: '   ', rating: 5 }] });
    expect(res.statusCode).toBe(400);
  });

  it('takes a complete one', async () => {
    const res = await put({ testimonials: [{ name: 'Rina', text: 'The garden at dawn.', rating: 5 }] });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('bounds the gallery server-side, not only in the form', async () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) => `/uploads/photo-${i}.jpg`);
    const res = await put({ galleryImages: twentyOne });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('up to 20 photos');
  });

  it('takes a gallery at the limit', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `/uploads/photo-${i}.jpg`);
    const res = await put({ galleryImages: twenty });
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('the WhatsApp number, which becomes a link a guest taps', () => {
  it.each([
    ['digits with a plus', '+8801712345678', '+8801712345678'],
    ['spaces and dashes people actually type', '+880 1712-345678', '+8801712345678'],
    ['the 00 prefix', '008801712345678', '+8801712345678'],
    ['no plus at all', '8801712345678', '8801712345678'],
  ])('normalises %s', async (_label, typed, expected) => {
    const res = await put({ whatsappNumber: typed });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.whatsappNumber).toBe(expected);
  });

  it.each([
    ['words', 'call the front desk'],
    ['far too short', '12'],
    ['a leading zero after the plus', '+0123456789'],
  ])('refuses %s, because wa.me would 404 on it', async (_label, typed) => {
    const res = await put({ whatsappNumber: typed });
    expect(res.statusCode).toBe(400);
  });

  it('allows it to be cleared', async () => {
    const res = await put({ whatsappNumber: '' });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stored())?.whatsappNumber).toBe('');
  });
});

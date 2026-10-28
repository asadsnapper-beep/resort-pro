/**
 * Who can read a theme that has not been released.
 *
 * `GET /site/theme/:key` had no filter on `themeStatus` or `isActive`, so the
 * full `configJson` of an unreleased design — or a Tier 2 theme's whole HTML
 * and CSS — came back to anyone who knew the key, with no login. Confirmed
 * against a row left exactly as the admin upload path leaves one: `PREVIEW`,
 * `isActive: false`, 200, config and all.
 *
 * Refusing every unpublished theme would have been one line and would have
 * broken the admin's own Preview link, which is how they find out whether an
 * upload rendered at all. So the link is signed instead, and these tests are
 * as much about that link still working as about the leak being closed.
 *
 * Nothing here publishes or touches the demo tenant; each run builds and
 * removes its own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import { themePreviewPath } from '../../src/utils/signed-theme-preview';
import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `themeacc-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
const auth = { Authorization: '' };

const PUBLISHED = `${run}-published`;
const UNRELEASED = `${run}-unreleased`;
const SECRET_NOTE = 'an unpublished design';

const get = (url: string) => app.inject({ method: 'GET', url });

/** The signed path the API hands an admin, as a query string. */
const signatureFor = (key: string, status = 'PREVIEW') =>
  themePreviewPath({ key, themeStatus: status }).split('?')[1] ?? '';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Theme Access Resort', slug: run, firstName: 'Nadia', lastName: 'K',
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

  await prisma.theme.createMany({
    data: [
      {
        key: PUBLISHED, name: 'Released Theme', themeType: 'UPLOADED',
        themeStatus: 'PUBLISHED', isActive: true,
        // Free, so these tests are about status and not about the paywall.
        priceUsd: 0, priceBdt: 0,
        configJson: { key: PUBLISHED, name: 'Released Theme' },
      },
      {
        // Exactly what an admin upload leaves behind.
        key: UNRELEASED, name: 'Unreleased Upload', themeType: 'UPLOADED',
        themeStatus: 'PREVIEW', isActive: false,
        priceUsd: 0, priceBdt: 0,
        configJson: { key: UNRELEASED, name: 'Unreleased Upload', secretNote: SECRET_NOTE },
      },
    ],
  });
}, 60000);

afterAll(async () => {
  await prisma.theme.deleteMany({ where: { key: { in: [PUBLISHED, UNRELEASED] } } });
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('a released theme', () => {
  it('is public, because every visitor of every site using it already sees it', async () => {
    const res = await get(`/site/theme/${PUBLISHED}`);
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.key).toBe(PUBLISHED);
  });

  it('is handed out with no signature at all', () => {
    expect(themePreviewPath({ key: PUBLISHED, themeStatus: 'PUBLISHED' }))
      .toBe(`/theme-preview/${PUBLISHED}`);
  });
});

describe('an unreleased theme', () => {
  it('is not readable by someone who merely knows the key', async () => {
    const res = await get(`/site/theme/${UNRELEASED}`);
    expect(res.statusCode).toBe(404);
  });

  it('gives away nothing in the refusal — not even that it exists', async () => {
    const real = await get(`/site/theme/${UNRELEASED}`);
    const absent = await get(`/site/theme/${run}-no-such-theme`);
    expect(real.statusCode).toBe(absent.statusCode);
    expect(real.body).toBe(absent.body);
  });

  it('does not leak its config in the body either', async () => {
    const res = await get(`/site/theme/${UNRELEASED}`);
    expect(res.body).not.toContain(SECRET_NOTE);
  });

  it('is readable with the signature the API minted for it', async () => {
    const res = await get(`/site/theme/${UNRELEASED}?${signatureFor(UNRELEASED)}`);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).toContain(SECRET_NOTE);
  });
});

describe('the signature itself', () => {
  it('is refused when it was minted for another theme', async () => {
    const res = await get(`/site/theme/${UNRELEASED}?${signatureFor(PUBLISHED, 'PREVIEW')}`);
    expect(res.statusCode).toBe(404);
  });

  it('is refused when it has expired', async () => {
    const expired = themePreviewPath({ key: UNRELEASED, themeStatus: 'PREVIEW' }, -60).split('?')[1];
    const res = await get(`/site/theme/${UNRELEASED}?${expired}`);
    expect(res.statusCode).toBe(404);
  });

  it('is refused when a character of it is changed', async () => {
    const q = new URLSearchParams(signatureFor(UNRELEASED));
    const sig = q.get('sig')!;
    q.set('sig', (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1));
    const res = await get(`/site/theme/${UNRELEASED}?${q.toString()}`);
    expect(res.statusCode).toBe(404);
  });

  it('is refused when the expiry is moved without re-signing', async () => {
    const q = new URLSearchParams(signatureFor(UNRELEASED));
    q.set('exp', String(Number(q.get('exp')) + 86_400));
    const res = await get(`/site/theme/${UNRELEASED}?${q.toString()}`);
    expect(res.statusCode).toBe(404);
  });

  it('is refused when only half of it is supplied', async () => {
    const q = new URLSearchParams(signatureFor(UNRELEASED));
    expect((await get(`/site/theme/${UNRELEASED}?exp=${q.get('exp')}`)).statusCode).toBe(404);
    expect((await get(`/site/theme/${UNRELEASED}?sig=${q.get('sig')}`)).statusCode).toBe(404);
  });
});

describe('a signature minted for something else', () => {
  it('does not work here, even with the same secret and the same key', async () => {
    // The upload-URL signer uses the same HMAC and the same JWT_SECRET over
    // `key:exp`. Without a prefix of its own, a signature handed out for an
    // upload whose storage key happened to match a theme key would open that
    // theme. This is what the `theme-preview:` prefix is for, and the only
    // test that can tell whether it is still there.
    const exp = Math.floor(Date.now() / 1000) + 600;
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const undomained = createHmac('sha256', secret).update(`${UNRELEASED}:${exp}`).digest('hex');

    const res = await get(`/site/theme/${UNRELEASED}?exp=${exp}&sig=${undomained}`);
    expect(res.statusCode).toBe(404);
  });
});

describe('the themes an owner is offered', () => {
  it('does not include one that has not been released', async () => {
    const res = await get(`/site/${run}/themes`);
    expect(res.statusCode, res.body).toBe(200);
    const keys = JSON.parse(res.body).data.map((t: { key: string }) => t.key);
    expect(keys).toContain(PUBLISHED);
    expect(keys).not.toContain(UNRELEASED);
  });

  it('leaves out an unreleased one even when the active flag disagrees', async () => {
    // The listing filters on `isActive`, and the admin paths keep that in
    // lockstep with PUBLISHED — so the status filter beside it looks
    // redundant, and a test on an ordinary row cannot tell whether it is
    // there. This is the row it exists for: the two columns out of step, which
    // is the state they drift into if anything ever sets one without the
    // other.
    const drifted = `${run}-drifted`;
    await prisma.theme.create({
      data: {
        key: drifted, name: 'Drifted Row', themeType: 'UPLOADED',
        themeStatus: 'DRAFT', isActive: true, priceUsd: 0, priceBdt: 0,
        configJson: { key: drifted, name: 'Drifted Row' },
      },
    });
    try {
      const res = await get(`/site/${run}/themes`);
      const keys = JSON.parse(res.body).data.map((t: { key: string }) => t.key);
      expect(keys).not.toContain(drifted);
    } finally {
      await prisma.theme.deleteMany({ where: { key: drifted } });
    }
  });
});

describe('choosing a theme', () => {
  const put = (payload: unknown) =>
    app.inject({ method: 'PUT', url: '/api/website', headers: auth, payload: payload as never });

  it('takes a released one', async () => {
    const res = await put({ templateId: PUBLISHED });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('refuses an unreleased one, however the owner learned the key', async () => {
    // The picker never offers it, so this key came from somewhere else —
    // and selecting it would put an unfinished design on a live website.
    const res = await put({ templateId: UNRELEASED });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('UNKNOWN_TEMPLATE');
  });

  it('leaves the stored template alone when it refuses', async () => {
    const stored = await prisma.websiteContent.findUnique({ where: { tenantId } });
    expect(stored?.templateId).toBe(PUBLISHED);
  });

  it('still lets a tenant already on one save everything else', async () => {
    // A theme can be unpublished after a tenant chose it. Their site keeps
    // rendering — the public renderer looks a theme up without asking about
    // status — so their editor has to keep working too.
    await prisma.websiteContent.update({
      where: { tenantId }, data: { templateId: UNRELEASED },
    });
    const res = await put({ templateId: UNRELEASED, heroTitle: 'Still editable' });
    expect(res.statusCode, res.body).toBe(200);
    expect((await prisma.websiteContent.findUnique({ where: { tenantId } }))?.heroTitle)
      .toBe('Still editable');
  });
});

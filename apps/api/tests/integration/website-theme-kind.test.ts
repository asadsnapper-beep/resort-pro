/**
 * Whether `GET /api/website` says how the chosen theme is drawn.
 *
 * The dashboard's section controls have to match whatever will actually render
 * the site. For the four hardcoded themes the key is enough — each declares
 * its own sections. For an uploaded or AI-generated theme the key is bespoke
 * and says nothing: all of them are drawn by the one ConfigThemeRenderer,
 * which has no Amenities section. Without the kind, the builder fell back to
 * offering every section, and an owner on an uploaded theme got a switch and
 * two reorder arrows for a section nothing would ever draw — the config half
 * of Website Builder QA 2026-10-28, WB-001.
 *
 * Each run builds and removes its own tenant and its own themes; nothing here
 * touches the demo tenant or the real catalogue.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `wkind-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
const auth = { Authorization: '' };

const uploadedKey = `${run}-uploaded`;
const templateKey = `${run}-tier2`;

const get = () =>
  app.inject({ method: 'GET', url: '/api/website', headers: auth });

const body = async () => JSON.parse((await get()).body).data;

/**
 * Point the tenant at a theme without going through the purchase gate — this
 * is about what GET reports, not about who may choose what. Upsert because one
 * test deletes the row to reach the empty-shell branch.
 */
const useTheme = (templateId: string) =>
  prisma.websiteContent.upsert({
    where: { tenantId },
    update: { templateId },
    create: { tenantId, templateId, heroTitle: 'Where the river bends' },
  });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Theme Kind Resort', slug: run, firstName: 'Nadia', lastName: 'R',
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
      { key: uploadedKey, name: 'Copper and Clay', themeType: 'UPLOADED', configJson: { key: uploadedKey } },
      { key: templateKey, name: 'Tier Two',        themeType: 'TEMPLATE', templateHtml: '<section id="hero"></section>' },
    ],
  });

  // Registration writes a WebsiteContent row of its own, with a hero title and
  // `templateId` at its 'luxe' default — so the empty-shell branch has to be
  // reached by deleting it, which one test below does.
}, 60000);

afterAll(async () => {
  await prisma.theme.deleteMany({ where: { key: { in: [uploadedKey, templateKey] } } });
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('a resort with no website content row at all', () => {
  it('gets the empty shell with no kind, rather than a 404', async () => {
    // The dashboard form has to load for a resort that has written nothing,
    // and the shell needs the field too — reading `themeType` off a response
    // that omits it would leave the builder guessing.
    await prisma.websiteContent.deleteMany({ where: { tenantId } });
    const res = await get();
    expect(res.statusCode, res.body).toBe(200);
    const data = JSON.parse(res.body).data;
    expect(data.themeType).toBeNull();
    expect(data.heroTitle).toBe('');
  });
});

describe('once a theme is chosen', () => {
  it('reports UPLOADED for an uploaded theme, which its key could not', async () => {
    await useTheme(uploadedKey);
    expect((await body()).themeType).toBe('UPLOADED');
  });

  it('reports TEMPLATE for a Tier 2 theme', async () => {
    await useTheme(templateKey);
    expect((await body()).themeType).toBe('TEMPLATE');
  });

  it('reports HARDCODED for one of the built-in themes', async () => {
    // Seeded catalogue themes are HARDCODED; luxe is the default everywhere.
    const luxe = await prisma.theme.findUnique({ where: { key: 'luxe' }, select: { themeType: true } });
    if (!luxe) return; // a database without the seeded catalogue has nothing to assert
    expect(luxe.themeType).toBe('HARDCODED');
    await useTheme('luxe');
    expect((await body()).themeType).toBe('HARDCODED');
  });

  it('is null for a stale key no theme row matches', async () => {
    // A key can outlive its theme. The builder then falls back to offering
    // every control, which is the cautious answer, so this must not throw.
    await useTheme('a-theme-that-was-deleted');
    const res = await get();
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body).data.themeType).toBeNull();
  });

  it('still returns the content itself, not only the kind', async () => {
    await useTheme(uploadedKey);
    await prisma.websiteContent.update({
      where: { tenantId }, data: { heroTitle: 'Where the river bends' },
    });
    const data = await body();
    expect(data.heroTitle).toBe('Where the river bends');
    expect(data.themeType).toBe('UPLOADED');
  });
});

describe('the kind is not tenant data', () => {
  it('does not leak another tenant\'s bespoke theme through it', async () => {
    // Themes are a shared catalogue, so this lookup is deliberately outside
    // the tenant-scoped client. What comes back must still be only the kind —
    // never the config, the HTML, or who the theme belongs to.
    await useTheme(uploadedKey);
    const data = await body();
    expect(data.configJson).toBeUndefined();
    expect(data.templateHtml).toBeUndefined();
    expect(data.exclusiveToTenantId).toBeUndefined();
  });
});

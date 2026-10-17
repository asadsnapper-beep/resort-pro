/**
 * A deleted default template can be brought back.
 *
 * The QA filed it as "template defaults can be deleted; there is no protection
 * or restore control" (CRM QA 2026-10-07, finding 016). The sharp edge was not
 * that deletion is allowed — a resort that does not send win-back offers
 * should be able to remove that template — it is that there was no way back.
 * `GET /templates` does re-create the eight starter templates, but only when
 * the list is *completely* empty, so deleting one left it gone while the
 * mechanism to restore it sat one condition away.
 *
 * `POST /templates/restore-defaults` closes that, and these tests pin the
 * three behaviours that make it trustworthy: it brings back exactly what is
 * missing, it is a no-op when nothing is, and it never touches a template the
 * owner wrote — including one they made by editing a default.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `tpldef-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
const auth = { Authorization: '' };

const listTemplates = () =>
  prisma.emailTemplate.findMany({ where: { tenantId }, select: { name: true, isDefault: true } });

const restore = () =>
  app.inject({
    method: 'POST', url: '/api/crm/templates/restore-defaults',
    headers: auth, payload: {},
  });

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Template Resort', slug: run, firstName: 'Asha', lastName: 'R',
      email: ownerEmail, password,
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  await prisma.tenant.update({
    where: { id: tenantId }, data: { plan: 'STARTER', planStatus: 'active' },
  });
  await applyPlanFlagsToTenant(tenantId, 'STARTER');

  auth.Authorization = `Bearer ${await verifyOwnerAndLogin(app, {
    tenantId, email: ownerEmail, password, slug: run,
  })}`;

  // The first GET is what seeds the defaults, so the state these tests start
  // from is the state a real tenant starts from.
  const first = await app.inject({ method: 'GET', url: '/api/crm/templates', headers: auth });
  expect(first.statusCode, first.body).toBe(200);
  expect(JSON.parse(first.body).data.length).toBeGreaterThan(0);
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('restoring defaults', () => {
  it('does nothing, and says so, when none are missing', async () => {
    const before = (await listTemplates()).length;

    const res = await restore();

    expect(res.statusCode, res.body).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.restored).toBe(0);
    expect(body.message).toMatch(/Nothing was missing/);
    expect((await listTemplates()).length).toBe(before);
  });

  it('brings back one that was deleted, and names it', async () => {
    const all = await listTemplates();
    const victim = all.find((t) => t.isDefault)!;
    expect(victim, 'the tenant should have default templates').toBeTruthy();

    await prisma.emailTemplate.deleteMany({ where: { tenantId, name: victim.name } });
    expect((await listTemplates()).some((t) => t.name === victim.name)).toBe(false);

    const res = await restore();

    const body = JSON.parse(res.body);
    expect(body.data.restored).toBe(1);
    expect(body.data.names).toEqual([victim.name]);
    expect(body.message).toContain(victim.name);
    expect((await listTemplates()).some((t) => t.name === victim.name)).toBe(true);
  });

  it('brings back several at once without duplicating the survivors', async () => {
    const all = await listTemplates();
    const doomed = all.filter((t) => t.isDefault).slice(0, 3).map((t) => t.name);
    expect(doomed.length).toBe(3);

    await prisma.emailTemplate.deleteMany({ where: { tenantId, name: { in: doomed } } });
    const afterDelete = await listTemplates();

    const res = await restore();

    expect(JSON.parse(res.body).data.restored).toBe(3);
    const names = (await listTemplates()).map((t) => t.name);
    // Back to the count before the deletion, with no second copy of anything.
    expect(names.length).toBe(afterDelete.length + 3);
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves a template the owner wrote completely alone', async () => {
    const mine = await prisma.emailTemplate.create({
      data: {
        tenantId, name: `Mine-${run}`, subject: 'My subject',
        html: '<p>my html</p>', isDefault: false,
      },
    });

    await restore();

    const after = await prisma.emailTemplate.findUniqueOrThrow({ where: { id: mine.id } });
    expect(after.subject).toBe('My subject');
    expect(after.html).toBe('<p>my html</p>');
  });

  it('does not overwrite an edited default — it is matched by name', async () => {
    // Someone rewrote a default's body. Restoring must not revert their work.
    const target = (await listTemplates()).find((t) => t.isDefault)!;
    await prisma.emailTemplate.updateMany({
      where: { tenantId, name: target.name },
      data: { subject: 'Rewritten by the owner' },
    });

    await restore();

    const rows = await prisma.emailTemplate.findMany({
      where: { tenantId, name: target.name }, select: { subject: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('Rewritten by the owner');
  });
});

describe('editing one', () => {
  it('updates in place rather than adding a copy', async () => {
    const t = (await listTemplates()).find((x) => x.isDefault)!;
    const row = await prisma.emailTemplate.findFirstOrThrow({
      where: { tenantId, name: t.name }, select: { id: true },
    });

    const res = await app.inject({
      method: 'PUT', url: `/api/crm/templates/${row.id}`,
      headers: auth, payload: { subject: 'Corrected subject' },
    });

    expect(res.statusCode, res.body).toBe(200);
    const after = await prisma.emailTemplate.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.subject).toBe('Corrected subject');
  });

  it('answers 404 for one that is not there', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/crm/templates/00000000-0000-4000-8000-000000000000',
      headers: auth, payload: { subject: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });
});

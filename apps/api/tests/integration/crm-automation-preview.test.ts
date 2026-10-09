/**
 * "Run Now" can be looked at before it is believed.
 *
 * The daily automation sent birthday and anniversary email the instant the
 * button was clicked — no recipient list, no confirmation (CRM QA 2026-10-07,
 * finding 011). Email cannot be recalled, and it is worse than that: every
 * send writes an EmailSend row, and both audience queries exclude anyone with
 * a matching row from the last 300 days. So a mistaken click does not just
 * send the wrong email, it suppresses the right one for most of a year.
 *
 * `{ dryRun: true }` answers who would receive what. Two things have to hold
 * for that to be worth anything, and both are tested here:
 *
 *  1. It sends nothing and writes nothing — otherwise looking costs the same
 *     as sending, including the suppression.
 *  2. It names the same people the real run then emails. A preview assembled
 *     from a second, similar-looking query would be a new way to be wrong
 *     about who gets email.
 *
 * Email is disabled in tests (no RESEND_API_KEY), so a real run still writes
 * its EmailSend rows — as FAILED — which is what makes (1) observable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import { applyPlanFlagsToTenant } from '../../src/utils/entitlement';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const run = `autoprev-${Date.now()}`;
const ownerEmail = `owner-${run}@test.com`;
const password = 'TestPass123!';
let tenantId: string;
const auth = { Authorization: '' };

const runDaily = (payload: Record<string, unknown> = {}) =>
  app.inject({ method: 'POST', url: '/api/crm/automation/run-daily', headers: auth, payload });

const sendCount = () => prisma.emailSend.count({ where: { tenantId } });

/** Born today, some years ago — so the birthday query matches. */
const birthdayToday = () => {
  const d = new Date();
  return new Date(Date.UTC(1990, d.getMonth(), d.getDate(), 12));
};

let birthdayGuestId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Preview Resort', slug: run, firstName: 'Asha', lastName: 'R',
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

  birthdayGuestId = (await prisma.guest.create({
    data: {
      tenantId, firstName: 'Rafiq', lastName: 'Probe',
      email: `rafiq-${run}@test.com`, dateOfBirth: birthdayToday(),
    },
  })).id;

  // Somebody the automation must not reach: same birthday, opted out.
  const quiet = await prisma.guest.create({
    data: {
      tenantId, firstName: 'Quiet', lastName: 'P',
      email: `quiet-${run}@test.com`, dateOfBirth: birthdayToday(),
    },
  });
  await prisma.emailConsent.create({
    data: { tenantId, guestId: quiet.id, subscribed: false },
  });
}, 60000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: run } });
  await app.close();
});

describe('asking who is due', () => {
  it('names them, with addresses — a count is not checkable', async () => {
    const res = await runDaily({ dryRun: true });

    expect(res.statusCode, res.body).toBe(200);
    const body = JSON.parse(res.body).data;
    expect(body.dryRun).toBe(true);
    expect(body.birthday.found).toBe(1);
    expect(body.birthday.recipients[0]).toMatchObject({
      firstName: 'Rafiq', email: `rafiq-${run}@test.com`,
    });
  });

  it('leaves out the guest who opted out', async () => {
    const body = JSON.parse((await runDaily({ dryRun: true })).body).data;
    const emails = body.birthday.recipients.map((r: { email: string }) => r.email);

    expect(emails).not.toContain(`quiet-${run}@test.com`);
  });

  it('writes nothing, so looking does not cost what sending costs', async () => {
    // Its own guest. An earlier version of this test reused the one from
    // beforeAll and passed even when dryRun was ignored — by then that guest
    // had already been emailed and suppressed, so there was nobody left to
    // send to and the count held steady for the wrong reason.
    const extra = await prisma.guest.create({
      data: {
        tenantId, firstName: 'Nadia', lastName: 'P',
        email: `nadia-${run}@test.com`, dateOfBirth: birthdayToday(),
      },
    });
    const before = await sendCount();

    await runDaily({ dryRun: true });
    await runDaily({ dryRun: true });

    expect(await sendCount()).toBe(before);
    // And she is still due, which is the part the 300-day window would eat.
    const after = JSON.parse((await runDaily({ dryRun: true })).body).data;
    expect(after.birthday.recipients.map((r: { id: string }) => r.id)).toContain(extra.id);

    await prisma.guest.delete({ where: { id: extra.id } });
  });

  it('says plainly when there is nobody', async () => {
    const slug = `${run}-empty`;
    const email = `owner-${slug}@test.com`;
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      // Its own address: the register limit is per-IP, and loosening the real
      // limit to make a test pass would be the wrong trade.
      remoteAddress: '10.0.0.9',
      payload: { resortName: 'Empty Resort', slug, firstName: 'B', lastName: 'C', email, password },
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const emptyTenantId = JSON.parse(reg.body).data.tenant.id;
    await prisma.tenant.update({
      where: { id: emptyTenantId }, data: { plan: 'STARTER', planStatus: 'active' },
    });
    await applyPlanFlagsToTenant(emptyTenantId, 'STARTER');
    const token = await verifyOwnerAndLogin(app, { tenantId: emptyTenantId, email, password, slug });

    const res = await app.inject({
      method: 'POST', url: '/api/crm/automation/run-daily',
      headers: { Authorization: `Bearer ${token}` }, payload: { dryRun: true },
    });

    const body = JSON.parse(res.body);
    expect(body.data.birthday.found).toBe(0);
    expect(body.data.anniversary.found).toBe(0);
    expect(body.message).toMatch(/Nothing to send/);

    await prisma.tenant.deleteMany({ where: { slug } });
  });
});

describe('then sending', () => {
  it('reaches exactly the guests the preview named', async () => {
    const previewed: string[] = JSON.parse((await runDaily({ dryRun: true })).body)
      .data.birthday.recipients.map((r: { id: string }) => r.id);

    const res = await runDaily();
    expect(res.statusCode, res.body).toBe(200);

    const rows = await prisma.emailSend.findMany({
      where: { tenantId, subject: { contains: 'Birthday' } },
      select: { guestId: true },
    });
    expect(rows.map((r) => r.guestId).sort()).toEqual(previewed.sort());
    expect(previewed).toContain(birthdayGuestId);
  });

  it('and a preview beforehand did not use up the guest', async () => {
    // The suppression window is the reason this matters: if the dry run had
    // written a row, this guest would already have been skipped above.
    const rows = await prisma.emailSend.count({
      where: { tenantId, guestId: birthdayGuestId },
    });
    expect(rows).toBeGreaterThan(0);
  });

  it('now reports nobody, because the send suppressed them', async () => {
    const body = JSON.parse((await runDaily({ dryRun: true })).body).data;

    expect(body.birthday.found).toBe(0);
  });
});

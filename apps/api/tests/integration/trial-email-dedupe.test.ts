/**
 * A tenant must never receive the same trial-lifecycle email twice.
 *
 * The job chose what to send purely from how far trialEndsAt sat from now,
 * inside a window a day wide, with no record of what it had already sent —
 * while running every 12 hours AND once at worker startup. Two runs landed in
 * every window, three if a container restarted, and each one sent again.
 *
 * The worker had never been deployed, so this had never reached a real owner.
 * It would have on the first deploy.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@resort-pro/database';

const sent: { to: string; subject: string }[] = [];
vi.mock('../../src/services/email', () => ({
  sendEmail: vi.fn(async (m: any) => { sent.push({ to: m.to, subject: m.subject }); return { ok: true }; }),
}));

const { runTrialEmailCron } = await import('../../src/services/trial-emails');

const slug = `trialmail-${Date.now()}`;
let tenantId: string;

/** A tenant whose trial ends in `days` days, with an owner to mail. */
async function makeTenant(days: number) {
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const t = await prisma.tenant.create({
    data: {
      name: 'Trial Mail Resort', slug, plan: 'FREE', planStatus: 'trialing',
      isActive: true, trialEndsAt,
      users: { create: { email: `tm-${slug}@test.com`, passwordHash: 'x', firstName: 'Trial', lastName: 'Owner', role: 'OWNER', isActive: true } },
    },
  });
  return t.id;
}

beforeAll(async () => { tenantId = await makeTenant(7); });
afterAll(async () => { await prisma.tenant.deleteMany({ where: { slug } }); });

describe('Trial email dedupe', () => {
  it('sends the 7-day warning once, however many times the job runs', async () => {
    await runTrialEmailCron();
    const afterFirst = sent.filter(m => m.to === `tm-${slug}@test.com`).length;
    expect(afterFirst).toBe(1);

    // The 12-hour tick, and a container restart firing the startup run again.
    await runTrialEmailCron();
    await runTrialEmailCron();

    const total = sent.filter(m => m.to === `tm-${slug}@test.com`).length;
    expect(total).toBe(1);
  }, 30000);

  it('records exactly one row for the stage', async () => {
    const rows = await prisma.trialEmailLog.findMany({ where: { tenantId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.stage).toBe('warn7');
    expect(rows[0]!.sentTo).toBe(`tm-${slug}@test.com`);
  });

  it('the unique constraint is what enforces it, not a read-then-check', async () => {
    await expect(
      prisma.trialEmailLog.create({ data: { tenantId, stage: 'warn7', sentTo: 'someone@else.com' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('a different stage for the same tenant is still allowed', async () => {
    await prisma.trialEmailLog.create({ data: { tenantId, stage: 'warn3', sentTo: `tm-${slug}@test.com` } });
    expect(await prisma.trialEmailLog.count({ where: { tenantId } })).toBe(2);
  });
});

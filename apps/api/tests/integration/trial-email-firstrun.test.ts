/**
 * A fresh environment's first worker start must not mail a backlog.
 *
 * This is the production case: the worker has never run, so trial_email_logs is
 * empty and every tenant sitting in a window would be mailed at once. The
 * suppression script cannot cover it — the worker container starts seconds
 * after the deploy, so nobody can run the script in between.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@resort-pro/database';

const sent: string[] = [];
vi.mock('../../src/services/email', () => ({
  sendEmail: vi.fn(async (m: any) => { sent.push(m.to); return { ok: true }; }),
}));

const { runTrialEmailCron } = await import('../../src/services/trial-emails');

const tag = `firstrun-${Date.now()}`;
const cases: [string, number][] = [
  ['ends-7', 7], ['ends-3', 3], ['ends-1', 1],   // live trials — must still be warned
  ['gone-0', -0.2], ['gone-3', -3], ['gone-7', -7], ['gone-29', -29.7], // backlog — must be silent
];

beforeAll(async () => {
  // Simulate a virgin environment: no log rows at all.
  await prisma.trialEmailLog.deleteMany({});
  for (const [name, days] of cases) {
    const slug = `${tag}-${name}`;
    await prisma.tenant.create({
      data: {
        name: `Resort ${name}`, slug, plan: 'FREE', planStatus: 'trialing', isActive: true,
        trialEndsAt: new Date(Date.now() + days * 86_400_000),
        users: { create: { email: `${slug}@test.com`, passwordHash: 'x', firstName: 'O', lastName: 'W', role: 'OWNER', isActive: true } },
      },
    });
  }
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: tag } } });
});

describe('First worker start in a fresh environment', () => {
  it('mails no one whose trial already ended, with no manual step run first', async () => {
    await runTrialEmailCron();
    const mine = sent.filter((e) => e.startsWith(tag));
    expect(mine.filter((e) => e.includes('-gone-'))).toEqual([]);
  }, 40000);

  it('still warns the live trials — silence must not be total', async () => {
    const mine = sent.filter((e) => e.startsWith(tag));
    expect(mine.filter((e) => e.includes('-ends-')).sort()).toEqual([
      `${tag}-ends-1@test.com`,
      `${tag}-ends-3@test.com`,
      `${tag}-ends-7@test.com`,
    ]);
  });

  it('records the suppression, so the burst cannot happen on a later restart', async () => {
    const rows = await prisma.trialEmailLog.findMany({
      where: { tenant: { slug: { startsWith: tag } }, sentTo: { startsWith: 'suppressed-backlog:' } },
      select: { stage: true },
    });
    expect(rows.map((r) => r.stage).sort()).toEqual(['expired', 'winback3', 'winback30', 'winback7']);
  });

  it('does not re-suppress once the table is non-empty', async () => {
    const before = await prisma.trialEmailLog.count();
    await runTrialEmailCron();
    expect(await prisma.trialEmailLog.count()).toBe(before);
  }, 30000);
});

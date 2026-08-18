/**
 * The first worker run must not dump stale lifecycle mail on people.
 *
 * The worker has never been deployed, so on its first run the job will mail
 * every tenant currently inside a window — including win-backs for trials that
 * ended weeks ago, and a 30-day notice claiming their data is scheduled for
 * deletion, which nothing in this codebase does.
 *
 * scripts/suppress-trial-email-backlog.ts pre-writes TrialEmailLog rows for the
 * backward-looking stages so the first run skips them, while leaving the
 * forward warnings alone: a trial ending in three days should still be warned
 * today.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@resort-pro/database';

const sent: string[] = [];
vi.mock('../../src/services/email', () => ({
  sendEmail: vi.fn(async (m: any) => { sent.push(m.to); return { ok: true }; }),
}));

const { runTrialEmailCron } = await import('../../src/services/trial-emails');

const tag = `backlog-${Date.now()}`;
const PAST_STAGES = new Set(['expired', 'winback3', 'winback7', 'winback30']);
const around = (v: number, t: number) => v > t - 0.5 && v <= t + 0.5;

/** days > 0 = trial still running; days < 0 = already expired. */
const cases: [string, number][] = [
  ['ends-7',   7], ['ends-3',   3], ['ends-1',   1],
  ['gone-0',  -0.2], ['gone-3',  -3], ['gone-7',  -7], ['gone-29', -29.7],
  ['ends-14', 14], ['gone-45', -45],   // outside every window — must stay silent
];

beforeAll(async () => {
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

/** The script's selection logic, applied to this test's tenants. */
async function suppressBacklog() {
  const now = Date.now();
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: tag } },
    include: { users: { where: { role: 'OWNER' }, take: 1, select: { email: true } } },
  });
  for (const t of tenants) {
    const email = t.users[0]!.email;
    const past = (now - t.trialEndsAt!.getTime()) / 86_400_000;
    if (past <= 0) continue; // still running — forward warnings are left alone
    const stage = past < 0.5 ? 'expired'
      : around(past, 3) ? 'winback3'
      : around(past, 7) ? 'winback7'
      : around(past, 30) ? 'winback30' : null;
    if (stage && PAST_STAGES.has(stage)) {
      await prisma.trialEmailLog.create({
        data: { tenantId: t.id, stage, sentTo: `suppressed-backlog:${email}` },
      });
    }
  }
}

describe('First-run trial email backlog', () => {
  it('suppresses stale win-backs while still warning live trials', async () => {
    await suppressBacklog();
    await runTrialEmailCron();

    const mine = sent.filter((e) => e.startsWith(tag));

    // Nobody whose trial already ended should hear from us on day one.
    expect(mine.filter((e) => e.includes('-gone-'))).toEqual([]);

    // Live trials inside a window still get their warning — that is the point.
    expect(mine.filter((e) => e.includes('-ends-')).sort()).toEqual([
      `${tag}-ends-1@test.com`,
      `${tag}-ends-3@test.com`,
      `${tag}-ends-7@test.com`,
    ]);

    // A trial 14 days out is in no window at all.
    expect(mine.some((e) => e.includes('-ends-14'))).toBe(false);
  }, 40000);

  it('a second run stays silent — suppression and dedupe share one table', async () => {
    const before = sent.filter((e) => e.startsWith(tag)).length;
    await runTrialEmailCron();
    expect(sent.filter((e) => e.startsWith(tag)).length).toBe(before);
  }, 30000);

  it('suppression rows are labelled, so they are not mistaken for real sends', async () => {
    const rows = await prisma.trialEmailLog.findMany({
      where: { tenant: { slug: { startsWith: tag } } },
      select: { stage: true, sentTo: true },
    });
    const suppressed = rows.filter((r) => r.sentTo.startsWith('suppressed-backlog:'));
    expect(suppressed.map((r) => r.stage).sort()).toEqual(['expired', 'winback3', 'winback30', 'winback7']);
  });
});

describe('Win-back copy makes no claim we do not honour', () => {
  it('the 30-day email does not threaten deletion — nothing deletes dormant data', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../src/services/trial-emails.ts', import.meta.url), 'utf8'));
    // Strip comments so the note explaining the removal is not mistaken for the claim.
    const code = src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
    expect(code).not.toMatch(/permanently deleted/i);
    expect(code).not.toMatch(/deletion scheduled/i);
    expect(code).not.toMatch(/data deletion/i);
  });

  it('the 30-day window is reachable at all', async () => {
    // around(30) wants 29.5–30.5 days past expiry; the query bound must not
    // cut that in half, which a 30-day bound did.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../src/services/trial-emails.ts', import.meta.url), 'utf8'));
    expect(src).toMatch(/now\.getTime\(\) - 31 \* 24 \* 60 \* 60 \* 1000/);
  });
});

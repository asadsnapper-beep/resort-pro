/**
 * Mark the trial-email backlog as already sent, before the worker runs for the
 * first time.
 *
 * The worker has never been deployed, so nobody has ever received these. On its
 * first run the job will mail every tenant that happens to sit inside a window
 * right now — including win-backs for trials that ended weeks ago. Those read
 * as a burst of stale mail from a system that has been silent, and the 30-day
 * one tells people their data is scheduled for deletion, which nothing in this
 * codebase actually does.
 *
 * So: suppress the backward-looking stages, let the forward ones through.
 * A tenant whose trial ends in three days genuinely should hear that, today.
 * A tenant whose trial ended three weeks ago should not hear about it now.
 *
 *   npx tsx src/scripts/suppress-trial-email-backlog.ts            # dry run
 *   npx tsx src/scripts/suppress-trial-email-backlog.ts --apply
 *   npx tsx src/scripts/suppress-trial-email-backlog.ts --apply --all
 *
 * `--all` also suppresses the forward warnings, for a completely silent first
 * run. Run this on the same database, before the worker starts.
 */

import { prisma } from '@resort-pro/database';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');

/** Backward-looking: about a trial that has already ended. */
const PAST_STAGES = new Set(['expired', 'winback3', 'winback7', 'winback30']);

type Pending = { tenantId: string; name: string; stage: string; email: string; days: number };

/** Mirrors runTrialEmailCron's own window test, so this predicts the same sends. */
const around = (value: number, target: number) => value > target - 0.5 && value <= target + 0.5;

async function main() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const owner = {
    users: { where: { role: 'OWNER' as const, isActive: true }, take: 1, select: { email: true } },
  };

  const [trialing, expired] = await Promise.all([
    prisma.tenant.findMany({ where: { planStatus: 'trialing', isActive: true }, include: owner }),
    prisma.tenant.findMany({
      where: { planStatus: 'trialing', trialEndsAt: { gte: thirtyDaysAgo, lt: now } },
      include: owner,
    }),
  ]);

  const pending: Pending[] = [];

  for (const t of trialing) {
    const email = t.users[0]?.email;
    if (!email || !t.trialEndsAt) continue;
    const days = (t.trialEndsAt.getTime() - now.getTime()) / 86_400_000;
    const stage = around(days, 7) ? 'warn7' : around(days, 3) ? 'warn3' : around(days, 1) ? 'warn1' : null;
    if (stage) pending.push({ tenantId: t.id, name: t.name, stage, email, days: +days.toFixed(2) });
  }

  for (const t of expired) {
    const email = t.users[0]?.email;
    if (!email || !t.trialEndsAt) continue;
    const days = (now.getTime() - t.trialEndsAt.getTime()) / 86_400_000;
    const stage = days < 0.5 ? 'expired'
      : around(days, 3) ? 'winback3'
      : around(days, 7) ? 'winback7'
      : around(days, 30) ? 'winback30'
      : null;
    if (stage) pending.push({ tenantId: t.id, name: t.name, stage, email, days: +days.toFixed(2) });
  }

  const suppress = pending.filter((p) => ALL || PAST_STAGES.has(p.stage));
  const allow = pending.filter((p) => !suppress.includes(p));

  console.log(`\nTenants the first run would mail: ${pending.length}\n`);

  if (suppress.length) {
    console.log(`Suppress (${suppress.length}):`);
    for (const p of suppress) console.log(`  ${p.stage.padEnd(10)} ${p.name} <${p.email}>  ${p.days}d`);
  }
  if (allow.length) {
    console.log(`\nLet through (${allow.length}) — timely and worth sending:`);
    for (const p of allow) console.log(`  ${p.stage.padEnd(10)} ${p.name} <${p.email}>  ${p.days}d`);
  }
  if (!pending.length) console.log('  nothing pending — the first run would be quiet anyway');

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write the suppression rows.');
    return;
  }

  let written = 0;
  for (const p of suppress) {
    // createMany + skipDuplicates would hide a pre-existing row; being explicit
    // keeps the count honest.
    try {
      await prisma.trialEmailLog.create({
        data: { tenantId: p.tenantId, stage: p.stage, sentTo: `suppressed-backlog:${p.email}` },
      });
      written++;
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
    }
  }
  console.log(`\nWrote ${written} suppression row(s). The first worker run will skip these.`);
  console.log('sentTo is prefixed "suppressed-backlog:" so these are distinguishable from real sends.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

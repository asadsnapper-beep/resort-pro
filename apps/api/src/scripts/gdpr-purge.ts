/**
 * GDPR Purge Job
 *
 * Run via cron (daily) or manually:
 *   npx tsx src/scripts/gdpr-purge.ts
 *
 * What it does:
 * 1. Find tenants with erasure requested > 30 days ago AND not yet anonymized
 * 2. Anonymize each one (PII replacement)
 * 3. Log results
 *
 * The 30-day grace period lets tenants contact support if deletion was
 * requested by mistake before their data is permanently anonymized.
 */
import { prisma } from '@resort-pro/database';
import { getPendingErasures, anonymizeTenant } from '../utils/gdpr';

async function main() {
  console.log(`\n🔒 GDPR Purge Job — ${new Date().toISOString()}`);
  console.log('─'.repeat(50));

  const pending = await getPendingErasures();

  if (pending.length === 0) {
    console.log('✅  No pending erasures. Nothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`⚠️  Found ${pending.length} tenant(s) due for anonymization:\n`);
  pending.forEach((t) =>
    console.log(`   • ${t.name} (${t.slug}) — requested ${t.gdprErasureRequestedAt?.toLocaleDateString()} by ${t.gdprErasureRequestedBy}`)
  );
  console.log('');

  let succeeded = 0;
  let failed = 0;

  for (const tenant of pending) {
    try {
      const result = await anonymizeTenant(tenant.id);
      console.log(`✅  Anonymized: ${tenant.name} — ${result.usersAnonymized} users, ${result.guestsAnonymized} guests`);
      succeeded++;
    } catch (err) {
      console.error(`❌  Failed: ${tenant.name} — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────────────`);
  console.log(`Done — ✅ ${succeeded} succeeded, ❌ ${failed} failed\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

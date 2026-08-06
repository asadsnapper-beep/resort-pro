/**
 * Balance Consistency Audit (read-only)
 *
 * Booking.paidAmount is updated ad-hoc by several different handlers
 * (payment recording, cancellation refunds, gateway webhooks) while
 * GET /bookings/:id/invoice independently *recomputes* "paid" straight from
 * the Payment table for display. Those are two separate sources of truth —
 * if any code path ever updates one without the other, a booking's detail
 * page and its invoice can show different balances. This script checks
 * every booking for exactly that kind of drift, plus a couple of basic
 * sanity checks. It only reads and prints — it never writes anything.
 * Fix whatever it finds one root cause at a time; don't auto-correct
 * silently (see plan/core-workflow-execution-plan.md, Tier 2, item 4).
 *
 * Run:
 *   npx tsx src/scripts/audit-balances.ts
 *   npx tsx src/scripts/audit-balances.ts --tenant=palm-paradise-resort
 */
import { prisma } from '@resort-pro/database';

function money(n: number) {
  return n.toFixed(2);
}

async function main() {
  const tenantSlugArg = process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1];
  const tenant = tenantSlugArg
    ? await prisma.tenant.findUnique({ where: { slug: tenantSlugArg } })
    : null;
  if (tenantSlugArg && !tenant) {
    console.error(`No tenant found with slug "${tenantSlugArg}"`);
    process.exit(1);
  }

  console.log(`\n🔎 Balance Consistency Audit — ${new Date().toISOString()}`);
  if (tenant) console.log(`   Scoped to tenant: ${tenant.name} (${tenant.slug})`);
  console.log('─'.repeat(60));

  const bookings = await prisma.booking.findMany({
    where: tenant ? { tenantId: tenant.id } : {},
    select: {
      confirmationNo: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      paidAmount: true,
      payments: { select: { amount: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let mismatchCount = 0;
  let sanityCount = 0;

  for (const b of bookings) {
    // Same net-amount convention the cancel/refund handler already uses:
    // PAID payments are positive, REFUNDED payments are stored negative.
    const recomputedPaid = b.payments
      .filter((p) => p.status === 'PAID' || p.status === 'REFUNDED')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const storedPaid = Number(b.paidAmount);
    const total = Number(b.totalAmount);

    // 1. Booking.paidAmount vs what the Payment rows actually add up to.
    if (Math.abs(recomputedPaid - storedPaid) > 0.01) {
      mismatchCount++;
      console.log(`❌ ${b.confirmationNo} — paidAmount mismatch: booking says ৳${money(storedPaid)}, Payment rows say ৳${money(recomputedPaid)}`);
    }

    // 2. paymentStatus vs what paidAmount/totalAmount imply. Skip
    // REFUNDED/FAILED — those are terminal states this formula can't derive.
    const expectedStatus =
      total <= 0 ? 'PAID' :
      storedPaid <= 0 ? 'PENDING' :
      storedPaid >= total ? 'PAID' : 'PARTIAL';
    if (!['REFUNDED', 'FAILED'].includes(b.paymentStatus) && b.paymentStatus !== expectedStatus) {
      mismatchCount++;
      console.log(`❌ ${b.confirmationNo} — paymentStatus is "${b.paymentStatus}", expected "${expectedStatus}" (paid ৳${money(storedPaid)} / total ৳${money(total)})`);
    }

    // 3. Sanity: paidAmount should never go negative.
    if (storedPaid < -0.01) {
      sanityCount++;
      console.log(`⚠️  ${b.confirmationNo} — negative paidAmount: ৳${money(storedPaid)}`);
    }

    // 4. Sanity: an active (not cancelled/no-show) booking paid more than it owes.
    if (storedPaid > total + 0.01 && !['CANCELLED', 'NO_SHOW'].includes(b.status)) {
      sanityCount++;
      console.log(`⚠️  ${b.confirmationNo} — paidAmount (৳${money(storedPaid)}) exceeds totalAmount (৳${money(total)})`);
    }
  }

  console.log('─'.repeat(60));
  console.log(`Checked ${bookings.length} booking(s). ${mismatchCount} mismatch(es), ${sanityCount} sanity warning(s).`);
  if (mismatchCount === 0 && sanityCount === 0) console.log('✅ All clear.');
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

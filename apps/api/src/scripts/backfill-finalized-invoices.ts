/**
 * Backfill `finalizedAt` on invoices for stays that are already over.
 *
 * Check-out now freezes an invoice (see plan/checkout-billing-completeness.md).
 * Invoices written before that change have `finalizedAt = null` even though
 * their guest left months ago, so code that asks "is this a historical record?"
 * would wrongly treat them as editable and let someone alter a settled bill.
 *
 * What this deliberately does NOT do: touch a single number. Not totals, not
 * line items, not status. Those invoices are wrong — most price the room from
 * room.basePrice rather than what was actually charged — but repricing a stay
 * that was settled and paid months ago would silently rewrite history and put
 * every past revenue report out of step with the invoices behind it. The bad
 * numbers stay; they are what the guest was actually given.
 *
 * `status` is left alone for the same reason. The invoice list already patches
 * it from the booking's payment truth at read time (withBookingPaymentTruth in
 * routes/invoices.ts), so nothing is gained by rewriting stored values.
 *
 * Dry run by default. Nothing is written without --apply.
 *
 * Run:
 *   npx tsx src/scripts/backfill-finalized-invoices.ts
 *   npx tsx src/scripts/backfill-finalized-invoices.ts --tenant=palm-paradise-resort
 *   npx tsx src/scripts/backfill-finalized-invoices.ts --apply
 */
import { prisma } from '@resort-pro/database';

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantSlug = process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1];

  const tenant = tenantSlug ? await prisma.tenant.findUnique({ where: { slug: tenantSlug } }) : null;
  if (tenantSlug && !tenant) {
    console.error(`No tenant found with slug "${tenantSlug}"`);
    process.exit(1);
  }

  console.log(`\n📄 Backfill finalizedAt — ${new Date().toISOString()}`);
  console.log(`   Mode: ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`);
  if (tenant) console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
  console.log('─'.repeat(64));

  // Only stays that are actually over. A CANCELLED or still-CHECKED_IN booking
  // has nothing to freeze, and a booking-less invoice (corporate, manual) has
  // no check-out date to borrow.
  const candidates = await prisma.invoice.findMany({
    where: {
      finalizedAt: null,
      ...(tenant ? { tenantId: tenant.id } : {}),
      booking: { status: 'CHECKED_OUT' },
    },
    select: {
      id: true, invoiceNumber: true, status: true, total: true,
      booking: { select: { confirmationNo: true, actualCheckOut: true, updatedAt: true, checkedOutBy: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (candidates.length === 0) {
    console.log('Nothing to backfill — every settled stay already has finalizedAt.\n');
    return;
  }

  console.log(`${candidates.length} invoice(s) belong to a stay that is already checked out:\n`);
  let missingDate = 0;

  for (const inv of candidates) {
    // actualCheckOut is the truthful moment. Older rows predate it being set,
    // so fall back to the booking's last change rather than "now" — stamping
    // today's date on a stay from March would be a worse lie than an
    // approximate one.
    const when = inv.booking!.actualCheckOut ?? inv.booking!.updatedAt;
    if (!inv.booking!.actualCheckOut) missingDate++;
    console.log(
      `  ${inv.invoiceNumber.padEnd(24)} ${String(inv.status).padEnd(8)} ` +
      `total ${String(inv.total).padStart(10)}  ${inv.booking!.confirmationNo}  → ${when.toISOString().slice(0, 10)}` +
      `${inv.booking!.actualCheckOut ? '' : '  (approximate)'}`,
    );
  }

  console.log('\n' + '─'.repeat(64));
  console.log(`Totals and line items will NOT be touched — only finalizedAt/finalizedBy.`);
  if (missingDate > 0) {
    console.log(`${missingDate} booking(s) have no actualCheckOut; their booking's updatedAt is used instead.`);
  }

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.\n');
    return;
  }

  let written = 0;
  for (const inv of candidates) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        finalizedAt: inv.booking!.actualCheckOut ?? inv.booking!.updatedAt,
        finalizedBy: inv.booking!.checkedOutBy ?? undefined,
      },
    });
    written++;
  }

  // Re-running is a no-op: the filter is finalizedAt = null.
  const remaining = await prisma.invoice.count({
    where: { finalizedAt: null, ...(tenant ? { tenantId: tenant.id } : {}), booking: { status: 'CHECKED_OUT' } },
  });
  console.log(`\n✅ ${written} invoice(s) marked finalized. Remaining unmarked: ${remaining}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

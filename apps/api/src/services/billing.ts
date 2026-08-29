import { prisma } from '@resort-pro/database';

/**
 * The one place a stay's payable total is calculated.
 *
 * Before this existed, four code paths each added up a booking their own way
 * and disagreed: the front desk showed room-minus-paid, the check-out route
 * added food, the guest email and invoice page added extras and tax but priced
 * the room from `room.basePrice`, and the stored `Invoice` was a snapshot taken
 * on the day the booking was made. A guest could be quoted 13,500, emailed
 * 10,700 and invoiced 9,000 for the same stay.
 *
 * See plan/billing-contract.md. Rule 1: nothing else may total a stay.
 */

/** Round money once, at the point it becomes a line total. Half-up, 2dp. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type BillSourceType = 'ROOM' | 'PACKAGE' | 'FOOD_ORDER' | 'EXTRA';

export type BillLine = {
  /** Provenance — with sourceId, makes charge creation idempotent (contract R2). */
  sourceType: BillSourceType;
  sourceId: string;
  description: string;
  category: 'ROOM' | 'FOOD' | 'SERVICE' | 'OTHER';
  quantity: number;
  unitPrice: number;
  total: number;
};

/**
 * An order that has not reached the guest yet, on a stay that is being settled.
 *
 * Deliberately surfaced rather than decided: billing it charges for food nobody
 * ate, dropping it silently loses real money. The desk delivers or voids it.
 */
export type BillWarning = {
  kind: 'UNDELIVERED_FOOD';
  sourceId: string;
  description: string;
  amount: number;
};

export type Bill = {
  bookingId: string;
  currency: string;
  nights: number;
  lines: BillLine[];
  roomTotal: number;
  packagesTotal: number;
  foodTotal: number;
  extrasTotal: number;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  /** Collected at check-in and held; not a payment until applied. */
  deposit: number;
  /** Corporate-billed stays settle against the company, not the guest folio. */
  billedTo: 'GUEST' | 'CORPORATE';
  warnings: BillWarning[];
};

/** Food that has reached the guest and has not already been paid at the outlet. */
const BILLABLE_FOOD_STATUS = 'DELIVERED';
const UNDELIVERED_FOOD_STATUSES = ['PENDING', 'PREPARING', 'READY'] as const;

function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
}

/**
 * Calculate what a stay currently owes.
 *
 * `tenantId` is passed explicitly: this is called from transactions and jobs
 * where the tenant-scoped Prisma client is not in play, and a billing query
 * that silently crosses tenants is not a bug anyone would catch in review.
 */
export async function bill(tenantId: string, bookingId: string): Promise<Bill> {
  const booking = await prisma.booking.findFirstOrThrow({
    where: { id: bookingId, tenantId },
    include: {
      room: { select: { name: true, number: true } },
      tenant: { select: { currency: true, taxRate: true } },
      bookingPackages: true,
      invoiceExtras: { orderBy: { createdAt: 'asc' } },
      foodOrders: { include: { items: { include: { menuItem: { select: { name: true } } } } } },
      invoice: { select: { discountAmt: true } },
    },
  });

  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const lines: BillLine[] = [];

  // ── Room ────────────────────────────────────────────────────────────────
  // `booking.totalAmount` is the only figure that survived rate-plan
  // resolution, a staff rate override and any discount. `room.basePrice` is
  // the price list, not the price charged — four code paths used it and all
  // four were wrong whenever a rate plan applied.
  const roomTotal = round2(Number(booking.totalAmount));
  lines.push({
    sourceType: 'ROOM',
    sourceId: booking.id,
    description: `${booking.room.name} — ${nights} night${nights > 1 ? 's' : ''}`,
    category: 'ROOM',
    quantity: nights,
    unitPrice: round2(roomTotal / nights),
    total: roomTotal,
  });

  // ── Packages ────────────────────────────────────────────────────────────
  // Name and price are already snapshotted on BookingPackage, so a later
  // change to the package cannot alter a stay that is already priced.
  let packagesTotal = 0;
  for (const bp of booking.bookingPackages) {
    const qty = bp.priceType === 'PER_NIGHT' ? bp.nights : 1;
    const total = round2(bp.price * qty);
    packagesTotal += total;
    lines.push({
      sourceType: 'PACKAGE',
      sourceId: bp.id,
      description: bp.packageName,
      category: 'SERVICE',
      quantity: qty,
      unitPrice: round2(bp.price),
      total,
    });
  }
  packagesTotal = round2(packagesTotal);

  // ── Food ────────────────────────────────────────────────────────────────
  let foodTotal = 0;
  const warnings: BillWarning[] = [];
  for (const order of booking.foodOrders) {
    const amount = round2(Number(order.totalAmount));

    if (order.status === BILLABLE_FOOD_STATUS && order.paymentStatus !== 'PAID') {
      foodTotal += amount;
      const summary = order.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ');
      lines.push({
        sourceType: 'FOOD_ORDER',
        sourceId: order.id,
        description: summary || 'Food & beverage',
        category: 'FOOD',
        quantity: 1,
        unitPrice: amount,
        total: amount,
      });
      continue;
    }

    // Already settled at the restaurant, or cancelled — never billed here.
    if (order.paymentStatus === 'PAID' || order.status === 'CANCELLED') continue;

    if ((UNDELIVERED_FOOD_STATUSES as readonly string[]).includes(order.status)) {
      warnings.push({
        kind: 'UNDELIVERED_FOOD',
        sourceId: order.id,
        description: `Order ${order.status.toLowerCase()}`,
        amount,
      });
    }
  }
  foodTotal = round2(foodTotal);

  // ── Extras ──────────────────────────────────────────────────────────────
  // Minibar, laundry, vehicle rental, damages — and, once built, early/late
  // check-out fees and airport transfers. Every charge source funnels here.
  let extrasTotal = 0;
  for (const extra of booking.invoiceExtras) {
    const total = round2(extra.amount * extra.quantity);
    extrasTotal += total;
    lines.push({
      sourceType: 'EXTRA',
      sourceId: extra.id,
      description: extra.description,
      category: 'OTHER',
      quantity: extra.quantity,
      unitPrice: round2(extra.amount),
      total,
    });
  }
  extrasTotal = round2(extrasTotal);

  // ── Totals ──────────────────────────────────────────────────────────────
  const subtotal = round2(roomTotal + packagesTotal + foodTotal + extrasTotal);
  const discountAmount = round2(Number(booking.invoice?.discountAmt ?? 0));
  const taxRate = booking.tenant.taxRate ?? 0;
  // Tax applies after the discount, matching recalcTotals() in routes/invoices.ts.
  const taxAmount = round2(Math.max(0, subtotal - discountAmount) * (taxRate / 100));
  const grandTotal = round2(Math.max(0, subtotal - discountAmount + taxAmount));

  // `booking.paidAmount` rather than a sum over Payment rows: every payment
  // path maintains it (walk-in, check-out, record-payment, refund), it already
  // nets refunds, and it excludes gateway rows sitting in PENDING or FAILED.
  // routes/invoices.ts already treats the booking as the payment truth.
  const paidAmount = round2(Number(booking.paidAmount));

  return {
    bookingId: booking.id,
    currency: booking.tenant.currency,
    nights,
    lines,
    roomTotal,
    packagesTotal,
    foodTotal,
    extrasTotal,
    subtotal,
    discountAmount,
    taxRate,
    taxAmount,
    grandTotal,
    paidAmount,
    balanceDue: round2(Math.max(0, grandTotal - paidAmount)),
    deposit: round2(Number(booking.deposit ?? 0)),
    billedTo: booking.corporateAccountId ? 'CORPORATE' : 'GUEST',
    warnings,
  };
}

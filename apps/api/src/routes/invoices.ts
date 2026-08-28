import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import type { TenantScopedPrisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { sendEmail } from '../services/email';
import { nextDocumentNumber } from '../utils/sequence';
import type { JwtPayload } from '@resort-pro/types';
import PDFDocument from 'pdfkit';
import { matchAllTerms } from '../utils/search-terms';

/* ── helpers ─────────────────────────────────────────────────────────────── */

// Was: `findFirst`/`orderBy: desc` against a per-tenant prefix, against a
// globally-@unique invoiceNumber column — the exact same collision bug fixed
// in bookings.ts's autoCreateInvoice and corporateAccounts.ts's
// nextInvoiceNumber (two concurrent requests, or two tenants, could compute
// the identical "INV-2026-0001" and one would fail the unique constraint).
// This third copy of the bug was missed in that earlier pass because it
// lives in a route that creates invoices manually rather than automatically.
// Now uses the same atomic per-tenant counter + tenant-code-in-string scheme.
async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  return nextDocumentNumber(tenantId, tenant.slug, 'INV');
}

/** Recalculate subtotal, taxAmount, total from items + rates */
function recalcTotals(items: { quantity: number; unitPrice: number }[], taxRate: number, discountAmt: number) {
  const subtotal  = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total     = Math.max(0, subtotal + taxAmount - discountAmt);
  return { subtotal, taxAmount, total };
}

/** Update invoice totals in DB after items change */
async function syncTotals(invoiceId: string) {
  const inv   = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true },
  });
  const { subtotal, taxAmount, total } = recalcTotals(inv.items, Number(inv.taxRate), Number(inv.discountAmt));
  const aggResult  = await prisma.invoicePayment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  const paidAmount = Number(aggResult._sum.amount ?? 0);

  let status = inv.status;
  if (status !== 'CANCELLED' && status !== 'DRAFT') {
    if (paidAmount <= 0)          status = 'SENT';
    else if (paidAmount >= total) status = 'PAID';
    else                          status = 'PARTIAL';
    // overdue check
    if (status !== 'PAID' && inv.dueDate && new Date() > inv.dueDate) status = 'OVERDUE';
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, taxAmount, total, paidAmount, status },
  });
}

/**
 * Booking-linked invoices vs. the booking they came from — two payment
 * ledgers that never talked to each other. autoCreateInvoice snapshots an
 * invoice at booking-confirm time, but the day-to-day "Record Payment" flow
 * (Front Desk / BookingDetailSheet) writes straight to Booking.paidAmount —
 * it has no idea a linked Invoice row exists, so that invoice sat frozen at
 * DRAFT/0 forever regardless of how much the guest actually paid. The
 * per-booking print/PDF page (bookings/[id]/invoice) already sidesteps this
 * by reading straight from the booking's own payment fields instead of the
 * Invoice's stored ones — this applies that same "booking is the real
 * source of truth" rule here, for the Invoices list + stats.
 *
 * Never overrides CANCELLED (a cancelled invoice stays cancelled regardless
 * of what the booking's payment state looks like now). PAID/PARTIAL from
 * the booking always wins over a stale DRAFT/SENT/OVERDUE — real money
 * received should always show, even on an invoice nobody ever manually
 * "sent" through this feature. An unpaid booking never overrides an
 * existing SENT/OVERDUE — that distinction (has it been sent yet) isn't
 * something the booking has an opinion on.
 */
function withBookingPaymentTruth<T extends { status: string; paidAmount: number; bookingId: string | null }>(
  invoice: T,
  booking: { paidAmount: number; paymentStatus: string } | undefined,
): T {
  if (!booking || invoice.status === 'CANCELLED') return invoice;
  const status =
    booking.paymentStatus === 'PAID'    ? 'PAID' :
    booking.paymentStatus === 'PARTIAL' ? 'PARTIAL' :
    invoice.status;
  return { ...invoice, paidAmount: booking.paidAmount, status };
}

/** Bulk-fetch the {paidAmount, paymentStatus} of every booking referenced by
 *  `invoices`, keyed by booking id, for withBookingPaymentTruth() above. */
async function loadLinkedBookings(db: TenantScopedPrisma, invoices: { bookingId: string | null }[]) {
  const bookingIds = [...new Set(invoices.map(i => i.bookingId).filter((id): id is string => !!id))];
  if (bookingIds.length === 0) return new Map<string, { paidAmount: number; paymentStatus: string }>();
  const bookings = await db.booking.findMany({
    where: { id: { in: bookingIds } },
    select: { id: true, paidAmount: true, paymentStatus: true },
  });
  return new Map(bookings.map(b => [b.id, { paidAmount: Number(b.paidAmount), paymentStatus: b.paymentStatus }]));
}

/* ── PDF builder ─────────────────────────────────────────────────────────── */
async function buildInvoicePdf(invoiceId: string): Promise<Buffer> {
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true, payments: true, tenant: true },
  });

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const primary = '#1a6b5e';
    const accent  = '#d4a853';
    const W       = doc.page.width - 100; // usable width

    /* ── Header ── */
    doc.fontSize(22).fillColor(primary).font('Helvetica-Bold').text(inv.tenant.name, 50, 50);
    if (inv.tenant.address) doc.fontSize(9).fillColor('#666').font('Helvetica').text(inv.tenant.address, 50, 75);
    if (inv.tenant.phone)   doc.text(inv.tenant.phone,   50, 88);
    if (inv.tenant.email)   doc.text(inv.tenant.email,   50, 101);

    // INVOICE label top-right
    doc.fontSize(26).fillColor(accent).font('Helvetica-Bold').text('INVOICE', 350, 50, { width: 200, align: 'right' });
    doc.fontSize(10).fillColor('#333').font('Helvetica')
      .text(`#${inv.invoiceNumber}`, 350, 85, { width: 200, align: 'right' })
      .text(`Date: ${inv.createdAt.toLocaleDateString()}`, 350, 100, { width: 200, align: 'right' });
    if (inv.dueDate) doc.text(`Due: ${inv.dueDate.toLocaleDateString()}`, 350, 115, { width: 200, align: 'right' });

    // Status badge
    const statusColor: Record<string, string> = {
      DRAFT: '#888', SENT: '#2563eb', PAID: '#16a34a',
      PARTIAL: '#d97706', OVERDUE: '#dc2626', CANCELLED: '#888',
    };
    doc.roundedRect(400, 130, 100, 22, 4)
      .fillColor(statusColor[inv.status] ?? '#888').fill();
    doc.fontSize(9).fillColor('white').font('Helvetica-Bold')
      .text(inv.status, 400, 136, { width: 100, align: 'center' });

    /* ── Divider ── */
    doc.moveTo(50, 162).lineTo(545, 162).strokeColor('#e5e7eb').stroke();

    /* ── Bill To ── */
    doc.fontSize(9).fillColor('#888').font('Helvetica-Bold').text('BILL TO', 50, 172);
    doc.fontSize(11).fillColor('#111').font('Helvetica-Bold').text(inv.guestName, 50, 185);
    doc.fontSize(9).fillColor('#555').font('Helvetica');
    let billY = 200;
    if (inv.guestEmail) { doc.text(inv.guestEmail, 50, billY); billY += 13; }
    if (inv.guestPhone) { doc.text(inv.guestPhone, 50, billY); }

    /* ── Items table ── */
    const tableTop = 250;
    // Header row
    doc.rect(50, tableTop, W, 24).fillColor('#f3f4f6').fill();
    doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold');
    doc.text('DESCRIPTION',  58, tableTop + 8);
    doc.text('QTY',         340, tableTop + 8, { width: 40,  align: 'right' });
    doc.text('UNIT PRICE',  388, tableTop + 8, { width: 70,  align: 'right' });
    doc.text('TOTAL',       466, tableTop + 8, { width: 70,  align: 'right' });

    let rowY = tableTop + 30;
    const currency = inv.tenant.currency || 'BDT';

    inv.items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        doc.rect(50, rowY - 4, W, 20).fillColor('#fafafa').fill();
      }
      doc.fontSize(9).fillColor('#111').font('Helvetica');
      doc.text(item.description,     58, rowY, { width: 270 });
      doc.text(String(item.quantity), 340, rowY, { width: 40,  align: 'right' });
      doc.text(`${currency} ${item.unitPrice.toLocaleString()}`, 388, rowY, { width: 70,  align: 'right' });
      doc.text(`${currency} ${item.total.toLocaleString()}`,     466, rowY, { width: 70,  align: 'right' });
      rowY += 22;
    });

    /* ── Totals ── */
    rowY += 10;
    doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor('#e5e7eb').stroke();
    rowY += 14;

    const addTotalRow = (label: string, value: string, bold = false) => {
      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(bold ? '#111' : '#555')
        .text(label, 350, rowY, { width: 110, align: 'right' })
        .text(value, 466, rowY, { width: 70,  align: 'right' });
      rowY += 16;
    };

    addTotalRow('Subtotal', `${currency} ${inv.subtotal.toLocaleString()}`);
    if (inv.taxRate > 0) addTotalRow(`Tax (${inv.taxRate}%)`, `${currency} ${inv.taxAmount.toLocaleString()}`);
    if (inv.discountAmt > 0) addTotalRow('Discount', `-${currency} ${inv.discountAmt.toLocaleString()}`);
    addTotalRow('TOTAL', `${currency} ${inv.total.toLocaleString()}`, true);

    rowY += 4;
    doc.moveTo(350, rowY).lineTo(545, rowY).strokeColor('#e5e7eb').stroke();
    rowY += 12;
    addTotalRow('Paid', `${currency} ${inv.paidAmount.toLocaleString()}`);

    const outstanding = inv.total - inv.paidAmount;
    if (outstanding > 0) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626')
        .text('OUTSTANDING', 350, rowY, { width: 110, align: 'right' })
        .text(`${currency} ${outstanding.toLocaleString()}`, 466, rowY, { width: 70, align: 'right' });
      rowY += 16;
    }

    /* ── Payment history ── */
    if (inv.payments.length > 0) {
      rowY += 10;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151').text('PAYMENT HISTORY', 50, rowY);
      rowY += 14;
      inv.payments.forEach(p => {
        doc.fontSize(8).font('Helvetica').fillColor('#555')
          .text(`• ${currency} ${p.amount.toLocaleString()} — ${p.method}${p.reference ? ` (${p.reference})` : ''}   ${p.paidAt.toLocaleDateString()}`,
            58, rowY);
        rowY += 13;
      });
    }

    /* ── Notes ── */
    if (inv.notes) {
      rowY += 10;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151').text('NOTES', 50, rowY);
      rowY += 13;
      doc.fontSize(8).font('Helvetica').fillColor('#555').text(inv.notes, 50, rowY, { width: W });
    }

    /* ── Footer ── */
    doc.fontSize(8).fillColor('#aaa').font('Helvetica')
      .text('Thank you for choosing us!', 50, doc.page.height - 60, { align: 'center', width: W });

    doc.end();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Route registration
═══════════════════════════════════════════════════════════════════════════ */
export async function invoicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /* ── GET /api/invoices ─────────────────────────────────────────────────── */
  app.get('/', {
    schema: { tags: ['invoices'], summary: 'List invoices', security: [{ bearerAuth: [] }] },
    handler: async (request, reply) => {
      const { db } = request;
      const { page, limit } = parsePageParams(request.query as Record<string, string>);
      const q = request.query as Record<string, string>;

      // NOT filtering by q.status at the DB level — a booking-linked
      // invoice's real status can differ from its stored one (see
      // withBookingPaymentTruth), so the status filter has to apply after
      // that override, not before it. Search stays DB-side; it's unrelated.
      const where: Record<string, unknown> = {};
      // Per-term, so a full guest name matches the snapshot on the invoice.
      Object.assign(where, matchAllTerms(q.search, ['invoiceNumber', 'guestName']) ?? {});

      const all = await db.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        // `booking` was missing here — the web list page's "Booking" column
        // (invoices/page.tsx) reads inv.booking.confirmationNo and falls
        // back to "Manual" whenever inv.booking is undefined, so every
        // invoice showed "Manual" regardless of whether it actually had a
        // bookingId — GET /:id already included this relation correctly,
        // this list endpoint just never did.
        include: {
          items: { select: { id: true } },
          payments: { select: { amount: true } },
          booking: { select: { confirmationNo: true } },
        },
      });

      const bookingById = await loadLinkedBookings(db, all);
      const withTruth = all.map(inv => withBookingPaymentTruth(inv, inv.bookingId ? bookingById.get(inv.bookingId) : undefined));
      const filtered  = q.status ? withTruth.filter(inv => inv.status === q.status) : withTruth;

      const total = filtered.length;
      const items = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

      return paginated(items, total, page, limit);
    },
  });

  /* ── GET /api/invoices/stats ───────────────────────────────────────────── */
  app.get('/stats', {
    schema: { tags: ['invoices'], summary: 'Invoice stats', security: [{ bearerAuth: [] }] },
    handler: async (request) => {
      const { db } = request;
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Can't do this with a plain aggregate anymore — "PAID"/"outstanding"
      // has to mean the booking-corrected status (withBookingPaymentTruth),
      // not the stored one, or these numbers would keep saying "Collected:
      // 0" for a tenant whose guests have actually paid in full via Front
      // Desk. Tenant-scale invoice counts make an in-memory pass over all of
      // them completely fine — this isn't a table scan across tenants.
      const all = await db.invoice.findMany({
        select: { id: true, bookingId: true, total: true, paidAmount: true, status: true, createdAt: true },
      });
      const bookingById = await loadLinkedBookings(db, all);
      const withTruth = all.map(inv => withBookingPaymentTruth(inv, inv.bookingId ? bookingById.get(inv.bookingId) : undefined));

      const paidRows        = withTruth.filter(i => i.status === 'PAID');
      const outstandingRows = withTruth.filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status));
      const thisMonthRows   = withTruth.filter(i => i.createdAt >= monthStart && i.createdAt <= monthEnd);

      const sum = (rows: typeof withTruth, pick: (i: typeof withTruth[number]) => number) =>
        rows.reduce((s, i) => s + pick(i), 0);

      return ok({
        totalInvoiced:  sum(withTruth, i => i.total),
        totalCount:     withTruth.length,
        collected:      sum(paidRows, i => i.total),
        paidCount:      paidRows.length,
        outstanding:    sum(outstandingRows, i => i.total - i.paidAmount),
        thisMonth:      sum(thisMonthRows, i => i.total),
        thisMonthCount: thisMonthRows.length,
      });
    },
  });

  /* ── GET /api/invoices/:id ─────────────────────────────────────────────── */
  app.get('/:id', {
    schema: { tags: ['invoices'], summary: 'Get invoice', security: [{ bearerAuth: [] }] },
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const inv = await db.invoice.findFirst({
        where: { id },
        include: { items: true, payments: true, booking: { select: { id: true, confirmationNo: true } } },
      });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      return ok(inv);
    },
  });

  /* ── POST /api/invoices/from-booking/:bookingId ────────────────────────── */
  app.post('/from-booking/:bookingId', {
    schema: { tags: ['invoices'], summary: 'Generate invoice from booking', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const { bookingId } = request.params as { bookingId: string };

      // Check no existing invoice
      const existing = await db.invoice.findFirst({ where: { bookingId } });
      if (existing) return reply.status(409).send({ success: false, error: 'Invoice already exists for this booking', data: existing });

      const booking = await db.booking.findFirst({
        where: { id: bookingId },
        include: { guest: true, room: true, invoiceExtras: true, bookingPackages: { include: { package: true } } },
      });
      if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });

      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });

      // Build line items
      const nights = Math.max(1, Math.ceil(
        (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const basePrice = Number(booking.room.basePrice);
      const roomTotal = basePrice * nights;

      const lineItems: { description: string; category: 'ROOM' | 'FOOD' | 'SERVICE' | 'LAUNDRY' | 'MINIBAR' | 'TAX' | 'DISCOUNT' | 'OTHER'; quantity: number; unitPrice: number; total: number }[] = [
        {
          description: `${booking.room.name} — ${nights} night${nights > 1 ? 's' : ''} (${new Date(booking.checkIn).toLocaleDateString()} → ${new Date(booking.checkOut).toLocaleDateString()})`,
          category:    'ROOM',
          quantity:    nights,
          unitPrice:   basePrice,
          total:       roomTotal,
        },
      ];

      // Extra charges
      booking.invoiceExtras.forEach(e => {
        const amt = Number(e.amount);
        lineItems.push({
          description: e.description,
          category:    'SERVICE',
          quantity:    e.quantity,
          unitPrice:   amt,
          total:       e.quantity * amt,
        });
      });

      // Packages
      booking.bookingPackages.forEach(bp => {
        lineItems.push({
          description: bp.package.name,
          category:    'SERVICE',
          quantity:    1,
          unitPrice:   bp.price,
          total:       bp.price,
        });
      });

      const taxRate   = tenant.taxRate ?? 0;
      const { subtotal, taxAmount, total } = recalcTotals(lineItems, taxRate, 0);
      const invoiceNumber = await nextInvoiceNumber(tenantId);

      const inv = await db.invoice.create({
        data: {
          invoiceNumber,
          bookingId,
          guestName:  `${booking.guest.firstName} ${booking.guest.lastName}`,
          guestEmail: booking.guest.email ?? undefined,
          guestPhone: booking.guest.phone ?? undefined,
          status:     'DRAFT',
          subtotal, taxRate, taxAmount, discountAmt: 0, total,
          items: { create: lineItems },
        },
        include: { items: true },
      });

      return ok(inv, 'Invoice created');
    },
  });

  /* ── POST /api/invoices (manual) ───────────────────────────────────────── */
  app.post('/', {
    schema: { tags: ['invoices'], summary: 'Create manual invoice', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = z.object({
        guestName:    z.string().min(1),
        guestEmail:   z.string().email().optional(),
        guestPhone:   z.string().optional(),
        taxRate:      z.number().min(0).max(100).optional(),
        discountAmt:  z.number().min(0).optional(),
        discountNote: z.string().optional(),
        dueDate:      z.string().optional(),
        notes:        z.string().optional(),
        bookingId:    z.string().optional(),
      }).parse(request.body);

      const taxRate    = body.taxRate ?? 0;
      const discountAmt = body.discountAmt ?? 0;
      const invoiceNumber = await nextInvoiceNumber(tenantId);

      const inv = await db.invoice.create({
        data: {
          invoiceNumber,
          guestName:    body.guestName,
          guestEmail:   body.guestEmail,
          guestPhone:   body.guestPhone,
          bookingId:    body.bookingId,
          taxRate, discountAmt,
          discountNote: body.discountNote,
          dueDate:      body.dueDate ? new Date(body.dueDate) : undefined,
          notes:        body.notes,
          subtotal: 0, taxAmount: 0, total: 0,
          status: 'DRAFT',
        },
      });

      return ok(inv, 'Invoice created');
    },
  });

  /* ── PATCH /api/invoices/:id ───────────────────────────────────────────── */
  app.patch('/:id', {
    schema: { tags: ['invoices'], summary: 'Update invoice', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        taxRate:      z.number().min(0).max(100).optional(),
        discountAmt:  z.number().min(0).optional(),
        discountNote: z.string().optional(),
        dueDate:      z.string().nullable().optional(),
        notes:        z.string().optional(),
        status:       z.enum(['DRAFT','SENT','PAID','PARTIAL','OVERDUE','CANCELLED']).optional(),
      }).parse(request.body);

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      await db.invoice.update({
        where: { id },
        data: {
          ...(body.taxRate      !== undefined && { taxRate:      body.taxRate }),
          ...(body.discountAmt  !== undefined && { discountAmt:  body.discountAmt }),
          ...(body.discountNote !== undefined && { discountNote: body.discountNote }),
          ...(body.notes        !== undefined && { notes:        body.notes }),
          ...(body.status       !== undefined && { status:       body.status }),
          ...(body.dueDate      !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        },
      });

      const updated = await syncTotals(id);
      return ok(updated, 'Invoice updated');
    },
  });

  /* ── POST /api/invoices/:id/items ──────────────────────────────────────── */
  app.post('/:id/items', {
    schema: { tags: ['invoices'], summary: 'Add line item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        description: z.string().min(1),
        category:    z.enum(['ROOM','FOOD','SERVICE','LAUNDRY','MINIBAR','TAX','DISCOUNT','OTHER']).optional(),
        quantity:    z.number().positive().optional(),
        unitPrice:   z.number(),
      }).parse(request.body);

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (inv.status === 'PAID' || inv.status === 'CANCELLED')
        return reply.status(400).send({ success: false, error: 'Cannot edit a paid or cancelled invoice' });

      const qty   = body.quantity ?? 1;
      const total = qty * body.unitPrice;

      await db.invoiceItem.create({
        data: {
          invoiceId:   id,
          description: body.description,
          category:    body.category ?? 'OTHER',
          quantity:    qty,
          unitPrice:   body.unitPrice,
          total,
        },
      });

      const updated = await syncTotals(id);
      return ok(updated, 'Item added');
    },
  });

  /* ── PATCH /api/invoices/:id/items/:itemId ─────────────────────────────── */
  app.patch('/:id/items/:itemId', {
    schema: { tags: ['invoices'], summary: 'Update line item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id, itemId } = request.params as { id: string; itemId: string };
      const body = z.object({
        description: z.string().optional(),
        category:    z.enum(['ROOM','FOOD','SERVICE','LAUNDRY','MINIBAR','TAX','DISCOUNT','OTHER']).optional(),
        quantity:    z.number().positive().optional(),
        unitPrice:   z.number().optional(),
      }).parse(request.body);

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      const item = await db.invoiceItem.findFirst({ where: { id: itemId, invoiceId: id } });
      if (!item) return reply.status(404).send({ success: false, error: 'Item not found' });

      const qty       = body.quantity  ?? item.quantity;
      const unitPrice = body.unitPrice ?? item.unitPrice;

      await db.invoiceItem.update({
        where: { id: itemId },
        data: {
          description: body.description ?? item.description,
          category:    body.category    ?? item.category,
          quantity:    qty,
          unitPrice,
          total: qty * unitPrice,
        },
      });

      const updated = await syncTotals(id);
      return ok(updated, 'Item updated');
    },
  });

  /* ── DELETE /api/invoices/:id/items/:itemId ────────────────────────────── */
  app.delete('/:id/items/:itemId', {
    schema: { tags: ['invoices'], summary: 'Remove line item', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id, itemId } = request.params as { id: string; itemId: string };

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      await db.invoiceItem.deleteMany({ where: { id: itemId, invoiceId: id } });
      const updated = await syncTotals(id);
      return ok(updated, 'Item removed');
    },
  });

  /* ── POST /api/invoices/:id/payment ────────────────────────────────────── */
  app.post('/:id/payment', {
    schema: { tags: ['invoices'], summary: 'Record payment', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        amount:    z.number().positive(),
        method:    z.enum(['CASH','CARD','BANK_TRANSFER','STRIPE','OTHER']).optional(),
        reference: z.string().optional(),
        note:      z.string().optional(),
        paidAt:    z.string().optional(),
      }).parse(request.body);

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (inv.status === 'CANCELLED')
        return reply.status(400).send({ success: false, error: 'Cannot record payment on a cancelled invoice' });

      await db.invoicePayment.create({
        data: {
          invoiceId: id,
          amount:    body.amount,
          method:    body.method ?? 'CASH',
          reference: body.reference,
          note:      body.note,
          paidAt:    body.paidAt ? new Date(body.paidAt) : new Date(),
        },
      });

      const updated = await syncTotals(id);
      return ok(updated, 'Payment recorded');
    },
  });

  /* ── POST /api/invoices/:id/send ───────────────────────────────────────── */
  app.post('/:id/send', {
    schema: { tags: ['invoices'], summary: 'Email invoice to guest', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const inv = await db.invoice.findFirst({
        where: { id },
        include: { items: true, payments: true, tenant: true },
      });
      if (!inv)           return reply.status(404).send({ success: false, error: 'Invoice not found' });
      if (!inv.guestEmail) return reply.status(400).send({ success: false, error: 'No guest email on this invoice' });

      // Build PDF
      const pdfBuffer = await buildInvoicePdf(id);
      const currency  = inv.tenant.currency || 'BDT';

      // Build email HTML
      const itemRows = inv.items.map(i =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${i.description}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:center">${i.quantity}</td>
         <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${currency} ${i.total.toLocaleString()}</td></tr>`
      ).join('');

      const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111;max-width:600px;margin:auto;padding:24px">
  <h2 style="color:#1a6b5e">${inv.tenant.name}</h2>
  <p>Dear <strong>${inv.guestName}</strong>,</p>
  <p>Please find your invoice details below. The PDF is attached.</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:0 0 4px"><strong>Invoice:</strong> #${inv.invoiceNumber}</p>
    <p style="margin:0 0 4px"><strong>Status:</strong> ${inv.status}</p>
    ${inv.dueDate ? `<p style="margin:0"><strong>Due:</strong> ${inv.dueDate.toLocaleDateString()}</p>` : ''}
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#f3f4f6">
      <th style="padding:8px;text-align:left">Description</th>
      <th style="padding:8px;text-align:center">Qty</th>
      <th style="padding:8px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="text-align:right;margin-top:12px">
    ${inv.taxRate > 0 ? `<p>Tax (${inv.taxRate}%): ${currency} ${inv.taxAmount.toLocaleString()}</p>` : ''}
    ${inv.discountAmt > 0 ? `<p>Discount: -${currency} ${inv.discountAmt.toLocaleString()}</p>` : ''}
    <p style="font-size:18px;font-weight:bold;color:#1a6b5e">Total: ${currency} ${inv.total.toLocaleString()}</p>
    ${inv.paidAmount > 0 ? `<p style="color:#16a34a">Paid: ${currency} ${inv.paidAmount.toLocaleString()}</p>` : ''}
    ${inv.total - inv.paidAmount > 0 ? `<p style="color:#dc2626;font-weight:bold">Outstanding: ${currency} ${(inv.total - inv.paidAmount).toLocaleString()}</p>` : ''}
  </div>
  ${inv.notes ? `<p style="color:#555;font-size:13px;border-top:1px solid #e5e7eb;padding-top:12px">${inv.notes}</p>` : ''}
  <p style="color:#888;font-size:12px;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px">
    Thank you for choosing ${inv.tenant.name}!<br>
    ${inv.tenant.phone ?? ''} · ${inv.tenant.email ?? ''} · ${inv.tenant.address ?? ''}
  </p>
</body></html>`;

      await sendEmail({
        to:      inv.guestEmail,
        subject: `Invoice #${inv.invoiceNumber} from ${inv.tenant.name}`,
        html,
        attachments: [{
          filename:    `${inv.invoiceNumber}.pdf`,
          content:     pdfBuffer,
          contentType: 'application/pdf',
        }],
      });

      // Mark as SENT if still DRAFT
      if (inv.status === 'DRAFT') {
        await db.invoice.update({ where: { id }, data: { status: 'SENT' } });
      }

      return ok({ sent: true }, 'Invoice emailed to guest');
    },
  });

  /* ── GET /api/invoices/:id/pdf ─────────────────────────────────────────── */
  app.get('/:id/pdf', {
    schema: { tags: ['invoices'], summary: 'Download invoice PDF', security: [{ bearerAuth: [] }] },
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      const pdfBuffer = await buildInvoicePdf(id);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${inv.invoiceNumber}.pdf"`);
      return reply.send(pdfBuffer);
    },
  });

  /* ── DELETE /api/invoices/:id ──────────────────────────────────────────── */
  app.delete('/:id', {
    schema: { tags: ['invoices'], summary: 'Cancel/delete invoice', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const inv = await db.invoice.findFirst({ where: { id } });
      if (!inv) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      if (inv.status === 'PAID') {
        return reply.status(400).send({ success: false, error: 'Cannot delete a paid invoice. Cancel it instead.' });
      }

      if (inv.paidAmount > 0) {
        // Has partial payments — soft cancel instead of delete
        await db.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
        return ok({ cancelled: true }, 'Invoice cancelled');
      }

      await db.invoice.delete({ where: { id } });
      return ok({ deleted: true }, 'Invoice deleted');
    },
  });
}

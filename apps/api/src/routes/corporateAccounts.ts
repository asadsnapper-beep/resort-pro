import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { TenantScopedPrisma } from '@resort-pro/database';

const accountSchema = z.object({
  companyName: z.string().min(1),
  billingAddress: z.string().optional(),
  taxId: z.string().optional(),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  paymentTermDays: z.number().int().min(0).default(30),
  discountPercent: z.number().min(0).max(100).default(0),
  creditLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

async function nextInvoiceNumber(db: TenantScopedPrisma): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.corporateInvoice.count({ where: { invoiceNumber: { startsWith: `CORP-${year}-` } } });
  return `CORP-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function corporateAccountRoutes(app: FastifyInstance) {
  // GET /api/corporate-accounts — list with outstanding balance
  app.get('/', {
    schema: { tags: ['corporate-accounts'], summary: 'List corporate accounts', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const accounts = await db.corporateAccount.findMany({
        where: { isActive: true },
        include: {
          invoices: { select: { totalAmount: true, paidAmount: true, status: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { companyName: 'asc' },
      });
      return ok(accounts.map((a) => {
        const outstanding = a.invoices.reduce((sum, inv) => sum + (inv.status !== 'PAID' ? inv.totalAmount - inv.paidAmount : 0), 0);
        const unpaidInvoices = a.invoices.filter((inv) => inv.status !== 'PAID').length;
        return {
          id: a.id, companyName: a.companyName, contactName: a.contactName, contactEmail: a.contactEmail,
          contactPhone: a.contactPhone, paymentTermDays: a.paymentTermDays, discountPercent: a.discountPercent,
          bookingCount: a._count.bookings, outstanding, unpaidInvoices,
        };
      }));
    },
  });

  // GET /api/corporate-accounts/active — lightweight list for booking-form dropdown
  app.get('/active', {
    schema: { tags: ['corporate-accounts'], summary: 'Active companies for booking form', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const accounts = await db.corporateAccount.findMany({
        where: { isActive: true },
        select: { id: true, companyName: true },
        orderBy: { companyName: 'asc' },
      });
      return ok(accounts);
    },
  });

  app.post('/', {
    schema: { tags: ['corporate-accounts'], summary: 'Create a corporate account', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = accountSchema.parse(request.body);
      const account = await db.corporateAccount.create({ data: body });
      return reply.status(201).send(ok(account, 'Company added'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['corporate-accounts'], summary: 'Update a corporate account', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = accountSchema.partial().parse(request.body);
      const existing = await db.corporateAccount.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Company not found' });
      const account = await db.corporateAccount.update({ where: { id }, data: body });
      return ok(account, 'Company updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['corporate-accounts'], summary: 'Deactivate a corporate account', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const existing = await db.corporateAccount.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Company not found' });
      await db.corporateAccount.update({ where: { id }, data: { isActive: false } });
      return ok(null, 'Company removed');
    },
  });

  // GET /api/corporate-accounts/:id/bookings — uninvoiced + invoiced bookings
  app.get('/:id/bookings', {
    schema: { tags: ['corporate-accounts'], summary: 'Bookings billed to this company', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const bookings = await db.booking.findMany({
        where: { corporateAccountId: id },
        select: {
          id: true, confirmationNo: true, checkIn: true, checkOut: true, totalAmount: true,
          corporateInvoiceId: true, guest: { select: { firstName: true, lastName: true } },
          room: { select: { name: true, number: true } },
        },
        orderBy: { checkIn: 'desc' },
      });
      return ok(bookings.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) })));
    },
  });

  // GET /api/corporate-accounts/:id/invoices
  app.get('/:id/invoices', {
    schema: { tags: ['corporate-accounts'], summary: 'Invoice history for a company', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const invoices = await db.corporateInvoice.findMany({
        where: { corporateAccountId: id },
        include: { bookings: { select: { id: true, confirmationNo: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return ok(invoices);
    },
  });

  // POST /api/corporate-accounts/:id/invoices — generate invoice from selected uninvoiced bookings
  app.post('/:id/invoices', {
    schema: { tags: ['corporate-accounts'], summary: 'Generate an invoice', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({ bookingIds: z.array(z.string()).min(1) }).parse(request.body);

      const account = await db.corporateAccount.findUnique({ where: { id } });
      if (!account) return reply.status(404).send({ success: false, error: 'Company not found' });

      const bookings = await db.booking.findMany({
        where: { id: { in: body.bookingIds }, corporateAccountId: id, corporateInvoiceId: null },
      });
      if (bookings.length === 0) {
        return reply.status(400).send({ success: false, error: 'No uninvoiced bookings found for the given IDs.' });
      }

      const subtotal = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const discountAmount = subtotal * (account.discountPercent / 100);
      const totalAmount = subtotal - discountAmount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + account.paymentTermDays);

      const invoiceNumber = await nextInvoiceNumber(db);

      const invoice = await db.corporateInvoice.create({
        data: {
          corporateAccountId: id,
          invoiceNumber,
          subtotal,
          discountAmount,
          totalAmount,
          dueDate,
          status: 'DRAFT',
          bookings: { connect: bookings.map((b) => ({ id: b.id })) },
        },
      });

      return reply.status(201).send(ok(invoice, `Invoice ${invoiceNumber} generated`));
    },
  });

  // PATCH /api/corporate-accounts/invoices/:id — update status / record payment
  app.patch('/invoices/:id', {
    schema: { tags: ['corporate-accounts'], summary: 'Update invoice status or payment', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        status: z.enum(['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE']).optional(),
        paidAmount: z.number().min(0).optional(),
      }).parse(request.body);

      const existing = await db.corporateInvoice.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Invoice not found' });

      const data: Record<string, unknown> = { ...body };
      if (body.status === 'SENT' && !existing.sentAt) data.sentAt = new Date();
      if (body.status === 'PAID' && !existing.paidAt) data.paidAt = new Date();

      const invoice = await db.corporateInvoice.update({ where: { id }, data });
      return ok(invoice, 'Invoice updated');
    },
  });
}

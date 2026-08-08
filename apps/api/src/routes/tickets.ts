import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { forwardReplyToChannel } from '../services/ticketChannels';

const ticketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(['MAINTENANCE', 'HOUSEKEEPING', 'FOOD_BEVERAGE', 'BILLING', 'COMPLAINT', 'REQUEST', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  guestId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
});

export async function ticketRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['tickets'], summary: 'List support tickets', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; status?: string; priority?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = {
        ...(query.status && { status: query.status as never }),
        ...(query.priority && { priority: query.priority as never }),
      };
      const [tickets, total] = await Promise.all([
        db.supportTicket.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: {
            guest: { select: { firstName: true, lastName: true, email: true } },
            assignedTo: { select: { firstName: true, lastName: true } },
            _count: { select: { messages: true } },
          },
        }),
        db.supportTicket.count({ where }),
      ]);
      return paginated(tickets, total, page, limit);
    },
  });

  app.get('/:id', {
    schema: { tags: ['tickets'], summary: 'Get ticket with messages', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const ticket = await db.supportTicket.findFirst({
        where: { id },
        include: {
          guest: true,
          assignedTo: { select: { firstName: true, lastName: true, email: true } },
          messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { firstName: true, lastName: true } } } },
        },
      });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });
      return ok(ticket);
    },
  });

  app.post('/', {
    schema: { tags: ['tickets'], summary: 'Create support ticket', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = ticketSchema.parse(request.body);
      const ticket = await db.supportTicket.create({ data: { ...body } });
      return reply.status(201).send(ok(ticket, 'Ticket created'));
    },
  });

  app.patch('/:id/status', {
    schema: { tags: ['tickets'], summary: 'Update ticket status', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };
      const ticket = await db.supportTicket.findFirst({ where: { id } });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });
      const updated = await db.supportTicket.update({
        where: { id },
        data: { status: status as never, resolvedAt: status === 'RESOLVED' ? new Date() : null },
      });
      return ok(updated, 'Ticket updated');
    },
  });

  app.patch('/:id/assign', {
    schema: { tags: ['tickets'], summary: 'Assign ticket to staff', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const ticket = await db.supportTicket.findFirst({ where: { id } });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });
      const updated = await db.supportTicket.update({ where: { id }, data: { assignedToId: userId, status: 'IN_PROGRESS' } });
      return ok(updated, 'Ticket assigned');
    },
  });

  app.post('/:id/messages', {
    schema: { tags: ['tickets'], summary: 'Add message to ticket', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId, sub: userId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { message } = z.object({ message: z.string().min(1, 'Message cannot be empty') }).parse(request.body);

      const ticket = await db.supportTicket.findFirst({ where: { id } });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });

      const chatMessage = await db.chatMessage.create({
        data: { ticketId: id, senderId: userId, senderType: 'STAFF', message },
        include: { sender: { select: { firstName: true, lastName: true } } },
      });

      // Forward reply to guest's platform (Telegram / WhatsApp) — fire and forget
      if (ticket.source !== 'WEB' && ticket.externalChatId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { telegramBotToken: true, waApiToken: true, waPhoneNumberId: true, waEnabled: true },
        });
        if (tenant) {
          const staffName = [(chatMessage as any).sender?.firstName, (chatMessage as any).sender?.lastName].filter(Boolean).join(' ') || 'Staff';
          forwardReplyToChannel(ticket, tenant, message, staffName).catch((err) =>
            console.warn('[tickets] forwardReplyToChannel error:', err?.message),
          );
        }
      }

      return reply.status(201).send(ok(chatMessage));
    },
  });
}

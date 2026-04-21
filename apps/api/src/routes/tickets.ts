import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

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
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; status?: string; priority?: string };
      const { page, limit, skip } = parsePageParams(query);
      const where = {
        tenantId,
        ...(query.status && { status: query.status as never }),
        ...(query.priority && { priority: query.priority as never }),
      };
      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' },
          include: {
            guest: { select: { firstName: true, lastName: true, email: true } },
            assignedTo: { select: { firstName: true, lastName: true } },
            _count: { select: { messages: true } },
          },
        }),
        prisma.supportTicket.count({ where }),
      ]);
      return paginated(tickets, total, page, limit);
    },
  });

  app.get('/:id', {
    schema: { tags: ['tickets'], summary: 'Get ticket with messages', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const ticket = await prisma.supportTicket.findFirst({
        where: { id, tenantId },
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
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = ticketSchema.parse(request.body);
      const ticket = await prisma.supportTicket.create({ data: { tenantId, ...body } });
      return reply.status(201).send(ok(ticket, 'Ticket created'));
    },
  });

  app.patch('/:id/status', {
    schema: { tags: ['tickets'], summary: 'Update ticket status', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };
      const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId } });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });
      const updated = await prisma.supportTicket.update({
        where: { id },
        data: { status: status as never, resolvedAt: status === 'RESOLVED' ? new Date() : null },
      });
      return ok(updated, 'Ticket updated');
    },
  });

  app.patch('/:id/assign', {
    schema: { tags: ['tickets'], summary: 'Assign ticket to staff', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId } });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });
      const updated = await prisma.supportTicket.update({ where: { id }, data: { assignedToId: userId, status: 'IN_PROGRESS' } });
      return ok(updated, 'Ticket assigned');
    },
  });

  app.post('/:id/messages', {
    schema: { tags: ['tickets'], summary: 'Add message to ticket', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId, sub: userId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const { message } = request.body as { message: string };
      const ticket = await prisma.supportTicket.findFirst({ where: { id, tenantId } });
      if (!ticket) return reply.status(404).send({ success: false, error: 'Ticket not found' });
      const chatMessage = await prisma.chatMessage.create({
        data: { ticketId: id, senderId: userId, senderType: 'STAFF', message },
        include: { sender: { select: { firstName: true, lastName: true } } },
      });
      return reply.status(201).send(ok(chatMessage));
    },
  });
}

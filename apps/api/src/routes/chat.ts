import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

export async function chatRoutes(app: FastifyInstance) {
  // WebSocket endpoint for live chat
  app.get('/ws/:ticketId', {
    schema: { hide: true },
    websocket: true,
    preHandler: requireAuth,
    handler: async (socket, request) => {
      const { tenantId, sub: userId } = request.user as JwtPayload;
      const { ticketId } = request.params as { ticketId: string };

      const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, tenantId } });
      if (!ticket) {
        socket.send(JSON.stringify({ type: 'error', message: 'Ticket not found' }));
        socket.close();
        return;
      }

      socket.on('message', async (rawMessage) => {
        try {
          const { message } = JSON.parse(rawMessage.toString());
          if (!message?.trim()) return;

          const chatMessage = await prisma.chatMessage.create({
            data: { ticketId, senderId: userId, senderType: 'STAFF', message: message.trim() },
            include: { sender: { select: { firstName: true, lastName: true } } },
          });

          socket.send(JSON.stringify({ type: 'message', data: chatMessage }));
        } catch {
          socket.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }));
        }
      });

      socket.on('close', () => {
        app.log.info(`Chat WS closed for ticket ${ticketId}`);
      });
    },
  });

  // Get unread message count
  app.get('/unread', {
    schema: { tags: ['chat'], summary: 'Get unread message count', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const count = await prisma.chatMessage.count({
        where: { isRead: false, ticket: { tenantId } },
      });
      return ok({ unreadCount: count });
    },
  });
}

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['notifications'], summary: 'Get my notifications', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number };
      const { page, limit, skip } = parsePageParams(query);
      const where = { userId };
      const [notifications, total] = await Promise.all([
        db.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        db.notification.count({ where }),
      ]);
      return paginated(notifications, total, page, limit);
    },
  });

  app.patch('/read-all', {
    schema: { tags: ['notifications'], summary: 'Mark all notifications as read', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      await db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
      return ok(null, 'All notifications marked as read');
    },
  });

  app.patch('/:id/read', {
    schema: { tags: ['notifications'], summary: 'Mark notification as read', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { db } = request;
      const { sub: userId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const notification = await db.notification.findFirst({ where: { id, userId } });
      if (!notification) return reply.status(404).send({ success: false, error: 'Notification not found' });
      await db.notification.update({ where: { id }, data: { isRead: true } });
      return ok(null, 'Notification read');
    },
  });
}

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload, UserRole } from '@resort-pro/types';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as JwtPayload;
      if (!roles.includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: insufficient permissions' });
      }
    } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  };
}

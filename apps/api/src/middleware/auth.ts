import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload, UserRole } from '@resort-pro/types';
import { tenantPrisma } from '@resort-pro/database';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const { tenantId } = request.user as JwtPayload;
    // Refresh tokens are signed with the same secret but carry no tenantId.
    // Reject them here so they can never be used as access tokens (which would
    // otherwise fall through to an unscoped tenantPrisma call).
    if (!tenantId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
    request.db = tenantPrisma(tenantId);
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as JwtPayload;
      if (!user.tenantId || !roles.includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: insufficient permissions' });
      }
      request.db = tenantPrisma(user.tenantId);
    } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  };
}

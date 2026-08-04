import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload, UserRole } from '@resort-pro/types';
import { prisma, tenantPrisma } from '@resort-pro/database';
import { resolveTenantEntitlement } from '../utils/entitlement';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BILLING_EXEMPT_PATHS = ['/api/billing', '/api/stripe'];

function isBillingPath(request: FastifyRequest) {
  return BILLING_EXEMPT_PATHS.some((path) => request.url.startsWith(path));
}

/** Authenticate a tenant-scoped request and enforce subscription read-only mode. */
async function authenticateTenant(request: FastifyRequest, reply: FastifyReply): Promise<JwtPayload | null> {
  try {
    await request.jwtVerify();
    const user = request.user as JwtPayload;
    // Refresh tokens are signed with the same secret but carry no tenantId.
    if (!user.tenantId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return null;
    }

    if (MUTATING_METHODS.has(request.method) && !isBillingPath(request)) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { planStatus: true },
      });
      if (!tenant) {
        reply.status(401).send({ success: false, error: 'Unauthorized' });
        return null;
      }
      if (tenant.planStatus === 'past_due' || tenant.planStatus === 'canceled' || tenant.planStatus === 'incomplete') {
        reply.status(402).send({
          success: false,
          error: 'Your subscription is inactive. You can still view and export your data.',
          code: 'SUBSCRIPTION_READ_ONLY',
          upgradeRequired: true,
        });
        return null;
      }
    }

    request.db = tenantPrisma(user.tenantId);
    return user;
  } catch {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  await authenticateTenant(request, reply);
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticateTenant(request, reply);
    if (!user) return;
    if (!roles.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden: insufficient permissions' });
    }
  };
}

/** Restrict a route module to tenants whose plan (or override) enables a feature. */
export function requireFlag(flag: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticateTenant(request, reply);
    if (!user) return;

    const entitlement = await resolveTenantEntitlement(user.tenantId);
    if (!entitlement.flags[flag]) {
      return reply.status(403).send({
        success: false,
        error: 'This feature requires a higher plan.',
        code: 'PLAN_UPGRADE_REQUIRED',
        upgradeRequired: true,
      });
    }
  };
}

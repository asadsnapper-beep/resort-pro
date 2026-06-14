import type { TenantScopedPrisma } from '@resort-pro/database';

declare module 'fastify' {
  interface FastifyRequest {
    // Attached by requireAuth / requireRole after JWT verification.
    // Always tenant-scoped — never use bare `prisma` in authenticated routes.
    db: TenantScopedPrisma;
  }
}

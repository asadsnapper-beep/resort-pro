import { PrismaClient, Prisma } from '@prisma/client';
export { Prisma };

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── Tenant-scoped Prisma client ──────────────────────────────────────────────
// Returns a Prisma extension that automatically injects tenantId into every
// read (findMany, findFirst, count, aggregate) and write (create, update,
// updateMany, delete, deleteMany, upsert) operation.
//
// Usage in authenticated route handlers:
//   const db = tenantPrisma(tenantId);
//   const rooms = await db.room.findMany();          // tenantId injected
//   await db.room.create({ data: { name: '101' } }); // tenantId injected
//
// The raw `prisma` client is still exported for:
//   - Admin routes (cross-tenant queries)
//   - Public routes (/site/:slug/*)
//   - Scripts (seed, gdpr-purge, etc.)
//   - Auth routes (login needs to find user before tenantId is known)

export type TenantScopedPrisma = ReturnType<typeof tenantPrisma>;

export function tenantPrisma(tenantId: string) {
  // Fail-closed: a falsy tenantId would make Prisma treat `where: { tenantId:
  // undefined }` as "no filter", silently turning every query UNSCOPED across
  // all tenants. Never allow that — a missing tenantId is always a bug (e.g. a
  // refresh token used as an access token) and must crash, not leak.
  if (!tenantId) {
    throw new Error('tenantPrisma called without a tenantId — refusing to run unscoped queries');
  }
  return prisma.$extends({
    query: {
      $allModels: {
        // ── Reads: inject tenantId into where clause ──────────────────────
        async findMany({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async count({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (model !== 'Tenant') {
            (args as { where?: Record<string, unknown> }).where = {
              tenantId,
              ...(args as { where?: Record<string, unknown> }).where,
            };
          }
          return query(args);
        },
        // groupBy is NOT covered by aggregate/count above — without this hook,
        // db.model.groupBy(...) runs UNSCOPED and leaks every tenant's rows
        // into the aggregation. Inject tenantId into its where clause too.
        async groupBy({ model, args, query }) {
          if (model !== 'Tenant') {
            (args as { where?: Record<string, unknown> }).where = {
              tenantId,
              ...(args as { where?: Record<string, unknown> }).where,
            };
          }
          return query(args);
        },

        // ── Writes: inject tenantId into data / where ─────────────────────
        async create({ model, args, query }) {
          if (model !== 'Tenant') args.data = { tenantId, ...args.data } as typeof args.data;
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (model !== 'Tenant') {
            const data = Array.isArray(args.data) ? args.data : [args.data];
            args.data = data.map((d) => ({ tenantId, ...d })) as typeof args.data;
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async delete({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (model !== 'Tenant') args.where = { tenantId, ...args.where };
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (model !== 'Tenant') {
            args.where = { tenantId, ...args.where };
            args.create = { tenantId, ...args.create } as typeof args.create;
          }
          return query(args);
        },

        // ── findUnique: can't add tenantId to unique lookup directly,
        //    but we verify after fetch to prevent cross-tenant reads. ──────
        async findUnique({ model, args, query }) {
          const result = await query(args);
          if (model !== 'Tenant' && result && (result as { tenantId?: string }).tenantId !== tenantId) {
            return null;
          }
          return result;
        },
        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args);
          if (model !== 'Tenant' && (result as { tenantId?: string }).tenantId !== tenantId) {
            throw new Error('Record not found');
          }
          return result;
        },
      },
    },
  });
}

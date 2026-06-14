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
  return prisma.$extends({
    query: {
      $allModels: {
        // ── Reads: inject tenantId into where clause ──────────────────────
        async findMany({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async findFirstOrThrow({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async aggregate({ args, query }) {
          (args as { where?: Record<string, unknown> }).where = {
            tenantId,
            ...(args as { where?: Record<string, unknown> }).where,
          };
          return query(args);
        },

        // ── Writes: inject tenantId into data / where ─────────────────────
        async create({ args, query }) {
          args.data = { tenantId, ...args.data } as typeof args.data;
          return query(args);
        },
        async createMany({ args, query }) {
          const data = Array.isArray(args.data) ? args.data : [args.data];
          args.data = data.map((d) => ({ tenantId, ...d })) as typeof args.data;
          return query(args);
        },
        async update({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async updateMany({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async deleteMany({ args, query }) {
          args.where = { tenantId, ...args.where };
          return query(args);
        },
        async upsert({ args, query }) {
          args.where = { tenantId, ...args.where };
          args.create = { tenantId, ...args.create } as typeof args.create;
          return query(args);
        },

        // ── findUnique: can't add tenantId to unique lookup directly,
        //    but we verify after fetch to prevent cross-tenant reads. ──────
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && (result as { tenantId?: string }).tenantId !== tenantId) {
            return null;
          }
          return result;
        },
        async findUniqueOrThrow({ args, query }) {
          const result = await query(args);
          if ((result as { tenantId?: string }).tenantId !== tenantId) {
            throw new Error('Record not found');
          }
          return result;
        },
      },
    },
  });
}

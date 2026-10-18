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

type RelaxWriteArgs<T> = {
  [K in keyof T]: T[K] extends {
    create: (...args: any[]) => infer CreateRet;
  }
    ? Omit<T[K], 'create' | 'createMany' | 'update' | 'updateMany' | 'upsert'> & {
        create: (args: { data: any; select?: any; include?: any }) => CreateRet;
        createMany: (args: { data: any[]; skipDuplicates?: boolean }) => any;
        update: (args: { data: any; where: any; select?: any; include?: any }) => any;
        updateMany: (args: { data: any; where: any }) => any;
        upsert: (args: { where: any; create: any; update: any; select?: any; include?: any }) => any;
      }
    : T[K];
};

/**
 * Models that belong to a tenant through a parent rather than directly.
 *
 * They have no `tenantId` column of their own, so injecting one produced
 * `Unknown argument tenantId` — which is how the CRM's Analytics tab, adding a
 * step to a sequence, and assigning a tag to a guest all answered HTTP 500
 * (CRM QA 2026-10-07, findings 002, 003 and 006: three symptoms, one cause).
 *
 * The fix is not to skip scoping them. That would make them readable across
 * tenants, trading a loud 500 for a silent leak. Each one is scoped through
 * the relation that does carry the tenant, and on create the parent is checked
 * to belong to this tenant before the row is written.
 *
 * `relation` is the field name to filter through; `foreignKey` is the column a
 * create supplies; `parent` is the model that holds `tenantId`.
 */
const RELATION_OWNED = {
  CampaignStats: { relation: 'campaign', foreignKey: 'campaignId', parent: 'campaign' },
  SequenceStep: { relation: 'sequence', foreignKey: 'sequenceId', parent: 'sequence' },
  GuestTagRelation: { relation: 'guest', foreignKey: 'guestId', parent: 'guest' },
} as const;

type RelationOwnedModel = keyof typeof RELATION_OWNED;

const isRelationOwned = (model: string): model is RelationOwnedModel =>
  Object.prototype.hasOwnProperty.call(RELATION_OWNED, model);

function createTenantPrisma(tenantId: string) {
  /** The `where` fragment that scopes a model to this tenant. */
  const scopeFor = (model: string): Record<string, unknown> => {
    if (isRelationOwned(model)) {
      return { [RELATION_OWNED[model].relation]: { tenantId } };
    }
    return { tenantId };
  };

  /**
   * Before writing a relation-owned row, prove its parent is ours.
   *
   * Without this, a create would be the one unscoped hole left: nothing in the
   * row names a tenant, so `SequenceStep.create({ sequenceId })` would happily
   * attach a step to another resort's sequence.
   */
  const assertParentBelongsToTenant = async (model: RelationOwnedModel, data: unknown) => {
    const { foreignKey, parent } = RELATION_OWNED[model];
    const rows = Array.isArray(data) ? data : [data];

    for (const row of rows) {
      const parentId = (row as Record<string, unknown>)?.[foreignKey];
      if (typeof parentId !== 'string') {
        throw new Error(`${model} needs ${foreignKey} to know which tenant it belongs to`);
      }
      const owner = await (prisma as unknown as Record<string, {
        findFirst: (a: unknown) => Promise<unknown>;
      }>)[parent].findFirst({ where: { id: parentId, tenantId }, select: { id: true } });

      if (!owner) {
        throw new Error(`${model}: ${foreignKey} ${parentId} does not belong to this tenant`);
      }
    }
  };

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
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async count({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (model !== 'Tenant') {
            (args as { where?: Record<string, unknown> }).where = {
              ...scopeFor(model),
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
              ...scopeFor(model),
              ...(args as { where?: Record<string, unknown> }).where,
            };
          }
          return query(args);
        },

        // ── Writes: inject tenantId into data / where ─────────────────────
        async create({ model, args, query }) {
          if (isRelationOwned(model)) {
            await assertParentBelongsToTenant(model, args.data);
          } else if (model !== 'Tenant') {
            args.data = { tenantId, ...args.data } as typeof args.data;
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (isRelationOwned(model)) {
            await assertParentBelongsToTenant(model, args.data);
          } else if (model !== 'Tenant') {
            const data = Array.isArray(args.data) ? args.data : [args.data];
            args.data = data.map((d) => ({ tenantId, ...d })) as typeof args.data;
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async delete({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (model !== 'Tenant') args.where = { ...scopeFor(model), ...args.where };
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (isRelationOwned(model)) {
            args.where = { ...scopeFor(model), ...args.where };
            await assertParentBelongsToTenant(model, args.create);
          } else if (model !== 'Tenant') {
            args.where = { tenantId, ...args.where };
            args.create = { tenantId, ...args.create } as typeof args.create;
          }
          return query(args);
        },

        // ── findUnique: tenantId cannot be added to a unique lookup, so the
        //    row is fetched and then checked. ────────────────────────────────
        //
        // The check reads `result.tenantId`, which means a caller's `select`
        // that does not ask for `tenantId` used to compare `undefined` against
        // it and return null for a row that exists. It failed safe, so it was
        // never a leak — it was worse to find: `db.ratePlan.findUnique({ where,
        // select: { id: true } })` answered "not found" for a rate plan sitting
        // in the table, and the same for loyalty accounts, training sessions,
        // purchase orders and a resort's saved payment credentials, where it
        // quietly broke the merge that protects unretyped secrets.
        //
        // So tenantId is added to the select when the caller left it out, and
        // removed again before the row is handed back — the guard keeps its
        // field and the caller still gets exactly what it asked for.
        async findUnique({ model, args, query }) {
          if (model === 'Tenant') return query(args);
          const select = (args as { select?: Record<string, unknown> }).select;
          const borrowed = !!select && !select.tenantId;
          if (borrowed && select) select.tenantId = true;

          const result = await query(args) as { tenantId?: string } | null;
          if (!result) return result;
          if (result.tenantId !== tenantId) return null;
          if (borrowed) delete result.tenantId;
          return result;
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (model === 'Tenant') return query(args);
          const select = (args as { select?: Record<string, unknown> }).select;
          const borrowed = !!select && !select.tenantId;
          if (borrowed && select) select.tenantId = true;

          const result = await query(args) as { tenantId?: string };
          if (result.tenantId !== tenantId) throw new Error('Record not found');
          if (borrowed) delete result.tenantId;
          return result;
        },
      },
    },
  });
}

export type TenantScopedPrisma = RelaxWriteArgs<ReturnType<typeof createTenantPrisma>>;

export function tenantPrisma(tenantId: string): TenantScopedPrisma {
  return createTenantPrisma(tenantId) as unknown as TenantScopedPrisma;
}

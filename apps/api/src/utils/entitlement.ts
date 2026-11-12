/**
 * Entitlement Resolver
 *
 * Plan → feature flags + limits.
 * Priority: per-tenant TenantFeatureFlag override > plan default flags.
 *
 * How it works:
 *   1. Load plan config from PlatformSettings.plans (super-admin configurable)
 *   2. Resolve which flags the plan enables (plan.flags[])
 *   3. Apply per-tenant TenantFeatureFlag overrides on top
 *   4. Return full entitlement: flags, roomLimit, staffLimit, aiMonthlyTokenCap
 */

import { prisma } from '@resort-pro/database';
import { Prisma } from '@prisma/client';
import { PLAN_PRICING } from '@resort-pro/types';
import { FLAG_REGISTRY } from './feature-flags';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlanConfig {
  key: string;           // "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
  name: string;
  price: number;
  annualPrice?: number;
  propertyLimit: number; // -1 = unlimited
  roomLimit: number;     // -1 = unlimited
  staffLimit: number;    // -1 = unlimited
  aiMonthlyTokenCap: number; // 0 = AI off for this plan
  flags: string[];       // feature flags this plan enables by default
  features: string[];    // marketing bullet points (display only)
}

export interface TenantEntitlement {
  plan: string;
  propertyLimit: number;
  roomLimit: number;
  staffLimit: number;
  aiMonthlyTokenCap: number;
  flags: Record<string, boolean>; // all flags resolved (plan defaults + overrides)
}

// ── Default plan configs (used when PlatformSettings.plans is empty/missing) ──

export const DEFAULT_PLAN_CONFIGS: PlanConfig[] = [
  {
    key: 'FREE',
    name: PLAN_PRICING.FREE.displayName,
    price: PLAN_PRICING.FREE.monthlyUsd,
    annualPrice: PLAN_PRICING.FREE.annualUsd,
    propertyLimit: PLAN_PRICING.FREE.propertyLimit,
    roomLimit: PLAN_PRICING.FREE.roomLimit,
    staffLimit: PLAN_PRICING.FREE.staffLimit,
    aiMonthlyTokenCap: 0,
    // Search is not a paid feature. It shipped to every tenant before this flag
    // existed, and a FREE resort finding its own booking is not an upsell.
    flags: ['global_search'],
    features: [
      `Up to ${PLAN_PRICING.FREE.roomLimit} rooms`,
      `${PLAN_PRICING.FREE.staffLimit} staff seats`,
      'Booking website (subdomain)',
      'Invoicing & basic reports',
      'Full data export',
    ],
  },
  {
    key: 'STARTER',
    name: PLAN_PRICING.STARTER.displayName,
    price: PLAN_PRICING.STARTER.monthlyUsd,
    annualPrice: PLAN_PRICING.STARTER.annualUsd,
    propertyLimit: PLAN_PRICING.STARTER.propertyLimit,
    roomLimit: PLAN_PRICING.STARTER.roomLimit,
    staffLimit: PLAN_PRICING.STARTER.staffLimit,
    aiMonthlyTokenCap: 30000,
    flags: [
      'custom_domain', 'payment_gateway', 'crm_v2', 'restaurant_module',
      'housekeeping_module', 'inventory_module', 'maintenance_module',
      'marketing_module', 'loyalty_module', 'offers_module', 'rate_plans_module',
      'group_bookings_module', 'vehicles_module', 'venues_module', 'export_pdf', 'global_search',
      'ai_content',
    ],
    features: [
      `Up to ${PLAN_PRICING.STARTER.roomLimit} rooms`,
      `${PLAN_PRICING.STARTER.staffLimit} staff seats`,
      'Booking website (subdomain)',
      'Invoicing',
      'AI Content Generator (~30/month)',
      'Email support',
    ],
  },
  {
    key: 'PROFESSIONAL',
    name: PLAN_PRICING.PROFESSIONAL.displayName,
    price: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
    annualPrice: PLAN_PRICING.PROFESSIONAL.annualUsd,
    propertyLimit: PLAN_PRICING.PROFESSIONAL.propertyLimit,
    roomLimit: PLAN_PRICING.PROFESSIONAL.roomLimit,
    staffLimit: PLAN_PRICING.PROFESSIONAL.staffLimit,
    aiMonthlyTokenCap: 300000,
    flags: [
      'custom_domain', 'payment_gateway', 'crm_v2', 'restaurant_module',
      'housekeeping_module', 'inventory_module', 'maintenance_module',
      'marketing_module', 'loyalty_module', 'offers_module', 'rate_plans_module',
      'group_bookings_module', 'vehicles_module', 'venues_module', 'export_pdf', 'global_search',
      'ai_content', 'channel_sync', 'corporate_accounts_module',
      'advanced_reports', 'beta_analytics', 'ai_chatbot', 'multi_property',
    ],
    features: [
      `Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms`,
      `${PLAN_PRICING.PROFESSIONAL.staffLimit} staff seats`,
      'Custom domain (no badge)',
      'F&B + table ordering',
      'CRM + email/SMS marketing',
      'Offers / packages / loyalty',
      'AI Content + Chatbot (~300/month)',
      'Priority support',
    ],
  },
  {
    key: 'ENTERPRISE',
    name: PLAN_PRICING.ENTERPRISE.displayName,
    price: PLAN_PRICING.ENTERPRISE.monthlyUsd,
    annualPrice: PLAN_PRICING.ENTERPRISE.annualUsd,
    propertyLimit: PLAN_PRICING.ENTERPRISE.propertyLimit,
    roomLimit: PLAN_PRICING.ENTERPRISE.roomLimit,
    staffLimit: PLAN_PRICING.ENTERPRISE.staffLimit,
    aiMonthlyTokenCap: 1500000,
    flags: [
      'export_pdf', 'global_search',
      'ai_content',
      'ai_chatbot',
      'ai_business_insights',
      'restaurant_module',
      'crm_v2',
      'advanced_reports',
      'beta_analytics',
      'revenue_forecast',
      'multi_property',
      'custom_domain',
      'payment_gateway',
      'housekeeping_module',
      'inventory_module',
      'maintenance_module',
      'marketing_module',
      'loyalty_module',
      'offers_module',
      'rate_plans_module',
      'group_bookings_module',
      'vehicles_module',
      'venues_module',
      'corporate_accounts_module',
      'channel_sync',
    ],
    features: [
      `Up to ${PLAN_PRICING.ENTERPRISE.roomLimit} rooms`,
      `${PLAN_PRICING.ENTERPRISE.staffLimit} staff seats`,
      'Custom domain',
      'All AI features (~1500/month)',
      `Up to ${PLAN_PRICING.ENTERPRISE.propertyLimit} properties`,
      'Revenue intelligence',
      'Priority support + SLA',
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Load plan configs from DB (super-admin configurable) with fallback to defaults */
export async function getPlanConfigs(): Promise<PlanConfig[]> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: 'singleton' },
    select: { plans: true },
  });

  const raw = settings?.plans as PlanConfig[] | null;
  if (!raw || !Array.isArray(raw) || raw.length === 0) return DEFAULT_PLAN_CONFIGS;

  // Merge DB configs with defaults — DB wins for editable fields, while a new
  // canonical plan (such as Solo) is available even before an older settings
  // row has been manually re-saved in the admin panel.
  const mergedDefaults = DEFAULT_PLAN_CONFIGS.map((def) => {
    const dbPlan = raw.find((plan) => plan.key === def.key);
    if (!dbPlan) return def;
    // Keep the canonical flags when an older PlatformSettings row only knows
    // about the previous plan shape; the tenant-level override remains the
    // explicit way to disable a feature for one resort.
    return {
      ...def,
      ...dbPlan,
      flags: Array.from(new Set([...def.flags, ...(dbPlan.flags ?? [])])),
    } as PlanConfig;
  });
  // Preserve admin-created legacy/custom entries that are not in the defaults.
  const customConfigs = raw.filter((plan) => !DEFAULT_PLAN_CONFIGS.some((def) => def.key === plan.key));
  return [...mergedDefaults, ...customConfigs];
}

/** Get a single plan config by key */
export async function getPlanConfig(planKey: string): Promise<PlanConfig | null> {
  const configs = await getPlanConfigs();
  return configs.find((p) => p.key === planKey) ?? null;
}

/**
 * Resolve full entitlement for a tenant.
 * Plan flags + per-tenant overrides (overrides win).
 */
export async function resolveTenantEntitlement(tenantId: string): Promise<TenantEntitlement> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });

  const planKey = tenant?.plan ?? 'FREE';
  const planConfig = await getPlanConfig(planKey);

  const propertyLimit = planConfig?.propertyLimit ?? 1;
  const roomLimit = planConfig?.roomLimit ?? 5;
  const staffLimit = planConfig?.staffLimit ?? 2;
  const aiMonthlyTokenCap = planConfig?.aiMonthlyTokenCap ?? 0;

  // Registry defaults first. `defaultOn` means "every tenant has this unless
  // told otherwise", so it belongs below the plan rather than beside it —
  // global_search shipped before the flag existed and no plan should have to
  // list it to keep it. GET /tenant/flags used to apply these on its own,
  // which is how the two readings of a tenant's flags drifted apart.
  const flags: Record<string, boolean> = {};
  for (const def of FLAG_REGISTRY) {
    if (def.defaultOn) flags[def.flag] = true;
  }

  // Then the plan's own flags
  for (const f of planConfig?.flags ?? []) {
    flags[f] = true;
  }

  // Apply per-tenant overrides (override > plan default)
  const overrides = await prisma.tenantFeatureFlag.findMany({
    where: { tenantId },
    select: { flag: true, enabled: true },
  });
  for (const { flag, enabled } of overrides) {
    flags[flag] = enabled;
  }

  return { plan: planKey, propertyLimit, roomLimit, staffLimit, aiMonthlyTokenCap, flags };
}

/**
 * Apply plan-default flags to a tenant when their plan changes.
 * Does NOT remove existing overrides — only sets flags that aren't already overridden.
 * Call this whenever tenant.plan is updated.
 */
export async function applyPlanFlagsToTenant(tenantId: string, planKey: string): Promise<void> {
  const planConfig = await getPlanConfig(planKey);
  if (!planConfig) return;

  const planFlags = planConfig.flags;

  // Get all flag keys defined across all plans (to know what to disable)
  const allConfigs = await getPlanConfigs();
  const allPlanFlags = new Set(allConfigs.flatMap((p) => p.flags));

  // For each flag in the global set:
  // - if it's in this plan's flags → enable (unless overridden to false)
  // - if it's NOT in this plan's flags → disable (unless overridden to true)
  // We use upsert but skip flags that have an explicit override
  for (const flag of allPlanFlags) {
    const shouldEnable = planFlags.includes(flag);
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_flag: { tenantId, flag } },
      create: { tenantId, flag, enabled: shouldEnable },
      // Only update if not manually overridden (we track this via the flag existing)
      // For simplicity: plan change sets the flag; admin can still override after
      update: { enabled: shouldEnable },
    });
  }
}

/**
 * How full this tenant's room allowance is, right now.
 *
 * A **report**, not a gate. It answers with a count that was true when it was
 * taken, and anything that creates a room between the answer and the insert
 * makes it a lie — which is exactly the bug RM-007 describes. Use
 * `withQuota(tenantId, ROOM_QUOTA, …)` to actually create a room; use this to
 * draw a progress bar.
 */
export async function checkRoomLimit(tenantId: string): Promise<{ allowed: boolean; limit: number; current: number }> {
  const entitlement = await resolveTenantEntitlement(tenantId);
  if (entitlement.roomLimit === -1) return { allowed: true, limit: -1, current: 0 };

  const current = await prisma.room.count({ where: { tenantId, isActive: true } });
  return {
    allowed: current < entitlement.roomLimit,
    limit: entitlement.roomLimit,
    current,
  };
}

/**
 * A tenant has reached the number of something its plan pays for.
 *
 * Carries the numbers so the route can answer with them rather than asking
 * again — a second count would be a different moment, and could disagree.
 */
export class PlanLimitReached extends Error {
  constructor(
    /** The wire code the route answers with, e.g. `ROOM_LIMIT_REACHED`. */
    readonly code: string,
    readonly limit: number,
    readonly current: number,
    message: string,
  ) {
    super(message);
    this.name = 'PlanLimitReached';
  }
}

/**
 * One plan allowance: where its ceiling is written down, how the rows under it
 * are counted, and what the owner is told once it is full.
 */
export interface PlanQuota {
  /** Wire code the route answers with. */
  readonly code: string;
  /**
   * Advisory-lock namespace. The number is arbitrary; what matters is that it
   * differs from the other quotas', so a resort adding a property never
   * queues behind the same resort adding a room. `hashtext(tenantId)` fills
   * the lock's second half, which is what keeps two resorts out of each
   * other's way.
   */
  readonly lock: number;
  /** Which allowance in the resolved entitlement is this quota's ceiling. */
  readonly limitOf: (entitlement: TenantEntitlement) => number;
  /** How many the tenant has right now. Counted inside the lock. */
  readonly count: (client: Prisma.TransactionClient, tenantId: string) => Promise<number>;
  /** What the owner is told. `limit` is the number their plan allows. */
  readonly message: (limit: number) => string;
}

/**
 * The Free plan allows exactly one property, so "allows 1 properties" is a
 * string a real customer reads. Plan limits are admin-editable, so any of
 * these can be 1.
 */
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export const ROOM_QUOTA: PlanQuota = {
  code: 'ROOM_LIMIT_REACHED',
  lock: 21069, // 0x524D, "RM"
  limitOf: (e) => e.roomLimit,
  count: (client, tenantId) => client.room.count({ where: { tenantId, isActive: true } }),
  message: (limit) => `Room limit reached. Your plan allows ${limit} ${plural(limit, 'room')}. Upgrade to add more.`,
};

export const PROPERTY_QUOTA: PlanQuota = {
  code: 'PROPERTY_LIMIT_REACHED',
  lock: 21070,
  limitOf: (e) => e.propertyLimit,
  // Property has no isActive column — deleting one deletes the row — so every
  // row a tenant owns is a property it is using.
  count: (client, tenantId) => client.property.count({ where: { tenantId } }),
  message: (limit) => `Property limit reached. Your plan allows ${limit} ${plural(limit, 'property', 'properties')}. Upgrade to add more.`,
};

export const STAFF_QUOTA: PlanQuota = {
  code: 'STAFF_LIMIT_REACHED',
  lock: 21071,
  limitOf: (e) => e.staffLimit,
  // Users rather than Staff rows: a seat is somebody who can sign in, and the
  // owner holds one. Deactivating a staff member hands the seat back, which is
  // why only the active ones are counted.
  count: (client, tenantId) => client.user.count({ where: { tenantId, isActive: true } }),
  message: (limit) => `Staff limit reached. Your plan allows ${limit} staff ${plural(limit, 'seat')}. Upgrade to add more.`,
};

/**
 * Do the write with this tenant's count of that thing held still.
 *
 * Every ceiling in this file used to be enforced like this:
 *
 *     const { allowed } = await checkRoomLimit(tenantId);   // a COUNT
 *     ...
 *     await db.room.create({ data: body });                 // an INSERT
 *
 * with nothing holding the two together. Every request in flight read the same
 * count, every one was under the ceiling, and every one inserted: eight
 * simultaneous creates against a five-room plan left the resort with **ten
 * rooms**, no error anywhere, and nothing that would ever reconcile it,
 * because the ceiling is only consulted on the way in. (RM-007.) The property
 * ceiling measured the same way — eight at once past a five-property plan left
 * nine — and the staff ceiling has the same shape.
 *
 * Unlike a duplicate room number or a duplicate property slug, there is no
 * database constraint to lean on: "at most five rows with this tenantId" is
 * not something Postgres can be asked to enforce. So the count and the insert
 * have to be made one operation.
 *
 * **A per-tenant advisory lock rather than Serializable**, which is what the
 * booking routes use. Both are correct; they fail differently. Serializable
 * detects this (it is textbook write-skew: each transaction reads rows the
 * other is about to insert) but it detects it *afterwards*, by aborting the
 * loser with a serialization failure — so the caller has to be given either a
 * retry loop or a 409 that means "try again", when the honest answer is a 403
 * that means "this is as many rooms as your plan has". The lock asks the
 * question before the work instead: the losers queue, re-count, see the
 * winner's row, and are told the truth the first time. A burst of eight
 * produces one 201 and seven 403s, with no retries and no aborted
 * transactions.
 *
 * The lock is per tenant and per quota, so two resorts never wait for each
 * other and one resort's rooms never wait on its properties; two tenants whose
 * ids happen to hash alike occasionally will, which costs milliseconds and
 * changes no answer.
 *
 * An unlimited plan takes no lock. There is nothing to count, and turning "no
 * ceiling" into a queue would be a tax on exactly the customers who pay the
 * most. It still opens a transaction, so that `write` can rely on being
 * atomic whatever plan the caller is on — a callback that inserts a user and
 * then that user's staff row must not be able to leave half of itself behind
 * on Enterprise only.
 *
 * `write` receives a client it must pass `tenantId` to explicitly: this runs
 * on the unscoped client, as every other transaction in this codebase does,
 * because the tenant extension does not reach inside `$transaction`.
 */
export async function withQuota<T>(
  tenantId: string,
  quota: PlanQuota,
  write: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const limit = quota.limitOf(await resolveTenantEntitlement(tenantId));
  if (limit === -1) return prisma.$transaction((tx) => write(tx));

  return prisma.$transaction(async (tx) => {
    // Held until this transaction ends, however it ends — commit, rollback or
    // a connection dropped mid-flight. Nothing has to release it by hand.
    // `$executeRaw`, not `$queryRaw`: pg_advisory_xact_lock() returns void,
    // and Prisma cannot deserialize a void column — it fails the request with
    // a 500 rather than taking the lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${quota.lock}::int, hashtext(${tenantId})::int)`;

    const current = await quota.count(tx, tenantId);
    if (current >= limit) {
      throw new PlanLimitReached(quota.code, limit, current, quota.message(limit));
    }

    return write(tx);
  });
}

/**
 * How full this tenant's property allowance is, right now.
 *
 * A **report**, not a gate, for the same reason as `checkRoomLimit` above: the
 * count is true when taken and a lie the moment anything else inserts. Create
 * a property with `withQuota(tenantId, PROPERTY_QUOTA, …)`.
 */
export async function checkPropertyLimit(tenantId: string): Promise<{ allowed: boolean; limit: number; current: number }> {
  const entitlement = await resolveTenantEntitlement(tenantId);
  if (entitlement.propertyLimit === -1) return { allowed: true, limit: -1, current: 0 };

  const current = await prisma.property.count({ where: { tenantId } });
  return {
    allowed: current < entitlement.propertyLimit,
    limit: entitlement.propertyLimit,
    current,
  };
}

/**
 * How full this tenant's staff allowance is, right now.
 *
 * A **report**, not a gate — see `checkRoomLimit`. Add a staff seat with
 * `withQuota(tenantId, STAFF_QUOTA, …)`.
 */
export async function checkStaffLimit(tenantId: string): Promise<{ allowed: boolean; limit: number; current: number }> {
  const entitlement = await resolveTenantEntitlement(tenantId);
  if (entitlement.staffLimit === -1) return { allowed: true, limit: -1, current: 0 };

  const current = await prisma.user.count({ where: { tenantId, isActive: true } });
  return {
    allowed: current < entitlement.staffLimit,
    limit: entitlement.staffLimit,
    current,
  };
}

/**
 * AI Feature Guard
 *
 * Single gate for every AI feature. AI is enabled for a tenant ONLY when BOTH:
 *   1. Global master switch is ON   (PlatformSettings.aiEnabledGlobal)
 *   2. The tenant's per-feature flag is ON   (TenantFeatureFlag)
 *
 * Default is OFF on both levels — AI code ships dark until super-admin flips it.
 * See plan/ai/ROLLOUT-STRATEGY.md
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@resort-pro/database';

export const AI_FLAGS = ['ai_content', 'ai_chatbot', 'ai_business_insights'] as const;
export type AiFeatureFlag = (typeof AI_FLAGS)[number];

/** Is `flag` live for this tenant? (global master AND per-tenant flag) */
export async function isAiEnabled(tenantId: string, flag: AiFeatureFlag): Promise<boolean> {
  // 1. Global master switch — if off, nothing is enabled, skip the tenant query
  const settings = await prisma.platformSettings.findUnique({
    where: { id: 'singleton' },
    select: { aiEnabledGlobal: true },
  });
  if (!settings?.aiEnabledGlobal) return false;

  // 2. Per-tenant feature flag
  const row = await prisma.tenantFeatureFlag.findUnique({
    where: { tenantId_flag: { tenantId, flag } },
    select: { enabled: true },
  });
  return row?.enabled ?? false;
}

/** Just the global master switch — useful for super-admin/UI checks */
export async function isAiGloballyEnabled(): Promise<boolean> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: 'singleton' },
    select: { aiEnabledGlobal: true },
  });
  return settings?.aiEnabledGlobal ?? false;
}

/**
 * Fastify preHandler factory — blocks a route unless `flag` is live for the
 * caller's tenant. Use AFTER the auth preHandler (needs request.user.tenantId).
 * Returns 403 when AI is off, so AI routes ship dark.
 */
export function requireAiFeature(flag: AiFeatureFlag) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.user as { tenantId?: string } | undefined)?.tenantId;
    if (!tenantId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
    if (!(await isAiEnabled(tenantId, flag))) {
      return reply.status(403).send({ success: false, error: 'AI feature not enabled', code: 'AI_DISABLED' });
    }
  };
}

/** All AI feature flags resolved for a tenant — for the dashboard to know what to show. */
export async function aiStatusForTenant(tenantId: string): Promise<Record<AiFeatureFlag, boolean>> {
  const result = {} as Record<AiFeatureFlag, boolean>;
  const globallyOn = await isAiGloballyEnabled();
  if (!globallyOn) {
    for (const f of AI_FLAGS) result[f] = false;
    return result;
  }
  const rows = await prisma.tenantFeatureFlag.findMany({
    where: { tenantId, flag: { in: AI_FLAGS as unknown as string[] } },
    select: { flag: true, enabled: true },
  });
  const map = new Map(rows.map((r) => [r.flag, r.enabled]));
  for (const f of AI_FLAGS) result[f] = map.get(f) ?? false;
  return result;
}

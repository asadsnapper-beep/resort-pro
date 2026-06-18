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

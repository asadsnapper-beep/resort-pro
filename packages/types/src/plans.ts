// ─── Canonical plan pricing/limits — single source of truth ───────────────────
// Every place in the app that shows a plan price, room/staff limit, or plan
// display name must import from here instead of hardcoding its own copy.
// See plan/launch-pricing-and-trial-abuse-prevention.md (locked 2026-08-04).
//
// Internal enum keys (FREE/STARTER/PROFESSIONAL/ENTERPRISE) never change —
// only the customer-facing display name and the price/limit values moved
// here. There is no $0 tier: `FREE` the enum key now maps to the paid
// "Solo" plan. `ENTERPRISE` is legacy/custom only — see `isPublic`.

export type PlanKey = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface PlanPricing {
  key: PlanKey;
  /** Customer-facing name, e.g. "Solo". Internal key (FREE etc.) never changes. */
  displayName: string;
  monthlyUsd: number;
  annualUsd: number;
  monthlyBdt: number;
  annualBdt: number;
  /** -1 = unlimited */
  propertyLimit: number;
  roomLimit: number;
  staffLimit: number;
  /** false = not shown as a self-serve public plan card (legacy/custom only). */
  isPublic: boolean;
}

/** Plan-default feature flags shared by dashboard navigation and the API. */
export const PLAN_FEATURES: Record<PlanKey, readonly string[]> = {
  FREE: [],
  STARTER: [
    'custom_domain', 'payment_gateway', 'crm_v2', 'restaurant_module',
    'housekeeping_module', 'inventory_module', 'maintenance_module',
    'marketing_module', 'loyalty_module', 'offers_module', 'rate_plans_module',
    'group_bookings_module', 'vehicles_module', 'venues_module', 'export_pdf',
    'ai_content',
  ],
  PROFESSIONAL: [
    'custom_domain', 'payment_gateway', 'crm_v2', 'restaurant_module',
    'housekeeping_module', 'inventory_module', 'maintenance_module',
    'marketing_module', 'loyalty_module', 'offers_module', 'rate_plans_module',
    'group_bookings_module', 'vehicles_module', 'venues_module', 'export_pdf',
    'ai_content', 'channel_sync', 'corporate_accounts_module',
    'advanced_reports', 'beta_analytics', 'ai_chatbot', 'multi_property',
  ],
  ENTERPRISE: [
    'custom_domain', 'payment_gateway', 'crm_v2', 'restaurant_module',
    'housekeeping_module', 'inventory_module', 'maintenance_module',
    'marketing_module', 'loyalty_module', 'offers_module', 'rate_plans_module',
    'group_bookings_module', 'vehicles_module', 'venues_module', 'export_pdf',
    'ai_content', 'channel_sync', 'corporate_accounts_module', 'advanced_reports',
    'beta_analytics', 'ai_chatbot', 'ai_business_insights', 'revenue_forecast', 'multi_property',
  ],
};

export const PLAN_PRICING: Record<PlanKey, PlanPricing> = {
  FREE: {
    key: 'FREE',
    displayName: 'Solo',
    monthlyUsd: 10,
    annualUsd: 100,
    monthlyBdt: 1000,
    annualBdt: 10000,
    propertyLimit: 1,
    roomLimit: 5,
    staffLimit: 2,
    isPublic: true,
  },
  STARTER: {
    key: 'STARTER',
    displayName: 'Independent Resort',
    monthlyUsd: 19,
    annualUsd: 190,
    monthlyBdt: 1900,
    annualBdt: 19000,
    propertyLimit: 1,
    roomLimit: 20,
    staffLimit: 20,
    isPublic: true,
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL',
    displayName: 'Resort Group',
    monthlyUsd: 59,
    annualUsd: 590,
    monthlyBdt: 5900,
    annualBdt: 59000,
    propertyLimit: 5,
    roomLimit: 200,
    staffLimit: 100,
    isPublic: true,
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    displayName: 'Enterprise (Legacy/Custom)',
    monthlyUsd: 100,
    annualUsd: 1000,
    monthlyBdt: 10000,
    annualBdt: 100000,
    propertyLimit: -1,
    roomLimit: -1,
    staffLimit: -1,
    isPublic: false,
  },
};

/** Only the plans customers can self-serve pick — for landing/plans/register. */
export const PUBLIC_PLAN_ORDER: PlanKey[] = (['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const)
  .filter((key) => PLAN_PRICING[key].isPublic);

export const PLAN_ORDER: PlanKey[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

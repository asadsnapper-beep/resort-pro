// ─── Canonical plan pricing/limits — single source of truth ───────────────────
// Every place in the app that shows a plan price, room/staff limit, or plan
// display name must import from here instead of hardcoding its own copy.
// See plan/launch-pricing-and-trial-abuse-prevention.md.
//
// Internal enum keys (STARTER/PROFESSIONAL/ENTERPRISE/FREE) are unchanged —
// only the customer-facing display name and the price/limit values moved
// here. `monthlyBdt`/`annualBdt` are bKash launch prices, pending final
// confirmation — see the plan doc's "Open decisions".

export type PlanKey = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface PlanPricing {
  key: PlanKey;
  /** Customer-facing name, e.g. "Small Resort". Internal key (STARTER etc.) never changes. */
  displayName: string;
  monthlyUsd: number;
  annualUsd: number;
  monthlyBdt: number;
  annualBdt: number;
  /** -1 = unlimited */
  propertyLimit: number;
  roomLimit: number;
  staffLimit: number;
}

export const PLAN_PRICING: Record<PlanKey, PlanPricing> = {
  FREE: {
    key: 'FREE',
    displayName: 'Free',
    monthlyUsd: 0,
    annualUsd: 0,
    monthlyBdt: 0,
    annualBdt: 0,
    propertyLimit: 1,
    roomLimit: 5,
    staffLimit: 2,
  },
  STARTER: {
    key: 'STARTER',
    displayName: 'Small Resort',
    monthlyUsd: 20,
    annualUsd: 200,
    monthlyBdt: 2000,
    annualBdt: 20000,
    propertyLimit: 1,
    roomLimit: 50,
    staffLimit: 15,
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL',
    displayName: 'Growing Resort',
    monthlyUsd: 50,
    annualUsd: 500,
    monthlyBdt: 5000,
    annualBdt: 50000,
    propertyLimit: 1,
    roomLimit: 100,
    staffLimit: 30,
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    displayName: 'Resort Group',
    monthlyUsd: 100,
    annualUsd: 1000,
    monthlyBdt: 10000,
    annualBdt: 100000,
    propertyLimit: 5,
    roomLimit: 200,
    staffLimit: 50,
  },
};

export const PLAN_ORDER: PlanKey[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

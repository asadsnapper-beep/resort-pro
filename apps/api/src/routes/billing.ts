import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '@resort-pro/database';
import { PLAN_ORDER, PLAN_PRICING, PUBLIC_PLAN_ORDER, type PlanKey } from '@resort-pro/types';
import { createAdminNotification } from '../utils/notifications';
import { applyPlanFlagsToTenant, resolveTenantEntitlement, getPlanConfigs } from '../utils/entitlement';
import { bkashGrantToken, bkashCreatePayment, bkashExecutePayment, type BkashConfig } from '../services/bkash';
import {
  GROUP_DISCOUNT_RATE, groupDiscountApplies, discounted, discountedUsd, discountedPrices,
} from '../utils/group-discount';
import { extendPeriod } from '../utils/billing-period';

// ── Stripe client ──────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

// ── Plan definitions — prices/limits from @resort-pro/types, the single
// source of truth (see plan/launch-pricing-and-trial-abuse-prevention.md) ──
export const PLANS = {
  FREE: {
    name: PLAN_PRICING.FREE.displayName,
    price: PLAN_PRICING.FREE.monthlyUsd,
    annualPrice: PLAN_PRICING.FREE.annualUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_FREE || '',
    annualPriceId: process.env.STRIPE_PRICE_FREE_ANNUAL || '',
    features: [`Up to ${PLAN_PRICING.FREE.roomLimit} rooms`, 'Booking management', 'Guest records', 'Data export'],
    roomLimit: PLAN_PRICING.FREE.roomLimit,
  },
  STARTER: {
    name: PLAN_PRICING.STARTER.displayName,
    price: PLAN_PRICING.STARTER.monthlyUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    annualPriceId: process.env.STRIPE_PRICE_STARTER_ANNUAL || '',
    features: [`Up to ${PLAN_PRICING.STARTER.roomLimit} rooms`, 'Booking management', 'Guest CRM', 'Email support'],
    roomLimit: PLAN_PRICING.STARTER.roomLimit,
  },
  PROFESSIONAL: {
    name: PLAN_PRICING.PROFESSIONAL.displayName,
    price: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_PRO || '',
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
    features: [`Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms`, 'Everything in Starter', 'Staff invites', 'Priority support', 'Advanced analytics'],
    roomLimit: PLAN_PRICING.PROFESSIONAL.roomLimit,
  },
  ENTERPRISE: {
    name: PLAN_PRICING.ENTERPRISE.displayName,
    price: PLAN_PRICING.ENTERPRISE.monthlyUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    annualPriceId: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || '',
    features: [`Up to ${PLAN_PRICING.ENTERPRISE.roomLimit} rooms`, 'Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    roomLimit: PLAN_PRICING.ENTERPRISE.roomLimit,
  },
} as const;

// ── bKash subscription pricing (BDT) ───────────────────────────────────────
// Local-payment prices for owners who pay via bKash. Env-overridable so you can
// tune without a deploy; default falls back to the canonical @resort-pro/types
// value, not an independent number.
const BKASH_PLAN_BDT: Record<keyof typeof PLANS, number> = {
  FREE: Number(process.env.BKASH_PRICE_FREE) || PLAN_PRICING.FREE.monthlyBdt,
  STARTER: Number(process.env.BKASH_PRICE_STARTER) || PLAN_PRICING.STARTER.monthlyBdt,
  PROFESSIONAL: Number(process.env.BKASH_PRICE_PRO) || PLAN_PRICING.PROFESSIONAL.monthlyBdt,
  ENTERPRISE: Number(process.env.BKASH_PRICE_ENTERPRISE) || PLAN_PRICING.ENTERPRISE.monthlyBdt,
};
// Annual is an exact figure (2 months free), not a flat percentage off.
const BKASH_PLAN_ANNUAL_BDT: Record<keyof typeof PLANS, number> = {
  FREE: Number(process.env.BKASH_PRICE_FREE_ANNUAL) || PLAN_PRICING.FREE.annualBdt,
  STARTER: Number(process.env.BKASH_PRICE_STARTER_ANNUAL) || PLAN_PRICING.STARTER.annualBdt,
  PROFESSIONAL: Number(process.env.BKASH_PRICE_PRO_ANNUAL) || PLAN_PRICING.PROFESSIONAL.annualBdt,
  ENTERPRISE: Number(process.env.BKASH_PRICE_ENTERPRISE_ANNUAL) || PLAN_PRICING.ENTERPRISE.annualBdt,
};

/** Enterprise is a negotiated/legacy plan, never a self-serve checkout target. */
function isSelfServePlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && PUBLIC_PLAN_ORDER.includes(value as PlanKey);
}

function isSelfServeUpgrade(currentPlan: PlanKey, status: string, requestedPlan: PlanKey) {
  // During initial checkout an incomplete account may pay for its selected
  // plan. Once access is active, changing to the same/lower tier belongs in
  // support/Stripe portal—not a new checkout session.
  if (!['active', 'trialing'].includes(status)) return true;
  return PLAN_ORDER.indexOf(requestedPlan) > PLAN_ORDER.indexOf(currentPlan);
}

// Platform bKash merchant account (money comes to YOU). Returns null if unset,
// so the endpoint can degrade gracefully instead of crashing.
/** Exported so theme purchases read the same platform bKash credentials
 *  rather than keeping a second copy that could drift out of sync. */
export function getPlatformBkash(): BkashConfig | null {
  const { BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD } = process.env;
  if (!BKASH_APP_KEY || !BKASH_APP_SECRET || !BKASH_USERNAME || !BKASH_PASSWORD) return null;
  return { appKey: BKASH_APP_KEY, appSecret: BKASH_APP_SECRET, username: BKASH_USERNAME, password: BKASH_PASSWORD };
}


// ── One bill for several resorts (bKash) ─────────────────────────────────────
//
// bKash has no subscriptions — every payment is a one-off that pushes a
// resort's period out. So "one combined bill" here means exactly one thing:
// one payment for the sum of what each resort owes, instead of four payments.
// Each resort keeps its own plan and its own price, discount included.
//
// Card is the other half, and it waits for a Stripe account: there the
// recurring charge belongs to Stripe, so combining means one subscription with
// a line per resort rather than a single summed payment. See
// plan/multi-resort.md §9.

interface GroupBillLine {
  tenantId: string;
  name: string;
  slug: string;
  plan: PlanKey;
  listPrice: number;
  /** What this resort actually owes — the list price less any group discount. */
  amount: number;
  currentPeriodEnd: Date | null;
}

/**
 * What one combined payment would cover.
 *
 * Suspended and deleted resorts are left out: charging for a resort nobody can
 * open would be taking money for nothing.
 */
async function groupBill(groupId: string, interval: 'month' | 'year'): Promise<
  { ok: true; lines: GroupBillLine[]; total: number } | { ok: false; code: string; error: string }
> {
  const members = await prisma.resortGroupTenant.findMany({
    where: { groupId },
    orderBy: { tenant: { createdAt: 'asc' } },
    include: {
      tenant: {
        select: {
          id: true, name: true, slug: true, plan: true,
          isActive: true, deletedAt: true, currentPeriodEnd: true,
        },
      },
    },
  });
  const payable = members.filter((m) => m.tenant.isActive && !m.tenant.deletedAt);
  if (payable.length < 2) {
    return { ok: false, code: 'NOTHING_TO_COMBINE', error: 'There is only one resort to pay for.' };
  }
  // Enterprise is negotiated by hand and has no self-serve price. Quietly
  // charging it the list figure would invent a number nobody agreed to.
  const enterprise = payable.find((m) => !isSelfServePlanKey(m.tenant.plan));
  if (enterprise) {
    return {
      ok: false, code: 'ENTERPRISE_IN_GROUP',
      error: `${enterprise.tenant.name} is on a negotiated plan. Please contact support to bill these together.`,
    };
  }

  const lines = await Promise.all(payable.map(async (m) => {
    const plan = m.tenant.plan as PlanKey;
    const listPrice = interval === 'year' ? BKASH_PLAN_ANNUAL_BDT[plan] : BKASH_PLAN_BDT[plan];
    return {
      tenantId: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      plan,
      listPrice,
      amount: discounted(listPrice, await groupDiscountApplies(m.tenant.id)),
      currentPeriodEnd: m.tenant.currentPeriodEnd,
    };
  }));

  return { ok: true, lines, total: lines.reduce((sum, l) => sum + l.amount, 0) };
}

/**
 * The group this person belongs to, from whichever resort they are in.
 *
 * Owning it is recorded against one user row, but the same person arrives in a
 * connected resort as a different row — and a combined bill that vanishes the
 * moment you switch resorts is worse than no combined bill.
 */
async function ownedGroup(userId: string, tenantId: string) {
  const owned = await prisma.resortGroup.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, name: true, payerTenantId: true },
  });
  if (owned) return owned;

  const asMember = await prisma.resortGroupTenant.findFirst({
    where: { tenantId, linkedUserId: userId },
    select: { group: { select: { id: true, name: true, payerTenantId: true } } },
  });
  return asMember?.group ?? null;
}


/**
 * A payment that was captured but could not be applied.
 *
 * Once bKash has taken the money, nothing that happens afterwards may end with
 * the payer being told their payment failed — they would go looking for a
 * refund of something the screen says never happened. So every path after
 * capture lands here instead: the payment is recorded loudly for support and
 * the payer is told the truth, which is that we have their money and are
 * sorting it out.
 */
async function paymentHeldForReview(input: {
  appUrl: string;
  trxID?: string;
  amount?: string | number;
  reason: string;
  detail: Record<string, unknown>;
}) {
  await createAdminNotification({
    type: 'subscription_paid',
    title: 'bKash payment received but NOT applied',
    message: `৳${input.amount ?? '?'} was captured (trxID ${input.trxID ?? 'unknown'}) and could not be applied: ${input.reason}. Apply it by hand or refund it.`,
    metadata: { ...input.detail, trxID: input.trxID, amount: input.amount, reason: input.reason, method: 'bkash' },
    linkPath: '/admin/billing',
  }).catch(() => { /* the alert failing must not hide the payment as well */ });

  return `${input.appUrl}/dashboard/billing?paid=1&applied=0`
    + `&ref=${encodeURIComponent(String(input.trxID ?? ''))}`
    + `&reason=${encodeURIComponent(input.reason)}`;
}

// ── Auth helper ────────────────────────────────────────────────────────────
/**
 * `ownerOnly` guards everything that can spend the resort's money or expose
 * its billing history.
 *
 * Until the 2026-09-09 sidebar QA, hiding Billing from the sidebar was the only
 * thing between a receptionist and this tenant's subscription — these routes
 * accepted any authenticated role. Typing /dashboard/billing was enough, and
 * POST /billing/portal opens Stripe's own billing portal, where a subscription
 * can be cancelled and payment methods changed. Hidden navigation is not
 * authorization.
 *
 * The role is read from the database rather than the token: a role changed
 * after a token was issued must take effect at once, and this query is already
 * being made.
 *
 * GET /status is deliberately left open to every authenticated role. The
 * dashboard layout calls it on mount for the suspension and trial-expiry gate,
 * and its failure path lets the user through — so restricting it would quietly
 * mean staff of a suspended resort carry on working. It returns plan state and
 * limits, never payment detail.
 */
async function requireAuth(request: any, reply: any, opts?: { ownerOnly?: boolean }) {
  try {
    await request.jwtVerify();
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { emailVerifiedAt: true, isActive: true, tenantId: true, role: true },
    });
    if (!user || !user.isActive || !user.emailVerifiedAt || user.tenantId !== request.user.tenantId) {
      return reply.status(403).send({
        success: false,
        error: 'Verify your email before continuing.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }
    if (opts?.ownerOnly && user.role !== 'OWNER') {
      return reply.status(403).send({
        success: false,
        error: 'Only the workspace owner can manage billing.',
        code: 'OWNER_ONLY',
      });
    }
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}

// ── Billing routes (protected) ─────────────────────────────────────────────
export async function billingRoutes(app: FastifyInstance) {
  // GET /billing/status — current plan + subscription info
  app.get('/status', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const { tenantId } = request.user as any;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        planStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        priceProtectedUntil: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        billingEmail: true,
        name: true,
        email: true,
        isActive: true,
        promotionRedemptions: {
          select: { expiresAt: true },
          orderBy: { redeemedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

    // Calculate trial days remaining
    const trialDaysLeft = tenant.trialEndsAt
      ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    const isTrialing = tenant.planStatus === 'trialing' && trialDaysLeft > 0;
    const isActive = tenant.planStatus === 'active';
    const isPastDue = tenant.planStatus === 'past_due';
    const isCanceled = tenant.planStatus === 'canceled';
    const isLaunchOffer = isTrialing && tenant.promotionRedemptions.some(
      (redemption) => redemption.expiresAt.getTime() >= Date.now()
    );

    const [entitlement, planConfigs] = await Promise.all([
      resolveTenantEntitlement(tenantId),
      getPlanConfigs(),
    ]);
    const groupPrice = await groupDiscountApplies(tenantId);
    // A card is only really discounted once the coupon exists, because Stripe
    // owns that charge. Showing a cheaper dollar price than the one about to be
    // taken is the same failure as showing a dearer one.
    const cardReady = !!process.env.STRIPE_COUPON_GROUP10;

    return reply.send({
      success: true,
      data: {
        plan: tenant.plan,
        planStatus: tenant.planStatus,
        trialDaysLeft,
        isTrialing,
        isActive,
        isPastDue,
        isCanceled,
        isLaunchOffer,
        isStripeTestMode: (process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder').startsWith('sk_test_'),
        currentPeriodEnd: tenant.currentPeriodEnd,
        trialEndsAt: tenant.trialEndsAt,
        priceProtectedUntil: tenant.priceProtectedUntil,
        tenantIsActive: tenant.isActive,
        hasStripeCustomer: !!tenant.stripeCustomerId,
        hasSubscription: !!tenant.stripeSubscriptionId,
        bkashEnabled: !!getPlatformBkash(),
        // Already discounted. Showing the list price beside a cheaper charge —
        // or the reverse — is the one thing a billing screen must never do.
        bkashPricesBdt: discountedPrices(BKASH_PLAN_BDT, groupPrice),
        groupDiscount: { applies: groupPrice, rate: GROUP_DISCOUNT_RATE, cardReady },
        entitlement: {
          propertyLimit: entitlement.propertyLimit,
          roomLimit: entitlement.roomLimit,
          staffLimit: entitlement.staffLimit,
          aiMonthlyTokenCap: entitlement.aiMonthlyTokenCap,
          flags: entitlement.flags,
        },
        // The dashboard only receives plans that an owner can choose without
        // speaking to us. Legacy/custom Enterprise stays out of self-serve UI.
        // Priced here rather than on the page, so one answer covers the card
        // price, the bKash price and whatever is actually charged.
        planConfigs: planConfigs
          .filter((plan) => isSelfServePlanKey(plan.key))
          .map((plan) => (groupPrice && cardReady
            ? {
              ...plan,
              price: discountedUsd(plan.price, true),
              ...(plan.annualPrice !== undefined && { annualPrice: discountedUsd(plan.annualPrice, true) }),
              listPrice: plan.price,
            }
            : { ...plan, listPrice: plan.price })),
      },
    });
  });

  // POST /billing/checkout — create Stripe checkout session
  app.post<{ Body: { planKey: keyof typeof PLANS; interval?: 'month' | 'year' } }>(
    '/checkout',
    async (request, reply) => {
      await requireAuth(request, reply, { ownerOnly: true });
      if (reply.sent) return;
      const { tenantId } = request.user as any;
      const { planKey, interval = 'month' } = request.body;

      if (!isSelfServePlanKey(planKey)) {
        return reply.status(400).send({ success: false, error: 'This plan is available through our team. Please contact support.' });
      }
      const plan = PLANS[planKey];
      const priceId = interval === 'year' ? plan.annualPriceId : plan.priceId;
      if (!priceId) {
        return reply.status(400).send({
          success: false,
          error: 'Payment gateway not configured. Please contact support.',
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, email: true, billingEmail: true, stripeCustomerId: true, slug: true, plan: true, planStatus: true, onboardingCompletedAt: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      if (!isSelfServeUpgrade(tenant.plan as PlanKey, tenant.planStatus, planKey)) {
        return reply.status(400).send({ success: false, error: 'Your current plan is already active. Use the billing portal or contact support to make this change.' });
      }

      const appUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // Get or create Stripe customer
      let customerId = tenant.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: tenant.billingEmail || tenant.email || undefined,
          name: tenant.name,
          metadata: { tenantId, slug: tenant.slug },
        });
        customerId = customer.id;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        });
      }

      // This endpoint serves two different moments: a brand-new tenant's
      // very first checkout right after signup (planStatus is still the
      // 'incomplete' state register() creates it with — nothing has ever
      // been paid), and an existing tenant upgrading/resubscribing later.
      // Signup now completes onboarding before checkout. Keep the fallback for
      // older/in-flight accounts that have not completed the wizard yet.
      const isFirstActivation = tenant.planStatus === 'incomplete';
      const successUrl = isFirstActivation
        ? tenant.onboardingCompletedAt
          ? `${appUrl}/dashboard/billing?success=1&plan=${planKey}&interval=${interval}`
          : `${appUrl}/onboarding?success=1&plan=${planKey}&interval=${interval}`
        : `${appUrl}/dashboard/billing?success=1&plan=${planKey}&interval=${interval}`;

      // The card half of the group price is a Stripe coupon, because Stripe
      // owns the recurring charge and a one-off discount here would be
      // forgotten at the first renewal. If the discount is due and no coupon
      // id is configured, the session is still created — refusing checkout
      // over a missing coupon would be worse — but it is logged loudly, since
      // the owner is then being charged full price for a discounted resort.
      const groupPrice = await groupDiscountApplies(tenantId);
      const groupCoupon = process.env.STRIPE_COUPON_GROUP10;
      if (groupPrice && !groupCoupon) {
        request.log.error(
          { tenantId },
          'Group discount is due but STRIPE_COUPON_GROUP10 is unset — charging full price',
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        ...(groupPrice && groupCoupon && { discounts: [{ coupon: groupCoupon }] }),
        success_url: successUrl,
        cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
        subscription_data: {
          metadata: { tenantId, planKey },
          trial_period_days: undefined, // No extra trial for paid plans
        },
        metadata: { tenantId, planKey, interval },
      });

      return reply.send({ success: true, data: { url: session.url } });
    }
  );

  // POST /billing/portal — Stripe customer portal (manage/cancel subscription)
  app.post('/portal', async (request, reply) => {
    await requireAuth(request, reply, { ownerOnly: true });
    if (reply.sent) return;
    const { tenantId } = request.user as any;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      return reply.status(400).send({
        success: false,
        error: 'No billing account found. Please subscribe to a plan first.',
      });
    }

    const appUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return reply.send({ success: true, data: { url: session.url } });
  });

  // POST /billing/checkout/bkash — start a bKash subscription payment (BDT)
  app.post<{ Body: { planKey: keyof typeof PLANS; interval?: 'month' | 'year' } }>(
    '/checkout/bkash',
    async (request, reply) => {
      await requireAuth(request, reply, { ownerOnly: true });
      if (reply.sent) return;
      const { tenantId } = request.user as any;
      const { planKey, interval = 'month' } = request.body;

      if (!isSelfServePlanKey(planKey)) {
        return reply.status(400).send({ success: false, error: 'This plan is available through our team. Please contact support.' });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true, planStatus: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });
      if (!isSelfServeUpgrade(tenant.plan as PlanKey, tenant.planStatus, planKey)) {
        return reply.status(400).send({ success: false, error: 'Your current plan is already active. Use the billing portal or contact support to make this change.' });
      }

      const cfg = getPlatformBkash();
      if (!cfg) {
        return reply.status(503).send({ success: false, error: 'bKash payments are not available yet. Please contact support.' });
      }

      const listPrice = interval === 'year' ? BKASH_PLAN_ANNUAL_BDT[planKey] : BKASH_PLAN_BDT[planKey];
      const amountNum = discounted(listPrice, await groupDiscountApplies(tenantId));
      const amount = amountNum.toFixed(2);

      // Same class of bug as file uploads: APP_URL/API_BASE_URL are often unset
      // or misnamed in production, which would silently send bKash a
      // localhost callback URL. Fall back to the actual incoming request's
      // origin (this request IS hitting the real public API domain).
      const apiUrl = process.env.API_BASE_URL || process.env.APP_URL || process.env.API_URL
        || `${request.protocol}://${request.hostname}`;
      const invoice = `SUB${Date.now().toString(36).toUpperCase()}`;
      // Metadata is carried on the callback URL and re-verified (amount + execute) on return.
      const callbackURL =
        `${apiUrl}/api/billing/bkash/callback` +
        `?tenantId=${encodeURIComponent(tenantId)}&planKey=${planKey}&interval=${interval}&amt=${amountNum}`;

      try {
        const idToken = await bkashGrantToken(cfg);
        const created = await bkashCreatePayment(cfg, idToken, {
          amount,
          currency: 'BDT',
          merchantInvoiceNumber: invoice,
          callbackURL,
        });
        return reply.send({ success: true, data: { url: created.bkashURL, paymentID: created.paymentID } });
      } catch (err: any) {
        request.log.error({ err }, 'bKash subscription create failed');
        return reply.status(502).send({ success: false, error: 'Could not start bKash payment. Please try again.' });
      }
    }
  );

  // GET /billing/bkash/callback — bKash redirects here after payment (no auth)
  app.get<{ Querystring: { paymentID?: string; status?: string; tenantId?: string; planKey?: string; interval?: string; amt?: string } }>(
    '/bkash/callback',
    async (request, reply) => {
      const appUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const { paymentID, status, tenantId, planKey, interval = 'month', amt } = request.query;
      const fail = (reason: string) => reply.redirect(`${appUrl}/dashboard/billing?canceled=1&reason=${encodeURIComponent(reason)}`);

      if (!paymentID || status !== 'success' || !tenantId || !planKey) return fail('cancelled');
      if (!isSelfServePlanKey(planKey)) return fail('invalid_plan');

      const cfg = getPlatformBkash();
      if (!cfg) return fail('not_configured');

      try {
        const idToken = await bkashGrantToken(cfg);
        const exec = await bkashExecutePayment(cfg, idToken, paymentID);
        if (exec.transactionStatus !== 'Completed') return fail('payment_incomplete');

        // Re-verify the paid amount against what we expected (guards tampered callback params)
        // Through the same helper as the charge itself. Verifying against the
        // list price would reject every group resort's payment *after* their
        // money had moved — they would have paid and been told it was wrong.
        const listPrice = interval === 'year'
          ? BKASH_PLAN_ANNUAL_BDT[planKey]
          : BKASH_PLAN_BDT[planKey];
        const expected = discounted(listPrice, await groupDiscountApplies(tenantId));
        if (expected && Math.abs(Number(exec.amount) - expected) > 0.5) return fail('amount_mismatch');

        const plan = planKey;
        const days = interval === 'year' ? 365 : 30;

        // Same "first activation → onboarding wizard, later upgrade → billing
        // page" distinction as the Stripe /checkout path — captured before
        // the update below flips planStatus to 'active'.
        const before = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { planStatus: true, onboardingCompletedAt: true, currentPeriodEnd: true },
        });
        // Through the same helper the combined bill uses. Renewing a week early
        // used to start the new period today and throw that week away.
        const periodEnd = extendPeriod(before?.currentPeriodEnd, days);
        const isFirstActivation = before?.planStatus === 'incomplete';

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan,
            planStatus: 'active',
            currentPeriodEnd: periodEnd,
            priceProtectedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        });
        await applyPlanFlagsToTenant(tenantId, plan);

        const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
        await createAdminNotification({
          type: 'subscription_paid',
          title: 'Subscription paid (bKash)',
          message: `${t?.name ?? tenantId} paid ৳${exec.amount} for ${plan} (${interval}) via bKash. trxID ${exec.trxID}.`,
          metadata: { tenantId, plan, interval, trxID: exec.trxID, amount: exec.amount, method: 'bkash' },
          linkPath: '/admin/billing',
        });

        const redirectTarget = isFirstActivation
          ? before?.onboardingCompletedAt
            ? `${appUrl}/dashboard/billing?success=1&plan=${plan}&method=bkash`
            : `${appUrl}/onboarding?success=1&plan=${plan}&method=bkash`
          : `${appUrl}/dashboard/billing?success=1&plan=${plan}&method=bkash`;
        return reply.redirect(redirectTarget);
      } catch (err: any) {
        request.log.error({ err }, 'bKash subscription callback failed');
        return fail('execute_failed');
      }
    }
  );


  // ── GET /billing/group — what one combined payment would cover ────────────
  app.get<{ Querystring: { interval?: 'month' | 'year' } }>(
    '/group',
    async (request, reply) => {
      await requireAuth(request, reply, { ownerOnly: true });
      if (reply.sent) return;
      const { sub, tenantId } = request.user as any;
      const interval = request.query.interval === 'year' ? 'year' : 'month';

      const group = await ownedGroup(sub, tenantId);
      if (!group) return reply.send({ success: true, data: null });

      const bill = await groupBill(group.id, interval);
      if (!bill.ok) {
        return reply.send({
          success: true,
          data: { groupName: group.name, payerTenantId: group.payerTenantId, available: false, reason: bill.code },
        });
      }

      return reply.send({
        success: true,
        data: {
          groupName: group.name,
          payerTenantId: group.payerTenantId,
          available: !!getPlatformBkash(),
          interval,
          currency: 'BDT',
          lines: bill.lines,
          total: bill.total,
        },
      });
    },
  );

  // ── POST /billing/checkout/bkash-group — pay for every resort at once ─────
  app.post<{ Body: { interval?: 'month' | 'year' } }>(
    '/checkout/bkash-group',
    async (request, reply) => {
      await requireAuth(request, reply, { ownerOnly: true });
      if (reply.sent) return;
      const { sub, tenantId } = request.user as any;
      const interval = request.body?.interval === 'year' ? 'year' : 'month';

      const group = await ownedGroup(sub, tenantId);
      if (!group) {
        return reply.status(404).send({
          success: false, error: 'You have no connected resorts.', code: 'NO_RESORT_GROUP',
        });
      }
      // Paying from a resort that is not in the group would leave the receipt
      // attached to an account the payment has nothing to do with.
      const inGroup = await prisma.resortGroupTenant.findFirst({
        where: { groupId: group.id, tenantId }, select: { id: true },
      });
      if (!inGroup) {
        return reply.status(403).send({
          success: false, error: 'Pay from one of the resorts in the group.',
          code: 'RESORT_NOT_CONNECTED',
        });
      }

      const bill = await groupBill(group.id, interval);
      if (!bill.ok) {
        return reply.status(400).send({ success: false, error: bill.error, code: bill.code });
      }

      const cfg = getPlatformBkash();
      if (!cfg) {
        return reply.status(503).send({ success: false, error: 'bKash payments are not available yet. Please contact support.' });
      }

      const apiUrl = process.env.API_BASE_URL || process.env.APP_URL || process.env.API_URL
        || `${request.protocol}://${request.hostname}`;
      const invoice = `GRP${Date.now().toString(36).toUpperCase()}`;
      // Only the group and the interval travel on the callback. The amount is
      // worked out again on the way back from the same helper, so a tampered
      // parameter cannot buy a year of four resorts for the price of a month.
      const callbackURL =
        `${apiUrl}/api/billing/bkash/group-callback` +
        `?groupId=${encodeURIComponent(group.id)}&interval=${interval}&payerTenantId=${encodeURIComponent(tenantId)}`;

      try {
        const idToken = await bkashGrantToken(cfg);
        const created = await bkashCreatePayment(cfg, idToken, {
          amount: bill.total.toFixed(2),
          currency: 'BDT',
          merchantInvoiceNumber: invoice,
          callbackURL,
        });
        return reply.send({
          success: true,
          data: { url: created.bkashURL, paymentID: created.paymentID, total: bill.total, resorts: bill.lines.length },
        });
      } catch (err: any) {
        request.log.error({ err }, 'bKash group subscription create failed');
        return reply.status(502).send({ success: false, error: 'Could not start bKash payment. Please try again.' });
      }
    },
  );

  // ── GET /billing/bkash/group-callback ─────────────────────────────────────
  // bKash redirects here. No auth: the payment id is the proof, and it is
  // executed and re-priced against the group before anything is written.
  app.get<{ Querystring: { paymentID?: string; status?: string; groupId?: string; interval?: string; payerTenantId?: string } }>(
    '/bkash/group-callback',
    async (request, reply) => {
      const appUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const { paymentID, status, groupId, payerTenantId } = request.query;
      const interval = request.query.interval === 'year' ? 'year' : 'month';
      const fail = (reason: string) =>
        reply.redirect(`${appUrl}/dashboard/billing?canceled=1&reason=${encodeURIComponent(reason)}`);

      if (!paymentID || status !== 'success' || !groupId) return fail('cancelled');

      const cfg = getPlatformBkash();
      if (!cfg) return fail('not_configured');

      // ── Before the money moves ────────────────────────────────────────────
      // Everything here may still answer "cancelled": nothing has been taken.
      let exec: Awaited<ReturnType<typeof bkashExecutePayment>>;
      try {
        const idToken = await bkashGrantToken(cfg);
        exec = await bkashExecutePayment(cfg, idToken, paymentID);
      } catch (err: any) {
        request.log.error({ err }, 'bKash group payment could not be executed');
        return fail('execute_failed');
      }
      if (exec.transactionStatus !== 'Completed') return fail('payment_incomplete');

      // ── The money is ours now ─────────────────────────────────────────────
      // From this line on the payer has paid. No branch below may redirect to
      // "cancelled": whatever goes wrong, they are owed either the service or
      // an honest "we have it, we are looking".
      const held = (reason: string, detail: Record<string, unknown> = {}) =>
        paymentHeldForReview({
          appUrl, trxID: exec.trxID, amount: exec.amount, reason,
          detail: { groupId, interval, payerTenantId, ...detail },
        }).then((url) => reply.redirect(url));

      const bill = await groupBill(groupId, interval).catch(() => null);
      if (!bill || !bill.ok) {
        // The group changed between checkout and coming back — a resort was
        // suspended, disconnected, or moved to a negotiated plan.
        return held('the group could no longer be priced');
      }
      if (Math.abs(Number(exec.amount) - bill.total) > 0.5) {
        return held('the amount paid no longer matches the group', { expected: bill.total });
      }

      const days = interval === 'year' ? 365 : 30;
      const now = Date.now();
      try {
        // Each resort is extended from whichever is later: now, or the end of
        // the period it has already paid for. Starting every one at "now" would
        // quietly take back days a resort had already bought.
        await prisma.$transaction(bill.lines.map((line) => prisma.tenant.update({
          where: { id: line.tenantId },
          data: {
            planStatus: 'active',
            currentPeriodEnd: extendPeriod(line.currentPeriodEnd, days, new Date(now)),
            priceProtectedUntil: new Date(now + 365 * 24 * 60 * 60 * 1000),
          },
        })));
      } catch (err: any) {
        request.log.error({ err }, 'bKash group payment captured but periods not extended');
        return held('the resorts could not be extended');
      }

      // ── Bookkeeping ───────────────────────────────────────────────────────
      // Flags, the audit row, the payer, the admin note. The payer has their
      // service; none of this may turn a paid subscription into a failure
      // message on their screen.
      try {
        for (const line of bill.lines) {
          await applyPlanFlagsToTenant(line.tenantId, line.plan);
        }
        if (payerTenantId) {
          await prisma.resortGroup.update({ where: { id: groupId }, data: { payerTenantId } });
        }
        await prisma.resortGroupEvent.create({
          data: {
            groupId, tenantId: payerTenantId ?? null, action: 'billed_together',
            metadata: { interval, total: bill.total, trxID: exec.trxID, resorts: bill.lines.length },
          },
        });
        await createAdminNotification({
          type: 'subscription_paid',
          title: 'Subscription paid (bKash, several resorts)',
          message: `৳${exec.amount} paid for ${bill.lines.length} resorts (${interval}) via bKash: ${bill.lines.map((l) => l.name).join(', ')}. trxID ${exec.trxID}.`,
          metadata: { groupId, interval, trxID: exec.trxID, amount: exec.amount, method: 'bkash', tenantIds: bill.lines.map((l) => l.tenantId) },
          linkPath: '/admin/billing',
        });
      } catch (err: any) {
        request.log.error({ err, trxID: exec.trxID }, 'bKash group payment applied, bookkeeping failed');
      }

      return reply.redirect(`${appUrl}/dashboard/billing?success=1&method=bkash&resorts=${bill.lines.length}`);
    },
  );

  // GET /billing/invoices — list recent invoices
  app.get('/invoices', async (request, reply) => {
    await requireAuth(request, reply, { ownerOnly: true });
    if (reply.sent) return;
    const { tenantId } = request.user as any;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      return reply.send({ success: true, data: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 12,
    });

    const formatted = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: (inv.amount_paid / 100).toFixed(2),
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      date: new Date(inv.created * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
    }));

    return reply.send({ success: true, data: formatted });
  });
}

// ── Stripe Webhook (raw body needed — registered separately) ───────────────
export async function stripeWebhookRoute(app: FastifyInstance) {
  // Must be added BEFORE body parsing for raw body access
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  app.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const sig = request.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
      app.log.info(`Webhook signature verification failed: ${err.message}`);
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    // Idempotency check
    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeId: event.id },
    });
    if (existing?.processed) {
      return reply.send({ received: true });
    }

    // Save event
    await prisma.stripeWebhookEvent.upsert({
      where: { stripeId: event.id },
      create: { stripeId: event.id, type: event.type, data: event.data as any },
      update: {},
    });

    try {
      await handleStripeEvent(event);
      await prisma.stripeWebhookEvent.update({
        where: { stripeId: event.id },
        data: { processed: true },
      });
    } catch (err) {
      // This used to log at info level and fall through to 200. Stripe treats
      // any 2xx as delivered and never sends that event again — so a database
      // blip, or a timeout on the subscriptions.retrieve call below, while
      // activating a subscription meant the customer had been charged and
      // their plan would never switch on, with nothing left to retry it.
      //
      // A 500 makes Stripe redeliver with backoff for days. That is safe
      // because the row above stays processed:false, and the idempotency check
      // only short-circuits events that finished.
      app.log.error({ err, eventType: event.type, eventId: event.id }, 'Stripe webhook handler failed; Stripe will retry');
      return reply.status(500).send({ received: false });
    }

    return reply.send({ received: true });
  });
}

// ── Event Handlers ─────────────────────────────────────────────────────────
async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription') {
        await handleSubscriptionCheckout(session);
      } else if (session.mode === 'payment') {
        await handleGuestPaymentSuccess(session);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      await updateSubscriptionInDb(sub);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // Read before the downgrade. This used to run after it, so the admin
      // notification always said the tenant had canceled a FREE subscription.
      const canceledTenant = await prisma.tenant.findFirst({
        where: { stripeSubscriptionId: sub.id },
        select: { id: true, name: true, slug: true, plan: true },
      });
      await prisma.tenant.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { planStatus: 'canceled', plan: 'FREE' },
      });
      // Every upgrade path syncs the feature flags; this downgrade did not, so
      // a tenant who stopped paying kept every paid module switched on —
      // per-tenant flag rows beat plan defaults, and nothing rewrote them.
      if (canceledTenant) {
        await applyPlanFlagsToTenant(canceledTenant.id, 'FREE');
      }
      await createAdminNotification({
        type: 'subscription_canceled',
        title: 'Subscription canceled',
        message: canceledTenant
          ? `${canceledTenant.name} canceled their ${canceledTenant.plan} subscription.`
          : `A subscription was canceled (Stripe ID: ${sub.id}).`,
        metadata: {
          stripeSubscriptionId: sub.id,
          ...(canceledTenant && {
            tenantId: canceledTenant.id,
            tenantName: canceledTenant.name,
            tenantSlug: canceledTenant.slug,
            plan: canceledTenant.plan,
          }),
        },
        linkPath: canceledTenant ? `/admin/tenants` : undefined,
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.subscription) {
        await prisma.tenant.updateMany({
          where: { stripeSubscriptionId: inv.subscription as string },
          data: { planStatus: 'active' },
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.subscription) {
        await prisma.tenant.updateMany({
          where: { stripeSubscriptionId: inv.subscription as string },
          data: { planStatus: 'past_due' },
        });
        const failedTenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: inv.subscription as string },
          select: { id: true, name: true, slug: true, plan: true },
        });
        const amountDue = inv.amount_due ? `$${(inv.amount_due / 100).toFixed(2)}` : 'unknown amount';
        await createAdminNotification({
          type: 'payment_failed',
          title: 'Payment failed',
          message: failedTenant
            ? `Payment of ${amountDue} failed for ${failedTenant.name} (${failedTenant.plan} plan). Account is past due.`
            : `Payment of ${amountDue} failed for a tenant. Account is past due.`,
          metadata: {
            stripeInvoiceId: inv.id,
            amountDue: inv.amount_due,
            ...(failedTenant && {
              tenantId: failedTenant.id,
              tenantName: failedTenant.name,
              tenantSlug: failedTenant.slug,
              plan: failedTenant.plan,
            }),
          },
          linkPath: failedTenant ? `/admin/billing` : undefined,
        });
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.bookingId) {
        await markBookingPaid(pi.metadata.bookingId, pi.id, Number(pi.amount) / 100);
      }
      break;
    }

    default:
      break;
  }
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const { tenantId, planKey } = session.metadata || {};
  if (!tenantId || !planKey) return;

  const planMap: Record<string, 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
    FREE: 'FREE',
    STARTER: 'STARTER',
    PROFESSIONAL: 'PROFESSIONAL',
    ENTERPRISE: 'ENTERPRISE',
  };

  const sub = session.subscription
    ? await stripe.subscriptions.retrieve(session.subscription as string)
    : null;

  const newPlan = planMap[planKey] || 'FREE';
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      plan: newPlan,
      planStatus: sub?.status || 'active',
      currentPeriodEnd: sub?.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : undefined,
      priceProtectedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Auto-apply plan feature flags
  await applyPlanFlagsToTenant(tenantId, newPlan);
}

async function updateSubscriptionInDb(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) {
    // Fallback: find by stripeSubscriptionId
    const found = await prisma.tenant.findFirst({ where: { stripeSubscriptionId: sub.id } });
    if (!found) return;
  }

  await prisma.tenant.updateMany({
    where: tenantId ? { id: tenantId } : { stripeSubscriptionId: sub.id },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: sub.customer as string,
      planStatus: sub.status,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : undefined,
    },
  });
}

async function handleGuestPaymentSuccess(session: Stripe.Checkout.Session) {
  const { bookingId } = session.metadata || {};
  if (!bookingId) return;
  const amount = (session.amount_total || 0) / 100;
  await markBookingPaid(bookingId, session.payment_intent as string, amount);
}

async function markBookingPaid(bookingId: string, stripePaymentIntentId: string, amount: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { tenantId: true, totalAmount: true, paidAmount: true },
  });
  if (!booking) return;

  const newPaid = Number(booking.paidAmount) + amount;
  const isPaid = newPaid >= Number(booking.totalAmount);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      stripePaymentIntentId,
      paidAmount: newPaid,
      paymentStatus: isPaid ? 'PAID' : 'PARTIAL',
      ...(isPaid ? { status: 'CONFIRMED', paymentGateway: 'STRIPE', gatewayTxId: stripePaymentIntentId, paidAt: new Date() } : {}),
    },
  });

  // Record payment
  await prisma.payment.create({
    data: {
      tenantId: booking.tenantId,
      bookingId,
      amount,
      method: 'STRIPE',
      status: 'PAID',
      gatewayPaymentId: stripePaymentIntentId,
      processedAt: new Date(),
    },
  });
}

// ── Guest Payment Link (used by booking routes) ────────────────────────────
export async function createGuestPaymentLink(params: {
  booking: { id: string; confirmationNo: string; totalAmount: number; tenantId: string };
  guest: { firstName: string; lastName: string; email: string };
  roomName: string;
  currency: string;
}) {
  const { booking, guest, roomName, currency } = params;
  const appUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: guest.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase() || 'usd',
          unit_amount: Math.round(booking.totalAmount * 100),
          product_data: {
            name: `Booking ${booking.confirmationNo} — ${roomName}`,
            description: `Resort stay for ${guest.firstName} ${guest.lastName}`,
          },
        },
      },
    ],
    metadata: { bookingId: booking.id, tenantId: booking.tenantId },
    success_url: `${appUrl}/pay/success?booking=${booking.confirmationNo}`,
    cancel_url: `${appUrl}/pay/cancel?booking=${booking.confirmationNo}`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
  });

  return { url: session.url!, sessionId: session.id };
}

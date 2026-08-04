import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '@resort-pro/database';
import { PLAN_PRICING } from '@resort-pro/types';
import { createAdminNotification } from '../utils/notifications';
import { applyPlanFlagsToTenant, resolveTenantEntitlement, getPlanConfigs } from '../utils/entitlement';
import { bkashGrantToken, bkashCreatePayment, bkashExecutePayment, type BkashConfig } from '../services/bkash';

// ── Stripe client ──────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

// ── Plan definitions — prices/limits from @resort-pro/types, the single
// source of truth (see plan/launch-pricing-and-trial-abuse-prevention.md) ──
export const PLANS = {
  STARTER: {
    name: PLAN_PRICING.STARTER.displayName,
    price: PLAN_PRICING.STARTER.monthlyUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    features: [`Up to ${PLAN_PRICING.STARTER.roomLimit} rooms`, 'Booking management', 'Guest CRM', 'Email support'],
    roomLimit: PLAN_PRICING.STARTER.roomLimit,
  },
  PROFESSIONAL: {
    name: PLAN_PRICING.PROFESSIONAL.displayName,
    price: PLAN_PRICING.PROFESSIONAL.monthlyUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_PRO || '',
    features: [`Up to ${PLAN_PRICING.PROFESSIONAL.roomLimit} rooms`, 'Everything in Starter', 'Staff invites', 'Priority support', 'Advanced analytics'],
    roomLimit: PLAN_PRICING.PROFESSIONAL.roomLimit,
  },
  ENTERPRISE: {
    name: PLAN_PRICING.ENTERPRISE.displayName,
    price: PLAN_PRICING.ENTERPRISE.monthlyUsd,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    features: [`Up to ${PLAN_PRICING.ENTERPRISE.roomLimit} rooms`, 'Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    roomLimit: PLAN_PRICING.ENTERPRISE.roomLimit,
  },
} as const;

// ── bKash subscription pricing (BDT) ───────────────────────────────────────
// Local-payment prices for owners who pay via bKash. Env-overridable so you can
// tune without a deploy; default falls back to the canonical @resort-pro/types
// value, not an independent number.
const BKASH_PLAN_BDT: Record<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE', number> = {
  STARTER: Number(process.env.BKASH_PRICE_STARTER) || PLAN_PRICING.STARTER.monthlyBdt,
  PROFESSIONAL: Number(process.env.BKASH_PRICE_PRO) || PLAN_PRICING.PROFESSIONAL.monthlyBdt,
  ENTERPRISE: Number(process.env.BKASH_PRICE_ENTERPRISE) || PLAN_PRICING.ENTERPRISE.monthlyBdt,
};
// Annual is an exact figure (2 months free), not a flat percentage off.
const BKASH_PLAN_ANNUAL_BDT: Record<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE', number> = {
  STARTER: Number(process.env.BKASH_PRICE_STARTER_ANNUAL) || PLAN_PRICING.STARTER.annualBdt,
  PROFESSIONAL: Number(process.env.BKASH_PRICE_PRO_ANNUAL) || PLAN_PRICING.PROFESSIONAL.annualBdt,
  ENTERPRISE: Number(process.env.BKASH_PRICE_ENTERPRISE_ANNUAL) || PLAN_PRICING.ENTERPRISE.annualBdt,
};

// Platform bKash merchant account (money comes to YOU). Returns null if unset,
// so the endpoint can degrade gracefully instead of crashing.
function getPlatformBkash(): BkashConfig | null {
  const { BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD } = process.env;
  if (!BKASH_APP_KEY || !BKASH_APP_SECRET || !BKASH_USERNAME || !BKASH_PASSWORD) return null;
  return { appKey: BKASH_APP_KEY, appSecret: BKASH_APP_SECRET, username: BKASH_USERNAME, password: BKASH_PASSWORD };
}

// ── Auth helper ────────────────────────────────────────────────────────────
async function requireAuth(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}

// ── Billing routes (protected) ─────────────────────────────────────────────
export async function billingRoutes(app: FastifyInstance) {
  // GET /billing/status — current plan + subscription info
  app.get('/status', async (request, reply) => {
    await requireAuth(request, reply);
    const { tenantId } = request.user as any;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        planStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        billingEmail: true,
        name: true,
        email: true,
        isActive: true,
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

    const [entitlement, planConfigs] = await Promise.all([
      resolveTenantEntitlement(tenantId),
      getPlanConfigs(),
    ]);

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
        currentPeriodEnd: tenant.currentPeriodEnd,
        trialEndsAt: tenant.trialEndsAt,
        tenantIsActive: tenant.isActive,
        hasStripeCustomer: !!tenant.stripeCustomerId,
        hasSubscription: !!tenant.stripeSubscriptionId,
        availablePlans: PLANS,
        bkashEnabled: !!getPlatformBkash(),
        bkashPricesBdt: BKASH_PLAN_BDT,
        entitlement: {
          roomLimit: entitlement.roomLimit,
          staffLimit: entitlement.staffLimit,
          aiMonthlyTokenCap: entitlement.aiMonthlyTokenCap,
          flags: entitlement.flags,
        },
        planConfigs,
      },
    });
  });

  // POST /billing/checkout — create Stripe checkout session
  app.post<{ Body: { planKey: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' } }>(
    '/checkout',
    async (request, reply) => {
      await requireAuth(request, reply);
      const { tenantId } = request.user as any;
      const { planKey } = request.body;

      const plan = PLANS[planKey];
      if (!plan) return reply.status(400).send({ success: false, error: 'Invalid plan' });
      if (!plan.priceId) {
        return reply.status(400).send({
          success: false,
          error: 'Payment gateway not configured. Please contact support.',
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, email: true, billingEmail: true, stripeCustomerId: true, slug: true },
      });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

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

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: plan.priceId, quantity: 1 }],
        success_url: `${appUrl}/dashboard/billing?success=1&plan=${planKey}`,
        cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
        subscription_data: {
          metadata: { tenantId, planKey },
          trial_period_days: undefined, // No extra trial for paid plans
        },
        metadata: { tenantId, planKey },
      });

      return reply.send({ success: true, data: { url: session.url } });
    }
  );

  // POST /billing/portal — Stripe customer portal (manage/cancel subscription)
  app.post('/portal', async (request, reply) => {
    await requireAuth(request, reply);
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
  app.post<{ Body: { planKey: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; interval?: 'month' | 'year' } }>(
    '/checkout/bkash',
    async (request, reply) => {
      await requireAuth(request, reply);
      const { tenantId } = request.user as any;
      const { planKey, interval = 'month' } = request.body;

      if (!PLANS[planKey]) return reply.status(400).send({ success: false, error: 'Invalid plan' });

      const cfg = getPlatformBkash();
      if (!cfg) {
        return reply.status(503).send({ success: false, error: 'bKash payments are not available yet. Please contact support.' });
      }

      const amountNum = interval === 'year' ? BKASH_PLAN_ANNUAL_BDT[planKey] : BKASH_PLAN_BDT[planKey];
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
      if (!PLANS[planKey as keyof typeof PLANS]) return fail('invalid_plan');

      const cfg = getPlatformBkash();
      if (!cfg) return fail('not_configured');

      try {
        const idToken = await bkashGrantToken(cfg);
        const exec = await bkashExecutePayment(cfg, idToken, paymentID);
        if (exec.transactionStatus !== 'Completed') return fail('payment_incomplete');

        // Re-verify the paid amount against what we expected (guards tampered callback params)
        const expected = Number(amt);
        if (expected && Math.abs(Number(exec.amount) - expected) > 0.5) return fail('amount_mismatch');

        const plan = planKey as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
        const days = interval === 'year' ? 365 : 30;
        const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        await prisma.tenant.update({
          where: { id: tenantId },
          data: { plan, planStatus: 'active', currentPeriodEnd: periodEnd },
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

        return reply.redirect(`${appUrl}/dashboard/billing?success=1&plan=${plan}&method=bkash`);
      } catch (err: any) {
        request.log.error({ err }, 'bKash subscription callback failed');
        return fail('execute_failed');
      }
    }
  );

  // GET /billing/invoices — list recent invoices
  app.get('/invoices', async (request, reply) => {
    await requireAuth(request, reply);
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
      app.log.info({ err, eventType: event.type }, 'Webhook handler error');
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
      await prisma.tenant.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { planStatus: 'canceled', plan: 'FREE' },
      });
      // Find tenant for notification context
      const canceledTenant = await prisma.tenant.findFirst({
        where: { stripeSubscriptionId: sub.id },
        select: { id: true, name: true, slug: true, plan: true },
      });
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
    STARTER: 'STARTER',
    PROFESSIONAL: 'PROFESSIONAL',
    ENTERPRISE: 'ENTERPRISE',
  };

  const sub = session.subscription
    ? await stripe.subscriptions.retrieve(session.subscription as string)
    : null;

  const newPlan = planMap[planKey] || 'STARTER';
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

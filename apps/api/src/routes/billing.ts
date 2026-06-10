import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '@resort-pro/database';
import { createAdminNotification } from '../utils/notifications';

// ── Stripe client ──────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20',
});

// ── Plan definitions ───────────────────────────────────────────────────────
export const PLANS = {
  STARTER: {
    name: 'Starter',
    price: 49,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    features: ['Up to 20 rooms', 'Booking management', 'Guest CRM', 'Email support'],
    roomLimit: 20,
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 99,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_PRO || '',
    features: ['Up to 100 rooms', 'Everything in Starter', 'Staff invites', 'Priority support', 'Advanced analytics'],
    roomLimit: 100,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 199,
    currency: 'usd',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    features: ['Unlimited rooms', 'Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    roomLimit: -1,
  },
} as const;

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

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return reply.send({ success: true, data: { url: session.url } });
  });

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

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      plan: planMap[planKey] || 'STARTER',
      planStatus: sub?.status || 'active',
      currentPeriodEnd: sub?.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : undefined,
    },
  });
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

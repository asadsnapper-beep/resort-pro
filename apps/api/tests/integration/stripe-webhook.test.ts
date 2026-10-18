/**
 * What happens to a customer's money when the Stripe webhook has a bad moment.
 *
 * International resorts will pay for ResortPro by card through Stripe, and the
 * only thing that switches their plan on is this webhook. Its handler used to
 * catch every error, log it at info level, and answer 200. Stripe treats a 2xx
 * as delivered and never sends that event again — so one database blip while
 * activating a subscription meant a charged card and a plan that would never
 * turn on, with nothing left anywhere to retry it.
 *
 * These tests sign real payloads with Stripe's own helper, so they exercise the
 * raw-body parser and signature check exactly as production would. No request
 * leaves the machine: the events carry no subscription id, so the handler never
 * calls the Stripe API.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { keepEnv } from '../helpers/env';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const SECRET = 'whsec_test_resortpro_webhook_integration';
const slug = `stripe-webhook-${Date.now()}`;
let tenantId: string;
const eventIds: string[] = [];

// Only used for generateTestHeaderString, which is local HMAC signing.
const signer = new Stripe('sk_test_signing_only', { apiVersion: '2024-06-20' });

function checkoutCompleted(forTenant: string, planKey = 'STARTER') {
  const id = `evt_test_${randomUUID().replace(/-/g, '')}`;
  eventIds.push(id);
  return {
    id,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${randomUUID().replace(/-/g, '')}`,
        object: 'checkout.session',
        mode: 'subscription',
        customer: `cus_test_${randomUUID().slice(0, 8)}`,
        // Null on purpose: the handler then skips subscriptions.retrieve, so
        // nothing here talks to Stripe.
        subscription: null,
        metadata: { tenantId: forTenant, planKey, interval: 'month' },
      },
    },
  };
}

function deliver(event: object, signature?: string) {
  const payload = JSON.stringify(event);
  return app.inject({
    method: 'POST',
    url: '/api/stripe/webhook',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature ?? signer.webhooks.generateTestHeaderString({ payload, secret: SECRET }),
    },
    payload,
  });
}

// Registered first, so the snapshot is taken before the line below changes it.
keepEnv('STRIPE_WEBHOOK_SECRET');

beforeAll(async () => {
  // Read at request time by the route, so setting it here is enough.
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Stripe Webhook', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password: 'TestPass123!',
    },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
}, 30000);

afterAll(async () => {
  await prisma.stripeWebhookEvent.deleteMany({ where: { stripeId: { in: eventIds } } });
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('a payload that was not signed by Stripe', () => {
  it('is refused before anything is recorded', async () => {
    const event = checkoutCompleted(tenantId);
    const res = await deliver(event, 't=1,v1=forged');
    expect(res.statusCode).toBe(400);
    expect(await prisma.stripeWebhookEvent.findUnique({ where: { stripeId: event.id } })).toBeNull();
  });
});

describe('an event the handler cannot finish', () => {
  it('answers 500 so that Stripe sends it again', async () => {
    // A tenant that does not exist makes the plan update throw — the same
    // path a database outage or a Stripe API timeout would take.
    const event = checkoutCompleted(randomUUID());
    const res = await deliver(event);

    // Anything 2xx here and Stripe would consider the payment delivered.
    expect(res.statusCode).toBe(500);
  });

  it('is kept as unprocessed, so the retry is not skipped as a duplicate', async () => {
    const event = checkoutCompleted(randomUUID());
    await deliver(event);
    const row = await prisma.stripeWebhookEvent.findUnique({ where: { stripeId: event.id } });
    expect(row?.processed).toBe(false);
  });
});

describe('an event that previously failed, delivered again', () => {
  it('is processed this time, and the plan switches on', async () => {
    const event = checkoutCompleted(tenantId, 'STARTER');
    // As if an earlier delivery of this same event had failed half-way.
    await prisma.stripeWebhookEvent.create({
      data: { stripeId: event.id, type: event.type, data: event.data as object, processed: false },
    });

    const res = await deliver(event);
    expect(res.statusCode, res.body).toBe(200);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planStatus: true } });
    expect(tenant).toEqual({ plan: 'STARTER', planStatus: 'active' });
    const row = await prisma.stripeWebhookEvent.findUnique({ where: { stripeId: event.id } });
    expect(row?.processed).toBe(true);
  });
});

describe('an event that already finished, delivered again', () => {
  it('is acknowledged and not applied a second time', async () => {
    const event = checkoutCompleted(tenantId, 'PROFESSIONAL');
    expect((await deliver(event)).statusCode).toBe(200);

    // Something changes the plan after the event was handled…
    await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'STARTER' } });

    // …and a duplicate delivery must not quietly put it back.
    expect((await deliver(event)).statusCode).toBe(200);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
    expect(tenant?.plan).toBe('STARTER');
  });
});

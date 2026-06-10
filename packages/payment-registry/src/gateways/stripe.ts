/**
 * Stripe Payment Gateway (Global)
 * Docs: https://stripe.com/docs/api
 *
 * Flow:
 *  1. POST /v1/payment_intents → get client_secret
 *  2. Frontend: Stripe.js confirmCardPayment (inline)
 *     OR: Checkout Session → redirect
 *  3. Webhook → verify signature → update status
 */

import type {
  GatewayCredentials, GatewayMeta,
  InitiatePaymentInput, InitiatePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
  RefundInput, RefundResult,
} from '../types.js';
import { BaseGateway } from './base.js';
import * as crypto from 'crypto';

const BASE = 'https://api.stripe.com/v1';

interface StripeCredentials {
  secretKey: string;         // sk_test_... or sk_live_...
  publishableKey: string;    // pk_test_... or pk_live_...
  webhookSecret?: string;    // whsec_...
}

export class StripeGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'stripe',
    name: 'Stripe',
    logo: '💳',
    countries: ['US', 'GB', 'AU', 'LK', 'IN', 'BD', 'NP'],  // global
    methods: ['card'],
    status: 'active',
    testMode: true,
    redirectFlow: false,   // inline Stripe.js — OR redirect via Checkout Session
    credentialFields: [
      { key: 'secretKey',     label: 'Secret Key',      type: 'password', required: true,  placeholder: 'sk_test_...' },
      { key: 'publishableKey',label: 'Publishable Key', type: 'text',     required: true,  placeholder: 'pk_test_...' },
      { key: 'webhookSecret', label: 'Webhook Secret',  type: 'password', required: false, placeholder: 'whsec_...' },
    ],
  };

  private async stripeRequest<T>(
    path: string,
    secretKey: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      },
      body: body ? new URLSearchParams(
        Object.entries(body).map(([k, v]) => [k, String(v)])
      ).toString() : undefined,
    });

    const json = await res.json() as T & { error?: { message: string } };
    if ((json as { error?: { message: string } }).error) {
      throw new Error((json as { error: { message: string } }).error.message);
    }
    return json;
  }

  // Uses Stripe Checkout Session (redirect flow — simpler for hotel context)
  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as StripeCredentials;

    try {
      const session = await this.stripeRequest<{
        id: string;
        url: string;
        payment_intent: string;
      }>('/checkout/sessions', creds.secretKey, 'POST', {
        'payment_method_types[]':   'card',
        'mode':                     'payment',
        'success_url':              `${input.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url':               `${input.returnUrl}?status=cancelled`,
        'client_reference_id':      input.orderId,
        'line_items[0][quantity]':  '1',
        'line_items[0][price_data][currency]':           (input.currency || 'USD').toLowerCase(),
        'line_items[0][price_data][unit_amount]':        String(input.amount),
        'line_items[0][price_data][product_data][name]': input.description || 'Hotel Booking',
        'customer_email':           input.customerEmail || '',
        'metadata[orderId]':        input.orderId,
        'metadata[customerName]':   input.customerName,
      });

      return {
        success: true,
        redirectUrl: session.url,
        gatewayOrderId: session.id,
        gatewayPaymentId: session.payment_intent,
        // Also expose publishableKey for inline Stripe.js if needed
        inlineData: { publishableKey: creds.publishableKey, sessionId: session.id },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as StripeCredentials;

    // Called from webhook OR from return URL with session_id
    const sessionId = input.queryParams?.session_id || input.gatewayOrderId;
    const paymentIntentId = input.gatewayPaymentId;

    try {
      if (sessionId) {
        // Verify via Checkout Session
        const session = await this.stripeRequest<{
          id: string;
          payment_status: string;
          payment_intent: string;
          amount_total: number;
          currency: string;
        }>(`/checkout/sessions/${sessionId}`, creds.secretKey, 'GET');

        if (session.payment_status === 'paid') {
          return {
            success: true,
            status: 'SUCCESS',
            gatewayPaymentId: session.payment_intent as string,
            gatewayOrderId: session.id,
            amount: session.amount_total,
            currency: session.currency.toUpperCase(),
            rawData: session as unknown as Record<string, unknown>,
          };
        }
        return {
          success: false,
          status: session.payment_status === 'unpaid' ? 'PENDING' : 'FAILED',
        };
      }

      if (paymentIntentId) {
        // Verify via PaymentIntent
        const pi = await this.stripeRequest<{
          id: string;
          status: string;
          amount: number;
          currency: string;
          created: number;
        }>(`/payment_intents/${paymentIntentId}`, creds.secretKey, 'GET');

        const success = pi.status === 'succeeded';
        return {
          success,
          status: success ? 'SUCCESS' : pi.status === 'canceled' ? 'CANCELLED' : 'PENDING',
          gatewayPaymentId: pi.id,
          amount: pi.amount,
          currency: pi.currency.toUpperCase(),
          paidAt: success ? new Date(pi.created * 1000) : undefined,
        };
      }

      return { success: false, status: 'FAILED', error: 'No session_id or payment_intent provided' };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const creds = input.credentials as unknown as StripeCredentials;
    try {
      const refund = await this.stripeRequest<{ id: string; status: string }>(
        '/refunds',
        creds.secretKey,
        'POST',
        {
          payment_intent: input.gatewayPaymentId,
          ...(input.amount ? { amount: String(input.amount) } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
        },
      );
      return { success: refund.status === 'succeeded', refundId: refund.id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    credentials: GatewayCredentials,
  ): boolean {
    const creds = credentials as unknown as StripeCredentials;
    if (!creds.webhookSecret) return true;

    const sig = headers['stripe-signature'];
    if (!sig) return false;

    try {
      // Stripe webhook signature: t=timestamp,v1=signature
      const parts = sig.split(',').reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split('=');
        acc[k] = v;
        return acc;
      }, {});

      const timestamp = parts['t'];
      const sigV1     = parts['v1'];
      const payload   = `${timestamp}.${rawBody}`;
      const expected  = crypto
        .createHmac('sha256', creds.webhookSecret)
        .update(payload)
        .digest('hex');

      return expected === sigV1;
    } catch {
      return false;
    }
  }
}

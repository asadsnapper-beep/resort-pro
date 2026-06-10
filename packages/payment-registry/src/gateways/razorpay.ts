/**
 * Razorpay Payment Gateway (India)
 * Docs: https://razorpay.com/docs/
 *
 * Flow:
 *  1. Create order → POST /v1/orders
 *  2. Frontend: open Razorpay checkout JS (inline)
 *  3. Webhook → verify signature
 */

import type {
  GatewayCredentials, GatewayMeta,
  InitiatePaymentInput, InitiatePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
} from '../types.js';
import { BaseGateway } from './base.js';
import * as crypto from 'crypto';

const BASE = 'https://api.razorpay.com/v1';

interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export class RazorpayGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'razorpay',
    name: 'Razorpay',
    logo: '₹',
    countries: ['IN'],
    methods: ['card', 'upi', 'net_banking', 'wallet'],
    status: 'active',
    testMode: true,
    redirectFlow: false,   // inline checkout JS
    credentialFields: [
      { key: 'keyId',        label: 'Key ID',         type: 'text',     required: true, placeholder: 'rzp_test_...' },
      { key: 'keySecret',    label: 'Key Secret',     type: 'password', required: true },
      { key: 'webhookSecret',label: 'Webhook Secret', type: 'password', required: false },
    ],
  };

  private authHeader(creds: RazorpayCredentials): string {
    return 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  }

  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as RazorpayCredentials;

    try {
      const res = await fetch(`${BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.authHeader(creds),
        },
        body: JSON.stringify({
          amount:          input.amount,          // already in paise
          currency:        input.currency || 'INR',
          receipt:         input.orderId,
          notes: {
            orderId:       input.orderId,
            customerName:  input.customerName,
            customerEmail: input.customerEmail,
          },
        }),
      });

      const json = await res.json() as {
        id: string;
        status: string;
        error?: { description: string };
      };

      if (!res.ok || json.error) {
        return { success: false, error: json.error?.description || 'Razorpay order creation failed' };
      }

      return {
        success: true,
        gatewayOrderId: json.id,
        // inlineData sent to frontend to open Razorpay checkout JS
        inlineData: {
          key: creds.keyId,
          orderId: json.id,
          amount: input.amount,
          currency: input.currency || 'INR',
          name: 'ResortPro',
          description: input.description || 'Hotel Booking',
          prefill: {
            name:  input.customerName,
            email: input.customerEmail,
            contact: input.customerPhone,
          },
          theme: { color: '#1a6b5e' },
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as RazorpayCredentials;
    const razorpayPaymentId = input.queryParams?.razorpay_payment_id || input.gatewayPaymentId;
    const razorpaySignature = input.queryParams?.razorpay_signature;
    const razorpayOrderId   = input.queryParams?.razorpay_order_id;

    // 1. Verify signature
    if (razorpaySignature && razorpayOrderId) {
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSig = crypto
        .createHmac('sha256', creds.keySecret)
        .update(body)
        .digest('hex');

      if (expectedSig !== razorpaySignature) {
        return { success: false, status: 'FAILED', error: 'Razorpay signature mismatch' };
      }
    }

    // 2. Fetch payment status
    try {
      const res = await fetch(`${BASE}/payments/${razorpayPaymentId}`, {
        headers: { 'Authorization': this.authHeader(creds) },
      });
      const json = await res.json() as {
        id: string;
        status: string;
        amount: number;
        currency: string;
        created_at: number;
        error_description?: string;
      };

      if (json.status === 'captured' || json.status === 'authorized') {
        return {
          success: true,
          status: 'SUCCESS',
          gatewayPaymentId: json.id,
          transactionId: json.id,
          amount: json.amount,
          currency: json.currency,
          paidAt: new Date(json.created_at * 1000),
          rawData: json as unknown as Record<string, unknown>,
        };
      }

      return {
        success: false,
        status: json.status === 'failed' ? 'FAILED' : 'PENDING',
        error: json.error_description,
      };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    credentials: GatewayCredentials,
  ): boolean {
    const creds = credentials as unknown as RazorpayCredentials;
    if (!creds.webhookSecret) return true;
    const signature = headers['x-razorpay-signature'];
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', creds.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  }
}

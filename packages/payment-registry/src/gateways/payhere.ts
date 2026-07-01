/**
 * PayHere Payment Gateway (Sri Lanka)
 * Docs: https://support.payhere.lk/api-&-mobile-sdk/payhere-checkout
 *
 * Flow: Generate hash → redirect to PayHere checkout page → webhook verify
 */

import type {
  GatewayCredentials, GatewayMeta,
  InitiatePaymentInput, InitiatePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
} from '../types.js';
import { BaseGateway } from './base.js';
import * as crypto from 'crypto';

const SANDBOX_BASE = 'https://sandbox.payhere.lk/pay/checkout';
const LIVE_BASE    = 'https://www.payhere.lk/pay/checkout';

interface PayHereCredentials {
  merchantId: string;
  merchantSecret: string;
  sandbox?: string;
}

export class PayHereGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'payhere',
    name: 'PayHere',
    logo: '🇱🇰',
    countries: ['LK'],
    methods: ['card', 'net_banking', 'wallet'],
    status: 'active',
    testMode: true,
    redirectFlow: true,
    credentialFields: [
      { key: 'merchantId',     label: 'Merchant ID',     type: 'text',     required: true },
      { key: 'merchantSecret', label: 'Merchant Secret', type: 'password', required: true },
      { key: 'sandbox', label: 'Mode', type: 'select', required: true,
        options: [{ value: 'true', label: 'Sandbox (Test)' }, { value: 'false', label: 'Live' }] },
    ],
  };

  private buildHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string): string {
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const str = `${merchantId}${orderId}${amount}${currency}${hashedSecret}`;
    return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
  }

  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as PayHereCredentials;
    const amount = (input.amount / 100).toFixed(2);
    const currency = input.currency || 'LKR';
    const hash = this.buildHash(creds.merchantId, input.orderId, amount, currency, creds.merchantSecret);

    // PayHere uses a redirect form POST — build the redirect URL with params
    const base = creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;
    const params = new URLSearchParams({
      merchant_id:  creds.merchantId,
      return_url:   input.returnUrl,
      cancel_url:   input.returnUrl + '?status=cancelled',
      notify_url:   input.callbackUrl,
      order_id:     input.orderId,
      items:        input.description || 'Hotel Booking',
      currency,
      amount,
      first_name:   input.customerName.split(' ')[0] || input.customerName,
      last_name:    input.customerName.split(' ').slice(1).join(' ') || 'Guest',
      email:        input.customerEmail || 'guest@resortpro.site',
      phone:        input.customerPhone || '0700000000',
      address:      'N/A',
      city:         'Colombo',
      country:      'Sri Lanka',
      hash,
    });

    return {
      success: true,
      redirectUrl: `${base}?${params.toString()}`,
    };
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as PayHereCredentials;
    const params = input.queryParams || {};

    // Verify PayHere notification hash
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = params;

    if (md5sig) {
      const hashedSecret = crypto.createHash('md5').update(creds.merchantSecret).digest('hex').toUpperCase();
      const expected = crypto.createHash('md5')
        .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
        .digest('hex').toUpperCase();

      if (expected !== md5sig) {
        return { success: false, status: 'FAILED', error: 'PayHere signature mismatch' };
      }
    }

    const statusMap: Record<string, VerifyPaymentResult['status']> = {
      '2': 'SUCCESS', '0': 'PENDING', '-1': 'CANCELLED', '-2': 'FAILED', '-3': 'FAILED',
    };
    const status = statusMap[params.status_code] || 'FAILED';

    return {
      success: status === 'SUCCESS',
      status,
      gatewayPaymentId: params.payment_id,
      transactionId: params.payment_id,
      amount: params.payhere_amount ? Math.round(parseFloat(params.payhere_amount) * 100) : undefined,
      currency: params.payhere_currency,
      rawData: params as Record<string, unknown>,
    };
  }

  verifyWebhookSignature(
    _rawBody: string,
    _headers: Record<string, string>,
    _credentials: GatewayCredentials,
  ): boolean {
    return true; // Hash verified in verify() itself
  }
}

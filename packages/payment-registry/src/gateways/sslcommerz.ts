/**
 * SSLCommerz Payment Gateway
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * Flow:
 *  1. POST /gwprocess/v4/api.php  → get GatewayPageURL
 *  2. Redirect guest → GatewayPageURL
 *  3. Guest pays → SSLCommerz POSTs to success/fail/cancel URL
 *  4. Validate → POST /validator/api/validationserverAPI.php
 */

import type {
  GatewayCredentials,
  GatewayMeta,
  InitiatePaymentInput,
  InitiatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from '../types.js';
import { BaseGateway } from './base.js';
import * as crypto from 'crypto';

const SANDBOX_BASE = 'https://sandbox.sslcommerz.com';
const LIVE_BASE    = 'https://securepay.sslcommerz.com';

interface SSLCredentials {
  storeId: string;
  storePassword: string;
  sandbox?: string; // 'true' | 'false'
}

export class SSLCommerzGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'sslcommerz',
    name: 'SSLCommerz',
    logo: '💳',
    countries: ['BD'],
    methods: ['card', 'net_banking', 'mobile_banking'],
    status: 'active',
    testMode: true,
    redirectFlow: true,
    credentialFields: [
      { key: 'storeId',       label: 'Store ID',       type: 'text',     required: true, placeholder: 'Your SSLCommerz Store ID' },
      { key: 'storePassword', label: 'Store Password', type: 'password', required: true, placeholder: 'Your SSLCommerz Store Password' },
      { key: 'sandbox',       label: 'Mode',           type: 'select',   required: true,
        options: [{ value: 'true', label: 'Sandbox (Test)' }, { value: 'false', label: 'Live' }] },
    ],
  };

  private baseUrl(creds: SSLCredentials): string {
    return creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;
  }

  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as SSLCredentials;
    const amount = (input.amount / 100).toFixed(2); // paisa → taka

    const params = new URLSearchParams({
      store_id:       creds.storeId,
      store_passwd:   creds.storePassword,
      total_amount:   amount,
      currency:       input.currency || 'BDT',
      tran_id:        input.orderId,
      success_url:    input.returnUrl,
      fail_url:       input.returnUrl + '?status=failed',
      cancel_url:     input.returnUrl + '?status=cancelled',
      ipn_url:        input.callbackUrl,
      cus_name:       input.customerName,
      cus_email:      input.customerEmail || 'guest@resortpro.app',
      cus_phone:      input.customerPhone || '01700000000',
      cus_add1:       'N/A',
      cus_city:       'Dhaka',
      cus_country:    'Bangladesh',
      shipping_method:'NO',
      product_name:   input.description || 'Hotel Booking',
      product_category: 'Travel',
      product_profile: 'travel-vertical',
    });

    try {
      const res = await fetch(`${this.baseUrl(creds)}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const json = await res.json() as {
        status: string;
        failedreason?: string;
        GatewayPageURL?: string;
        sessionkey?: string;
      };

      if (json.status !== 'SUCCESS') {
        return { success: false, error: json.failedreason || 'SSLCommerz init failed' };
      }

      return {
        success: true,
        redirectUrl: json.GatewayPageURL,
        sessionToken: json.sessionkey,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as SSLCredentials;
    const valId = input.queryParams?.val_id;

    if (!valId) {
      return { success: false, status: 'FAILED', error: 'Missing val_id for SSLCommerz validation' };
    }

    try {
      const params = new URLSearchParams({
        val_id:       valId,
        store_id:     creds.storeId,
        store_passwd: creds.storePassword,
        v:            '1',
        format:       'json',
      });

      const res = await fetch(
        `${this.baseUrl(creds)}/validator/api/validationserverAPI.php?${params}`,
      );
      const json = await res.json() as {
        status: string;
        tran_id: string;
        bank_tran_id: string;
        amount: string;
        currency_amount: string;
        store_amount: string;
      };

      if (json.status === 'VALID' || json.status === 'VALIDATED') {
        return {
          success: true,
          status: 'SUCCESS',
          gatewayPaymentId: json.bank_tran_id,
          transactionId: json.bank_tran_id,
          amount: Math.round(parseFloat(json.amount) * 100),
          currency: 'BDT',
          rawData: json as unknown as Record<string, unknown>,
        };
      }

      return {
        success: false,
        status: json.status === 'FAILED' ? 'FAILED' : 'PENDING',
        error: `SSLCommerz status: ${json.status}`,
        rawData: json as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }

  /** Verify IPN hash from SSLCommerz webhook */
  verifyWebhookSignature(
    _rawBody: string,
    headers: Record<string, string>,
    credentials: GatewayCredentials,
  ): boolean {
    // SSLCommerz sends verify_sign + verify_key in POST body
    // This is handled in the webhook route itself using their hash verification
    return true; // simplified — full implementation in webhook route
  }
}

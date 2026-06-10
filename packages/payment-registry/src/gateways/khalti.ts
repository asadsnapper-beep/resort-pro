/**
 * Khalti Payment Gateway (Nepal)
 * Docs: https://docs.khalti.com/khalti-epayment/
 *
 * Flow:
 *  1. POST /epayment/initiate/ → get payment URL
 *  2. Redirect guest → payment URL
 *  3. Guest pays → Khalti redirects to return_url with pidx
 *  4. POST /epayment/lookup/ → verify with pidx
 */

import type {
  GatewayCredentials, GatewayMeta,
  InitiatePaymentInput, InitiatePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
} from '../types.js';
import { BaseGateway } from './base.js';

const SANDBOX_BASE = 'https://dev.khalti.com/api/v2';
const LIVE_BASE    = 'https://khalti.com/api/v2';

interface KhaltiCredentials {
  secretKey: string;   // starts with 'test_secret_key_' or 'live_secret_key_'
  sandbox?: string;
}

export class KhaltiGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'khalti',
    name: 'Khalti',
    logo: '🟣',
    countries: ['NP'],
    methods: ['wallet', 'mobile_banking'],
    status: 'active',
    testMode: true,
    redirectFlow: true,
    credentialFields: [
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true,
        placeholder: 'test_secret_key_...' },
      { key: 'sandbox', label: 'Mode', type: 'select', required: true,
        options: [{ value: 'true', label: 'Sandbox (Test)' }, { value: 'false', label: 'Live' }] },
    ],
  };

  private baseUrl(creds: KhaltiCredentials): string {
    return creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;
  }

  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as KhaltiCredentials;

    try {
      const res = await fetch(`${this.baseUrl(creds)}/epayment/initiate/`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Key ${creds.secretKey}`,
        },
        body: JSON.stringify({
          return_url:  input.returnUrl,
          website_url: 'https://resortpro.app',
          amount:      input.amount,          // already in paisa
          purchase_order_id:   input.orderId,
          purchase_order_name: input.description || 'Hotel Booking',
          customer_info: {
            name:  input.customerName,
            email: input.customerEmail,
            phone: input.customerPhone,
          },
        }),
      });

      const json = await res.json() as {
        pidx?: string;
        payment_url?: string;
        expires_at?: string;
        detail?: string;
      };

      if (!json.payment_url || !json.pidx) {
        return { success: false, error: json.detail || 'Khalti initiate failed' };
      }

      return {
        success: true,
        redirectUrl: json.payment_url,
        gatewayPaymentId: json.pidx,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as KhaltiCredentials;
    const pidx  = input.queryParams?.pidx || input.gatewayPaymentId;

    try {
      const res = await fetch(`${this.baseUrl(creds)}/epayment/lookup/`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Key ${creds.secretKey}`,
        },
        body: JSON.stringify({ pidx }),
      });

      const json = await res.json() as {
        pidx: string;
        status: string;             // 'Completed' | 'Pending' | 'Expired' | 'User canceled'
        transaction_id?: string;
        amount?: number;
        fee?: number;
        refunded?: boolean;
        detail?: string;
      };

      if (json.status === 'Completed') {
        return {
          success: true,
          status: 'SUCCESS',
          gatewayPaymentId: json.pidx,
          transactionId: json.transaction_id,
          amount: json.amount,
          currency: 'NPR',
          rawData: json as unknown as Record<string, unknown>,
        };
      }

      const status: VerifyPaymentResult['status'] =
        json.status === 'Pending'        ? 'PENDING'    :
        json.status === 'User canceled'  ? 'CANCELLED'  : 'FAILED';

      return {
        success: false,
        status,
        error: json.detail || `Khalti status: ${json.status}`,
      };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }
}

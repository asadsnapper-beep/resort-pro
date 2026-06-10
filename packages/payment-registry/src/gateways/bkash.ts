/**
 * bKash Tokenized Checkout API v1.2.0
 * Docs: https://developer.bka.sh/docs/tokenized-checkout-overview
 *
 * Flow:
 *  1. Grant token  → POST /tokenized/checkout/token/grant
 *  2. Create       → POST /tokenized/checkout/create
 *  3. Redirect     → guest goes to bkashURL
 *  4. Execute      → POST /tokenized/checkout/execute  (from callback)
 *  5. Query        → POST /tokenized/checkout/payment/status (verify)
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

const SANDBOX_BASE = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
const LIVE_BASE    = 'https://tokenized.pay.bka.sh/v1.2.0-beta';

interface BkashCredentials {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  sandbox?: string; // 'true' | 'false'
}

interface BkashTokenCache {
  token: string;
  expiresAt: number;
}

// In-memory token cache per appKey (resets on server restart — fine for dev)
const tokenCache = new Map<string, BkashTokenCache>();

export class BkashGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'bkash',
    name: 'bKash',
    logo: '📱',
    countries: ['BD'],
    methods: ['mobile_banking'],
    status: 'active',
    testMode: true,
    redirectFlow: true,
    credentialFields: [
      { key: 'appKey',    label: 'App Key',     type: 'password', required: true, placeholder: 'bKash App Key' },
      { key: 'appSecret', label: 'App Secret',  type: 'password', required: true, placeholder: 'bKash App Secret' },
      { key: 'username',  label: 'Username',    type: 'text',     required: true, placeholder: 'bKash Username' },
      { key: 'password',  label: 'Password',    type: 'password', required: true, placeholder: 'bKash Password' },
      { key: 'sandbox',   label: 'Mode',        type: 'select',   required: true,
        options: [{ value: 'true', label: 'Sandbox (Test)' }, { value: 'false', label: 'Live' }] },
    ],
  };

  private baseUrl(creds: BkashCredentials): string {
    return creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;
  }

  // ── Step 1: Get access token (cached 30 min) ──────────────────────────────
  private async getToken(creds: BkashCredentials): Promise<string> {
    const cacheKey = creds.appKey;
    const cached = tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.token;

    const res = await fetch(`${this.baseUrl(creds)}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'username': creds.username,
        'password': creds.password,
      },
      body: JSON.stringify({ app_key: creds.appKey, app_secret: creds.appSecret }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`bKash token grant failed: ${err}`);
    }

    const json = await res.json() as { id_token: string; expires_in: number };
    const token = json.id_token;
    const expiresAt = Date.now() + (json.expires_in - 60) * 1000; // 60s buffer
    tokenCache.set(cacheKey, { token, expiresAt });
    return token;
  }

  // ── Step 2 & 3: Create payment + return redirect URL ─────────────────────
  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as BkashCredentials;

    try {
      const token = await this.getToken(creds);

      // bKash expects amount as string with 2 decimal places
      const amount = (input.amount / 100).toFixed(2); // paisa → taka

      const res = await fetch(`${this.baseUrl(creds)}/tokenized/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'X-APP-Key': creds.appKey,
        },
        body: JSON.stringify({
          mode:              '0011',          // Checkout URL mode
          payerReference:    input.orderId,
          callbackURL:       input.callbackUrl,
          merchantAssociationInfo: 'ResortPro',
          amount,
          currency:          'BDT',
          intent:            'sale',
          merchantInvoiceNumber: input.orderId,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `bKash create failed: ${err}` };
      }

      const json = await res.json() as {
        statusCode: string;
        statusMessage: string;
        paymentID: string;
        bkashURL: string;
      };

      if (json.statusCode !== '0000') {
        return { success: false, error: `bKash: ${json.statusMessage}` };
      }

      return {
        success: true,
        redirectUrl: json.bkashURL,
        gatewayPaymentId: json.paymentID,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // ── Step 4 & 5: Execute + verify ──────────────────────────────────────────
  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as BkashCredentials;

    try {
      const token = await this.getToken(creds);

      // Execute payment (called after guest returns from bKash)
      const execRes = await fetch(`${this.baseUrl(creds)}/tokenized/checkout/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'X-APP-Key': creds.appKey,
        },
        body: JSON.stringify({ paymentID: input.gatewayPaymentId }),
      });

      const execJson = await execRes.json() as {
        statusCode: string;
        statusMessage: string;
        paymentID: string;
        trxID: string;
        transactionStatus: string;
        amount: string;
        currency: string;
        paymentExecuteTime: string;
      };

      if (execJson.statusCode === '0000' && execJson.transactionStatus === 'Completed') {
        return {
          success: true,
          status: 'SUCCESS',
          gatewayPaymentId: execJson.paymentID,
          transactionId: execJson.trxID,
          amount: Math.round(parseFloat(execJson.amount) * 100), // taka → paisa
          currency: 'BDT',
          paidAt: new Date(execJson.paymentExecuteTime),
          rawData: execJson as unknown as Record<string, unknown>,
        };
      }

      // If execute failed, query status
      const queryRes = await fetch(`${this.baseUrl(creds)}/tokenized/checkout/payment/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'X-APP-Key': creds.appKey,
        },
        body: JSON.stringify({ paymentID: input.gatewayPaymentId }),
      });

      const queryJson = await queryRes.json() as {
        transactionStatus: string;
        statusCode: string;
        statusMessage: string;
      };

      const status = queryJson.transactionStatus === 'Completed' ? 'SUCCESS'
        : queryJson.transactionStatus === 'Initiated' ? 'PENDING'
        : 'FAILED';

      return {
        success: status === 'SUCCESS',
        status,
        gatewayPaymentId: input.gatewayPaymentId,
        error: status !== 'SUCCESS' ? queryJson.statusMessage : undefined,
        rawData: queryJson as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }
}

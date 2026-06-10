/**
 * Nagad Payment Gateway (Bangladesh)
 * Docs: https://nagad.com.bd/developer
 *
 * Flow: Similar to bKash — create → redirect → verify
 * Note: Nagad uses RSA encryption for sensitive data
 */

import type {
  GatewayCredentials, GatewayMeta,
  InitiatePaymentInput, InitiatePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
} from '../types.js';
import { BaseGateway } from './base.js';
import * as crypto from 'crypto';

const SANDBOX_BASE = 'https://api.mynagad.com/api/dfs/check-out/initialize/';
const LIVE_BASE    = 'https://api.nagad.com.bd/api/dfs/check-out/initialize/';

interface NagadCredentials {
  merchantId: string;
  merchantNumber: string;
  publicKey: string;    // Nagad's public key (PEM)
  privateKey: string;   // Merchant's private key (PEM)
  sandbox?: string;
}

export class NagadGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'nagad',
    name: 'Nagad',
    logo: '📲',
    countries: ['BD'],
    methods: ['mobile_banking'],
    status: 'active',
    testMode: true,
    redirectFlow: true,
    credentialFields: [
      { key: 'merchantId',     label: 'Merchant ID',     type: 'text',     required: true },
      { key: 'merchantNumber', label: 'Merchant Number', type: 'text',     required: true },
      { key: 'publicKey',      label: 'Nagad Public Key',  type: 'password', required: true },
      { key: 'privateKey',     label: 'Merchant Private Key', type: 'password', required: true },
      { key: 'sandbox', label: 'Mode', type: 'select', required: true,
        options: [{ value: 'true', label: 'Sandbox (Test)' }, { value: 'false', label: 'Live' }] },
    ],
  };

  private sign(data: string, privateKey: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'base64');
  }

  private encrypt(data: string, publicKey: string): string {
    return crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(data),
    ).toString('base64');
  }

  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as NagadCredentials;
    const base = creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;
    const datetime = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

    try {
      const sensitiveData = {
        merchantId: creds.merchantId,
        datetime,
        orderId: input.orderId,
        challenge: crypto.randomBytes(16).toString('hex'),
      };

      const encryptedData = this.encrypt(JSON.stringify(sensitiveData), creds.publicKey);
      const signature = this.sign(JSON.stringify(sensitiveData), creds.privateKey);

      const initRes = await fetch(`${base}${creds.merchantId}/${input.orderId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KM-Api-Version': 'v-0.2.0' },
        body: JSON.stringify({
          accountNumber: creds.merchantNumber,
          datetime,
          sensitiveData: encryptedData,
          signature,
        }),
      });

      const initJson = await initRes.json() as {
        sensitiveData?: string;
        signature?: string;
        status?: string;
      };

      if (!initJson.sensitiveData) {
        return { success: false, error: 'Nagad init failed: no sensitiveData returned' };
      }

      // Complete checkout
      const amount = (input.amount / 100).toFixed(2);
      const checkoutData = {
        merchantId: creds.merchantId,
        orderId: input.orderId,
        currencyCode: '050',
        amount,
        challenge: sensitiveData.challenge,
      };

      const checkoutEncrypted = this.encrypt(JSON.stringify(checkoutData), creds.publicKey);
      const checkoutSignature = this.sign(JSON.stringify(checkoutData), creds.privateKey);

      const checkoutRes = await fetch(`${base}${creds.merchantId}/${input.orderId}/complete/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-KM-Api-Version': 'v-0.2.0' },
        body: JSON.stringify({
          sensitiveData: checkoutEncrypted,
          signature: checkoutSignature,
          merchantCallbackURL: input.callbackUrl,
        }),
      });

      const checkoutJson = await checkoutRes.json() as {
        status?: string;
        callBackUrl?: string;
        paymentReferenceId?: string;
      };

      if (checkoutJson.status !== 'Success' || !checkoutJson.callBackUrl) {
        return { success: false, error: 'Nagad checkout failed' };
      }

      return {
        success: true,
        redirectUrl: checkoutJson.callBackUrl,
        gatewayPaymentId: checkoutJson.paymentReferenceId,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as NagadCredentials;
    const paymentRefId = input.queryParams?.payment_ref_id || input.gatewayPaymentId;
    const base = creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;

    try {
      const verifyRes = await fetch(
        `${base.replace('check-out/initialize', 'verify')}${creds.merchantId}/${paymentRefId}/`,
        { headers: { 'X-KM-Api-Version': 'v-0.2.0' } },
      );

      const json = await verifyRes.json() as {
        status?: string;
        paymentRefId?: string;
        orderId?: string;
        amount?: string;
      };

      if (json.status === 'Success') {
        return {
          success: true,
          status: 'SUCCESS',
          gatewayPaymentId: json.paymentRefId,
          transactionId: json.paymentRefId,
          rawData: json as unknown as Record<string, unknown>,
        };
      }

      return { success: false, status: 'FAILED', error: `Nagad status: ${json.status}` };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }
}

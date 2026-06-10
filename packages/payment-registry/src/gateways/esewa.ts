/**
 * eSewa Payment Gateway (Nepal)
 * Docs: https://developer.esewa.com.np/
 *
 * Flow: POST form to eSewa → redirect → verify with GET request
 */

import type {
  GatewayCredentials, GatewayMeta,
  InitiatePaymentInput, InitiatePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
} from '../types.js';
import { BaseGateway } from './base.js';
import * as crypto from 'crypto';

const SANDBOX_BASE = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const LIVE_BASE    = 'https://epay.esewa.com.np/api/epay/main/v2/form';
const SANDBOX_VERIFY = 'https://rc-epay.esewa.com.np/api/epay/transaction/status/';
const LIVE_VERIFY    = 'https://epay.esewa.com.np/api/epay/transaction/status/';

interface ESewaCredentials {
  merchantCode: string;
  secretKey: string;
  sandbox?: string;
}

export class ESewaGateway extends BaseGateway {
  readonly meta: GatewayMeta = {
    id: 'esewa',
    name: 'eSewa',
    logo: '🟢',
    countries: ['NP'],
    methods: ['wallet', 'mobile_banking'],
    status: 'active',
    testMode: true,
    redirectFlow: true,
    credentialFields: [
      { key: 'merchantCode', label: 'Merchant Code', type: 'text',     required: true },
      { key: 'secretKey',    label: 'Secret Key',    type: 'password', required: true },
      { key: 'sandbox', label: 'Mode', type: 'select', required: true,
        options: [{ value: 'true', label: 'Sandbox (Test)' }, { value: 'false', label: 'Live' }] },
    ],
  };

  private buildSignature(
    totalAmount: string,
    transactionUUID: string,
    productCode: string,
    secretKey: string,
  ): string {
    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUUID},product_code=${productCode}`;
    return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  }

  async initiate(
    input: InitiatePaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<InitiatePaymentResult> {
    const creds = rawCreds as unknown as ESewaCredentials;
    const amount = (input.amount / 100).toFixed(2); // paisa → rupee
    const uuid   = input.orderId;
    const base   = creds.sandbox === 'false' ? LIVE_BASE : SANDBOX_BASE;
    const signature = this.buildSignature(amount, uuid, creds.merchantCode, creds.secretKey);

    // eSewa v2 uses a redirect form
    const params = new URLSearchParams({
      amount,
      tax_amount:         '0',
      total_amount:       amount,
      transaction_uuid:   uuid,
      product_code:       creds.merchantCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url:        input.returnUrl,
      failure_url:        input.returnUrl + '?status=failed',
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature,
    });

    return {
      success: true,
      redirectUrl: `${base}?${params.toString()}`,
      gatewayPaymentId: uuid,
    };
  }

  async verify(
    input: VerifyPaymentInput,
    rawCreds: GatewayCredentials,
  ): Promise<VerifyPaymentResult> {
    const creds = rawCreds as unknown as ESewaCredentials;
    const base  = creds.sandbox === 'false' ? LIVE_VERIFY : SANDBOX_VERIFY;

    // eSewa returns base64 encoded JSON as ?data= param on success
    const data = input.queryParams?.data;
    if (!data) {
      return { success: false, status: 'FAILED', error: 'No eSewa data param' };
    }

    try {
      const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf-8')) as {
        transaction_code: string;
        status: string;
        total_amount: string;
        transaction_uuid: string;
        product_code: string;
        signed_field_names: string;
        signature: string;
      };

      // Verify signature
      const expectedSig = this.buildSignature(
        decoded.total_amount,
        decoded.transaction_uuid,
        decoded.product_code,
        creds.secretKey,
      );

      if (expectedSig !== decoded.signature) {
        return { success: false, status: 'FAILED', error: 'eSewa signature mismatch' };
      }

      if (decoded.status === 'COMPLETE') {
        return {
          success: true,
          status: 'SUCCESS',
          gatewayPaymentId: decoded.transaction_uuid,
          transactionId: decoded.transaction_code,
          rawData: decoded as unknown as Record<string, unknown>,
        };
      }

      return { success: false, status: 'FAILED', error: `eSewa status: ${decoded.status}` };
    } catch (err) {
      return { success: false, status: 'FAILED', error: String(err) };
    }
  }
}

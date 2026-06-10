import { BkashGateway }      from './gateways/bkash.js';
import { NagadGateway }      from './gateways/nagad.js';
import { SSLCommerzGateway } from './gateways/sslcommerz.js';
import { RazorpayGateway }   from './gateways/razorpay.js';
import { PayHereGateway }    from './gateways/payhere.js';
import { ESewaGateway }      from './gateways/esewa.js';
import { KhaltiGateway }     from './gateways/khalti.js';
import { StripeGateway }     from './gateways/stripe.js';
import {
  MidtransGateway, OmiseGateway, IPay88Gateway,
  MpesaGateway, FlutterwaveGateway, PaystackGateway,
} from './gateways/stubs.js';
import { StubGateway, BaseGateway } from './gateways/base.js';
import type { GatewayId } from './types.js';

// ─── Manual gateway (no API call needed) ──────────────────────────────────────
class ManualGateway extends BaseGateway {
  readonly meta = {
    id: 'manual' as GatewayId,
    name: 'Pay at Resort',
    logo: '🏨',
    countries: [] as string[],
    methods: ['manual' as const],
    status: 'active' as const,
    testMode: false,
    redirectFlow: false,
    credentialFields: [],
  };
  async initiate() { return { success: true }; }
  async verify()   { return { success: true, status: 'PENDING' as const }; }
}

class PayPalGateway extends StubGateway {
  constructor() {
    super({
      id: 'paypal', name: 'PayPal', logo: '🅿️',
      countries: [], methods: ['card', 'wallet'],
      status: 'coming_soon', testMode: true, redirectFlow: true,
      credentialFields: [
        { key: 'clientId',     label: 'Client ID',     type: 'text',     required: true },
        { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
      ],
    });
  }
}

class CashfreeGateway extends StubGateway {
  constructor() {
    super({
      id: 'cashfree', name: 'Cashfree', logo: '₹',
      countries: ['IN'], methods: ['card', 'upi', 'net_banking'],
      status: 'coming_soon', testMode: true, redirectFlow: true,
      credentialFields: [
        { key: 'appId',     label: 'App ID',     type: 'text',     required: true },
        { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
      ],
    });
  }
}

// ─── Singleton instances ──────────────────────────────────────────────────────
const GATEWAYS: Record<GatewayId, BaseGateway> = {
  // Phase 1 — full implementations
  bkash:       new BkashGateway(),
  nagad:       new NagadGateway(),
  sslcommerz:  new SSLCommerzGateway(),
  razorpay:    new RazorpayGateway(),
  payhere:     new PayHereGateway(),
  esewa:       new ESewaGateway(),
  khalti:      new KhaltiGateway(),
  stripe:      new StripeGateway(),
  // Phase 2/3 — stubs
  midtrans:    MidtransGateway,
  omise:       OmiseGateway,
  ipay88:      IPay88Gateway,
  mpesa:       MpesaGateway,
  flutterwave: FlutterwaveGateway,
  paystack:    PaystackGateway,
  // Special
  paypal:      new PayPalGateway(),
  cashfree:    new CashfreeGateway(),
  manual:      new ManualGateway(),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Get a gateway instance by ID */
export function getGateway(id: GatewayId): BaseGateway {
  const gw = GATEWAYS[id];
  if (!gw) throw new Error(`Unknown gateway: "${id}"`);
  return gw;
}

/** Country code → recommended gateway IDs (ordered: most popular first) */
export const COUNTRY_GATEWAYS: Record<string, GatewayId[]> = {
  BD: ['bkash', 'nagad', 'sslcommerz', 'stripe', 'manual'],
  IN: ['razorpay', 'cashfree', 'stripe', 'manual'],
  LK: ['payhere', 'stripe', 'manual'],
  NP: ['esewa', 'khalti', 'stripe', 'manual'],
  PK: ['stripe', 'manual'],
  TH: ['omise', 'stripe', 'manual'],
  ID: ['midtrans', 'manual'],
  MY: ['ipay88', 'stripe', 'manual'],
  KE: ['mpesa', 'stripe', 'manual'],
  NG: ['flutterwave', 'paystack', 'stripe', 'manual'],
  GH: ['paystack', 'flutterwave', 'manual'],
};

export const DEFAULT_GATEWAYS: GatewayId[] = ['stripe', 'manual'];

/** Get gateway list for a country */
export function getGatewaysForCountry(countryCode: string): BaseGateway[] {
  const ids = COUNTRY_GATEWAYS[countryCode.toUpperCase()] ?? DEFAULT_GATEWAYS;
  return ids.map(id => GATEWAYS[id]).filter(Boolean);
}

/** All gateways (for admin UI) */
export function getAllGateways(): BaseGateway[] {
  return Object.values(GATEWAYS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Gateway Registry — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type GatewayId =
  // 🇧🇩 Bangladesh
  | 'bkash'
  | 'nagad'
  | 'sslcommerz'
  // 🇮🇳 India
  | 'razorpay'
  | 'cashfree'
  // 🇱🇰 Sri Lanka
  | 'payhere'
  // 🇳🇵 Nepal
  | 'esewa'
  | 'khalti'
  // 🌍 Global
  | 'stripe'
  | 'paypal'
  // Phase 2 stubs
  | 'midtrans'
  | 'omise'
  | 'ipay88'
  | 'mpesa'
  | 'flutterwave'
  | 'paystack'
  // Manual
  | 'manual';

export type PaymentMethodType =
  | 'mobile_banking'   // bKash, Nagad, M-Pesa
  | 'card'             // Stripe, PayHere, SSLCommerz card
  | 'net_banking'      // SSLCommerz, Razorpay netbanking
  | 'wallet'           // GoPay, OVO, GCash
  | 'upi'              // Razorpay UPI
  | 'manual';          // Pay at Resort

export type PaymentGatewayStatus = 'active' | 'stub' | 'coming_soon';

// ─── Gateway metadata (displayed in UI) ──────────────────────────────────────

export interface GatewayMeta {
  id: GatewayId;
  name: string;                    // display name e.g. "bKash"
  logo: string;                    // emoji or icon key
  countries: string[];             // ISO 3166-1 alpha-2 country codes
  methods: PaymentMethodType[];    // supported payment method types
  status: PaymentGatewayStatus;
  testMode: boolean;               // supports sandbox/test mode
  redirectFlow: boolean;           // true = redirect to gateway page, false = inline
  credentialFields: CredentialField[];  // fields to show in settings form
}

export interface CredentialField {
  key: string;           // e.g. 'appKey'
  label: string;         // e.g. 'App Key'
  type: 'text' | 'password' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];  // for select type
}

// ─── Initiate Payment ─────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
  amount: number;           // smallest currency unit (paisa/paise/cents/satoshi)
  currency: string;         // e.g. 'BDT', 'INR', 'USD'
  orderId: string;          // our internal Payment.id
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl: string;      // webhook URL (POST from gateway)
  returnUrl: string;        // redirect URL after payment (success/fail page)
  description?: string;
  metadata?: Record<string, string>;
}

export interface InitiatePaymentResult {
  success: boolean;
  redirectUrl?: string;        // guest কে redirect করো এখানে
  gatewayPaymentId?: string;   // gateway-এর payment ID (store করো DB-তে)
  gatewayOrderId?: string;     // razorpay order_id / stripe payment_intent
  sessionToken?: string;       // bKash / SSLCommerz session token
  inlineData?: Record<string, unknown>;  // Stripe publishable key etc.
  error?: string;
}

// ─── Verify / Webhook ─────────────────────────────────────────────────────────

export interface VerifyPaymentInput {
  gatewayPaymentId: string;
  gatewayOrderId?: string;
  orderId: string;
  rawBody?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  transactionId?: string;   // final transaction reference (trnxId, trx_id, etc.)
  amount?: number;
  currency?: string;
  paidAt?: Date;
  rawData?: Record<string, unknown>;
  error?: string;
}

// ─── Refund ───────────────────────────────────────────────────────────────────

export interface RefundInput {
  gatewayPaymentId: string;
  amount?: number;     // partial refund — undefined = full refund
  reason?: string;
  credentials: GatewayCredentials;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

// ─── Credentials (stored encrypted in TenantPaymentConfig.credentials JSON) ──

export type GatewayCredentials = Record<string, string>;

// e.g. bKash: { appKey, appSecret, username, password }
// e.g. stripe: { secretKey, publishableKey, webhookSecret }
// e.g. razorpay: { keyId, keySecret, webhookSecret }
// e.g. sslcommerz: { storeId, storePassword }
// e.g. payhere: { merchantId, merchantSecret }
// e.g. esewa: { merchantCode, secretKey }
// e.g. khalti: { secretKey, publicKey }

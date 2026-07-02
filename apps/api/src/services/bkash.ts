/**
 * bKash Tokenized Checkout (v1.2.0-beta)
 * Docs: https://developer.bka.sh/docs/tokenized-checkout-process
 *
 * Flow:
 *  1. grantToken()  → idToken (30 min TTL)
 *  2. createPayment(idToken, ...) → paymentID + bkashURL
 *  3. redirect guest → bkashURL
 *  4. bKash calls our callback with paymentID
 *  5. executePayment(idToken, paymentID) → trxID → CONFIRMED
 */

// Production base by default; override with BKASH_BASE_URL for sandbox testing
// (sandbox: https://tokenized.sandbox.bka.sh/v1.2.0-beta).
const BKASH_BASE = process.env.BKASH_BASE_URL || 'https://checkout.pay.bka.sh/v1.2.0-beta'

export interface BkashConfig {
  appKey: string
  appSecret: string
  username: string
  password: string
}

export interface BkashTokenResponse {
  id_token: string
  token_type: string
  expires_in: number
}

export interface BkashCreateResponse {
  paymentID: string
  bkashURL: string
  callbackURL: string
  successCallbackURL: string
  failureCallbackURL: string
  cancelledCallbackURL: string
  amount: string
  intent: string
  currency: string
  merchantInvoiceNumber: string
  statusCode: string
  statusMessage: string
}

export interface BkashExecuteResponse {
  paymentID: string
  trxID: string
  transactionStatus: string   // "Completed" | "Failed" | "Incomplete"
  amount: string
  currency: string
  intent: string
  paymentExecuteTime: string
  merchantInvoiceNumber: string
  statusCode: string
  statusMessage: string
}

// ── Grant token ───────────────────────────────────────────────────────────────

export async function bkashGrantToken(cfg: BkashConfig): Promise<string> {
  const res = await fetch(`${BKASH_BASE}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'username': cfg.username,
      'password': cfg.password,
    },
    body: JSON.stringify({ app_key: cfg.appKey, app_secret: cfg.appSecret }),
  })
  const json = await res.json()
  if (!res.ok || !json.id_token) {
    throw new Error(`bKash token error: ${json.statusMessage ?? JSON.stringify(json)}`)
  }
  return json.id_token as string
}

// ── Create payment ────────────────────────────────────────────────────────────

export async function bkashCreatePayment(
  cfg: BkashConfig,
  idToken: string,
  opts: {
    amount: string          // e.g. "1500.00"
    currency: string        // "BDT"
    merchantInvoiceNumber: string  // our booking confirmation no
    callbackURL: string     // our callback URL
  }
): Promise<BkashCreateResponse> {
  const res = await fetch(`${BKASH_BASE}/tokenized/checkout/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': idToken,
      'X-APP-Key': cfg.appKey,
    },
    body: JSON.stringify({
      mode: '0011',  // Tokenized Checkout
      payerReference: opts.merchantInvoiceNumber,
      callbackURL: opts.callbackURL,
      amount: opts.amount,
      currency: opts.currency,
      intent: 'sale',
      merchantInvoiceNumber: opts.merchantInvoiceNumber,
    }),
  })
  const json = await res.json()
  if (!res.ok || json.statusCode !== '0000') {
    throw new Error(`bKash create error: ${json.statusMessage ?? JSON.stringify(json)}`)
  }
  return json as BkashCreateResponse
}

// ── Execute payment ───────────────────────────────────────────────────────────

export async function bkashExecutePayment(
  cfg: BkashConfig,
  idToken: string,
  paymentID: string
): Promise<BkashExecuteResponse> {
  const res = await fetch(`${BKASH_BASE}/tokenized/checkout/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': idToken,
      'X-APP-Key': cfg.appKey,
    },
    body: JSON.stringify({ paymentID }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`bKash execute error: ${json.statusMessage ?? JSON.stringify(json)}`)
  }
  return json as BkashExecuteResponse
}

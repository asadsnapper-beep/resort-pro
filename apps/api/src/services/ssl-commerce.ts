/**
 * SSLCommerz Payment Gateway
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * Flow:
 *  1. initPayment() → GatewayPageURL
 *  2. redirect guest → GatewayPageURL
 *  3. SSL posts to success_url / fail_url / cancel_url
 *  4. validatePayment(val_id) → VALID → CONFIRMED
 */

export interface SslConfig {
  storeId: string
  storePassword: string
  isLive: boolean
}

function sslBase(isLive: boolean) {
  return isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com'
}

export interface SslInitResponse {
  status: string          // "SUCCESS" | "FAILED"
  GatewayPageURL: string
  sessionkey: string
  desc?: string
}

export interface SslValidateResponse {
  status: string          // "VALID" | "VALIDATED" | "INVALID_TRANSACTION" | "FAILED"
  tran_id: string
  val_id: string
  amount: string
  store_amount: string
  currency: string
  bank_tran_id: string
  card_type: string
}

// ── Init payment ──────────────────────────────────────────────────────────────

export async function sslInitPayment(
  cfg: SslConfig,
  opts: {
    tranId: string          // our unique transaction ID (booking confirmation no)
    amount: number
    currency: string        // "BDT"
    productName: string     // e.g. "Room booking - Ocean Suite"
    customerName: string
    customerEmail: string
    customerPhone: string
    successUrl: string
    failUrl: string
    cancelUrl: string
  }
): Promise<SslInitResponse> {
  const base = sslBase(cfg.isLive)

  const params = new URLSearchParams({
    store_id: cfg.storeId,
    store_passwd: cfg.storePassword,
    total_amount: opts.amount.toFixed(2),
    currency: opts.currency,
    tran_id: opts.tranId,
    success_url: opts.successUrl,
    fail_url: opts.failUrl,
    cancel_url: opts.cancelUrl,
    product_name: opts.productName,
    product_category: 'Hotel Booking',
    product_profile: 'hotel',
    cus_name: opts.customerName,
    cus_email: opts.customerEmail,
    cus_phone: opts.customerPhone,
    cus_add1: 'N/A',
    cus_city: 'N/A',
    cus_country: 'Bangladesh',
    ship_name: opts.customerName,
    ship_add1: 'N/A',
    ship_city: 'N/A',
    ship_country: 'Bangladesh',
    ship_postcode: '1000',
    shipping_method: 'NO',
    num_of_item: '1',
    emi_option: '0',
  })

  const res = await fetch(`${base}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const json = await res.json()
  if (json.status !== 'SUCCESS') {
    throw new Error(`SSL init error: ${json.failedreason ?? JSON.stringify(json)}`)
  }
  return json as SslInitResponse
}

// ── Validate IPN ──────────────────────────────────────────────────────────────

export async function sslValidatePayment(
  cfg: SslConfig,
  valId: string
): Promise<SslValidateResponse> {
  const base = sslBase(cfg.isLive)
  const url = new URL(`${base}/validator/api/validationserverAPI.php`)
  url.searchParams.set('val_id', valId)
  url.searchParams.set('store_id', cfg.storeId)
  url.searchParams.set('store_passwd', cfg.storePassword)
  url.searchParams.set('v', '1')
  url.searchParams.set('format', 'json')

  const res = await fetch(url.toString())
  const json = await res.json()
  return json as SslValidateResponse
}

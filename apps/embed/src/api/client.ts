/**
 * Embed API client
 * All calls go to the ResortPro public API — no auth needed.
 */

const API_BASE = (window as any).__RESORTPRO_API__ || 'https://api.resortpro.site'

// Where the resort's hosted pages live. Payment is completed there rather than
// inside the widget — see checkoutUrl below.
const WEB_BASE = ((window as any).__RESORTPRO_WEB__ || 'https://resortpro.site').replace(/\/$/, '')

export interface EmbedConfig {
  tenantId: string
  slug: string
  name: string
  currency: string
  checkInTime: string
  checkOutTime: string
  gateways: { bkash: boolean; ssl: boolean; stripe: boolean; manual: boolean }
  color: string
  logo?: string
}

export interface Room {
  id: string
  name: string
  type: string
  basePrice: number
  maxOccupancy: number
  amenities: string[]
  images: string[]
  description?: string
}

export interface AvailabilityDay {
  date: string
  available: boolean
  price?: number
  roomCount?: number
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  category: string
  image?: string
  isAvailable: boolean
}

export interface BookingResult {
  id: string
  confirmationNo: string
  totalAmount: number
  nights: number
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `API error ${res.status}`)
  return json.data as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `API error ${res.status}`)
  return json.data as T
}

// ── Public endpoints ──────────────────────────────────────────────────────────

export const api = {
  /** Single call to get everything needed for widget init */
  config: (slug: string) => get<EmbedConfig>(`/embed/config/${slug}`),

  /** Available rooms for given dates */
  availability: (slug: string, checkIn: string, checkOut: string) =>
    get<Room[]>(`/site/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}`),

  /** Monthly calendar — which dates are available */
  calendar: (slug: string, year: number, month: number) =>
    get<AvailabilityDay[]>(`/site/${slug}/availability/calendar?year=${year}&month=${month}`),

  /** Restaurant menu items */
  menu: (slug: string) => get<MenuItem[]>(`/site/${slug}/menu`),

  /** Create a booking — returns id + confirmationNo */
  book: (slug: string, payload: {
    firstName: string; lastName: string; email: string; phone?: string
    roomId: string; checkIn: string; checkOut: string; adults: number
    specialRequests?: string
  }) => post<BookingResult>(`/site/${slug}/book`, payload),

  /** Place a food order (standalone, no booking required) */
  order: (slug: string, payload: {
    guestName: string; guestEmail?: string; guestPhone?: string
    bookingRef?: string; tableNo?: string
    items: { menuItemId: string; quantity: number; notes?: string }[]
  // /embed, not /site: the order route is registered by embedRoutes. The /site
  // path this used to call has never existed, so every order 404ed.
  }) => post<{ orderId: string; total: number }>(`/embed/${slug}/orders`, payload),

  /**
   * The resort's own checkout page for a booking this widget just created.
   *
   * The widget used to take payment itself, and none of it worked. bKash and
   * SSL called /api/payments/{bkash,ssl}/initiate, which do not exist. Stripe
   * called /api/payments/stripe/intent, which does not exist either, required
   * the host page to set window.__STRIPE_PK__, and — had it got that far —
   * showed "Booking Confirmed!" after elements.submit() without ever calling
   * confirmPayment, so no card would have been charged.
   *
   * The hosted checkout already offers every gateway the resort has enabled,
   * pay-at-hotel included, and is what the resort's own site uses. One payment
   * path instead of two, and the maintained one.
   */
  checkoutUrl: (slug: string, bookingId: string) =>
    `${WEB_BASE}/${encodeURIComponent(slug)}/checkout?bookingId=${encodeURIComponent(bookingId)}`,
}

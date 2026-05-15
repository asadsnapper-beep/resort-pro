/**
 * Embed API client
 * All calls go to the ResortPro public API — no auth needed.
 */

const API_BASE = (window as any).__RESORTPRO_API__ || 'https://api.resortpro.app'

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
  }) => post<{ orderId: string; total: number }>(`/site/${slug}/orders`, payload),

  /** Initiate bKash payment */
  bkashInitiate: (bookingId: string) =>
    post<{ bkashURL: string; paymentID: string }>('/api/payments/bkash/initiate', { bookingId }),

  /** Initiate SSL Commerce payment */
  sslInitiate: (bookingId: string) =>
    post<{ gatewayUrl: string }>('/api/payments/ssl/initiate', { bookingId }),

  /** Create Stripe PaymentIntent */
  stripeIntent: (bookingId: string) =>
    post<{ clientSecret: string }>('/api/payments/stripe/intent', { bookingId }),
}

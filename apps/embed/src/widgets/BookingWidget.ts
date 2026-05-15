/**
 * BookingWidget — 4-step booking flow (Dates → Rooms → Details → Payment)
 * Vanilla TypeScript, DOM-only, no framework.
 */

import { api, EmbedConfig, Room, BookingResult } from '../api/client'
import { formatMoney, today, nightsBetween, toDateStr, loadScript } from '../utils/dom'
import { applyTheme } from '../utils/theme'

export interface WidgetConfig {
  slug: string
  color: string
  currency: string
  gateways: EmbedConfig['gateways']
  checkIn?: string
  checkOut?: string
}

type Step = 'dates' | 'rooms' | 'details' | 'payment' | 'success'

interface State {
  step: Step
  checkIn: string
  checkOut: string
  adults: number
  rooms: Room[]
  selectedRoom: Room | null
  bookingId: string
  confirmationNo: string
  totalAmount: number
  nights: number
  paymentMethod: 'manual' | 'bkash' | 'ssl' | 'stripe' | null
  loading: boolean
  error: string
  stripeReady: boolean
}

// Stripe types (loaded from CDN on demand)
declare const Stripe: (key: string) => StripeInstance
interface StripeInstance {
  elements: (opts: { clientSecret: string }) => StripeElements
}
interface StripeElements {
  create: (type: string) => StripeElement
  submit: () => Promise<{ error?: { message: string } }>
}
interface StripeElement {
  mount: (el: HTMLElement) => void
}

export class BookingWidget {
  private container: HTMLElement
  private cfg: WidgetConfig
  private state: State
  private stripeElements: StripeElements | null = null
  private stripePaymentEl: StripeElement | null = null

  constructor(container: HTMLElement, config: WidgetConfig) {
    this.container = container
    this.cfg = config

    const tomorrow = toDateStr(new Date(Date.now() + 86_400_000))
    const dayAfter = toDateStr(new Date(Date.now() + 2 * 86_400_000))

    this.state = {
      step: 'dates',
      checkIn: config.checkIn || tomorrow,
      checkOut: config.checkOut || dayAfter,
      adults: 2,
      rooms: [],
      selectedRoom: null,
      bookingId: '',
      confirmationNo: '',
      totalAmount: 0,
      nights: 0,
      paymentMethod: null,
      loading: false,
      error: '',
      stripeReady: false,
    }

    // Apply brand color to container
    applyTheme(this.container, config.color)

    // Single delegated listener
    this.container.addEventListener('click', this.handleClick.bind(this))
    this.container.addEventListener('change', this.handleChange.bind(this))
    this.container.addEventListener('input', this.handleInput.bind(this))

    this.render()
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render() {
    const { step } = this.state
    this.container.innerHTML = `
      <div class="rp-widget rp-card">
        ${this.renderStepTabs()}
        <div class="rp-body">
          ${this.renderError()}
          ${this.renderStep()}
        </div>
      </div>
    `

    // After render: if stripe step is active and we have clientSecret, mount element
    if (step === 'payment' && this.state.stripeReady && this.stripeElements) {
      const mountTarget = this.container.querySelector<HTMLElement>('#rp-stripe-element')
      if (mountTarget && this.stripePaymentEl) {
        this.stripePaymentEl.mount(mountTarget)
      }
    }
  }

  private renderStepTabs(): string {
    const steps: { key: Step; label: string }[] = [
      { key: 'dates', label: 'Dates' },
      { key: 'rooms', label: 'Rooms' },
      { key: 'details', label: 'Details' },
      { key: 'payment', label: 'Payment' },
    ]
    const order: Step[] = ['dates', 'rooms', 'details', 'payment', 'success']
    const currentIndex = order.indexOf(this.state.step)

    return `
      <div class="rp-steps">
        ${steps.map((s, i) => `
          <div class="rp-step ${i <= currentIndex ? 'active' : ''}">${s.label}</div>
        `).join('')}
      </div>
    `
  }

  private renderError(): string {
    if (!this.state.error) return ''
    return `<div class="rp-error">${escHtml(this.state.error)}</div>`
  }

  private renderStep(): string {
    if (this.state.loading) {
      return '<div class="rp-spinner"></div>'
    }
    switch (this.state.step) {
      case 'dates':   return this.renderDates()
      case 'rooms':   return this.renderRooms()
      case 'details': return this.renderDetails()
      case 'payment': return this.renderPayment()
      case 'success': return this.renderSuccess()
    }
  }

  private renderDates(): string {
    const { checkIn, checkOut, adults } = this.state
    return `
      <div class="rp-space-4">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin-bottom:4px;">Plan Your Stay</h2>
          <p style="color:var(--rp-muted);font-size:13px;">Select your dates and number of guests</p>
        </div>
        <div class="rp-grid-2">
          <div>
            <label class="rp-label" for="rp-checkin">Check-in</label>
            <input id="rp-checkin" data-field="checkIn" class="rp-input" type="date"
              value="${checkIn}" min="${today()}" />
          </div>
          <div>
            <label class="rp-label" for="rp-checkout">Check-out</label>
            <input id="rp-checkout" data-field="checkOut" class="rp-input" type="date"
              value="${checkOut}" min="${checkIn}" />
          </div>
        </div>
        <div>
          <label class="rp-label">Adults</label>
          <div class="rp-stepper">
            <button class="rp-step-btn" data-action="adults-dec">−</button>
            <span style="font-size:18px;font-weight:700;min-width:24px;text-align:center;"
              id="rp-adults-count">${adults}</span>
            <button class="rp-step-btn" data-action="adults-inc">+</button>
          </div>
        </div>
        <button class="rp-btn rp-btn-primary" data-action="check-availability">
          Check Availability
        </button>
      </div>
    `
  }

  private renderRooms(): string {
    const { rooms, selectedRoom, checkIn, checkOut } = this.state
    const nights = nightsBetween(checkIn, checkOut)

    if (rooms.length === 0) {
      return `
        <div style="text-align:center;padding:40px 0;">
          <div style="font-size:32px;margin-bottom:8px;">🏨</div>
          <p style="color:var(--rp-muted);">No rooms available for these dates.</p>
          <button class="rp-btn rp-btn-outline" style="margin-top:16px;" data-action="back-to-dates">
            Change Dates
          </button>
        </div>
      `
    }

    return `
      <div class="rp-space-4">
        <div class="rp-flex-between">
          <div>
            <h2 style="font-size:18px;font-weight:700;">Available Rooms</h2>
            <p style="color:var(--rp-muted);font-size:13px;">${nights} night${nights !== 1 ? 's' : ''} · ${this.state.adults} adult${this.state.adults !== 1 ? 's' : ''}</p>
          </div>
          <button class="rp-btn rp-btn-outline" style="width:auto;" data-action="back-to-dates">← Back</button>
        </div>
        <div class="rp-space-3">
          ${rooms.map(room => this.renderRoomCard(room, selectedRoom?.id === room.id)).join('')}
        </div>
        <button class="rp-btn rp-btn-primary" data-action="select-room"
          ${!selectedRoom ? 'disabled' : ''}>
          Continue with ${selectedRoom ? escHtml(selectedRoom.name) : 'selected room'}
        </button>
      </div>
    `
  }

  private renderRoomCard(room: Room, selected: boolean): string {
    const imgSrc = room.images[0] || ''
    const amenities = room.amenities.slice(0, 3)
    const pricePerNight = formatMoney(room.basePrice, this.cfg.currency)

    return `
      <div class="rp-room-card ${selected ? 'selected' : ''}" data-action="pick-room" data-room-id="${room.id}">
        <div class="rp-flex rp-flex-gap-3">
          ${imgSrc
            ? `<img class="rp-room-img" src="${escHtml(imgSrc)}" alt="${escHtml(room.name)}" />`
            : `<div class="rp-room-img" style="background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:24px;">🛏</div>`
          }
          <div style="flex:1;min-width:0;">
            <div class="rp-flex-between" style="flex-wrap:wrap;gap:4px;">
              <span style="font-weight:600;font-size:15px;">${escHtml(room.name)}</span>
              <span class="rp-room-price">${pricePerNight}<span style="font-weight:400;font-size:12px;color:var(--rp-muted);"> /night</span></span>
            </div>
            <div style="margin-top:4px;">
              <span class="rp-badge">${escHtml(room.type)}</span>
              <span class="rp-badge" style="margin-left:4px;">👥 Max ${room.maxOccupancy}</span>
            </div>
            ${amenities.length ? `
              <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
                ${amenities.map(a => `<span style="font-size:11px;color:var(--rp-muted);">✓ ${escHtml(a)}</span>`).join('')}
              </div>
            ` : ''}
            ${room.description ? `<p style="font-size:12px;color:var(--rp-muted);margin-top:6px;">${escHtml(room.description)}</p>` : ''}
          </div>
        </div>
        ${selected ? `<div style="text-align:right;margin-top:8px;font-size:12px;color:var(--rp-primary);font-weight:600;">✓ Selected</div>` : ''}
      </div>
    `
  }

  private renderDetails(): string {
    const { checkIn, checkOut, selectedRoom, adults } = this.state
    const nights = nightsBetween(checkIn, checkOut)
    const total = selectedRoom ? formatMoney(selectedRoom.basePrice * nights, this.cfg.currency) : ''

    return `
      <div class="rp-space-4">
        <div>
          <h2 style="font-size:18px;font-weight:700;">Guest Details</h2>
          <p style="color:var(--rp-muted);font-size:13px;">Fill in your information to continue</p>
        </div>
        <div class="rp-summary">
          <div class="rp-summary-row">
            <span>Room</span>
            <span style="font-weight:600;">${selectedRoom ? escHtml(selectedRoom.name) : ''}</span>
          </div>
          <div class="rp-summary-row">
            <span>Dates</span>
            <span>${checkIn} → ${checkOut}</span>
          </div>
          <div class="rp-summary-row">
            <span>Nights · Guests</span>
            <span>${nights} nights · ${adults} adults</span>
          </div>
          <div class="rp-summary-row" style="font-weight:700;margin-top:4px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08);">
            <span>Total</span>
            <span style="color:var(--rp-primary);">${total}</span>
          </div>
        </div>
        <div class="rp-grid-2">
          <div>
            <label class="rp-label" for="rp-fname">First Name *</label>
            <input id="rp-fname" data-field="firstName" class="rp-input" type="text"
              placeholder="John" autocomplete="given-name" />
          </div>
          <div>
            <label class="rp-label" for="rp-lname">Last Name *</label>
            <input id="rp-lname" data-field="lastName" class="rp-input" type="text"
              placeholder="Doe" autocomplete="family-name" />
          </div>
        </div>
        <div>
          <label class="rp-label" for="rp-email">Email Address *</label>
          <input id="rp-email" data-field="email" class="rp-input" type="email"
            placeholder="john@example.com" autocomplete="email" />
        </div>
        <div>
          <label class="rp-label" for="rp-phone">Phone Number</label>
          <input id="rp-phone" data-field="phone" class="rp-input" type="tel"
            placeholder="+880 1700 000000" autocomplete="tel" />
        </div>
        <div>
          <label class="rp-label" for="rp-requests">Special Requests</label>
          <textarea id="rp-requests" data-field="specialRequests" class="rp-textarea" rows="3"
            placeholder="Late check-in, dietary requirements, etc."></textarea>
        </div>
        <div class="rp-grid-2" style="gap:8px;">
          <button class="rp-btn rp-btn-outline" data-action="back-to-rooms">← Back</button>
          <button class="rp-btn rp-btn-primary" data-action="submit-details"
            style="height:40px;font-size:14px;">
            Continue to Payment
          </button>
        </div>
      </div>
    `
  }

  private renderPayment(): string {
    const { paymentMethod, checkIn, checkOut, selectedRoom, stripeReady } = this.state
    const nights = nightsBetween(checkIn, checkOut)
    const total = selectedRoom ? formatMoney(selectedRoom.basePrice * nights, this.cfg.currency) : ''
    const { gateways } = this.cfg

    const methods: { key: 'manual' | 'bkash' | 'ssl' | 'stripe'; label: string; icon: string; desc: string }[] = [
      { key: 'manual',  label: 'Pay at Hotel',    icon: '🏨', desc: 'Pay when you arrive' },
      { key: 'bkash',   label: 'bKash',           icon: '📱', desc: 'Mobile financial service' },
      { key: 'ssl',     label: 'SSL Commerce',    icon: '💳', desc: 'Card, mobile banking & more' },
      { key: 'stripe',  label: 'Credit / Debit Card', icon: '💳', desc: 'Powered by Stripe — secure payment' },
    ]

    const enabledMethods = methods.filter(m => gateways[m.key])

    return `
      <div class="rp-space-4">
        <div>
          <h2 style="font-size:18px;font-weight:700;">Payment</h2>
          <p style="color:var(--rp-muted);font-size:13px;">Choose how you'd like to pay</p>
        </div>
        <div class="rp-summary">
          <div class="rp-summary-row" style="font-weight:700;">
            <span>Amount Due</span>
            <span style="color:var(--rp-primary);font-size:16px;">${total}</span>
          </div>
          <div class="rp-summary-row" style="font-size:12px;color:var(--rp-muted);">
            <span>${selectedRoom ? escHtml(selectedRoom.name) : ''}</span>
            <span>${nights} night${nights !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="rp-space-3">
          ${enabledMethods.map(m => `
            <div class="rp-pay-card ${paymentMethod === m.key ? 'selected' : ''}"
              data-action="pick-payment" data-method="${m.key}">
              <div class="rp-pay-radio">
                <div class="rp-pay-dot"></div>
              </div>
              <span style="font-size:20px;">${m.icon}</span>
              <div>
                <div style="font-weight:600;font-size:14px;">${m.label}</div>
                <div style="font-size:12px;color:var(--rp-muted);">${m.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
        ${paymentMethod === 'stripe' && stripeReady ? `
          <div id="rp-stripe-element" style="padding:12px;border:1px solid var(--rp-border);border-radius:var(--rp-radius-sm);"></div>
          <button class="rp-btn rp-btn-primary" data-action="pay-stripe">Pay Now — ${total}</button>
        ` : paymentMethod === 'stripe' && !stripeReady ? `
          <div class="rp-spinner"></div>
        ` : `
          <button class="rp-btn rp-btn-primary" data-action="confirm-payment"
            ${!paymentMethod ? 'disabled' : ''}>
            Confirm Booking
          </button>
        `}
        <button class="rp-btn rp-btn-outline" style="margin-top:-8px;" data-action="back-to-details">← Back</button>
      </div>
    `
  }

  private renderSuccess(): string {
    const { confirmationNo, nights, totalAmount } = this.state
    const total = formatMoney(totalAmount, this.cfg.currency)
    return `
      <div class="rp-success">
        <div class="rp-success-icon">✅</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:6px;">Booking Confirmed!</h2>
        <p style="color:var(--rp-muted);font-size:13px;margin-bottom:20px;">
          A confirmation has been sent to your email.
        </p>
        <div style="text-align:left;border:1px solid var(--rp-border);border-radius:var(--rp-radius-sm);overflow:hidden;">
          <div class="rp-success-ref" style="padding:10px 16px;">
            <span style="color:var(--rp-muted);">Confirmation No.</span>
            <span style="font-weight:700;font-family:monospace;">${escHtml(confirmationNo)}</span>
          </div>
          <div class="rp-success-ref" style="padding:10px 16px;">
            <span style="color:var(--rp-muted);">Nights</span>
            <span>${nights}</span>
          </div>
          <div class="rp-success-ref" style="padding:10px 16px;border-bottom:none;">
            <span style="color:var(--rp-muted);">Total Paid</span>
            <span style="font-weight:700;color:var(--rp-primary);">${total}</span>
          </div>
        </div>
        <button class="rp-btn rp-btn-outline" style="margin-top:24px;width:auto;padding:0 24px;"
          data-action="book-again">
          Book Again
        </button>
      </div>
    `
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  private handleClick(e: Event) {
    const target = e.target as HTMLElement
    const btn = target.closest<HTMLElement>('[data-action]')
    if (!btn) return

    const action = btn.dataset.action!

    switch (action) {
      case 'adults-dec':
        this.setAdults(this.state.adults - 1)
        break
      case 'adults-inc':
        this.setAdults(this.state.adults + 1)
        break
      case 'check-availability':
        void this.fetchRooms()
        break
      case 'back-to-dates':
        this.go('dates')
        break
      case 'pick-room': {
        const roomId = btn.dataset.roomId!
        const room = this.state.rooms.find(r => r.id === roomId) || null
        this.setState({ selectedRoom: room, error: '' })
        break
      }
      case 'select-room':
        if (this.state.selectedRoom) this.go('details')
        break
      case 'back-to-rooms':
        this.go('rooms')
        break
      case 'submit-details':
        void this.submitDetails()
        break
      case 'back-to-details':
        this.go('details')
        break
      case 'pick-payment': {
        const method = btn.dataset.method as State['paymentMethod']
        this.setState({ paymentMethod: method, error: '', stripeReady: false })
        if (method === 'stripe') void this.initStripe()
        break
      }
      case 'confirm-payment':
        void this.confirmPayment()
        break
      case 'pay-stripe':
        void this.payWithStripe()
        break
      case 'book-again':
        this.reset()
        break
    }
  }

  private handleChange(e: Event) {
    const target = e.target as HTMLInputElement | HTMLSelectElement
    const field = target.dataset.field
    if (!field) return

    if (field === 'checkIn') {
      const newCheckIn = target.value
      // Ensure checkout is after checkin
      const nextDay = toDateStr(new Date(new Date(newCheckIn).getTime() + 86_400_000))
      const newCheckOut = this.state.checkOut <= newCheckIn ? nextDay : this.state.checkOut
      this.setState({ checkIn: newCheckIn, checkOut: newCheckOut, error: '' })
      // Update checkout min attr
      const coEl = this.container.querySelector<HTMLInputElement>('#rp-checkout')
      if (coEl) { coEl.min = newCheckIn; coEl.value = newCheckOut }
    } else if (field === 'checkOut') {
      this.setState({ checkOut: target.value, error: '' })
    }
  }

  private handleInput(_e: Event) {
    // No-op: form field values are read on submit to avoid re-rendering on every keystroke
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private setAdults(n: number) {
    const clamped = Math.max(1, Math.min(10, n))
    this.setState({ adults: clamped })
    // Update count display without full re-render
    const el = this.container.querySelector<HTMLElement>('#rp-adults-count')
    if (el) el.textContent = String(clamped)
    const decBtn = this.container.querySelector<HTMLButtonElement>('[data-action="adults-dec"]')
    const incBtn = this.container.querySelector<HTMLButtonElement>('[data-action="adults-inc"]')
    if (decBtn) decBtn.disabled = clamped <= 1
    if (incBtn) incBtn.disabled = clamped >= 10
  }

  private async fetchRooms() {
    const { checkIn, checkOut } = this.state
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      this.setState({ error: 'Please select a valid check-in and check-out date.' })
      return
    }
    this.setState({ loading: true, error: '' })
    try {
      const rooms = await api.availability(this.cfg.slug, checkIn, checkOut)
      this.setState({ rooms, loading: false, selectedRoom: null })
      this.go('rooms')
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err) })
    }
  }

  private async submitDetails() {
    // Read form field values
    const get = (id: string) =>
      (this.container.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim()

    const firstName = get('rp-fname')
    const lastName  = get('rp-lname')
    const email     = get('rp-email')
    const phone     = get('rp-phone')
    const specialRequests = get('rp-requests')

    if (!firstName || !lastName) {
      this.setState({ error: 'Please enter your first and last name.' })
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setState({ error: 'Please enter a valid email address.' })
      return
    }
    if (!this.state.selectedRoom) {
      this.setState({ error: 'No room selected. Please go back and select a room.' })
      return
    }

    this.setState({ loading: true, error: '' })
    try {
      const result: BookingResult = await api.book(this.cfg.slug, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        roomId: this.state.selectedRoom.id,
        checkIn: this.state.checkIn,
        checkOut: this.state.checkOut,
        adults: this.state.adults,
        specialRequests: specialRequests || undefined,
      })
      this.setState({
        loading: false,
        bookingId: result.id,
        confirmationNo: result.confirmationNo,
        totalAmount: result.totalAmount,
        nights: result.nights,
        paymentMethod: null,
        stripeReady: false,
      })
      this.go('payment')
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err) })
    }
  }

  private async initStripe() {
    this.setState({ stripeReady: false, error: '' })
    this.render()
    try {
      const { clientSecret } = await api.stripeIntent(this.state.bookingId)
      await loadScript('https://js.stripe.com/v3/')

      // Stripe public key — host site can set window.__STRIPE_PK__
      const pk = (window as any).__STRIPE_PK__ || ''
      if (!pk) throw new Error('Stripe public key not configured. Set window.__STRIPE_PK__.')

      const stripe = Stripe(pk)
      this.stripeElements = stripe.elements({ clientSecret })
      this.stripePaymentEl = this.stripeElements.create('payment')
      this.setState({ stripeReady: true })
      // render() mounts the stripe element into the div
    } catch (err) {
      this.setState({ stripeReady: false, paymentMethod: null, error: errorMessage(err) })
    }
  }

  private async payWithStripe() {
    if (!this.stripeElements) return
    this.setState({ loading: true, error: '' })
    try {
      const { error } = await this.stripeElements.submit()
      if (error) {
        this.setState({ loading: false, error: error.message || 'Payment failed.' })
        return
      }
      this.showSuccess()
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err) })
    }
  }

  private async confirmPayment() {
    const { paymentMethod, bookingId } = this.state
    if (!paymentMethod) return

    if (paymentMethod === 'manual') {
      this.showSuccess()
      return
    }

    this.setState({ loading: true, error: '' })
    try {
      if (paymentMethod === 'bkash') {
        const { bkashURL } = await api.bkashInitiate(bookingId)
        window.location.href = bkashURL
        return
      }
      if (paymentMethod === 'ssl') {
        const { gatewayUrl } = await api.sslInitiate(bookingId)
        window.location.href = gatewayUrl
        return
      }
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err) })
    }
  }

  private showSuccess() {
    this.setState({ loading: false })
    this.go('success')
  }

  private reset() {
    const tomorrow = toDateStr(new Date(Date.now() + 86_400_000))
    const dayAfter  = toDateStr(new Date(Date.now() + 2 * 86_400_000))
    this.stripeElements = null
    this.stripePaymentEl = null
    this.state = {
      step: 'dates',
      checkIn: tomorrow,
      checkOut: dayAfter,
      adults: 2,
      rooms: [],
      selectedRoom: null,
      bookingId: '',
      confirmationNo: '',
      totalAmount: 0,
      nights: 0,
      paymentMethod: null,
      loading: false,
      error: '',
      stripeReady: false,
    }
    this.render()
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private go(step: Step) {
    this.setState({ step, error: '' })
  }

  private setState(patch: Partial<State>) {
    Object.assign(this.state, patch)
    this.render()
  }
}

// ── Utility functions ──────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

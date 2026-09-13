/**
 * BookingWidget — 4-step booking flow (Dates → Rooms → Details → Payment)
 * Vanilla TypeScript, DOM-only, no framework.
 */

import { api, EmbedConfig, Room, BookingResult } from '../api/client'
import { formatMoney, today, nightsBetween, toDateStr } from '../utils/dom'
import { applyTheme } from '../utils/theme'

export interface WidgetConfig {
  slug: string
  color: string
  currency: string
  gateways: EmbedConfig['gateways']
  checkIn?: string
  checkOut?: string
}

// No 'success' step: the booking is not confirmed until the hosted checkout
// completes it, so this widget has no honest moment at which to say so.
type Step = 'dates' | 'rooms' | 'details' | 'payment'

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
  loading: boolean
  error: string
}


export class BookingWidget {
  private container: HTMLElement
  private cfg: WidgetConfig
  private state: State

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
      loading: false,
      error: '',
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
    this.container.innerHTML = `
      <div class="rp-widget rp-card">
        ${this.renderStepTabs()}
        <div class="rp-body">
          ${this.renderError()}
          ${this.renderStep()}
        </div>
      </div>
    `
  }

  private renderStepTabs(): string {
    const steps: { key: Step; label: string }[] = [
      { key: 'dates', label: 'Dates' },
      { key: 'rooms', label: 'Rooms' },
      { key: 'details', label: 'Details' },
      { key: 'payment', label: 'Payment' },
    ]
    const order: Step[] = ['dates', 'rooms', 'details', 'payment']
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
    const { checkIn, checkOut, selectedRoom } = this.state
    const nights = nightsBetween(checkIn, checkOut)
    const total = selectedRoom ? formatMoney(selectedRoom.basePrice * nights, this.cfg.currency) : ''

    // One button, not a gateway picker: the checkout page offers exactly the
    // methods this resort has enabled, so choosing here too would ask the
    // guest the same question twice.
    return `
      <div class="rp-space-4">
        <div>
          <h2 style="font-size:18px;font-weight:700;">Payment</h2>
          <p style="color:var(--rp-muted);font-size:13px;">Your room is held while you complete checkout.</p>
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
        <button class="rp-btn rp-btn-primary" data-action="confirm-payment">
          Continue to secure checkout
        </button>
        <button class="rp-btn rp-btn-outline" style="margin-top:-8px;" data-action="back-to-details">← Back</button>
      </div>
    `
  }

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
      case 'confirm-payment':
        this.confirmPayment()
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
      })
      this.go('payment')
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err) })
    }
  }

  private confirmPayment() {
    // Hand over to the resort's hosted checkout — not a success screen. The
    // booking is PENDING, and the worker cancels an unpaid PENDING booking once
    // its hold expires. The pay-at-hotel option used to show "Booking
    // Confirmed!" right here, telling a guest they had a room that would be
    // gone half an hour later.
    window.location.href = api.checkoutUrl(this.cfg.slug, this.state.bookingId)
  }

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

/**
 * RoomsWidget — displays a searchable grid of available rooms.
 * Optionally opens a BookingWidget modal on "Book Now".
 * Vanilla TypeScript, DOM-only, no framework.
 */

import { api, Room } from '../api/client'
import { EmbedConfig } from '../api/client'
import { formatMoney, today, toDateStr, nightsBetween } from '../utils/dom'
import { applyTheme } from '../utils/theme'
import { BookingWidget, WidgetConfig } from './BookingWidget'

export interface RoomsConfig {
  slug: string
  color: string
  currency: string
  gateways?: EmbedConfig['gateways']
  checkIn?: string
  checkOut?: string
}

interface State {
  checkIn: string
  checkOut: string
  rooms: Room[]
  loading: boolean
  error: string
  searched: boolean
}

export class RoomsWidget {
  private container: HTMLElement
  private cfg: RoomsConfig
  private state: State
  private useModal: boolean

  constructor(container: HTMLElement, config: RoomsConfig) {
    this.container = container
    this.cfg = config
    this.useModal = container.dataset.modal === 'true'

    const tomorrow = toDateStr(new Date(Date.now() + 86_400_000))
    const dayAfter  = toDateStr(new Date(Date.now() + 2 * 86_400_000))

    this.state = {
      checkIn:  config.checkIn  || tomorrow,
      checkOut: config.checkOut || dayAfter,
      rooms: [],
      loading: false,
      error: '',
      searched: false,
    }

    applyTheme(this.container, config.color)

    this.container.addEventListener('click', this.handleClick.bind(this))
    this.container.addEventListener('change', this.handleChange.bind(this))

    // If dates are pre-supplied, fetch immediately
    if (config.checkIn && config.checkOut) {
      void this.fetchRooms()
    } else {
      this.render()
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render() {
    const { loading, error, searched, rooms, checkIn, checkOut } = this.state

    this.container.innerHTML = `
      <div class="rp-widget">
        ${this.renderDatePicker()}
        ${error ? `<div class="rp-error" style="margin-top:12px;">${escHtml(error)}</div>` : ''}
        ${loading
          ? '<div class="rp-spinner" style="margin-top:16px;"></div>'
          : searched ? this.renderRoomsGrid(rooms, checkIn, checkOut) : ''
        }
      </div>
    `
  }

  private renderDatePicker(): string {
    const { checkIn, checkOut } = this.state
    const hasPreDates = !!(this.cfg.checkIn && this.cfg.checkOut)

    // If dates were pre-supplied and we've already searched, show a compact bar
    if (hasPreDates && this.state.searched) {
      const nights = nightsBetween(checkIn, checkOut)
      return `
        <div class="rp-flex rp-flex-gap-3" style="flex-wrap:wrap;align-items:center;margin-bottom:16px;">
          <div class="rp-info" style="flex:1;min-width:200px;">
            📅 ${checkIn} → ${checkOut} &nbsp;·&nbsp; ${nights} night${nights !== 1 ? 's' : ''}
          </div>
          <button class="rp-btn rp-btn-outline" style="width:auto;" data-action="reset-search">
            Change Dates
          </button>
        </div>
      `
    }

    return `
      <div class="rp-card rp-body" style="margin-bottom:16px;">
        <div class="rp-flex-between" style="flex-wrap:wrap;gap:12px;align-items:flex-end;">
          <div class="rp-grid-2" style="flex:1;min-width:280px;">
            <div>
              <label class="rp-label" for="rp-rooms-checkin">Check-in</label>
              <input id="rp-rooms-checkin" data-field="checkIn" class="rp-input" type="date"
                value="${checkIn}" min="${today()}" />
            </div>
            <div>
              <label class="rp-label" for="rp-rooms-checkout">Check-out</label>
              <input id="rp-rooms-checkout" data-field="checkOut" class="rp-input" type="date"
                value="${checkOut}" min="${checkIn}" />
            </div>
          </div>
          <button class="rp-btn rp-btn-primary" data-action="search"
            style="height:40px;font-size:14px;width:auto;padding:0 24px;flex-shrink:0;">
            Search
          </button>
        </div>
      </div>
    `
  }

  private renderRoomsGrid(rooms: Room[], checkIn: string, checkOut: string): string {
    if (rooms.length === 0) {
      return `
        <div class="rp-card rp-body" style="text-align:center;padding:48px 24px;">
          <div style="font-size:40px;margin-bottom:12px;">🏨</div>
          <p style="font-weight:600;margin-bottom:4px;">No rooms available</p>
          <p style="color:var(--rp-muted);font-size:13px;">Try different dates or contact us directly.</p>
        </div>
      `
    }

    const nights = nightsBetween(checkIn, checkOut)

    return `
      <div style="margin-bottom:12px;">
        <span style="font-weight:600;">${rooms.length} room${rooms.length !== 1 ? 's' : ''} available</span>
        <span style="color:var(--rp-muted);font-size:13px;margin-left:8px;">for ${nights} night${nights !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;">
        ${rooms.map(room => this.renderRoomCard(room, nights)).join('')}
      </div>
    `
  }

  private renderRoomCard(room: Room, nights: number): string {
    const imgSrc = room.images[0] || ''
    const amenities = room.amenities.slice(0, 3)
    const pricePerNight = formatMoney(room.basePrice, this.cfg.currency)
    const totalPrice = formatMoney(room.basePrice * nights, this.cfg.currency)

    return `
      <div class="rp-card rp-room-card"
        style="width:calc(50% - 8px);min-width:260px;flex:1;cursor:default;border:1px solid var(--rp-border);"
        data-room-id="${room.id}">
        ${imgSrc
          ? `<img style="width:100%;height:180px;object-fit:cover;"
               src="${escHtml(imgSrc)}" alt="${escHtml(room.name)}" />`
          : `<div style="width:100%;height:180px;background:#f3f4f6;display:flex;align-items:center;
               justify-content:center;color:#9ca3af;font-size:36px;">🛏</div>`
        }
        <div style="padding:16px;">
          <div class="rp-flex-between" style="flex-wrap:wrap;gap:4px;margin-bottom:8px;">
            <span style="font-weight:700;font-size:16px;">${escHtml(room.name)}</span>
            <span class="rp-badge">${escHtml(room.type)}</span>
          </div>
          ${room.description
            ? `<p style="font-size:13px;color:var(--rp-muted);margin-bottom:10px;line-height:1.4;">${escHtml(room.description)}</p>`
            : ''
          }
          ${amenities.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
              ${amenities.map(a => `
                <span class="rp-badge">✓ ${escHtml(a)}</span>
              `).join('')}
              ${room.amenities.length > 3
                ? `<span class="rp-badge">+${room.amenities.length - 3} more</span>`
                : ''}
            </div>
          ` : ''}
          <div class="rp-flex-between" style="align-items:flex-end;">
            <div>
              <div class="rp-room-price">${pricePerNight}<span style="font-size:12px;font-weight:400;color:var(--rp-muted);"> /night</span></div>
              <div style="font-size:12px;color:var(--rp-muted);">Total: ${totalPrice}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="rp-badge">👥 Max ${room.maxOccupancy}</span>
            </div>
          </div>
          <button class="rp-btn rp-btn-primary" style="margin-top:14px;height:40px;font-size:14px;"
            data-action="book-now" data-room-id="${room.id}">
            Book Now
          </button>
        </div>
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
      case 'search':
        void this.fetchRooms()
        break
      case 'reset-search':
        this.setState({ searched: false, rooms: [], error: '' })
        break
      case 'book-now': {
        const roomId = btn.dataset.roomId!
        this.onBookNow(roomId)
        break
      }
    }
  }

  private handleChange(e: Event) {
    const target = e.target as HTMLInputElement
    const field = target.dataset.field
    if (!field) return

    if (field === 'checkIn') {
      const newCheckIn = target.value
      const nextDay = toDateStr(new Date(new Date(newCheckIn).getTime() + 86_400_000))
      const newCheckOut = this.state.checkOut <= newCheckIn ? nextDay : this.state.checkOut
      // Update checkout min without full re-render
      const coEl = this.container.querySelector<HTMLInputElement>('#rp-rooms-checkout')
      if (coEl) { coEl.min = newCheckIn; coEl.value = newCheckOut }
      this.state.checkIn = newCheckIn
      this.state.checkOut = newCheckOut
    } else if (field === 'checkOut') {
      this.state.checkOut = target.value
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private async fetchRooms() {
    const { checkIn, checkOut } = this.state
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      this.setState({ error: 'Please select a valid check-in and check-out date.', searched: false })
      return
    }
    this.setState({ loading: true, error: '', searched: false })
    try {
      const rooms = await api.availability(this.cfg.slug, checkIn, checkOut)
      this.setState({ rooms, loading: false, searched: true })
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err), searched: false })
    }
  }

  private onBookNow(roomId: string) {
    const { checkIn, checkOut } = this.state

    // Dispatch custom event regardless
    window.dispatchEvent(new CustomEvent('resortpro:book-room', {
      detail: { roomId, checkIn, checkOut },
      bubbles: true,
    }))

    // Also open modal if data-modal="true"
    if (this.useModal) {
      this.openModal(roomId, checkIn, checkOut)
    }
  }

  private openModal(roomId: string, checkIn: string, checkOut: string) {
    // Remove any existing modal
    const existing = document.getElementById('rp-modal-overlay')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'rp-modal-overlay'
    overlay.className = 'rp-modal-overlay'
    overlay.innerHTML = `
      <div class="rp-modal" style="position:relative;">
        <button class="rp-modal-close" id="rp-modal-close-btn" aria-label="Close">✕</button>
        <div id="rp-modal-booking-root"></div>
      </div>
    `

    document.body.appendChild(overlay)

    // Close on overlay backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal()
    })
    overlay.querySelector('#rp-modal-close-btn')!.addEventListener('click', () => {
      this.closeModal()
    })

    // Close on Escape
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.closeModal(); document.removeEventListener('keydown', escHandler) }
    }
    document.addEventListener('keydown', escHandler)

    // Mount BookingWidget inside the modal
    const root = overlay.querySelector<HTMLElement>('#rp-modal-booking-root')!
    const widgetConfig: WidgetConfig = {
      slug: this.cfg.slug,
      color: this.cfg.color,
      currency: this.cfg.currency,
      gateways: this.cfg.gateways || {
        bkash: false,
        ssl: false,
        stripe: false,
        manual: true,
      },
      checkIn,
      checkOut,
    }

    new BookingWidget(root, widgetConfig)

    // Pre-select the room after the widget initialises and fetches rooms
    // We listen for a custom "resortpro:rooms-loaded" that BookingWidget doesn't emit,
    // so instead we patch the widget's state after availability resolves by observing
    // the DOM for the room card and clicking it automatically.
    this.preselectRoom(root, roomId)
  }

  private preselectRoom(root: HTMLElement, roomId: string) {
    // Poll until the room card appears, then click it
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      const card = root.querySelector<HTMLElement>(`[data-room-id="${roomId}"][data-action="pick-room"]`)
      if (card) {
        card.click()
        clearInterval(interval)
      }
      if (attempts > 40) clearInterval(interval) // give up after ~4 seconds
    }, 100)
  }

  private closeModal() {
    const overlay = document.getElementById('rp-modal-overlay')
    if (overlay) overlay.remove()
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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

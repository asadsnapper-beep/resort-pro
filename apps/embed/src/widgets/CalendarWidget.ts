/**
 * CalendarWidget — monthly availability calendar with date-range selection.
 * Vanilla TypeScript, DOM-only, no framework.
 */

import { api, AvailabilityDay } from '../api/client'
import { today, parseDate } from '../utils/dom'
import { applyTheme } from '../utils/theme'

export interface CalConfig {
  slug: string
  color: string
  currency: string
  onSelect?: (date: string) => void
}

interface State {
  year: number
  month: number          // 0-based
  days: AvailabilityDay[]
  loading: boolean
  error: string
  checkIn: string | null
  checkOut: string | null
  selecting: 'checkIn' | 'checkOut'
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export class CalendarWidget {
  private container: HTMLElement
  private cfg: CalConfig
  private state: State

  constructor(container: HTMLElement, config: CalConfig) {
    this.container = container
    this.cfg = config

    const now = new Date()
    this.state = {
      year: now.getFullYear(),
      month: now.getMonth(),
      days: [],
      loading: false,
      error: '',
      checkIn: null,
      checkOut: null,
      selecting: 'checkIn',
    }

    applyTheme(this.container, config.color)

    this.container.addEventListener('click', this.handleClick.bind(this))

    void this.fetchMonth(this.state.year, this.state.month)
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render() {
    this.container.innerHTML = `
      <div class="rp-widget rp-card">
        <div class="rp-body">
          ${this.renderHeader()}
          ${this.state.loading
            ? '<div class="rp-spinner"></div>'
            : this.state.error
              ? `<div class="rp-error">${escHtml(this.state.error)}</div>`
              : this.renderGrid()
          }
          ${this.renderSelection()}
          ${this.renderBookButton()}
        </div>
      </div>
    `
  }

  private renderHeader(): string {
    const { year, month } = this.state
    return `
      <div class="rp-cal-header">
        <button class="rp-cal-nav" data-action="prev" aria-label="Previous month">&#8249;</button>
        <span style="font-weight:700;font-size:15px;">${MONTH_NAMES[month]} ${year}</span>
        <button class="rp-cal-nav" data-action="next" aria-label="Next month">&#8250;</button>
      </div>
    `
  }

  private renderGrid(): string {
    const { year, month, days, checkIn, checkOut } = this.state
    const todayStr = today()

    // Build a map for quick lookup
    const dayMap = new Map<string, AvailabilityDay>()
    for (const d of days) dayMap.set(d.date, d)

    // First weekday of month (0=Sun)
    const firstDow = new Date(year, month, 1).getDay()
    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const dayNames = DAY_NAMES.map(n =>
      `<div class="rp-cal-day-name">${n}</div>`
    ).join('')

    // Empty cells before day 1
    const blanks = Array(firstDow).fill('<div class="rp-cal-day empty"></div>').join('')

    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
      const info = dayMap.get(dateStr)
      const isPast = dateStr < todayStr

      let cls = 'rp-cal-day'
      let attrs = ''
      let title = ''

      if (isPast || !info) {
        cls += ' booked'
      } else if (!info.available) {
        cls += ' booked'
        title = 'Not available'
      } else {
        cls += ' available'
        attrs = `data-action="pick-date" data-date="${dateStr}"`
        if (info.price) title = formatMoney(info.price, this.cfg.currency)
      }

      // Range highlighting
      if (checkIn && checkIn === dateStr) cls += ' selected'
      else if (checkOut && checkOut === dateStr) cls += ' selected'
      else if (checkIn && checkOut && dateStr > checkIn && dateStr < checkOut) cls += ' in-range'

      // Today ring
      if (dateStr === todayStr) cls += ' today'

      return `<div class="${cls}" ${attrs} title="${escAttr(title)}">${day}</div>`
    }).join('')

    return `
      <div class="rp-cal-grid">
        ${dayNames}
        ${blanks}
        ${cells}
      </div>
    `
  }

  private renderSelection(): string {
    const { checkIn, checkOut, selecting } = this.state
    if (!checkIn && !checkOut) {
      return `<p style="margin-top:14px;font-size:12px;color:var(--rp-muted);text-align:center;">
        Click an available date to set check-in
      </p>`
    }

    return `
      <div class="rp-summary" style="margin-top:16px;margin-bottom:0;">
        <div class="rp-summary-row">
          <span style="color:var(--rp-muted);">Check-in</span>
          <span style="font-weight:${selecting === 'checkIn' ? '700' : '500'};">
            ${checkIn ?? '—'}
          </span>
        </div>
        <div class="rp-summary-row">
          <span style="color:var(--rp-muted);">Check-out</span>
          <span style="font-weight:${selecting === 'checkOut' ? '700' : '500'};">
            ${checkOut ?? '—'}
          </span>
        </div>
        ${checkIn ? `
          <div style="text-align:right;margin-top:6px;">
            <button class="rp-btn rp-btn-outline"
              style="height:28px;font-size:11px;padding:0 10px;width:auto;"
              data-action="clear">Clear</button>
          </div>
        ` : ''}
      </div>
    `
  }

  private renderBookButton(): string {
    const { checkIn, checkOut } = this.state
    if (!checkIn || !checkOut) return ''

    const nights = nightCount(checkIn, checkOut)
    return `
      <button class="rp-btn rp-btn-primary" style="margin-top:16px;" data-action="book">
        Book Selected Dates &nbsp;·&nbsp; ${nights} night${nights !== 1 ? 's' : ''}
      </button>
    `
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  private handleClick(e: Event) {
    const target = e.target as HTMLElement
    const btn = target.closest<HTMLElement>('[data-action]')
    if (!btn) return

    const action = btn.dataset.action!

    switch (action) {
      case 'prev':
        this.navigateMonth(-1)
        break
      case 'next':
        this.navigateMonth(1)
        break
      case 'pick-date': {
        const date = btn.dataset.date!
        this.pickDate(date)
        break
      }
      case 'clear':
        this.setState({ checkIn: null, checkOut: null, selecting: 'checkIn' })
        break
      case 'book':
        this.dispatchBooking()
        break
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private navigateMonth(delta: -1 | 1) {
    let { year, month } = this.state
    month += delta
    if (month < 0) { month = 11; year-- }
    if (month > 11) { month = 0; year++ }
    void this.fetchMonth(year, month)
  }

  private pickDate(date: string) {
    const { selecting, checkIn } = this.state

    if (selecting === 'checkIn') {
      this.setState({ checkIn: date, checkOut: null, selecting: 'checkOut' })
      this.cfg.onSelect?.(date)
    } else {
      // checkOut must be after checkIn
      if (checkIn && date <= checkIn) {
        // Treat as new checkIn
        this.setState({ checkIn: date, checkOut: null, selecting: 'checkOut' })
        this.cfg.onSelect?.(date)
      } else {
        this.setState({ checkOut: date, selecting: 'checkIn' })
        if (checkIn) {
          this.cfg.onSelect?.(date)
        }
      }
    }
  }

  private dispatchBooking() {
    const { checkIn, checkOut } = this.state
    if (!checkIn || !checkOut) return

    window.dispatchEvent(new CustomEvent('resortpro:dates-selected', {
      detail: { checkIn, checkOut },
      bubbles: true,
    }))
  }

  private async fetchMonth(year: number, month: number) {
    this.setState({ loading: true, error: '', year, month, days: [] })
    try {
      const days = await api.calendar(this.cfg.slug, year, month + 1) // API uses 1-based month
      this.setState({ loading: false, days })
    } catch (err) {
      this.setState({ loading: false, error: errorMessage(err) })
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private setState(patch: Partial<State>) {
    Object.assign(this.state, patch)
    this.render()
  }
}

// ── Utility functions ──────────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function nightCount(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round(
    (parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) / 86_400_000,
  ))
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

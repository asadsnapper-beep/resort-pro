/**
 * FloatingCta — fixed bottom-right "Book Now" button with optional WhatsApp link
 * and optional modal BookingWidget overlay.
 * Vanilla TypeScript, DOM-only, no framework.
 */

import { applyTheme } from '../utils/theme'
import { BookingWidget, WidgetConfig } from './BookingWidget'

export interface CtaConfig {
  slug: string
  color: string
  label?: string
  whatsapp?: string
  modalBooking?: boolean
  /** Passed through to BookingWidget when modalBooking=true */
  currency?: string
  gateways?: WidgetConfig['gateways']
}

const WHATSAPP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
  viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94
    1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.116 1.532 5.843L.054 23.447a.5.5 0 0 0 .611.61l5.598-1.474A11.947 11.947 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.519-5.21-1.42l-.373-.22-3.87 1.018 1.02-3.786-.238-.388A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
</svg>`

const CALENDAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
</svg>`

export class FloatingCta {
  private container: HTMLElement
  private cfg: CtaConfig

  constructor(container: HTMLElement, config: CtaConfig) {
    this.container = container
    this.cfg = config

    applyTheme(this.container, config.color)

    this.render()
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render() {
    const { label, whatsapp, color } = this.cfg
    const btnLabel = label ?? 'Book Now'

    this.container.innerHTML = `
      <div class="rp-float" id="rp-float-root">
        ${whatsapp ? this.renderWhatsApp(whatsapp) : ''}
        <button class="rp-float-btn" id="rp-float-book"
          style="background:${escAttr(color)};"
          aria-label="${escAttr(btnLabel)}">
          ${CALENDAR_SVG}
          ${escHtml(btnLabel)}
        </button>
      </div>
    `

    // floatEl available if needed: this.container.querySelector<HTMLElement>('#rp-float-root')

    this.container.querySelector('#rp-float-book')
      ?.addEventListener('click', () => this.onBookClick())
  }

  private renderWhatsApp(number: string): string {
    // Strip non-digits for the wa.me link
    const clean = number.replace(/\D/g, '')
    return `
      <a class="rp-whatsapp-btn" href="https://wa.me/${escAttr(clean)}"
        target="_blank" rel="noopener noreferrer"
        aria-label="Chat on WhatsApp">
        ${WHATSAPP_SVG}
        WhatsApp
      </a>
    `
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private onBookClick() {
    if (this.cfg.modalBooking) {
      this.openModal()
    } else {
      window.dispatchEvent(new CustomEvent('resortpro:open-booking', {
        detail: { slug: this.cfg.slug },
        bubbles: true,
      }))
    }
  }

  private openModal() {
    // Remove any existing modal
    document.getElementById('rp-float-modal-overlay')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'rp-float-modal-overlay'
    overlay.className = 'rp-modal-overlay'
    overlay.innerHTML = `
      <div class="rp-modal" style="position:relative;">
        <button class="rp-modal-close" id="rp-float-modal-close" aria-label="Close">✕</button>
        <div id="rp-float-booking-root"></div>
      </div>
    `

    document.body.appendChild(overlay)

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal()
    })

    // Close button
    overlay.querySelector('#rp-float-modal-close')
      ?.addEventListener('click', () => this.closeModal())

    // Escape key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeModal()
        document.removeEventListener('keydown', escHandler)
      }
    }
    document.addEventListener('keydown', escHandler)

    // Mount BookingWidget
    const root = overlay.querySelector<HTMLElement>('#rp-float-booking-root')!
    const widgetConfig: WidgetConfig = {
      slug: this.cfg.slug,
      color: this.cfg.color,
      currency: this.cfg.currency ?? 'USD',
      gateways: this.cfg.gateways ?? {
        bkash: false,
        ssl: false,
        stripe: false,
        manual: true,
      },
    }

    new BookingWidget(root, widgetConfig)
  }

  private closeModal() {
    document.getElementById('rp-float-modal-overlay')?.remove()
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

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}

/**
 * ResortPro Embed SDK — entry point
 *
 * Drop a single <script> tag on any website:
 *   <script src="https://cdn.resortpro.site/embed.js" defer></script>
 *
 * Then add one or more mount points:
 *   <div data-resortpro="booking"   data-slug="palm-paradise"></div>
 *   <div data-resortpro="rooms"     data-slug="palm-paradise"></div>
 *   <div data-resortpro="calendar"  data-slug="palm-paradise"></div>
 *   <div data-resortpro="menu"      data-slug="palm-paradise"></div>
 *   <div data-resortpro="cta"       data-slug="palm-paradise" data-whatsapp="+8801700000000"></div>
 *
 * Optional per-element overrides:
 *   data-color="#1a6b5e"     — primary brand color (falls back to server config)
 *   data-currency="BDT"     — currency code override
 *   data-lang="en"           — language (future i18n, default "en")
 */

import { api, EmbedConfig } from './api/client'
import { BookingWidget }  from './widgets/BookingWidget'
import { RoomsWidget }    from './widgets/RoomsWidget'
import { CalendarWidget } from './widgets/CalendarWidget'
import { MenuWidget }     from './widgets/MenuWidget'
import { FloatingCta }    from './widgets/FloatingCta'

// ── Types ─────────────────────────────────────────────────────────────────────

type WidgetType = 'booking' | 'rooms' | 'calendar' | 'menu' | 'cta'

interface MountOptions {
  el: HTMLElement
  type: WidgetType
  slug: string
  config: EmbedConfig
  /** Per-element color override from data-color attribute */
  colorOverride?: string
  /** Per-element currency override from data-currency attribute */
  currencyOverride?: string
  /** WhatsApp number (cta widget only) */
  whatsapp?: string
}

// ── Config cache — fetch once per slug ────────────────────────────────────────

const configCache = new Map<string, Promise<EmbedConfig>>()

function getConfig(slug: string): Promise<EmbedConfig> {
  if (!configCache.has(slug)) {
    configCache.set(slug, api.config(slug).catch(err => {
      // Evict on failure so the next attempt retries
      configCache.delete(slug)
      throw err
    }))
  }
  return configCache.get(slug)!
}

// ── Mount a single widget ─────────────────────────────────────────────────────

function mountWidget(opts: MountOptions) {
  const { el, type, config, colorOverride, currencyOverride, whatsapp } = opts

  // Merge per-element overrides on top of server config
  const mergedConfig: EmbedConfig = {
    ...config,
    color:    colorOverride ?? config.color,
    currency: currencyOverride ?? config.currency,
  }

  // Prevent double-mount (MutationObserver can fire multiple times)
  if (el.dataset.resortproMounted === '1') return
  el.dataset.resortproMounted = '1'

  switch (type) {
    case 'booking':
      new BookingWidget(el, mergedConfig)
      break

    case 'rooms':
      new RoomsWidget(el, mergedConfig)
      break

    case 'calendar':
      new CalendarWidget(el, mergedConfig)
      break

    case 'menu':
      new MenuWidget(el, mergedConfig)
      break

    case 'cta':
      new FloatingCta(el, {
        slug:     mergedConfig.slug,
        color:    mergedConfig.color,
        currency: mergedConfig.currency,
        whatsapp: whatsapp,
        gateways: mergedConfig.gateways,
      })
      break

    default:
      console.warn(`[ResortPro] Unknown widget type "${type}" on`, el)
  }
}

// ── Process a single DOM element ──────────────────────────────────────────────

async function processElement(el: HTMLElement) {
  const type   = el.dataset.resortpro as WidgetType | undefined
  const slug   = el.dataset.slug

  if (!type || !slug) {
    if (!slug && type) {
      console.error(`[ResortPro] data-slug is required on`, el)
    }
    return
  }

  // Show a subtle loading state while fetching config
  el.setAttribute('aria-busy', 'true')

  try {
    const config = await getConfig(slug)

    mountWidget({
      el,
      type,
      slug,
      config,
      colorOverride:    el.dataset.color    || undefined,
      currencyOverride: el.dataset.currency || undefined,
      whatsapp:         el.dataset.whatsapp || undefined,
    })
  } catch (err: any) {
    el.removeAttribute('aria-busy')
    renderError(el, slug, err?.message || 'Failed to load widget configuration')
  }
}

// ── Friendly error state inside the host element ──────────────────────────────

function renderError(el: HTMLElement, slug: string, message: string) {
  el.innerHTML = `
    <div style="
      font-family: system-ui, sans-serif;
      border: 1px solid #fca5a5;
      background: #fef2f2;
      color: #dc2626;
      border-radius: 8px;
      padding: 16px 20px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    ">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>
      </svg>
      <span>
        <strong>ResortPro widget failed to load</strong><br>
        <span style="opacity:.8">${message} — slug: <code style="font-size:12px">${slug}</code></span>
      </span>
    </div>
  `
}

// ── Scan and mount all existing widgets ───────────────────────────────────────

function scanAndMount(root: ParentNode = document) {
  const elements = root.querySelectorAll<HTMLElement>('[data-resortpro]:not([data-resortpro-mounted])')
  elements.forEach(el => processElement(el))
}

// ── Watch for dynamically-added widgets (SPA support) ─────────────────────────

function observeDynamicWidgets() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return

        // Check if the added node itself is a widget
        if (node.dataset.resortpro) {
          processElement(node)
        }

        // Check descendants
        node.querySelectorAll<HTMLElement>('[data-resortpro]:not([data-resortpro-mounted])').forEach(el => {
          processElement(el)
        })
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  return observer
}

// ── Public API exposed on window ──────────────────────────────────────────────

interface ResortProSDK {
  /** Re-scan the DOM for new widgets (call after dynamically adding HTML) */
  scan(): void
  /** Mount a specific widget on an element programmatically */
  mount(el: HTMLElement, type: WidgetType, slug: string, options?: {
    color?: string
    currency?: string
    whatsapp?: string
  }): Promise<void>
  /** Clear config cache (useful for testing) */
  clearCache(): void
  version: string
}

const ResortPro: ResortProSDK = {
  version: '__VERSION__',  // replaced by Vite define plugin or left as-is for dev

  scan() {
    scanAndMount()
  },

  async mount(el, type, slug, options = {}) {
    el.dataset.resortpro = type
    el.dataset.slug = slug
    if (options.color)    el.dataset.color = options.color
    if (options.currency) el.dataset.currency = options.currency
    if (options.whatsapp) el.dataset.whatsapp = options.whatsapp
    await processElement(el)
  },

  clearCache() {
    configCache.clear()
  },
}

// Expose on window for vanilla JS access
;(window as any).ResortPro = ResortPro

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  scanAndMount()
  observeDynamicWidgets()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  // DOM already ready (script loaded with defer or at bottom of body)
  boot()
}

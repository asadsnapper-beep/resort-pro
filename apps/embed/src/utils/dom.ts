/**
 * Lightweight DOM helpers — no framework dependency
 */

/** Create an element with classes and optional attributes */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v))
  return e
}

/** Create element with innerHTML */
export function html(tag: keyof HTMLElementTagNameMap, innerHTML: string, className?: string) {
  const e = document.createElement(tag)
  e.innerHTML = innerHTML
  if (className) e.className = className
  return e
}

/** Mount a shadow DOM on a host element for style isolation */
export function createShadow(host: Element): ShadowRoot {
  if (host.shadowRoot) return host.shadowRoot
  return host.attachShadow({ mode: 'open' })
}

/** Simple event emitter */
export class Emitter<Events extends Record<string, unknown>> {
  private listeners: Partial<{ [K in keyof Events]: Array<(data: Events[K]) => void> }> = {}

  on<K extends keyof Events>(event: K, cb: (data: Events[K]) => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event]!.push(cb)
    return () => this.off(event, cb)
  }

  off<K extends keyof Events>(event: K, cb: (data: Events[K]) => void) {
    const arr = this.listeners[event]
    if (arr) this.listeners[event] = arr.filter(f => f !== cb) as any
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    this.listeners[event]?.forEach(cb => cb(data))
  }
}

/** Format currency without Intl dependencies */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

/** Zero-pad a number */
export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** YYYY-MM-DD from a Date */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today as YYYY-MM-DD */
export function today(): string {
  return toDateStr(new Date())
}

/** Parse YYYY-MM-DD safely */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Night count between two YYYY-MM-DD strings */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(
    1,
    Math.round((parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) / 86_400_000),
  )
}

/** Inject CSS string into a shadow root or document head */
export function injectCSS(css: string, root: ShadowRoot | Document = document): HTMLStyleElement {
  const style = document.createElement('style')
  style.textContent = css
  const target = root instanceof Document ? root.head : root
  target.appendChild(style)
  return style
}

/** Load a script once (idempotent) */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

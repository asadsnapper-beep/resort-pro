/**
 * MenuWidget — restaurant menu with category filter, cart, and order form.
 * Vanilla TypeScript, DOM-only, no framework.
 */

import { api, MenuItem } from '../api/client'
import { formatMoney } from '../utils/dom'
import { applyTheme } from '../utils/theme'

export interface MenuConfig {
  slug: string
  color: string
  currency: string
  bookingRef?: string
}

interface CartItem {
  item: MenuItem
  qty: number
}

interface State {
  items: MenuItem[]
  loading: boolean
  error: string
  activeCategory: string
  cart: Map<string, CartItem>
  showOrderForm: boolean
  orderLoading: boolean
  orderError: string
  orderId: string | null
  orderTotal: number
}

export class MenuWidget {
  private container: HTMLElement
  private cfg: MenuConfig
  private state: State

  constructor(container: HTMLElement, config: MenuConfig) {
    this.container = container
    this.cfg = config

    this.state = {
      items: [],
      loading: false,
      error: '',
      activeCategory: 'All',
      cart: new Map(),
      showOrderForm: false,
      orderLoading: false,
      orderError: '',
      orderId: null,
      orderTotal: 0,
    }

    applyTheme(this.container, config.color)

    this.container.addEventListener('click', this.handleClick.bind(this))
    this.container.addEventListener('submit', this.handleSubmit.bind(this))

    void this.fetchMenu()
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render() {
    const { loading, error, orderId } = this.state

    if (orderId) {
      this.container.innerHTML = this.renderSuccess()
      return
    }

    this.container.innerHTML = `
      <div class="rp-widget">
        ${loading
          ? `<div class="rp-card rp-body"><div class="rp-spinner"></div></div>`
          : error
            ? `<div class="rp-card rp-body"><div class="rp-error">${escHtml(error)}</div></div>`
            : this.renderMenu()
        }
      </div>
    `

    // After render: preserve cart item qty inputs' values (no re-render on each keystroke)
  }

  private renderMenu(): string {
    const { items, activeCategory, cart } = this.state
    const cats = ['All', ...Array.from(new Set(items.map(i => i.category)))]
    const visible = activeCategory === 'All'
      ? items.filter(i => i.isAvailable)
      : items.filter(i => i.category === activeCategory && i.isAvailable)

    const itemsHtml = visible.length === 0
      ? `<div style="text-align:center;padding:40px 0;">
           <div style="font-size:36px;margin-bottom:8px;">🍽️</div>
           <p style="color:var(--rp-muted);">No items in this category.</p>
         </div>`
      : `<div class="rp-menu-grid">
           ${visible.map(item => this.renderItemCard(item, cart.get(item.id)?.qty ?? 0)).join('')}
         </div>`

    return `
      <div class="rp-card rp-body">
        <div class="rp-menu-cats" style="margin-bottom:16px;">
          ${cats.map(cat => `
            <button class="rp-cat-btn ${cat === activeCategory ? 'active' : ''}"
              data-action="filter" data-cat="${escAttr(cat)}">${escHtml(cat)}</button>
          `).join('')}
        </div>
        ${itemsHtml}
      </div>
      ${this.renderCart()}
    `
  }

  private renderItemCard(item: MenuItem, qty: number): string {
    const price = formatMoney(item.price, this.cfg.currency)
    const emoji = categoryEmoji(item.category)

    return `
      <div class="rp-menu-item">
        ${item.image
          ? `<img class="rp-menu-item-img" src="${escAttr(item.image)}" alt="${escAttr(item.name)}" loading="lazy" />`
          : `<div class="rp-menu-item-img"
               style="background:#f9fafb;display:flex;align-items:center;justify-content:center;font-size:40px;">
               ${emoji}
             </div>`
        }
        <div class="rp-menu-item-body">
          <div class="rp-menu-item-name">${escHtml(item.name)}</div>
          ${item.description
            ? `<div class="rp-menu-item-desc">${escHtml(item.description)}</div>`
            : ''
          }
          <div class="rp-menu-item-footer">
            <span class="rp-item-price">${price}</span>
            <div class="rp-qty-ctrl">
              ${qty > 0 ? `
                <button class="rp-qty-btn" data-action="qty-dec" data-item-id="${item.id}"
                  aria-label="Remove one">−</button>
                <span style="font-size:14px;font-weight:700;min-width:18px;text-align:center;"
                  id="rp-qty-${item.id}">${qty}</span>
              ` : ''}
              <button class="rp-qty-btn" data-action="qty-inc" data-item-id="${item.id}"
                aria-label="Add one">+</button>
            </div>
          </div>
        </div>
      </div>
    `
  }

  private renderCart(): string {
    const { cart, showOrderForm, orderLoading, orderError } = this.state
    if (cart.size === 0) return ''

    const cartItems = Array.from(cart.values())
    const total = cartItems.reduce((sum, ci) => sum + ci.item.price * ci.qty, 0)
    const totalFmt = formatMoney(total, this.cfg.currency)

    return `
      <div class="rp-card" style="margin-top:16px;">
        <div class="rp-body">
          <div class="rp-flex-between" style="margin-bottom:12px;">
            <span style="font-weight:700;font-size:16px;">Cart</span>
            <span style="font-weight:700;color:var(--rp-primary);">${totalFmt}</span>
          </div>
          <div class="rp-space-2">
            ${cartItems.map(ci => `
              <div class="rp-flex-between" style="font-size:13px;">
                <span>${escHtml(ci.item.name)}</span>
                <span style="color:var(--rp-muted);">
                  ${ci.qty} × ${formatMoney(ci.item.price, this.cfg.currency)}
                </span>
              </div>
            `).join('')}
          </div>

          ${!showOrderForm ? `
            <button class="rp-btn rp-btn-primary" style="margin-top:16px;" data-action="show-order-form">
              Place Order — ${totalFmt}
            </button>
          ` : this.renderOrderForm(totalFmt, orderLoading, orderError)}
        </div>
      </div>
    `
  }

  private renderOrderForm(totalFmt: string, loading: boolean, error: string): string {
    return `
      <form id="rp-order-form" style="margin-top:16px;" novalidate>
        <div class="rp-space-3">
          ${error ? `<div class="rp-error">${escHtml(error)}</div>` : ''}
          <div>
            <label class="rp-label" for="rp-guest-name">Your Name *</label>
            <input id="rp-guest-name" name="guestName" class="rp-input" type="text"
              placeholder="e.g. John Doe" required autocomplete="name" />
          </div>
          <div>
            <label class="rp-label" for="rp-guest-phone">Phone Number</label>
            <input id="rp-guest-phone" name="guestPhone" class="rp-input" type="tel"
              placeholder="+880 1700 000000" autocomplete="tel" />
          </div>
          <div class="rp-grid-2">
            <div>
              <label class="rp-label" for="rp-booking-ref">Booking Ref.</label>
              <input id="rp-booking-ref" name="bookingRef" class="rp-input" type="text"
                value="${escAttr(this.cfg.bookingRef ?? '')}"
                placeholder="Optional" />
            </div>
            <div>
              <label class="rp-label" for="rp-table-no">Table No.</label>
              <input id="rp-table-no" name="tableNo" class="rp-input" type="text"
                placeholder="e.g. 7" />
            </div>
          </div>
          <div class="rp-grid-2" style="gap:8px;">
            <button type="button" class="rp-btn rp-btn-outline" data-action="hide-order-form">
              Cancel
            </button>
            <button type="submit" class="rp-btn rp-btn-primary"
              style="height:40px;font-size:14px;" ${loading ? 'disabled' : ''}>
              ${loading ? 'Placing Order…' : `Confirm — ${totalFmt}`}
            </button>
          </div>
        </div>
      </form>
    `
  }

  private renderSuccess(): string {
    const { orderId, orderTotal } = this.state
    const totalFmt = formatMoney(orderTotal, this.cfg.currency)
    return `
      <div class="rp-widget">
        <div class="rp-card">
          <div class="rp-success">
            <div class="rp-success-icon">✅</div>
            <h2 style="font-size:20px;font-weight:700;margin-bottom:6px;">Order Placed!</h2>
            <p style="color:var(--rp-muted);font-size:13px;margin-bottom:20px;">
              Your order has been received by our kitchen.
            </p>
            <div style="text-align:left;border:1px solid var(--rp-border);border-radius:var(--rp-radius-sm);">
              <div class="rp-success-ref" style="padding:10px 16px;">
                <span style="color:var(--rp-muted);">Order ID</span>
                <span style="font-weight:700;font-family:monospace;">${escHtml(orderId!)}</span>
              </div>
              <div class="rp-success-ref" style="padding:10px 16px;border-bottom:none;">
                <span style="color:var(--rp-muted);">Total</span>
                <span style="font-weight:700;color:var(--rp-primary);">${totalFmt}</span>
              </div>
            </div>
            <button class="rp-btn rp-btn-outline" style="margin-top:24px;width:auto;padding:0 24px;"
              data-action="new-order">
              New Order
            </button>
          </div>
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
      case 'filter': {
        const cat = btn.dataset.cat!
        this.setState({ activeCategory: cat })
        break
      }
      case 'qty-inc': {
        const itemId = btn.dataset.itemId!
        this.adjustQty(itemId, 1)
        break
      }
      case 'qty-dec': {
        const itemId = btn.dataset.itemId!
        this.adjustQty(itemId, -1)
        break
      }
      case 'show-order-form':
        this.setState({ showOrderForm: true, orderError: '' })
        break
      case 'hide-order-form':
        this.setState({ showOrderForm: false, orderError: '' })
        break
      case 'new-order':
        this.setState({
          cart: new Map(),
          showOrderForm: false,
          orderId: null,
          orderTotal: 0,
          orderError: '',
          activeCategory: 'All',
        })
        break
    }
  }

  private handleSubmit(e: Event) {
    const form = e.target as HTMLElement
    if (form.id !== 'rp-order-form') return
    e.preventDefault()
    void this.placeOrder(form as HTMLFormElement)
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private adjustQty(itemId: string, delta: 1 | -1) {
    const cart = new Map(this.state.cart)
    const existing = cart.get(itemId)

    if (!existing) {
      if (delta < 0) return
      const item = this.state.items.find(i => i.id === itemId)
      if (!item) return
      cart.set(itemId, { item, qty: 1 })
    } else {
      const newQty = existing.qty + delta
      if (newQty <= 0) cart.delete(itemId)
      else cart.set(itemId, { ...existing, qty: newQty })
    }

    this.setState({ cart })
  }

  private async placeOrder(form: HTMLFormElement) {
    const get = (name: string) =>
      (form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? '').trim()

    const guestName = get('guestName')
    if (!guestName) {
      this.setState({ orderError: 'Please enter your name.' })
      return
    }

    const cartItems = Array.from(this.state.cart.values())
    if (cartItems.length === 0) {
      this.setState({ orderError: 'Your cart is empty.' })
      return
    }

    const total = cartItems.reduce((s, ci) => s + ci.item.price * ci.qty, 0)

    this.setState({ orderLoading: true, orderError: '' })
    try {
      const result = await api.order(this.cfg.slug, {
        guestName,
        guestPhone: get('guestPhone') || undefined,
        bookingRef: get('bookingRef') || undefined,
        tableNo: get('tableNo') || undefined,
        items: cartItems.map(ci => ({
          menuItemId: ci.item.id,
          quantity: ci.qty,
        })),
      })

      this.setState({
        orderLoading: false,
        orderId: result.orderId,
        orderTotal: result.total || total,
        cart: new Map(),
        showOrderForm: false,
      })
    } catch (err) {
      this.setState({ orderLoading: false, orderError: errorMessage(err) })
    }
  }

  private async fetchMenu() {
    this.setState({ loading: true, error: '' })
    try {
      const items = await api.menu(this.cfg.slug)
      this.setState({ loading: false, items })
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

function categoryEmoji(cat: string): string {
  const lower = cat.toLowerCase()
  if (lower.includes('drink') || lower.includes('beverage')) return '🥤'
  if (lower.includes('dessert') || lower.includes('sweet')) return '🍰'
  if (lower.includes('seafood') || lower.includes('fish')) return '🦞'
  if (lower.includes('breakfast')) return '🥞'
  if (lower.includes('soup')) return '🍜'
  if (lower.includes('salad')) return '🥗'
  if (lower.includes('pizza')) return '🍕'
  if (lower.includes('burger')) return '🍔'
  return '🍽️'
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

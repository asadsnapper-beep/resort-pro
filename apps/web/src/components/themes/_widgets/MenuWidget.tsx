'use client';

import { useState, useEffect } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, Send, CheckCircle, X,
  Utensils, UtensilsCrossed, Coffee, Beef, Cookie, Wine, Sandwich, Soup,
} from 'lucide-react';
import type { WidgetProps } from '../types';
import { foodImg } from '../_utils/images';

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  image?: string;
}

interface CartItem { item: MenuItem; quantity: number; notes: string; }

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

const CAT_ICONS: Record<string, React.ElementType> = {
  BREAKFAST: Coffee, LUNCH: Sandwich, DINNER: Beef,
  APPETIZER: Soup, DESSERT: Cookie, BEVERAGE: Wine,
  SPECIAL: Utensils,
};

const CAT_COLORS: Record<string, string> = {
  BREAKFAST: '#f59e0b', LUNCH: '#10b981', DINNER: '#6366f1',
  APPETIZER: '#ec4899', DESSERT: '#8b5cf6', BEVERAGE: '#14b8a6',
  SPECIAL: '#f97316',
};

/* ── MenuWidget ──────────────────────────────────────────────────────────────── */
export function MenuWidget({ slug, primaryColor, accentColor, currency }: WidgetProps) {
  const [menuItems, setMenuItems]     = useState<MenuItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]       = useState(false);
  const [orderForm, setOrderForm]     = useState({ guestName: '', roomNumber: '', bookingRef: '', email: '', notes: '' });
  const [submitting, setSubmitting]   = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderId: string; totalAmount: number; itemCount: number } | null>(null);
  const [error, setError]             = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/site/${slug}/menu`)
      .then(r => r.json())
      .then(j => { setMenuItems(j.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const categories   = ['ALL', ...Array.from(new Set(menuItems.map(i => i.category)))];
  const filtered     = activeCategory === 'ALL' ? menuItems : menuItems.filter(i => i.category === activeCategory);
  const cartTotal    = cart.reduce((s, ci) => s + Number(ci.item.price) * ci.quantity, 0);
  const cartCount    = cart.reduce((s, ci) => s + ci.quantity, 0);

  const addToCart = (item: MenuItem) => {
    setCart(c => {
      const existing = c.find(ci => ci.item.id === item.id);
      if (existing) return c.map(ci => ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...c, { item, quantity: 1, notes: '' }];
    });
    setCartOpen(true);
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(ci => ci.item.id !== id));
    else setCart(c => c.map(ci => ci.item.id === id ? { ...ci, quantity: qty } : ci));
  };

  const submitOrder = async () => {
    if (!orderForm.guestName) { setError('Please enter your name'); return; }
    if (!orderForm.roomNumber && !orderForm.bookingRef) {
      setError('Please provide your room number or booking reference'); return;
    }
    setError(''); setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/site/${slug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName:  orderForm.guestName,
          roomNumber: orderForm.roomNumber  || undefined,
          bookingRef: orderForm.bookingRef  || undefined,
          email:      orderForm.email       || undefined,
          notes:      orderForm.notes       || undefined,
          items: cart.map(ci => ({ menuItemId: ci.item.id, quantity: ci.quantity, notes: ci.notes || undefined })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Order failed'); setSubmitting(false); return; }
      setOrderSuccess(json.data);
      setCart([]);
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  if (loading) return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
          style={{ borderTopColor: primaryColor }} />
      </div>
    </section>
  );

  if (menuItems.length === 0) return null;

  return (
    <section id="menu" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>
            Restaurant
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Our Menu</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Freshly prepared dishes available for in-room dining and restaurant service
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap justify-center mb-10">
          {categories.map(cat => {
            const CatIcon = cat !== 'ALL' ? (CAT_ICONS[cat] ?? Utensils) : UtensilsCrossed;
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border-2"
                style={{
                  backgroundColor: isActive ? primaryColor : 'transparent',
                  borderColor:     isActive ? primaryColor : '#e5e7eb',
                  color:           isActive ? 'white' : '#6b7280',
                }}>
                <CatIcon className="h-3.5 w-3.5" />
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((item, i) => {
            const inCart   = cart.find(ci => ci.item.id === item.id);
            const catColor = CAT_COLORS[item.category] ?? '#6b7280';
            return (
              <div key={item.id}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
                <div className="relative h-40 overflow-hidden flex-shrink-0">
                  <img
                    src={foodImg(item.image, i)}
                    alt={item.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: catColor + 'dd' }}>
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-lg font-bold" style={{ color: primaryColor }}>
                      {fmt(Number(item.price), currency)}
                    </span>
                    {inCart ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(item.id, inCart.quantity - 1)}
                          className="h-7 w-7 rounded-full border-2 flex items-center justify-center hover:bg-gray-100"
                          style={{ borderColor: primaryColor }}>
                          <Minus className="h-3 w-3" style={{ color: primaryColor }} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold" style={{ color: primaryColor }}>
                          {inCart.quantity}
                        </span>
                        <button onClick={() => addToCart(item)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-white hover:opacity-90"
                          style={{ backgroundColor: primaryColor }}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:opacity-90 hover:scale-105 transition-all"
                        style={{ backgroundColor: primaryColor }}>
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Cart Button */}
        {cartCount > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)}
            className="fixed bottom-8 right-8 z-40 flex items-center gap-3 px-5 py-3.5 rounded-full text-white shadow-2xl hover:scale-105 transition-all"
            style={{ backgroundColor: primaryColor }}>
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold text-sm">View Order</span>
            <span className="flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold"
              style={{ backgroundColor: accentColor, color: '#1a1a1a' }}>
              {cartCount}
            </span>
          </button>
        )}

        {/* Cart Drawer */}
        {cartOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: primaryColor }}>
                <div className="flex items-center gap-2 text-white">
                  <ShoppingCart className="h-5 w-5" />
                  <h3 className="font-bold">Your Order</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{cartCount} items</span>
                </div>
                <button onClick={() => setCartOpen(false)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {orderSuccess ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                      style={{ backgroundColor: primaryColor + '20' }}>
                      <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Order Placed!</h3>
                    <p className="text-gray-500 mt-2 text-sm">Our kitchen will deliver to your room shortly.</p>
                    <div className="mt-6 w-full rounded-2xl p-4 text-left space-y-2" style={{ backgroundColor: primaryColor + '10' }}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Order ID</span>
                        <span className="font-mono font-bold text-xs" style={{ color: primaryColor }}>
                          {orderSuccess.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Items</span>
                        <span className="font-medium">{orderSuccess.itemCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-bold text-base">{fmt(orderSuccess.totalAmount, currency)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setOrderSuccess(null); setCartOpen(false);
                        setOrderForm({ guestName: '', roomNumber: '', bookingRef: '', email: '', notes: '' });
                      }}
                      className="mt-6 px-6 py-3 rounded-full text-white font-semibold text-sm"
                      style={{ backgroundColor: primaryColor }}>
                      Order More
                    </button>
                  </div>
                ) : (
                  <div className="p-6 space-y-5">
                    {cart.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Your cart is empty</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {cart.map(ci => (
                            <div key={ci.item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                              <img
                                src={foodImg(ci.item.image, menuItems.indexOf(ci.item))}
                                alt={ci.item.name}
                                className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{ci.item.name}</p>
                                <p className="text-xs text-gray-500">{fmt(Number(ci.item.price), currency)} each</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button onClick={() => updateQty(ci.item.id, ci.quantity - 1)}
                                  className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-white transition-colors">
                                  <Minus className="h-3 w-3 text-gray-500" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold text-gray-900">{ci.quantity}</span>
                                <button onClick={() => updateQty(ci.item.id, ci.quantity + 1)}
                                  className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-white transition-colors">
                                  <Plus className="h-3 w-3 text-gray-500" />
                                </button>
                                <button onClick={() => updateQty(ci.item.id, 0)}
                                  className="h-6 w-6 rounded-full flex items-center justify-center ml-1 hover:bg-red-50 transition-colors">
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center py-3 border-t border-gray-100">
                          <span className="font-semibold text-gray-700">Total</span>
                          <span className="text-xl font-bold" style={{ color: primaryColor }}>
                            {fmt(cartTotal, currency)}
                          </span>
                        </div>
                      </>
                    )}

                    {cart.length > 0 && (
                      <div className="space-y-4 pt-2 border-t border-gray-100">
                        <h4 className="font-semibold text-gray-900 text-sm">Delivery Details</h4>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Your Name *</label>
                          <input value={orderForm.guestName}
                            onChange={e => setOrderForm(p => ({ ...p, guestName: e.target.value }))}
                            placeholder="John Smith"
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Room Number</label>
                            <input value={orderForm.roomNumber}
                              onChange={e => setOrderForm(p => ({ ...p, roomNumber: e.target.value }))}
                              placeholder="e.g. 201"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Booking Ref</label>
                            <input value={orderForm.bookingRef}
                              onChange={e => setOrderForm(p => ({ ...p, bookingRef: e.target.value }))}
                              placeholder="e.g. BK-12345"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 -mt-2">Provide either your room number or booking reference</p>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email (optional)</label>
                          <input type="email" value={orderForm.email}
                            onChange={e => setOrderForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="For order updates"
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Special Instructions</label>
                          <textarea value={orderForm.notes}
                            onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))}
                            rows={2} placeholder="Allergies, spice level, dietary needs..."
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none" />
                        </div>
                        {error && <p className="text-red-500 text-xs">{error}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {cart.length > 0 && !orderSuccess && (
                <div className="border-t px-6 py-4">
                  <button onClick={submitOrder} disabled={submitting}
                    className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: primaryColor }}>
                    {submitting
                      ? 'Placing Order...'
                      : <><Send className="h-4 w-4" /> Place Order · {fmt(cartTotal, currency)}</>}
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Payment at delivery or charged to your room
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

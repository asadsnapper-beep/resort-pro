'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, CheckCircle2, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  image?: string;
}

interface Tenant {
  id: string;
  name: string;
  currency: string;
  logoUrl?: string;
}

interface TableInfo {
  id: string;
  tableNumber: number;
  label?: string;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface InitialData {
  tenant: Tenant;
  table: TableInfo;
  menuItems: MenuItem[];
}

const CATEGORIES = ['ALL', 'BREAKFAST', 'LUNCH', 'DINNER', 'APPETIZER', 'DESSERT', 'BEVERAGE', 'SPECIAL'];
const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'All', BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner',
  APPETIZER: 'Appetizer', DESSERT: 'Dessert', BEVERAGE: 'Beverage', SPECIAL: 'Special',
};

type Screen = 'menu' | 'cart' | 'confirm' | 'ready';

// ── Main component ────────────────────────────────────────────────────────────

export function TableOrderingApp({ slug, tableNumber, initialData }: {
  slug: string;
  tableNumber: number;
  initialData: InitialData;
}) {
  const { tenant, table, menuItems } = initialData;

  const [screen, setScreen] = useState<Screen>('menu');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currency = tenant.currency || 'BDT';

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-BD', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  const cartTotal = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // Available categories (only show categories that have items)
  const availableCategories = ['ALL', ...Array.from(new Set(menuItems.map(m => m.category)))];
  const filtered = activeCategory === 'ALL'
    ? menuItems
    : menuItems.filter(m => m.category === activeCategory);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(c => c.menuItem.id === id ? { ...c, quantity: c.quantity + delta } : c);
      return updated.filter(c => c.quantity > 0);
    });
  };

  const getQty = (id: string) => cart.find(c => c.menuItem.id === id)?.quantity ?? 0;

  // ── Place order ───────────────────────────────────────────────────────────

  const placeOrder = async () => {
    setPlacingOrder(true);
    setError(null);
    try {
      const res = await fetch(`${API}/table/${slug}/${tableNumber}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'CASH',
          items: cart.map(c => ({ menuItemId: c.menuItem.id, quantity: c.quantity, notes: c.notes })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to place order');
      setOrderId(json.data.order.id);
      setOrderNumber(json.data.order.id.slice(-6).toUpperCase());
      setScreen('confirm');
      startPolling(json.data.order.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  // ── Poll for READY status ─────────────────────────────────────────────────

  const startPolling = useCallback((oid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/table/order/${oid}/status`);
        const json = await res.json();
        if (json.data?.status === 'READY') {
          clearInterval(pollRef.current!);
          setScreen('ready');
          // Auto-reset after 90s
          resetRef.current = setTimeout(() => resetApp(), 90_000);
        }
      } catch {}
    }, 5000);
  }, []);

  const resetApp = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (resetRef.current) clearTimeout(resetRef.current);
    setCart([]);
    setOrderId(null);
    setOrderNumber(null);
    setScreen('menu');
    setError(null);
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  // ── Screens ───────────────────────────────────────────────────────────────

  if (screen === 'ready') return <ReadyScreen tableNumber={table.tableNumber} label={table.label} orderNumber={orderNumber!} onReset={resetApp} />;
  if (screen === 'confirm') return <ConfirmScreen orderNumber={orderNumber!} tableNumber={table.tableNumber} label={table.label} total={cartTotal} fmt={fmt} />;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          {tenant.logoUrl
            ? <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-xl object-cover" />
            : <div className="h-10 w-10 rounded-xl bg-emerald-700 flex items-center justify-center text-xl font-black">{tenant.name[0]}</div>
          }
          <div>
            <p className="font-black text-lg leading-tight">{tenant.name}</p>
            <p className="text-xs text-gray-400">Table {table.tableNumber}{table.label ? ` · ${table.label}` : ''}</p>
          </div>
        </div>

        {/* Cart button */}
        {cartCount > 0 && (
          <button
            onClick={() => setScreen('cart')}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all px-4 py-2.5 rounded-xl font-bold text-sm"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            <span className="opacity-75">·</span>
            <span>{fmt(cartTotal)}</span>
          </button>
        )}
      </header>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none bg-gray-900 shrink-0">
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeCategory === cat
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 active:bg-gray-700'
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600">
            <ChefHat className="h-12 w-12 mb-3" />
            <p>No items in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 flex flex-col">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-36 object-cover" />
                    : <div className="w-full h-36 bg-gray-800 flex items-center justify-center text-4xl">🍽️</div>
                  }
                  <div className="p-3 flex flex-col flex-1">
                    <p className="font-bold text-sm leading-tight">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <span className="font-black text-emerald-400">{fmt(item.price)}</span>
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="bg-emerald-600 active:bg-emerald-500 active:scale-95 transition-all p-2 rounded-xl"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeQty(item.id, -1)} className="bg-gray-700 active:bg-gray-600 p-1.5 rounded-lg">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-black w-5 text-center">{qty}</span>
                          <button onClick={() => changeQty(item.id, +1)} className="bg-emerald-600 active:bg-emerald-500 p-1.5 rounded-lg">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart screen (slide-over) */}
      {screen === 'cart' && (
        <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 bg-gray-900 border-b border-gray-800">
            <h2 className="text-xl font-black">Your Order</h2>
            <button onClick={() => setScreen('menu')} className="p-2 rounded-xl bg-gray-800">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(c => (
              <div key={c.menuItem.id} className="flex items-center gap-3 bg-gray-900 rounded-2xl p-4">
                <div className="flex-1">
                  <p className="font-bold">{c.menuItem.name}</p>
                  <p className="text-sm text-emerald-400">{fmt(c.menuItem.price)} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => changeQty(c.menuItem.id, -1)} className="bg-gray-700 p-2 rounded-xl">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-black text-lg w-6 text-center">{c.quantity}</span>
                  <button onClick={() => changeQty(c.menuItem.id, +1)} className="bg-emerald-600 p-2 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="font-black w-20 text-right">{fmt(c.menuItem.price * c.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="p-5 bg-gray-900 border-t border-gray-800 space-y-4">
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <div className="flex items-center justify-between text-lg font-black">
              <span>Total</span>
              <span className="text-emerald-400">{fmt(cartTotal)}</span>
            </div>
            <p className="text-xs text-gray-500 text-center">Payment will be collected when food is delivered</p>
            <button
              onClick={placeOrder}
              disabled={placingOrder || cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 transition-all py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2"
            >
              {placingOrder ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {placingOrder ? 'Placing order...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Confirm Screen ────────────────────────────────────────────────────────────

function ConfirmScreen({ orderNumber, tableNumber, label, total, fmt }: {
  orderNumber: string;
  tableNumber: number;
  label?: string;
  total: number;
  fmt: (n: number) => string;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="text-7xl mb-6">✅</div>
      <h1 className="text-3xl font-black mb-2">Order Placed!</h1>
      <p className="text-gray-400 mb-8">Your food is being prepared</p>

      <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm space-y-4 border border-gray-800">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Order Number</p>
          <p className="text-4xl font-black text-emerald-400 mt-1">#{orderNumber}</p>
        </div>
        <div className="border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Table</p>
          <p className="text-xl font-bold mt-1">Table {tableNumber}{label ? ` · ${label}` : ''}</p>
        </div>
        <div className="border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Total</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{fmt(total)}</p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 text-gray-500 text-sm animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Waiting for your food to be ready...</span>
      </div>
    </div>
  );
}

// ── Food Ready Screen ─────────────────────────────────────────────────────────

function ReadyScreen({ tableNumber, label, orderNumber, onReset }: {
  tableNumber: number;
  label?: string;
  orderNumber: string;
  onReset: () => void;
}) {
  const [countdown, setCountdown] = useState(90);

  useEffect(() => {
    const t = setInterval(() => setCountdown(n => {
      if (n <= 1) { clearInterval(t); onReset(); return 0; }
      return n - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onReset]);

  return (
    <div className="min-h-screen bg-emerald-900 text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="text-8xl mb-6 animate-bounce">🍽️</div>
      <h1 className="text-5xl font-black mb-3">Food is Ready!</h1>
      <p className="text-emerald-200 text-xl mb-2">Order #{orderNumber}</p>
      <p className="text-emerald-300 text-lg">
        Table {tableNumber}{label ? ` · ${label}` : ''}
      </p>

      <div className="mt-10 bg-emerald-800/60 rounded-2xl px-8 py-4 border border-emerald-700">
        <p className="text-emerald-200 text-sm">Enjoy your meal! 🙏</p>
        <p className="text-emerald-400 text-xs mt-1">Screen resets in {countdown}s</p>
      </div>

      <button
        onClick={onReset}
        className="mt-8 text-emerald-400 text-sm underline underline-offset-4"
      >
        Order again
      </button>
    </div>
  );
}

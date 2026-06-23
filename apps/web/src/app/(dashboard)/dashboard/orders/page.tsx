'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foodOrdersApi, menuApi, guestsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus, ShoppingBag, Clock, ChefHat, CheckCircle2, XCircle,
  Trash2, ChevronLeft, ChevronRight, UtensilsCrossed, Bell,
  Maximize2, Minimize2,
} from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  menuItem: { name: string; price: number };
}

interface FoodOrder {
  id: string;
  status: string;
  totalAmount: number;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  guest?: { firstName: string; lastName: string };
  items: OrderItem[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

const STATUS_FILTERS = ['', 'PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];

const STATUS_NEXT: Record<string, string | null> = {
  PENDING: 'PREPARING',
  PREPARING: 'READY',
  READY: 'DELIVERED',
  DELIVERED: null,
  CANCELLED: null,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Start Preparing',
  PREPARING: 'Mark Ready',
  READY: 'Mark Delivered',
};

// ── Kitchen status config ─────────────────────────────────────────────────────
const KITCHEN_STATUS: Record<string, { bg: string; border: string; label: string; dot: string }> = {
  PENDING:   { bg: 'bg-amber-50',  border: 'border-amber-400',  label: 'NEW ORDER',  dot: 'bg-amber-500' },
  PREPARING: { bg: 'bg-orange-50', border: 'border-orange-400', label: 'PREPARING',  dot: 'bg-orange-500' },
  READY:     { bg: 'bg-green-50',  border: 'border-green-400',  label: 'READY ✓',    dot: 'bg-green-500' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function minutesAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 min ago';
  return `${diff} min ago`;
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

// ── New Order Modal ───────────────────────────────────────────────────────────
function NewOrderModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const { data: menuData } = useQuery({ queryKey: ['menu-all'], queryFn: () => menuApi.list({ limit: 200 }) });
  const { data: guestsData } = useQuery({ queryKey: ['guests-list'], queryFn: () => guestsApi.list({ limit: 100 }) });
  const menuItems: MenuItem[] = (menuData?.data?.data ?? []).filter((i: MenuItem) => i.isAvailable);
  const guests = guestsData?.data?.data ?? [];

  const [guestId, setGuestId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<{ menuItemId: string; name: string; price: number; quantity: number; notes: string }[]>([]);

  useEffect(() => {
    if (open) { setGuestId(''); setTableNumber(''); setNotes(''); setCart([]); }
  }, [open]);

  const addToCart = (item: MenuItem) => {
    setCart(c => {
      const existing = c.find(i => i.menuItemId === item.id);
      if (existing) return c.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1, notes: '' }];
    });
  };

  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(i => i.menuItemId !== menuItemId));
    else setCart(c => c.map(i => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i));
  };

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) { toast({ title: 'Empty order', description: 'Add at least one item', variant: 'destructive' }); return; }
    onSubmit({
      guestId: guestId || undefined,
      tableNumber: tableNumber || undefined,
      notes: notes || undefined,
      items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
    });
  };

  const selectCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#18231f] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
  const inputCls  = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
  const labelCls  = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

  return (
    <Modal open={open} onClose={onClose} title="New F&B Order" description="Create a food & beverage order" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Guest (optional)</label>
            <select value={guestId} onChange={e => setGuestId(e.target.value)} className={selectCls}>
              <option value="">Walk-in</option>
              {guests.map((g: { id: string; firstName: string; lastName: string }) => (
                <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Table Number</label>
            <input className={inputCls} value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table 4, Room 201…" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Menu Items</label>
          <div className="max-h-48 overflow-y-auto rounded-[10px] border divide-y" style={{ borderColor: 'var(--rp-border)' }}>
            {menuItems.map((item: MenuItem) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#faf9f7] dark:hover:bg-white/5">
                <div>
                  <span className="text-[13px] font-medium text-[#18231f]">{item.name}</span>
                  <span className="ml-2 text-[11.5px] text-[#8aa29a]">{item.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#23766a]">{formatCurrency(Number(item.price))}</span>
                  <button type="button" onClick={() => addToCart(item)}
                    className="rounded-[7px] border px-[9px] py-[4px] text-[11.5px] font-medium transition-colors"
                    style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                    + Add
                  </button>
                </div>
              </div>
            ))}
            {menuItems.length === 0 && <p className="py-4 text-center text-[13px] text-[#8aa29a]">No available menu items</p>}
          </div>
        </div>
        {cart.length > 0 && (
          <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--rp-border)' }}>
            <div className="px-3 py-2 border-b text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]"
              style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>Order Summary</div>
            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
              {cart.map(item => (
                <div key={item.menuItemId} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-[13px] font-medium text-[#18231f]">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-[6px] border text-[12px] hover:bg-[#f4f1eb]"
                      style={{ borderColor: 'var(--rp-border-md)' }}>−</button>
                    <span className="w-6 text-center text-[13px] font-medium text-[#18231f]">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-[6px] border text-[12px] hover:bg-[#f4f1eb]"
                      style={{ borderColor: 'var(--rp-border-md)' }}>+</button>
                  </div>
                  <span className="w-16 text-right text-[13px] font-semibold text-[#18231f]">{formatCurrency(item.price * item.quantity)}</span>
                  <button type="button" onClick={() => updateQty(item.menuItemId, 0)} className="text-[#c5bdb4] hover:text-[#c43c3c]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
              <span className="text-[13px] font-semibold text-[#18231f]">Total</span>
              <span className="text-[13px] font-bold text-[#23766a]">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Order Notes</label>
          <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, preferences…" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--rp-border)' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-[8px] text-[13px] font-medium text-[#6b8880] hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading || cart.length === 0}
            className="rounded-[9px] px-4 py-[8px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--rp-btn-accent)' }}>
            {loading ? 'Placing…' : `Place Order (${cart.length} item${cart.length !== 1 ? 's' : ''} · ${formatCurrency(total)})`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ORDER_STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  PENDING:   { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Pending' },
  PREPARING: { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Preparing' },
  READY:     { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Ready' },
  DELIVERED: { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Delivered' },
  CANCELLED: { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Cancelled' },
};

// ── Standard order card (non-chef) ───────────────────────────────────────────
function OrderCard({ order, expanded, onToggleExpand }: {
  order: FoodOrder; expanded: boolean; onToggleExpand: () => void;
}) {
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => foodOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-orders'] });
      queryClient.invalidateQueries({ queryKey: ['food-orders-stats'] });
      toast({ title: 'Order updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update order', variant: 'destructive' }),
  });
  const nextStatus = STATUS_NEXT[order.status];
  const cfg = ORDER_STATUS_PILL[order.status] ?? ORDER_STATUS_PILL.PENDING;

  return (
    <div className="rounded-[14px] border bg-white overflow-hidden transition-shadow hover:shadow-sm"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
                {cfg.label}
              </span>
              {order.guest && (
                <span className="text-[13.5px] font-medium text-[#18231f]">
                  {order.guest.firstName} {order.guest.lastName}
                </span>
              )}
              {order.tableNumber && (
                <span className="rounded-[6px] border px-[8px] py-[3px] text-[11.5px] text-[#6b8880]"
                  style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)' }}>
                  📍 {order.tableNumber}
                </span>
              )}
              <span className="text-[12px] text-[#8aa29a] ml-auto">{formatDate(order.createdAt)}</span>
            </div>
            <button className="mt-1 text-left" onClick={onToggleExpand}>
              <p className="text-[12px] text-[#23766a] hover:underline">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {formatCurrency(Number(order.totalAmount))}
                {expanded ? ' ▲' : ' ▼'}
              </p>
            </button>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {nextStatus && (
              <button
                onClick={() => statusMutation.mutate({ id: order.id, status: nextStatus })}
                disabled={statusMutation.isPending}
                className="rounded-[8px] border px-[12px] py-[6px] text-[12px] font-medium transition-colors"
                style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                {STATUS_LABEL[order.status]}
              </button>
            )}
            {(order.status === 'PENDING' || order.status === 'PREPARING') && (
              <button
                onClick={() => statusMutation.mutate({ id: order.id, status: 'CANCELLED' })}
                disabled={statusMutation.isPending}
                className="rounded-[8px] border p-[6px] transition-colors"
                style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.18)', color: '#c43c3c' }}>
                <XCircle className="h-[14px] w-[14px]" />
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--rp-border)' }}>
            {order.items.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-[13px] text-[#18231f]">{item.quantity}× {item.menuItem.name}</span>
                <span className="text-[13px] font-medium text-[#18231f]">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
              </div>
            ))}
            {order.notes && <p className="text-[11.5px] text-[#8aa29a] mt-1 italic">📝 {order.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kitchen Display Card (Chef mode) ─────────────────────────────────────────
function KitchenCard({ order }: { order: FoodOrder }) {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  // Update time display every minute
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => foodOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-orders-today'] });
      queryClient.invalidateQueries({ queryKey: ['food-orders-stats'] });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const cfg = KITCHEN_STATUS[order.status] ?? KITCHEN_STATUS['PENDING'];
  const nextStatus = STATUS_NEXT[order.status];
  const nextLabel = STATUS_LABEL[order.status];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void tick; // force re-render for live time

  return (
    <div className={cn(
      'rounded-2xl border-2 p-5 transition-all',
      cfg.bg, cfg.border,
      order.status === 'PENDING' && 'shadow-lg shadow-amber-100',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', cfg.dot)} />
            <span className="text-xs font-bold tracking-widest text-gray-500">{cfg.label}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {order.tableNumber && (
              <span className="bg-gray-900 text-white text-xl font-black px-3 py-1 rounded-xl">
                Table {order.tableNumber}
              </span>
            )}
            {order.guest && (
              <span className="text-lg font-semibold text-gray-700">{order.guest.firstName} {order.guest.lastName}</span>
            )}
            {!order.tableNumber && !order.guest && (
              <span className="text-2xl font-black text-gray-900">Walk-in</span>
            )}
          </div>
          {(order as any).paymentStatus && (order as any).paymentStatus !== 'PAID' && (
            <span className="mt-1 inline-block text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              Unpaid
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{minutesAgo(order.createdAt)}</span>
      </div>

      {/* Items — large, easy to read */}
      <div className="space-y-2 mb-4">
        {order.items.map(item => (
          <div key={item.id} className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-gray-900 w-10 shrink-0">{item.quantity}×</span>
            <span className="text-xl font-bold text-gray-800 leading-tight">{item.menuItem.name}</span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="mb-4 rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2">
          <p className="text-sm font-semibold text-yellow-800">📝 {order.notes}</p>
        </div>
      )}

      {/* Action button */}
      {nextStatus && (
        <button
          onClick={() => statusMutation.mutate({ id: order.id, status: nextStatus })}
          disabled={statusMutation.isPending}
          className={cn(
            'w-full rounded-xl py-4 text-lg font-bold transition-all active:scale-95',
            order.status === 'PENDING'   && 'bg-orange-500 hover:bg-orange-600 text-white shadow-md',
            order.status === 'PREPARING' && 'bg-green-500 hover:bg-green-600 text-white shadow-md',
            order.status === 'READY'     && 'bg-blue-500 hover:bg-blue-600 text-white shadow-md',
            statusMutation.isPending && 'opacity-60 cursor-not-allowed',
          )}>
          {statusMutation.isPending ? '...' : nextLabel}
        </button>
      )}
      {order.status === 'READY' && (
        <div className="mt-2 text-center text-sm font-semibold text-green-600">✓ Waiting for delivery</div>
      )}
    </div>
  );
}

// ── Kitchen Display (Chef view) ───────────────────────────────────────────────
function KitchenDisplay() {
  const queryClient = useQueryClient();
  const prevCountRef = useRef(0);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [clock, setClock] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll every 15 seconds
  const { data, isLoading } = useQuery({
    queryKey: ['food-orders-today'],
    queryFn: () => foodOrdersApi.list({ limit: 100 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: statsData } = useQuery({
    queryKey: ['food-orders-stats'],
    queryFn: () => foodOrdersApi.stats(),
    refetchInterval: 15000,
  });

  // All today's active orders (not delivered/cancelled)
  const allOrders: FoodOrder[] = (data?.data?.data ?? []).filter(
    (o: FoodOrder) => isToday(o.createdAt) && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  );

  // Sort: PENDING first, then PREPARING, then READY
  const ORDER_PRIORITY: Record<string, number> = { PENDING: 0, PREPARING: 1, READY: 2 };
  const orders = [...allOrders].sort((a, b) =>
    (ORDER_PRIORITY[a.status] ?? 9) - (ORDER_PRIORITY[b.status] ?? 9) ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Flash alert when new orders arrive
  useEffect(() => {
    const pending = orders.filter(o => o.status === 'PENDING').length;
    if (pending > prevCountRef.current) {
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 3000);
    }
    prevCountRef.current = pending;
  }, [orders]);

  const stats = statsData?.data?.data ?? {};
  const pendingCount   = stats.pending   ?? 0;
  const preparingCount = stats.preparing ?? 0;
  const readyCount     = stats.ready     ?? 0;

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-950 text-white p-4 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Kitchen Display</h1>
            <p className="text-xs text-gray-400">Live order queue — auto refreshes every 15s</p>
          </div>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          >
            {isFullscreen
              ? <Minimize2 className="h-4 w-4" />
              : <Maximize2 className="h-4 w-4" />
            }
          </button>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums">
            {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-gray-400">{clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
      </div>

      {/* New order alert */}
      {newOrderAlert && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-500 px-4 py-3 animate-pulse">
          <Bell className="h-5 w-5 text-white" />
          <span className="font-bold text-white text-lg">🔔 New order received!</span>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'NEW', value: pendingCount,   bg: 'bg-amber-500/20 border-amber-500/40',  text: 'text-amber-400' },
          { label: 'PREPARING', value: preparingCount, bg: 'bg-orange-500/20 border-orange-500/40', text: 'text-orange-400' },
          { label: 'READY', value: readyCount,    bg: 'bg-green-500/20 border-green-500/40',  text: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border px-4 py-3 text-center', s.bg)}>
            <p className={cn('text-3xl font-black', s.text)}>{s.value}</p>
            <p className="text-xs text-gray-400 font-semibold tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-gray-800 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ChefHat className="h-16 w-16 text-gray-700 mb-4" />
          <p className="text-2xl font-bold text-gray-500">All caught up!</p>
          <p className="text-gray-600 mt-2">No active orders right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(order => (
            <KitchenCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Refresh indicator */}
      <div className="text-center text-xs text-gray-600">
        Last updated: {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        {' · '}
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['food-orders-today'] })}
          className="text-gray-500 hover:text-gray-300 underline">
          Refresh now
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user } = useAuthStore();
  const isChef = user?.role === 'CHEF';

  // Chef sees Kitchen Display
  if (isChef) return <KitchenDisplay />;

  // ── Standard view (non-Chef) ──────────────────────────────────────────────
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['food-orders', statusFilter, page],
    queryFn: () => foodOrdersApi.list({ status: statusFilter || undefined, page, limit: 20 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['food-orders-stats'],
    queryFn: () => foodOrdersApi.stats(),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => foodOrdersApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-orders'] });
      queryClient.invalidateQueries({ queryKey: ['food-orders-stats'] });
      toast({ title: 'Order placed!' });
      setAddOpen(false);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to place order', variant: 'destructive' }),
  });

  const orders: FoodOrder[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;
  const stats = statsData?.data?.data ?? {};

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">F&B Orders</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Food & beverage order management</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
          style={{ background: 'var(--rp-btn-accent)' }}>
          <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> New Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Orders', value: total,                icon: ShoppingBag, bg: 'var(--rp-teal-bg)', color: '#23766a' },
          { label: 'Pending',      value: stats.pending   ?? 0, icon: Clock,       bg: 'var(--rp-amber-bg)', color: '#b89040' },
          { label: 'Preparing',    value: stats.preparing ?? 0, icon: ChefHat,     bg: 'var(--rp-coral-bg)', color: '#b8724a' },
          { label: 'Ready',        value: stats.ready     ?? 0, icon: CheckCircle2,bg: 'var(--rp-teal-bg)', color: '#23766a' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: bg }}>
              <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">{label}</div>
              <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#18231f]">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className="rounded-[8px] border px-[12px] py-[7px] text-[12px] font-medium transition-colors"
            style={statusFilter === s
              ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#1b342f' }
              : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
            {s ? ORDER_STATUS_PILL[s]?.label ?? s : 'All'}
          </button>
        ))}
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[14px]" style={{ background: 'var(--rp-surface-3)' }} />
          ))
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center rounded-[14px] border-2 border-dashed"
            style={{ borderColor: 'var(--rp-border)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
              <ShoppingBag className="h-7 w-7 text-[#c5bdb4]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#18231f]">
                {statusFilter ? 'No orders with this status' : 'No orders yet'}
              </p>
              <p className="mt-1 text-[12.5px] text-[#8aa29a]">
                {statusFilter ? 'Try a different filter' : 'Place your first food order'}
              </p>
            </div>
            {!statusFilter && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0]"
                style={{ background: 'var(--rp-btn-accent)' }}>
                <Plus className="h-[13px] w-[13px]" /> New Order
              </button>
            )}
          </div>
        ) : (
          orders.map(order => (
            <OrderCard key={order.id} order={order} expanded={expanded === order.id}
              onToggleExpand={() => setExpanded(expanded === order.id ? null : order.id)} />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8aa29a]">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex h-8 items-center gap-1 rounded-[8px] border px-3 text-[12.5px] font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="flex h-8 items-center gap-1 rounded-[8px] border px-3 text-[12.5px] font-medium disabled:opacity-40"
              style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <NewOrderModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
    </div>
  );
}

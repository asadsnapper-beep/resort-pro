'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foodOrdersApi, menuApi, guestsApi, bookingsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ModalShell } from '@/components/ui/modal-shell';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  Plus, ShoppingBag, Clock, ChefHat, CheckCircle2, XCircle,
  Trash2, ChevronLeft, ChevronRight, UtensilsCrossed, Bell,
  Maximize2, Minimize2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  menuItem: { name: string; price: number };
}

interface InHouseStay {
  id: string;
  confirmationNo: string;
  checkOut: string;
  room: { id: string; number: string; name: string } | null;
  guest: { id: string; firstName: string; lastName: string } | null;
}

interface FoodOrder {
  id: string;
  status: string;
  paymentStatus: string;
  settlement?: string;
  bookingId?: string | null;
  totalAmount: number;
  tableNumber?: string;
  notes?: string;
  createdAt: string;
  guest?: { firstName: string; lastName: string };
  items: OrderItem[];
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
];

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

// Complimentary and corporate settlements exist in the data model but the API
// refuses them until their billing does: see plan/restaurant-room-billing.md §2.
const SETTLEMENT_CHOICES = [
  { value: 'PAY_NOW' as const, label: 'Restaurant guest', hint: 'Collect payment now' },
  { value: 'CHARGE_TO_ROOM' as const, label: 'Staying with us', hint: 'Charge to the room' },
];

// ── New Order Modal ───────────────────────────────────────────────────────────
function NewOrderModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const { data: menuData } = useQuery({ queryKey: ['menu-all'], queryFn: () => menuApi.list({ limit: 200 }) });
  const { data: guestsData } = useQuery({ queryKey: ['guests-list'], queryFn: () => guestsApi.list({ limit: 100 }) });
  const menuItems: MenuItem[] = (menuData?.data?.data ?? []).filter((i: MenuItem) => i.isAvailable);
  const guests = guestsData?.data?.data ?? [];

  const [settlement, setSettlement] = useState<'PAY_NOW' | 'CHARGE_TO_ROOM'>('PAY_NOW');
  const [guestId, setGuestId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [staySearch, setStaySearch] = useState('');
  const [stay, setStay] = useState<InHouseStay | null>(null);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<{ menuItemId: string; name: string; price: number; quantity: number; notes: string }[]>([]);
  // One key per order being composed, so a double-click or a retry over a bad
  // connection lands as one order rather than two.
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    if (open) {
      setSettlement('PAY_NOW'); setGuestId(''); setTableNumber('');
      setStaySearch(''); setStay(null); setNotes(''); setCart([]);
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open]);

  // Only guests who are in the building — asked for as the waiter types.
  const debouncedStaySearch = useDebounce(staySearch, 250);
  const { data: staysData, isFetching: staysLoading } = useQuery({
    queryKey: ['in-house-stays', debouncedStaySearch],
    queryFn: () => bookingsApi.inHouse(debouncedStaySearch || undefined),
    enabled: open && settlement === 'CHARGE_TO_ROOM',
  });
  const stays: InHouseStay[] = staysData?.data?.data ?? [];

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
    if (settlement === 'CHARGE_TO_ROOM' && !stay) {
      toast({ title: 'Which room?', description: 'Choose the stay this order is charged to', variant: 'destructive' });
      return;
    }
    onSubmit({
      settlement,
      // The room and the guest come from the stay itself — the server reads them
      // from the booking and ignores anything sent alongside.
      ...(settlement === 'CHARGE_TO_ROOM'
        ? { bookingId: stay!.id }
        : { guestId: guestId || undefined, tableNumber: tableNumber || undefined }),
      idempotencyKey,
      notes: notes || undefined,
      items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
    });
  };

  const selectCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[8px] text-[13px] text-[#183153] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
  const inputCls  = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#183153] placeholder:text-[#64748b] focus:outline-none focus:ring-1 focus:ring-resort-600/20';
  const labelCls  = 'block text-[11.5px] font-medium text-[#64748b] mb-1.5';

  return (
    <Modal open={open} onClose={onClose} title="New F&B Order" description="Create a food & beverage order" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className={labelCls}>Who is this order for?</label>
          <div className="grid grid-cols-2 gap-2">
            {SETTLEMENT_CHOICES.map(choice => (
              <button
                key={choice.value}
                type="button"
                onClick={() => setSettlement(choice.value)}
                className={cn(
                  'rounded-rp-ctrl border px-3 py-2 text-left transition-colors',
                  settlement === choice.value
                    ? 'border-rp-brand bg-rp-teal-bg'
                    : 'border-rp-border-md bg-rp-surface-3 hover:bg-rp-surface-4',
                )}
              >
                <span className="block text-rp-body font-medium text-rp-text">{choice.label}</span>
                <span className="block text-rp-label text-rp-muted">{choice.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {settlement === 'PAY_NOW' ? (
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
              <input className={inputCls} value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table 4" />
            </div>
          </div>
        ) : stay ? (
          <div className="flex items-center justify-between rounded-rp-ctrl border border-rp-brand bg-rp-teal-bg px-3 py-2">
            <span className="text-rp-body font-medium text-rp-text">
              {stay.room ? `Room ${stay.room.number}` : stay.confirmationNo}
              {stay.guest && ` · ${stay.guest.firstName} ${stay.guest.lastName}`}
              <span className="text-rp-label font-normal text-rp-muted"> · until {formatDate(stay.checkOut)}</span>
            </span>
            <button type="button" onClick={() => { setStay(null); setStaySearch(''); }}
              className="text-rp-label font-medium text-rp-muted hover:text-rp-text">
              Change
            </button>
          </div>
        ) : (
          <div>
            <label className={labelCls}>Which room?</label>
            <input
              className={inputCls}
              value={staySearch}
              onChange={e => setStaySearch(e.target.value)}
              placeholder="Room number, guest name, or confirmation no."
              autoFocus
            />
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-rp-panel border border-rp-border divide-y divide-rp-border">
              {stays.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStay(s)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-rp-surface-2"
                >
                  <span className="text-rp-body font-medium text-rp-text">
                    {s.room ? `Room ${s.room.number}` : s.confirmationNo}
                    {s.guest && <span className="font-normal text-rp-muted"> · {s.guest.firstName} {s.guest.lastName}</span>}
                  </span>
                  <span className="text-rp-label text-rp-muted">until {formatDate(s.checkOut)}</span>
                </button>
              ))}
              {stays.length === 0 && (
                <p className="py-4 text-center text-rp-body text-rp-muted">
                  {staysLoading ? 'Looking…' : staySearch ? 'No one staying matches that' : 'No guests are checked in'}
                </p>
              )}
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Menu Items</label>
          <div className="max-h-48 overflow-y-auto rounded-[10px] border divide-y" style={{ borderColor: 'var(--rp-border)' }}>
            {menuItems.map((item: MenuItem) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#faf9f7] dark:hover:bg-white/5">
                <div>
                  <span className="text-[13px] font-medium text-[#183153]">{item.name}</span>
                  <span className="ml-2 text-[11.5px] text-[#64748b]">{item.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#183153]">{formatCurrency(Number(item.price))}</span>
                  <button type="button" onClick={() => addToCart(item)}
                    className="rounded-[7px] border px-[9px] py-[4px] text-[11.5px] font-medium transition-colors"
                    style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)', color: '#183153' }}>
                    + Add
                  </button>
                </div>
              </div>
            ))}
            {menuItems.length === 0 && <p className="py-4 text-center text-[13px] text-[#64748b]">No available menu items</p>}
          </div>
        </div>
        {cart.length > 0 && (
          <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--rp-border)' }}>
            <div className="px-3 py-2 border-b text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#64748b]"
              style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>Order Summary</div>
            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
              {cart.map(item => (
                <div key={item.menuItemId} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-[13px] font-medium text-[#183153]">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-[6px] border text-[12px] hover:bg-[#f4f1eb]"
                      style={{ borderColor: 'var(--rp-border-md)' }}>−</button>
                    <span className="w-6 text-center text-[13px] font-medium text-[#183153]">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-[6px] border text-[12px] hover:bg-[#f4f1eb]"
                      style={{ borderColor: 'var(--rp-border-md)' }}>+</button>
                  </div>
                  <span className="w-16 text-right text-[13px] font-semibold text-[#183153]">{formatCurrency(item.price * item.quantity)}</span>
                  <button type="button" onClick={() => updateQty(item.menuItemId, 0)} className="text-[#94a3b8] hover:text-[#c43c3c]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
              <span className="text-[13px] font-semibold text-[#183153]">Total</span>
              <span className="text-[13px] font-bold text-[#183153]">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Order Notes</label>
          <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, preferences…" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--rp-border)' }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-[8px] text-[13px] font-medium text-[#64748b] hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading || cart.length === 0}
            className="rounded-[9px] px-4 py-[8px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80 disabled:opacity-40"
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
  READY:     { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', label: 'Ready' },
  DELIVERED: { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', label: 'Delivered' },
  CANCELLED: { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Cancelled' },
};

// ── Standard order card (non-chef) ───────────────────────────────────────────
function OrderCard({ order, expanded, onToggleExpand }: {
  order: FoodOrder; expanded: boolean; onToggleExpand: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canVoid = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const [payMethod, setPayMethod] = useState('CASH');
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      foodOrdersApi.updateStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-orders'] });
      queryClient.invalidateQueries({ queryKey: ['food-orders-stats'] });
      setVoidOpen(false);
      setVoidReason('');
      toast({ title: 'Order updated' });
    },
    onError: (err: unknown) => toast({
      title: 'Error',
      description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to update order',
      variant: 'destructive',
    }),
  });
  const markPaidMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => foodOrdersApi.markPaid(id, method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-orders'] });
      toast({ title: 'Marked as paid' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' }),
  });
  const nextStatus = STATUS_NEXT[order.status];
  const cfg = ORDER_STATUS_PILL[order.status] ?? ORDER_STATUS_PILL.PENDING;
  // An order charged to a room is settled at checkout, not at the counter —
  // asking the front desk to collect for it would collect it twice.
  //
  // The test is the bookingId, not the settlement label, because bill() bills
  // by bookingId: any unpaid order attached to a stay reaches that stay's
  // invoice whatever it calls itself. Trusting the label instead would make a
  // mislabelled row ask for cash the guest is also billed for at checkout.
  const chargedToRoom = !!order.bookingId;
  const needsPaymentAction = !chargedToRoom && order.paymentStatus && order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';

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
              {needsPaymentAction && (
                <span className="inline-flex items-center rounded-rp-xs border border-red-200/20 px-[10px] py-[4px] text-rp-micro font-semibold bg-rp-red-bg text-rp-danger">
                  Unpaid
                </span>
              )}
              {chargedToRoom && order.status !== 'CANCELLED' && (
                <span className="inline-flex items-center rounded-rp-xs border border-rp-border-md bg-rp-surface-3 px-[10px] py-[4px] text-rp-micro font-semibold text-rp-text">
                  On the room
                </span>
              )}
              {order.guest && (
                <span className="text-[13.5px] font-medium text-[#183153]">
                  {order.guest.firstName} {order.guest.lastName}
                </span>
              )}
              {order.tableNumber && (
                <span className="rounded-[6px] border px-[8px] py-[3px] text-[11.5px] text-[#64748b]"
                  style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)' }}>
                  📍 {order.tableNumber}
                </span>
              )}
              <span className="text-[12px] text-[#64748b] ml-auto">{formatDate(order.createdAt)}</span>
            </div>
            <button className="mt-1 text-left" onClick={onToggleExpand}>
              <p className="text-[12px] text-[#183153] hover:underline">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {formatCurrency(Number(order.totalAmount))}
                {expanded ? ' ▲' : ' ▼'}
              </p>
            </button>
            {needsPaymentAction && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="rounded-rp-ctrl border border-rp-border bg-rp-surface-3 px-[8px] py-[4px] text-rp-label text-rp-brand"
                >
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button
                  onClick={() => markPaidMutation.mutate({ id: order.id, method: payMethod })}
                  disabled={markPaidMutation.isPending}
                  className="rounded-rp-sm border border-rp-btn-accent bg-rp-btn-accent px-[10px] py-[4px] text-rp-label font-medium text-rp-btn-accent-text transition-colors disabled:opacity-50"
                >
                  {markPaidMutation.isPending ? 'Saving…' : 'Mark Paid'}
                </button>
              </div>
            )}
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
            {order.status === 'DELIVERED' && canVoid && (
              <button
                onClick={() => setVoidOpen(true)}
                className="rounded-rp-sm border border-rp-border-md bg-rp-surface-3 px-[12px] py-[6px] text-rp-meta font-medium text-rp-text transition-colors hover:bg-rp-surface-4">
                Cancel &amp; credit
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--rp-border)' }}>
            {order.items.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-[13px] text-[#183153]">{item.quantity}× {item.menuItem.name}</span>
                <span className="text-[13px] font-medium text-[#183153]">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
              </div>
            ))}
            {order.notes && <p className="text-[11.5px] text-[#64748b] mt-1 italic">📝 {order.notes}</p>}
          </div>
        )}
        <ModalShell
          open={voidOpen}
          onClose={() => setVoidOpen(false)}
          title="Cancel a served order"
          description="The charge stays on the invoice and a credit is added against it."
          maxWidth="440px"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setVoidOpen(false)}
                className="rounded-rp-btn border border-rp-border-md px-4 py-2 text-rp-body font-medium text-rp-muted">
                Keep it
              </button>
              <button
                type="button"
                disabled={!voidReason.trim() || statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: order.id, status: 'CANCELLED', reason: voidReason.trim() })}
                className="rounded-rp-btn bg-rp-danger px-4 py-2 text-rp-body font-medium text-white disabled:opacity-40">
                {statusMutation.isPending ? 'Cancelling…' : 'Cancel and credit'}
              </button>
            </div>
          }
        >
          <label className="block text-rp-label font-medium text-rp-muted mb-1.5">Why is it being cancelled?</label>
          <input
            autoFocus
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
            placeholder="Wrong dish, never served, guest complaint…"
            className="w-full rounded-rp-ctrl border border-rp-border-md bg-rp-surface-3 px-3 py-2 text-rp-body text-rp-text placeholder:text-rp-muted focus:outline-none"
          />
          <p className="mt-2 text-rp-label text-rp-muted">
            Recorded against your name on the invoice’s audit trail.
          </p>
        </ModalShell>
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
          {order.paymentStatus && order.paymentStatus !== 'PAID' && (
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
    <PageShell gap={4}>
      {/* Header */}
      <PageHeader
        title="F&B Orders"
        subtitle="Food & beverage order management"
        align="end"
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-btn-accent)' }}>
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> New Order
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Orders', value: total,                icon: ShoppingBag, bg: 'var(--rp-teal-bg)', color: '#183153' },
          { label: 'Pending',      value: stats.pending   ?? 0, icon: Clock,       bg: 'var(--rp-amber-bg)', color: '#b89040' },
          { label: 'Preparing',    value: stats.preparing ?? 0, icon: ChefHat,     bg: 'var(--rp-coral-bg)', color: '#b8724a' },
          { label: 'Ready',        value: stats.ready     ?? 0, icon: CheckCircle2,bg: 'var(--rp-teal-bg)', color: '#183153' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: bg }}>
              <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#64748b]">{label}</div>
              <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#183153]">{value}</div>
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
              ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#183153' }
              : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#a9c1d0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
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
              <ShoppingBag className="h-7 w-7 text-[#94a3b8]" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#183153]">
                {statusFilter ? 'No orders with this status' : 'No orders yet'}
              </p>
              <p className="mt-1 text-[12.5px] text-[#64748b]">
                {statusFilter ? 'Try a different filter' : 'Place your first food order'}
              </p>
            </div>
            {!statusFilter && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc]"
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
          <p className="text-[12.5px] text-[#64748b]">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
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
    </PageShell>
  );
}

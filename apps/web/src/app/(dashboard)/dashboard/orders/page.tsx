'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foodOrdersApi, menuApi, guestsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, ShoppingBag, Clock, ChefHat, CheckCircle2, XCircle,
  Trash2, ChevronLeft, ChevronRight,
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

  return (
    <Modal open={open} onClose={onClose} title="New F&B Order" description="Create a food & beverage order" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Guest (optional)</label>
            <select value={guestId} onChange={e => setGuestId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Walk-in</option>
              {guests.map((g: { id: string; firstName: string; lastName: string }) => (
                <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Table Number</label>
            <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table 4, Room 201..." />
          </div>
        </div>

        {/* Menu Items */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Menu Items</label>
          <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
            {menuItems.map((item: MenuItem) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                <div>
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-resort-700">{formatCurrency(Number(item.price))}</span>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addToCart(item)}>+ Add</Button>
                </div>
              </div>
            ))}
            {menuItems.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No available menu items</p>}
          </div>
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="rounded-lg border">
            <div className="px-3 py-2 border-b bg-gray-50 text-xs font-semibold text-muted-foreground uppercase">Order Summary</div>
            <div className="divide-y">
              {cart.map(item => (
                <div key={item.menuItemId} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                      className="h-6 w-6 rounded border text-xs hover:bg-gray-100 flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                      className="h-6 w-6 rounded border text-xs hover:bg-gray-100 flex items-center justify-center">+</button>
                  </div>
                  <span className="text-sm font-semibold w-16 text-right">{formatCurrency(item.price * item.quantity)}</span>
                  <button type="button" onClick={() => updateQty(item.menuItemId, 0)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-bold text-resort-700">{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Order Notes</label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, preferences..." />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={cart.length === 0}>Place Order ({cart.length} items · {formatCurrency(total)})</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['food-orders', statusFilter, page],
    queryFn: () => foodOrdersApi.list({ status: statusFilter || undefined, page, limit: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => foodOrdersApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['food-orders'] }); toast({ title: 'Order placed!' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to place order', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => foodOrdersApi.updateStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['food-orders'] }); toast({ title: 'Order updated' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to update order', variant: 'destructive' }),
  });

  const orders: FoodOrder[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const preparingCount = orders.filter(o => o.status === 'PREPARING').length;
  const readyCount = orders.filter(o => o.status === 'READY').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">F&B Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Food & beverage order management</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> New Order</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: total, icon: ShoppingBag, color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Preparing', value: preparingCount, icon: ChefHat, color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'Ready', value: readyCount, icon: CheckCircle2, color: 'bg-green-50 border-green-200 text-green-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 opacity-70" /><p className="text-xs font-medium opacity-70">{label}</p></div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-resort-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
            <ShoppingBag className="h-14 w-14 text-gray-200 mb-4" />
            <p className="font-medium text-gray-500">{statusFilter ? 'No orders with this status' : 'No orders yet'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{statusFilter ? 'Try a different filter' : 'Place your first food order'}</p>
            {!statusFilter && <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> New Order</Button>}
          </div>
        ) : (
          orders.map(order => {
            const nextStatus = STATUS_NEXT[order.status];
            const isExpanded = expanded === order.id;
            return (
              <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={order.status} />
                        {order.guest && <span className="text-sm font-medium">{order.guest.firstName} {order.guest.lastName}</span>}
                        {order.tableNumber && <span className="text-xs text-muted-foreground bg-gray-100 rounded px-2 py-0.5">📍 {order.tableNumber}</span>}
                        <span className="text-xs text-muted-foreground ml-auto">{formatDate(order.createdAt)}</span>
                      </div>
                      <button className="mt-1 text-left" onClick={() => setExpanded(isExpanded ? null : order.id)}>
                        <p className="text-xs text-resort-600 hover:underline">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {formatCurrency(Number(order.totalAmount))}
                          {isExpanded ? ' ▲' : ' ▼'}
                        </p>
                      </button>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {nextStatus && (
                        <Button size="sm" variant="outline" className="text-xs"
                          onClick={() => statusMutation.mutate({ id: order.id, status: nextStatus })}
                          loading={statusMutation.isPending}>
                          {STATUS_LABEL[order.status]}
                        </Button>
                      )}
                      {(order.status === 'PENDING' || order.status === 'PREPARING') && (
                        <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => statusMutation.mutate({ id: order.id, status: 'CANCELLED' })}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      {order.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{item.quantity}× {item.menuItem.name}</span>
                          <span className="font-medium">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
                        </div>
                      ))}
                      {order.notes && <p className="text-xs text-muted-foreground mt-2 italic">📝 {order.notes}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <NewOrderModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
    </div>
  );
}

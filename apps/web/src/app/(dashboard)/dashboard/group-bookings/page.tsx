'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupBookingsApi, roomsApi, guestsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  UsersRound, Plus, X, ChevronRight, LogIn, LogOut, Trash2, Search,
  Building2, Phone, Mail, Calendar, BedDouble, DollarSign, Pencil,
  CheckCircle2, Tag, SlidersHorizontal, AlertTriangle,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = ['WEDDING', 'CORPORATE', 'CONFERENCE', 'SPORTS', 'TOUR', 'FAMILY', 'OTHER'] as const;
const EVENT_ICONS: Record<string, string> = {
  WEDDING: '💍', CORPORATE: '🏢', CONFERENCE: '🎤', SPORTS: '⚽', TOUR: '✈️', FAMILY: '👨‍👩‍👧', OTHER: '📋',
};
const STATUS_COLORS: Record<string, string> = {
  TENTATIVE: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  CONFIRMED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  CHECKED_IN: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  CHECKED_OUT: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

// ── Room Row in Create Modal ───────────────────────────────────────────────────
interface RoomEntry {
  key: number;
  roomId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  adults: number;
  children: number;
  specialRequests: string;
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────
function GroupModal({
  group,
  onClose,
}: {
  group?: any;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!group;

  // Group fields
  const [name, setName] = useState(group?.name ?? '');
  const [organization, setOrganization] = useState(group?.organization ?? '');
  const [contactName, setContactName] = useState(group?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(group?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(group?.contactPhone ?? '');
  const [eventType, setEventType] = useState(group?.eventType ?? 'OTHER');
  const [checkIn, setCheckIn] = useState(group?.checkIn ? group.checkIn.slice(0, 10) : '');
  const [checkOut, setCheckOut] = useState(group?.checkOut ? group.checkOut.slice(0, 10) : '');
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FLAT'>(group?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState(String(group?.discountValue ?? 0));
  const [notes, setNotes] = useState(group?.notes ?? '');

  // Room entries (create only)
  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([
    { key: 0, roomId: '', guestFirstName: '', guestLastName: '', guestEmail: '', adults: 1, children: 0, specialRequests: '' },
  ]);
  const [roomKey, setRoomKey] = useState(1);

  // Available rooms
  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => roomsApi.list({ isActive: true }),
    enabled: !isEdit,
  });
  const rooms: any[] = roomsRes?.data?.data ?? [];
  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE' || r.status === 'RESERVED');

  const mutation = useMutation({
    mutationFn: (data: unknown) =>
      isEdit ? groupBookingsApi.update(group.id, data) : groupBookingsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-bookings'] });
      toast({ title: isEdit ? 'Group updated' : 'Group booking created' });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: e?.response?.data?.error ?? 'Failed to save', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contactName || !contactEmail || !checkIn || !checkOut) return;

    const payload: any = {
      name, organization, contactName, contactEmail, contactPhone,
      eventType, checkIn, checkOut, notes,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
    };

    if (!isEdit) {
      payload.bookings = roomEntries
        .filter((r) => r.roomId && r.guestEmail)
        .map((r) => ({
          roomId: r.roomId,
          guestFirstName: r.guestFirstName || 'Guest',
          guestLastName: r.guestLastName || contactName.split(' ').slice(-1)[0] || 'Guest',
          guestEmail: r.guestEmail,
          adults: r.adults,
          children: r.children,
          specialRequests: r.specialRequests || undefined,
        }));
    }

    mutation.mutate(payload);
  };

  const addRoom = () => {
    setRoomEntries([...roomEntries, { key: roomKey, roomId: '', guestFirstName: '', guestLastName: '', guestEmail: '', adults: 1, children: 0, specialRequests: '' }]);
    setRoomKey(roomKey + 1);
  };

  const removeRoom = (key: number) => setRoomEntries(roomEntries.filter((r) => r.key !== key));

  const updateRoom = (key: number, field: keyof RoomEntry, value: any) =>
    setRoomEntries(roomEntries.map((r) => r.key === key ? { ...r, [field]: value } : r));

  const nights = checkIn && checkOut
    ? Math.max(0, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-resort-700 to-resort-600 rounded-t-2xl">
          <div className="flex items-center gap-2 text-white">
            <UsersRound className="h-5 w-5" />
            <h2 className="text-base font-semibold">{isEdit ? 'Edit Group' : 'New Group Booking'}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Group Info */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Group Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required
                    placeholder='e.g. "Smith Wedding Party"'
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization</label>
                  <input value={organization} onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Company / event name"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Type</label>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500">
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{EVENT_ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact Person</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} required
                    placeholder="Full name"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 555 0100"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required
                    placeholder="contact@example.com"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stay Period</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in <span className="text-red-500">*</span></label>
                  <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out <span className="text-red-500">*</span></label>
                  <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required min={checkIn}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                </div>
                {nights > 0 && (
                  <div className="col-span-2">
                    <span className="text-xs text-resort-600 font-medium">
                      📅 {nights} night{nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Discount */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Group Discount</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500">
                    <option value="NONE">No Discount</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount ($)</option>
                  </select>
                </div>
                {discountType !== 'NONE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {discountType === 'PERCENTAGE' ? 'Percentage' : 'Amount'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        {discountType === 'PERCENTAGE' ? '%' : '$'}
                      </span>
                      <input type="number" min="0" step="0.01" value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 pl-7 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Internal Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Special arrangements, VIP requirements..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500 resize-none" />
            </div>

            {/* Room entries — create only */}
            {!isEdit && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rooms & Guests</p>
                  <button type="button" onClick={addRoom}
                    className="flex items-center gap-1 text-xs text-resort-600 hover:text-resort-700 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Room
                  </button>
                </div>
                <div className="space-y-3">
                  {roomEntries.map((entry, i) => (
                    <div key={entry.key} className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500">Room {i + 1}</p>
                        {roomEntries.length > 1 && (
                          <button type="button" onClick={() => removeRoom(entry.key)} className="text-red-400 hover:text-red-500">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Room</label>
                          <select value={entry.roomId} onChange={(e) => updateRoom(entry.key, 'roomId', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500">
                            <option value="">Select room…</option>
                            {availableRooms
                              .filter((r) => r.id === entry.roomId || !roomEntries.some((re) => re.key !== entry.key && re.roomId === r.id))
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  #{r.number} — {r.name} ({r.type.toLowerCase()}) · {formatCurrency(Number(r.basePrice))}/night
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Guest First Name</label>
                          <input value={entry.guestFirstName} onChange={(e) => updateRoom(entry.key, 'guestFirstName', e.target.value)}
                            placeholder="First name"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Guest Last Name</label>
                          <input value={entry.guestLastName} onChange={(e) => updateRoom(entry.key, 'guestLastName', e.target.value)}
                            placeholder="Last name"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Guest Email <span className="text-red-400">*</span></label>
                          <input type="email" value={entry.guestEmail} onChange={(e) => updateRoom(entry.key, 'guestEmail', e.target.value)}
                            placeholder="guest@email.com (required)"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Adults</label>
                          <input type="number" min={1} max={10} value={entry.adults}
                            onChange={(e) => updateRoom(entry.key, 'adults', parseInt(e.target.value))}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Children</label>
                          <input type="number" min={0} max={10} value={entry.children}
                            onChange={(e) => updateRoom(entry.key, 'children', parseInt(e.target.value))}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                        </div>
                      </div>
                      {/* Per-room preview */}
                      {entry.roomId && nights > 0 && (() => {
                        const room = availableRooms.find((r) => r.id === entry.roomId);
                        if (!room) return null;
                        let amt = Number(room.basePrice) * nights;
                        const dv = parseFloat(discountValue) || 0;
                        if (discountType === 'PERCENTAGE' && dv > 0) amt = amt * (1 - dv / 100);
                        else if (discountType === 'FLAT' && dv > 0) amt = Math.max(0, amt - dv);
                        return (
                          <div className="flex justify-between text-xs text-resort-600 dark:text-resort-400 font-medium">
                            <span>Room total ({nights}n)</span>
                            <span>{formatCurrency(amt)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">Rooms without a guest email will be skipped. You can add more rooms after creating the group.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-lg bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Group Detail Drawer ────────────────────────────────────────────────────────
function GroupDetailDrawer({
  group,
  onClose,
  onEdit,
}: {
  group: any;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: summaryRes, isLoading } = useQuery({
    queryKey: ['group-summary', group.id],
    queryFn: () => groupBookingsApi.summary(group.id),
  });

  const summary = summaryRes?.data?.data;

  const bulkCheckIn = useMutation({
    mutationFn: () => groupBookingsApi.bulkCheckIn(group.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['group-bookings'] });
      qc.invalidateQueries({ queryKey: ['group-summary', group.id] });
      toast({ title: `${res.data.data.checkedIn} room(s) checked in` });
    },
    onError: () => toast({ title: 'Bulk check-in failed', variant: 'destructive' }),
  });

  const bulkCheckOut = useMutation({
    mutationFn: () => groupBookingsApi.bulkCheckOut(group.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['group-bookings'] });
      qc.invalidateQueries({ queryKey: ['group-summary', group.id] });
      toast({ title: `${res.data.data.checkedOut} room(s) checked out` });
    },
    onError: () => toast({ title: 'Bulk check-out failed', variant: 'destructive' }),
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{EVENT_ICONS[group.eventType] ?? '📋'}</span>
              <p className="font-bold text-gray-900 dark:text-white truncate">{group.name}</p>
            </div>
            {group.organization && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{group.organization}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[group.status] ?? ''}`}>
              {group.status}
            </span>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : summary ? (
            <div className="p-6 space-y-6">
              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Rooms', value: summary.stats.roomCount, color: 'text-resort-600' },
                  { label: 'Nights', value: summary.stats.nights, color: 'text-blue-600' },
                  { label: 'Total', value: formatCurrency(summary.stats.totalAmount), color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Payment progress */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Paid</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(summary.stats.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Outstanding</span>
                  <span className={`font-semibold ${summary.stats.outstanding > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {summary.stats.outstanding > 0 ? formatCurrency(summary.stats.outstanding) : '✓ Settled'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 mt-1">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${summary.stats.totalAmount > 0 ? Math.round((summary.stats.paidAmount / summary.stats.totalAmount) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</p>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <UsersRound className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{summary.group.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    <a href={`mailto:${summary.group.contactEmail}`} className="text-sm text-resort-600 hover:underline">
                      {summary.group.contactEmail}
                    </a>
                  </div>
                  {summary.group.contactPhone && (
                    <div className="flex items-center gap-2.5 px-4 py-2.5">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{summary.group.contactPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stay + Discount */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Booking Details</p>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Check-in</span>
                    <span className="font-medium">{formatDate(summary.group.checkIn)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Check-out</span>
                    <span className="font-medium">{formatDate(summary.group.checkOut)}</span>
                  </div>
                  {summary.group.discountType !== 'NONE' && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-500 flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Discount</span>
                      <span className="font-medium text-amber-600">
                        {summary.group.discountType === 'PERCENTAGE'
                          ? `${summary.group.discountValue}% off`
                          : formatCurrency(summary.group.discountValue)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rooms list */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Rooms ({summary.stats.roomCount})
                </p>
                <div className="space-y-2">
                  {summary.bookings.map((b: any) => (
                    <div key={b.id} className="rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            #{b.room.number} — {b.room.name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {b.guest.firstName} {b.guest.lastName} · {b.adults}A{b.children > 0 ? `+${b.children}C` : ''}
                        </p>
                        <p className="text-xs text-resort-600 dark:text-resort-400">
                          {formatCurrency(Number(b.totalAmount))}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] ?? ''}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {summary.group.notes && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{summary.group.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-2">
          {summary?.stats.confirmed > 0 && (
            <button
              onClick={() => bulkCheckIn.mutate()}
              disabled={bulkCheckIn.isPending}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {bulkCheckIn.isPending ? 'Checking in…' : `Bulk Check-In (${summary.stats.confirmed} room${summary.stats.confirmed !== 1 ? 's' : ''})`}
            </button>
          )}
          {summary?.stats.checkedIn > 0 && (
            <button
              onClick={() => bulkCheckOut.mutate()}
              disabled={bulkCheckOut.isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {bulkCheckOut.isPending ? 'Checking out…' : `Bulk Check-Out (${summary.stats.checkedIn} room${summary.stats.checkedIn !== 1 ? 's' : ''})`}
            </button>
          )}
          {summary?.stats.checkedOut === summary?.stats.roomCount && summary?.stats.roomCount > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 py-1">
              <CheckCircle2 className="h-4 w-4" />
              All rooms checked out
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Group Card ─────────────────────────────────────────────────────────────────
function GroupCard({ group, onClick }: { group: any; onClick: () => void }) {
  const nights = Math.max(1,
    Math.ceil((new Date(group.checkOut).getTime() - new Date(group.checkIn).getTime()) / 86_400_000));
  const totalAmount = group.bookings.reduce((s: number, b: any) => s + Number(b.totalAmount), 0);
  const paidAmount = group.bookings.reduce(
    (s: number, b: any) => s + b.payments.filter((p: any) => p.status === 'COMPLETED').reduce((ps: number, p: any) => ps + Number(p.amount), 0),
    0,
  );
  const outstanding = totalAmount - paidAmount;
  const checkedIn = group.bookings.filter((b: any) => b.status === 'CHECKED_IN').length;
  const checkedOut = group.bookings.filter((b: any) => b.status === 'CHECKED_OUT').length;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
      onClick={onClick}
    >
      <CardContent className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-2xl mt-0.5 shrink-0">{EVENT_ICONS[group.eventType] ?? '📋'}</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</p>
              {group.organization && (
                <p className="text-xs text-muted-foreground truncate">{group.organization}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[group.status] ?? ''}`}>
              {group.status.replace('_', ' ')}
            </span>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </div>
        </div>

        {/* Date row */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(group.checkIn)} → {formatDate(group.checkOut)}
          <span className="text-gray-300">·</span>
          <span>{nights}n</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center rounded-lg bg-gray-50 dark:bg-gray-800/50 py-2">
            <p className="text-xs text-gray-400">Rooms</p>
            <p className="text-base font-bold text-resort-600">{group._count.bookings}</p>
          </div>
          <div className="text-center rounded-lg bg-gray-50 dark:bg-gray-800/50 py-2">
            <p className="text-xs text-gray-400">Revenue</p>
            <p className="text-sm font-bold text-emerald-600 truncate">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-center rounded-lg bg-gray-50 dark:bg-gray-800/50 py-2">
            <p className="text-xs text-gray-400">Balance</p>
            <p className={`text-sm font-bold truncate ${outstanding > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {outstanding > 0 ? formatCurrency(outstanding) : '✓'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {group._count.bookings > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{checkedIn} in · {checkedOut} out · {group._count.bookings - checkedIn - checkedOut} pending</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-1.5 rounded-full bg-resort-500 transition-all"
                style={{ width: `${Math.round(((checkedIn + checkedOut) / group._count.bookings) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <UsersRound className="h-3 w-3" />
          {group.contactName}
          {group.contactEmail && (
            <> · <span className="truncate">{group.contactEmail}</span></>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GroupBookingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['group-bookings', statusFilter, search],
    queryFn: () => groupBookingsApi.list({ status: statusFilter || undefined, search: search || undefined }),
  });

  const groups: any[] = res?.data?.data ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => groupBookingsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-bookings'] });
      toast({ title: 'Group deleted (bookings unlinked)' });
    },
    onError: () => toast({ title: 'Failed to delete group', variant: 'destructive' }),
  });

  // Summary stats
  const totalRooms = groups.reduce((s, g) => s + g._count.bookings, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.bookings.reduce((bs: number, b: any) => bs + Number(b.totalAmount), 0), 0);
  const active = groups.filter((g) => ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'].includes(g.status)).length;

  const STATUS_OPTIONS = ['', 'TENTATIVE', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-resort-600" />
            Group Bookings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weddings, corporate retreats, conferences — manage multi-room groups
          </p>
        </div>
        <button
          onClick={() => { setEditingGroup(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Group
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active Groups', value: active, icon: UsersRound, color: 'bg-resort-600' },
          { label: 'Total Rooms Booked', value: totalRooms, icon: BedDouble, color: 'bg-blue-500' },
          { label: 'Group Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'bg-emerald-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups, contacts…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-resort-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-resort-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="h-20 w-20 rounded-full bg-resort-50 dark:bg-resort-900/20 flex items-center justify-center">
            <UsersRound className="h-10 w-10 text-resort-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">No group bookings yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter ? 'Try clearing your filters' : 'Create your first group booking for weddings, events, or corporate stays'}
            </p>
          </div>
          {!search && !statusFilter && (
            <button
              onClick={() => { setEditingGroup(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-resort-600 text-white text-sm font-medium hover:bg-resort-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create First Group
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onClick={() => setSelectedGroup(g)} />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <GroupModal
          group={editingGroup}
          onClose={() => { setModalOpen(false); setEditingGroup(null); }}
        />
      )}

      {/* Detail Drawer */}
      {selectedGroup && (
        <GroupDetailDrawer
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onEdit={() => {
            setEditingGroup(selectedGroup);
            setSelectedGroup(null);
            setModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

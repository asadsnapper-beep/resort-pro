'use client';

import { createPortal } from 'react-dom';
import { ModalShell } from '@/components/ui/modal-shell';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupBookingsApi, roomsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  UsersRound, Plus, X, ChevronRight, LogIn, LogOut, Search,
  Phone, Mail, Calendar, BedDouble, Banknote, Pencil,
  CheckCircle2, Tag, Loader2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = ['WEDDING', 'CORPORATE', 'CONFERENCE', 'SPORTS', 'TOUR', 'FAMILY', 'OTHER'] as const;
const EVENT_ICONS: Record<string, string> = {
  WEDDING: '💍', CORPORATE: '🏢', CONFERENCE: '🎤', SPORTS: '⚽', TOUR: '✈️', FAMILY: '👨‍👩‍👧', OTHER: '📋',
};
const STATUS_META: Record<string, { bg: string; border: string; text: string; label: string }> = {
  TENTATIVE:   { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Tentative' },
  CONFIRMED:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Confirmed' },
  CHECKED_IN:  { bg: '#1b342f', border: 'rgba(27,52,47,0.5)',    text: '#dfd9d0', label: 'Checked In' },
  CHECKED_OUT: { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Checked Out' },
  CANCELLED:   { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c', label: 'Cancelled' },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.TENTATIVE;
  return (
    <span className="rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap"
      style={{ background: m.bg, borderColor: m.border, color: m.text }}>
      {m.label}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
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
function GroupModal({ group, onClose }: { group?: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!group;

  const [name, setName]                   = useState(group?.name ?? '');
  const [organization, setOrganization]   = useState(group?.organization ?? '');
  const [contactName, setContactName]     = useState(group?.contactName ?? '');
  const [contactEmail, setContactEmail]   = useState(group?.contactEmail ?? '');
  const [contactPhone, setContactPhone]   = useState(group?.contactPhone ?? '');
  const [eventType, setEventType]         = useState(group?.eventType ?? 'OTHER');
  const [checkIn, setCheckIn]             = useState(group?.checkIn ? group.checkIn.slice(0, 10) : '');
  const [checkOut, setCheckOut]           = useState(group?.checkOut ? group.checkOut.slice(0, 10) : '');
  const [discountType, setDiscountType]   = useState<'NONE' | 'PERCENTAGE' | 'FLAT'>(group?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState(String(group?.discountValue ?? 0));
  const [notes, setNotes]                 = useState(group?.notes ?? '');

  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([
    { key: 0, roomId: '', guestFirstName: '', guestLastName: '', guestEmail: '', adults: 1, children: 0, specialRequests: '' },
  ]);
  const [roomKey, setRoomKey] = useState(1);

  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => roomsApi.list({ isActive: true }),
    enabled: !isEdit,
  });
  const rooms: any[] = roomsRes?.data?.data ?? [];
  const availableRooms = rooms.filter((r) => r.status === 'AVAILABLE');

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
      discountType, discountValue: parseFloat(discountValue) || 0,
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
    <ModalShell
      open={true}
      onClose={onClose}
      title={isEdit ? 'Edit Group' : 'New Group Booking'}
      maxWidth="680px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            className="flex-1 rounded-[9px] border py-2.5 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" form="group-form" disabled={mutation.isPending || !name || !contactEmail || !checkIn || !checkOut}
            className="flex-1 flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      }
    >
      <form id="group-form" onSubmit={handleSubmit}>
        <div className="space-y-6">

            {/* Group Info */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Group Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Group Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required
                    placeholder='e.g. "Smith Wedding Party"' className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Organization</label>
                  <input value={organization} onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Company / event name" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Event Type</label>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{EVENT_ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Contact Person</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} required
                    placeholder="Full name" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 555 0100" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Email *</label>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required
                    placeholder="contact@example.com" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Stay Period</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Check-in *</label>
                  <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Check-out *</label>
                  <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required min={checkIn} className={inputCls} />
                </div>
                {nights > 0 && (
                  <div className="col-span-2">
                    <span className="rounded-[7px] border px-[9px] py-[3px] text-[11px] font-semibold"
                      style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                      📅 {nights} night{nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Discount */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-3">Group Discount</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className={inputCls}>
                    <option value="NONE">No Discount</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount ($)</option>
                  </select>
                </div>
                {discountType !== 'NONE' && (
                  <div>
                    <label className={labelCls}>{discountType === 'PERCENTAGE' ? 'Percentage' : 'Amount'} *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                        {discountType === 'PERCENTAGE' ? '%' : '$'}
                      </span>
                      <input type="number" min="0" step="0.01" value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className={inputCls + ' pl-7'} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Internal Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Special arrangements, VIP requirements..."
                className="w-full resize-none rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
            </div>

            {/* Room entries — create only */}
            {!isEdit && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a]">Rooms & Guests</p>
                  <button type="button" onClick={addRoom}
                    className="flex items-center gap-1 text-[12px] font-medium transition-colors hover:opacity-80"
                    style={{ color: '#23766a' }}>
                    <Plus className="h-3.5 w-3.5" /> Add Room
                  </button>
                </div>
                <div className="space-y-3">
                  {roomEntries.map((entry, i) => (
                    <div key={entry.key} className="rounded-[12px] border p-4 space-y-3"
                      style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8aa29a] dark:text-[#94b8b0]">Room {i + 1}</p>
                        {roomEntries.length > 1 && (
                          <button type="button" onClick={() => removeRoom(entry.key)}
                            className="rounded-[6px] p-1 transition-colors hover:bg-[#fef2f2]">
                            <X className="h-3.5 w-3.5" style={{ color: '#c43c3c' }} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className={labelCls}>Room</label>
                          <select value={entry.roomId} onChange={(e) => updateRoom(entry.key, 'roomId', e.target.value)} className={inputCls}>
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
                          <label className={labelCls}>First Name</label>
                          <input value={entry.guestFirstName} onChange={(e) => updateRoom(entry.key, 'guestFirstName', e.target.value)}
                            placeholder="First name" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Last Name</label>
                          <input value={entry.guestLastName} onChange={(e) => updateRoom(entry.key, 'guestLastName', e.target.value)}
                            placeholder="Last name" className={inputCls} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>Guest Email *</label>
                          <input type="email" value={entry.guestEmail} onChange={(e) => updateRoom(entry.key, 'guestEmail', e.target.value)}
                            placeholder="guest@email.com" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Adults</label>
                          <input type="number" min={1} max={10} value={entry.adults}
                            onChange={(e) => updateRoom(entry.key, 'adults', parseInt(e.target.value))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Children</label>
                          <input type="number" min={0} max={10} value={entry.children}
                            onChange={(e) => updateRoom(entry.key, 'children', parseInt(e.target.value))} className={inputCls} />
                        </div>
                      </div>
                      {entry.roomId && nights > 0 && (() => {
                        const room = availableRooms.find((r) => r.id === entry.roomId);
                        if (!room) return null;
                        let amt = Number(room.basePrice) * nights;
                        const dv = parseFloat(discountValue) || 0;
                        if (discountType === 'PERCENTAGE' && dv > 0) amt = amt * (1 - dv / 100);
                        else if (discountType === 'FLAT' && dv > 0) amt = Math.max(0, amt - dv);
                        return (
                          <div className="flex justify-between text-[12px] font-medium" style={{ color: '#23766a' }}>
                            <span>Room total ({nights}n)</span>
                            <span>{formatCurrency(amt)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                  Rooms without a guest email will be skipped. You can add more rooms after creating the group.
                </p>
              </div>
            )}
          </div>

      </form>
    </ModalShell>
  );
}

// ── Group Detail Drawer ────────────────────────────────────────────────────────
function GroupDetailDrawer({ group, onClose, onEdit }: { group: any; onClose: () => void; onEdit: () => void }) {
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

  return createPortal((
    <>
      <div className="fixed inset-0 z-40"
        style={{ background: 'rgba(27,52,47,0.3)', backdropFilter: 'blur(3px)' }}
        onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-white dark:bg-white/5 shadow-2xl"
        style={{ boxShadow: '-8px 0 40px rgba(27,52,47,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0"
          style={{ borderColor: 'var(--rp-border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{EVENT_ICONS[group.eventType] ?? '📋'}</span>
              <p className="font-display text-[16px] font-semibold truncate text-[#18231f] dark:text-[#dfd9d0]">{group.name}</p>
            </div>
            {group.organization && (
              <p className="text-[12px] mt-0.5 truncate text-[#8aa29a] dark:text-[#94b8b0]">{group.organization}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={group.status} />
            <button onClick={onEdit} className="rounded-[8px] p-1.5 transition-colors hover:bg-[#f4f1eb]">
              <Pencil className="h-4 w-4 text-[#8aa29a] dark:text-[#94b8b0]" />
            </button>
            <button onClick={onClose} className="rounded-[8px] p-1.5 transition-colors hover:bg-[#f4f1eb]">
              <X className="h-5 w-5 text-[#8aa29a] dark:text-[#94b8b0]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-[12px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
              ))}
            </div>
          ) : summary ? (
            <div className="p-6 space-y-6">
              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Rooms',  value: summary.stats.roomCount,                  color: '#23766a', bg: 'var(--rp-teal-bg)' },
                  { label: 'Nights', value: summary.stats.nights,                     color: '#b89040', bg: 'var(--rp-amber-bg)' },
                  { label: 'Total',  value: formatCurrency(summary.stats.totalAmount), color: '#1b342f', bg: 'var(--rp-surface-4)' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="rounded-[10px] p-3 text-center" style={{ background: bg }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
                    <p className="text-[15px] font-bold mt-0.5 truncate" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Payment progress */}
              <div className="rounded-[12px] border p-4 space-y-2"
                style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: 'var(--rp-text-muted)' }}>Total Paid</span>
                  <span className="font-semibold" style={{ color: '#23766a' }}>{formatCurrency(summary.stats.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: 'var(--rp-text-muted)' }}>Outstanding</span>
                  <span className="font-semibold" style={{ color: summary.stats.outstanding > 0 ? '#c43c3c' : '#23766a' }}>
                    {summary.stats.outstanding > 0 ? formatCurrency(summary.stats.outstanding) : '✓ Settled'}
                  </span>
                </div>
                <div className="h-[6px] w-full rounded-full mt-1" style={{ background: '#e8e5e0' }}>
                  <div className="h-[6px] rounded-full transition-all" style={{
                    background: '#23766a',
                    width: `${summary.stats.totalAmount > 0 ? Math.round((summary.stats.paidAmount / summary.stats.totalAmount) * 100) : 0}%`,
                  }} />
                </div>
              </div>

              {/* Contact */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-2">Contact</p>
                <div className="rounded-[12px] border overflow-hidden divide-y"
                  style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <UsersRound className="h-3.5 w-3.5 shrink-0 text-[#8aa29a] dark:text-[#94b8b0]" />
                    <span className="text-[13px] text-[#18231f] dark:text-[#dfd9d0]">{summary.group.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[#8aa29a] dark:text-[#94b8b0]" />
                    <a href={`mailto:${summary.group.contactEmail}`} className="text-[13px] hover:underline"
                      style={{ color: '#23766a' }}>{summary.group.contactEmail}</a>
                  </div>
                  {summary.group.contactPhone && (
                    <div className="flex items-center gap-2.5 px-4 py-2.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[#8aa29a] dark:text-[#94b8b0]" />
                      <span className="text-[13px] text-[#18231f] dark:text-[#dfd9d0]">{summary.group.contactPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stay + Discount */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-2">Booking Details</p>
                <div className="rounded-[12px] border overflow-hidden divide-y"
                  style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                      <Calendar className="h-3.5 w-3.5" /> Check-in
                    </span>
                    <span className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{formatDate(summary.group.checkIn)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                      <Calendar className="h-3.5 w-3.5" /> Check-out
                    </span>
                    <span className="text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{formatDate(summary.group.checkOut)}</span>
                  </div>
                  {summary.group.discountType !== 'NONE' && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
                        <Tag className="h-3.5 w-3.5" /> Discount
                      </span>
                      <span className="text-[13px] font-medium" style={{ color: '#b89040' }}>
                        {summary.group.discountType === 'PERCENTAGE'
                          ? `${summary.group.discountValue}% off`
                          : formatCurrency(summary.group.discountValue)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rooms list */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-2">
                  Rooms ({summary.stats.roomCount})
                </p>
                <div className="space-y-2">
                  {summary.bookings.map((b: any) => (
                    <div key={b.id} className="rounded-[12px] border px-4 py-3 flex items-center justify-between gap-3"
                      style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="h-3.5 w-3.5 shrink-0 text-[#8aa29a] dark:text-[#94b8b0]" />
                          <p className="text-[13px] font-medium truncate text-[#18231f] dark:text-[#dfd9d0]">
                            #{b.room.number} — {b.room.name}
                          </p>
                        </div>
                        <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                          {b.guest.firstName} {b.guest.lastName} · {b.adults}A{b.children > 0 ? `+${b.children}C` : ''}
                        </p>
                        <p className="text-[12px] font-medium" style={{ color: '#23766a' }}>
                          {formatCurrency(Number(b.totalAmount))}
                        </p>
                      </div>
                      <StatusPill status={b.status} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {summary.group.notes && (
                <div className="rounded-[12px] border px-4 py-3"
                  style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.2)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: '#b89040' }}>Notes</p>
                  <p className="text-[13px]" style={{ color: '#7a5c2a' }}>{summary.group.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Bulk Actions */}
        <div className="border-t p-4 space-y-2" style={{ borderColor: 'var(--rp-border)' }}>
          {summary?.stats.confirmed > 0 && (
            <button onClick={() => bulkCheckIn.mutate()} disabled={bulkCheckIn.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#23766a', color: 'var(--rp-btn-accent-text)' }}>
              {bulkCheckIn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Bulk Check-In ({summary.stats.confirmed} room{summary.stats.confirmed !== 1 ? 's' : ''})
            </button>
          )}
          {summary?.stats.checkedIn > 0 && (
            <button onClick={() => bulkCheckOut.mutate()} disabled={bulkCheckOut.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {bulkCheckOut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Bulk Check-Out ({summary.stats.checkedIn} room{summary.stats.checkedIn !== 1 ? 's' : ''})
            </button>
          )}
          {summary?.stats.checkedOut === summary?.stats.roomCount && summary?.stats.roomCount > 0 && (
            <div className="flex items-center justify-center gap-2 text-[13px] py-1" style={{ color: '#23766a' }}>
              <CheckCircle2 className="h-4 w-4" /> All rooms checked out
            </div>
          )}
        </div>
      </div>
    </>
  ), document.body);
}

// ── Group Card ─────────────────────────────────────────────────────────────────
function GroupCard({ group, onClick }: { group: any; onClick: () => void }) {
  const nights = Math.max(1,
    Math.ceil((new Date(group.checkOut).getTime() - new Date(group.checkIn).getTime()) / 86_400_000));
  const totalAmount = group.bookings.reduce((s: number, b: any) => s + Number(b.totalAmount), 0);
  const paidAmount  = group.bookings.reduce(
    (s: number, b: any) => s + b.payments.filter((p: any) => p.status === 'PAID').reduce((ps: number, p: any) => ps + Number(p.amount), 0),
    0,
  );
  const outstanding = totalAmount - paidAmount;
  const checkedIn   = group.bookings.filter((b: any) => b.status === 'CHECKED_IN').length;
  const checkedOut  = group.bookings.filter((b: any) => b.status === 'CHECKED_OUT').length;

  return (
    <div className="rounded-[14px] border bg-white dark:bg-white/5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
      onClick={onClick}>
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-2xl mt-0.5 shrink-0">{EVENT_ICONS[group.eventType] ?? '📋'}</span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold truncate text-[#18231f] dark:text-[#dfd9d0]">{group.name}</p>
              {group.organization && (
                <p className="text-[12px] truncate text-[#8aa29a] dark:text-[#94b8b0]">{group.organization}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={group.status} />
            <ChevronRight className="h-4 w-4 text-[#c5bdb4] dark:text-[#6e8580]" />
          </div>
        </div>

        {/* Date row */}
        <div className="flex items-center gap-1.5 mb-3 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatDate(group.checkIn)} → {formatDate(group.checkOut)}
          <span style={{ color: 'var(--rp-text-faint)' }}>·</span>
          <span>{nights}n</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Rooms',   value: group._count.bookings,        color: '#23766a', bg: 'var(--rp-teal-bg)' },
            { label: 'Revenue', value: formatCurrency(totalAmount),  color: '#1b342f', bg: 'var(--rp-surface-4)' },
            { label: 'Balance', value: outstanding > 0 ? formatCurrency(outstanding) : '✓',
              color: outstanding > 0 ? '#c43c3c' : '#23766a',
              bg: outstanding > 0 ? 'var(--rp-red-bg)' : 'var(--rp-teal-bg)' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-[9px] py-2 px-1 text-center" style={{ background: bg }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
              <p className="text-[13px] font-bold mt-0.5 truncate" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {group._count.bookings > 0 && (
          <div>
            <div className="flex justify-between text-[11px] mb-1 text-[#8aa29a] dark:text-[#94b8b0]">
              <span>{checkedIn} in · {checkedOut} out · {group._count.bookings - checkedIn - checkedOut} pending</span>
            </div>
            <div className="h-[5px] w-full rounded-full" style={{ background: '#e8e5e0' }}>
              <div className="h-[5px] rounded-full transition-all" style={{
                background: '#23766a',
                width: `${Math.round(((checkedIn + checkedOut) / group._count.bookings) * 100)}%`,
              }} />
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
          <UsersRound className="h-3 w-3 shrink-0" />
          {group.contactName}
          {group.contactEmail && (
            <><span style={{ color: 'var(--rp-text-faint)' }}>·</span><span className="truncate">{group.contactEmail}</span></>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GroupBookingsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen]         = useState(false);
  const [editingGroup, setEditingGroup]   = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['group-bookings', statusFilter, search],
    queryFn: () => groupBookingsApi.list({ status: statusFilter || undefined, search: search || undefined }),
  });
  const groups: any[] = res?.data?.data ?? [];

  const totalRooms   = groups.reduce((s, g) => s + g._count.bookings, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.bookings.reduce((bs: number, b: any) => bs + Number(b.totalAmount), 0), 0);
  const activeGroups = groups.filter((g) => ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'].includes(g.status)).length;

  const STATUS_OPTIONS = ['', 'TENTATIVE', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        title="Group Bookings"
        subtitle="Weddings, corporate retreats, conferences — manage multi-room groups"
        align="responsive"
        actions={
          <button onClick={() => { setEditingGroup(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            <Plus className="h-4 w-4" /> New Group
          </button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active Groups',      value: activeGroups,               icon: UsersRound, color: '#23766a', bg: 'var(--rp-teal-bg)' },
          { label: 'Total Rooms Booked', value: totalRooms,                 icon: BedDouble,  color: '#1b342f', bg: 'var(--rp-teal-bg)' },
          { label: 'Group Revenue',      value: formatCurrency(totalRevenue), icon: Banknote, color: '#b89040', bg: 'var(--rp-amber-bg)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-4 rounded-[14px] border bg-white dark:bg-white/5 p-5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: bg }}>
              <Icon className="h-[18px] w-[18px]" style={{ color }} />
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] dark:text-[#94b8b0]">{label}</p>
              <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#18231f] dark:text-[#dfd9d0]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8aa29a] dark:text-[#94b8b0]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups, contacts…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] pl-9 pr-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button key={s || 'all'} onClick={() => setStatusFilter(s)}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={statusFilter === s
                ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {STATUS_META[s]?.label ?? 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
            <UsersRound className="h-10 w-10" style={{ color: '#23766a' }} />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#18231f] dark:text-[#dfd9d0]">No group bookings yet</p>
            <p className="text-[12.5px] mt-1 text-[#8aa29a] dark:text-[#94b8b0]">
              {search || statusFilter ? 'Try clearing your filters' : 'Create your first group booking for weddings, events, or corporate stays'}
            </p>
          </div>
          {!search && !statusFilter && (
            <button onClick={() => { setEditingGroup(null); setModalOpen(true); }}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> Create First Group
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

      {modalOpen && (
        <GroupModal group={editingGroup} onClose={() => { setModalOpen(false); setEditingGroup(null); }} />
      )}

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
    </PageShell>
  );
}

'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { ConfirmModal } from '@/components/ui/modal';
import { RoomModal } from '@/components/rooms/RoomModal';
import { RoomDetailSheet } from '@/components/rooms/RoomDetailSheet';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, BedDouble, Users, DollarSign, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Room } from '@resort-pro/types';
import { useRoomTypeLabels } from '@/hooks/use-room-type-labels';

interface RoomWithBooking extends Room {
  currentBooking?: {
    id: string; confirmationNo: string; status: string;
    checkIn: string; checkOut: string; adults: number; children: number;
    guest: { id: string; firstName: string; lastName: string; email: string; phone?: string };
  } | null;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
  VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
};

const ROOM_STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  AVAILABLE:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Available'   },
  OCCUPIED:    { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Occupied'    },
  CLEANING:    { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Cleaning'    },
  MAINTENANCE: { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c', label: 'Maintenance' },
  RESERVED:    { bg: '#f5f0fe', border: 'rgba(120,70,200,0.15)',text: '#7846c8', label: 'Reserved'    },
};

const ROOM_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  STANDARD: { bg: 'var(--rp-surface-3)', text: '#6b7280' },
  DELUXE:   { bg: 'var(--rp-teal-bg)', text: '#23766a' },
  SUITE:    { bg: '#f5f0fe', text: '#7846c8' },
  VILLA:    { bg: 'var(--rp-teal-bg)', text: '#23766a' },
  COTTAGE:  { bg: 'var(--rp-teal-bg)', text: '#23766a' },
  BUNGALOW: { bg: 'var(--rp-amber-bg)', text: '#b89040' },
};

const STATUS_FILTERS = ['', 'AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED'] as const;
const TYPE_FILTERS   = ['', 'STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;

const STAT_FILTERS: { label: string; key: keyof typeof stats_default; filter: string; bg: string; border: string; text: string }[] = [
  { label: 'Total',       key: 'total',       filter: '',            bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',       text: 'var(--rp-text)' },
  { label: 'Available',   key: 'available',   filter: 'AVAILABLE',   bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',   text: '#23766a' },
  { label: 'Occupied',    key: 'occupied',    filter: 'OCCUPIED',    bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',   text: '#b89040' },
  { label: 'Cleaning',    key: 'cleaning',    filter: 'CLEANING',    bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',   text: '#b8724a' },
  { label: 'Maintenance', key: 'maintenance', filter: 'MAINTENANCE', bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c' },
  { label: 'Reserved',    key: 'reserved',    filter: 'RESERVED',    bg: '#f5f0fe', border: 'rgba(120,70,200,0.15)', text: '#7846c8' },
];
const stats_default = { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0, reserved: 0 };

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const { getLabel: getRoomTypeLabel } = useRoomTypeLabels();
  const isDark = resolvedTheme === 'dark';
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [page,         setPage]         = useState(1);
  const search = useDebounce(searchInput, 350);

  const [selectedRoom, setSelectedRoom] = useState<RoomWithBooking | null>(null);
  const [editRoom,     setEditRoom]     = useState<RoomWithBooking | null>(null);
  const [deleteRoom,   setDeleteRoom]   = useState<RoomWithBooking | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);

  const listParams: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter) listParams.status = statusFilter;
  if (typeFilter)   listParams.type   = typeFilter;
  if (search)       listParams.search = search;

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', statusFilter, typeFilter, search, page],
    queryFn:  () => roomsApi.list(listParams),
  });

  const { data: statsData } = useQuery({
    queryKey: ['rooms-stats'],
    queryFn:  () => roomsApi.stats(),
  });

  const rooms: RoomWithBooking[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination ?? { total: 0, totalPages: 1, page: 1, limit: 20 };
  const stats = statsData?.data?.data ?? stats_default;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['rooms-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: unknown) => roomsApi.create(data),
    onSuccess: () => { invalidate(); toast({ title: 'Room added successfully' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add room', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => roomsApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Room updated' }); setEditRoom(null); setSelectedRoom(null); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to update room', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => roomsApi.updateStatus(id, status),
    onSuccess: (_, vars) => { invalidate(); toast({ title: 'Status updated' }); if (selectedRoom) setSelectedRoom(r => r ? { ...r, status: vars.status as Room['status'] } : null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomsApi.delete(id),
    onSuccess: () => { invalidate(); toast({ title: 'Room deleted' }); setDeleteRoom(null); setSelectedRoom(null); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to delete room', variant: 'destructive' }),
  });

  const openDetail = async (room: RoomWithBooking) => {
    setSelectedRoom(room);
    try { const res = await roomsApi.get(room.id); setSelectedRoom(res.data?.data ?? room); } catch { /* keep cached */ }
  };

  const resetFilters = () => { setSearchInput(''); setStatusFilter(''); setTypeFilter(''); setPage(1); };

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Rooms & Villas</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">Manage your resort accommodations</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
          style={{ background: 'var(--rp-btn-accent)' }}
        >
          <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> Add Room
        </button>
      </div>

      {/* Stats bar — clickable filters */}
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {STAT_FILTERS.map(({ label, key, filter, bg, border, text }) => {
          const active = statusFilter === filter;
          return (
            <button
              key={label}
              onClick={() => { setStatusFilter(statusFilter === filter ? '' : filter); setPage(1); }}
              className="rounded-[12px] border p-[14px] text-left transition-all hover:shadow-sm"
              style={{
                background: active ? bg : isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)',
                borderColor: active ? border : isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)',
                boxShadow: active ? `0 0 0 2px ${border}` : '0 1px 6px rgba(0,0,0,0.04)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: active ? text : isDark ? '#94b8b0' : 'var(--rp-text-muted)' }}>{label}</p>
              <p className="mt-[4px] text-[26px] font-semibold leading-none tracking-[-0.02em]" style={{ color: active ? text : isDark ? '#dfd9d0' : 'var(--rp-text)' }}>
                {(stats as typeof stats_default)[key]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8aa29a]" />
          <input
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search by name or room #…"
            className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[8px] pl-9 pr-4 text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">Status:</span>
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className="rounded-[8px] border px-[11px] py-[5px] text-[12px] font-medium transition-colors"
              style={statusFilter === s
                ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#1b342f' }
                : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
              {s.replace(/_/g, ' ') || 'All'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">Type:</span>
          {TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
              className="rounded-[8px] border px-[11px] py-[5px] text-[12px] font-medium transition-colors"
              style={typeFilter === t
                ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', borderColor: '#1b342f' }
                : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)' }}>
              {t ? getRoomTypeLabel(t) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-[14px]" style={{ background: '#e8e5de' }} />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border py-20 bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
            <BedDouble className="h-7 w-7 text-[#c5bdb4]" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-[#18231f]">No rooms found</p>
            <p className="mt-1 text-[13px] text-[#8aa29a]">
              {searchInput || statusFilter || typeFilter ? 'Try changing your filters' : 'Add your first room to get started'}
            </p>
          </div>
          {searchInput || statusFilter || typeFilter ? (
            <button onClick={resetFilters}
              className="rounded-[8px] border px-4 py-[7px] text-[12.5px] font-medium bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>
              Clear filters
            </button>
          ) : (
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0]"
              style={{ background: 'var(--rp-btn-accent)' }}>
              <Plus className="h-[13px] w-[13px]" /> Add Room
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map(room => {
              const statusStyle = ROOM_STATUS_PILL[room.status] ?? ROOM_STATUS_PILL.AVAILABLE;
              const typeStyle   = ROOM_TYPE_STYLE[room.type]   ?? ROOM_TYPE_STYLE.STANDARD;
              return (
                <div key={room.id}
                  className="group cursor-pointer overflow-hidden rounded-[14px] border transition-shadow hover:shadow-md bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
                  onClick={() => openDetail(room)}>

                  {/* Image / placeholder */}
                  {room.images?.[0] ? (
                    <div className="aspect-video w-full overflow-hidden" style={{ background: 'var(--rp-surface-3)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={room.images[0]} alt={room.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center" style={{ background: '#e8f4f2' }}>
                      <BedDouble className="h-10 w-10 text-[#9bbdb7]" strokeWidth={1.5} />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-[10px]">
                      <div>
                        <div className="mb-[5px] flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-[#8aa29a]">#{room.number}</span>
                          <span className="rounded-[6px] px-[8px] py-[3px] text-[11px] font-semibold"
                            style={{ background: typeStyle.bg, color: typeStyle.text }}>
                            {getRoomTypeLabel(room.type)}
                          </span>
                        </div>
                        <p className="text-[14px] font-semibold text-[#18231f]">{room.name}</p>
                      </div>
                      <span className="shrink-0 rounded-[7px] border px-[9px] py-[4px] text-[11px] font-semibold"
                        style={{ background: statusStyle.bg, borderColor: statusStyle.border, color: statusStyle.text }}>
                        {statusStyle.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[12.5px] text-[#8aa29a]">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {room.maxOccupancy}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" /> {formatCurrency(Number(room.basePrice))}/night
                      </span>
                    </div>

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {room.amenities.slice(0, 3).map(a => (
                          <span key={a} className="rounded-[6px] px-[8px] py-[3px] text-[11px] font-medium"
                            style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-subtle)' }}>{a}</span>
                        ))}
                        {room.amenities.length > 3 && (
                          <span className="rounded-[6px] px-[8px] py-[3px] text-[11px] font-medium"
                            style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>+{room.amenities.length - 3}</span>
                        )}
                      </div>
                    )}

                    {room.videos && room.videos.length > 0 && (
                      <p className="mt-2 text-[11.5px] text-[#8aa29a]">
                        <span className="text-[#23766a]">▶</span> {room.videos.length} video{room.videos.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[12.5px] text-[#8aa29a]">
                Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} rooms
              </p>
              <div className="flex items-center gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex items-center gap-1 rounded-[8px] border px-3 py-[6px] text-[12.5px] font-medium disabled:opacity-40 bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const n = page <= 3 ? i + 1 : page + i - 2;
                  if (n < 1 || n > pagination.totalPages) return null;
                  return (
                    <button key={n} onClick={() => setPage(n)}
                      className="h-8 w-8 rounded-[8px] text-[12.5px] font-medium transition-colors"
                      style={n === page
                        ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', border: '1px solid #1b342f' }
                        : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', color: isDark ? '#dfd9d0' : 'var(--rp-text)', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.09)' }}>
                      {n}
                    </button>
                  );
                })}
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1 rounded-[8px] border px-3 py-[6px] text-[12.5px] font-medium disabled:opacity-40"
                  style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <RoomModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={data => createMutation.mutate(data)} />
      <RoomModal open={!!editRoom} onClose={() => setEditRoom(null)} room={editRoom} loading={updateMutation.isPending} onSubmit={data => editRoom && updateMutation.mutate({ id: editRoom.id, data })} />
      <RoomDetailSheet room={selectedRoom} onClose={() => setSelectedRoom(null)} onEdit={r => { setEditRoom(r); setSelectedRoom(null); }} onDelete={r => setDeleteRoom(r)} onStatusChange={(id, status) => statusMutation.mutate({ id, status })} statusLoading={statusMutation.isPending} />
      <ConfirmModal open={!!deleteRoom} onClose={() => setDeleteRoom(null)} onConfirm={() => deleteRoom && deleteMutation.mutate(deleteRoom.id)} loading={deleteMutation.isPending} title="Delete Room" description={`Are you sure you want to delete "${deleteRoom?.name}"? This action cannot be undone.`} />
    </div>
  );
}

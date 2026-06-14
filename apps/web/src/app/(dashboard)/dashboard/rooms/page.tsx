'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/modal';
import { RoomModal } from '@/components/rooms/RoomModal';
import { RoomDetailSheet } from '@/components/rooms/RoomDetailSheet';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, BedDouble, Users, DollarSign, Search,
  CheckCircle2, Wrench, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Room } from '@resort-pro/types';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface RoomWithBooking extends Room {
  currentBooking?: {
    id: string;
    confirmationNo: string;
    status: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    guest: { id: string; firstName: string; lastName: string; email: string; phone?: string };
  } | null;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
  VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-gray-100 text-gray-700',
  DELUXE:   'bg-blue-100 text-blue-700',
  SUITE:    'bg-purple-100 text-purple-700',
  VILLA:    'bg-resort-100 text-resort-700',
  COTTAGE:  'bg-green-100 text-green-700',
  BUNGALOW: 'bg-orange-100 text-orange-700',
};

const STATUS_FILTERS = ['', 'AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED'] as const;
const TYPE_FILTERS   = ['', 'STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;

/* ════════════════════════════════════════════════════════════════════════════ */
export default function RoomsPage() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [page,         setPage]         = useState(1);
  const search = useDebounce(searchInput, 350);

  const [selectedRoom, setSelectedRoom] = useState<RoomWithBooking | null>(null);
  const [editRoom,     setEditRoom]     = useState<RoomWithBooking | null>(null);
  const [deleteRoom,   setDeleteRoom]   = useState<RoomWithBooking | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);

  /* ── Queries ── */
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
  const stats = statsData?.data?.data ?? { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0, reserved: 0 };

  /* ── Mutations ── */
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
    onSuccess: () => {
      invalidate();
      toast({ title: 'Room updated' });
      setEditRoom(null);
      setSelectedRoom(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to update room', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => roomsApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      invalidate();
      toast({ title: 'Status updated' });
      if (selectedRoom) setSelectedRoom(r => r ? { ...r, status: vars.status as Room['status'] } : null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomsApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Room deleted' });
      setDeleteRoom(null);
      setSelectedRoom(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to delete room', variant: 'destructive' }),
  });

  /* ── Open detail: fetch fresh room with currentBooking ── */
  const openDetail = async (room: RoomWithBooking) => {
    setSelectedRoom(room); // show immediately with cached data
    try {
      const res = await roomsApi.get(room.id);
      setSelectedRoom(res.data?.data ?? room);
    } catch { /* keep cached */ }
  };

  const resetFilters = () => { setSearchInput(''); setStatusFilter(''); setTypeFilter(''); setPage(1); };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms & Villas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your resort accommodations</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Room
        </Button>
      </div>

      {/* Stats — always from full dataset via /stats endpoint */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          { label: 'Total',       value: stats.total,       color: 'bg-gray-50 border-gray-200',   text: 'text-gray-900',   filter: '' },
          { label: 'Available',   value: stats.available,   color: 'bg-green-50 border-green-200', text: 'text-green-700',  filter: 'AVAILABLE' },
          { label: 'Occupied',    value: stats.occupied,    color: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   filter: 'OCCUPIED' },
          { label: 'Cleaning',    value: stats.cleaning,    color: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  filter: 'CLEANING' },
          { label: 'Maintenance', value: stats.maintenance, color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', filter: 'MAINTENANCE' },
          { label: 'Reserved',    value: stats.reserved,    color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', filter: 'RESERVED' },
        ].map(({ label, value, color, text, filter }) => (
          <button
            key={label}
            onClick={() => { setStatusFilter(statusFilter === filter ? '' : filter); setPage(1); }}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${color} ${statusFilter === filter ? 'ring-2 ring-resort-500' : ''}`}
          >
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${text}`}>{value}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search by name or room #…"
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground">Status:</span>
          {STATUS_FILTERS.map(s => (
            <button key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-resort-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-muted-foreground">Type:</span>
          {TYPE_FILTERS.map(t => (
            <button key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {t ? ROOM_TYPE_LABELS[t] : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <BedDouble className="h-14 w-14 text-gray-200 mb-4" />
            <p className="font-medium text-gray-500">No rooms found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchInput || statusFilter || typeFilter ? 'Try changing your filters' : 'Add your first room to get started'}
            </p>
            {searchInput || statusFilter || typeFilter ? (
              <Button variant="outline" className="mt-4" onClick={resetFilters}>Clear filters</Button>
            ) : (
              <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Room
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map(room => (
              <Card key={room.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => openDetail(room)}>

                {/* Image */}
                {room.images?.[0] ? (
                  <div className="aspect-video w-full overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={room.images[0]} alt={room.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-gradient-to-br from-resort-50 to-resort-100 flex items-center justify-center">
                    <BedDouble className="h-10 w-10 text-resort-300" />
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-muted-foreground">#{room.number}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${ROOM_TYPE_COLORS[room.type]}`}>
                          {ROOM_TYPE_LABELS[room.type]}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{room.name}</p>
                    </div>
                    <StatusBadge status={room.status} />
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
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
                        <span key={a} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{a}</span>
                      ))}
                      {room.amenities.length > 3 && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">+{room.amenities.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Video indicator */}
                  {room.videos && room.videos.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="text-resort-500">▶</span>
                      {room.videos.length} video{room.videos.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} rooms
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const n = page <= 3 ? i + 1 : page + i - 2;
                  if (n < 1 || n > pagination.totalPages) return null;
                  return (
                    <button key={n} onClick={() => setPage(n)}
                      className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                        n === page ? 'bg-resort-600 text-white' : 'border hover:bg-gray-50 text-gray-700'
                      }`}>
                      {n}
                    </button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      <RoomModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        loading={createMutation.isPending}
        onSubmit={data => createMutation.mutate(data)}
      />

      {/* Edit Modal */}
      <RoomModal
        open={!!editRoom}
        onClose={() => setEditRoom(null)}
        room={editRoom}
        loading={updateMutation.isPending}
        onSubmit={data => editRoom && updateMutation.mutate({ id: editRoom.id, data })}
      />

      {/* Detail Sheet */}
      <RoomDetailSheet
        room={selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onEdit={r => { setEditRoom(r); setSelectedRoom(null); }}
        onDelete={r => setDeleteRoom(r)}
        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
        statusLoading={statusMutation.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteRoom}
        onClose={() => setDeleteRoom(null)}
        onConfirm={() => deleteRoom && deleteMutation.mutate(deleteRoom.id)}
        loading={deleteMutation.isPending}
        title="Delete Room"
        description={`Are you sure you want to delete "${deleteRoom?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}

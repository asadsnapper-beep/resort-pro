'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/modal';
import { RoomModal } from '@/components/rooms/RoomModal';
import { RoomDetailSheet } from '@/components/rooms/RoomDetailSheet';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, BedDouble, Users, DollarSign, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Room } from '@resort-pro/types';

const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
  VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-gray-100 text-gray-700',
  DELUXE: 'bg-blue-100 text-blue-700',
  SUITE: 'bg-purple-100 text-purple-700',
  VILLA: 'bg-resort-100 text-resort-700',
  COTTAGE: 'bg-green-100 text-green-700',
  BUNGALOW: 'bg-orange-100 text-orange-700',
};

const STATUS_FILTERS = ['', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'];

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', statusFilter],
    queryFn: () => roomsApi.list({ status: statusFilter || undefined, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => roomsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Room added successfully' });
      setAddOpen(false);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to add room', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => roomsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Room updated' });
      setEditRoom(null);
      setSelectedRoom(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update room', variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => roomsApi.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Status updated' });
      if (selectedRoom) setSelectedRoom((r) => r ? { ...r, status: vars.status as Room['status'] } : null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Room deleted' });
      setDeleteRoom(null);
      setSelectedRoom(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete room', variant: 'destructive' }),
  });

  const allRooms: Room[] = data?.data?.data ?? [];
  const rooms = allRooms.filter((r) =>
    search === '' ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.number.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: allRooms.length,
    available: allRooms.filter((r) => r.status === 'AVAILABLE').length,
    occupied: allRooms.filter((r) => r.status === 'OCCUPIED').length,
    maintenance: allRooms.filter((r) => r.status === 'MAINTENANCE').length,
  };

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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Rooms', value: stats.total, color: 'bg-gray-50 border-gray-200', text: 'text-gray-900' },
          { label: 'Available', value: stats.available, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: 'Occupied', value: stats.occupied, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'Maintenance', value: stats.maintenance, color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
        ].map(({ label, value, color, text }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-resort-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <BedDouble className="h-14 w-14 text-gray-200 mb-4" />
            <p className="font-medium text-gray-500">No rooms found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || statusFilter ? 'Try changing your filters' : 'Add your first room to get started'}
            </p>
            {!search && !statusFilter && (
              <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Room
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setSelectedRoom(room)}
            >
              {/* Room Image */}
              {room.images?.[0] ? (
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  <img
                    src={room.images[0]}
                    alt={room.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
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
                    {room.amenities.slice(0, 3).map((a) => (
                      <span key={a} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{a}</span>
                    ))}
                    {room.amenities.length > 3 && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">+{room.amenities.length - 3}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <RoomModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        loading={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      {/* Edit Modal */}
      <RoomModal
        open={!!editRoom}
        onClose={() => setEditRoom(null)}
        room={editRoom}
        loading={updateMutation.isPending}
        onSubmit={(data) => editRoom && updateMutation.mutate({ id: editRoom.id, data })}
      />

      {/* Detail Sheet */}
      <RoomDetailSheet
        room={selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onEdit={(r) => { setEditRoom(r); setSelectedRoom(null); }}
        onDelete={(r) => setDeleteRoom(r)}
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

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, BedDouble, Users, DollarSign } from 'lucide-react';
import type { Room } from '@resort-pro/types';

const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite',
  VILLA: 'Villa', COTTAGE: 'Cottage', BUNGALOW: 'Bungalow',
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-gray-100 text-gray-700', DELUXE: 'bg-blue-100 text-blue-700',
  SUITE: 'bg-purple-100 text-purple-700', VILLA: 'bg-resort-100 text-resort-700',
  COTTAGE: 'bg-green-100 text-green-700', BUNGALOW: 'bg-orange-100 text-orange-700',
};

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', statusFilter],
    queryFn: () => roomsApi.list({ status: statusFilter || undefined }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => roomsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: 'Room status updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }),
  });

  const rooms: Room[] = data?.data?.data || [];

  const stats = {
    total: rooms.length,
    available: rooms.filter((r) => r.status === 'AVAILABLE').length,
    occupied: rooms.filter((r) => r.status === 'OCCUPIED').length,
    maintenance: rooms.filter((r) => r.status === 'MAINTENANCE').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rooms & Villas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your resort accommodations</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Room
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-gray-50 border-gray-200' },
          { label: 'Available', value: stats.available, color: 'bg-green-50 border-green-200' },
          { label: 'Occupied', value: stats.occupied, color: 'bg-blue-50 border-blue-200' },
          { label: 'Maintenance', value: stats.maintenance, color: 'bg-yellow-50 border-yellow-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-resort-600 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BedDouble className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground">No rooms found. Add your first room to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-muted-foreground">#{room.number}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ROOM_TYPE_COLORS[room.type]}`}>
                        {ROOM_TYPE_LABELS[room.type]}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-white">{room.name}</p>
                  </div>
                  <StatusBadge status={room.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>Max {room.maxOccupancy}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>{formatCurrency(room.basePrice)}/night</span>
                  </div>
                </div>

                {room.amenities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {room.amenities.slice(0, 3).map((a) => (
                      <span key={a} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{a}</span>
                    ))}
                    {room.amenities.length > 3 && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">+{room.amenities.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {room.status !== 'AVAILABLE' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: room.id, status: 'AVAILABLE' })}>
                      Set Available
                    </Button>
                  )}
                  {room.status !== 'MAINTENANCE' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: room.id, status: 'MAINTENANCE' })}>
                      Maintenance
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

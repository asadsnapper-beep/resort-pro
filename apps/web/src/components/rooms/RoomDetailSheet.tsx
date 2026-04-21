'use client';

import { X, BedDouble, Users, DollarSign, Building2, Pencil, Trash2, CheckCircle2, Wrench } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import type { Room } from '@resort-pro/types';

const ROOM_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-gray-100 text-gray-700',
  DELUXE: 'bg-blue-100 text-blue-700',
  SUITE: 'bg-purple-100 text-purple-700',
  VILLA: 'bg-resort-100 text-resort-700',
  COTTAGE: 'bg-green-100 text-green-700',
  BUNGALOW: 'bg-orange-100 text-orange-700',
};

interface Props {
  room: Room | null;
  onClose: () => void;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onStatusChange: (id: string, status: string) => void;
  statusLoading: boolean;
}

export function RoomDetailSheet({ room, onClose, onEdit, onDelete, onStatusChange, statusLoading }: Props) {
  if (!room) return null;

  const images = room.images ?? [];
  const amenities = room.amenities ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg px-2 py-1 text-xs font-semibold', ROOM_TYPE_COLORS[room.type])}>
              {room.type.charAt(0) + room.type.slice(1).toLowerCase()}
            </div>
            <span className="font-mono text-sm text-muted-foreground">#{room.number}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Image Gallery */}
          {images.length > 0 ? (
            <div className="relative">
              <img
                src={images[0]}
                alt={room.name}
                className="w-full aspect-video object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x450?text=No+Image'; }}
              />
              {images.length > 1 && (
                <div className="flex gap-2 p-3 bg-gray-50 border-b overflow-x-auto">
                  {images.slice(1).map((img, i) => (
                    <img key={i} src={img} alt="" className="h-14 w-20 rounded object-cover flex-shrink-0 border"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/80x56?text=img'; }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center aspect-video bg-gray-100">
              <BedDouble className="h-16 w-16 text-gray-300" />
            </div>
          )}

          {/* Info */}
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{room.name}</h2>
                {room.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{room.description}</p>}
              </div>
              <StatusBadge status={room.status} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: DollarSign, label: 'Per Night', value: formatCurrency(Number(room.basePrice)) },
                { icon: Users, label: 'Max Guests', value: `${room.maxOccupancy} guests` },
                { icon: Building2, label: 'Floor', value: room.floor ? `Floor ${room.floor}` : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                  <Icon className="h-4 w-4 text-resort-600 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <span key={a} className="rounded-lg bg-resort-50 border border-resort-100 px-2.5 py-1 text-xs font-medium text-resort-700">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Status Actions */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Change Status</h3>
              <div className="flex flex-wrap gap-2">
                {(['AVAILABLE', 'MAINTENANCE'] as const).filter((s) => s !== room.status).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    loading={statusLoading}
                    onClick={() => onStatusChange(room.id, s)}
                    className={cn(s === 'AVAILABLE' ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50')}
                  >
                    {s === 'AVAILABLE' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 border-t px-6 py-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(room)}>
            <Pencil className="h-4 w-4" /> Edit Room
          </Button>
          <Button variant="destructive" size="icon" onClick={() => onDelete(room)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

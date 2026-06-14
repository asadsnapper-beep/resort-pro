'use client';

import { useState } from 'react';
import {
  X, BedDouble, Users, DollarSign, Building2, Pencil, Trash2,
  CheckCircle2, Wrench, Lock, Film, User, CalendarDays, ExternalLink, Sparkles,
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import type { Room } from '@resort-pro/types';

const ROOM_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-gray-100 text-gray-700',
  DELUXE:   'bg-blue-100 text-blue-700',
  SUITE:    'bg-purple-100 text-purple-700',
  VILLA:    'bg-resort-100 text-resort-700',
  COTTAGE:  'bg-green-100 text-green-700',
  BUNGALOW: 'bg-orange-100 text-orange-700',
};

interface CurrentBooking {
  id: string;
  confirmationNo: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

interface RoomWithBooking extends Room {
  currentBooking?: CurrentBooking | null;
}

interface Props {
  room: RoomWithBooking | null;
  onClose: () => void;
  onEdit: (room: RoomWithBooking) => void;
  onDelete: (room: RoomWithBooking) => void;
  onStatusChange: (id: string, status: string) => void;
  statusLoading: boolean;
}

/** Detect YouTube/Vimeo and return embed URL, otherwise treat as direct video */
function getVideoEmbed(url: string): { type: 'youtube' | 'vimeo' | 'direct'; src: string } {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}` };

  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return { type: 'vimeo', src: `https://player.vimeo.com/video/${vmMatch[1]}` };

  return { type: 'direct', src: url };
}

const STATUS_ACTIONS = [
  { status: 'AVAILABLE',   label: 'Available',   icon: CheckCircle2, cls: 'border-green-200 text-green-700 hover:bg-green-50'    },
  { status: 'CLEANING',    label: 'Cleaning',    icon: Sparkles,     cls: 'border-amber-200 text-amber-700 hover:bg-amber-50'    },
  { status: 'MAINTENANCE', label: 'Maintenance', icon: Wrench,       cls: 'border-yellow-200 text-yellow-700 hover:bg-yellow-50' },
  { status: 'RESERVED',    label: 'Reserved',    icon: Lock,         cls: 'border-blue-200 text-blue-700 hover:bg-blue-50'      },
] as const;

export function RoomDetailSheet({ room, onClose, onEdit, onDelete, onStatusChange, statusLoading }: Props) {
  const router = useRouter();
  const [activeVideo, setActiveVideo] = useState(0);

  if (!room) return null;

  const images   = room.images  ?? [];
  const amenities = room.amenities ?? [];
  const videos   = room.videos  ?? [];

  const booking = room.currentBooking ?? null;

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt={room.name}
                className="w-full aspect-video object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x450?text=No+Image'; }} />
              {images.length > 1 && (
                <div className="flex gap-2 p-3 bg-gray-50 border-b overflow-x-auto">
                  {images.slice(1).map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img} alt="" className="h-14 w-20 rounded object-cover flex-shrink-0 border"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/80x56?text=img'; }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center aspect-video bg-gray-100">
              <BedDouble className="h-16 w-16 text-gray-300" />
            </div>
          )}

          <div className="p-6 space-y-6">

            {/* Title + Status */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{room.name}</h2>
                {room.description && (
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{room.description}</p>
                )}
              </div>
              <StatusBadge status={room.status} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: DollarSign, label: 'Per Night', value: formatCurrency(Number(room.basePrice)) },
                { icon: Users,      label: 'Max Guests', value: `${room.maxOccupancy} guests` },
                { icon: Building2,  label: 'Floor', value: room.floor ? `Floor ${room.floor}` : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                  <Icon className="h-4 w-4 text-resort-600 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {/* Current / Upcoming Booking */}
            {booking && (
              <div className={cn(
                'rounded-xl border p-4 space-y-3',
                booking.status === 'CHECKED_IN'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-amber-50 border-amber-200',
              )}>
                <div className="flex items-center justify-between">
                  <p className={cn('text-xs font-semibold uppercase tracking-wider',
                    booking.status === 'CHECKED_IN' ? 'text-blue-600' : 'text-amber-600')}>
                    {booking.status === 'CHECKED_IN' ? '🏠 Currently Occupied' : '📅 Upcoming Booking'}
                  </p>
                  <button
                    onClick={() => router.push(`/dashboard/bookings?id=${booking.id}`)}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    title="Open booking"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-white border flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {booking.guest.firstName} {booking.guest.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{booking.guest.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Check-in: <strong className="text-gray-800">{formatDate(booking.checkIn)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Check-out: <strong className="text-gray-800">{formatDate(booking.checkOut)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{booking.adults} adult{booking.adults !== 1 ? 's' : ''}{booking.children > 0 ? `, ${booking.children} child${booking.children !== 1 ? 'ren' : ''}` : ''}</span>
                  <span className="font-mono text-gray-600">{booking.confirmationNo}</span>
                </div>
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.map(a => (
                    <span key={a} className="rounded-lg bg-resort-50 border border-resort-100 px-2.5 py-1 text-xs font-medium text-resort-700">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Film className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700">Videos</h3>
                </div>

                {/* Tabs if multiple videos */}
                {videos.length > 1 && (
                  <div className="flex gap-1 mb-3">
                    {videos.map((_, i) => (
                      <button key={i} onClick={() => setActiveVideo(i)}
                        className={cn('h-1.5 flex-1 rounded-full transition-colors',
                          i === activeVideo ? 'bg-resort-600' : 'bg-gray-200 hover:bg-gray-300')} />
                    ))}
                  </div>
                )}

                {(() => {
                  const embed = getVideoEmbed(videos[activeVideo]);
                  if (embed.type === 'direct') {
                    return (
                      <video src={embed.src} controls className="w-full rounded-xl aspect-video bg-black" />
                    );
                  }
                  return (
                    <iframe
                      src={embed.src}
                      className="w-full rounded-xl aspect-video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                })()}

                {/* URL list for non-embeddable or extra context */}
                {videos.length > 1 && (
                  <div className="mt-2 space-y-1">
                    {videos.map((url, i) => (
                      <button key={i} onClick={() => setActiveVideo(i)}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-left transition-colors',
                          i === activeVideo ? 'bg-resort-50 text-resort-700 font-medium' : 'text-gray-600 hover:bg-gray-50',
                        )}>
                        <Film className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{url}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status Change */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Change Status</h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS.filter(s => s.status !== room.status).map(({ status, label, icon: Icon, cls }) => (
                  <Button key={status} size="sm" variant="outline"
                    loading={statusLoading}
                    onClick={() => onStatusChange(room.id, status)}
                    className={cls}>
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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

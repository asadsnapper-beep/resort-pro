'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, BedDouble, Users, DollarSign, Building2, Pencil, Trash2,
  CheckCircle2, Wrench, Lock, Film, User, CalendarDays, ExternalLink, Sparkles,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import type { Room } from '@resort-pro/types';

const ROOM_TYPE_META: Record<string, { bg: string; border: string; text: string }> = {
  STANDARD: { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
  DELUXE:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  SUITE:    { bg: '#f5f0fe', border: 'rgba(120,70,200,0.15)', text: '#7846c8' },
  VILLA:    { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  COTTAGE:  { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  BUNGALOW: { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
};

const STATUS_META: Record<string, { bg: string; border: string; text: string; label: string }> = {
  AVAILABLE:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Available'   },
  OCCUPIED:    { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Occupied'    },
  CLEANING:    { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a', label: 'Cleaning'    },
  MAINTENANCE: { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c', label: 'Maintenance' },
  RESERVED:    { bg: '#f5f0fe', border: 'rgba(120,70,200,0.15)',text: '#7846c8', label: 'Reserved'    },
};

const STATUS_ACTIONS = [
  { status: 'CLEANING',    label: 'Cleaning',    Icon: Sparkles,     bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  { status: 'MAINTENANCE', label: 'Maintenance', Icon: Wrench,       bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  { status: 'RESERVED',    label: 'Reserved',    Icon: Lock,         bg: '#f5f0fe', border: 'rgba(120,70,200,0.15)',text: '#7846c8' },
  { status: 'AVAILABLE',   label: 'Available',   Icon: CheckCircle2, bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a' },
] as const;

function getVideoEmbed(url: string): { type: 'youtube' | 'vimeo' | 'direct'; src: string } {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return { type: 'vimeo', src: `https://player.vimeo.com/video/${vmMatch[1]}` };
  return { type: 'direct', src: url };
}

interface CurrentBooking {
  id: string; confirmationNo: string; status: string;
  checkIn: string; checkOut: string; adults: number; children: number;
  guest: { id: string; firstName: string; lastName: string; email: string; phone?: string };
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

export function RoomDetailSheet({ room, onClose, onEdit, onDelete, onStatusChange, statusLoading }: Props) {
  const router = useRouter();
  const [activeVideo, setActiveVideo] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (room) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [room]);

  if (!room || !mounted) return null;

  const images    = room.images    ?? [];
  const amenities = room.amenities ?? [];
  const videos    = room.videos    ?? [];
  const booking   = room.currentBooking ?? null;

  const typeMeta   = ROOM_TYPE_META[room.type]   ?? ROOM_TYPE_META.STANDARD;
  const statusMeta = STATUS_META[room.status]     ?? STATUS_META.AVAILABLE;

  const sheet = (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}
        style={{ background: 'rgba(27,52,47,0.3)', backdropFilter: 'blur(3px)' }} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white"
        style={{ boxShadow: '-8px 0 40px rgba(27,52,47,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: 'var(--rp-btn-accent)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <span className="rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.12)', color: 'var(--rp-btn-accent-text)' }}>
              {room.type.charAt(0) + room.type.slice(1).toLowerCase()}
            </span>
            <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>#{room.number}</span>
          </div>
          <button onClick={onClose}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Image */}
          {images.length > 0 ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt={room.name}
                className="aspect-video w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3"
                  style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {images.slice(1).map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img} alt=""
                      className="h-14 w-20 shrink-0 rounded-[6px] object-cover"
                      style={{ border: '1px solid rgba(0,0,0,0.07)' }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center"
              style={{ background: '#e8f4f2' }}>
              <BedDouble className="h-16 w-16" style={{ color: '#9bbdb7' }} strokeWidth={1.5} />
            </div>
          )}

          <div className="space-y-5 p-5">

            {/* Title + status */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-[20px] font-semibold leading-tight" style={{ color: 'var(--rp-text)' }}>{room.name}</h2>
                {room.description && (
                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--rp-text-muted)' }}>{room.description}</p>
                )}
              </div>
              <span className="shrink-0 rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
                style={{ background: statusMeta.bg, borderColor: statusMeta.border, color: statusMeta.text }}>
                {statusMeta.label}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { Icon: DollarSign, label: 'Per Night',   value: formatCurrency(Number(room.basePrice)) },
                { Icon: Users,      label: 'Max Guests',  value: `${room.maxOccupancy} guests` },
                { Icon: Building2,  label: 'Floor',       value: room.floor ? `Floor ${room.floor}` : '—' },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="rounded-[12px] p-3 text-center"
                  style={{ background: 'var(--rp-surface-3)' }}>
                  <Icon className="mx-auto mb-1.5 h-4 w-4" style={{ color: '#23766a' }} />
                  <p className="text-[10.5px]" style={{ color: 'var(--rp-text-muted)' }}>{label}</p>
                  <p className="mt-0.5 text-[13px] font-semibold" style={{ color: 'var(--rp-text)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Current booking */}
            {booking && (
              <div className="rounded-[12px] border p-4 space-y-3"
                style={booking.status === 'CHECKED_IN'
                  ? { background: 'var(--rp-teal-soft)', borderColor: 'rgba(35,118,106,0.2)' }
                  : { background: '#fffdf6', borderColor: 'rgba(184,144,64,0.2)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: booking.status === 'CHECKED_IN' ? '#23766a' : '#b89040' }}>
                    {booking.status === 'CHECKED_IN' ? '🏠 Currently Occupied' : '📅 Upcoming Booking'}
                  </p>
                  <button onClick={() => router.push(`/dashboard/bookings?id=${booking.id}`)}
                    className="transition-opacity hover:opacity-70" style={{ color: 'var(--rp-text-muted)' }}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white">
                    <User className="h-4 w-4" style={{ color: 'var(--rp-text-muted)' }} />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold" style={{ color: 'var(--rp-text)' }}>
                      {booking.guest.firstName} {booking.guest.lastName}
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--rp-text-muted)' }}>{booking.guest.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--rp-text-muted)' }}>
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Check-in: <strong style={{ color: 'var(--rp-text)' }}>{formatDate(booking.checkIn)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--rp-text-muted)' }}>
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Check-out: <strong style={{ color: 'var(--rp-text)' }}>{formatDate(booking.checkOut)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--rp-text-muted)' }}>
                    {booking.adults} adult{booking.adults !== 1 ? 's' : ''}{booking.children > 0 ? `, ${booking.children} child${booking.children !== 1 ? 'ren' : ''}` : ''}
                  </span>
                  <span className="font-mono" style={{ color: 'var(--rp-text-subtle)' }}>{booking.confirmationNo}</span>
                </div>
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-2.5" style={{ color: 'var(--rp-text-muted)' }}>Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map(a => (
                    <span key={a} className="rounded-[7px] border px-[9px] py-[4px] text-[12px] font-medium"
                      style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Film className="h-4 w-4" style={{ color: '#9bbdb7' }} />
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--rp-text-muted)' }}>Videos</p>
                </div>
                {videos.length > 1 && (
                  <div className="flex gap-1 mb-3">
                    {videos.map((_, i) => (
                      <button key={i} onClick={() => setActiveVideo(i)}
                        className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{ background: i === activeVideo ? '#23766a' : '#e8e5e0' }} />
                    ))}
                  </div>
                )}
                {(() => {
                  const embed = getVideoEmbed(videos[activeVideo]);
                  if (embed.type === 'direct') return (
                    <video src={embed.src} controls className="aspect-video w-full rounded-[10px] bg-black" />
                  );
                  return (
                    <iframe src={embed.src} className="aspect-video w-full rounded-[10px]"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  );
                })()}
                {videos.length > 1 && (
                  <div className="mt-2 space-y-1">
                    {videos.map((url, i) => (
                      <button key={i} onClick={() => setActiveVideo(i)}
                        className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[12px] transition-colors"
                        style={i === activeVideo
                          ? { background: 'var(--rp-teal-bg)', color: '#23766a', fontWeight: 500 }
                          : { color: 'var(--rp-text-muted)' }}>
                        <Film className="h-3 w-3 shrink-0" />
                        <span className="truncate">{url}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Change Status */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-2.5" style={{ color: 'var(--rp-text-muted)' }}>Change Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS.filter(s => s.status !== room.status).map(({ status, label, Icon, bg, border, text }) => (
                  <button key={status}
                    disabled={statusLoading}
                    onClick={() => onStatusChange(room.id, status)}
                    className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 hover:opacity-80"
                    style={{ background: bg, borderColor: border, color: text }}>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={() => onEdit(room)}
            className="flex flex-1 items-center justify-center gap-2 rounded-[9px] border py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            <Pencil className="h-4 w-4" /> Edit Room
          </button>
          <button onClick={() => onDelete(room)}
            className="flex items-center justify-center rounded-[9px] border px-3 py-2 transition-colors hover:bg-[#fef2f2]"
            style={{ borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(sheet, document.body);
}

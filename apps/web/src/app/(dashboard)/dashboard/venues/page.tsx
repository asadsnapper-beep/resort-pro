'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { venuesApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { toast } from '@/hooks/use-toast';
import {
  Building2, Plus, Loader2, Users, Pencil, Trash2, CalendarPlus,
  MapPin, Clock, X, Film,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface Venue {
  id: string;
  name: string;
  type: 'INDOOR' | 'OUTDOOR' | 'BOTH';
  capacity: number;
  description: string | null;
  photos: string[];
  videos: string[];
  halfDayRate: number | null;
  fullDayRate: number | null;
  hourlyRate: number | null;
  opensAt: string;
  closesAt: string;
  minAdvanceHrs: number;
  bookings: { id: string; date: string; clientName: string }[];
}

interface VenueBooking {
  id: string;
  venue: { id: string; name: string };
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  eventType: string;
  date: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  baseAmount: number;
  addonsAmount: number;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  status: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
}

const EVENT_TYPES = ['WEDDING', 'BIRTHDAY', 'CORPORATE', 'SOCIAL', 'OTHER'];
const VENUE_TYPES = ['INDOOR', 'OUTDOOR', 'BOTH'];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  TENTATIVE: { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  CONFIRMED: { bg: 'var(--rp-teal-bg)', text: '#183153' },
  CANCELLED: { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
};

export default function VenuesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'venues' | 'bookings'>('venues');
  const [addVenueOpen, setAddVenueOpen] = useState(false);
  const [editVenue, setEditVenue] = useState<Venue | null>(null);
  const [bookingVenue, setBookingVenue] = useState<Venue | null>(null);

  const { data: venuesData, isLoading: venuesLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesApi.list().then((r) => r.data.data as Venue[]),
  });
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['venue-bookings'],
    queryFn: () => venuesApi.listBookings().then((r) => r.data.data as VenueBooking[]),
  });

  const venues = venuesData ?? [];
  const bookings = bookingsData ?? [];

  const removeMutation = useMutation({
    mutationFn: (id: string) => venuesApi.remove(id),
    onSuccess: () => { toast({ title: 'Venue removed' }); queryClient.invalidateQueries({ queryKey: ['venues'] }); },
  });

  return (
    <PageShell gap={6}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-rp-ctrl" style={{ background: 'var(--rp-teal-bg)' }}>
            <Building2 className="h-4 w-4" style={{ color: '#183153' }} />
          </div>
          <PageHeader
            title="Venues & Events"
            subtitle="Conference hall, pool, lawn — alada kore bhara deya"
            tightSubtitle
          />
        </div>
        {tab === 'venues' && (
          <button
            onClick={() => setAddVenueOpen(true)}
            className="flex items-center gap-2 rounded-rp-ctrl px-4 py-[9px] text-[13px] font-semibold hover:opacity-90"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            <Plus className="h-4 w-4" /> Add Venue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-rp-btn p-1 w-fit" style={{ background: 'var(--rp-surface-3)' }}>
        {(['venues', 'bookings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-rp-ctrl px-4 py-1.5 text-[13px] font-medium capitalize transition-colors"
            style={tab === t
              ? { background: 'var(--rp-surface)', color: 'var(--rp-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
              : { color: 'var(--rp-text-muted)' }}
          >
            {t === 'venues' ? 'Venues' : `Bookings (${bookings.length})`}
          </button>
        ))}
      </div>

      {tab === 'venues' ? (
        venuesLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: '#aac0d0' }} /></div>
        ) : venues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-rp-card border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
              <Building2 className="h-7 w-7 text-[#94a3b8] dark:text-[#7f99ab]" />
            </div>
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">Ekhono kono venue add kora hoyni.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {venues.map((v) => (
              <div key={v.id} className="rounded-rp-card border bg-white p-5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                {v.photos?.[0] && (
                  <div className="mb-3 overflow-hidden rounded-rp-btn" style={{ aspectRatio: '16/9', background: 'var(--rp-surface-4)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.photos[0]} alt={v.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[15px] font-semibold text-[#183153] dark:text-[#f8fafc]">{v.name}</p>
                    <p className="flex items-center gap-1.5 mt-0.5 text-rp-meta text-[#64748b] dark:text-[#a9c1d0]">
                      <Users className="h-3 w-3" /> {v.capacity} pax · {v.type}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditVenue(v)} className="rounded-[7px] p-1.5 hover:bg-[#f4f1eb]" style={{ color: 'var(--rp-text-subtle)' }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm(`Remove ${v.name}?`)) removeMutation.mutate(v.id); }} className="rounded-[7px] p-1.5 hover:bg-[#fbeceb]" style={{ color: '#c43c3c' }}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-rp-meta text-[#475569] dark:text-[#9db4c4]">
                  {v.halfDayRate && <span>Half-day: ৳{v.halfDayRate.toLocaleString()}</span>}
                  {v.fullDayRate && <span>Full-day: ৳{v.fullDayRate.toLocaleString()}</span>}
                  {v.hourlyRate && <span>Hourly: ৳{v.hourlyRate.toLocaleString()}</span>}
                </div>
                <p className="flex items-center gap-1.5 mb-3 text-rp-label text-[#64748b] dark:text-[#a9c1d0]">
                  <Clock className="h-3 w-3" /> {v.opensAt}–{v.closesAt} · {v.bookings.length} upcoming booking{v.bookings.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setBookingVenue(v)}
                  className="flex w-full items-center justify-center gap-2 rounded-rp-ctrl px-3 py-2 text-rp-meta font-semibold hover:opacity-90"
                  style={{ background: 'var(--rp-amber-bg)', color: '#b89040' }}
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> New Booking
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        bookingsLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: '#aac0d0' }} /></div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-rp-card border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
            <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">Ekhono kono booking nai.</p>
          </div>
        ) : (
          <div className="rounded-rp-card border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-rp-ctrl" style={{ background: 'var(--rp-teal-bg)' }}>
                  <MapPin className="h-4 w-4" style={{ color: '#183153' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-rp-body font-medium text-[#183153] dark:text-[#f8fafc]">{b.clientName} — {b.venue.name}</p>
                  <p className="text-rp-meta mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">
                    {new Date(b.date).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · {b.startTime}–{b.endTime} · {b.guestCount} guests · {b.eventType}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-rp-body font-semibold text-[#183153] dark:text-[#f8fafc]">৳{b.totalAmount.toLocaleString()}</p>
                  <p className="text-[11px] text-[#64748b] dark:text-[#a9c1d0]">৳{b.paidAmount.toLocaleString()} paid</p>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: STATUS_STYLE[b.status].bg, color: STATUS_STYLE[b.status].text }}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {addVenueOpen && (
        <VenueFormModal onClose={() => setAddVenueOpen(false)} onDone={() => { setAddVenueOpen(false); queryClient.invalidateQueries({ queryKey: ['venues'] }); }} />
      )}
      {editVenue && (
        <VenueFormModal venue={editVenue} onClose={() => setEditVenue(null)} onDone={() => { setEditVenue(null); queryClient.invalidateQueries({ queryKey: ['venues'] }); }} />
      )}
      {bookingVenue && (
        <BookingFormModal
          venue={bookingVenue}
          onClose={() => setBookingVenue(null)}
          onDone={() => {
            setBookingVenue(null);
            queryClient.invalidateQueries({ queryKey: ['venue-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['venues'] });
            setTab('bookings');
          }}
        />
      )}
    </PageShell>
  );
}

function VenueFormModal({ venue, onClose, onDone }: { venue?: Venue; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(venue?.name ?? '');
  const [type, setType] = useState(venue?.type ?? 'INDOOR');
  const [capacity, setCapacity] = useState(String(venue?.capacity ?? ''));
  const [halfDayRate, setHalfDayRate] = useState(venue?.halfDayRate ? String(venue.halfDayRate) : '');
  const [fullDayRate, setFullDayRate] = useState(venue?.fullDayRate ? String(venue.fullDayRate) : '');
  const [hourlyRate, setHourlyRate] = useState(venue?.hourlyRate ? String(venue.hourlyRate) : '');
  const [opensAt, setOpensAt] = useState(venue?.opensAt ?? '08:00');
  const [closesAt, setClosesAt] = useState(venue?.closesAt ?? '22:00');
  const [photos, setPhotos] = useState<string[]>(venue?.photos ?? []);
  const [videos, setVideos] = useState<string[]>(venue?.videos ?? []);
  const [videoInput, setVideoInput] = useState('');
  const [videoError, setVideoError] = useState('');

  const addVideo = () => {
    const t = videoInput.trim();
    if (!t) return;
    if (videos.includes(t)) { setVideoError('Already added'); return; }
    setVideos((p) => [...p, t]);
    setVideoInput('');
    setVideoError('');
  };

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name, type, capacity: Number(capacity),
        halfDayRate: halfDayRate ? Number(halfDayRate) : undefined,
        fullDayRate: fullDayRate ? Number(fullDayRate) : undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        opensAt, closesAt, photos, videos,
      };
      return venue ? venuesApi.update(venue.id, data) : venuesApi.create(data);
    },
    onSuccess: () => { toast({ title: venue ? 'Venue updated' : 'Venue added' }); onDone(); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not save venue', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={venue ? `Edit — ${venue.name}` : 'Add Venue'}
      description="Conference room, banquet hall, lawn, pool deck — jekono bhara-deya jaygar jonno"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rounded-rp-ctrl border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || !capacity || mutation.isPending}
            className="flex items-center gap-2 rounded-rp-ctrl px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Banquet Hall"
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Capacity (pax)</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="200"
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}>
            {VENUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Half-day rate (৳)</label>
            <input type="number" min={0} value={halfDayRate} onChange={(e) => setHalfDayRate(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Full-day rate (৳)</label>
            <input type="number" min={0} value={fullDayRate} onChange={(e) => setFullDayRate(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Hourly rate (৳)</label>
            <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Opens at</label>
            <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Closes at</label>
            <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>

        {/* Photos — shown on the public website so guests know what they're
            booking; without these the site falls back to generic stock photos. */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <label className="text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Photos</label>
            <span className="text-rp-label" style={{ color: 'var(--rp-text-faint)' }}>{photos.length} / 8</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((img, i) => (
              <div key={i} className="group relative overflow-hidden rounded-rp-ctrl" style={{ aspectRatio: '16/9', background: 'var(--rp-surface-4)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-none bg-black/65 text-white">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {photos.length < 8 && (
              <ImageUpload value={null} onChange={(url) => { if (url) setPhotos((p) => [...p, url]); }}
                folder="venues" aspectRatio="video" className="col-span-1" />
            )}
          </div>
        </div>

        {/* Videos */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" style={{ color: '#9bbdb7' }} />
              <label className="text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Videos</label>
            </div>
            <span className="text-rp-label" style={{ color: 'var(--rp-text-faint)' }}>{videos.length} / 4</span>
          </div>
          <p className="mb-2 text-rp-label" style={{ color: 'var(--rp-text-faint)' }}>YouTube, Vimeo, or direct MP4 link</p>
          {videos.length < 4 && (
            <div className="mb-2 flex gap-2">
              <input value={videoInput}
                onChange={(e) => { setVideoInput(e.target.value); setVideoError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVideo(); } }}
                placeholder="https://youtube.com/watch?v=…"
                className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
              <button type="button" onClick={addVideo}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-rp-ctrl border" style={{ borderColor: 'rgba(0,0,0,0.08)', background: 'var(--rp-surface-3)', color: 'var(--rp-text-subtle)' }}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
          {videoError && <p className="mb-1.5 text-rp-label text-red-500">{videoError}</p>}
          {videos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {videos.map((url, i) => (
                <div key={i} className="flex items-center gap-2 rounded-rp-ctrl border px-3 py-2" style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'var(--rp-surface-3)' }}>
                  <Film className="h-3.5 w-3.5 shrink-0" style={{ color: '#9bbdb7' }} />
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 truncate text-rp-meta" style={{ color: '#23766a', textDecoration: 'none' }}>
                    {url}
                  </a>
                  <button type="button" onClick={() => setVideos((p) => p.filter((_, idx) => idx !== i))}
                    className="shrink-0 border-none bg-transparent" style={{ color: 'var(--rp-text-faint)' }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function BookingFormModal({ venue, onClose, onDone }: { venue: Venue; onClose: () => void; onDone: () => void }) {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [eventType, setEventType] = useState('OTHER');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [guestCount, setGuestCount] = useState('');
  const [baseAmount, setBaseAmount] = useState(venue.fullDayRate ? String(venue.fullDayRate) : '');
  const [addonsAmount, setAddonsAmount] = useState('0');
  const [notes, setNotes] = useState('');

  const total = (Number(baseAmount) || 0) + (Number(addonsAmount) || 0);

  const mutation = useMutation({
    mutationFn: () => venuesApi.createBooking({
      venueId: venue.id, clientName, clientPhone, eventType, date, startTime, endTime,
      guestCount: Number(guestCount), baseAmount: Number(baseAmount), addonsAmount: Number(addonsAmount) || 0,
      notes: notes || undefined,
    }),
    onSuccess: () => { toast({ title: 'Booking created' }); onDone(); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not create booking', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`New Booking — ${venue.name}`}
      maxWidth="720px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--rp-text)' }}>Total: ৳{total.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="rounded-rp-ctrl border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!clientName || !clientPhone || !date || !guestCount || !baseAmount || mutation.isPending}
              className="flex items-center gap-2 rounded-rp-ctrl px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Booking
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Client Name</label>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Phone</label>
            <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Event Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Guests</label>
            <input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder={`max ${venue.capacity}`}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Base Amount (৳)</label>
            <input type="number" min={0} value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
            {(venue.halfDayRate || venue.fullDayRate) && (
              <p className="mt-1 text-[11px] text-[#64748b] dark:text-[#a9c1d0]">
                {venue.halfDayRate && <span>Half-day: ৳{venue.halfDayRate.toLocaleString()} </span>}
                {venue.fullDayRate && <span>· Full-day: ৳{venue.fullDayRate.toLocaleString()}</span>}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Add-ons Amount (৳)</label>
            <input type="number" min={0} value={addonsAmount} onChange={(e) => setAddonsAmount(e.target.value)}
              className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-rp-meta font-medium text-[#475569] dark:text-[#a9c1d0]">Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Catering + projector needed by 9am"
            className="w-full rounded-rp-ctrl border px-3.5 py-2.5 text-rp-body outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
        </div>
      </div>
    </ModalShell>
  );
}

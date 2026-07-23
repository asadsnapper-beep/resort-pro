'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { venuesApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { toast } from '@/hooks/use-toast';
import {
  Building2, Plus, Loader2, Users, Pencil, Trash2, CalendarPlus,
  MapPin, Clock,
} from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  type: 'INDOOR' | 'OUTDOOR' | 'BOTH';
  capacity: number;
  description: string | null;
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
  CONFIRMED: { bg: 'var(--rp-teal-bg)', text: '#23766a' },
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
    <div className="max-w-5xl space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
            <Building2 className="h-4 w-4" style={{ color: '#23766a' }} />
          </div>
          <div>
            <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f] dark:text-[#dfd9d0]">
              Venues & Events
            </h1>
            <p className="text-[13px] text-[#7a9890] dark:text-[#94b8b0]">
              Conference hall, pool, lawn — alada kore bhara deya
            </p>
          </div>
        </div>
        {tab === 'venues' && (
          <button
            onClick={() => setAddVenueOpen(true)}
            className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold hover:opacity-90"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            <Plus className="h-4 w-4" /> Add Venue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[10px] p-1 w-fit" style={{ background: 'var(--rp-surface-3)' }}>
        {(['venues', 'bookings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-[8px] px-4 py-1.5 text-[13px] font-medium capitalize transition-colors"
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
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: '#9bbdb7' }} /></div>
        ) : venues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
              <Building2 className="h-7 w-7 text-[#c5bdb4] dark:text-[#6e8580]" />
            </div>
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Ekhono kono venue add kora hoyni.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {venues.map((v) => (
              <div key={v.id} className="rounded-[14px] border bg-white p-5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[15px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">{v.name}</p>
                    <p className="flex items-center gap-1.5 mt-0.5 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                      <Users className="h-3 w-3" /> {v.capacity} pax · {v.type}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditVenue(v)} className="rounded-[7px] p-1.5 hover:bg-[#f4f1eb]" style={{ color: 'var(--rp-text-subtle)' }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (confirm(`Remove ${v.name}?`)) removeMutation.mutate(v.id); }} className="rounded-[7px] p-1.5 hover:bg-[#fbeceb]" style={{ color: '#c43c3c' }}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[12px] text-[#4a6e66] dark:text-[#6d9990]">
                  {v.halfDayRate && <span>Half-day: ৳{v.halfDayRate.toLocaleString()}</span>}
                  {v.fullDayRate && <span>Full-day: ৳{v.fullDayRate.toLocaleString()}</span>}
                  {v.hourlyRate && <span>Hourly: ৳{v.hourlyRate.toLocaleString()}</span>}
                </div>
                <p className="flex items-center gap-1.5 mb-3 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                  <Clock className="h-3 w-3" /> {v.opensAt}–{v.closesAt} · {v.bookings.length} upcoming booking{v.bookings.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setBookingVenue(v)}
                  className="flex w-full items-center justify-center gap-2 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold hover:opacity-90"
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
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: '#9bbdb7' }} /></div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[14px] border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Ekhono kono booking nai.</p>
          </div>
        ) : (
          <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
                  <MapPin className="h-4 w-4" style={{ color: '#23766a' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{b.clientName} — {b.venue.name}</p>
                  <p className="text-[12px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                    {new Date(b.date).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · {b.startTime}–{b.endTime} · {b.guestCount} guests · {b.eventType}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">৳{b.totalAmount.toLocaleString()}</p>
                  <p className="text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">৳{b.paidAmount.toLocaleString()} paid</p>
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
    </div>
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

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        name, type, capacity: Number(capacity),
        halfDayRate: halfDayRate ? Number(halfDayRate) : undefined,
        fullDayRate: fullDayRate ? Number(fullDayRate) : undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        opensAt, closesAt,
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
          <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || !capacity || mutation.isPending}
            className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
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
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Banquet Hall"
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Capacity (pax)</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="200"
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}>
            {VENUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Half-day rate (৳)</label>
            <input type="number" min={0} value={halfDayRate} onChange={(e) => setHalfDayRate(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Full-day rate (৳)</label>
            <input type="number" min={0} value={fullDayRate} onChange={(e) => setFullDayRate(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Hourly rate (৳)</label>
            <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Opens at</label>
            <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Closes at</label>
            <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
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
            <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!clientName || !clientPhone || !date || !guestCount || !baseAmount || mutation.isPending}
              className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
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
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Client Name</label>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Phone</label>
            <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Event Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Guests</label>
            <input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder={`max ${venue.capacity}`}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Base Amount (৳)</label>
            <input type="number" min={0} value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
            {(venue.halfDayRate || venue.fullDayRate) && (
              <p className="mt-1 text-[11px] text-[#8aa29a] dark:text-[#94b8b0]">
                {venue.halfDayRate && <span>Half-day: ৳{venue.halfDayRate.toLocaleString()} </span>}
                {venue.fullDayRate && <span>· Full-day: ৳{venue.fullDayRate.toLocaleString()}</span>}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Add-ons Amount (৳)</label>
            <input type="number" min={0} value={addonsAmount} onChange={(e) => setAddonsAmount(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#4a6e66] dark:text-[#94b8b0]">Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Catering + projector needed by 9am"
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
        </div>
      </div>
    </ModalShell>
  );
}

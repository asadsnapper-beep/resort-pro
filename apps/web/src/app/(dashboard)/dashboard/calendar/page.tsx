'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { bookingsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, Loader2, BedDouble,
  CalendarDays, RefreshCw, Plus, X,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import { formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GanttBooking {
  id: string;
  confirmationNumber: string;
  guestName: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: string;
  totalAmount: number;
  adults: number;
  children: number;
}

interface GanttRoom {
  id: string;
  number: string;
  name: string;
  type: string;
  status: string;
  floor: number | null;
  basePrice: number;
  maxOccupancy: number;
  bookings: GanttBooking[];
}

interface GanttData {
  rooms: GanttRoom[];
  dates: string[];
  from: string;
  to: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; bar: string; label: string }> = {
  CONFIRMED:   { bg: 'var(--rp-teal-bg)', text: '#183153', border: 'rgba(24,49,83,0.2)',  bar: '#183153', label: 'Confirmed' },
  CHECKED_IN:  { bg: '#183153', text: '#f8fafc', border: 'rgba(24,49,83,0.5)',   bar: '#183153', label: 'Checked In' },
  CHECKED_OUT: { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)', border: 'var(--rp-border-md)',     bar: '#aac0d0', label: 'Checked Out' },
  PENDING:     { bg: 'var(--rp-amber-bg)', text: '#b89040', border: 'rgba(184,144,64,0.2)', bar: '#d4a853', label: 'Pending' },
  CONFLICT:    { bg: 'var(--rp-red-bg)', text: '#c43c3c', border: 'rgba(200,60,60,0.2)',  bar: '#c43c3c', label: '⚠ Conflict' },
};

const ROOM_TYPE_SHORT: Record<string, string> = {
  STANDARD: 'STD', DELUXE: 'DLX', SUITE: 'STE',
  VILLA: 'VIL', COTTAGE: 'COT', BUNGALOW: 'BGL',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHeaderDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return { day: DAY_LABELS[d.getDay()], date: d.getDate(), month: MONTH_LABELS[d.getMonth()] };
}

function formatMonthTitle(from: string, to: string) {
  const s = new Date(from + 'T00:00:00');
  const e = new Date(to + 'T00:00:00');
  if (s.getMonth() === e.getMonth()) return `${MONTH_LABELS[s.getMonth()]} ${s.getFullYear()}`;
  return `${MONTH_LABELS[s.getMonth()]} – ${MONTH_LABELS[e.getMonth()]} ${e.getFullYear()}`;
}

// ── Gantt Row ─────────────────────────────────────────────────────────────────

function GanttRow({
  room, dates, todayStr, onCellClick, onBookingClick,
}: {
  room: GanttRoom;
  dates: string[];
  todayStr: string;
  onCellClick: (roomId: string, date: string) => void;
  onBookingClick: (booking: GanttBooking) => void;
}) {
  const totalDays = dates.length;
  const isMaintenance = room.status === 'MAINTENANCE';

  return (
    <div className="flex border-b group" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
      {/* Room info column */}
      <div className="w-44 shrink-0 flex items-center gap-2 px-3 py-2 border-r"
        style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] text-[10px] font-bold"
          style={isMaintenance
            ? { background: 'var(--rp-coral-bg)', color: '#b8724a' }
            : { background: 'var(--rp-teal-bg)', color: '#183153' }}>
          {isMaintenance ? '🔧' : (ROOM_TYPE_SHORT[room.type] ?? room.type.slice(0, 3))}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold truncate text-[#183153] dark:text-[#f8fafc]">Room {room.number}</p>
          <p className="text-[10px] truncate text-[#64748b] dark:text-[#a9c1d0]">{room.name || room.type}</p>
        </div>
      </div>

      {/* Timeline area */}
      <div className="flex-1 relative" style={{ minHeight: 52 }}>
        {/* Day cells */}
        <div className="absolute inset-0 flex">
          {dates.map(date => (
            <div
              key={date}
              onClick={() => !isMaintenance && onCellClick(room.id, date)}
              className="flex-1 border-r last:border-r-0 transition-colors"
              style={{
                borderColor: 'rgba(0,0,0,0.04)',
                background: isMaintenance
                  ? 'rgba(184,114,74,0.04)'
                  : date === todayStr
                  ? 'var(--rp-amber-bg)'
                  : undefined,
                cursor: isMaintenance ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!isMaintenance) (e.currentTarget as HTMLElement).style.background = 'var(--rp-teal-bg)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = isMaintenance
                  ? 'rgba(184,114,74,0.04)'
                  : date === todayStr ? 'var(--rp-amber-bg)' : '';
              }}
            />
          ))}
        </div>

        {/* Booking bars */}
        {room.bookings.map(booking => {
          const startIdx = dates.indexOf(booking.checkIn);
          const endIdx = dates.indexOf(booking.checkOut);

          const clampedStart = Math.max(0, startIdx === -1
            ? (new Date(booking.checkIn + 'T00:00:00') < new Date(dates[0] + 'T00:00:00') ? 0 : totalDays)
            : startIdx);
          const clampedEnd = endIdx === -1
            ? (new Date(booking.checkOut + 'T00:00:00') > new Date(dates[totalDays - 1] + 'T00:00:00') ? totalDays : 0)
            : endIdx;

          const spanCols = clampedEnd - clampedStart;
          if (spanCols <= 0) return null;

          const leftPct = (clampedStart / totalDays) * 100;
          const widthPct = (spanCols / totalDays) * 100;
          const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.PENDING;

          return (
            <div key={booking.id} className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, padding: '0 2px' }}>
              <div
                onClick={e => { e.stopPropagation(); onBookingClick(booking); }}
                className="relative flex h-[30px] cursor-pointer items-center rounded-[7px] border px-2 transition-all hover:opacity-90 hover:shadow-md"
                style={{ background: cfg.bar, borderColor: cfg.border, color: 'var(--rp-surface)' }}
              >
                <p className="text-[11px] font-medium truncate">{booking.guestName}</p>
                {booking.nights > 1 && (
                  <p className="text-[10px] opacity-70 ml-1 shrink-0">·{booking.nights}n</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Maintenance overlay */}
        {isMaintenance && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-[7px] border px-2 py-0.5 text-[11px] font-medium"
              style={{ background: 'var(--rp-coral-bg)', borderColor: 'rgba(184,114,74,0.2)', color: '#b8724a' }}>
              🔧 Maintenance
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[3px]" style={{ background: cfg.bar }} />
          <span className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">{cfg.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="h-[10px] w-[10px] rounded-[3px] border" style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.3)' }} />
        <span className="text-[11.5px] text-[#64748b] dark:text-[#a9c1d0]">Today</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const WINDOW = 30;

export default function BookingCalendarPage() {
  const router = useRouter();
  const todayStr = today();

  const getDefaultFrom = () => {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return monday.toISOString().slice(0, 10);
  };

  const [fromDate, setFromDate] = useState(getDefaultFrom);
  const toDate = addDays(fromDate, WINDOW - 1);

  const [data, setData] = useState<GanttData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState<GanttBooking | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (from: string) => {
    setLoading(true);
    try {
      const to = addDays(from, WINDOW - 1);
      const res = await bookingsApi.gantt(from, to);
      setData(res.data.data);
    } catch {
      toast({ title: 'Failed to load calendar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(fromDate); }, [fromDate, load]);

  const navigate = (dir: 'prev' | 'next' | 'today') => {
    if (dir === 'today') { setFromDate(getDefaultFrom()); return; }
    setFromDate(prev => addDays(prev, dir === 'next' ? 7 : -7));
  };

  const handleCellClick = (roomId: string, date: string) => {
    router.push(`/dashboard/bookings?roomId=${roomId}&checkIn=${date}`);
  };

  const handleBookingClick = (booking: GanttBooking) => {
    setActiveBooking(prev => prev?.id === booking.id ? null : booking);
  };

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const todayIdx = data.dates.indexOf(todayStr);
    if (todayIdx > 0) {
      const pct = todayIdx / data.dates.length;
      const container = containerRef.current;
      container.scrollLeft = pct * container.scrollWidth - 200;
    }
  }, [data, todayStr]);

  useEffect(() => {
    const handler = () => setActiveBooking(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#183153' }} />
      </div>
    );
  }

  const rooms = data?.rooms ?? [];
  const dates = data?.dates ?? [];
  const totalBookings = rooms.reduce((sum, r) => sum + r.bookings.length, 0);
  const occupiedToday = rooms.filter(r =>
    r.bookings.some(b => b.checkIn <= todayStr && b.checkOut > todayStr)
  ).length;

  return (
    <PageShell gap={4}>
      {/* Header */}
      <PageHeader
        title="Booking Calendar"
        subtitle={`${rooms.length} rooms · ${totalBookings} bookings · ${occupiedToday} occupied today`}
        align="start"
        actions={
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('today')}
            className="rounded-[9px] border px-3 py-2 text-[13px] transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Today
          </button>
          <button onClick={() => load(fromDate)} title="Refresh"
            className="rounded-[9px] border p-2 transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => router.push('/dashboard/bookings?new=1')}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            <Plus className="w-4 h-4" />
            New Booking
          </button>
        </div>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rooms',      value: rooms.length,                                      bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153' },
          { label: 'Occupied Today',   value: occupiedToday,                                     bg: '#183153', border: 'rgba(24,49,83,0.5)',    text: '#f8fafc' },
          { label: 'Maintenance',      value: rooms.filter(r => r.status === 'MAINTENANCE').length, bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)', text: '#b8724a' },
          { label: 'Bookings in View', value: totalBookings,                                     bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
        ].map(({ label, value, bg, border, text }) => (
          <div key={label} className="rounded-[14px] border p-4"
            style={{ background: bg, borderColor: border }}>
            <p className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: text }}>{value}</p>
            <p className="text-[12px] mt-0.5 font-medium opacity-80" style={{ color: text }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Calendar card */}
      <div className="rounded-[14px] border bg-white dark:bg-white/5 overflow-hidden"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>

        {/* Navigation bar */}
        <div className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--rp-border)' }}>
          <button onClick={() => navigate('prev')}
            className="rounded-[8px] p-1.5 transition-colors hover:bg-[#f4f1eb] text-[#64748b] dark:text-[#a9c1d0]">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-[13.5px] font-semibold text-[#183153] dark:text-[#f8fafc]">
              {formatMonthTitle(fromDate, toDate)}
            </p>
            <p className="text-[11px] text-[#64748b] dark:text-[#a9c1d0]">{fromDate} → {toDate}</p>
          </div>
          <button onClick={() => navigate('next')}
            className="rounded-[8px] p-1.5 transition-colors hover:bg-[#f4f1eb] text-[#64748b] dark:text-[#a9c1d0]">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Gantt grid */}
        <div className="overflow-x-auto" ref={containerRef}>
          <div style={{ minWidth: Math.max(900, 176 + dates.length * 42) }}>

            {/* Date header row */}
            <div className="sticky top-0 z-10 flex border-b"
              style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
              <div className="w-44 shrink-0 border-r px-3 py-2.5"
                style={{ borderColor: 'var(--rp-border)' }}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#a9c1d0]">Room</p>
              </div>
              <div className="flex-1 flex">
                {dates.map(date => {
                  const { day, date: d, month } = formatHeaderDate(date);
                  const isToday = date === todayStr;
                  const isWeekend = new Date(date + 'T00:00:00').getDay() % 6 === 0;
                  return (
                    <div key={date}
                      className="flex-1 flex flex-col items-center justify-center border-r py-1.5 last:border-r-0 text-center"
                      style={{
                        borderColor: 'rgba(0,0,0,0.04)',
                        background: isToday ? 'var(--rp-amber-bg)' : undefined,
                      }}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em]"
                        style={{ color: isToday ? '#b89040' : isWeekend ? '#183153' : 'var(--rp-text-muted)' }}>
                        {day}
                      </p>
                      <p className="text-[12px] font-bold"
                        style={{ color: isToday ? '#b89040' : isWeekend ? '#183153' : 'var(--rp-text)' }}>
                        {d}
                      </p>
                      {(d === 1 || date === dates[0]) && (
                        <p className="text-[9px] text-[#94a3b8] dark:text-[#7f99ab]">{month}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Room rows */}
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <BedDouble className="w-10 h-10 text-[#94a3b8] dark:text-[#7f99ab]" />
                <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">No rooms found. Add rooms first.</p>
              </div>
            ) : (
              rooms.map(room => (
                <GanttRow
                  key={room.id}
                  room={room}
                  dates={dates}
                  todayStr={todayStr}
                  onCellClick={handleCellClick}
                  onBookingClick={handleBookingClick}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer legend */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
          <Legend />
        </div>
      </div>

      {/* Active booking detail panel */}
      {activeBooking && createPortal((
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(24,49,83,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActiveBooking(null)}>
          <div className="absolute right-4 top-20 w-[300px] rounded-[18px] border bg-white dark:bg-white/5 p-5 shadow-2xl"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 20px 60px rgba(24,49,83,0.25)' }}
            onClick={e => e.stopPropagation()}>

            {/* Status + close */}
            <div className="flex items-center justify-between mb-4">
              <span className="rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                style={{
                  background: STATUS_CONFIG[activeBooking.status]?.bg ?? 'var(--rp-surface-3)',
                  borderColor: STATUS_CONFIG[activeBooking.status]?.border ?? 'var(--rp-border-md)',
                  color: STATUS_CONFIG[activeBooking.status]?.text ?? 'var(--rp-text-muted)',
                }}>
                {STATUS_CONFIG[activeBooking.status]?.label ?? activeBooking.status}
              </span>
              <button onClick={() => setActiveBooking(null)}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-[#f4f1eb] text-[#64748b] dark:text-[#a9c1d0]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="font-display text-[18px] font-medium text-[#183153] dark:text-[#f8fafc]">
              {activeBooking.guestName}
            </h3>
            <p className="text-[12px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">
              #{activeBooking.confirmationNumber}
            </p>

            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Check-in',  value: activeBooking.checkIn },
                { label: 'Check-out', value: activeBooking.checkOut },
                { label: 'Nights',    value: String(activeBooking.nights) },
                { label: 'Guests',    value: `${activeBooking.adults} adult${activeBooking.adults !== 1 ? 's' : ''}${activeBooking.children > 0 ? ` + ${activeBooking.children} child` : ''}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-[13px]">
                  <span style={{ color: 'var(--rp-text-muted)' }}>{label}</span>
                  <span className="font-medium text-[#183153] dark:text-[#f8fafc]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2.5 text-[13px]"
                style={{ borderColor: 'var(--rp-border)' }}>
                <span style={{ color: 'var(--rp-text-muted)' }}>Total</span>
                <span className="font-semibold text-[15px] text-[#183153] dark:text-[#f8fafc]">
                  {formatCurrency(activeBooking.totalAmount)}
                </span>
              </div>
            </div>

            <button
              onClick={() => { setActiveBooking(null); router.push(`/dashboard/bookings/${activeBooking.id}`); }}
              className="mt-4 w-full rounded-[10px] py-2.5 text-[13px] font-medium transition-colors"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              Open Booking Details →
            </button>
          </div>
        </div>
      ), document.body)}
    </PageShell>
  );
}

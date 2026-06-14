'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { bookingsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, Loader2, BedDouble,
  CalendarDays, RefreshCw, Plus,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GanttBooking {
  id: string;
  confirmationNumber: string;
  guestName: string;
  guestId: string;
  checkIn: string;   // 'YYYY-MM-DD'
  checkOut: string;  // 'YYYY-MM-DD'
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
  dates: string[];   // 'YYYY-MM-DD' array
  from: string;
  to: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CONFIRMED:   { bg: 'bg-indigo-500',   text: 'text-white', border: 'border-indigo-600',   label: 'Confirmed' },
  CHECKED_IN:  { bg: 'bg-emerald-500',  text: 'text-white', border: 'border-emerald-600',  label: 'Checked In' },
  CHECKED_OUT: { bg: 'bg-gray-400',     text: 'text-white', border: 'border-gray-500',     label: 'Checked Out' },
  PENDING:     { bg: 'bg-amber-400',    text: 'text-white', border: 'border-amber-500',    label: 'Pending' },
  CONFLICT:    { bg: 'bg-red-500',      text: 'text-white', border: 'border-red-600',      label: '⚠ Conflict' },
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
  if (s.getMonth() === e.getMonth()) {
    return `${MONTH_LABELS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${MONTH_LABELS[s.getMonth()]} – ${MONTH_LABELS[e.getMonth()]} ${e.getFullYear()}`;
}

// ── Booking Tooltip ───────────────────────────────────────────────────────────

function BookingTooltip({ booking, onClose, onOpen }: {
  booking: GanttBooking;
  onClose: () => void;
  onOpen: () => void;
}) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.PENDING;
  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-3 text-left"
         onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.bg, cfg.text)}>{cfg.label}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{booking.guestName}</p>
      <p className="text-xs text-gray-500 mt-0.5">#{booking.confirmationNumber}</p>
      <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
        <p>📅 {booking.checkIn} → {booking.checkOut}</p>
        <p>🌙 {booking.nights} night{booking.nights !== 1 ? 's' : ''}</p>
        <p>👥 {booking.adults} adult{booking.adults !== 1 ? 's' : ''}{booking.children > 0 ? ` + ${booking.children} child` : ''}</p>
        <p>💰 {formatCurrency(booking.totalAmount)}</p>
      </div>
      <button
        onClick={onOpen}
        className="mt-3 w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg transition-colors"
      >
        Open Booking →
      </button>
    </div>
  );
}

// ── Gantt Row ─────────────────────────────────────────────────────────────────

function GanttRow({
  room,
  dates,
  todayStr,
  onCellClick,
  onBookingClick,
}: {
  room: GanttRoom;
  dates: string[];
  todayStr: string;
  onCellClick: (roomId: string, date: string) => void;
  onBookingClick: (booking: GanttBooking) => void;
}) {
  const router = useRouter();
  const totalDays = dates.length;
  const isMaintenance = room.status === 'MAINTENANCE';

  return (
    <div className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 group">
      {/* Room info column */}
      <div className="w-44 shrink-0 flex items-center gap-2 px-3 py-2 border-r border-gray-100 dark:border-gray-800">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
          isMaintenance
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            : 'bg-resort-50 text-resort-700 dark:bg-resort-900/20 dark:text-resort-400'
        )}>
          {isMaintenance ? '🔧' : ROOM_TYPE_SHORT[room.type] ?? room.type.slice(0, 3)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
            Room {room.number}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{room.name || room.type}</p>
        </div>
      </div>

      {/* Timeline area */}
      <div className="flex-1 relative" style={{ minHeight: 52 }}>
        {/* Day cells (for click + today highlight) */}
        <div className="absolute inset-0 flex">
          {dates.map(date => (
            <div
              key={date}
              onClick={() => !isMaintenance && onCellClick(room.id, date)}
              className={cn(
                'flex-1 border-r border-gray-100 dark:border-gray-800 last:border-r-0',
                date === todayStr && 'bg-amber-50 dark:bg-amber-900/10',
                !isMaintenance && 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/10',
                isMaintenance && 'bg-orange-50/50 dark:bg-orange-900/5 cursor-not-allowed',
              )}
            />
          ))}
        </div>

        {/* Booking blocks */}
        {room.bookings.map(booking => {
          const startIdx = dates.indexOf(booking.checkIn);
          const endIdx = dates.indexOf(booking.checkOut); // checkout day = empty (guest leaves)

          // Clamp to visible range
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
            <div
              key={booking.id}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, padding: '0 2px' }}
            >
              <div
                onClick={e => { e.stopPropagation(); onBookingClick(booking); }}
                className={cn(
                  'relative h-8 rounded-md px-2 flex items-center cursor-pointer transition-all hover:opacity-90 hover:shadow-md border',
                  cfg.bg, cfg.text, cfg.border,
                )}
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-orange-500 font-medium bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded">
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
    <div className="flex items-center gap-4 text-xs text-gray-500">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={cn('w-3 h-3 rounded-sm', cfg.bg)} />
          {cfg.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" />
        Today
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-orange-100" />
        Maintenance
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-red-500" />
        Conflict
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const WINDOW = 30; // days shown at once

export default function BookingCalendarPage() {
  const router = useRouter();
  const todayStr = today();

  // Start from Monday of current week
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

  // Scroll to today column on load
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const todayIdx = data.dates.indexOf(todayStr);
    if (todayIdx > 0) {
      const pct = todayIdx / data.dates.length;
      const container = containerRef.current;
      container.scrollLeft = pct * container.scrollWidth - 200;
    }
  }, [data, todayStr]);

  // Click outside to close active booking tooltip
  useEffect(() => {
    const handler = () => setActiveBooking(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-resort-600" />
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-resort-600" />
            Booking Calendar
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {rooms.length} rooms · {totalBookings} bookings · {occupiedToday} occupied today
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('today')}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => load(fromDate)}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push('/dashboard/bookings?new=1')}
            className="flex items-center gap-2 px-4 py-2 bg-resort-700 hover:bg-resort-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Booking
          </button>
        </div>
      </div>

      {/* Calendar card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => navigate('prev')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatMonthTitle(fromDate, toDate)}
            </p>
            <p className="text-xs text-gray-400">{fromDate} → {toDate}</p>
          </div>

          <button
            onClick={() => navigate('next')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Gantt grid */}
        <div className="overflow-x-auto" ref={containerRef}>
          <div style={{ minWidth: Math.max(900, 176 + dates.length * 42) }}>
            {/* Date header row */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
              <div className="w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 py-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Room</p>
              </div>
              <div className="flex-1 flex">
                {dates.map(date => {
                  const { day, date: d, month } = formatHeaderDate(date);
                  const isToday = date === todayStr;
                  const isWeekend = new Date(date + 'T00:00:00').getDay() % 6 === 0;
                  return (
                    <div
                      key={date}
                      className={cn(
                        'flex-1 flex flex-col items-center justify-center py-1.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0 text-center',
                        isToday && 'bg-amber-50 dark:bg-amber-900/20',
                      )}
                    >
                      <p className={cn(
                        'text-[10px] font-medium uppercase tracking-wide',
                        isToday ? 'text-amber-600' : isWeekend ? 'text-indigo-400' : 'text-gray-400',
                      )}>
                        {day}
                      </p>
                      <p className={cn(
                        'text-xs font-bold',
                        isToday ? 'text-amber-600' : isWeekend ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300',
                      )}>
                        {d}
                      </p>
                      {/* Show month label on 1st or first visible */}
                      {(d === 1 || date === dates[0]) && (
                        <p className="text-[9px] text-gray-400">{month}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Room rows */}
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <BedDouble className="w-10 h-10 text-gray-300" />
                <p className="text-gray-400 text-sm">No rooms found. Add rooms first.</p>
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
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <Legend />
        </div>
      </div>

      {/* Active booking detail panel */}
      {activeBooking && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setActiveBooking(null)}
        >
          <div
            className="absolute right-4 top-20 w-80 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Status badge */}
            <div className="flex items-center justify-between mb-4">
              <span className={cn(
                'text-xs px-2.5 py-1 rounded-full font-semibold',
                STATUS_CONFIG[activeBooking.status]?.bg,
                STATUS_CONFIG[activeBooking.status]?.text,
              )}>
                {STATUS_CONFIG[activeBooking.status]?.label ?? activeBooking.status}
              </span>
              <button
                onClick={() => setActiveBooking(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >✕</button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{activeBooking.guestName}</h3>
            <p className="text-sm text-gray-500 mt-0.5">#{activeBooking.confirmationNumber}</p>

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Check-in</span>
                <span className="font-medium text-gray-900 dark:text-white">{activeBooking.checkIn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-out</span>
                <span className="font-medium text-gray-900 dark:text-white">{activeBooking.checkOut}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nights</span>
                <span className="font-medium text-gray-900 dark:text-white">{activeBooking.nights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guests</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {activeBooking.adults} adult{activeBooking.adults !== 1 ? 's' : ''}
                  {activeBooking.children > 0 ? ` + ${activeBooking.children} child` : ''}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2.5">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(activeBooking.totalAmount)}</span>
              </div>
            </div>

            <button
              onClick={() => { setActiveBooking(null); router.push(`/dashboard/bookings/${activeBooking.id}`); }}
              className="mt-4 w-full bg-resort-700 hover:bg-resort-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Open Booking Details →
            </button>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rooms', value: rooms.length, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Occupied Today', value: occupiedToday, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Maintenance', value: rooms.filter(r => r.status === 'MAINTENANCE').length, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Bookings in View', value: totalBookings, color: 'text-resort-700', bg: 'bg-resort-50 dark:bg-resort-900/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-2xl p-4 border border-gray-100 dark:border-gray-800', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

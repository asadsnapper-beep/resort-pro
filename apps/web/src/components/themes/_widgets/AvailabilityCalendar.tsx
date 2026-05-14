'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, BedDouble } from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface DayData {
  available: number;
  total: number;
  status: 'available' | 'partial' | 'full';
}

interface CalendarData {
  month: string;
  totalRooms: number;
  days: Record<string, DayData>;
}

interface Room {
  id: string;
  name: string;
  type: string;
  number: string;
  basePrice: number;
  maxOccupancy: number;
  images: string[];
  amenities: string[];
  description?: string;
}

export interface AvailabilityCalendarProps {
  slug: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  onRoomSelect?: (room: Room, checkIn: Date, checkOut: Date) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount);
}

function toYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ── AvailabilityCalendar ────────────────────────────────────────────────────── */
export function AvailabilityCalendar({
  slug, primaryColor, accentColor, currency, onRoomSelect,
}: AvailabilityCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [calLoading, setCalLoading] = useState(false);

  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [selectingCheckOut, setSelectingCheckOut] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState('');

  /* ── Fetch calendar data ──────────────────────────────────────────────────── */
  const fetchCalendar = useCallback(async (monthDate: Date) => {
    setCalLoading(true);
    try {
      const mk = monthKey(monthDate);
      const res = await fetch(`${API_BASE}/site/${slug}/availability/calendar?month=${mk}`);
      const json = await res.json();
      if (json.success) setCalendarData(json.data);
    } catch {
      // silently ignore — calendar just shows no data
    } finally {
      setCalLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchCalendar(currentMonth); }, [currentMonth, fetchCalendar]);

  /* ── Fetch available rooms when both dates are set ────────────────────────── */
  useEffect(() => {
    if (!checkIn || !checkOut) { setAvailableRooms([]); return; }
    const controller = new AbortController();
    setRoomsLoading(true);
    setRoomsError('');

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/site/${slug}/availability?checkIn=${toYMD(checkIn)}&checkOut=${toYMD(checkOut)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        setAvailableRooms(json.data || []);
      } catch (e: any) {
        if (e.name !== 'AbortError') setRoomsError('Could not load rooms. Please try again.');
      } finally {
        setRoomsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [checkIn, checkOut, slug]);

  /* ── Navigation ───────────────────────────────────────────────────────────── */
  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const canGoPrev = currentMonth > new Date(today.getFullYear(), today.getMonth(), 1);

  /* ── Day click ────────────────────────────────────────────────────────────── */
  const handleDayClick = (date: Date, status: string | undefined) => {
    if (date < today) return; // past day — disabled
    if (status === 'full') return; // fully booked

    if (!selectingCheckOut) {
      // First click → set check-in, start selecting check-out
      setCheckIn(date);
      setCheckOut(null);
      setAvailableRooms([]);
      setSelectingCheckOut(true);
    } else {
      // Second click → set check-out (must be after check-in)
      if (checkIn && date <= checkIn) {
        // clicked same or earlier date — restart selection
        setCheckIn(date);
        setCheckOut(null);
        setAvailableRooms([]);
        return;
      }
      setCheckOut(date);
      setSelectingCheckOut(false);
    }
  };

  const resetSelection = () => {
    setCheckIn(null);
    setCheckOut(null);
    setSelectingCheckOut(false);
    setAvailableRooms([]);
    setRoomsError('');
  };

  /* ── Determine effective check-out preview (hover) ────────────────────────── */
  const previewEnd = selectingCheckOut && hoveredDate && checkIn && hoveredDate > checkIn
    ? hoveredDate
    : checkOut;

  /* ── Day helpers ──────────────────────────────────────────────────────────── */
  const getDayStatus = (date: Date): DayData | null => {
    const key = toYMD(date);
    return calendarData?.days[key] ?? null;
  };

  const isInRange = (date: Date) => {
    if (!checkIn || !previewEnd) return false;
    return date > checkIn && date < previewEnd;
  };

  const isCheckIn = (date: Date) => checkIn ? toYMD(date) === toYMD(checkIn) : false;
  const isCheckOut = (date: Date) => previewEnd ? toYMD(date) === toYMD(previewEnd) : false;

  /* ── Render ───────────────────────────────────────────────────────────────── */
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* ── Calendar Card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">

        {/* Month Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {MONTH_NAMES[month]} {year}
            </h3>
            {calLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>

          <button
            onClick={nextMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-gray-50">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-3 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 p-3 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const date = new Date(year, month, dayNum);
            const dayData = getDayStatus(date);
            const isPast = date < today;
            const isFull = dayData?.status === 'full';
            const isPartial = dayData?.status === 'partial';
            const isAvailable = dayData?.status === 'available' || (!dayData && !isPast);

            const selected = isCheckIn(date) || isCheckOut(date);
            const inRange = isInRange(date);
            const isStart = isCheckIn(date);
            const isEnd = isCheckOut(date);

            let dayBg = '';
            let dayTextColor = 'text-gray-700';
            let cursor = 'cursor-pointer hover:bg-gray-50';
            let dotColor = '';
            let title = '';

            if (isPast) {
              dayTextColor = 'text-gray-300';
              cursor = 'cursor-not-allowed';
            } else if (selected) {
              dayBg = '';
              dayTextColor = 'text-white font-semibold';
              cursor = 'cursor-pointer';
            } else if (inRange) {
              dayBg = 'bg-opacity-10';
            } else if (isFull) {
              dayTextColor = 'text-gray-400';
              cursor = 'cursor-not-allowed';
              dotColor = '#ef4444';
              title = `${dayData?.available ?? 0}/${dayData?.total ?? 0} rooms available`;
            } else if (isPartial) {
              dotColor = '#f59e0b';
              title = `${dayData?.available ?? 0}/${dayData?.total ?? 0} rooms available`;
            } else if (isAvailable) {
              dotColor = primaryColor;
              title = `${dayData?.available ?? dayData?.total ?? ''}/${dayData?.total ?? ''} rooms available`;
            }

            return (
              <button
                key={dayNum}
                title={title}
                disabled={isPast || isFull}
                onClick={() => handleDayClick(date, dayData?.status)}
                onMouseEnter={() => setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
                className={`
                  relative flex flex-col items-center justify-center h-10 w-full rounded-xl text-sm transition-all duration-150
                  ${cursor} ${dayTextColor}
                  ${inRange ? 'rounded-none' : ''}
                `}
                style={{
                  backgroundColor: selected
                    ? (isStart ? primaryColor : isEnd ? accentColor : primaryColor)
                    : inRange
                    ? `${primaryColor}15`
                    : undefined,
                }}
              >
                <span className={`leading-none ${selected ? 'z-10' : ''}`}>{dayNum}</span>
                {dotColor && !selected && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 px-4 py-3 border-t border-gray-50 bg-gray-50/50">
          {[
            { color: primaryColor, label: 'Available' },
            { color: '#f59e0b', label: 'Partial' },
            { color: '#ef4444', label: 'Full' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Selected dates summary ──────────────────────────────────────────── */}
      {checkIn && (
        <div className="mt-4 flex items-center justify-between bg-white rounded-2xl px-5 py-3.5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Check-in</p>
              <p className="font-semibold text-gray-800">
                {checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="text-gray-300">→</div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Check-out</p>
              <p className="font-semibold text-gray-800">
                {checkOut
                  ? checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : <span className="text-gray-400 font-normal italic">Select date…</span>}
              </p>
            </div>
            {checkIn && checkOut && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Nights</p>
                <p className="font-semibold text-gray-800">
                  {Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={resetSelection}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Available Rooms List ────────────────────────────────────────────── */}
      {checkIn && checkOut && (
        <div className="mt-4">
          {roomsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Checking availability…</span>
            </div>
          ) : roomsError ? (
            <p className="text-center text-sm text-red-500 py-6">{roomsError}</p>
          ) : availableRooms.length === 0 ? (
            <div className="text-center py-8">
              <BedDouble className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">No rooms available</p>
              <p className="text-sm text-gray-400 mt-1">Try different dates</p>
              <button
                onClick={resetSelection}
                className="mt-4 text-sm font-medium underline transition-colors"
                style={{ color: primaryColor }}
              >
                Choose other dates
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-600 mb-3 px-1">
                {availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available
              </p>
              <div className="space-y-3">
                {availableRooms.map(room => {
                  const nights = Math.round((checkOut.getTime() - checkIn!.getTime()) / 86400000);
                  const total = room.basePrice * nights;
                  return (
                    <div
                      key={room.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
                    >
                      {/* Room image thumbnail */}
                      {room.images[0] ? (
                        <img
                          src={room.images[0]}
                          alt={room.name}
                          className="h-16 w-24 object-cover rounded-xl flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="h-16 w-24 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <BedDouble className="h-7 w-7" style={{ color: primaryColor }} />
                        </div>
                      )}

                      {/* Room info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{room.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Up to {room.maxOccupancy} guests · Room {room.number}
                        </p>
                        <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>
                          {fmt(room.basePrice, currency)}/night
                          <span className="text-gray-400 font-normal ml-2">
                            · {fmt(total, currency)} total
                          </span>
                        </p>
                      </div>

                      {/* Book button */}
                      <button
                        onClick={() => onRoomSelect?.(room, checkIn!, checkOut)}
                        className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: accentColor }}
                      >
                        Book Now
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Hint when selecting checkout ───────────────────────────────────── */}
      {selectingCheckOut && (
        <p className="text-center text-sm text-gray-400 mt-3 animate-pulse">
          Now select your check-out date
        </p>
      )}
    </div>
  );
}

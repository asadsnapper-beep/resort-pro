'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalCalendarsApi, roomsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Link2, Plus, RefreshCw, Trash2, CheckCircle2, XCircle,
  Clock, ExternalLink, AlertTriangle, ChevronDown, ChevronUp,
  Wifi, WifiOff, Copy, Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  number: string;
  name: string;
}

interface ExternalCalendar {
  id: string;
  roomId: string;
  name: string;
  icalUrl: string;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  importedCount: number;
  room: Room;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

function detectSource(name: string): 'booking' | 'airbnb' | 'agoda' | 'expedia' | 'other' {
  const n = name.toLowerCase();
  if (n.includes('booking')) return 'booking';
  if (n.includes('airbnb')) return 'airbnb';
  if (n.includes('agoda')) return 'agoda';
  if (n.includes('expedia')) return 'expedia';
  return 'other';
}

const SOURCE_COLORS: Record<string, string> = {
  booking: 'bg-blue-100 text-blue-700',
  airbnb: 'bg-rose-100 text-rose-700',
  agoda: 'bg-red-100 text-red-700',
  expedia: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-700',
};

// ─── Add Calendar Modal ───────────────────────────────────────────────────────

interface AddModalProps {
  rooms: Room[];
  preselectedRoom?: Room | null;
  onClose: () => void;
  onSaved: () => void;
}

function AddCalendarModal({ rooms, preselectedRoom, onClose, onSaved }: AddModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [roomId, setRoomId] = useState(preselectedRoom?.id ?? '');
  const [name, setName] = useState('Booking.com');
  const [customName, setCustomName] = useState('');
  const [url, setUrl] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; eventCount: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const presets = ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Google Calendar', 'Other'];

  async function handleTest() {
    if (!url) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await externalCalendarsApi.testUrl(url);
      setTestResult(res.data.data);
    } catch {
      setTestResult({ ok: false, eventCount: 0, error: 'Connection failed' });
    } finally {
      setTesting(false);
    }
  }

  const effectiveName = name === 'Other' ? customName : name;

  async function handleSave() {
    if (!roomId || !effectiveName || !url) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    if (!testResult?.ok) {
      toast({ title: 'Please test the URL first', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await externalCalendarsApi.create({ roomId, name: effectiveName, icalUrl: url });
      await qc.invalidateQueries({ queryKey: ['external-calendars'] });
      toast({ title: `${name} calendar added`, description: `Syncing room ${rooms.find(r => r.id === roomId)?.name}…` });
      onSaved();
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a6b5e]/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#1a6b5e]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Add External Calendar</h2>
              <p className="text-xs text-gray-500">Paste an iCal URL to auto-block rooms</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Room picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]/30"
            >
              <option value="">Select a room…</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.number} — {r.name}</option>
              ))}
            </select>
          </div>

          {/* Source name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setName(p)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    name === p
                      ? 'bg-[#1a6b5e] text-white border-[#1a6b5e]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#1a6b5e]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {name === 'Other' && (
              <input
                type="text"
                value={customName}
                placeholder="Enter name…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]/30"
                onChange={e => setCustomName(e.target.value)}
              />
            )}
          </div>

          {/* iCal URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">iCal URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://admin.booking.com/hotel/ical/..."
                value={url}
                onChange={e => { setUrl(e.target.value); setTestResult(null); }}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]/30"
              />
              <button
                onClick={handleTest}
                disabled={!url || testing}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
              >
                {testing ? 'Testing…' : 'Test'}
              </button>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`mt-2 rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
                testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {testResult.ok
                  ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Valid iCal — {testResult.eventCount} reservation{testResult.eventCount !== 1 ? 's' : ''} found</>
                  : <><XCircle className="w-4 h-4 shrink-0" /> {testResult.error}</>
                }
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              Where to find it: Booking.com Extranet → Calendar → Export → iCal link
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !testResult?.ok}
            className="px-4 py-2 text-sm rounded-lg bg-[#1a6b5e] text-white font-medium hover:bg-[#155a4e] disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save & Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Card ────────────────────────────────────────────────────────────

interface CalendarCardProps {
  cal: ExternalCalendar;
  onSynced: () => void;
}

function CalendarCard({ cal, onSynced }: CalendarCardProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const source = detectSource(cal.name);
  const hasError = !!cal.lastError;
  const isOk = !hasError && cal.lastSyncAt;

  async function handleSync() {
    setSyncing(true);
    try {
      await externalCalendarsApi.sync(cal.id);
      toast({ title: 'Sync complete' });
      onSynced();
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      await qc.invalidateQueries({ queryKey: ['external-calendars'] });
      setSyncing(false);
    }
  }

  async function handleToggle() {
    try {
      await externalCalendarsApi.update(cal.id, { isActive: !cal.isActive });
      await qc.invalidateQueries({ queryKey: ['external-calendars'] });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${cal.name} calendar from ${cal.room.name}?`)) return;
    setDeleting(true);
    try {
      await externalCalendarsApi.delete(cal.id);
      await qc.invalidateQueries({ queryKey: ['external-calendars'] });
      toast({ title: 'Calendar removed' });
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(cal.icalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      !cal.isActive ? 'opacity-50 bg-gray-50' : hasError ? 'border-red-200 bg-red-50/30' : 'bg-white hover:shadow-sm'
    }`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: status + name */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5">
            {!cal.isActive
              ? <WifiOff className="w-5 h-5 text-gray-300" />
              : hasError
              ? <XCircle className="w-5 h-5 text-red-400" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[source]}`}>
                {cal.name}
              </span>
              <span className="text-xs text-gray-400">
                {cal.importedCount} booking{cal.importedCount !== 1 ? 's' : ''} imported
              </span>
            </div>

            {/* URL row */}
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-gray-400 truncate max-w-[260px]">{cal.icalUrl}</span>
              <button onClick={handleCopy} className="text-gray-300 hover:text-gray-500 shrink-0">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Sync status */}
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-gray-300" />
              <span className="text-xs text-gray-400">
                {hasError
                  ? <span className="text-red-500">Error: {cal.lastError}</span>
                  : `Last sync: ${timeAgo(cal.lastSyncAt)}`
                }
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing || !cal.isActive}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40"
            title="Sync now"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title={cal.isActive ? 'Pause sync' : 'Resume sync'}
          >
            {cal.isActive
              ? <Wifi className="w-4 h-4" />
              : <WifiOff className="w-4 h-4" />
            }
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-40"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Room Group ───────────────────────────────────────────────────────────────

interface RoomGroupProps {
  room: Room;
  calendars: ExternalCalendar[];
  onAdd: (room: Room) => void;
  onSynced: () => void;
}

function RoomGroup({ room, calendars, onAdd, onSynced }: RoomGroupProps) {
  const [open, setOpen] = useState(true);
  const hasConflict = calendars.some(c => c.lastError);

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Room header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1a6b5e]/10 flex items-center justify-center">
            <span className="text-xs font-bold text-[#1a6b5e]">{room.number}</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-800">{room.name}</div>
            <div className="text-xs text-gray-400">
              {calendars.length === 0
                ? 'No external calendars'
                : `${calendars.length} calendar${calendars.length > 1 ? 's' : ''} connected`
              }
            </div>
          </div>
          {hasConflict && (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {calendars.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">
              No calendars yet — add one to prevent double bookings
            </p>
          ) : (
            calendars.map(cal => (
              <CalendarCard key={cal.id} cal={cal} onSynced={onSynced} />
            ))
          )}
          <button
            onClick={() => onAdd(room)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#1a6b5e] hover:text-[#1a6b5e] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Calendar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [preselectedRoom, setPreselectedRoom] = useState<Room | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['external-calendars'],
    queryFn: async () => {
      const res = await externalCalendarsApi.list();
      return res.data.data as ExternalCalendar[];
    },
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: async () => {
      const res = await roomsApi.list({ limit: 200, isActive: true });
      // paginated response: { success, data: rooms[], pagination: {...} }
      return (res.data.data ?? []) as Room[];
    },
  });

  const calendars = data ?? [];
  const allRooms: Room[] = roomsData ?? [];

  // Group by room
  const byRoom = calendars.reduce<Record<string, ExternalCalendar[]>>((acc, cal) => {
    if (!acc[cal.roomId]) acc[cal.roomId] = [];
    acc[cal.roomId].push(cal);
    return acc;
  }, {});

  // Rooms that have at least one calendar (for display)
  const rooms: Room[] = Object.values(
    calendars.reduce<Record<string, Room>>((acc, cal) => {
      acc[cal.roomId] = cal.room;
      return acc;
    }, {})
  );

  // Stats
  const totalCalendars = calendars.length;
  const activeCalendars = calendars.filter(c => c.isActive).length;
  const totalImported = calendars.reduce((s, c) => s + c.importedCount, 0);
  const errored = calendars.filter(c => c.lastError).length;

  function handleAddFor(room: Room) {
    setPreselectedRoom(room);
    setShowModal(true);
  }

  function handleAddGeneral() {
    setPreselectedRoom(null);
    setShowModal(true);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-[#1a6b5e]" />
            Channel Sync
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect Booking.com, Airbnb, or any iCal source to prevent double bookings
          </p>
        </div>
        <button
          onClick={handleAddGeneral}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a6b5e] text-white text-sm font-medium hover:bg-[#155a4e] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Calendar
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
        <ExternalLink className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <span className="font-semibold">How it works:</span> Paste the iCal URL from Booking.com/Airbnb — ResortPro syncs every 15 minutes and blocks rooms automatically. No API key needed.
        </div>
      </div>

      {/* Stats strip */}
      {totalCalendars > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Connected', value: totalCalendars, color: 'text-gray-800' },
            { label: 'Active', value: activeCalendars, color: 'text-emerald-600' },
            { label: 'Imported', value: totalImported, color: 'text-[#1a6b5e]' },
            { label: 'Errors', value: errored, color: errored > 0 ? 'text-red-500' : 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border bg-white p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar groups */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading calendars…</div>
      ) : calendars.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Link2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-gray-500 font-medium mb-1">No external calendars yet</h3>
          <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">
            Connect your Booking.com or Airbnb listing — bookings there will automatically block rooms here.
          </p>
          <button
            onClick={handleAddGeneral}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a6b5e] text-white text-sm font-medium hover:bg-[#155a4e]"
          >
            <Plus className="w-4 h-4" />
            Add Your First Calendar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => (
            <RoomGroup
              key={room.id}
              room={room}
              calendars={byRoom[room.id] ?? []}
              onAdd={handleAddFor}
              onSynced={() => qc.invalidateQueries({ queryKey: ['external-calendars'] })}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <AddCalendarModal
          rooms={allRooms}
          preselectedRoom={preselectedRoom}
          onClose={() => { setShowModal(false); setPreselectedRoom(null); }}
          onSaved={() => { setShowModal(false); setPreselectedRoom(null); }}
        />
      )}
    </div>
  );
}

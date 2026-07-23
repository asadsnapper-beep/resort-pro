'use client';

import { ModalShell } from '@/components/ui/modal-shell';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { externalCalendarsApi, roomsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Link2, Plus, RefreshCw, Trash2, CheckCircle2, XCircle,
  Clock, ExternalLink, AlertTriangle, ChevronDown, ChevronUp,
  Wifi, WifiOff, Copy, Check, Loader2,
} from 'lucide-react';

interface Room { id: string; number: string; name: string; }

interface ExternalCalendar {
  id: string; roomId: string; name: string; icalUrl: string;
  isActive: boolean; lastSyncAt: string | null; lastError: string | null;
  importedCount: number; room: Room;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

function detectSource(name: string): 'booking' | 'airbnb' | 'agoda' | 'expedia' | 'other' {
  const n = name.toLowerCase();
  if (n.includes('booking'))  return 'booking';
  if (n.includes('airbnb'))   return 'airbnb';
  if (n.includes('agoda'))    return 'agoda';
  if (n.includes('expedia'))  return 'expedia';
  return 'other';
}

const SOURCE_META: Record<string, { bg: string; border: string; text: string }> = {
  booking:  { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  airbnb:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  agoda:    { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  expedia:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  other:    { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

function AddCalendarModal({ rooms, preselectedRoom, onClose, onSaved }: {
  rooms: Room[]; preselectedRoom?: Room | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [roomId, setRoomId]           = useState(preselectedRoom?.id ?? '');
  const [name, setName]               = useState('Booking.com');
  const [customName, setCustomName]   = useState('');
  const [url, setUrl]                 = useState('');
  const [testResult, setTestResult]   = useState<{ ok: boolean; eventCount: number; error?: string } | null>(null);
  const [testing, setTesting]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const presets = ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Google Calendar', 'Other'];

  async function handleTest() {
    if (!url) return;
    setTesting(true); setTestResult(null);
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
      toast({ title: 'Fill all fields', variant: 'destructive' }); return;
    }
    if (!testResult?.ok) {
      toast({ title: 'Please test the URL first', variant: 'destructive' }); return;
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
    <ModalShell
      open={true}
      onClose={onClose}
      title="Add External Calendar"
      description="Paste an iCal URL to auto-block rooms"
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !testResult?.ok}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-40 hover:opacity-90"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save & Sync'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
          <div>
            <label className={labelCls}>Room</label>
            <select value={roomId} onChange={e => setRoomId(e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="">Select a room…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.number} — {r.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Source</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {presets.map(p => (
                <button key={p} onClick={() => setName(p)}
                  className="rounded-[8px] border px-3 py-1 text-[12px] font-medium transition-colors"
                  style={name === p
                    ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                    : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', color: isDark ? '#94b8b0' : 'var(--rp-text-subtle)' }}>
                  {p}
                </button>
              ))}
            </div>
            {name === 'Other' && (
              <input type="text" value={customName} placeholder="Enter name…"
                onChange={e => setCustomName(e.target.value)} className={inputCls} />
            )}
          </div>

          <div>
            <label className={labelCls}>iCal URL</label>
            <div className="flex gap-2">
              <input type="url" placeholder="https://admin.booking.com/hotel/ical/..."
                value={url} onChange={e => { setUrl(e.target.value); setTestResult(null); }}
                className={inputCls} />
              <button onClick={handleTest} disabled={!url || testing}
                className="shrink-0 rounded-[8px] border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[#f4f1eb] disabled:opacity-40"
                style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                {testing ? 'Testing…' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className="mt-2 flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[12.5px]"
                style={testResult.ok
                  ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
                  : { background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.15)', color: '#c43c3c' }}>
                {testResult.ok
                  ? <><CheckCircle2 className="h-4 w-4 shrink-0" /> Valid iCal — {testResult.eventCount} reservation{testResult.eventCount !== 1 ? 's' : ''} found</>
                  : <><XCircle className="h-4 w-4 shrink-0" /> {testResult.error}</>
                }
              </div>
            )}
            <p className="mt-2 text-[11.5px] text-[#c5bdb4] dark:text-[#6e8580]">
              Where to find it: Booking.com Extranet → Calendar → Export → iCal link
            </p>
          </div>
      </div>
    </ModalShell>
  );
}

function CalendarCard({ cal, onSynced }: { cal: ExternalCalendar; onSynced: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [syncing,  setSyncing]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const source   = detectSource(cal.name);
  const sm       = SOURCE_META[source];
  const hasError = !!cal.lastError;

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
    <div className="rounded-[12px] border p-4 transition-all"
      style={!cal.isActive
        ? { opacity: 0.5, background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }
        : hasError
        ? { background: '#fef9f9', borderColor: 'rgba(200,60,60,0.2)' }
        : { background: isDark ? 'rgba(255,255,255,0.07)' : 'var(--rp-surface)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5">
            {!cal.isActive
              ? <WifiOff className="h-5 w-5 text-[#c5bdb4] dark:text-[#6e8580]" />
              : hasError
              ? <XCircle className="h-5 w-5" style={{ color: '#c43c3c' }} />
              : <CheckCircle2 className="h-5 w-5" style={{ color: '#23766a' }} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-[7px] border px-[8px] py-[3px] text-[11.5px] font-semibold"
                style={{ background: sm.bg, borderColor: sm.border, color: sm.text }}>{cal.name}</span>
              <span className="text-[12px] text-[#c5bdb4] dark:text-[#6e8580]">
                {cal.importedCount} booking{cal.importedCount !== 1 ? 's' : ''} imported
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="max-w-[240px] truncate font-mono text-[11.5px] text-[#c5bdb4] dark:text-[#6e8580]">{cal.icalUrl}</span>
              <button onClick={handleCopy} className="shrink-0 transition-opacity hover:opacity-70 text-[#c5bdb4] dark:text-[#6e8580]">
                {copied ? <Check className="h-3 w-3" style={{ color: '#23766a' }} /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-[#c5bdb4] dark:text-[#6e8580]" />
              <span className="text-[11.5px]" style={{ color: hasError ? '#c43c3c' : 'var(--rp-text-muted)' }}>
                {hasError ? `Error: ${cal.lastError}` : `Last sync: ${timeAgo(cal.lastSyncAt)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleSync} disabled={syncing || !cal.isActive} title="Sync now"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4f1eb] disabled:opacity-40 text-[#8aa29a] dark:text-[#94b8b0]">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleToggle} title={cal.isActive ? 'Pause sync' : 'Resume sync'}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#f4f1eb] text-[#8aa29a] dark:text-[#94b8b0]">
            {cal.isActive ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          </button>
          <button onClick={handleDelete} disabled={deleting} title="Remove"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors hover:bg-[#fef2f2] disabled:opacity-40 text-[#c5bdb4] dark:text-[#6e8580]">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomGroup({ room, calendars, onAdd, onSynced }: {
  room: Room; calendars: ExternalCalendar[];
  onAdd: (room: Room) => void; onSynced: () => void;
}) {
  const [open, setOpen]   = useState(true);
  const hasConflict       = calendars.some(c => c.lastError);

  return (
    <div className="rounded-[14px] border overflow-hidden"
      style={{ borderColor: 'var(--rp-border-md)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#f5faf9]"
        style={{ background: 'var(--rp-surface-2)', borderBottom: open ? '1px solid rgba(0,0,0,0.06)' : undefined }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ background: 'var(--rp-teal-bg)' }}>
            <span className="text-[11px] font-bold" style={{ color: '#23766a' }}>{room.number}</span>
          </div>
          <div className="text-left">
            <p className="text-[13.5px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">{room.name}</p>
            <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
              {calendars.length === 0
                ? 'No external calendars'
                : `${calendars.length} calendar${calendars.length > 1 ? 's' : ''} connected`}
            </p>
          </div>
          {hasConflict && <AlertTriangle className="h-4 w-4" style={{ color: '#b89040' }} />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-[#c5bdb4] dark:text-[#6e8580]" /> : <ChevronDown className="h-4 w-4 text-[#c5bdb4] dark:text-[#6e8580]" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {calendars.length === 0 ? (
            <p className="py-2 text-center text-[13px] text-[#c5bdb4] dark:text-[#6e8580]">
              No calendars yet — add one to prevent double bookings
            </p>
          ) : (
            calendars.map(cal => <CalendarCard key={cal.id} cal={cal} onSynced={onSynced} />)
          )}
          <button onClick={() => onAdd(room)}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed py-2.5 text-[13px] transition-colors hover:bg-[#f5faf9]"
            style={{ borderColor: 'rgba(35,118,106,0.25)', color: 'var(--rp-text-muted)' }}>
            <Plus className="h-4 w-4" /> Add Calendar
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChannelsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showModal, setShowModal]           = useState(false);
  const [preselectedRoom, setPreselectedRoom] = useState<Room | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['external-calendars'],
    queryFn: async () => { const res = await externalCalendarsApi.list(); return res.data.data as ExternalCalendar[]; },
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms-all'],
    queryFn: async () => {
      const res = await roomsApi.list({ limit: 200, isActive: true });
      return (res.data.data ?? []) as Room[];
    },
  });

  const calendars: ExternalCalendar[] = data ?? [];
  const allRooms: Room[] = roomsData ?? [];

  const byRoom = calendars.reduce<Record<string, ExternalCalendar[]>>((acc, cal) => {
    if (!acc[cal.roomId]) acc[cal.roomId] = [];
    acc[cal.roomId].push(cal);
    return acc;
  }, {});

  const rooms: Room[] = Object.values(
    calendars.reduce<Record<string, Room>>((acc, cal) => { acc[cal.roomId] = cal.room; return acc; }, {})
  );

  const totalCalendars  = calendars.length;
  const activeCalendars = calendars.filter(c => c.isActive).length;
  const totalImported   = calendars.reduce((s, c) => s + c.importedCount, 0);
  const errored         = calendars.filter(c => c.lastError).length;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] flex items-center gap-3 text-[#18231f] dark:text-[#dfd9d0]">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
              <Link2 className="h-4 w-4" style={{ color: '#23766a' }} />
            </div>
            Channel Sync
          </h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890] dark:text-[#94b8b0]">
            Connect Booking.com, Airbnb, or any iCal source to prevent double bookings
          </p>
        </div>
        <button onClick={() => { setPreselectedRoom(null); setShowModal(true); }}
          className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Calendar
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-[12px] border px-4 py-3"
        style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
        <ExternalLink className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#23766a' }} />
        <p className="text-[12.5px]" style={{ color: '#1b342f' }}>
          <strong>How it works:</strong> Paste the iCal URL from Booking.com/Airbnb — ResortPro syncs every 15 minutes and blocks rooms automatically. No API key needed.
        </p>
      </div>

      {/* Stats strip */}
      {totalCalendars > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Connected', value: totalCalendars,  bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text)' },
            { label: 'Active',    value: activeCalendars, bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
            { label: 'Imported',  value: totalImported,   bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
            { label: 'Errors',    value: errored,         bg: errored > 0 ? 'var(--rp-red-bg)' : 'var(--rp-surface-3)', border: errored > 0 ? 'rgba(200,60,60,0.15)' : 'var(--rp-border-md)', text: errored > 0 ? '#c43c3c' : 'var(--rp-text-faint)' },
          ].map(s => (
            <div key={s.label} className="rounded-[12px] border p-3 text-center"
              style={{ background: s.bg, borderColor: s.border }}>
              <p className="text-[22px] font-bold" style={{ color: s.text }}>{s.value}</p>
              <p className="text-[11.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Calendar groups */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#9bbdb7' }} />
        </div>
      ) : calendars.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[14px] border-2 border-dashed p-16 text-center"
          style={{ borderColor: 'rgba(35,118,106,0.2)', background: 'var(--rp-surface-2)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
            <Link2 className="h-7 w-7" style={{ color: '#23766a' }} />
          </div>
          <h3 className="text-[14px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">No external calendars yet</h3>
          <p className="max-w-xs text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">
            Connect your Booking.com or Airbnb listing — bookings there will automatically block rooms here.
          </p>
          <button onClick={() => { setPreselectedRoom(null); setShowModal(true); }}
            className="mt-2 flex items-center gap-2 rounded-[9px] px-5 py-2.5 text-[13px] font-medium hover:opacity-90"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            <Plus className="h-4 w-4" /> Add Your First Calendar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => (
            <RoomGroup key={room.id} room={room} calendars={byRoom[room.id] ?? []}
              onAdd={r => { setPreselectedRoom(r); setShowModal(true); }}
              onSynced={() => qc.invalidateQueries({ queryKey: ['external-calendars'] })} />
          ))}
        </div>
      )}

      {showModal && (
        <AddCalendarModal rooms={allRooms} preselectedRoom={preselectedRoom}
          onClose={() => { setShowModal(false); setPreselectedRoom(null); }}
          onSaved={() => { setShowModal(false); setPreselectedRoom(null); }} />
      )}
    </div>
  );
}

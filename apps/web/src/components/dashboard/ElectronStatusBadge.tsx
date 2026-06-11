'use client';

/**
 * ElectronStatusBadge.tsx
 * Shows online/offline indicator + sync status in the TopNav.
 * Only renders when running inside Electron (window.resortpro.isElectron).
 *
 * States:
 *   🟢 Online          — connected, last synced X min ago
 *   🟡 Syncing…        — sync in progress
 *   🔴 Offline         — no connection, N pending writes
 *
 * Clicking opens a small popover with details.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';

// Window.resortpro type is declared globally in src/types/electron.d.ts

export function ElectronStatusBadge() {
  const { token } = useAuthStore();
  const [isElectron, setIsElectron]     = useState(false);
  const [online, setOnline]             = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [lastSynced, setLastSynced]     = useState<Date | null>(null);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [open, setOpen]                 = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // ── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.resortpro?.isElectron) return;
    setIsElectron(true);
    setOnline(window.resortpro.isOnline());

    const unsubNet = window.resortpro.onOnlineChange(nowOnline => {
      setOnline(nowOnline);
      if (nowOnline && token) doSync(token);
    });

    const unsubSync = window.resortpro.onSyncTokenRequest(() => {
      if (token) doSync(token);
    });

    const unsubQueue = window.resortpro.onQueueStats(stats => {
      setPendingWrites(stats.pending);
    });

    // Initial stats + sync
    window.resortpro.getQueueStats().then(s => setPendingWrites(s.pending));
    if (window.resortpro.isOnline() && token) doSync(token);

    return () => { unsubNet(); unsubSync(); unsubQueue(); };
  }, [token]);

  // Close popover when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function doSync(authToken: string) {
    if (!window.resortpro || syncing) return;
    setSyncing(true);
    try {
      const result = await window.resortpro.triggerSync(authToken);
      if (result.success && result.syncedAt) {
        setLastSynced(new Date(result.syncedAt));
        setPendingWrites(0);
      }
    } finally {
      setSyncing(false);
    }
  }

  if (!isElectron) return null;

  // ── Derived state ────────────────────────────────────────────────────────
  const status: 'offline' | 'syncing' | 'online' =
    !online ? 'offline' : syncing ? 'syncing' : 'online';

  const dotColors = {
    online:  'bg-emerald-500',
    syncing: 'bg-amber-400 animate-pulse',
    offline: 'bg-red-500',
  };

  const badgeColors = {
    online:  'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
    syncing: 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30',
    offline: 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
  };

  const labels = {
    online:  'Online',
    syncing: 'Syncing…',
    offline: 'Offline',
  };

  function formatLastSynced() {
    if (!lastSynced) return 'Never';
    const diff = Math.floor((Date.now() - lastSynced.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <div className="relative" ref={ref}>
      {/* ── Badge button ────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${badgeColors[status]}`}
      >
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotColors[status]}`} />
        <span className="hidden sm:inline">{labels[status]}</span>
        {pendingWrites > 0 && status === 'offline' && (
          <span className="ml-0.5 rounded-full bg-red-200 dark:bg-red-800 px-1.5 text-[10px] font-bold text-red-700 dark:text-red-200">
            {pendingWrites}
          </span>
        )}
      </button>

      {/* ── Popover ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 p-4 space-y-3">

          {/* Status row */}
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              status === 'offline' ? 'bg-red-100 dark:bg-red-900/30' :
              status === 'syncing' ? 'bg-amber-100 dark:bg-amber-900/30' :
                                     'bg-emerald-100 dark:bg-emerald-900/30'
            }`}>
              {status === 'offline' ? (
                <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
              ) : status === 'syncing' ? (
                <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {status === 'offline' ? 'No Connection' : status === 'syncing' ? 'Syncing…' : 'Connected'}
              </p>
              <p className="text-xs text-muted-foreground">
                {status === 'offline'
                  ? 'Changes saved locally'
                  : `Last synced: ${formatLastSynced()}`}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1.5">
            {/* Pending writes */}
            {pendingWrites > 0 ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending changes</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {pendingWrites} waiting
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending changes</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">All synced ✓</span>
              </div>
            )}

            {/* Offline data */}
            {status === 'offline' && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                <CloudOff className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Showing cached data. Will sync automatically when reconnected.
                </p>
              </div>
            )}
          </div>

          {/* Manual sync button */}
          {status === 'online' && token && (
            <button
              onClick={() => { doSync(token); setOpen(false); }}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" /> Sync now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

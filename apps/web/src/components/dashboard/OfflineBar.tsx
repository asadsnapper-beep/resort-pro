'use client';

/**
 * OfflineBar.tsx
 * Shows a subtle banner when the app is running in Electron and goes offline.
 * Also triggers a sync when coming back online.
 *
 * Only visible when:
 *   1. Running inside Electron (window.resortpro.isElectron === true)
 *   2. Network is offline
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';

// Window.resortpro type is declared globally in src/types/electron.d.ts

export function OfflineBar() {
  const { token } = useAuthStore();
  const [isElectron, setIsElectron] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pendingWrites, setPendingWrites] = useState(0);

  useEffect(() => {
    // Only runs in Electron
    if (typeof window === 'undefined' || !window.resortpro?.isElectron) return;

    setIsElectron(true);
    setOnline(window.resortpro.isOnline());

    // Subscribe to network changes from main process
    const unsubNetwork = window.resortpro.onOnlineChange((nowOnline) => {
      setOnline(nowOnline);

      // When coming back online, trigger a sync
      if (nowOnline && token) {
        triggerSync(token);
      }
    });

    // Main process may ask for a token to trigger sync after reconnect
    const unsubSyncReq = window.resortpro.onSyncTokenRequest(() => {
      if (token) triggerSync(token);
    });

    // Listen for queue stats updates from main process
    const unsubQueue = window.resortpro.onQueueStats((stats) => {
      setPendingWrites(stats.pending);
    });

    // Check queue stats on mount
    window.resortpro.getQueueStats().then((s) => setPendingWrites(s.pending));

    // Initial sync on mount (if online)
    if (window.resortpro.isOnline() && token) {
      triggerSync(token);
    }

    return () => {
      unsubNetwork();
      unsubSyncReq();
      unsubQueue();
    };
  }, [token]);

  async function triggerSync(authToken: string) {
    if (!window.resortpro || syncing) return;
    setSyncing(true);
    try {
      const result = await window.resortpro.triggerSync(authToken);
      if (result.success && result.syncedAt) {
        setLastSynced(result.syncedAt);
        setPendingWrites(0);
        console.log('[OfflineBar] Sync complete:', result.counts);
      }
    } finally {
      setSyncing(false);
    }
  }

  // Not in Electron — don't render anything
  if (!isElectron) return null;

  return (
    <>
      {/* Offline banner — shown only when offline */}
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>
            You are offline — showing cached data.{' '}
            {pendingWrites > 0 && (
              <strong>{pendingWrites} unsaved {pendingWrites === 1 ? 'change' : 'changes'} waiting to sync.</strong>
            )}
            {pendingWrites === 0 && 'Changes will sync when connection is restored.'}
          </span>
        </div>
      )}

      {/* Online + syncing indicator — small pill in top bar area */}
      {online && syncing && (
        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1 text-xs text-emerald-700 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Syncing with server…</span>
        </div>
      )}

      {/* Last synced — only show for a moment after sync, then hide */}
      {online && !syncing && lastSynced && (
        <SyncedFlash syncedAt={lastSynced} />
      )}
    </>
  );
}

// Briefly shows "Synced" then disappears after 3s
function SyncedFlash({ syncedAt }: { syncedAt: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [syncedAt]);

  if (!visible) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1 text-xs text-emerald-700 dark:text-emerald-400 transition-opacity">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span>Synced ✓</span>
    </div>
  );
}

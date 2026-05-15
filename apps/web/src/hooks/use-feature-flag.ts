'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ── In-memory cache so one fetch serves the whole page ─────────────────────
let _cache: Set<string> | null = null;
let _fetching: Promise<Set<string>> | null = null;

async function fetchFlags(): Promise<Set<string>> {
  if (_cache) return _cache;
  if (_fetching) return _fetching;

  _fetching = api.get('/tenant/flags').then((r) => {
    const flags = new Set<string>(r.data.data as string[]);
    _cache = flags;
    _fetching = null;
    return flags;
  }).catch(() => {
    _fetching = null;
    return new Set<string>();
  });

  return _fetching;
}

/** Clear the cache (call on logout or tenant switch) */
export function clearFlagCache() {
  _cache = null;
  _fetching = null;
}

/**
 * useFeatureFlag(flag)
 *
 * Returns true if the flag is enabled for the current tenant.
 * Fetches once and caches for the session.
 *
 * Usage:
 *   const hasAnalytics = useFeatureFlag('beta_analytics');
 *   if (!hasAnalytics) return null;
 */
export function useFeatureFlag(flag: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchFlags().then((flags) => {
      if (mounted) setEnabled(flags.has(flag));
    });
    return () => { mounted = false; };
  }, [flag]);

  return enabled;
}

/**
 * useFeatureFlags()
 *
 * Returns the full set of enabled flags + an `isEnabled(flag)` helper.
 * Useful when a component needs to check multiple flags at once.
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    clearFlagCache();
    setLoading(true);
    fetchFlags().then((f) => {
      setFlags(f);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchFlags().then((f) => {
      if (mounted) { setFlags(f); setLoading(false); }
    });
    return () => { mounted = false; };
  }, []);

  const isEnabled = useCallback((flag: string) => flags.has(flag), [flags]);

  return { flags, loading, isEnabled, reload };
}

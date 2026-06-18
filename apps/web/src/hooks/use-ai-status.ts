'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * AI feature availability for the current tenant.
 *
 * Unlike useFeatureFlag (per-tenant only), this hits /api/ai/status which
 * combines the GLOBAL master switch AND the per-tenant flag. If super-admin
 * keeps AI off, every value here is false → all AI UI hides.
 */
export type AiFeature = 'ai_content' | 'ai_chatbot' | 'ai_business_insights';
type AiStatus = Record<AiFeature, boolean>;

const ALL_OFF: AiStatus = { ai_content: false, ai_chatbot: false, ai_business_insights: false };

let _cache: AiStatus | null = null;
let _fetching: Promise<AiStatus> | null = null;

async function fetchStatus(): Promise<AiStatus> {
  if (_cache) return _cache;
  if (_fetching) return _fetching;

  _fetching = api.get('/ai/status').then((r) => {
    const s = { ...ALL_OFF, ...(r.data.data as Partial<AiStatus>) };
    _cache = s;
    _fetching = null;
    return s;
  }).catch(() => {
    _fetching = null;
    return ALL_OFF;
  });

  return _fetching;
}

export function clearAiStatusCache() {
  _cache = null;
  _fetching = null;
}

/** True only when the given AI feature is live (master ON + tenant flag ON). */
export function useAiFeature(feature: AiFeature): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchStatus().then((s) => { if (mounted) setEnabled(s[feature]); });
    return () => { mounted = false; };
  }, [feature]);

  return enabled;
}

/** Full status + loading, for components that gate on multiple AI features. */
export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus>(ALL_OFF);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchStatus().then((s) => { if (mounted) { setStatus(s); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  return { status, loading };
}

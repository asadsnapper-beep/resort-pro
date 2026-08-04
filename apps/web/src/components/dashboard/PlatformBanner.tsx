'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Info, AlertTriangle, Wrench, Sparkles, X } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  isDismissible: boolean;
}

const TYPE_STYLE: Record<string, {
  icon: React.ElementType;
  iconBg: string; iconColor: string;
  bg: string; border: string;
  titleColor: string; bodyColor: string;
}> = {
  info: {
    icon: Info,
    iconBg: 'var(--rp-teal-bg)', iconColor: '#183153',
    bg: 'var(--rp-teal-soft)', border: 'rgba(24,49,83,0.18)',
    titleColor: '#183153', bodyColor: 'var(--rp-text-accent)',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'var(--rp-amber-bg)', iconColor: '#b89040',
    bg: '#fdf8ed', border: 'rgba(184,144,64,0.22)',
    titleColor: '#7a5c2a', bodyColor: '#b89040',
  },
  maintenance: {
    icon: Wrench,
    iconBg: 'var(--rp-coral-bg)', iconColor: '#b8724a',
    bg: '#fef7f3', border: 'rgba(184,114,74,0.2)',
    titleColor: '#7a3c1a', bodyColor: '#b8724a',
  },
  feature: {
    icon: Sparkles,
    iconBg: '#183153', iconColor: '#f8fafc',
    bg: '#f2f7fb', border: 'rgba(24,49,83,0.15)',
    titleColor: '#183153', bodyColor: 'var(--rp-text-accent)',
  },
};

const DISMISSED_KEY = 'resort_dismissed_announcements';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch { /* ignore */ }
}

/**
 * PlatformBanner
 *
 * Fetches active announcements from /api/tenant/announcements and shows
 * one banner per announcement (stacked). Dismissals are saved to localStorage.
 *
 * Usage: drop inside the tenant dashboard layout above `{children}`.
 */
export function PlatformBanner() {
  const [banners, setBanners] = useState<Announcement[]>([]);

  useEffect(() => {
    api.get('/tenant/announcements').then((r) => {
      const all: Announcement[] = r.data.data ?? [];
      const dismissed = getDismissed();
      setBanners(all.filter((a) => !dismissed.has(a.id)));
    }).catch(() => { /* silently ignore — non-critical */ });
  }, []);

  const dismiss = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    const dismissed = getDismissed();
    dismissed.add(id);
    saveDismissed(dismissed);
  };

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {banners.map((b) => {
        const s = TYPE_STYLE[b.type] ?? TYPE_STYLE.info;
        const Icon = s.icon;
        return (
          <div key={b.id} className="flex items-start gap-3 rounded-[14px] border px-4 py-3"
            style={{ background: s.bg, borderColor: s.border }}>
            <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[9px]"
              style={{ background: s.iconBg }}>
              <Icon className="h-[14px] w-[14px]" style={{ color: s.iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-snug" style={{ color: s.titleColor }}>{b.title}</p>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: s.bodyColor }}>{b.body}</p>
            </div>
            {b.isDismissible && (
              <button onClick={() => dismiss(b.id)}
                className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                style={{ color: s.bodyColor }}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

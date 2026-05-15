'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Info, AlertTriangle, Wrench, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  isDismissible: boolean;
}

const TYPE_STYLE: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  info:        { icon: Info,          color: 'text-blue-300',   bg: 'bg-blue-950/40',   border: 'border-blue-500/30' },
  warning:     { icon: AlertTriangle, color: 'text-amber-300',  bg: 'bg-amber-950/40',  border: 'border-amber-500/30' },
  maintenance: { icon: Wrench,        color: 'text-orange-300', bg: 'bg-orange-950/40', border: 'border-orange-500/30' },
  feature:     { icon: Sparkles,      color: 'text-indigo-300', bg: 'bg-indigo-950/40', border: 'border-indigo-500/30' },
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
        const style = TYPE_STYLE[b.type] ?? TYPE_STYLE.info;
        const Icon = style.icon;
        return (
          <div
            key={b.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-xl border',
              style.bg, style.border
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', style.color)} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', style.color)}>{b.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{b.body}</p>
            </div>
            {b.isDismissible && (
              <button
                onClick={() => dismiss(b.id)}
                className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';

/**
 * Owner-side notification bell. Mirrors the admin panel's NotificationBell
 * (components/admin/NotificationBell.tsx) — same open/close/mark-read
 * behaviour — but in the dashboard's resort green/gold palette instead of
 * the admin panel's dark/indigo one, and against the tenant Notification
 * model (title/body/type/data — no linkPath column, unlike AdminNotification).
 *
 * Before this, the bell button in top-nav.tsx had no onClick and no panel at
 * all — clicking it did nothing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCheck, Package, Wrench, Star, Loader2 } from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Known types get an icon + a place to click through to. Everything else
 * (there are more types seeded as demo data than routes actually emit today)
 * falls back to a plain bell with no link — better than crashing on an
 * unrecognised type.
 */
const TYPE_CONFIG: Record<string, { icon: typeof Bell; dot: string; href?: string }> = {
  inventory_low_stock: { icon: Package, dot: 'bg-rp-danger', href: '/dashboard/inventory' },
  MAINTENANCE:         { icon: Wrench,  dot: 'bg-rp-gold' },
  REVIEW:              { icon: Star,    dot: 'bg-rp-brand' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list();
      setNotifications(res.data?.data ?? []);
    } catch {
      // silent — a failed fetch shouldn't break the whole header
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      notificationsApi.read(n.id).catch(() => {});
    }
    const href = TYPE_CONFIG[n.type]?.href;
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsApi.readAll();
    } catch {
      fetchNotifications(); // roll back the optimistic update if it didn't actually save
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-rp-ctrl transition-colors',
          open ? 'bg-rp-surface-3 text-rp-text' : 'text-[#94aab9] hover:text-resort-900 dark:hover:text-white',
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rp-danger text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 overflow-hidden rounded-rp-card border border-rp-border bg-rp-surface shadow-rp-pop">
          <div className="flex items-center justify-between border-b border-rp-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-rp-brand" />
              <span className="text-rp-body font-semibold text-rp-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rp-btn-accent px-1.5 py-0.5 text-rp-micro font-medium text-rp-btn-accent-text">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="flex items-center gap-1 rounded-rp-sm px-2 py-1 text-rp-micro text-rp-muted transition-colors hover:bg-rp-surface-3 hover:text-rp-brand"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-rp-sm p-1 text-rp-muted transition-colors hover:bg-rp-surface-3 hover:text-rp-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-rp-brand" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Bell className="mb-2 h-8 w-8 text-rp-faint" />
                <p className="text-rp-body text-rp-muted">No notifications yet</p>
                <p className="mt-1 text-rp-micro text-rp-faint">
                  Low stock, maintenance and reviews will appear here
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type];
                const Icon = cfg?.icon ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-rp-border px-4 py-3.5 text-left transition-colors',
                      n.isRead ? 'hover:bg-rp-surface-2' : 'bg-rp-teal-soft hover:bg-rp-teal-bg',
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-rp-ctrl bg-rp-surface-3">
                      <Icon className="h-4 w-4 text-rp-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-rp-body leading-snug', n.isRead ? 'text-rp-subtle' : 'font-medium text-rp-text')}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', cfg?.dot ?? 'bg-rp-brand')} />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-rp-meta leading-relaxed text-rp-muted">{n.body}</p>
                      <p className="mt-1 text-rp-micro text-rp-faint">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

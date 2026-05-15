'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminEndpoints } from '@/lib/admin-api';
import { useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  linkPath: string | null;
  createdAt: string;
}

// ── Notification type config ──────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { dot: string; icon: string }> = {
  new_signup:            { dot: 'bg-green-400',  icon: '🏨' },
  payment_failed:        { dot: 'bg-red-400',    icon: '💳' },
  subscription_canceled: { dot: 'bg-orange-400', icon: '🚪' },
  trial_expiring:        { dot: 'bg-yellow-400', icon: '⏳' },
  account_suspended:     { dot: 'bg-gray-400',   icon: '🔒' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminEndpoints.getNotifications();
      setNotifications(res.data.data.notifications);
      setUnreadCount(res.data.data.unreadCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + poll every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fetch when opened
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id: string, linkPath?: string | null) => {
    try {
      await adminEndpoints.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }

    if (linkPath) {
      setOpen(false);
      router.push(linkPath);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await adminEndpoints.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
          open ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
        )}
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="text-white text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-400 transition-colors px-2 py-1 rounded-md hover:bg-gray-800"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Bell className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-gray-500 text-sm">No notifications yet</p>
                <p className="text-gray-700 text-xs mt-1">
                  Signups, payments, and cancellations will appear here
                </p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? { dot: 'bg-gray-500', icon: '🔔' };
                return (
                  <button
                    key={n.id}
                    onClick={() => handleMarkRead(n.id, n.linkPath)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-gray-800/60 transition-colors',
                      n.isRead
                        ? 'hover:bg-gray-800/30'
                        : 'bg-indigo-950/20 hover:bg-indigo-950/40'
                    )}
                  >
                    {/* Emoji icon */}
                    <div className="shrink-0 w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-base mt-0.5">
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm leading-snug',
                          n.isRead ? 'text-gray-300' : 'text-white font-medium'
                        )}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.isRead && (
                            <span className={cn('w-2 h-2 rounded-full shrink-0 mt-0.5', cfg.dot)} />
                          )}
                          {n.linkPath && (
                            <ExternalLink className="w-3 h-3 text-gray-600" />
                          )}
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-gray-700 text-xs mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-800 text-center">
              <span className="text-gray-600 text-xs">
                Showing last {notifications.length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

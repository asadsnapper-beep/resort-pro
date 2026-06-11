'use client';

import { Bell, Search, Moon, Sun, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { ElectronStatusBadge } from './ElectronStatusBadge';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi, billingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';

function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { tenant } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billingApi.getStatus(),
    staleTime: 5 * 60 * 1000,
    enabled: tenant?.planStatus === 'trialing',
  });

  const status = data?.data?.data;
  if (!status || dismissed) return null;

  const { isTrialing, trialDaysLeft } = status;
  if (!isTrialing || trialDaysLeft > 7) return null;

  const urgency = trialDaysLeft <= 2 ? 'red' : trialDaysLeft <= 4 ? 'amber' : 'blue';

  const colors = {
    red: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700/30 dark:text-red-300',
    amber: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/30 dark:text-amber-300',
    blue: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700/30 dark:text-blue-300',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-2 border-b text-sm ${colors[urgency]}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        <strong>
          {trialDaysLeft === 0 ? 'Your trial ends today!' : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your trial.`}
        </strong>{' '}
        Upgrade now to keep all your data and bookings.
      </span>
      <Link
        href="/dashboard/upgrade"
        className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline whitespace-nowrap"
      >
        Choose a plan <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function TopNav() {
  const { theme, setTheme } = useTheme();

  const { data: notificationsRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 30000,
  });

  const unread = notificationsRes?.data?.data?.filter((n: { isRead: boolean }) => !n.isRead)?.length || 0;

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <TrialBanner />
      <div className="flex h-16 items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search rooms, bookings, guests..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Online/offline indicator — Electron only */}
        <ElectronStatusBadge />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-gray-500"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative text-gray-500">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </div>
    </div>
    </header>
  );
}


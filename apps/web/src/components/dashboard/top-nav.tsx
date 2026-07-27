'use client';

import { Search, Moon, Sun, AlertTriangle, ArrowRight, X, PanelLeft, PanelLeftClose } from 'lucide-react';
import { ElectronStatusBadge } from './ElectronStatusBadge';
import { NotificationBell } from './NotificationBell';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';

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
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <header className="border-b border-resort-900/10 bg-white dark:border-white/8 dark:bg-resort-900/60">
      <TrialBanner />
      <div className="flex h-[52px] items-center justify-between px-5">
        <div className="flex items-center gap-3 flex-1 max-w-sm">
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#8fa8a1] transition-colors hover:bg-black/5 hover:text-resort-900 dark:hover:bg-white/5 dark:hover:text-white"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8aa29a]" />
            <input
              placeholder="Search rooms, bookings, guests..."
              className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-1.5 pl-8 pr-16 text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded bg-white border border-black/8 px-1.5 py-0.5 text-[10px] text-[#8aa29a] font-medium">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ElectronStatusBadge />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 text-[#8fa8a1] hover:text-resort-900 dark:hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}


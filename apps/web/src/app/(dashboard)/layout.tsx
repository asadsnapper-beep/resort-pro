'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TopNav } from '@/components/dashboard/top-nav';
import { PlatformBanner } from '@/components/dashboard/PlatformBanner';
import { DemoBanner } from '@/components/dashboard/DemoBanner';
import { ImpersonationBanner } from '@/components/dashboard/ImpersonationBanner';
import { OfflineBar } from '@/components/dashboard/OfflineBar';
import { billingApi } from '@/lib/api';

// Pages that should always render regardless of billing status
const BILLING_EXEMPT_PATHS = ['/dashboard/upgrade', '/dashboard/suspended', '/dashboard/billing'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, tenant, setAuth, user, token } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }

    // Skip billing check for demo tenant
    if (tenant?.isDemo) {
      setStatusChecked(true);
      return;
    }

    // If already on an exempt page, skip billing check
    if (BILLING_EXEMPT_PATHS.some(p => pathname?.startsWith(p))) {
      setStatusChecked(true);
      return;
    }

    // Check live subscription status from API
    // Timeout after 5s — don't block the dashboard if the API is slow/offline
    const billingTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('billing timeout')), 5000)
    );
    Promise.race([billingApi.getStatus(), billingTimeout])
      .then((res) => {
        const data = res.data.data;
        const { planStatus, trialDaysLeft } = data;

        // Update tenant in store with fresh status
        if (user && tenant && token) {
          setAuth(user, {
            ...tenant,
            planStatus,
            trialEndsAt: data.trialEndsAt,
          }, token);
        }

        // Account suspended
        if (tenant && !data.tenantIsActive) {
          router.push('/dashboard/suspended');
          setStatusChecked(true);
          return;
        }

        // Trial expired — needs to upgrade
        if (planStatus === 'trialing' && trialDaysLeft <= 0) {
          router.push('/dashboard/upgrade');
          setStatusChecked(true);
          return;
        }

        // Subscription canceled or past_due — needs to upgrade
        if (planStatus === 'canceled' || planStatus === 'past_due') {
          router.push('/dashboard/upgrade');
          setStatusChecked(true);
          return;
        }

        setStatusChecked(true);
      })
      .catch(() => {
        // If API fails, allow access (don't block on network error)
        setStatusChecked(true);
      });
  }, [mounted, isAuthenticated, pathname]);

  if (!mounted || (!statusChecked && isAuthenticated())) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#efece6] dark:bg-gray-950">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <OfflineBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 animate-fade-in">
          <ImpersonationBanner />
          <DemoBanner />
          <PlatformBanner />
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/8 bg-resort-900 md:hidden">
        {[
          { href: '/dashboard',           icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
          { href: '/dashboard/bookings',  icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Bookings' },
          { href: '/dashboard/front-desk',icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', label: 'Desk' },
          { href: '/dashboard/orders',    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', label: 'F&B' },
        ].map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <a key={href} href={href} className="flex flex-col items-center gap-1 px-4 py-2">
              <svg className={`h-5 w-5 ${active ? 'text-gold-400' : 'text-[#8fa8a1]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              <span className={`text-[10px] font-medium ${active ? 'text-gold-400' : 'text-[#8fa8a1]'}`}>{label}</span>
            </a>
          );
        })}
        <a href="/dashboard/calendar" className="flex flex-col items-center gap-1 px-4 py-2">
          <svg className={`h-5 w-5 ${pathname.startsWith('/dashboard/calendar') ? 'text-gold-400' : 'text-[#8fa8a1]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className={`text-[10px] font-medium ${pathname.startsWith('/dashboard/calendar') ? 'text-gold-400' : 'text-[#8fa8a1]'}`}>More</span>
        </a>
      </nav>
    </div>
  );
}

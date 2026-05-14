'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TopNav } from '@/components/dashboard/top-nav';
import { billingApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, tenant, setAuth, user, token, refreshToken } = useAuthStore();
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

    // Check live subscription status from API
    billingApi.getStatus()
      .then((res) => {
        const data = res.data.data;
        const { planStatus, trialDaysLeft, isTrialing, isActive } = data;

        // Update tenant in store with fresh status
        if (user && tenant && token && refreshToken) {
          setAuth(user, {
            ...tenant,
            planStatus,
            trialEndsAt: data.trialEndsAt,
          }, token, refreshToken);
        }

        // Account suspended
        if (tenant && !data.tenantIsActive) {
          router.push('/dashboard/suspended');
          return;
        }

        // Trial expired — needs to upgrade
        if (planStatus === 'trialing' && trialDaysLeft <= 0) {
          router.push('/dashboard/upgrade');
          return;
        }

        // Subscription canceled or past_due — needs to upgrade
        if (planStatus === 'canceled' || planStatus === 'past_due') {
          router.push('/dashboard/upgrade');
          return;
        }

        setStatusChecked(true);
      })
      .catch(() => {
        // If API fails, allow access (don't block on network error)
        setStatusChecked(true);
      });
  }, [mounted, isAuthenticated]);

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
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

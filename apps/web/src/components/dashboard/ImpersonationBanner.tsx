'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useAdminStore } from '@/store/admin';
import { ShieldAlert, LogOut } from 'lucide-react';

/**
 * Shows a red banner when a Super Admin is impersonating a tenant.
 * Detection: admin_token present in localStorage (admin session alive)
 *            while tenant auth store is also populated.
 */
export function ImpersonationBanner() {
  const router = useRouter();
  const { tenant, clearAuth } = useAuthStore();
  const { isAdminAuthenticated } = useAdminStore();

  if (!isAdminAuthenticated()) return null;

  const handleExit = () => {
    clearAuth();
    router.push('/admin/dashboard');
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
      <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
      <p className="flex-1 text-sm font-medium text-red-300">
        Admin view — you are logged in as{' '}
        <span className="font-bold text-red-200">{tenant?.name ?? 'this resort'}</span>.
        Changes here are real.
      </p>
      <button
        onClick={handleExit}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30 hover:text-red-200"
      >
        <LogOut className="h-3 w-3" />
        Exit impersonation
      </button>
    </div>
  );
}

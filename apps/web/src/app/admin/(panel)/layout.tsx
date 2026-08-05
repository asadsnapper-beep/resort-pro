'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminStore } from '@/store/admin';
import {
  LayoutDashboard, Building2, Users, CreditCard,
  LogOut, Shield, ChevronRight, Loader2, Settings, Palette, ClipboardList, Download, Gift, UserCog, Megaphone, ShieldCheck, Activity, Star, Globe, HardDrive, Sparkles, Mail,
} from 'lucide-react';
import NotificationBell from '@/components/admin/NotificationBell';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview',    icon: LayoutDashboard },
  { href: '/admin/tenants',   label: 'Tenants',     icon: Building2 },
  { href: '/admin/users',     label: 'Users',       icon: Users },
  { href: '/admin/billing',   label: 'Billing & MRR', icon: CreditCard },
  { href: '/admin/themes',    label: 'Themes',      icon: Palette },
  { href: '/admin/design-requests', label: 'Design Requests', icon: Sparkles },
  { href: '/admin/demo-leads', label: 'Demo Leads', icon: Mail },
  { href: '/admin/audit-log', label: 'Audit Log',   icon: ClipboardList },
  { href: '/admin/export',     label: 'Export',      icon: Download },
  { href: '/admin/referrals',  label: 'Referrals',   icon: Gift },
  { href: '/admin/team',           label: 'Team',           icon: UserCog },
  { href: '/admin/announcements',  label: 'Announcements',  icon: Megaphone },
  { href: '/admin/gdpr',           label: 'GDPR',           icon: ShieldCheck },
  { href: '/admin/enterprise',      label: 'Enterprise',     icon: Star },
  { href: '/admin/domains',         label: 'Domains',        icon: Globe },
  { href: '/admin/health',         label: 'Health',         icon: Activity },
  { href: '/admin/storage',         label: 'Storage',         icon: HardDrive },
  { href: '/admin/settings',       label: 'Settings',       icon: Settings },
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { clearAdmin, admin, isAdminAuthenticated } = useAdminStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAdminAuthenticated()) {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, router]);

  // Show spinner until client-side mount — avoids SSR/localStorage mismatch
  if (!mounted) {
    return (
      <div className="admin-shell min-h-screen bg-rp-surface-2 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rp-brand" />
      </div>
    );
  }

  if (!isAdminAuthenticated()) return null;

  const handleLogout = () => {
    clearAdmin();
    router.push('/admin/login');
  };

  return (
    <div className="admin-shell flex h-screen overflow-hidden bg-rp-surface-2 text-rp-text">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-rp-surface border-r-2 border-rp-border shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-5 border-b-2 border-rp-border">
          <div className="w-8 h-8 bg-rp-brand rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-rp-btn-accent-text" />
          </div>
          <div>
            <p className="text-rp-text text-sm font-bold">ResortPro</p>
            <p className="text-rp-muted text-xs">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-rp-teal-bg text-rp-brand border border-rp-border-md'
                    : 'text-rp-muted hover:text-rp-text hover:bg-rp-surface-3'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t-2 border-rp-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-rp-teal-bg border border-rp-border-md rounded-full flex items-center justify-center">
              <span className="text-rp-brand text-xs font-bold uppercase">
                {admin?.email?.[0] || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-rp-text text-xs font-medium truncate">{admin?.email || 'Admin'}</p>
              <p className="text-rp-brand text-xs">Super Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rp-muted hover:text-rp-danger hover:bg-rp-red-bg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b-2 border-rp-border bg-rp-surface flex items-center px-6 gap-2 shrink-0">
          {/* Breadcrumb */}
          <span className="text-rp-muted text-sm">Admin</span>
          <ChevronRight className="w-3 h-3 text-rp-faint" />
          <span className="text-rp-text text-sm font-medium capitalize">
            {pathname === '/admin' ? 'Overview' : pathname.split('/').pop()}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-rp-brand bg-rp-teal-bg border border-rp-border-md px-2 py-1 rounded-full">
              Super Admin
            </span>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-y-auto bg-rp-surface-2 p-5 md:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

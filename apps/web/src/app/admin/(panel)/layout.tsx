'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAdminStore } from '@/store/admin';
import {
  LayoutDashboard, Building2, Users, CreditCard,
  LogOut, Shield, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard  },
  { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/billing', label: 'Billing & MRR', icon: CreditCard },
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { clearAdmin, admin, isAdminAuthenticated } = useAdminStore();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, router]);

  if (!isAdminAuthenticated()) return null;

  const handleLogout = () => {
    clearAdmin();
    router.push('/admin/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-5 border-b border-gray-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold">Admin Panel</p>
            <p className="text-gray-500 text-xs">ResortPro</p>
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
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-full flex items-center justify-center">
              <span className="text-indigo-400 text-xs font-bold uppercase">
                {admin?.email?.[0] || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{admin?.email || 'Admin'}</p>
              <p className="text-indigo-400 text-xs">Super Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-gray-800 bg-gray-900 flex items-center px-6 gap-2 shrink-0">
          {/* Breadcrumb */}
          <span className="text-gray-500 text-sm">Admin</span>
          <ChevronRight className="w-3 h-3 text-gray-700" />
          <span className="text-gray-300 text-sm font-medium capitalize">
            {pathname === '/admin' ? 'Overview' : pathname.split('/').pop()}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 px-2 py-1 rounded-full">
              Super Admin
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

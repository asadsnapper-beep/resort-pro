'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BedDouble, CalendarDays, Users, UserCog,
  Sparkles, ClipboardList, UtensilsCrossed, ShoppingBag,
  Package, Ticket, Globe, Bell, Settings, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/rooms', label: 'Rooms & Villas', icon: BedDouble },
  { href: '/dashboard/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/dashboard/guests', label: 'Guests', icon: Users },
  { href: '/dashboard/staff', label: 'Staff', icon: UserCog },
  { href: '/dashboard/housekeeping', label: 'Housekeeping', icon: Sparkles },
  { href: '/dashboard/restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { href: '/dashboard/orders', label: 'F&B Orders', icon: ShoppingBag },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package },
  { href: '/dashboard/support', label: 'Support', icon: Ticket },
  { href: '/dashboard/website', label: 'Website', icon: Globe },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant, user, clearAuth, refreshToken } = useAuthStore();

  const handleLogout = async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clearAuth();
    router.push('/auth/login');
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5 dark:border-gray-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-resort-700 font-display text-lg font-bold text-gold-400">R</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{tenant?.name || 'ResortPro'}</p>
          <p className="text-xs text-gray-400 capitalize">{tenant?.plan?.toLowerCase() || 'free'} plan</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <ul className="space-y-0.5 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-resort-50 text-resort-700 dark:bg-resort-900/20 dark:text-resort-400'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-resort-100 text-xs font-bold text-resort-700 dark:bg-resort-900 dark:text-resort-300">
            {user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.toLowerCase()}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

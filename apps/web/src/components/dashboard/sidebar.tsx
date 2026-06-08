'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BedDouble, CalendarDays, Users, UserCog,
  Sparkles, ClipboardList, UtensilsCrossed, ShoppingBag,
  Package, Ticket, Globe, Bell, Settings, LogOut, Mail,
  CreditCard, BarChart2, LayoutGrid, Tags, Wrench, FileBarChart2,
  Gift, UsersRound, Star, Link2, Receipt, ChevronDown, LifeBuoy, FileText, Megaphone,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { authApi, tenantApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────────────
// Role type
// ─────────────────────────────────────────────────────────────────
type Role = 'OWNER' | 'MANAGER' | 'SHAREHOLDER' | 'RECEPTIONIST' | 'MARKETER' | 'DEVELOPER' | 'STAFF' | 'GUEST';

// ─────────────────────────────────────────────────────────────────
// Role badge config
// ─────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<Role, { label: string; color: string }> = {
  OWNER:        { label: 'Owner',        color: 'bg-gold-400/20 text-gold-600' },
  MANAGER:      { label: 'Manager',      color: 'bg-resort-100 text-resort-700' },
  SHAREHOLDER:  { label: 'Shareholder',  color: 'bg-amber-100 text-amber-700' },
  RECEPTIONIST: { label: 'Receptionist', color: 'bg-emerald-100 text-emerald-700' },
  MARKETER:     { label: 'Marketer',     color: 'bg-purple-100 text-purple-700' },
  DEVELOPER:    { label: 'Developer',    color: 'bg-gray-100 text-gray-600' },
  STAFF:        { label: 'Staff',        color: 'bg-orange-100 text-orange-700' },
  GUEST:        { label: 'Guest',        color: 'bg-gray-100 text-gray-500' },
};

// ─────────────────────────────────────────────────────────────────
// Nav items with role permissions
// roles: undefined = visible to ALL roles
// roles: [...] = ONLY these roles can see it
// ─────────────────────────────────────────────────────────────────
type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  group?: string;
  roles?: Role[];
};

const NAV_ITEMS: NavItem[] = [
  // ── Overview ──────────────────────────────────────────────
  { href: '/dashboard',            label: 'Dashboard',       icon: LayoutDashboard, group: 'Overview' },
  { href: '/dashboard/analytics',  label: 'Analytics',       icon: BarChart2,       group: 'Overview',
    roles: ['OWNER', 'MANAGER', 'SHAREHOLDER', 'MARKETER'] },
  { href: '/dashboard/invoices',   label: 'Invoices',        icon: FileText,        group: 'Overview',
    roles: ['OWNER', 'MANAGER', 'SHAREHOLDER', 'RECEPTIONIST'] },
  { href: '/dashboard/expenses',   label: 'Expenses',        icon: Receipt,         group: 'Overview',
    roles: ['OWNER', 'MANAGER', 'SHAREHOLDER'] },
  { href: '/dashboard/reports',    label: 'Daily Reports',   icon: FileBarChart2,   group: 'Overview',
    roles: ['OWNER', 'MANAGER', 'SHAREHOLDER'] },

  // ── Rooms & Bookings ──────────────────────────────────────
  { href: '/dashboard/rooms',          label: 'Rooms & Villas',   icon: BedDouble,    group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'] },
  { href: '/dashboard/rate-plans',     label: 'Rate Plans',       icon: Tags,         group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/packages',       label: 'Packages',         icon: Gift,         group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { href: '/dashboard/front-desk',     label: 'Front Desk',       icon: ClipboardList, group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/bookings',       label: 'Bookings',         icon: CalendarDays, group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'SHAREHOLDER', 'RECEPTIONIST'] },
  { href: '/dashboard/calendar',       label: 'Booking Calendar', icon: LayoutGrid,   group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/group-bookings', label: 'Group Bookings',   icon: UsersRound,   group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/channels',       label: 'Channel Sync',     icon: Link2,        group: 'Rooms & Bookings',
    roles: ['OWNER', 'MANAGER', 'DEVELOPER'] },

  // ── Guests ────────────────────────────────────────────────
  { href: '/dashboard/guests',   label: 'Guests',          icon: Users, group: 'Guests',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { href: '/dashboard/loyalty',  label: 'Loyalty Program', icon: Star,  group: 'Guests',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { href: '/dashboard/support',  label: 'Support',         icon: Ticket, group: 'Guests',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'] },

  // ── Operations ────────────────────────────────────────────
  { href: '/dashboard/staff',        label: 'Staff',         icon: UserCog,        group: 'Operations',
    roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/housekeeping', label: 'Housekeeping',  icon: Sparkles,       group: 'Operations',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'] },
  { href: '/dashboard/maintenance',  label: 'Maintenance',   icon: Wrench,         group: 'Operations',
    roles: ['OWNER', 'MANAGER', 'STAFF'] },

  // ── Restaurant ────────────────────────────────────────────
  { href: '/dashboard/restaurant', label: 'Restaurant',  icon: UtensilsCrossed, group: 'Restaurant',
    roles: ['OWNER', 'MANAGER', 'STAFF'] },
  { href: '/dashboard/orders',     label: 'F&B Orders',  icon: ShoppingBag,     group: 'Restaurant',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'] },
  { href: '/dashboard/inventory',  label: 'Inventory',   icon: Package,         group: 'Restaurant',
    roles: ['OWNER', 'MANAGER', 'STAFF'] },

  // ── Marketing ─────────────────────────────────────────────
  { href: '/dashboard/offers',    label: 'Offers',         icon: Ticket,    group: 'Marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/crm',       label: 'CRM & Email',   icon: Mail,      group: 'Marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/marketing', label: 'SMS Marketing', icon: Megaphone, group: 'Marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/website',   label: 'Website',       icon: Globe,     group: 'Marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'] },

  // ── Account ───────────────────────────────────────────────
  { href: '/dashboard/billing',   label: 'Billing',            icon: CreditCard,  group: 'Account',
    roles: ['OWNER'] },
  { href: '/dashboard/referrals', label: 'Referrals',          icon: Gift,        group: 'Account',
    roles: ['OWNER'] },
  { href: '/dashboard/roles',     label: 'Roles & Permissions', icon: ShieldCheck, group: 'Account',
    roles: ['OWNER'] },
  { href: '/dashboard/settings',  label: 'Settings',           icon: Settings,    group: 'Account',
    roles: ['OWNER', 'MANAGER', 'DEVELOPER'] },
];

// ─────────────────────────────────────────────────────────────────
// Filter items by role
// ─────────────────────────────────────────────────────────────────
function getVisibleItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles) return true; // no restriction = visible to all
    return item.roles.includes(role);
  });
}

// ─────────────────────────────────────────────────────────────────
// Group items
// ─────────────────────────────────────────────────────────────────
function groupItems(items: NavItem[]) {
  const groups: Record<string, NavItem[]> = {};
  for (const item of items) {
    const g = item.group ?? 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant, user, clearAuth, refreshToken } = useAuthStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: modulesRes } = useQuery({
    queryKey: ['tenant-modules'],
    queryFn: () => tenantApi.getModules(),
    staleTime: 5 * 60 * 1000,
  });

  const enabledModules: Record<string, boolean> = Object.fromEntries(
    ((modulesRes?.data?.data ?? []) as { flag: string; enabled: boolean }[])
      .map((m) => [m.flag, m.enabled])
  );
  // Default restaurant to true while loading (avoids flash of hidden nav)
  const restaurantEnabled = 'restaurant_module' in enabledModules
    ? enabledModules['restaurant_module']
    : true;

  const role = (user?.role ?? 'STAFF') as Role;
  const roleConfig = ROLE_LABELS[role] ?? ROLE_LABELS.STAFF;
  const visibleItems = getVisibleItems(role).filter((item) => {
    if (!restaurantEnabled && item.group === 'Restaurant') return false;
    return true;
  });
  const grouped = groupItems(visibleItems);

  const handleLogout = async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clearAuth();
    router.push('/auth/login');
  };

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-resort-700 font-display text-lg font-bold text-gold-400">
          R
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {tenant?.name || 'ResortPro'}
          </p>
          <p className="text-xs text-gray-400 capitalize">
            {tenant?.plan?.toLowerCase() || 'free'} plan
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
        {Object.entries(grouped).map(([group, items]) => {
          const isCollapsed = collapsed[group];
          return (
            <div key={group} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center justify-between px-4 py-1.5 text-left"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {group}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-gray-300 transition-transform',
                    isCollapsed && '-rotate-90',
                  )}
                />
              </button>

              {/* Group items */}
              {!isCollapsed && (
                <ul className="space-y-0.5 px-3 pb-1">
                  {items.map(({ href, label, icon: Icon }) => {
                    const active =
                      pathname === href ||
                      (href !== '/dashboard' && pathname.startsWith(href));
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
              )}
            </div>
          );
        })}
      </nav>

      {/* Help link */}
      <div className="px-3 pb-2">
        <Link
          href="/docs"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <LifeBuoy className="h-4 w-4 shrink-0" />
          Help & Docs
        </Link>
      </div>

      {/* User footer */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/profile" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-resort-100 text-xs font-bold text-resort-700 transition-opacity hover:opacity-80 dark:bg-resort-900 dark:text-resort-300">
            {user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'}
          </Link>
          <Link href="/dashboard/profile" className="min-w-0 flex-1 group">
            <p className="truncate text-sm font-medium text-gray-900 group-hover:text-[#1a6b5e] dark:text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                roleConfig.color,
              )}
            >
              {roleConfig.label}
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BedDouble, CalendarDays, Users, UserCog,
  Sparkles, ClipboardList, UtensilsCrossed, ShoppingBag,
  Package, Ticket, Globe, Bell, Settings, LogOut, Mail,
  CreditCard, BarChart2, LayoutGrid, Tags, Wrench, FileBarChart2,
  Gift, UsersRound, Star, Link2, Receipt, ChevronDown, LifeBuoy, FileText, Megaphone, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { authApi, tenantApi } from '@/lib/api';
import { useAiStatus } from '@/hooks/use-ai-status';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { Locale } from '@/i18n/config';

// ─────────────────────────────────────────────────────────────────
// Role type
// ─────────────────────────────────────────────────────────────────
type Role = 'OWNER' | 'MANAGER' | 'SHAREHOLDER' | 'RECEPTIONIST' | 'MARKETER' | 'DEVELOPER' | 'STAFF' | 'CHEF' | 'GUEST';

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
  CHEF:         { label: 'Chef',         color: 'bg-red-100 text-red-700' },
  GUEST:        { label: 'Guest',        color: 'bg-gray-100 text-gray-500' },
};

// ─────────────────────────────────────────────────────────────────
// Nav items with role permissions
// roles: undefined = visible to ALL roles
// roles: [...] = ONLY these roles can see it
// ─────────────────────────────────────────────────────────────────
export type NavItem = {
  href: string;
  labelKey: string;         // translation key
  labelFallback: string;    // English fallback
  icon: React.ElementType;
  group: string;
  groupKey: string;         // translation key for group
  roles?: Role[];
  aiFeature?: 'ai_content' | 'ai_chatbot' | 'ai_business_insights'; // hide unless this AI feature is live
};

export const NAV_ITEMS: NavItem[] = [
  // ── Overview ──────────────────────────────────────────────
  { href: '/dashboard',            labelKey: 'nav.dashboard',    labelFallback: 'Dashboard',       icon: LayoutDashboard, group: 'Overview',         groupKey: 'groups.overview' },
  { href: '/dashboard/analytics',  labelKey: 'nav.analytics',    labelFallback: 'Analytics',       icon: BarChart2,       group: 'Overview',         groupKey: 'groups.overview',
    roles: ['OWNER', 'MANAGER', 'SHAREHOLDER', 'MARKETER'] },
  { href: '/dashboard/invoices',   labelKey: 'nav.invoices',     labelFallback: 'Invoices',        icon: FileText,        group: 'Overview',         groupKey: 'groups.overview',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/expenses',   labelKey: 'nav.expenses',     labelFallback: 'Expenses',        icon: Receipt,         group: 'Overview',         groupKey: 'groups.overview',
    roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/reports',    labelKey: 'nav.reports',      labelFallback: 'Daily Reports',   icon: FileBarChart2,   group: 'Overview',         groupKey: 'groups.overview',
    roles: ['OWNER', 'MANAGER'] },

  // ── Rooms & Bookings ──────────────────────────────────────
  { href: '/dashboard/properties',      labelKey: 'nav.properties',    labelFallback: 'Properties',       icon: Building2,     group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/rooms',          labelKey: 'nav.rooms',         labelFallback: 'Rooms & Villas',   icon: BedDouble,     group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/rate-plans',     labelKey: 'nav.ratePlans',     labelFallback: 'Rate Plans',       icon: Tags,          group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/packages',       labelKey: 'nav.packages',      labelFallback: 'Packages',         icon: Gift,          group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { href: '/dashboard/front-desk',     labelKey: 'nav.frontDesk',     labelFallback: 'Front Desk',       icon: ClipboardList, group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/bookings',       labelKey: 'nav.bookings',      labelFallback: 'Bookings',         icon: CalendarDays,  group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/calendar',       labelKey: 'nav.calendar',      labelFallback: 'Booking Calendar', icon: LayoutGrid,    group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/group-bookings', labelKey: 'nav.groupBookings', labelFallback: 'Group Bookings',   icon: UsersRound,    group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/dashboard/channels',       labelKey: 'nav.channels',      labelFallback: 'Channel Sync',     icon: Link2,         group: 'Rooms & Bookings', groupKey: 'groups.rooms',
    roles: ['OWNER', 'MANAGER', 'DEVELOPER'] },

  // ── Guests ────────────────────────────────────────────────
  { href: '/dashboard/guests',   labelKey: 'nav.guests',  labelFallback: 'Guests',          icon: Users,  group: 'Guests', groupKey: 'groups.guests',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { href: '/dashboard/loyalty',  labelKey: 'nav.loyalty', labelFallback: 'Loyalty Program', icon: Star,   group: 'Guests', groupKey: 'groups.guests',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { href: '/dashboard/support',  labelKey: 'nav.support', labelFallback: 'Support',         icon: Ticket, group: 'Guests', groupKey: 'groups.guests',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },

  // ── Operations ────────────────────────────────────────────
  { href: '/dashboard/staff',        labelKey: 'nav.staff',        labelFallback: 'Staff',        icon: UserCog, group: 'Operations', groupKey: 'groups.operations',
    roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/housekeeping', labelKey: 'nav.housekeeping', labelFallback: 'Housekeeping', icon: Sparkles, group: 'Operations', groupKey: 'groups.operations',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'STAFF'] },
  { href: '/dashboard/maintenance',  labelKey: 'nav.maintenance',  labelFallback: 'Maintenance',  icon: Wrench,   group: 'Operations', groupKey: 'groups.operations',
    roles: ['OWNER', 'MANAGER'] },

  // ── Restaurant ────────────────────────────────────────────
  { href: '/dashboard/restaurant', labelKey: 'nav.restaurant', labelFallback: 'Restaurant', icon: UtensilsCrossed, group: 'Restaurant', groupKey: 'groups.restaurant',
    roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/orders',     labelKey: 'nav.orders',     labelFallback: 'F&B Orders', icon: ShoppingBag,     group: 'Restaurant', groupKey: 'groups.restaurant',
    roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'CHEF'] },
  { href: '/dashboard/restaurant/tables', labelKey: 'nav.tables', labelFallback: 'Tables',    icon: LayoutGrid,      group: 'Restaurant', groupKey: 'groups.restaurant',
    roles: ['OWNER', 'MANAGER'] },
  { href: '/dashboard/inventory',  labelKey: 'nav.inventory',  labelFallback: 'Inventory',  icon: Package,         group: 'Restaurant', groupKey: 'groups.restaurant',
    roles: ['OWNER', 'MANAGER'] },

  // ── Marketing ─────────────────────────────────────────────
  { href: '/dashboard/offers',    labelKey: 'nav.offers',    labelFallback: 'Offers',       icon: Ticket,   group: 'Marketing', groupKey: 'groups.marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/crm',       labelKey: 'nav.crm',       labelFallback: 'CRM & Email',  icon: Mail,     group: 'Marketing', groupKey: 'groups.marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/marketing', labelKey: 'nav.marketing', labelFallback: 'SMS Marketing', icon: Megaphone, group: 'Marketing', groupKey: 'groups.marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER'] },
  { href: '/dashboard/website',   labelKey: 'nav.website',   labelFallback: 'Website',      icon: Globe,    group: 'Marketing', groupKey: 'groups.marketing',
    roles: ['OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'] },
  { href: '/dashboard/ai-content', labelKey: 'nav.aiContent', labelFallback: 'AI Content',   icon: Sparkles, group: 'Marketing', groupKey: 'groups.marketing',
    roles: ['OWNER', 'MANAGER'], aiFeature: 'ai_content' },

  // ── Account ───────────────────────────────────────────────
  { href: '/dashboard/billing',   labelKey: 'nav.billing',   labelFallback: 'Billing',             icon: CreditCard,  group: 'Account', groupKey: 'groups.account',
    roles: ['OWNER'] },
  { href: '/dashboard/referrals', labelKey: 'nav.referrals', labelFallback: 'Referrals',            icon: Gift,        group: 'Account', groupKey: 'groups.account',
    roles: ['OWNER'] },
  { href: '/dashboard/settings',  labelKey: 'nav.settings',  labelFallback: 'Settings',             icon: Settings,    group: 'Account', groupKey: 'groups.account',
    roles: ['OWNER', 'MANAGER', 'DEVELOPER'] },
];

// ─────────────────────────────────────────────────────────────────
// Filter items by role
// ─────────────────────────────────────────────────────────────────
export function getVisibleItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles) return true; // no restriction = visible to all
    return item.roles.includes(role);
  });
}

// ─────────────────────────────────────────────────────────────────
// Group items
// ─────────────────────────────────────────────────────────────────
export function groupItems(items: NavItem[]) {
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
  const { tenant, user, clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = useTranslations('common') as (key: string, ...args: any[]) => string;
  const locale = useLocale() as Locale;

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

  const { status: aiStatus } = useAiStatus();

  const role = (user?.role ?? 'STAFF') as Role;
  const roleConfig = ROLE_LABELS[role] ?? ROLE_LABELS.STAFF;
  const visibleItems = getVisibleItems(role).filter((item) => {
    if (!restaurantEnabled && item.group === 'Restaurant') return false;
    // AI nav items hide unless that AI feature is live (master switch + tenant flag)
    if (item.aiFeature && !aiStatus[item.aiFeature]) return false;
    return true;
  });
  const grouped = groupItems(visibleItems);

  const handleLogout = async () => {
    const isDemo = !!tenant?.isDemo;
    await authApi.logout().catch(() => {});
    clearAuth();
    router.push(isDemo ? '/try' : '/auth/login');
  };

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <aside className="flex h-full w-60 flex-col bg-[#1b342f]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-white/[0.07] px-[18px]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-resort-600">
          <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-gold-500" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[14px] font-medium text-[#ece7df]">
            {tenant?.name || 'ResortPro'}
          </p>
          <p className="text-[10.5px] text-[#62847c] capitalize">
            {role === 'OWNER' ? `${tenant?.plan?.toLowerCase() || 'free'} plan` : roleConfig.label}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {Object.entries(grouped).map(([group, items]) => {
          const isCollapsed = collapsed[group];
          const groupKey = items[0]?.groupKey;
          const groupLabel: string = groupKey ? t(groupKey) : group;
          return (
            <div key={group} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center justify-between px-4 py-1.5 text-left"
              >
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#4a6e66]">
                  {groupLabel}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-[#7f938e] transition-transform',
                    isCollapsed && '-rotate-90',
                  )}
                />
              </button>

              {/* Group items */}
              {!isCollapsed && (
                <ul className="space-y-0.5 px-2 pb-1">
                  {items.map(({ href, labelKey, labelFallback, icon: Icon }) => {
                    // next-intl returns the namespaced key itself when missing —
                    // detect that and fall back to the English label instead.
                    const translated: string = t(labelKey);
                    const label: string = translated.endsWith(labelKey) ? labelFallback : translated;
                    const active =
                      pathname === href ||
                      (href !== '/dashboard' && pathname.startsWith(href));
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-r-lg py-[7px] pl-3 pr-3 text-[13.5px] font-medium transition-colors',
                            active
                              ? 'border-l-2 border-gold-500 bg-white/[0.08] pl-[10px] text-[#ece7df] font-medium'
                              : 'border-l-2 border-transparent text-[#9bbdb7] font-normal hover:bg-white/5 hover:text-[#ece7df]',
                          )}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#ece7df]' : 'text-[#6a9990]'}`} />
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

      {/* Help link + Language switcher */}
      <div className="px-2 pb-2 space-y-0.5">
        <Link
          href="/docs"
          target="_blank"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-normal text-[#9bbdb7] transition-colors hover:bg-white/5 hover:text-[#ece7df]"
        >
          <LifeBuoy className="h-4 w-4 shrink-0 opacity-80" />
          {t('helpDocs')}
        </Link>
        <div className="px-1">
          <LanguageSwitcher currentLocale={locale} variant="dropdown" theme="dark" className="w-full" />
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-white/[0.07] p-3">
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/profile" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-resort-600 text-xs font-bold text-white transition-opacity hover:opacity-80">
            {user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'}
          </Link>
          <Link href="/dashboard/profile" className="min-w-0 flex-1 group">
            <p className="truncate text-[13px] font-medium text-[#ece7df] group-hover:text-gold-400 transition-colors">
              {user ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            {role === 'OWNER' ? (
              <span className="text-[11px] text-[#8fa8a1] truncate">
                {tenant?.plan?.toLowerCase() || 'free'} plan
              </span>
            ) : (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  roleConfig.color,
                )}
              >
                {roleConfig.label}
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="text-[#8fa8a1] transition-colors hover:text-white"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

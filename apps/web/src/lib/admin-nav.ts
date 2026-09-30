/**
 * Which admin destinations each role can actually use.
 *
 * The panel used to render one unfiltered list and label every account "Super
 * Admin", so a SUPPORT or FINANCE user saw all eighteen links, clicked one, and
 * got a blank dashboard where the API had answered 403 (release-readiness
 * review M-01). The menu was describing permissions nobody had.
 *
 * **The API is the authority, not this file.** Every route in
 * `apps/api/src/routes/admin.ts` carries its own `requireAdminRole([...])`, and
 * that is what actually stops anything. What is here is the same answer at the
 * level of a page, so the menu stops offering doors that are locked. Nothing
 * here grants access; it only decides what is worth showing.
 *
 * The `roles` on each item were read off those route guards. When a guard
 * changes, this changes with it.
 */
import {
  LayoutDashboard, Building2, Users, CreditCard, Settings, Palette, ClipboardList,
  Download, Gift, UserCog, Megaphone, ShieldCheck, Activity, Star, Globe, HardDrive,
  Sparkles, Mail, Lock, type LucideIcon,
} from 'lucide-react';
import type { AdminRole } from '@/store/admin';

export const ALL_ADMIN_ROLES: AdminRole[] = ['SUPER_ADMIN', 'SUPPORT', 'FINANCE', 'VIEWER'];

/** What the badge and the account area should say. */
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT: 'Support',
  FINANCE: 'Finance',
  VIEWER: 'Viewer',
};

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles whose API access makes this page usable. */
  roles: AdminRole[];
}

const EVERY_ADMIN = ALL_ADMIN_ROLES;
const OWNER_ONLY: AdminRole[] = ['SUPER_ADMIN'];
const MONEY: AdminRole[] = ['SUPER_ADMIN', 'FINANCE'];
const CASEWORK: AdminRole[] = ['SUPER_ADMIN', 'SUPPORT'];

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin/dashboard',       label: 'Overview',         icon: LayoutDashboard, roles: EVERY_ADMIN },
  { href: '/admin/tenants',         label: 'Tenants',          icon: Building2,       roles: EVERY_ADMIN },
  { href: '/admin/users',           label: 'Users',            icon: Users,           roles: EVERY_ADMIN },
  { href: '/admin/billing',         label: 'Billing & MRR',    icon: CreditCard,      roles: MONEY },
  { href: '/admin/themes',          label: 'Themes',           icon: Palette,         roles: EVERY_ADMIN },
  { href: '/admin/design-requests', label: 'Design Requests',  icon: Sparkles,        roles: EVERY_ADMIN },
  { href: '/admin/demo-leads',      label: 'Demo Leads',       icon: Mail,            roles: EVERY_ADMIN },
  { href: '/admin/audit-log',       label: 'Audit Log',        icon: ClipboardList,   roles: CASEWORK },
  { href: '/admin/export',          label: 'Export',           icon: Download,        roles: MONEY },
  { href: '/admin/referrals',       label: 'Referrals',        icon: Gift,            roles: EVERY_ADMIN },
  { href: '/admin/team',            label: 'Team',             icon: UserCog,         roles: OWNER_ONLY },
  { href: '/admin/announcements',   label: 'Announcements',    icon: Megaphone,       roles: EVERY_ADMIN },
  { href: '/admin/gdpr',            label: 'GDPR',             icon: ShieldCheck,     roles: OWNER_ONLY },
  { href: '/admin/enterprise',      label: 'Enterprise',       icon: Star,            roles: EVERY_ADMIN },
  { href: '/admin/domains',         label: 'Domains',          icon: Globe,           roles: EVERY_ADMIN },
  { href: '/admin/health',          label: 'Health',           icon: Activity,        roles: EVERY_ADMIN },
  { href: '/admin/storage',         label: 'Storage',          icon: HardDrive,       roles: OWNER_ONLY },
  { href: '/admin/settings',        label: 'Settings',         icon: Settings,        roles: OWNER_ONLY },
  // Every role, unlike the rest of this list: it manages your own sign-in, not
  // the platform's. A Viewer still needs somewhere to turn on two-factor.
  { href: '/admin/security',        label: 'Security',         icon: Lock,            roles: EVERY_ADMIN },
];

/**
 * A signed-in admin with no role in the token sees nothing rather than
 * everything — the safer direction when a token is older than this code.
 */
export function navFor(role: AdminRole | null): AdminNavItem[] {
  if (!role) return [];
  return ADMIN_NAV.filter((item) => item.roles.includes(role));
}

/**
 * Whether a path is one this role may open. Unknown admin paths are allowed:
 * a page nobody listed here is not a page this file should be able to hide,
 * and the API still answers for itself.
 */
export function canOpen(role: AdminRole | null, pathname: string): boolean {
  const item = ADMIN_NAV.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  if (!item) return true;
  return !!role && item.roles.includes(role);
}

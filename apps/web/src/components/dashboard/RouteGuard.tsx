'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { NAV_ITEMS, type NavItem, type Role } from '@/components/dashboard/sidebar';

/**
 * A dashboard URL the current role may not use should say so.
 *
 * The sidebar hides what a role cannot reach, but typing the URL was never
 * guarded. The APIs answered 403 correctly and the page still returned 200 and
 * rendered its shell — so a receptionist who opened /dashboard/staff saw the
 * Staff page with nothing in it, and a marketer on /dashboard/bookings saw an
 * empty Bookings screen. Neither looks like a permission boundary; both look
 * like the product is broken.
 *
 * reports/qa/2026-09-09-dashboard-sidebar-comprehensive-qa.md, Major:
 * "restricted direct URLs render broken pages instead of a clear access-denied
 * state", observed for Shareholder, Receptionist, Marketer, Staff and Chef.
 *
 * The rule is read from NAV_ITEMS rather than restated here. That table already
 * decides who sees each destination in the sidebar, so a page cannot be hidden
 * from a role in one place and left open in the other.
 *
 * This is a UX boundary, not the security one — the API is that, and it
 * answered 403 throughout. So an unrecognised URL is allowed through: guessing
 * at a page nav does not describe would break working routes to no benefit,
 * while the API keeps refusing the data either way.
 */

/** The nav entry that owns this URL — the longest href that matches it. */
export function navItemForPath(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    // Whole segments only: '/dashboard/rooms' must not claim
    // '/dashboard/rooms-archive', while '/dashboard/invoices/new' is correctly
    // claimed by '/dashboard/invoices'.
    const owns = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!owns) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}

export function isRoleAllowed(pathname: string, role: Role): boolean {
  const item = navItemForPath(pathname);
  if (!item) return true;          // not a destination nav knows about
  if (!item.roles) return true;    // no restriction declared = open to all
  return item.roles.includes(role);
}

function AccessDenied({ role }: { role: Role }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-md rounded-rp-card border border-rp-border bg-rp-surface p-8 text-center shadow-rp-card"
    >
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-rp-muted" aria-hidden="true" />
      <h1 className="text-rp-heading font-semibold text-rp-text">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-rp-body text-rp-muted">
        Your account is signed in as {role.toLowerCase()}, and this page is limited to other roles.
        If you need it, ask the resort owner to change your role.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-block rounded-rp-card bg-rp-brand px-4 py-2 text-rp-body font-semibold text-white hover:opacity-90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const role = (user?.role ?? 'STAFF') as Role;

  // The dashboard layout renders a spinner until the auth store has rehydrated
  // and returns null when nobody is signed in, so by the time this runs `role`
  // is the real one — no flash of refusal for a user who is in fact allowed.
  if (!isRoleAllowed(pathname ?? '', role)) return <AccessDenied role={role} />;

  return <>{children}</>;
}

/**
 * Typing a URL your role cannot use should say so, not look broken.
 *
 * The five rows in the "restricted direct URLs render broken pages" table of
 * reports/qa/2026-09-09-dashboard-sidebar-comprehensive-qa.md are the cases
 * below. In each the API already answered 403; what was missing was any sign
 * to the person looking at the screen.
 *
 * The expectations are deliberately not restated from the QA report as literal
 * role lists — they read the real NAV_ITEMS, so if a destination's roles change
 * the guard and the sidebar move together or this fails.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let pathname = '/dashboard';
let role = 'OWNER';

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ user: { role } }) }));
vi.mock('@/lib/api', () => ({ authApi: {}, tenantApi: {}, dashboardApi: {}, api: { get: vi.fn() } }));

import { RouteGuard, isRoleAllowed, navItemForPath } from './RouteGuard';

function visit(at: string, as: string) {
  pathname = at;
  role = as;
  render(<RouteGuard><p>the page itself</p></RouteGuard>);
}

const denied = () => screen.queryByText('the page itself') === null;

afterEach(cleanup);

describe('the five roles the QA audit caught seeing an empty shell', () => {
  const cases: [string, string][] = [
    ['SHAREHOLDER',  '/dashboard/expenses'],
    ['RECEPTIONIST', '/dashboard/staff'],
    ['MARKETER',     '/dashboard/bookings'],
    ['STAFF',        '/dashboard/settings'],
    ['CHEF',         '/dashboard/guests'],
  ];

  for (const [as, at] of cases) {
    it(`${as} typing ${at} is told why, and does not get the page`, () => {
      visit(at, as);
      expect(denied()).toBe(true);
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/don't have access/i)).toBeTruthy();
    });
  }
});

describe('the people who are allowed', () => {
  it('an owner gets the page, not the refusal', () => {
    visit('/dashboard/staff', 'OWNER');
    expect(screen.getByText('the page itself')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a receptionist still gets bookings, which is theirs', () => {
    visit('/dashboard/bookings', 'RECEPTIONIST');
    expect(screen.getByText('the page itself')).toBeTruthy();
  });

  it('a page with no declared roles is open to everyone', () => {
    visit('/dashboard', 'CHEF');
    expect(screen.getByText('the page itself')).toBeTruthy();
  });
});

describe('which nav entry owns a URL', () => {
  it('a child route inherits its parent destination', () => {
    // /dashboard/invoices/new has no nav entry of its own.
    expect(navItemForPath('/dashboard/invoices/new')?.href).toBe('/dashboard/invoices');
    expect(isRoleAllowed('/dashboard/invoices/new', 'CHEF')).toBe(false);
    expect(isRoleAllowed('/dashboard/invoices/new', 'RECEPTIONIST')).toBe(true);
  });

  it('matches whole segments, so a longer name is not swallowed', () => {
    // Guarding on a bare startsWith would hand this to /dashboard/rooms.
    expect(navItemForPath('/dashboard/rooms-archive')?.href).toBe('/dashboard');
  });

  it('prefers the most specific entry when several could match', () => {
    expect(navItemForPath('/dashboard/staff')?.href).toBe('/dashboard/staff');
  });

  it('lets an unrecognised dashboard URL through rather than guessing', () => {
    // The API is the security boundary and still refuses; refusing here too
    // would break working pages that nav does not list.
    expect(isRoleAllowed('/dashboard/upgrade', 'STAFF')).toBe(true);
    expect(isRoleAllowed('/dashboard/suspended', 'CHEF')).toBe(true);
  });
});

/**
 * The admin menu offers only doors that open.
 *
 * SUPPORT, FINANCE and VIEWER each saw all eighteen links and every one of them
 * was labelled "Super Admin"; clicking a restricted one produced a blank panel
 * where the API had answered 403 (release-readiness review M-01).
 *
 * These lock down the shape of the answer, not the styling: what each role is
 * offered, that the offer matches what it is allowed to open, and that an
 * unknown role is shown nothing rather than everything.
 */
import { describe, it, expect } from 'vitest';
import { navFor, canOpen, ADMIN_NAV, ADMIN_ROLE_LABEL, ALL_ADMIN_ROLES } from './admin-nav';

describe('the menu each role is offered', () => {
  it('gives a Super Admin everything', () => {
    expect(navFor('SUPER_ADMIN')).toHaveLength(ADMIN_NAV.length);
  });

  it.each([
    ['SUPPORT', ['/admin/billing', '/admin/export', '/admin/team', '/admin/gdpr', '/admin/storage', '/admin/settings']],
    ['FINANCE', ['/admin/audit-log', '/admin/team', '/admin/gdpr', '/admin/storage', '/admin/settings']],
    ['VIEWER', ['/admin/billing', '/admin/export', '/admin/audit-log', '/admin/team', '/admin/gdpr', '/admin/storage', '/admin/settings']],
  ] as const)('does not offer %s what the API refuses it', (role, withheld) => {
    const offered = navFor(role).map((i) => i.href);
    for (const href of withheld) expect(offered).not.toContain(href);
    // and it is not simply empty
    expect(offered).toContain('/admin/tenants');
  });

  it('shows nothing at all when the token carries no role', () => {
    expect(navFor(null)).toEqual([]);
  });
});

describe('what a role may open', () => {
  it('agrees with what it was offered, for every role and every page', () => {
    for (const role of ALL_ADMIN_ROLES) {
      const offered = new Set(navFor(role).map((i) => i.href));
      for (const item of ADMIN_NAV) {
        expect(canOpen(role, item.href)).toBe(offered.has(item.href));
      }
    }
  });

  it('covers a page below a destination, not just the destination', () => {
    expect(canOpen('VIEWER', '/admin/settings/anything')).toBe(false);
    expect(canOpen('VIEWER', '/admin/tenants/some-id')).toBe(true);
  });

  it('leaves an admin page nobody listed to the API to answer for', () => {
    expect(canOpen('VIEWER', '/admin/something-added-later')).toBe(true);
  });

  it('refuses everything to a signed-in admin with no role', () => {
    expect(canOpen(null, '/admin/tenants')).toBe(false);
  });
});

describe('what the panel calls the person', () => {
  it('has a name for every role, and not the same one', () => {
    const labels = ALL_ADMIN_ROLES.map((r) => ADMIN_ROLE_LABEL[r]);
    expect(new Set(labels).size).toBe(ALL_ADMIN_ROLES.length);
    expect(ADMIN_ROLE_LABEL.VIEWER).not.toBe('Super Admin');
  });
});

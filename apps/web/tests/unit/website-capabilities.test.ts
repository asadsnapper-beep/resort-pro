/**
 * The role→capability map, against the API's own gates.
 *
 * The builder showed every control to everyone who could open it. A Marketer
 * saw the Custom Domain tab and the Custom Design request; a Manager saw a
 * writable domain form. All of those answer 403.
 * (Website Builder QA 2026-10-28, WB-007.)
 *
 * These assertions are written role by role, naming the route each one
 * mirrors, so that a change to an API `preHandler` has an obvious counterpart
 * here. If the two drift, this file is the wrong one — the server is the
 * authority.
 */
import { describe, it, expect } from 'vitest';
import { websiteCapabilities } from '@/lib/website-capabilities';

describe('OWNER', () => {
  const c = websiteCapabilities('OWNER');
  it('may do everything the builder offers', () => {
    expect(c).toEqual({
      editContent: true, viewDomain: true, editDomain: true, requestCustomDesign: true,
    });
  });
});

describe('MANAGER', () => {
  const c = websiteCapabilities('MANAGER');

  it('may edit the website content — PUT /website allows MANAGER', () => {
    expect(c.editContent).toBe(true);
  });

  it('may see the domain — GET /tenant allows MANAGER', () => {
    expect(c.viewDomain).toBe(true);
  });

  it('may NOT change the domain — PUT /tenant/domain is OWNER-only', () => {
    // The old page gave managers a writable form that 403s on save.
    expect(c.editDomain).toBe(false);
  });

  it('may ask for a custom design — POST /design-requests allows MANAGER', () => {
    expect(c.requestCustomDesign).toBe(true);
  });
});

describe.each(['MARKETER', 'DEVELOPER'] as const)('%s', role => {
  const c = websiteCapabilities(role);

  it('may edit the website content — that is the job', () => {
    expect(c.editContent).toBe(true);
  });

  it('may not see the domain tab at all — GET /tenant is OWNER/MANAGER', () => {
    expect(c.viewDomain).toBe(false);
    expect(c.editDomain).toBe(false);
  });

  it('may not request a custom design — POST /design-requests is OWNER/MANAGER', () => {
    expect(c.requestCustomDesign).toBe(false);
  });
});

describe('roles that cannot open the builder at all', () => {
  // The sidebar already keeps them out; this is the belt to that braces, and
  // guards against the map being reused somewhere less careful.
  it.each(['RECEPTIONIST', 'STAFF', 'CHEF', 'SHAREHOLDER', 'GUEST'] as const)('%s has nothing', role => {
    expect(websiteCapabilities(role)).toEqual({
      editContent: false, viewDomain: false, editDomain: false, requestCustomDesign: false,
    });
  });
});

describe('an unknown role', () => {
  it('gets nothing rather than everything', () => {
    // The auth store is briefly empty on a cold load. Defaulting the other way
    // would flash the owner-only controls at every role.
    for (const role of [null, undefined]) {
      expect(websiteCapabilities(role)).toEqual({
        editContent: false, viewDomain: false, editDomain: false, requestCustomDesign: false,
      });
    }
  });

  it('does not throw on a role the type does not know', () => {
    expect(() => websiteCapabilities('SOMETHING_NEW' as never)).not.toThrow();
    expect(websiteCapabilities('SOMETHING_NEW' as never).editContent).toBe(false);
  });
});

describe('editDomain never exceeds viewDomain', () => {
  it('holds for every role', () => {
    // A role that may write but not read would render a form with no state.
    const roles = ['OWNER', 'MANAGER', 'SHAREHOLDER', 'RECEPTIONIST',
                   'MARKETER', 'DEVELOPER', 'STAFF', 'CHEF', 'GUEST'] as const;
    for (const role of roles) {
      const c = websiteCapabilities(role);
      expect(!c.editDomain || c.viewDomain).toBe(true);
    }
  });
});

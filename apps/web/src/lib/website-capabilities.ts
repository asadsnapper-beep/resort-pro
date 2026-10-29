/**
 * What each role may actually do in the Website Builder.
 *
 * The page used to show every control to everyone who could open it, while the
 * API refused several of them by role — a Marketer saw the Custom Domain tab
 * and the Custom Design request, and a Manager saw a writable domain form, all
 * of which answer 403. (Website Builder QA 2026-10-28, WB-007.)
 *
 * These lists mirror the API's own `preHandler`s, which stay the authority:
 *
 *   GET/PUT /website              OWNER, MANAGER, MARKETER, DEVELOPER
 *   GET     /tenant               OWNER, MANAGER
 *   GET     /tenant/domain/status OWNER, MANAGER
 *   PUT     /tenant/domain        OWNER            + requireFlag('custom_domain')
 *   POST    /tenant/domain/verify OWNER            + requireFlag('custom_domain')
 *   GET/POST /design-requests     OWNER, MANAGER
 *
 * Hiding a control is not a security boundary and is not treated as one here.
 * The server refuses the same calls whatever this file says; the point is to
 * stop offering work that cannot be done.
 *
 * `custom_domain` is deliberately NOT mirrored. The gate that runs reads
 * `resolveTenantEntitlement`, which is the plan's flag list plus per-tenant
 * overrides, while `GET /tenant/flags` reports feature-flag rows plus registry
 * defaults and never looks at the plan. `custom_domain` is `defaultOn: false`,
 * so a paying tenant whose plan grants it has no row and is absent from that
 * endpoint. Gating the UI on it would hide the domain form from the owners
 * most entitled to use it. An owner without the entitlement still gets the
 * designed path: the API answers 403 `upgradeRequired` and the axios
 * interceptor routes them to the upgrade page.
 */
import type { UserRole } from '@resort-pro/types';

export interface WebsiteCapabilities {
  /** Read and save the website content itself. */
  editContent: boolean;
  /** See the Custom Domain tab at all — it reads the tenant record. */
  viewDomain: boolean;
  /** Connect, remove or verify a domain. */
  editDomain: boolean;
  /** Ask for a paid custom design. */
  requestCustomDesign: boolean;
}

const CONTENT_ROLES:  UserRole[] = ['OWNER', 'MANAGER', 'MARKETER', 'DEVELOPER'];
const TENANT_ROLES:   UserRole[] = ['OWNER', 'MANAGER'];
const DOMAIN_WRITERS: UserRole[] = ['OWNER'];

/**
 * A missing role is treated as no capability rather than full capability. The
 * auth store is empty for a moment on a cold load, and defaulting the other way
 * would flash the owner-only controls at everyone.
 */
export function websiteCapabilities(role: UserRole | null | undefined): WebsiteCapabilities {
  if (!role) {
    return { editContent: false, viewDomain: false, editDomain: false, requestCustomDesign: false };
  }
  return {
    editContent:         CONTENT_ROLES.includes(role),
    viewDomain:          TENANT_ROLES.includes(role),
    editDomain:          DOMAIN_WRITERS.includes(role),
    requestCustomDesign: TENANT_ROLES.includes(role),
  };
}

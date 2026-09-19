/**
 * Connected resorts — the group layer.
 *
 * An owner with four resorts has four ResortPro accounts, each running exactly
 * as a single-resort account does. These routes are the only thing that knows
 * the four belong together: they let that owner switch between them and see
 * every resort's numbers on one page.
 *
 * Two things about this file are different from every other route module here,
 * and both are deliberate:
 *
 *  1. **It uses the global `prisma`, never `request.db`.** The tenant-scoped
 *     client exists to make cross-tenant reads impossible, which is exactly
 *     what this module has to do. So every query is written out with its own
 *     explicit scope, and the scope is always "the group this user owns".
 *
 *  2. **It authorises from the database, not from the token.** The JWT says
 *     which resort you are currently in; it says nothing about which other
 *     resorts you may see. That comes from `ResortGroup.ownerUserId`, read on
 *     every request.
 *
 * Design: plan/multi-resort.md
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import type { JwtPayload } from '@resort-pro/types';
import { requireAuth } from '../middleware/auth';
import { ok } from '../utils/response';

/** One resort as the dropdown and the 360 page need it. */
export interface GroupResort {
  tenantId: string;
  name: string;
  slug: string;
  access: 'FULL' | 'NUMBERS_ONLY';
  planStatus: string;
  isActive: boolean;
  /** Whether the dropdown may switch into it — `NUMBERS_ONLY` shows figures only. */
  canOpen: boolean;
  /** The resort this request was made from. */
  isCurrent: boolean;
}

export interface GroupView {
  id: string;
  name: string;
  resorts: GroupResort[];
  pendingRequests: {
    id: string;
    tenantName: string;
    tenantSlug: string;
    createdAt: Date;
    expiresAt: Date;
  }[];
}

/**
 * The group this user owns, or null.
 *
 * Null is the answer for almost everybody, and it has to stay cheap: every
 * dashboard load asks this question, and only an owner who has connected a
 * second resort has a row to find.
 */
export async function loadGroupForOwner(
  ownerUserId: string,
  currentTenantId: string,
): Promise<GroupView | null> {
  const group = await prisma.resortGroup.findFirst({
    where: { ownerUserId },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        include: {
          tenant: { select: { id: true, name: true, slug: true, planStatus: true, isActive: true } },
        },
      },
      requests: {
        where: { approvedAt: null, declinedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
        include: { tenant: { select: { name: true, slug: true } } },
      },
    },
  });
  if (!group) return null;

  return {
    id: group.id,
    name: group.name,
    resorts: group.members.map((m) => ({
      tenantId: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      access: m.access,
      planStatus: m.tenant.planStatus,
      isActive: m.tenant.isActive,
      canOpen: m.access === 'FULL' && m.tenant.isActive,
      isCurrent: m.tenant.id === currentTenantId,
    })),
    pendingRequests: group.requests.map((r) => ({
      id: r.id,
      tenantName: r.tenant.name,
      tenantSlug: r.tenant.slug,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    })),
  };
}

export async function resortGroupRoutes(app: FastifyInstance) {
  /* ── GET /api/resort-group ───────────────────────────────────────────────
   * The dropdown and the 360 nav item are drawn from this. It answers `null`
   * for an owner with one resort, which is what keeps their dashboard
   * byte-identical to what it is today.
   */
  app.get('/', {
    schema: {
      tags: ['resort-group'],
      summary: 'The group of connected resorts this user owns, or null',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request) => {
      const user = request.user as JwtPayload;
      return ok(await loadGroupForOwner(user.sub, user.tenantId));
    },
  });
}

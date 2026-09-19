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
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import type { JwtPayload } from '@resort-pro/types';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import { resortOverview, clearResortOverviewCache } from '../services/resort-overview';

/** A group of more than this many resorts would make the 360 page a 40-query load. */
const MAX_RESORTS_PER_GROUP = 20;

const linkSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

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

  /* ── POST /api/resort-group/links ────────────────────────────────────────
   * Connect a resort you already own — the one-click path.
   *
   * It only fires when the same **verified** email is an active owner of both
   * accounts. That is not a convenience shortcut around the approval step: an
   * address can only be an owner's login on either account after that address
   * received and clicked a verification link, so matching them proves the same
   * person holds both. Any other case has to be asked for, and that is phase 8.
   *
   * The order of the checks below is deliberate. Everything that could tell a
   * stranger whether a slug exists answers the same 404 as a slug that does
   * not exist; only once ownership is proven do the more specific refusals
   * appear.
   */
  app.post('/links', {
    schema: {
      tags: ['resort-group'],
      summary: 'Connect a resort registered to the same email',
      security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const body = validate(linkSchema, request.body, reply);
      if (!body) return;

      const me = await prisma.user.findUniqueOrThrow({
        where: { id: user.sub },
        select: { id: true, email: true, tenantId: true },
      });

      const target = await prisma.tenant.findUnique({
        where: { slug: body.slug },
        select: { id: true, name: true, isActive: true, isDemo: true, deletedAt: true },
      });
      const notFound = () => reply.status(404).send({
        success: false, error: 'No resort of yours is registered with that address.',
        code: 'RESORT_NOT_FOUND',
      });
      if (!target) return notFound();

      if (target.id === me.tenantId) {
        return reply.status(400).send({
          success: false, error: 'This is the resort you are already in.',
          code: 'SAME_RESORT',
        });
      }

      // Case-insensitively, because the two accounts were registered
      // separately and nothing forced the same spelling of the address.
      const owner = await prisma.user.findFirst({
        where: {
          tenantId: target.id,
          email: { equals: me.email, mode: 'insensitive' },
          role: 'OWNER',
          isActive: true,
          emailVerifiedAt: { not: null },
        },
        select: { id: true },
      });
      if (!owner) return notFound();

      if (target.isDemo || !target.isActive || target.deletedAt) {
        return reply.status(400).send({
          success: false, error: 'That resort cannot be connected right now.',
          code: 'RESORT_NOT_CONNECTABLE',
        });
      }

      const [targetMembership, myMembership] = await Promise.all([
        prisma.resortGroupTenant.findUnique({ where: { tenantId: target.id }, select: { groupId: true } }),
        prisma.resortGroupTenant.findUnique({ where: { tenantId: me.tenantId }, select: { groupId: true } }),
      ]);
      const myGroup = await prisma.resortGroup.findFirst({
        where: { ownerUserId: me.id },
        select: { id: true },
      });

      if (targetMembership && targetMembership.groupId !== myGroup?.id) {
        return reply.status(409).send({
          success: false, error: 'That resort is already connected to another account.',
          code: 'RESORT_ALREADY_CONNECTED',
        });
      }
      if (targetMembership) {
        return reply.status(409).send({
          success: false, error: 'That resort is already in your group.',
          code: 'RESORT_ALREADY_CONNECTED',
        });
      }
      // The resort you are standing in has to join the group as well, so the
      // dropdown always contains where you are. If it belongs to someone
      // else's group that is not possible, and saying so is the whole point.
      if (myMembership && myMembership.groupId !== myGroup?.id) {
        return reply.status(409).send({
          success: false, error: 'This resort is already connected to another account.',
          code: 'RESORT_ALREADY_CONNECTED',
        });
      }

      const currentCount = myGroup
        ? await prisma.resortGroupTenant.count({ where: { groupId: myGroup.id } })
        : 0;
      const joining = (myMembership ? 0 : 1) + 1;
      if (currentCount + joining > MAX_RESORTS_PER_GROUP) {
        return reply.status(400).send({
          success: false,
          error: `A group can hold ${MAX_RESORTS_PER_GROUP} resorts. Contact support if you need more.`,
          code: 'GROUP_LIMIT_REACHED',
        });
      }

      const home = await prisma.tenant.findUniqueOrThrow({
        where: { id: me.tenantId }, select: { name: true },
      });

      await prisma.$transaction(async (tx) => {
        const groupId = myGroup?.id ?? (await tx.resortGroup.create({
          data: { name: `${home.name} Group`, ownerUserId: me.id },
        })).id;

        if (!myMembership) {
          await tx.resortGroupTenant.create({
            data: { groupId, tenantId: me.tenantId, access: 'FULL', linkedUserId: me.id },
          });
        }
        await tx.resortGroupTenant.create({
          data: { groupId, tenantId: target.id, access: 'FULL', linkedUserId: owner.id },
        });
        await tx.resortGroupEvent.create({
          data: {
            groupId, tenantId: target.id, actorUserId: me.id, action: 'link_approved',
            metadata: { reason: 'same_verified_email', resortName: target.name },
          },
        });
      });

      clearResortOverviewCache();
      return ok(await loadGroupForOwner(me.id, me.tenantId), `${target.name} is connected.`);
    },
  });

  /* ── DELETE /api/resort-group/members/:tenantId ──────────────────────────
   * Disconnect a resort. Either side may do it: the person who built the
   * group, or the owner of the resort that is in it. Nobody should need to ask
   * permission to stop sharing their own numbers.
   *
   * Nothing is done to any user account here, and that is correct for every
   * connection this phase can create: a same-email link reuses the owner's own
   * login on the other resort, so deactivating it would lock a person out of an
   * account that is entirely theirs. Phase 8 introduces links that create a
   * user, and will record that it did so and deactivate exactly those.
   */
  app.delete('/members/:tenantId', {
    schema: {
      tags: ['resort-group'],
      summary: 'Disconnect a resort from its group',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const { tenantId } = request.params as { tenantId: string };

      const member = await prisma.resortGroupTenant.findUnique({
        where: { tenantId },
        include: { group: { select: { id: true, ownerUserId: true } } },
      });
      if (!member) {
        return reply.status(404).send({
          success: false, error: 'That resort is not connected.', code: 'RESORT_NOT_FOUND',
        });
      }

      const isGroupOwner = member.group.ownerUserId === user.sub;
      const isOwnResort = member.tenantId === user.tenantId;
      if (!isGroupOwner && !isOwnResort) {
        return reply.status(403).send({
          success: false, error: 'Only this resort\'s owner can disconnect it.',
          code: 'NOT_RESORT_OWNER',
        });
      }

      const groupId = member.group.id;
      await prisma.$transaction(async (tx) => {
        await tx.resortGroupTenant.delete({ where: { id: member.id } });
        await tx.resortGroupEvent.create({
          data: { groupId, tenantId, actorUserId: user.sub, action: 'unlinked' },
        });

        // A group of one resort is the same thing as no group at all. Clearing
        // it away means GET /api/resort-group goes back to answering null, and
        // the dashboard goes back to looking exactly as it did before any of
        // this existed. A group still waiting on an answer is left alone.
        const [remaining, waiting] = await Promise.all([
          tx.resortGroupTenant.count({ where: { groupId } }),
          tx.resortLinkRequest.count({
            where: { groupId, approvedAt: null, declinedAt: null, expiresAt: { gt: new Date() } },
          }),
        ]);
        if (remaining < 2 && waiting === 0) {
          await tx.resortGroup.delete({ where: { id: groupId } });
        }
      });

      // The 360 page caches for a minute. A resort that has just been
      // disconnected must not keep appearing on it for the rest of that minute.
      clearResortOverviewCache();
      return ok(await loadGroupForOwner(user.sub, user.tenantId), 'Resort disconnected.');
    },
  });

  /* ── GET /api/resort-group/overview ──────────────────────────────────────
   * Every connected resort's figures, side by side.
   *
   * Only the person who built the group may ask. A resort being a member of it
   * gives that resort's staff nothing — they never learn the group exists.
   *
   * It takes no parameters, on purpose. Half of these resorts may be shared as
   * figures only, and the cheapest way to keep that promise is to have nothing
   * here that could be asked to return more than a total.
   */
  app.get('/overview', {
    schema: {
      tags: ['resort-group'],
      summary: 'Figures for every connected resort',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const group = await prisma.resortGroup.findFirst({
        where: { ownerUserId: user.sub },
        select: { id: true, name: true },
      });
      if (!group) {
        return reply.status(404).send({
          success: false, error: 'You have no connected resorts.', code: 'NO_RESORT_GROUP',
        });
      }
      return ok(await resortOverview(group));
    },
  });
}

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
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@resort-pro/database';
import type { JwtPayload } from '@resort-pro/types';
import { requireAuth, requireRole } from '../middleware/auth';
import { ok, validate } from '../utils/response';
import { resortOverview, clearResortOverviewCache } from '../services/resort-overview';
import { sendEmail } from '../services/email';
import { webAppUrl } from '../utils/web-url';

/** A group of more than this many resorts would make the 360 page a 40-query load. */
const MAX_RESORTS_PER_GROUP = 20;

const linkSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

const approveSchema = z.object({
  access: z.enum(['FULL', 'NUMBERS_ONLY']),
});

/**
 * The account a connection is used through, creating one if this resort has
 * never made one for that person.
 *
 * Shared by approving a request and by raising an existing connection back to
 * full access, so both produce the same thing: a real user of this resort, with
 * a password nobody holds, reachable only by switching from the group that was
 * granted it.
 */
async function accountForConnection(tenantId: string, person: {
  email: string; firstName: string; lastName: string;
}): Promise<{ linkedUserId: string; linkedUserCreated: boolean }> {
  const existing = await prisma.user.findFirst({
    where: { tenantId, email: { equals: person.email, mode: 'insensitive' } },
    select: { id: true },
  });
  // Reused, and marked as not ours: this resort may have been using that
  // account for its own reasons long before any of this, and revoking a
  // connection must not switch it off.
  if (existing) return { linkedUserId: existing.id, linkedUserCreated: false };

  const unusable = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  const created = await prisma.user.create({
    data: {
      tenantId, email: person.email, passwordHash: unusable,
      firstName: person.firstName, lastName: person.lastName, role: 'OWNER',
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return { linkedUserId: created.id, linkedUserCreated: true };
}

/** A request stands for a week, then the asking has to be done again. */
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-asking faster than this is a stuck button, not a person. */
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * The owner a request should be sent to.
 *
 * The oldest verified, active owner — a resort can have more than one, and the
 * first one is the account's original owner.
 */
function resortOwner(tenantId: string) {
  return prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', isActive: true, emailVerifiedAt: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true },
  });
}

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
      if (!target) {
        return reply.status(404).send({
          success: false, error: 'No resort has that address.', code: 'RESORT_NOT_FOUND',
        });
      }

      if (target.id === me.tenantId) {
        return reply.status(400).send({
          success: false, error: 'This is the resort you are already in.',
          code: 'SAME_RESORT',
        });
      }

      if (target.isDemo || !target.isActive || target.deletedAt) {
        return reply.status(400).send({
          success: false, error: 'That resort cannot be connected right now.',
          code: 'RESORT_NOT_CONNECTABLE',
        });
      }

      // Case-insensitively, because the two accounts were registered
      // separately and nothing forced the same spelling of the address.
      //
      // Finding nothing here is not a refusal any more — it means the resort
      // belongs to somebody else, and the answer is to ask them. Until phase 8
      // this returned the same 404 as an unknown slug, to stop the endpoint
      // being used to enumerate resorts. That protection was worth nothing in
      // the end: every resort's slug is already public on its booking site and
      // on the discovery map. What is private is who owns one, and no reply
      // below reveals that.
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
        where: { id: me.tenantId },
        select: { name: true },
      });
      const meFull = await prisma.user.findUniqueOrThrow({
        where: { id: me.id }, select: { firstName: true, lastName: true },
      });

      // The group has to exist before a request can point at it, so it is
      // created either way — with this resort inside it, which is why the
      // dropdown and the 360 entry both wait for a *second* resort rather than
      // for a group.
      const groupId = myGroup?.id ?? (await prisma.resortGroup.create({
        data: { name: `${home.name} Group`, ownerUserId: me.id },
      })).id;
      if (!myMembership) {
        await prisma.resortGroupTenant.create({
          data: { groupId, tenantId: me.tenantId, access: 'FULL', linkedUserId: me.id },
        });
      }

      if (owner) {
        await prisma.$transaction([
          prisma.resortGroupTenant.create({
            data: { groupId, tenantId: target.id, access: 'FULL', linkedUserId: owner.id },
          }),
          prisma.resortGroupEvent.create({
            data: {
              groupId, tenantId: target.id, actorUserId: me.id, action: 'link_approved',
              metadata: { reason: 'same_verified_email', resortName: target.name },
            },
          }),
        ]);
        clearResortOverviewCache();
        return ok(
          { status: 'connected', group: await loadGroupForOwner(me.id, me.tenantId) },
          `${target.name} is connected.`,
        );
      }

      // ── Somebody else's resort: ask them ──────────────────────────────────
      const targetOwner = await resortOwner(target.id);
      if (!targetOwner) {
        return reply.status(400).send({
          success: false,
          error: 'That resort has no verified owner to ask.',
          code: 'RESORT_HAS_NO_OWNER',
        });
      }

      const pending = await prisma.resortLinkRequest.findFirst({
        where: { groupId, tenantId: target.id, approvedAt: null, declinedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (pending && Date.now() - pending.createdAt.getTime() < RESEND_COOLDOWN_MS) {
        return reply.status(429).send({
          success: false,
          error: 'That request was just sent. Give them a minute before asking again.',
          code: 'REQUEST_TOO_SOON',
        });
      }

      // Asking again replaces the old token rather than leaving two live: the
      // owner should not have to work out which of two emails is the real one.
      const token = randomBytes(32).toString('hex');
      await prisma.$transaction([
        prisma.resortLinkRequest.deleteMany({
          where: { groupId, tenantId: target.id, approvedAt: null, declinedAt: null },
        }),
        prisma.resortLinkRequest.create({
          data: {
            groupId, tenantId: target.id, requestedById: me.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
          },
        }),
        prisma.resortGroupEvent.create({
          data: {
            groupId, tenantId: target.id, actorUserId: me.id, action: 'link_requested',
            metadata: { resortName: target.name },
          },
        }),
      ]);

      const asker = `${meFull.firstName} ${meFull.lastName}`.trim();
      const link = `${webAppUrl()}/resort-link/${token}`;
      await sendEmail({
        to: targetOwner.email,
        subject: `${asker} would like to connect ${target.name} to their account`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a6b5e">A request about ${target.name}</h2>
            <p>Hi ${targetOwner.firstName},</p>
            <p>
              <strong>${asker}</strong> (${me.email}) runs <strong>${home.name}</strong> on
              ResortPro and would like to see ${target.name} alongside it.
            </p>
            <p>Nothing has changed yet. You decide how much this gives them:</p>
            <ul>
              <li><strong>Full access</strong> — everything you can do in ${target.name}, including its billing.</li>
              <li><strong>Figures only</strong> — occupancy and totals on their overview. They cannot open ${target.name}.</li>
            </ul>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                Review this request
              </a>
            </p>
            <p>Or copy this link: <a href="${link}">${link}</a></p>
            <p>You will be asked to sign in to ${target.name} first. The link expires in 7 days, and ignoring it refuses the request.</p>
          </div>
        `,
      });

      return ok(
        { status: 'requested', group: await loadGroupForOwner(me.id, me.tenantId) },
        `We have asked the owner of ${target.name}.`,
      );
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

        // A user that exists only because of this connection has no other
        // purpose, so it stops working now rather than whenever its token
        // happens to expire — middleware/auth.ts re-reads isActive on every
        // request. A same-email link is left alone: that login is the person's
        // own account on their own resort.
        if (member.linkedUserCreated && member.linkedUserId) {
          await tx.user.update({ where: { id: member.linkedUserId }, data: { isActive: false } });
          await tx.refreshToken.deleteMany({ where: { userId: member.linkedUserId } });
        }
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

  /* ── GET /api/resort-group/requests/incoming ─────────────────────────────
   * Requests waiting on *this* resort. The banner in the dashboard reads this,
   * so approving never depends on an email having arrived.
   */
  app.get('/requests/incoming', {
    schema: {
      tags: ['resort-group'],
      summary: 'Requests waiting for this resort\'s owner',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const user = request.user as JwtPayload;
      const rows = await prisma.resortLinkRequest.findMany({
        where: {
          tenantId: user.tenantId, approvedAt: null, declinedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          group: { select: { name: true } },
          // Who is asking, and from which resort — an owner cannot decide this
          // without both.
        },
      });

      const askers = await prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.requestedById) } },
        select: { id: true, firstName: true, lastName: true, email: true, tenant: { select: { name: true } } },
      });
      const byId = new Map(askers.map((a) => [a.id, a]));

      return ok(rows.map((r) => {
        const asker = byId.get(r.requestedById);
        return {
          id: r.id,
          groupName: r.group.name,
          askerName: asker ? `${asker.firstName} ${asker.lastName}`.trim() : 'Another owner',
          askerEmail: asker?.email ?? null,
          askerResort: asker?.tenant.name ?? null,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
        };
      }));
    },
  });

  /* ── GET /api/resort-group/requests/by-token/:token ──────────────────────
   * Resolve the link in the email to the request it stands for.
   *
   * The token is only a lookup key. Authority comes from being signed in as
   * this resort's owner, which is checked here and again on approve — so a
   * forwarded email gives the reader nothing.
   */
  app.get('/requests/by-token/:token', {
    schema: {
      tags: ['resort-group'],
      summary: 'The request an emailed link refers to',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const { token } = request.params as { token: string };

      const found = await prisma.resortLinkRequest.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { group: { select: { name: true } }, tenant: { select: { id: true, name: true } } },
      });
      // A request for somebody else's resort answers exactly as an unknown
      // token does. Whoever is reading the email is not owed the difference.
      if (!found || found.tenantId !== user.tenantId) {
        return reply.status(404).send({
          success: false, error: 'This link is not valid.', code: 'REQUEST_NOT_FOUND',
        });
      }
      if (found.approvedAt || found.declinedAt) {
        return reply.status(410).send({
          success: false, error: 'This request has already been answered.',
          code: 'LINK_REQUEST_USED',
        });
      }
      if (found.expiresAt < new Date()) {
        return reply.status(410).send({
          success: false, error: 'This request has expired. Ask them to send it again.',
          code: 'LINK_REQUEST_EXPIRED',
        });
      }

      const asker = await prisma.user.findUnique({
        where: { id: found.requestedById },
        select: { firstName: true, lastName: true, email: true, tenant: { select: { name: true } } },
      });

      return ok({
        id: found.id,
        resortName: found.tenant.name,
        groupName: found.group.name,
        askerName: asker ? `${asker.firstName} ${asker.lastName}`.trim() : 'Another owner',
        askerEmail: asker?.email ?? null,
        askerResort: asker?.tenant.name ?? null,
        expiresAt: found.expiresAt,
      });
    },
  });

  /* ── POST /api/resort-group/requests/:id/approve ─────────────────────────
   * Say yes, and say how much.
   *
   * Full access means a real user row inside this resort, created here and
   * recorded as created, so that revoking it later can switch exactly that
   * account off. It carries a password nobody holds: it is reachable only by
   * switching from the group that was granted it.
   *
   * Figures only creates no user at all. There is nothing to sign in as, which
   * is a stronger guarantee than a permission check.
   */
  app.post('/requests/:id/approve', {
    schema: {
      tags: ['resort-group'],
      summary: 'Approve a request to connect this resort',
      security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['access'], properties: { access: { type: 'string' } } },
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = validate(approveSchema, request.body, reply);
      if (!body) return;

      const found = await prisma.resortLinkRequest.findUnique({
        where: { id },
        include: { group: { select: { id: true, name: true, ownerUserId: true } } },
      });
      if (!found || found.tenantId !== user.tenantId) {
        return reply.status(404).send({
          success: false, error: 'This request does not exist.', code: 'REQUEST_NOT_FOUND',
        });
      }
      if (found.approvedAt || found.declinedAt) {
        return reply.status(410).send({
          success: false, error: 'This request has already been answered.',
          code: 'LINK_REQUEST_USED',
        });
      }
      if (found.expiresAt < new Date()) {
        return reply.status(410).send({
          success: false, error: 'This request has expired.', code: 'LINK_REQUEST_EXPIRED',
        });
      }
      if (await prisma.resortGroupTenant.findUnique({ where: { tenantId: user.tenantId } })) {
        return reply.status(409).send({
          success: false, error: 'This resort is already connected to an account.',
          code: 'RESORT_ALREADY_CONNECTED',
        });
      }
      const members = await prisma.resortGroupTenant.count({ where: { groupId: found.group.id } });
      if (members + 1 > MAX_RESORTS_PER_GROUP) {
        return reply.status(400).send({
          success: false, error: 'That account already holds as many resorts as it can.',
          code: 'GROUP_LIMIT_REACHED',
        });
      }

      const asker = await prisma.user.findUnique({
        where: { id: found.requestedById },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (!asker) {
        return reply.status(410).send({
          success: false, error: 'Whoever asked for this no longer has an account.',
          code: 'LINK_REQUEST_USED',
        });
      }

      let linkedUserId: string | null = null;
      let linkedUserCreated = false;
      if (body.access === 'FULL') {
        ({ linkedUserId, linkedUserCreated } = await accountForConnection(user.tenantId, asker));
      }

      await prisma.$transaction([
        prisma.resortGroupTenant.create({
          data: {
            groupId: found.group.id, tenantId: user.tenantId, access: body.access,
            linkedUserId, linkedUserCreated, approvedById: user.sub,
          },
        }),
        prisma.resortLinkRequest.update({ where: { id }, data: { approvedAt: new Date() } }),
        prisma.resortGroupEvent.create({
          data: {
            groupId: found.group.id, tenantId: user.tenantId, actorUserId: user.sub,
            action: 'link_approved', metadata: { access: body.access },
          },
        }),
      ]);
      clearResortOverviewCache();

      const resort = await prisma.tenant.findUniqueOrThrow({
        where: { id: user.tenantId }, select: { name: true },
      });
      await sendEmail({
        to: asker.email,
        subject: `${resort.name} is now connected to your account`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a6b5e">${resort.name} is connected</h2>
            <p>Hi ${asker.firstName},</p>
            <p>
              ${body.access === 'FULL'
                ? `You can now open ${resort.name} from the resort menu in your dashboard.`
                : `${resort.name}'s figures now appear on your all-resorts page. You cannot open the resort itself.`}
            </p>
            <p style="margin:24px 0">
              <a href="${webAppUrl()}/dashboard/resorts" style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                See all your resorts
              </a>
            </p>
          </div>
        `,
      });

      return ok({ access: body.access }, `${resort.name} is connected.`);
    },
  });

  /* ── POST /api/resort-group/requests/:id/decline ─────────────────────────
   * Say no. Declining twice is the same as declining once, because the second
   * click is somebody wondering whether the first one worked.
   */
  app.post('/requests/:id/decline', {
    schema: {
      tags: ['resort-group'],
      summary: 'Decline a request to connect this resort',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const found = await prisma.resortLinkRequest.findUnique({ where: { id } });
      if (!found || found.tenantId !== user.tenantId) {
        return reply.status(404).send({
          success: false, error: 'This request does not exist.', code: 'REQUEST_NOT_FOUND',
        });
      }
      if (found.approvedAt) {
        return reply.status(410).send({
          success: false, error: 'This request was already approved.',
          code: 'LINK_REQUEST_USED',
        });
      }
      if (found.declinedAt) return ok(null, 'Already declined.');

      await prisma.$transaction([
        prisma.resortLinkRequest.update({ where: { id }, data: { declinedAt: new Date() } }),
        prisma.resortGroupEvent.create({
          data: {
            groupId: found.groupId, tenantId: user.tenantId, actorUserId: user.sub,
            action: 'link_declined',
          },
        }),
      ]);

      const asker = await prisma.user.findUnique({
        where: { id: found.requestedById }, select: { email: true, firstName: true },
      });
      const resort = await prisma.tenant.findUniqueOrThrow({
        where: { id: user.tenantId }, select: { name: true },
      });
      if (asker) {
        await sendEmail({
          to: asker.email,
          subject: `Your request about ${resort.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <p>Hi ${asker.firstName},</p>
              <p>${resort.name}'s owner has declined your request to connect it to your account.</p>
            </div>
          `,
        });
      }

      return ok(null, 'Request declined.');
    },
  });

  /* ── PATCH /api/resort-group/members/:tenantId ───────────────────────────
   * Change what an existing connection gives.
   *
   * Only this resort's own owner may do it — never the person who asked for
   * access. If the asking side could raise its own level, the choice made when
   * the request was approved would have been theatre.
   *
   * Dropping to figures only switches off the account this connection uses, so
   * the change takes effect on the very next request rather than whenever a
   * token happens to expire. An account this resort was already using for its
   * own reasons is left alone; it simply stops being reachable by switching.
   */
  app.patch('/members/:tenantId', {
    schema: {
      tags: ['resort-group'],
      summary: 'Change how much a connection gives',
      security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['access'], properties: { access: { type: 'string' } } },
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;
      const { tenantId } = request.params as { tenantId: string };
      const body = validate(approveSchema, request.body, reply);
      if (!body) return;

      const member = await prisma.resortGroupTenant.findUnique({
        where: { tenantId },
        include: { group: { select: { id: true, ownerUserId: true } } },
      });
      if (!member) {
        return reply.status(404).send({
          success: false, error: 'That resort is not connected.', code: 'RESORT_NOT_FOUND',
        });
      }
      if (member.tenantId !== user.tenantId) {
        return reply.status(403).send({
          success: false,
          error: 'Only this resort\'s own owner can change what a connection gives.',
          code: 'NOT_RESORT_OWNER',
        });
      }
      if (member.access === body.access) {
        return ok({ access: member.access }, 'Nothing changed.');
      }

      let linkedUserId = member.linkedUserId;
      let linkedUserCreated = member.linkedUserCreated;

      if (body.access === 'NUMBERS_ONLY') {
        if (member.linkedUserCreated && member.linkedUserId) {
          await prisma.$transaction([
            prisma.user.update({ where: { id: member.linkedUserId }, data: { isActive: false } }),
            prisma.refreshToken.deleteMany({ where: { userId: member.linkedUserId } }),
          ]);
        }
      } else {
        const owner = await prisma.user.findUnique({
          where: { id: member.group.ownerUserId },
          select: { email: true, firstName: true, lastName: true },
        });
        if (!owner) {
          return reply.status(410).send({
            success: false, error: 'Whoever this was shared with no longer has an account.',
            code: 'GROUP_OWNER_GONE',
          });
        }
        if (linkedUserCreated && linkedUserId) {
          // The same account as before, switched back on — not a second one.
          await prisma.user.update({ where: { id: linkedUserId }, data: { isActive: true } });
        } else if (!linkedUserId) {
          ({ linkedUserId, linkedUserCreated } = await accountForConnection(tenantId, owner));
        }
      }

      await prisma.$transaction([
        prisma.resortGroupTenant.update({
          where: { id: member.id },
          data: { access: body.access, linkedUserId, linkedUserCreated },
        }),
        prisma.resortGroupEvent.create({
          data: {
            groupId: member.group.id, tenantId, actorUserId: user.sub, action: 'access_changed',
            metadata: { from: member.access, to: body.access },
          },
        }),
      ]);
      clearResortOverviewCache();

      return ok({ access: body.access }, 'Access updated.');
    },
  });

  /* ── GET /api/resort-group/events ────────────────────────────────────────
   * Who did what, and when.
   *
   * Two people are owed this and they are owed different slices of it. The
   * person who built the group sees all of it. The owner of a connected resort
   * sees what happened to *their* resort — which is the answer to "who gave
   * that account access to my books, and when?", a question nobody should have
   * to ask support.
   */
  app.get('/events', {
    schema: {
      tags: ['resort-group'],
      summary: 'What has happened to these connections',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const user = request.user as JwtPayload;

      const myGroup = await prisma.resortGroup.findFirst({
        where: { ownerUserId: user.sub }, select: { id: true },
      });
      const membership = await prisma.resortGroupTenant.findUnique({
        where: { tenantId: user.tenantId }, select: { groupId: true },
      });

      const where = myGroup
        ? { groupId: myGroup.id }
        : membership
          ? { groupId: membership.groupId, tenantId: user.tenantId }
          : null;
      if (!where) {
        return reply.status(404).send({
          success: false, error: 'There is nothing connected to this resort.',
          code: 'NO_RESORT_GROUP',
        });
      }

      const events = await prisma.resortGroupEvent.findMany({
        where, orderBy: { createdAt: 'desc' }, take: 50,
      });
      const tenantIds = Array.from(new Set(events.map((e) => e.tenantId).filter((id): id is string => !!id)));
      const actorIds = Array.from(new Set(events.map((e) => e.actorUserId).filter((id): id is string => !!id)));
      const [tenants, actors] = await Promise.all([
        prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }),
        prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        }),
      ]);
      const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
      const actorName = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]));

      return ok(events.map((e) => ({
        id: e.id,
        action: e.action,
        tenantId: e.tenantId,
        resortName: e.tenantId ? tenantName.get(e.tenantId) ?? null : null,
        actorName: e.actorUserId ? actorName.get(e.actorUserId) ?? null : null,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })));
    },
  });

  /* ── GET /api/resort-group/connection ────────────────────────────────────
   * Who can see *this* resort, from outside it.
   *
   * The mirror image of GET /. That one answers "which resorts can I see"; this
   * one answers the question the other owner has, which is the one that
   * actually matters for trust: somebody else's account is attached to my
   * books — whose, at what level, and since when.
   *
   * A resort in its own owner's group answers null. That is the same person on
   * both sides, and presenting it as an outside party watching them would be a
   * small lie that makes the screen frightening for no reason.
   */
  app.get('/connection', {
    schema: {
      tags: ['resort-group'],
      summary: 'The outside account this resort is connected to, if any',
      security: [{ bearerAuth: [] }],
    },
    preHandler: requireRole('OWNER'),
    handler: async (request) => {
      const user = request.user as JwtPayload;
      const member = await prisma.resortGroupTenant.findUnique({
        where: { tenantId: user.tenantId },
        include: { group: { select: { id: true, name: true, ownerUserId: true } } },
      });
      if (!member) return ok(null);

      const [owner, me] = await Promise.all([
        prisma.user.findUnique({
          where: { id: member.group.ownerUserId },
          select: { email: true, firstName: true, lastName: true, tenant: { select: { name: true } } },
        }),
        prisma.user.findUnique({ where: { id: user.sub }, select: { email: true } }),
      ]);
      if (!owner) return ok(null);
      if (me && owner.email.toLowerCase() === me.email.toLowerCase()) return ok(null);

      return ok({
        groupName: member.group.name,
        ownerName: `${owner.firstName} ${owner.lastName}`.trim(),
        ownerEmail: owner.email,
        ownerResort: owner.tenant?.name ?? null,
        access: member.access,
        since: member.approvedAt,
      });
    },
  });
}

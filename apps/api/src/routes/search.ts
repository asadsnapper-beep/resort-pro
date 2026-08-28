/**
 * Global search — GET /api/search?q=…
 *
 * Phase A of plan/global-search.md: the API only. The dashboard header still
 * carries an inert input; replacing it is Phase B.
 *
 * Scope is deliberately four record types — bookings, guests, rooms, invoices.
 * A small search that is always right beats a broad one that returns weak or
 * unauthorised matches, and every extra table is another place a permission
 * mistake can hide.
 *
 * Everything reads through `request.db`, the tenant-scoped client, so a tenant
 * id can never arrive from the caller. Categories a role may not see are not
 * queried at all rather than queried and filtered — an omitted query cannot
 * leak through a forgotten projection.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { searchMetrics } from '../utils/search-metrics';
import { ok } from '../utils/response';
import type { JwtPayload, UserRole } from '@resort-pro/types';

/** Server owns the caps; the client cannot widen them. */
const PER_TYPE_CAP = 3;
const TOTAL_CAP = 12;
const MIN_QUERY_LENGTH = 2;

const querySchema = z.object({
  q: z.string().max(120).optional().default(''),
});

export type SearchResultType = 'booking' | 'guest' | 'room' | 'invoice';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
  /** Ranking only — the client sorts by array order and never shows this. */
  score: number;
}

/**
 * Which categories a role may search.
 *
 * Mirrors the permission table in plan/global-search.md. Kept as data next to
 * the queries it gates so the two cannot drift: adding a category without
 * deciding who sees it is then a type error rather than an oversight.
 */
const CATEGORY_ACCESS: Record<SearchResultType, UserRole[]> = {
  booking: ['OWNER', 'MANAGER', 'RECEPTIONIST'],
  guest:   ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'],
  room:    ['OWNER', 'MANAGER', 'RECEPTIONIST'],
  // Billing is owner/manager only, matching the rest of the dashboard.
  invoice: ['OWNER', 'MANAGER'],
};

const canSee = (role: UserRole, type: SearchResultType) => CATEGORY_ACCESS[type].includes(role);

/**
 * Phone numbers are typed in whatever shape the guest said them.
 * "+880 1711-002200", "01711002200" and "1711 002200" are one number, so both
 * sides are reduced to digits before comparing.
 */
const digitsOnly = (value: string) => value.replace(/\D+/g, '');

/** Score bands, from plan/global-search.md §5. Exact identifiers beat text. */
const SCORE = {
  exactIdentifier: 1000,  // confirmation / invoice number
  exactPhone:       900,
  exactRoom:        800,
  exactEmail:       700,
  startsWith:       500,
  contains:         100,
} as const;

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

function nameScore(query: string, ...parts: (string | null | undefined)[]): number {
  const q = norm(query);
  const full = parts.map(norm).filter(Boolean).join(' ');
  if (!full) return SCORE.contains;
  if (full === q) return SCORE.startsWith + 100;
  if (full.startsWith(q) || parts.some((p) => norm(p).startsWith(q))) return SCORE.startsWith;
  return SCORE.contains;
}

/**
 * Split the query into terms and require every term to match somewhere.
 *
 * A single `contains` over each field separately cannot match "Karim Hossain":
 * no one field holds the whole string, so the most natural thing a receptionist
 * types returns nothing. Per-term AND fixes that — "Karim" against firstName
 * and "Hossain" against lastName both hit — while a one-word query behaves
 * exactly as before.
 */
function termsOf(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
}

export async function searchRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: {
      tags: ['search'],
      summary: 'Global search across bookings, guests, rooms and invoices',
      security: [{ bearerAuth: [] }],
    },
    // 60/min per authenticated user, per the plan. Generous for typing with a
    // 250 ms debounce, tight enough that the endpoint is not a scraping tool.
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { db } = request;
      const { role, tenantId } = request.user as JwtPayload;
      const { q } = querySchema.parse(request.query);

      const query = q.trim();
      // Below the threshold, return empty rather than matching broadly — a
      // one-character `contains` is a table scan that returns noise.
      if (query.replace(/\s+/g, '').length < MIN_QUERY_LENGTH) {
        // Not counted: nothing was searched, so folding this into the
        // no-result rate would make search look worse the more people type.
        return reply.send(ok({ results: [], query }, 'Search'));
      }

      const terms = termsOf(query);
      const qLower = query.toLowerCase();
      const qDigits = digitsOnly(query);
      const results: SearchResult[] = [];

      // Phone numbers are stored exactly as they were typed — "+880
      // 1711-002200" — so a `contains` for "01711002200" matches nothing. The
      // punctuation has to come out of the *stored* value before comparing,
      // which Prisma's string filters cannot express, so this one comparison
      // drops to SQL. tenantId is bound explicitly because a raw query does not
      // go through the tenant-scoped client.
      //
      // Six digits before trying: fewer than that is a room number or an
      // invoice fragment, not a phone number.
      let phoneGuestIds: string[] = [];
      if (qDigits.length >= 6) {
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM guests
          WHERE "tenantId" = ${tenantId}
            AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${'%' + qDigits}
          LIMIT 20
        `;
        phoneGuestIds = rows.map((r) => r.id);
      }

      // ── Bookings ──────────────────────────────────────────────────────────
      if (canSee(role, 'booking')) {
        const bookings = await db.booking.findMany({
          where: {
            OR: [
              ...(phoneGuestIds.length ? [{ guestId: { in: phoneGuestIds } }] : []),
              { AND: terms.map((term) => ({
              OR: [
                { confirmationNo: { contains: term, mode: 'insensitive' as const } },
                { guest: { firstName: { contains: term, mode: 'insensitive' as const } } },
                { guest: { lastName:  { contains: term, mode: 'insensitive' as const } } },
                { guest: { email:     { contains: term, mode: 'insensitive' as const } } },
                { guest: { phone:     { contains: term, mode: 'insensitive' as const } } },
                { room:  { number:    { contains: term, mode: 'insensitive' as const } } },
              ],
            })) },
            ],
          },
          select: {
            id: true, confirmationNo: true, checkIn: true, checkOut: true, status: true,
            guest: { select: { firstName: true, lastName: true, email: true, phone: true } },
            room:  { select: { number: true } },
          },
          // Upcoming and current stays matter more than history when text
          // relevance is otherwise equal.
          orderBy: { checkIn: 'desc' },
          take: PER_TYPE_CAP * 4,
        });

        for (const b of bookings) {
          const guestName = `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''}`.trim();
          let score = nameScore(query, b.guest?.firstName, b.guest?.lastName);
          if (norm(b.confirmationNo) === qLower) score = SCORE.exactIdentifier;
          else if (qDigits.length >= 6 && digitsOnly(b.guest?.phone ?? '').endsWith(qDigits)) score = SCORE.exactPhone;
          else if (norm(b.guest?.email) === qLower) score = SCORE.exactEmail;
          else if (norm(b.room?.number) === qLower) score = SCORE.exactRoom;

          const stay = `${b.checkIn.toISOString().slice(0, 10)} → ${b.checkOut.toISOString().slice(0, 10)}`;
          results.push({
            id: b.id,
            type: 'booking',
            title: guestName || b.confirmationNo,
            subtitle: `${b.confirmationNo}${b.room?.number ? ` · Room ${b.room.number}` : ''} · ${stay}`,
            status: b.status,
            href: `/dashboard/bookings/${b.id}`,
            score,
          });
        }
      }

      // ── Guests ────────────────────────────────────────────────────────────
      if (canSee(role, 'guest')) {
        const guests = await db.guest.findMany({
          where: {
            OR: [
              ...(phoneGuestIds.length ? [{ id: { in: phoneGuestIds } }] : []),
              { AND: terms.map((term) => ({
              OR: [
                { firstName: { contains: term, mode: 'insensitive' as const } },
                { lastName:  { contains: term, mode: 'insensitive' as const } },
                { email:     { contains: term, mode: 'insensitive' as const } },
                { phone:     { contains: term, mode: 'insensitive' as const } },
              ],
            })) },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          take: PER_TYPE_CAP * 4,
        });

        for (const g of guests) {
          let score = nameScore(query, g.firstName, g.lastName);
          if (qDigits.length >= 6 && digitsOnly(g.phone ?? '').endsWith(qDigits)) score = SCORE.exactPhone;
          else if (norm(g.email) === qLower) score = SCORE.exactEmail;

          results.push({
            id: g.id,
            type: 'guest',
            title: `${g.firstName} ${g.lastName}`.trim(),
            // Contact details are the point of the row, but nothing beyond
            // them: no ID documents, notes or payment data. See §4.
            subtitle: [g.phone, g.email].filter(Boolean).join(' · ') || 'No contact details',
            href: `/dashboard/guests?search=${encodeURIComponent(`${g.firstName} ${g.lastName}`.trim())}`,
            score,
          });
        }
      }

      // ── Rooms ─────────────────────────────────────────────────────────────
      if (canSee(role, 'room')) {
        const rooms = await db.room.findMany({
          where: {
            isActive: true,
            AND: terms.map((term) => ({
              OR: [
                { number: { contains: term, mode: 'insensitive' as const } },
                { name:   { contains: term, mode: 'insensitive' as const } },
              ],
            })),
          },
          select: { id: true, number: true, name: true, type: true, status: true },
          take: PER_TYPE_CAP * 4,
        });

        for (const r of rooms) {
          let score = nameScore(query, r.number, r.name);
          if (norm(r.number) === qLower) score = SCORE.exactRoom;

          results.push({
            id: r.id,
            type: 'room',
            title: `Room ${r.number}${r.name ? ` — ${r.name}` : ''}`,
            subtitle: r.type,
            status: r.status,
            href: `/dashboard/rooms?search=${encodeURIComponent(r.number)}`,
            score,
          });
        }
      }

      // ── Invoices ──────────────────────────────────────────────────────────
      if (canSee(role, 'invoice')) {
        const invoices = await db.invoice.findMany({
          where: {
            AND: terms.map((term) => ({
              OR: [
                { invoiceNumber: { contains: term, mode: 'insensitive' as const } },
                { guestName:     { contains: term, mode: 'insensitive' as const } },
              ],
            })),
          },
          select: { id: true, invoiceNumber: true, guestName: true, total: true, paidAmount: true, status: true },
          take: PER_TYPE_CAP * 4,
        });

        for (const inv of invoices) {
          let score = nameScore(query, inv.guestName);
          if (norm(inv.invoiceNumber) === qLower) score = SCORE.exactIdentifier;

          const balance = Number(inv.total) - Number(inv.paidAmount);
          results.push({
            id: inv.id,
            type: 'invoice',
            title: inv.invoiceNumber,
            subtitle: `${inv.guestName} · Balance ${balance.toFixed(2)}`,
            status: inv.status,
            href: `/dashboard/invoices/${inv.id}`,
            score,
          });
        }
      }

      // Rank first, then cap per type, so the 3 kept for a type are its best
      // three rather than whichever the database happened to return first.
      results.sort((a, b) => b.score - a.score);
      const perType: Record<string, number> = {};
      const capped: SearchResult[] = [];
      for (const r of results) {
        perType[r.type] = (perType[r.type] ?? 0) + 1;
        if (perType[r.type]! > PER_TYPE_CAP) continue;
        capped.push(r);
        if (capped.length >= TOTAL_CAP) break;
      }

      searchMetrics.recordQuery(capped.length);
      return reply.send(ok({ results: capped, query }, 'Search'));
    },
  });

  /**
   * Fire-and-forget: the palette calls this when someone opens a result.
   *
   * Selection rate is the one quality signal the server cannot infer — a query
   * that returns three bookings and a query that returns the *right* booking
   * look identical from here. Deliberately takes only the result type, never
   * the query or the record id: knowing that guests get opened more than
   * invoices is enough to act on, and storing who searched for whom is not.
   */
  app.post('/selected', {
    schema: {
      tags: ['search'],
      summary: 'Record that a search result was opened',
      security: [{ bearerAuth: [] }],
    },
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { type } = (request.body ?? {}) as { type?: string };
      const known = ['booking', 'guest', 'room', 'invoice', 'action'];
      searchMetrics.recordSelection(known.includes(type ?? '') ? type! : 'other');
      return reply.status(204).send();
    },
  });
}

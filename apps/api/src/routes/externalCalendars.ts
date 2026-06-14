/**
 * External Calendar routes — /api/external-calendars
 *
 * Dashboard-only (staff/manager). Never exposed to public/guest endpoints.
 *
 * GET    /                   list all calendars for tenant
 * POST   /                   add a new calendar
 * PATCH  /:id                update name/url/isActive
 * DELETE /:id                remove calendar
 * POST   /:id/sync           manually trigger sync right now
 * GET    /:id/status         last sync info + error
 * POST   /test-url           validate an iCal URL before saving
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@resort-pro/database'
import { requireAuth, requireRole } from '../middleware/auth'
import { ok } from '../utils/response'
import type { JwtPayload } from '@resort-pro/types'
import { parseIcal } from '../utils/ical-parser'
import { syncCalendarsForRoom } from '../jobs/ical-sync'

const createSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().min(1).max(80),
  icalUrl: z.string().url(),
  isActive: z.boolean().default(true),
})

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  icalUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
})

// ─── Fetch + validate an iCal URL ────────────────────────────────────────────

async function fetchAndValidateUrl(url: string): Promise<{ ok: boolean; eventCount: number; error?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return { ok: false, eventCount: 0, error: `HTTP ${res.status}` }
    const text = await res.text()
    if (!text.includes('BEGIN:VCALENDAR')) {
      return { ok: false, eventCount: 0, error: 'URL does not return a valid iCal feed' }
    }
    const events = parseIcal(text)
    return { ok: true, eventCount: events.length }
  } catch (err: any) {
    return { ok: false, eventCount: 0, error: err?.message ?? 'Request failed' }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function externalCalendarRoutes(app: FastifyInstance) {

  // ── GET / — list all for tenant ───────────────────────────────────────────
  app.get('/', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const cals = await prisma.externalCalendar.findMany({
        where: { tenantId },
        include: {
          room: { select: { id: true, number: true, name: true } },
        },
        orderBy: [{ roomId: 'asc' }, { createdAt: 'asc' }],
      })

      // Attach imported booking count per calendar (single query via groupBy)
      const countRows = await prisma.booking.groupBy({
        by: ['externalSource'],
        where: { tenantId, externalSource: { not: null } },
        _count: { id: true },
      })
      const countBySource = Object.fromEntries(
        countRows.map(r => [r.externalSource!, r._count.id])
      )

      const withCounts = cals.map(cal => ({
        ...cal,
        importedCount: countBySource[cal.name] ?? 0,
      }))

      return ok(withCounts)
    },
  })

  // ── POST / — create ───────────────────────────────────────────────────────
  app.post('/', {
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const body = createSchema.parse(request.body)

      // Verify room belongs to tenant
      const room = await prisma.room.findFirst({ where: { id: body.roomId, tenantId } })
      if (!room) return reply.code(404).send({ error: 'Room not found' })

      const cal = await prisma.externalCalendar.create({
        data: {
          tenantId,
          roomId: body.roomId,
          name: body.name,
          icalUrl: body.icalUrl,
          isActive: body.isActive,
        },
        include: { room: { select: { id: true, number: true, name: true } } },
      })

      // Immediately sync the new calendar (don't make staff wait 15 min)
      syncCalendarsForRoom(body.roomId, [cal]).catch(() => {})

      return reply.code(201).send(ok(cal))
    },
  })

  // ── PATCH /:id ────────────────────────────────────────────────────────────
  app.patch('/:id', {
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { id } = request.params as { id: string }
      const body = updateSchema.parse(request.body)

      const existing = await prisma.externalCalendar.findFirst({ where: { id, tenantId } })
      if (!existing) return reply.code(404).send({ error: 'Calendar not found' })

      const updated = await prisma.externalCalendar.update({
        where: { id },
        data: body,
        include: { room: { select: { id: true, number: true, name: true } } },
      })

      return ok(updated)
    },
  })

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { id } = request.params as { id: string }

      const existing = await prisma.externalCalendar.findFirst({ where: { id, tenantId } })
      if (!existing) return reply.code(404).send({ error: 'Calendar not found' })

      await prisma.externalCalendar.delete({ where: { id } })
      return ok({ deleted: true })
    },
  })

  // ── POST /:id/sync — manual sync ──────────────────────────────────────────
  app.post('/:id/sync', {
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { id } = request.params as { id: string }

      const cal = await prisma.externalCalendar.findFirst({ where: { id, tenantId } })
      if (!cal) return reply.code(404).send({ error: 'Calendar not found' })

      // Run sync (await so we can return fresh status)
      await syncCalendarsForRoom(cal.roomId, [cal])

      const refreshed = await prisma.externalCalendar.findUnique({ where: { id } })
      return ok({ calendar: refreshed })
    },
  })

  // ── GET /:id/status ───────────────────────────────────────────────────────
  app.get('/:id/status', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { id } = request.params as { id: string }

      const cal = await prisma.externalCalendar.findFirst({
        where: { id, tenantId },
        include: { room: { select: { id: true, number: true, name: true } } },
      })
      if (!cal) return reply.code(404).send({ error: 'Calendar not found' })

      return ok(cal)
    },
  })

  // ── POST /test-url — validate before saving ───────────────────────────────
  app.post('/test-url', {
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { url } = z.object({ url: z.string().url() }).parse(request.body)
      const result = await fetchAndValidateUrl(url)
      return ok(result)
    },
  })
}

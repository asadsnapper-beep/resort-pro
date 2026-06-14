/**
 * iCal Sync Job
 *
 * Two exports:
 *  1. startICalSyncCron()  — called once at server startup; runs every 15 min
 *  2. syncCalendarsForRoom(roomId, calendars) — called inline when a booking is
 *     being created, so we get fresh data right before saving (Layer 1 defense)
 *
 * What it does per ExternalCalendar:
 *  - Fetches the iCal URL (10s timeout)
 *  - Parses VEVENT blocks
 *  - For each event:
 *      • CANCELLED  → cancel the matching booking if found
 *      • exists     → update dates if changed
 *      • new        → create a "blocked" booking with a dummy guest
 *  - Detects conflicts: OTA booking overlaps an existing DIRECT booking
 *    → marks the DIRECT booking as CONFLICT and logs a warning
 *  - Updates lastSyncAt / lastError
 */

import cron from 'node-cron'
import { prisma } from '@resort-pro/database'
import { parseIcal, ICalEvent } from '../utils/ical-parser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarRow {
  id: string
  tenantId: string
  roomId: string
  name: string
  icalUrl: string
}

// ─── Core sync logic for a single calendar ────────────────────────────────────

async function syncOneCalendar(cal: CalendarRow): Promise<void> {
  let icalText: string

  // Fetch iCal URL (10s timeout)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(cal.icalUrl, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    icalText = await res.text()
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    await prisma.externalCalendar.update({
      where: { id: cal.id },
      data: { lastError: msg, lastSyncAt: new Date() },
    })
    console.warn(`[ical-sync] ${cal.name} (${cal.roomId}): fetch error — ${msg}`)
    return
  }

  // Parse
  let events: ICalEvent[]
  try {
    events = parseIcal(icalText)
  } catch (err: any) {
    await prisma.externalCalendar.update({
      where: { id: cal.id },
      data: { lastError: `Parse error: ${err?.message}`, lastSyncAt: new Date() },
    })
    return
  }

  // Upsert events
  let created = 0
  let updated = 0
  let cancelled = 0
  let conflicts = 0

  for (const event of events) {
    const existing = await prisma.booking.findFirst({
      where: { tenantId: cal.tenantId, externalUid: event.uid },
    })

    if (event.status === 'CANCELLED') {
      if (existing && existing.status !== 'CANCELLED') {
        await prisma.booking.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED' },
        })
        cancelled++
      }
      continue
    }

    // TENTATIVE events — skip entirely (don't block rooms for unconfirmed holds)
    if (event.status === 'TENTATIVE') continue

    if (existing) {
      // Update dates if changed
      const sameStart = existing.checkIn.getTime() === event.start.getTime()
      const sameEnd = existing.checkOut.getTime() === event.end.getTime()
      if (!sameStart || !sameEnd) {
        await prisma.booking.update({
          where: { id: existing.id },
          data: { checkIn: event.start, checkOut: event.end },
        })
        updated++
      }
      continue
    }

    // Check if a DIRECT booking already occupies these dates → CONFLICT
    const directConflict = await prisma.booking.findFirst({
      where: {
        tenantId: cal.tenantId,
        roomId: cal.roomId,
        externalUid: null, // direct booking (no external UID)
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        checkIn: { lt: event.end },
        checkOut: { gt: event.start },
      },
    })

    if (directConflict) {
      await prisma.booking.update({
        where: { id: directConflict.id },
        data: {
          status: 'CONFLICT',
          conflictNote: `Conflict with ${cal.name} booking (${event.uid}) for dates ${event.start.toISOString().slice(0, 10)} – ${event.end.toISOString().slice(0, 10)}`,
        },
      })
      conflicts++
      console.warn(
        `[ical-sync] CONFLICT detected on room ${cal.roomId}: direct booking ${directConflict.id} vs ${cal.name} ${event.uid}`
      )
    }

    // Get or create a dummy guest for this tenant ("External Guest")
    const dummyEmail = `ical-dummy@${cal.tenantId}.internal`
    const dummyGuest = await prisma.guest.upsert({
      where: { tenantId_email: { tenantId: cal.tenantId, email: dummyEmail } },
      create: {
        tenantId: cal.tenantId,
        firstName: cal.name,
        lastName: 'Guest',
        email: dummyEmail,
      },
      update: {},
    })

    // Create blocked booking
    const confirmationNo = `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    await prisma.booking.create({
      data: {
        tenantId: cal.tenantId,
        roomId: cal.roomId,
        guestId: dummyGuest.id,
        checkIn: event.start,
        checkOut: event.end,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        adults: 1,
        totalAmount: 0,
        paidAmount: 0,
        source: cal.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20),
        externalUid: event.uid,
        externalSource: cal.name,
        confirmationNo,
      },
    })
    created++
  }

  // Mark sync successful
  await prisma.externalCalendar.update({
    where: { id: cal.id },
    data: { lastSyncAt: new Date(), lastError: null },
  })

  if (created || updated || cancelled || conflicts) {
    console.log(
      `[ical-sync] ${cal.name} (room ${cal.roomId}): +${created} created, ~${updated} updated, ✗${cancelled} cancelled, ⚠${conflicts} conflicts`
    )
  }
}

// ─── Sync all active calendars for a specific room ────────────────────────────
// Used by the booking creation route (Layer 1: sync-before-book)

export async function syncCalendarsForRoom(
  roomId: string,
  calendars: CalendarRow[]
): Promise<void> {
  await Promise.allSettled(calendars.map(syncOneCalendar))
}

// ─── Full tenant-wide sync (cron) ─────────────────────────────────────────────

async function runFullSync() {
  console.log('[ical-sync] Starting full sync...')
  const calendars = await prisma.externalCalendar.findMany({
    where: { isActive: true },
  })

  // Group by tenantId for logging
  const byTenant: Record<string, typeof calendars> = {}
  for (const cal of calendars) {
    ;(byTenant[cal.tenantId] ??= []).push(cal)
  }

  let total = 0
  for (const tenantCals of Object.values(byTenant)) {
    await Promise.allSettled(tenantCals.map(syncOneCalendar))
    total += tenantCals.length
  }

  console.log(`[ical-sync] Full sync complete — ${total} calendars processed`)
}

// ─── Start cron ───────────────────────────────────────────────────────────────

export function startICalSyncCron() {
  // Every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runFullSync().catch((err) =>
      console.error('[ical-sync] Unhandled error in cron:', err)
    )
  })

  // Also run immediately on startup (don't wait 15 min)
  runFullSync().catch((err) =>
    console.error('[ical-sync] Startup sync error:', err)
  )

  console.log('[ical-sync] Cron started — polling every 15 minutes')
}
